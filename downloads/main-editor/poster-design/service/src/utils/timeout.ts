/*
 * @Author: ShawnPhang
 * @Date: 2021-12-24 17:51:15
 * @Description: 超时中间件
 * @LastEditors: ShawnPhang <site: m.palxp.cn>
 * @LastEditTime: 2023-07-05 20:17:00
 */

export default async (req: any, res: any, next: any) => {
  const { queueList } = require('../utils/node-queue.ts')
  const rawPath = String(req.path || req.url || '').split('?')[0]
  /** Puppeteer 截图常超过 30s；原全局超时会在截图未完成时先发 408 JSON，随后 sendFile 导致重复响应 → 上游异常、Nginx 502 */
  const isScreenshot =
    rawPath.includes('/screenshots') || rawPath.includes('/printscreen')
  const time = isScreenshot ? 180000 : 30000
  res.setTimeout(time, () => {
    const statusCode = 408
    const index = queueList.findIndex((x: any) => x.sign === req._queueSign)
    if (index !== -1) {
      queueList.splice(index, 1)
      if (!res.headersSent) {
        res.status(statusCode).json({
          statusCode,
          message: '响应超时，任务已取消，请重试',
        })
      }
    }
  })
  next()
}
