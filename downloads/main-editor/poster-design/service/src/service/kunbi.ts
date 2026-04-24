import axios from 'axios'
import { getCurrentSession } from './account'
import { ensureAccountSchema, getMysqlPool } from '../utils/mysql'
import { send } from '../utils/tools'

const DEFAULT_KUNBI_API_BASE_URL = 'https://api-web.kunqiongai.com'

function getKunbiApiBaseUrl() {
  return String(process.env.KUNBI_API_BASE_URL || DEFAULT_KUNBI_API_BASE_URL).replace(/\/$/, '')
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
  return handleProxy(req, res, '/user/create_recharge_order')
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
  checkRechargeOrderPayStatus,
  getRechargeRecord,
  getDetailRecord,
}
