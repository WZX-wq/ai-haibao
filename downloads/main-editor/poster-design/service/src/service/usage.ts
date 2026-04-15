import { tryResolveSession } from './account'
import {
  getMysqlPool,
  insertUserActivityLog,
  isMysqlConfigured,
  ensureUserUsageDailySchema,
} from '../utils/mysql'
import { send } from '../utils/tools'

export class UsageQuotaError extends Error {
  status: number
  code: number
  constructor(status: number, code: number, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function getUsagePermissionSnapshot(userId: number): Promise<{
  allowDownload: boolean
  allowAiTools: boolean
  dailyDownloadLimit: number
  dailyAiLimit: number
  isVip: boolean
}> {
  const db = await getMysqlPool()
  const [rows]: any = await db.query(
    `SELECT allow_download, allow_ai_tools, daily_download_limit, daily_ai_limit, daily_limit_count, is_vip
       FROM account_permission_snapshots
      WHERE user_id = ? LIMIT 1`,
    [userId],
  )
  const row = rows?.[0] || {}
  const isVip = !!row.is_vip
  const legacyDaily = Number(row.daily_limit_count)
  const dailyDownloadLimit = Number.isFinite(Number(row.daily_download_limit))
    ? Number(row.daily_download_limit)
    : (Number.isFinite(legacyDaily) ? legacyDaily : 10)
  const dailyAiLimit = Number.isFinite(Number(row.daily_ai_limit))
    ? Number(row.daily_ai_limit)
    : 5
  // 约定：>0 为每日次数；0 为不限额（VIP 另行处理）
  const finalAiLimit = dailyAiLimit > 0 ? Math.min(dailyAiLimit, 1000) : 0
  return {
    allowDownload: row.allow_download !== undefined ? !!row.allow_download : true,
    allowAiTools: row.allow_ai_tools !== undefined ? !!row.allow_ai_tools : true,
    dailyDownloadLimit: isVip ? -1 : dailyDownloadLimit, // VIP用户返回-1表示无限制
    dailyAiLimit: isVip ? -1 : finalAiLimit, // VIP用户返回-1表示无限制
    isVip,
  }
}

/**
 * MySQL 已配置：校验登录与今日下载配额，通过则当日 download_count +1。
 * 未配置 MySQL：跳过（本地开发）。
 * daily_limit_count <= 0 视为不限次数，仍会计数。
 */
export async function consumeDownloadQuota(req: any, res: any) {
  try {
    if (!isMysqlConfigured()) {
      send.success(res, { skipped: true })
      return
    }
    await ensureUserUsageDailySchema()
    const session = await tryResolveSession(req)
    if (!session) {
      res.status(401).json({ code: 401, msg: '请先登录后再下载作品' })
      return
    }
    const userId = session.userId
    const result = await consumeDownloadQuotaByUserId(userId)
    send.success(res, result)
  } catch (error) {
    if (error instanceof UsageQuotaError) {
      res.status(error.status).json({ code: error.code, msg: error.message })
      return
    }
    send.error(res, (error as Error).message || '记录下载配额失败')
  }
}

/**
 * MySQL 已配置：校验登录、AI 功能权限与今日 AI 配额，通过则当日 ai_count +1。
 * 未配置 MySQL：跳过（本地开发）。
 */
export async function consumeAiQuota(req: any, res: any) {
  try {
    if (!isMysqlConfigured()) {
      send.success(res, { skipped: true })
      return
    }
    await ensureUserUsageDailySchema()
    const session = await tryResolveSession(req)
    if (!session) {
      res.status(401).json({ code: 401, msg: '请先登录后再使用 AI 功能' })
      return
    }
    const userId = session.userId
    const result = await consumeAiQuotaByUserId(userId)
    send.success(res, result)
  } catch (error) {
    if (error instanceof UsageQuotaError) {
      res.status(error.status).json({ code: error.code, msg: error.message })
      return
    }
    send.error(res, (error as Error).message || '记录 AI 配额失败')
  }
}

export async function consumeDownloadQuotaByUserId(userId: number): Promise<{ used: number; limit: number }> {
  const permissions = await getUsagePermissionSnapshot(userId)
  if (!permissions.allowDownload) {
    throw new UsageQuotaError(403, 403, '当前账号无下载权限，请联系管理员开通。')
  }
  const limit = permissions.dailyDownloadLimit
  // VIP用户无限制（limit为-1）
  if (limit < 0) {
    await insertUserActivityLog(userId, 'download', '下载/导出作品（VIP无限制）')
    return { used: 0, limit: -1 }
  }
  const db = await getMysqlPool()
  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    const [rows]: any = await conn.query(
      'SELECT download_count FROM user_usage_daily WHERE user_id = ? AND usage_date = CURDATE() FOR UPDATE',
      [userId],
    )
    const used = rows?.[0] ? Number(rows[0].download_count) : 0
    if (limit > 0 && used >= limit) {
      await conn.rollback()
      throw new UsageQuotaError(429, 429, `今日下载次数已用完（每日 ${limit} 次），请明日再试或联系管理员调整权益。`)
    }
    await conn.query(
      `INSERT INTO user_usage_daily (user_id, usage_date, download_count)
       VALUES (?, CURDATE(), 1)
       ON DUPLICATE KEY UPDATE download_count = download_count + 1`,
      [userId],
    )
    await conn.commit()
    const nextUsed = used + 1
    await insertUserActivityLog(userId, 'download', '下载/导出作品')
    return { used: nextUsed, limit: limit > 0 ? limit : 0 }
  } catch (e) {
    await conn.rollback()
    throw e
  } finally {
    conn.release()
  }
}

export async function consumeAiQuotaByUserId(userId: number): Promise<{ used: number; limit: number }> {
  const permissions = await getUsagePermissionSnapshot(userId)
  if (!permissions.allowAiTools) {
    throw new UsageQuotaError(403, 403, '当前账号无 AI 功能权限，请联系管理员开通。')
  }
  const limit = permissions.dailyAiLimit

  // VIP用户无限制（limit为-1）
  if (limit < 0) {
    await insertUserActivityLog(userId, 'ai', 'AI 功能调用（VIP无限制）')
    return { used: 0, limit: -1 }
  }

  const db = await getMysqlPool()
  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    const [rows]: any = await conn.query(
      'SELECT ai_count FROM user_usage_daily WHERE user_id = ? AND usage_date = CURDATE() FOR UPDATE',
      [userId],
    )
    const used = rows?.[0] ? Number(rows[0].ai_count) : 0
    if (limit > 0 && used >= limit) {
      await conn.rollback()
      throw new UsageQuotaError(429, 429, `今日 AI 次数已用完（每日 ${limit} 次），请明日再试或联系管理员调整权益。`)
    }
    await conn.query(
      `INSERT INTO user_usage_daily (user_id, usage_date, ai_count)
       VALUES (?, CURDATE(), 1)
       ON DUPLICATE KEY UPDATE ai_count = ai_count + 1`,
      [userId],
    )
    await conn.commit()
    const nextUsed = used + 1
    await insertUserActivityLog(userId, 'ai', 'AI 功能调用')
    return { used: nextUsed, limit: limit > 0 ? limit : 0 }
  } catch (e) {
    await conn.rollback()
    throw e
  } finally {
    conn.release()
  }
}

export default {
  consumeDownloadQuota,
  consumeAiQuota,
}
