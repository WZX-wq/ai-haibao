/*
 * @Author: ShawnPhang
 * @Date: 2024-05-16 18:25:10
 * @Description: 用户上传图（MySQL 下按 user_id 目录隔离）
 */
import fs from 'fs'
import path from 'path'
import imageSize from 'image-size'
import { Request } from 'express'
import { filePath as StaticPath } from '../configs'
import { send } from '../utils/tools'
import { filesReader } from '../utils/fs'
import { isMysqlConfigured } from '../utils/mysql'
import { tryResolveSession } from './account'
import { getClientStaticBaseUrl } from '../utils/clientPublicUrl'
import { deleteImageThumbnail, findExistingImageThumbnail, isGeneratedImageThumb } from '../utils/imageThumbnail'

function listUserScopedImages(userId: number) {
  const rel = `user/${userId}`
  const fullDir = path.join(StaticPath, rel)
  if (!fs.existsSync(fullDir)) {
    return []
  }
  const names = fs.readdirSync(fullDir)
  const list: any[] = []
  for (const file of names) {
    if (file === '.DS_Store' || file.startsWith('.')) continue
    if (isGeneratedImageThumb(file)) continue
    const abs = path.join(fullDir, file)
    if (!fs.statSync(abs).isFile()) continue
    let width = 0
    let height = 0
    try {
      const dim = imageSize(abs)
      width = dim.width || 0
      height = dim.height || 0
    } catch {
      /* ignore */
    }
    const key = `${rel}/${file}`
    const thumbAbs = findExistingImageThumbnail(abs)
    list.push({
      id: file,
      width,
      height,
      url: `${getClientStaticBaseUrl()}${key}`,
      thumb: thumbAbs ? `${getClientStaticBaseUrl()}${rel}/${path.basename(thumbAbs)}` : undefined,
      user_id: userId,
      created_time: '',
      key,
    })
  }
  return list.reverse()
}

export async function getUserImages(req: Request, res: any) {
  if (isMysqlConfigured()) {
    const session = await tryResolveSession(req)
    if (!session) {
      res.status(401).json({ code: 401, msg: '未登录' })
      return
    }
    const list = listUserScopedImages(session.userId)
    send.success(res, { list })
    return
  }
  const list = await filesReader('user')
  send.success(res, { list })
}

export async function addUserImage(req: any, res: any) {
  const { width, height, url } = req.query
  send.success(res, {
    width: Number(width) || 0,
    height: Number(height) || 0,
    url: String(url || ''),
  })
}

export async function deleteUserImage(req: any, res: any) {
  let relKey = String(req.body.key || '').replace(/\\/g, '/').trim()
  if (relKey.startsWith('static/')) {
    relKey = relKey.slice('static/'.length)
  }
  if (!relKey || relKey.includes('..')) {
    send.error(res, 'invalid key')
    return
  }

  if (isMysqlConfigured()) {
    const session = await tryResolveSession(req)
    if (!session) {
      res.status(401).json({ code: 401, msg: '未登录' })
      return
    }
    const abs = path.resolve(StaticPath, relKey)
    const allowedRoot = path.resolve(StaticPath, 'user', String(session.userId))
    const normalizedAbs = path.normalize(abs)
    const normalizedRoot = path.normalize(allowedRoot + path.sep)
    if (!normalizedAbs.startsWith(normalizedRoot)) {
      send.error(res, 'forbidden')
      return
    }
    if (!fs.existsSync(normalizedAbs) || !fs.statSync(normalizedAbs).isFile()) {
      send.error(res, 'not found')
      return
    }
    deleteImageThumbnail(normalizedAbs)
    fs.unlinkSync(normalizedAbs)
    send.success(res, true)
    return
  }

  const abs = path.resolve(StaticPath, relKey)
  const userRoot = path.normalize(path.resolve(StaticPath, 'user') + path.sep)
  const nAbs = path.normalize(abs)
  if (!nAbs.startsWith(userRoot)) {
    send.error(res, 'forbidden')
    return
  }
  if (!fs.existsSync(nAbs) || !fs.statSync(nAbs).isFile()) {
    send.error(res, 'not found')
    return
  }
  deleteImageThumbnail(nAbs)
  fs.unlinkSync(nAbs)
  send.success(res, true)
}

export default {
  getUserImages,
  addUserImage,
  deleteUserImage,
}
