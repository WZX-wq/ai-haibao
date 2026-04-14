import { tryResolveSession } from './account'
import {
  getMysqlPool,
  insertUserActivityLog,
  isMysqlConfigured,
  ensureUserUsageDailySchema,
} from '../utils/mysql'
import { send } from '../utils/tools'

async function getDailyDownloadLimit(userId: number): Promise<number> {
  const db = await getMysqlPool()
  const [rows]: any = await db.query(
    'SELECT daily_limit_count FROM account_permission_snapshots WHERE user_id = ? LIMIT 1',
    [userId],
  )
  const n = rows?.[0] ? Number(rows[0].daily_limit_count) : NaN
  if (!Number.isFinite(n)) return 10
  return n
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
    const limit = await getDailyDownloadLimit(userId)
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
        res.status(403).json({
          code: 403,
          msg: `今日下载次数已用完（每日 ${limit} 次），请明日再试或联系管理员调整权益。`,
        })
        return
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
      send.success(res, { used: nextUsed, limit: limit > 0 ? limit : 0 })
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
  } catch (error) {
    send.error(res, (error as Error).message || '记录下载配额失败')
  }
}

export default {
  consumeDownloadQuota,
}
