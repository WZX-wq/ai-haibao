import axios from 'axios'
import crypto from 'crypto'
import { send } from '../utils/tools'
import {
  ensureAccountSchema,
  getMergedRecentAccountRecords,
  getMysqlPool,
  getTodayAiUsage,
  getTodayDownloadUsage,
  isMysqlConfigured,
} from '../utils/mysql'

type OAuthStateRecord = {
  redirectUri: string
  createdAt: number
}

type NormalizedRemoteUser = {
  providerUserId: string
  displayName: string
  avatarUrl: string
  email: string
  rawUser: any
}

const oauthStateStore = new Map<string, OAuthStateRecord>()
const STATE_EXPIRE_MS = 10 * 60 * 1000

function getBaseUrl(req: any) {
  return process.env.APP_BASE_URL || `${req.protocol}://${req.get('host') || '127.0.0.1:7001'}`
}

function getOAuthConfig() {
  const baseUrl = process.env.OAUTH_BASE_URL || ''
  return {
    providerName: process.env.OAUTH_PROVIDER_NAME || 'generic-oauth2',
    baseUrl,
    /** 授权域与换 token 域不同时可单独配置（如部分 IdP 分域名） */
    tokenBaseUrl: process.env.OAUTH_TOKEN_BASE_URL || baseUrl,
    userinfoBaseUrl: process.env.OAUTH_USERINFO_BASE_URL || baseUrl,
    authorizePath: process.env.OAUTH_AUTHORIZE_PATH || '',
    tokenPath: process.env.OAUTH_TOKEN_PATH || '',
    userinfoPath: process.env.OAUTH_USERINFO_PATH || '',
    clientId: process.env.OAUTH_CLIENT_ID || '',
    clientSecret: process.env.OAUTH_CLIENT_SECRET || '',
    redirectUri: process.env.OAUTH_REDIRECT_URI || '',
    logoutUrl: process.env.OAUTH_LOGOUT_URL || '',
    scope: process.env.OAUTH_SCOPE || '',
    /** json：application/json 换 token；form：application/x-www-form-urlencoded */
    tokenRequestFormat: String(process.env.OAUTH_TOKEN_REQUEST_FORMAT || 'form').toLowerCase(),
    /** 统一登录中心 authorize.html 等仅需 client_id/redirect_uri/state，勿带 response_type=1 */
    omitAuthorizeResponseType: process.env.OAUTH_OMIT_RESPONSE_TYPE === '1',
  }
}

function isOAuthConfigured() {
  const config = getOAuthConfig()
  return !!(
    config.baseUrl &&
    config.authorizePath &&
    config.tokenPath &&
    config.clientId &&
    config.clientSecret &&
    config.redirectUri
  )
}

function buildOAuthUrl(baseUrl: string, path: string) {
  if (!path) return baseUrl
  return `${String(baseUrl).replace(/\/$/, '')}/${String(path).replace(/^\//, '')}`
}

/** 飞书开放平台直连（accounts/open.feishu.cn）与鲲穹 oauth2-api.md 流程不同，误配会导致整页飞书登录而非鲲穹 */
function assertNotFeishuOpenPlatformDirect() {
  if (process.env.OAUTH_ALLOW_FEISHU_DIRECT === '1') return
  const c = getOAuthConfig()
  const candidates = [c.baseUrl, c.tokenBaseUrl, c.userinfoBaseUrl].filter((x) => String(x || '').trim())
  for (const raw of candidates) {
    const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    let hostname = ''
    try {
      hostname = new URL(normalized).hostname.toLowerCase()
    } catch {
      continue
    }
    const isFeishuDirect =
      hostname === 'open.feishu.cn' ||
      hostname === 'accounts.feishu.cn' ||
      hostname.endsWith('.feishu.cn') ||
      hostname.includes('larksuite.com')
    if (isFeishuDirect) {
      throw new Error(
        'OAUTH 指向飞书开放平台直连（如 open.feishu.cn / accounts.feishu.cn），因此会打开飞书登录页。' +
          '鲲穹统一登录请按 deploy/oauth2-api.md 使用：OAUTH_BASE_URL=https://login.kunqiongai.com，' +
          'OAUTH_AUTHORIZE_PATH=authorize.html，OAUTH_TOKEN_BASE_URL=https://login.kunqiongai.com，' +
          'OAUTH_TOKEN_PATH=api/oauth/token，client_id/secret 填在鲲穹注册的应用（勿用飞书 cli_ 应用）。' +
          '修改 .env 后执行 docker compose up -d --build 重建 api 容器。' +
          '若确需直连飞书开放平台，请设 OAUTH_ALLOW_FEISHU_DIRECT=1。',
      )
    }
  }
}

