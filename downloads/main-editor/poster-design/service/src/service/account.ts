import { Response } from 'express'
import axios from 'axios'
import crypto from 'crypto'
import { send } from '../utils/tools'
import { ensureAccountSchema, getMysqlPool, isMysqlConfigured } from '../utils/mysql'

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
  return {
    providerName: process.env.OAUTH_PROVIDER_NAME || 'generic-oauth2',
    baseUrl: process.env.OAUTH_BASE_URL || '',
    authorizePath: process.env.OAUTH_AUTHORIZE_PATH || '',
    tokenPath: process.env.OAUTH_TOKEN_PATH || '',
    userinfoPath: process.env.OAUTH_USERINFO_PATH || '',
    clientId: process.env.OAUTH_CLIENT_ID || '',
    clientSecret: process.env.OAUTH_CLIENT_SECRET || '',
    redirectUri: process.env.OAUTH_REDIRECT_URI || '',
    logoutUrl: process.env.OAUTH_LOGOUT_URL || '',
    scope: process.env.OAUTH_SCOPE || '',
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
  return {
    is_vip: !!record?.is_vip,
    vip_level: Number(record?.vip_level || 0),
    vip_expire_time: record?.vip_expire_time || null,
    daily_limit_count: Number(record?.daily_limit_count || 10),
    max_file_size: Number(record?.max_file_size || 52428800),
    allow_batch: !!record?.allow_batch,
    allow_no_watermark: !!record?.allow_no_watermark,
    allow_ai_tools: record?.allow_ai_tools !== undefined ? !!record.allow_ai_tools : true,
    allow_template_manage: record?.allow_template_manage !== undefined ? !!record.allow_template_manage : true,
  }
}

function normalizeRemoteUser(tokenPayload: any, userPayload: any): NormalizedRemoteUser {
  const source = userPayload || tokenPayload?.user || tokenPayload || {}
  const providerUserId = String(
    source.id ||
    source.user_id ||
    source.sub ||
    source.openid ||
    source.uid ||
    '',
  )
  if (!providerUserId) {
    throw new Error('OAuth 用户信息缺少唯一标识，请补充 OAUTH_USERINFO_PATH 或检查返回结构')
  }

  return {
    providerUserId,
    displayName: String(source.name || source.nickname || source.username || source.preferred_username || source.email || '未命名用户'),
    avatarUrl: String(source.avatar || source.avatar_url || source.picture || ''),
    email: String(source.email || ''),
    rawUser: source,
  }
}

async function fetchRemoteUser(accessToken: string) {
  const config = getOAuthConfig()
  if (!config.userinfoPath) return null
  const userInfoUrl = buildOAuthUrl(config.baseUrl, config.userinfoPath)
  const response = await axios.get(userInfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
  return response.data
}

async function exchangeCodeForToken(code: string, redirectUri: string) {
  const config = getOAuthConfig()
  const tokenUrl = buildOAuthUrl(config.baseUrl, config.tokenPath)
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: redirectUri || config.redirectUri,
  })

  const response = await axios.post(tokenUrl, body.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  })
  const payload = response.data || {}
  if (payload?.data && typeof payload.data === 'object') {
    return payload.data
  }
  if (payload?.result && typeof payload.result === 'object') {
    return payload.result
  }
  return payload
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

export async function getOAuthBootstrap(req: any, res: Response) {
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

export async function getLoginUrl(req: any, res: Response) {
  try {
    if (!isOAuthConfigured()) {
      throw new Error('OAuth2 参数未配置，请补充 OAUTH_BASE_URL / OAUTH_AUTHORIZE_PATH / OAUTH_TOKEN_PATH / OAUTH_CLIENT_ID / OAUTH_CLIENT_SECRET / OAUTH_REDIRECT_URI')
    }
    pruneOAuthStates()
    const config = getOAuthConfig()
    const state = createState()
    const redirectUri = String(req.query.redirectUri || config.redirectUri)
    oauthStateStore.set(state, {
      redirectUri,
      createdAt: Date.now(),
    })
    const authorizeUrl = buildOAuthUrl(config.baseUrl, config.authorizePath)
    const url = new URL(authorizeUrl)
    url.searchParams.set('response_type', 'code')
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

export async function handleOAuthCallback(req: any, res: Response) {
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
    const accessToken = String(tokenPayload.access_token || '')
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

    send.success(res, {
      local_token: sessionInfo.localToken,
      user_id: sessionData.user.id,
      session_status: 'active',
      expired_at: sessionInfo.expiredAt,
      user: sessionData.user,
      permissions: sessionData.permissions,
    })
  } catch (error) {
    console.error(error)
    send.error(res, (error as Error).message || '登录失败')
  }
}

export async function getCurrentUser(req: any, res: Response) {
  try {
    const sessionData = await resolveSession(req)
    send.success(res, {
      local_token: sessionData.token,
      user_id: sessionData.user.id,
      session_status: sessionData.session.session_status,
      expired_at: sessionData.session.expired_at,
      user: sessionData.user,
      permissions: sessionData.permissions,
    })
  } catch (error) {
    send.error(res, (error as Error).message || '获取当前用户失败')
  }
}

export async function getAccountCenter(req: any, res: Response) {
  try {
    const sessionData = await resolveSession(req)
    const baseUrl = process.env.FRONTEND_PUBLIC_BASE_URL || process.env.APP_BASE_URL || getBaseUrl(req)
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
        max_file_size: sessionData.permissions.max_file_size,
      },
      feature_permission_card: {
        allow_batch: sessionData.permissions.allow_batch,
        allow_no_watermark: sessionData.permissions.allow_no_watermark,
        allow_ai_tools: sessionData.permissions.allow_ai_tools,
        allow_template_manage: sessionData.permissions.allow_template_manage,
      },
      quick_actions: buildQuickActions(baseUrl),
      recent_records: [],
    })
  } catch (error) {
    send.error(res, (error as Error).message || '获取账户中心失败')
  }
}

export async function logout(req: any, res: Response) {
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

export async function adminListUsers(req: any, res: Response) {
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

export async function adminUpdatePermissions(req: any, res: Response) {
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

export async function adminListSessions(req: any, res: Response) {
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

export async function adminRevokeSession(req: any, res: Response) {
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
