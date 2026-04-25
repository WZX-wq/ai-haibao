/*
 * @Author: ShawnPhang
 * @Date: 2020-07-22 20:13:14
 * @Description: 服务端截图
 * @LastEditors: ShawnPhang <https://m.palxp.cn>
 * @LastEditTime: 2024-08-17 11:23:58
 */
import { saveScreenshot } from '../utils/download-single'
import uuid from '../utils/uuid'
import { filePath, upperLimit, getDrawLink } from '../configs'
import { queueRun, queueList } from '../utils/node-queue'
import fs from 'fs'
// const path = require('path')

function setScreenshotResponseHeaders(res: any, file: string, type: string) {
  const stat = fs.existsSync(file) ? fs.statSync(file) : null
  res.setHeader('Content-Type', type === 'file' ? 'image/png' : 'image/jpg')
  res.setHeader('Cache-Control', type === 'file'
    ? 'private, max-age=86400, stale-while-revalidate=604800'
    : 'public, max-age=604800, stale-while-revalidate=2592000')
  if (stat) {
    res.setHeader('Last-Modified', stat.mtime.toUTCString())
    res.setHeader('Content-Length', stat.size)
  }
}

/**
 * @api {get} api/screenshots 截图
 * @apiVersion 1.0.0
 * @apiGroup screenShot
 *
 * @apiParam {String|Number} id (可选) 截图id，高优先级
 * @apiParam {String|Number} tempid (可选) 模板id，低优先级，无id时取该值
 * @apiParam {String|Number} tempType (可选) 区分模板和组件类型，临时用
 * @apiParam {String} width (必传)视窗大小
 * @apiParam {String} height (必传)视窗大小
 * @apiParam {String} screenshot_url 可选
 * @apiParam {String} type 可选, file正常截图返回，cover封面生成，默认file
 * @apiParam {String} size 可选, 按比例缩小到宽度
 * @apiParam {String} quality 可选, 质量
 * @apiParam {String|Number} index 可选, 下载哪个画板
 */
export async function screenshots(req: any, res: any) {
  let { id, tempid, tempType, width, height, screenshot_url, type = 'file', size, quality, index = 0, force, r } = req.query
  const useInjectedCapture = !(req.query.prevent === '0' || req.query.prevent === 0 || req.query.prevent === 'false')
  id == 'undefined' && (id = null)
    const url = (screenshot_url || getDrawLink()) + `${id ? '?id=' : '?tempid='}`
  id = id || tempid
  /** type=file 为侧栏/列表视口缩略图：仅截视口并单独缓存，避免 fullPage 整页图被前端当成异常竖条换成默认封面 */
  const isViewportFile = type === 'file'
  const wNum = Math.max(1, Math.round(Number(width)))
  const hNum = Math.max(1, Math.round(Number(height)))
  /** 视口尺寸进文件名，避免从 292×390 改为真实画布尺寸后仍命中旧缓存 */
  const path =
    filePath + `${id}-screenshot${isViewportFile ? `-vp-${wNum}x${hNum}` : ''}.png`
  const thumbPath = type === 'cover' && tempType != 1 ? filePath + `${id}-cover.jpg` : null
  const shouldBypassCache = force === '1' || force === 1 || typeof r !== 'undefined'

  if (id && width && height) {
    // 命中缓存直接返回，避免重复跑 puppeteer；带 r/force 时强制重算。
    if (!shouldBypassCache && type === 'file' && fs.existsSync(path)) {
      setScreenshotResponseHeaders(res, path, type)
      res.sendFile(path)
      return
    }
    if (queueList.length > upperLimit) {
      res.json({ code: 200, msg: '服务器表示顶不住啊，等等再来吧~' })
      return
    }
    const authToken = String(req.query.authToken || '').trim()
    const targetUrl =
      url +
      id +
      `${tempType ? '&tempType=' + tempType : ''}` +
      `&index=${index}` +
      (authToken ? `&authToken=${encodeURIComponent(authToken)}` : '')
    queueRun(saveScreenshot, targetUrl, {
      width,
      height,
      path,
      thumbPath,
      size,
      quality,
      prevent: useInjectedCapture,
      fullPage: !isViewportFile,
    })
      .then(() => {
        if (res.headersSent) return
        const targetPath = type === 'file' ? path : (thumbPath as string)
        setScreenshotResponseHeaders(res, targetPath, type)
        res.sendFile(targetPath)
      })
      .catch(() => {
        if (res.headersSent) return
        res.status(500).json({ code: 500, msg: '图片生成错误' })
      })
  } else {
    res.json({ code: 500, msg: '缺少参数，请检查' })
  }
}

/**
 * @api {get} api/printscreen 全屏网页截图
 * @apiVersion 1.0.0
 * @apiGroup screenShot
 *
 * @apiParam {String} url (必传) 目标网页link
 * @apiParam {String} width (可选) 视窗大小
 * @apiParam {String} height (可选) 视窗大小
 * @apiParam {Boolean} prevent (可选, 默认false) true: 阻止立即截图，使用注入函数接管
 * @apiParam {String} type (可选, 默认file) file: 返回二进制文件，cover: 立即返回地址(path, thumbPath)
 * @apiParam {String} size 可选 (只在type=cover生效, eg:300，等比缩放到300像素宽）传该值时会额外产生小图（封面，格式jpeg）
 * @apiParam {String} quality 可选 (只在有size生效, eg:75)，压缩质量:1-100，质量越小图片占用空间越小
 * @apiParam {Number} wait (可选) 截图前的等待时间，单位 ms
 * @apiParam {String} ua (可选) 模拟设备 eg: 'Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1'
 * @apiParam {String} devices (可选) 套用设备预设，传该值则ua、width、height均会失效。eg: iPhone 6 所有预设：/src/utils/widget/Device.js
 * @apiParam {Number} scale (可选) 针对移动端的设备像素比(DPR) 整型范围 1~4，默认1
 */
export async function printscreen(req: any, res: any) {
  
  let { width = 375, height = 0, url, type = 'file', size, quality, prevent = false, ua, devices, scale, wait } = req.query
  const path = filePath + `screenshot_${new Date().getTime()}_${uuid()}.png`
  const thumbPath = type === 'cover' ? path.replace('.png', '.jpg') : null

  if (url) {
    const sign = `${new Date().getTime()}_${uuid()}`
    req._queueSign = sign
    // console.log(url + id, path, thumbPath);
    if (queueList.length > upperLimit) {
      res.json({ code: 200, msg: '业务繁忙，等等再来吧~' })
      return
    }
    queueRun(saveScreenshot, url, { width, height, path, thumbPath, size, quality, prevent, ua, devices, scale, wait }, sign)
      .then(() => {
        if (res.headersSent) return
        res.json({ code: 200, msg: '截图成功', data: { path, thumbPath } })
      })
      .catch(() => {
        if (res.headersSent) return
        res.status(500).json({ code: 500, msg: '图片生成错误!' })
      })
  } else {
    res.json({ code: 500, msg: '缺少参数，请检查' })
  }
}

export default { printscreen, screenshots }