function pruneOAuthStates() {
  const now = Date.now()
  oauthStateStore.forEach((value, key) => {
    if (now - value.createdAt > STATE_EXPIRE_MS) {
      oauthStateStore.delete(key)
    }
  })
}

function createState() {
  return crypto.randomBytes(24).toString('hex')
}

function createLocalToken() {
  return crypto.randomBytes(32).toString('hex')
}

function sha256(text: string) {
  return crypto.createHash('sha256').update(text).digest('hex')
}

function getBearerToken(req: any) {
  const authHeader = String(req.headers.authorization || '')
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim()
  }
  if (authHeader) {
    return authHeader.trim()
  }
  const accessToken = req.headers['x-access-token']
  return typeof accessToken === 'string' ? accessToken.trim() : ''
}

function getSessionExpireDays() {
  const days = Number(process.env.SESSION_EXPIRE_DAYS || 7)
  return Number.isFinite(days) && days > 0 ? days : 7
}

function buildPermissionSnapshot(record?: any) {
  const isVip = !!record?.is_vip
  const dailyAiLimit = Number(record?.daily_ai_limit)
  return {
    is_vip: isVip,
    vip_level: Number(record?.vip_level || 0),
    vip_expire_time: record?.vip_expire_time || null,
    daily_limit_count: Number(record?.daily_limit_count || 10),
    daily_ai_limit: Number.isFinite(dailyAiLimit) && dailyAiLimit > 0 ? dailyAiLimit : 5,
    max_file_size: Number(record?.max_file_size || 52428800),
    allow_batch: !!record?.allow_batch,
    /** 无水印仅会员可用：非 VIP 一律关闭，避免脏数据绕过 */
    allow_no_watermark: isVip && !!record?.allow_no_watermark,
    allow_ai_tools: record?.allow_ai_tools !== undefined ? !!record.allow_ai_tools : true,
    allow_template_manage: record?.allow_template_manage !== undefined ? !!record.allow_template_manage : true,
  }
}

/** 鲲穹统一登录等：{ code: 200, data: {...} } 或 code 0 */
function unwrapEnvelope(raw: any): any {
  if (!raw || typeof raw !== 'object') return raw
  const inner = (raw as any).data
  if (!inner || typeof inner !== 'object') return raw
  const code = (raw as any).code
  const ok =
    code === 0 ||
    code === '0' ||
    code === 200 ||
    code === '200'
  return ok ? inner : raw
}

/**
 * 与 oauth2-api.md 一致：换票响应 data.user 含 id、username、nickname、email、phone、avatar
 */
function normalizeRemoteUser(tokenPayload: any, userPayload: any): NormalizedRemoteUser {
  let raw = userPayload || tokenPayload?.user || tokenPayload || {}
  raw = unwrapEnvelope(raw)
  const source = raw && typeof raw === 'object' ? raw : {}
  const providerUserId = String(
    source.open_id ||
    source.union_id ||
    (source.id !== undefined && source.id !== null ? source.id : '') ||
    source.user_id ||
    source.sub ||
    source.openid ||
    source.uid ||
    source.username ||
    '',
  )
  if (!providerUserId) {
    throw new Error(
      'OAuth 用户信息缺少唯一标识：鲲穹换票接口应在 data 内返回 user.id 或 user.username，请对照 oauth2-api.md',
    )
  }

  return {
    providerUserId,
    displayName: String(
      source.nickname ||
      source.name ||
      source.username ||
      source.preferred_username ||
      source.email ||
      '未命名用户',
    ),
    avatarUrl: String(source.avatar ?? source.avatar_url ?? source.picture ?? ''),
    email: String(source.email || ''),
    rawUser: source,
  }
}

