/*
 * @Author: ShawnPhang
 * @Date: 2024-05-16 18:25:10
 * @Description: 文件上传示例接口
 * @LastEditors: ShawnPhang <https://m.palxp.cn>
 * @LastEditTime: 2024-08-12 18:52:18
 */
import path from 'path'
import { Request } from 'express'
import { tryResolveSession } from './account'
import { isMysqlConfigured } from '../utils/mysql'
import { ensureImageThumbnail } from '../utils/imageThumbnail'

const multiparty = require('multiparty')
const { filePath } = require('../configs.ts')
const { checkCreateFolder, randomCode, copyFile, send } = require('../utils/tools.ts')
const { getClientStaticBaseUrl } = require('../utils/clientPublicUrl.ts')

// api/file/upload 上传接口
export async function upload(req: Request, res: any) {
  const form = new multiparty.Form()

  form.parse(req, async function (err: any, fields: any, files: any) {
    if (err) {
      console.error('上传文件出错', err)
      send.error(res, 'upload failed')
      return
    }

    const file = files?.file?.[0]
    if (!file) {
      send.error(res, 'file not found')
      return
    }

    let folder = Array.isArray(fields?.folder) ? fields.folder[0] : (fields?.folder || '')
    if (isMysqlConfigured()) {
      const session = await tryResolveSession(req)
      if (!session) {
        res.status(401).json({ code: 401, msg: '未登录' })
        return
      }
      folder = `user/${session.userId}`
    }

    const headers = file.headers || {}
    const originalFilename = file.originalFilename || ''
    const fileType = (headers['content-type'] || '').split('/')[1] || 'png'
    const suffix = originalFilename.split('.').pop() || fileType
    const nameField = Array.isArray(fields?.name) ? fields.name[0] : fields?.name
    const name = nameField || `${randomCode(12)}.${suffix}`
    const folderPath = `${filePath}${folder ? `${folder}/` : ''}`

    checkCreateFolder(folderPath)

    const targetPath = `${folderPath}${name}`
    copyFile(file.path, targetPath)
      .then(() => {
        const key = `${folder ? `${folder}/` : ''}${name}`
        const staticBaseUrl = getClientStaticBaseUrl()
        const url = `${staticBaseUrl}${key}`
        let thumb = ''
        try {
          const thumbPath = ensureImageThumbnail(targetPath)
          if (thumbPath) {
            thumb = `${staticBaseUrl}${folder ? `${folder}/` : ''}${path.basename(thumbPath)}`
          }
        } catch (error) {
          console.warn('[upload] thumbnail generation failed', error)
        }
        send.success(res, {
          key,
          url,
          thumb: thumb || undefined,
        })
      })
      .catch((copyError: any) => {
        console.log('上传异常', copyError)
        send.error(res, 'upload failed')
      })
  })
}

export default { upload }
