import axios from 'axios'
import { getCurrentSession } from './account'
import { ensureAccountSchema, getMysqlPool } from '../utils/mysql'
import { send } from '../utils/tools'

const DEFAULT_KUNBI_API_BASE_URL = 'https://api-web.kunqiongai.com'
const ALIPAY_RELAY_TTL_MS = 30 * 60 * 1000
const alipayRelayStore = new Map<string, { html: string; orderSn: string; createdAt: number }>()

function getKunbiApiBaseUrl() {
  return String(process.env.KUNBI_API_BASE_URL || DEFAULT_KUNBI_API_BASE_URL).replace(/\/$/, '')
}

function cleanupExpiredAlipayRelay() {
  const now = Date.now()
  for (const [key, value] of alipayRelayStore.entries()) {
    if (now - value.createdAt > ALIPAY_RELAY_TTL_MS) {
      alipayRelayStore.delete(key)
    }
  }
}

function createRelayKey(orderSn: string) {
  const random = Math.random().toString(36).slice(2, 10)
  return `${orderSn}-${Date.now().toString(36)}-${random}`
}

function buildLocalPath(pathname: string, params: Record<string, string>) {
  const search = new URLSearchParams(params).toString()
  return search ? `${pathname}?${search}` : pathname
}

function prepareAlipayRelayHtml(rawHtml: string) {
  const html = String(rawHtml || '').trim()
  if (!html) return ''
  if (/<form[\s>]/i.test(html)) {
    return html.replace(/<form\b([^>]*)>/i, (match, attrs) => {
      const withoutTarget = String(attrs || '').replace(/\s+target=(['"]).*?\1/gi, '')
      return `<form${withoutTarget} target="_self">`
    })
  }
  return html
}

function wrapAlipayRelayHtml(html: string) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>正在跳转支付宝</title>
  <style>
    :root { color-scheme: light; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: linear-gradient(180deg, #f7f8fc 0%, #eef2ff 100%);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      color: #1f2937;
    }
    .relay-card {
      width: min(92vw, 420px);
      padding: 28px 24px;
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.96);
      box-shadow: 0 18px 48px rgba(79, 70, 229, 0.14);
      text-align: center;
    }
    .relay-title {
      margin: 0 0 10px;
      font-size: 20px;
      font-weight: 700;
    }
    .relay-desc {
      margin: 0;
      font-size: 14px;
      line-height: 1.7;
      color: #6b7280;
    }
    .relay-loader {
      width: 42px;
      height: 42px;
      margin: 0 auto 18px;
      border-radius: 999px;
      border: 3px solid rgba(99, 102, 241, 0.16);
      border-top-color: #6366f1;
      animation: relay-spin 0.9s linear infinite;
    }
    .relay-action {
      margin-top: 16px;
      font-size: 13px;
      color: #4f46e5;
      cursor: pointer;
      background: none;
      border: 0;
    }
    .relay-form-wrap { display: none; }
    @keyframes relay-spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="relay-card">
    <div class="relay-loader" aria-hidden="true"></div>
    <h1 class="relay-title">正在跳转支付宝</h1>
    <p class="relay-desc">请稍候，系统正在为你拉起支付宝收银台。如果没有自动跳转，可以点击下方按钮继续。</p>
    <button type="button" class="relay-action" onclick="submitRelayForm()">继续前往支付宝</button>
  </div>
  <div class="relay-form-wrap" id="relay-form-wrap">
    ${html}
  </div>
  <script>
    function submitRelayForm() {
      var root = document.getElementById('relay-form-wrap');
      var form = root ? root.querySelector('form') : null;
      if (!form) return;
      form.setAttribute('target', '_self');
      form.submit();
    }
    window.addEventListener('load', function () {
      window.setTimeout(submitRelayForm, 60);
    });
  </script>
</body>
</html>`
}

function getRemoteSuccessData(payload: any) {
  if (payload == null || typeof payload !== 'object') return payload
  const code = (payload as any).code
  const successCodes = [0, 1, 200, '0', '1', '200']
  if (!successCodes.includes(code)) return null
  if ('data' in payload) return (payload as any).data
  if ('result' in payload) return (payload as any).result
  return payload
}

async function getRemoteAccessToken(req: any) {
  const sessionData = await getCurrentSession(req)
  const userId = Number(sessionData.user.id || 0)
  if (!Number.isFinite(userId) || userId <= 0) {
    throw new Error('未找到当前登录用户')
  }

  await ensureAccountSchema()
  const db = await getMysqlPool()
  const [rows] = await db.query(
    `SELECT access_token, api_web_token
       FROM oauth_identities
      WHERE user_id = ? AND provider_name = ?
      ORDER BY id DESC
      LIMIT 1`,
    [userId, sessionData.user.provider],
  )
  const record = Array.isArray(rows) ? rows[0] : null
  const accessToken = String(record?.access_token || '').trim()
  const apiWebToken = String(record?.api_web_token || '').trim()
  if (!accessToken) {
    throw new Error('未找到鲲穹授权令牌，请重新登录后再试')
  }
  if (!apiWebToken) {
    throw new Error('当前登录会话缺少站点业务 token。localhost 无法自动拿到该 token，请改用 *.kunqiongai.com 域名登录或手动同步业务 token')
  }
  return {
    accessToken,
    apiWebToken,
  }
}

async function postKunbiApi(req: any, remotePath: string, params: Record<string, any> = {}) {
  const { accessToken, apiWebToken } = await getRemoteAccessToken(req)
  const body = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    body.append(key, String(value))
  })

  const response = await axios.post(`${getKunbiApiBaseUrl()}${remotePath}`, body.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      token: apiWebToken,
      Authorization: `Bearer ${accessToken}`,
    },
    timeout: 30000,
  })

  const successData = getRemoteSuccessData(response.data)
  if (successData !== null) {
    return successData
  }

  const msg = String(response.data?.msg || response.data?.message || '鲲币接口请求失败')
  throw new Error(msg)
}

function maybeBuildAlipayRelayResult(result: any) {
  const data = result && typeof result === 'object' ? { ...result } : result
  const html =
    typeof data?.alipaysubmit_html === 'string'
      ? data.alipaysubmit_html
      : typeof data?.pay_data?.alipaysubmit_html === 'string'
        ? data.pay_data.alipaysubmit_html
        : ''

  const preparedHtml = prepareAlipayRelayHtml(html)
  const orderSn = String(data?.order_sn || '').trim()
  if (!preparedHtml || !orderSn) {
    return result
  }

  cleanupExpiredAlipayRelay()
  const relayKey = createRelayKey(orderSn)
  alipayRelayStore.set(relayKey, {
    html: preparedHtml,
    orderSn,
    createdAt: Date.now(),
  })

  const relayPath = buildLocalPath('/kunbi/alipay-page', { key: relayKey })
  const nextPayData =
    data?.pay_data && typeof data.pay_data === 'object'
      ? { ...data.pay_data }
      : data?.pay_data

  if (nextPayData && typeof nextPayData === 'object' && 'alipaysubmit_html' in nextPayData) {
    delete nextPayData.alipaysubmit_html
  }

  delete data.alipaysubmit_html
  data.pay_url = relayPath
  if (nextPayData && typeof nextPayData === 'object') {
    data.pay_data = nextPayData
  }
  return data
}

async function handleProxy(req: any, res: any, remotePath: string, paramsBuilder?: (req: any) => Record<string, any>) {
  try {
    const params = paramsBuilder ? paramsBuilder(req) : req.body || {}
    const result = await postKunbiApi(req, remotePath, params)
    send.success(res, result)
  } catch (error) {
    const err: any = error
    const status = Number(err?.response?.status || 0)
    const remoteData = err?.response?.data
    if (status === 401 || Number(remoteData?.code) === 401) {
      const localMsg = String(err?.message || '')
      if (localMsg.includes('缺少站点业务 token')) {
        send.error(res, localMsg)
        return
      }
      send.error(res, '鲲币接口鉴权失败，请退出后重新登录一次再充值')
      return
    }
    const msg = String(remoteData?.msg || remoteData?.message || err?.message || '鲲币接口请求失败')
    send.error(res, msg)
  }
}

export async function getRechargeInfo(req: any, res: any) {
  return handleProxy(req, res, '/user/get_kunbi_recharge_info')
}

export async function getUserHome(req: any, res: any) {
  return handleProxy(req, res, '/user/user_home')
}

export async function getUserInfo(req: any, res: any) {
  return handleProxy(req, res, '/user/user_info')
}

export async function getUserAllInfo(req: any, res: any) {
  return handleProxy(req, res, '/user/user_all_info')
}

export async function createRechargeOrder(req: any, res: any) {
  try {
    const result = await postKunbiApi(req, '/user/create_recharge_order', req.body || {})
    send.success(res, maybeBuildAlipayRelayResult(result))
  } catch (error) {
    const err: any = error
    const status = Number(err?.response?.status || 0)
    const remoteData = err?.response?.data
    if (status === 401 || Number(remoteData?.code) === 401) {
      const localMsg = String(err?.message || '')
      if (localMsg.includes('缺少站点业务 token')) {
        send.error(res, localMsg)
        return
      }
      send.error(res, '鲲币接口鉴权失败，请退出后重新登录一次再充值')
      return
    }
    const msg = String(remoteData?.msg || remoteData?.message || err?.message || '鲲币接口请求失败')
    send.error(res, msg)
  }
}

export async function getAlipayRelayPage(req: any, res: any) {
  cleanupExpiredAlipayRelay()
  const key = String(req.query?.key || '').trim()
  const relay = key ? alipayRelayStore.get(key) : null
  if (!relay) {
    res.status(404)
    res.type('html')
    res.send(`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>支付页面已失效</title></head><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;padding:32px;background:#f8fafc;color:#111827;"><h1 style="font-size:20px;margin:0 0 12px;">支付页面已失效</h1><p style="margin:0;color:#6b7280;line-height:1.8;">该支付宝支付链接已过期，请返回充值中心重新创建订单。</p></body></html>`)
    return
  }
  res.type('html')
  res.setHeader('Cache-Control', 'no-store')
  res.send(wrapAlipayRelayHtml(relay.html))
}

export async function checkRechargeOrderPayStatus(req: any, res: any) {
  return handleProxy(req, res, '/user/check_recharge_order_paystatus', (request) => ({
    order_sn: request.body?.order_sn,
  }))
}

export async function getRechargeRecord(req: any, res: any) {
  return handleProxy(req, res, '/user/get_kunbi_recharge_record', (request) => ({
    page: request.body?.page,
    limit: request.body?.limit,
  }))
}

export async function getDetailRecord(req: any, res: any) {
  return handleProxy(req, res, '/user/get_kunbi_detail_record', (request) => ({
    page: request.body?.page,
    limit: request.body?.limit,
    type: request.body?.type,
  }))
}

export default {
  getUserHome,
  getUserInfo,
  getUserAllInfo,
  getRechargeInfo,
  createRechargeOrder,
  getAlipayRelayPage,
  checkRechargeOrderPayStatus,
  getRechargeRecord,
  getDetailRecord,
}