async function fetchRemoteUser(accessToken: string) {
  const config = getOAuthConfig()
  if (!config.userinfoPath) return null
  const userInfoUrl = buildOAuthUrl(config.userinfoBaseUrl, config.userinfoPath)
  const response = await axios.get(userInfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
  const data = response.data
  if (data && typeof data === 'object' && data.data) {
    const c = (data as any).code
    if (c === 0 || c === '0' || c === 200 || c === '200') {
      return data.data
    }
  }
  return data
}

/**
 * POST /api/oauth/token（鲲穹 oauth2-api.md）
 * 成功：{ code: 200, message, data: { access_token, token_type, expires_in, user } }
 */
async function exchangeCodeForToken(code: string, redirectUri: string) {
  const config = getOAuthConfig()
  const tokenUrl = buildOAuthUrl(config.tokenBaseUrl, config.tokenPath)
  const redirect = redirectUri || config.redirectUri

  let response: { data: any }
  try {
    if (config.tokenRequestFormat === 'json') {
      response = await axios.post(
        tokenUrl,
        {
          grant_type: 'authorization_code',
          code,
          client_id: config.clientId,
          client_secret: config.clientSecret,
          redirect_uri: redirect,
        },
        {
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
        },
      )
    } else {
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: redirect,
      })
      response = await axios.post(tokenUrl, body.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      })
    }
  } catch (err) {
    const e = err as { response?: { data?: unknown; status?: number } }
    const d: any = e.response?.data
    if (d && typeof d === 'object') {
      const msg = d.message || d.msg
      if (msg) throw new Error(String(msg))
      if (d.code !== undefined && Number(d.code) !== 200) {
        throw new Error(String(d.message || d.msg || `换取 Token 失败 (${d.code})`))
      }
    }
    const status = e.response?.status
    if (status === 401) {
      throw new Error('OAuth 认证失败，请检查 OAUTH_CLIENT_ID / OAUTH_CLIENT_SECRET')
    }
    throw err instanceof Error ? err : new Error('换取 Token 请求失败')
  }

  const payload = response.data
  if (payload == null || typeof payload !== 'object') {
    throw new Error('Token 接口返回格式异常')
  }

  const hasBizCode = 'code' in payload && (payload as any).code !== undefined && (payload as any).code !== null
  if (hasBizCode && Number((payload as any).code) !== 200) {
    throw new Error(String((payload as any).message || (payload as any).msg || `换取 Token 失败 (${(payload as any).code})`))
  }

  if (payload.data && typeof payload.data === 'object') {
    return payload.data
  }
  if (payload.result && typeof payload.result === 'object') {
    return payload.result
  }
  if ((payload as any).access_token) {
    return payload
  }
  throw new Error(String((payload as any).message || 'Token 接口未返回 data（缺少 access_token）'))
}

async function ensureUserAndIdentity(remoteUser: NormalizedRemoteUser, tokenPayload: any) {
  const db = await getMysqlPool()
  await ensureAccountSchema()

  const [identityRows] = await db.query(
    'SELECT * FROM oauth_identities WHERE provider_name = ? AND provider_user_id = ? LIMIT 1',
    [getOAuthConfig().providerName, remoteUser.providerUserId],
  )
  const identity = Array.isArray(identityRows) ? identityRows[0] : null

  let userId = identity?.user_id
  if (!userId) {
    const [insertResult] = await db.query(
      `INSERT INTO app_users
        (display_name, avatar_url, email, provider_name, provider_user_id, profile_json, last_login_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [
        remoteUser.displayName,
        remoteUser.avatarUrl,
        remoteUser.email,
        getOAuthConfig().providerName,
        remoteUser.providerUserId,
        JSON.stringify(remoteUser.rawUser || {}),
      ],
    )
    userId = insertResult.insertId
  } else {
    await db.query(
      `UPDATE app_users
         SET display_name = ?, avatar_url = ?, email = ?, profile_json = ?, last_login_at = NOW()
       WHERE id = ?`,
      [remoteUser.displayName, remoteUser.avatarUrl, remoteUser.email, JSON.stringify(remoteUser.rawUser || {}), userId],
    )
  }

  const expiresIn = Number(tokenPayload.expires_in || 0)
  const expiresAt = expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000) : null
  await db.query(
    `INSERT INTO oauth_identities
      (user_id, provider_name, provider_user_id, access_token, refresh_token, token_type, expires_at, scope_text, raw_user_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       user_id = VALUES(user_id),
       access_token = VALUES(access_token),
       refresh_token = VALUES(refresh_token),
       token_type = VALUES(token_type),
       expires_at = VALUES(expires_at),
       scope_text = VALUES(scope_text),
       raw_user_json = VALUES(raw_user_json)`,
    [
      userId,
      getOAuthConfig().providerName,
      remoteUser.providerUserId,
      String(tokenPayload.access_token || ''),
      String(tokenPayload.refresh_token || ''),
      String(tokenPayload.token_type || ''),
      expiresAt,
      String(tokenPayload.scope || getOAuthConfig().scope || ''),
      JSON.stringify(remoteUser.rawUser || {}),
    ],
  )

  const [permissionRows] = await db.query(
    'SELECT * FROM account_permission_snapshots WHERE user_id = ? LIMIT 1',
    [userId],
  )
  const permission = Array.isArray(permissionRows) ? permissionRows[0] : null
  if (!permission) {
    await db.query(
      `INSERT INTO account_permission_snapshots
        (user_id, is_vip, vip_level, daily_limit_count, max_file_size, allow_batch, allow_no_watermark, allow_ai_tools, allow_template_manage)
       VALUES (?, 0, 0, 10, 52428800, 0, 0, 1, 1)`,
      [userId],
    )
  }

  return userId
}

async function createSession(req: any, userId: number) {
  const db = await getMysqlPool()
  const localToken = createLocalToken()
  const expiredAt = new Date(Date.now() + getSessionExpireDays() * 24 * 60 * 60 * 1000)
  await db.query(
    `INSERT INTO app_sessions
      (user_id, local_token_hash, session_status, login_ip, user_agent, expired_at, last_seen_at)
     VALUES (?, ?, 'active', ?, ?, ?, NOW())`,
    [
      userId,
      sha256(localToken),
      String(req.ip || ''),
      String(req.headers['user-agent'] || '').slice(0, 255),
      expiredAt,
    ],
  )
  return {
    localToken,
    expiredAt: expiredAt.toISOString(),
  }
}

async function resolveSession(req: any) {
  const token = getBearerToken(req)
  if (!token) {
    throw new Error('未登录')
  }
  const db = await getMysqlPool()
  await ensureAccountSchema()
  const [rows] = await db.query(
    `SELECT s.*, u.display_name, u.avatar_url, u.email, u.provider_name, u.provider_user_id,
            p.is_vip, p.vip_level, p.vip_expire_time, p.daily_limit_count, p.max_file_size,
            p.allow_batch, p.allow_no_watermark, p.allow_ai_tools, p.allow_template_manage
       FROM app_sessions s
       INNER JOIN app_users u ON u.id = s.user_id
       LEFT JOIN account_permission_snapshots p ON p.user_id = s.user_id
      WHERE s.local_token_hash = ? AND s.session_status = 'active'
      LIMIT 1`,
    [sha256(token)],
  )
  const record = Array.isArray(rows) ? rows[0] : null
  if (!record) {
    throw new Error('会话不存在或已失效')
  }
  if (record.expired_at && new Date(record.expired_at).getTime() <= Date.now()) {
    await db.query(
      `UPDATE app_sessions SET session_status = 'expired', updated_at = NOW() WHERE id = ?`,
      [record.id],
    )
    throw new Error('会话已过期')
  }
  await db.query('UPDATE app_sessions SET last_seen_at = NOW() WHERE id = ?', [record.id])
  return {
    token,
    session: record,
    user: {
      id: record.user_id,
      name: record.display_name,
      avatar: record.avatar_url,
      email: record.email,
      provider: record.provider_name,
      provider_user_id: record.provider_user_id,
    },
    permissions: buildPermissionSnapshot(record),
  }
}

/** 供设计接口等非抛错场景解析登录态；失败返回 null */
export async function tryResolveSession(req: any): Promise<{ userId: number } | null> {
  try {
    const sessionData = await resolveSession(req)
    const uid = Number(sessionData.user.id)
    if (!Number.isFinite(uid) || uid <= 0) return null
    return { userId: uid }
  } catch {
    return null
  }
}

async function requireAdmin(req: any) {
  const adminToken = process.env.ADMIN_AUTH_TOKEN || ''
  if (!adminToken) {
    throw new Error('未配置 ADMIN_AUTH_TOKEN')
  }
  const requestToken = String(req.headers['x-admin-token'] || '')
  if (!requestToken || requestToken !== adminToken) {
    throw new Error('管理员鉴权失败')
  }
}

function buildQuickActions(baseUrl: string) {
  return [
    { label: '进入编辑器', path: `${baseUrl}/home?tempid=2` },
    { label: 'AI 生成海报', path: `${baseUrl}/ai-poster` },
    { label: '模板库', path: `${baseUrl}/home?tempid=303` },
  ]
}

export async function getOAuthBootstrap(req: any, res: any) {
  const config = getOAuthConfig()
  send.success(res, {
    provider_name: config.providerName,
    oauth_ready: isOAuthConfigured(),
    mysql_ready: isMysqlConfigured(),
    app_base_url: process.env.APP_BASE_URL || '',
    callback_route: process.env.CALLBACK_ROUTE || '/oauth/callback',
    post_login_redirect: process.env.POST_LOGIN_REDIRECT || '/account',
    token_storage_mode: process.env.TOKEN_STORAGE_MODE || 'localStorage',
    config_missing: {
      oauth: !isOAuthConfigured(),
      mysql: !isMysqlConfigured(),
    },
  })
}

export async function getLoginUrl(req: any, res: any) {
  try {
    if (!isOAuthConfigured()) {
      throw new Error('OAuth2 参数未配置，请补充 OAUTH_BASE_URL / OAUTH_AUTHORIZE_PATH / OAUTH_TOKEN_PATH / OAUTH_CLIENT_ID / OAUTH_CLIENT_SECRET / OAUTH_REDIRECT_URI')
    }
    assertNotFeishuOpenPlatformDirect()
    pruneOAuthStates()
    const config = getOAuthConfig()
    const state = createState()
    // 鲲穹控制台按「固定回调」登记；须与换票时 redirect_uri 一致。优先用 .env 的 OAUTH_REDIRECT_URI，
    // 勿轻信前端用 window.location.origin 传的值（用 IP:端口打开站点会导致与已登记 https 域名不一致 → 400）。
    const configuredRedirect = String(config.redirectUri || '').trim()
    const clientRedirect = String(req.query.redirectUri || '').trim()
    const redirectUri = configuredRedirect || clientRedirect
    if (!redirectUri) {
      throw new Error(
        'OAuth redirect_uri 未配置：请在 .env 设置 OAUTH_REDIRECT_URI（须与鲲穹应用回调完全一致），本地开发也可由前端传入 redirectUri',
      )
    }
    oauthStateStore.set(state, {
      redirectUri,
      createdAt: Date.now(),
    })
    const authorizeUrl = buildOAuthUrl(config.baseUrl, config.authorizePath)
    const url = new URL(authorizeUrl)
    if (!config.omitAuthorizeResponseType) {
      url.searchParams.set('response_type', 'code')
    }
    url.searchParams.set('client_id', config.clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('state', state)
    if (config.scope) {
      url.searchParams.set('scope', config.scope)
    }
    send.success(res, {
      login_url: url.toString(),
      state,
      redirect_uri: redirectUri,
      oauth_provider: config.providerName,
    })
  } catch (error) {
    send.error(res, (error as Error).message || '获取登录地址失败')
  }
}

export async function handleOAuthCallback(req: any, res: any) {
  try {
    if (!isOAuthConfigured()) {
      throw new Error('OAuth2 参数未配置，暂时无法完成登录')
    }
    if (!isMysqlConfigured()) {
      throw new Error('MySQL 参数未配置，暂时无法保存登录会话')
    }
    const code = String(req.body.code || '')
    const state = String(req.body.state || '')
    if (!code || !state) {
      throw new Error('缺少 code 或 state')
    }
    pruneOAuthStates()
    const stateRecord = oauthStateStore.get(state)
    if (!stateRecord) {
      throw new Error('state 校验失败，请重新发起登录')
    }
    oauthStateStore.delete(state)

    const tokenPayload = await exchangeCodeForToken(code, stateRecord.redirectUri)
    const accessToken = String(tokenPayload.access_token || tokenPayload.user_access_token || '')
    if (!accessToken) {
      throw new Error('OAuth token 返回缺少 access_token')
    }
    const remoteUserPayload = await fetchRemoteUser(accessToken)
    const remoteUser = normalizeRemoteUser(tokenPayload, remoteUserPayload)
    const userId = await ensureUserAndIdentity(remoteUser, tokenPayload)
    const sessionInfo = await createSession(req, userId)
    const sessionData = await resolveSession({
      ...req,
      headers: {
        ...req.headers,
        authorization: `Bearer ${sessionInfo.localToken}`,
      },
    } as any)

    const uid = Number(sessionData.user.id)
    const downloadsTodayUsed = Number.isFinite(uid) && uid > 0 ? await getTodayDownloadUsage(uid) : 0
    const aiTodayUsed = Number.isFinite(uid) && uid > 0 ? await getTodayAiUsage(uid) : 0
    send.success(res, {
      local_token: sessionInfo.localToken,
      user_id: sessionData.user.id,
      session_status: 'active',
      expired_at: sessionInfo.expiredAt,
      user: sessionData.user,
      permissions: sessionData.permissions,
      downloads_today_used: downloadsTodayUsed,
      ai_today_used: aiTodayUsed,
    })
  } catch (error) {
    console.error(error)
    send.error(res, (error as Error).message || '登录失败')
  }
}

export async function getCurrentUser(req: any, res: any) {
  try {
    const sessionData = await resolveSession(req)
    const uid = Number(sessionData.user.id)
    const downloadsTodayUsed = Number.isFinite(uid) && uid > 0 ? await getTodayDownloadUsage(uid) : 0
    const aiTodayUsed = Number.isFinite(uid) && uid > 0 ? await getTodayAiUsage(uid) : 0
    send.success(res, {
      local_token: sessionData.token,
      user_id: sessionData.user.id,
      session_status: sessionData.session.session_status,
      expired_at: sessionData.session.expired_at,
      user: sessionData.user,
      permissions: sessionData.permissions,
      downloads_today_used: downloadsTodayUsed,
      ai_today_used: aiTodayUsed,
    })
  } catch (error) {
    send.error(res, (error as Error).message || '获取当前用户失败')
  }
}

export async function getAccountCenter(req: any, res: any) {
  try {
    const sessionData = await resolveSession(req)
    const baseUrl = process.env.FRONTEND_PUBLIC_BASE_URL || process.env.APP_BASE_URL || getBaseUrl(req)
    const uid = Number(sessionData.user.id)
    const downloadsTodayUsed = Number.isFinite(uid) && uid > 0 ? await getTodayDownloadUsage(uid) : 0
    const aiTodayUsed = Number.isFinite(uid) && uid > 0 ? await getTodayAiUsage(uid) : 0
    const dailyLimit = Number(sessionData.permissions.daily_limit_count) || 0
    const aiDailyLimit = Number(sessionData.permissions.daily_ai_limit) || 5
    const downloadsTodayRemaining =
      dailyLimit > 0 ? Math.max(0, dailyLimit - downloadsTodayUsed) : null
    const aiTodayRemaining =
      aiDailyLimit > 0 ? Math.max(0, aiDailyLimit - aiTodayUsed) : null
    const recentRecords =
      Number.isFinite(uid) && uid > 0 ? await getMergedRecentAccountRecords(uid, 5) : []
    send.success(res, {
      account_overview: {
        user: sessionData.user,
        session_status: sessionData.session.session_status,
        expired_at: sessionData.session.expired_at,
      },
      vip_status: {
        is_vip: sessionData.permissions.is_vip,
        vip_level: sessionData.permissions.vip_level,
        vip_expire_time: sessionData.permissions.vip_expire_time,
      },
      quota_card: {
        daily_limit_count: sessionData.permissions.daily_limit_count,
        daily_ai_limit: aiDailyLimit,
        max_file_size: sessionData.permissions.max_file_size,
        downloads_today_used: downloadsTodayUsed,
        downloads_today_remaining: downloadsTodayRemaining,
        ai_today_used: aiTodayUsed,
        ai_today_remaining: aiTodayRemaining,
      },
      feature_permission_card: {
        allow_batch: sessionData.permissions.allow_batch,
        allow_no_watermark: sessionData.permissions.allow_no_watermark,
        allow_ai_tools: sessionData.permissions.allow_ai_tools,
        allow_template_manage: sessionData.permissions.allow_template_manage,
      },
      quick_actions: buildQuickActions(baseUrl),
      recent_records: recentRecords,
    })
  } catch (error) {
    send.error(res, (error as Error).message || '获取账户中心失败')
  }
}

export async function logout(req: any, res: any) {
  try {
    const token = getBearerToken(req)
    if (!token) {
      throw new Error('缺少会话令牌')
    }
    const db = await getMysqlPool()
    await ensureAccountSchema()
    await db.query(
      `UPDATE app_sessions SET session_status = 'revoked', updated_at = NOW() WHERE local_token_hash = ?`,
      [sha256(token)],
    )
    send.success(res, true)
  } catch (error) {
    send.error(res, (error as Error).message || '退出失败')
  }
}

export async function adminListUsers(req: any, res: any) {
  try {
    await requireAdmin(req)
    const db = await getMysqlPool()
    await ensureAccountSchema()
    const [rows] = await db.query(
      `SELECT u.id, u.display_name, u.email, u.provider_name, u.last_login_at,
              p.is_vip, p.vip_level, p.daily_limit_count, p.max_file_size, p.allow_batch, p.allow_no_watermark
         FROM app_users u
         LEFT JOIN account_permission_snapshots p ON p.user_id = u.id
        ORDER BY u.id DESC
        LIMIT 200`,
    )
    send.success(res, { list: rows || [] })
  } catch (error) {
    send.error(res, (error as Error).message || '获取用户列表失败')
  }
}

export async function adminUpdatePermissions(req: any, res: any) {
  try {
    await requireAdmin(req)
    const userId = Number(req.body.user_id || 0)
    if (!userId) {
      throw new Error('缺少 user_id')
    }
    const db = await getMysqlPool()
    await ensureAccountSchema()
    await db.query(
      `INSERT INTO account_permission_snapshots
        (user_id, is_vip, vip_level, vip_expire_time, daily_limit_count, max_file_size, allow_batch, allow_no_watermark, allow_ai_tools, allow_template_manage)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         is_vip = VALUES(is_vip),
         vip_level = VALUES(vip_level),
         vip_expire_time = VALUES(vip_expire_time),
         daily_limit_count = VALUES(daily_limit_count),
         max_file_size = VALUES(max_file_size),
         allow_batch = VALUES(allow_batch),
         allow_no_watermark = VALUES(allow_no_watermark),
         allow_ai_tools = VALUES(allow_ai_tools),
         allow_template_manage = VALUES(allow_template_manage)`,
      [
        userId,
        req.body.is_vip ? 1 : 0,
        Number(req.body.vip_level || 0),
        req.body.vip_expire_time || null,
        Number(req.body.daily_limit_count || 10),
        Number(req.body.max_file_size || 52428800),
        req.body.allow_batch ? 1 : 0,
        req.body.allow_no_watermark ? 1 : 0,
        req.body.allow_ai_tools === false ? 0 : 1,
        req.body.allow_template_manage === false ? 0 : 1,
      ],
    )
    send.success(res, true)
  } catch (error) {
    send.error(res, (error as Error).message || '更新权限失败')
  }
}

export async function adminListSessions(req: any, res: any) {
  try {
    await requireAdmin(req)
    const db = await getMysqlPool()
    await ensureAccountSchema()
    const [rows] = await db.query(
      `SELECT id, user_id, session_status, login_ip, user_agent, expired_at, last_seen_at, created_at
         FROM app_sessions
        ORDER BY id DESC
        LIMIT 200`,
    )
    send.success(res, { list: rows || [] })
  } catch (error) {
    send.error(res, (error as Error).message || '获取会话列表失败')
  }
}

export async function adminRevokeSession(req: any, res: any) {
  try {
    await requireAdmin(req)
    const sessionId = Number(req.body.session_id || 0)
    if (!sessionId) {
      throw new Error('缺少 session_id')
    }
    const db = await getMysqlPool()
    await ensureAccountSchema()
    await db.query(
      `UPDATE app_sessions SET session_status = 'revoked', updated_at = NOW() WHERE id = ?`,
      [sessionId],
    )
    send.success(res, true)
  } catch (error) {
    send.error(res, (error as Error).message || '撤销会话失败')
  }
}

export default {
  getOAuthBootstrap,
  getLoginUrl,
  handleOAuthCallback,
  getCurrentUser,
  getAccountCenter,
  logout,
  adminListUsers,
  adminUpdatePermissions,
  adminListSessions,
  adminRevokeSession,
}
