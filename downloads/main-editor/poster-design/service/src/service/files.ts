/*
 * @Author: ShawnPhang
 * @Date: 2024-05-16 18:25:10
 * @Description: 文件上传示例接口
 * @LastEditors: ShawnPhang <https://m.palxp.cn>
 * @LastEditTime: 2024-08-12 18:52:18
 */
import { Request, Response } from 'express'

const multiparty = require('multiparty')
const { filePath } = require('../configs.ts')
const { checkCreateFolder, randomCode, copyFile, send } = require('../utils/tools.ts')

const FileUrl = 'http://127.0.0.1:7001/static/'

// api/file/upload 上传接口
export async function upload(req: Request, res: Response) {
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

    const headers = file.headers || {}
    const originalFilename = file.originalFilename || ''
    const fileType = (headers['content-type'] || '').split('/')[1] || 'png'
    const suffix = originalFilename.split('.').pop() || fileType
    const folder = Array.isArray(fields?.folder) ? fields.folder[0] : (fields?.folder || '')
    const nameField = Array.isArray(fields?.name) ? fields.name[0] : fields?.name
    const name = nameField || `${randomCode(12)}.${suffix}`
    const folderPath = `${filePath}${folder ? `${folder}/` : ''}`

    checkCreateFolder(folderPath)

    const targetPath = `${folderPath}${name}`
    copyFile(file.path, targetPath)
      .then(() => {
        const url = `${FileUrl}${folder ? folder + '/' : ''}${name}`
        send.success(res, {
          key: `${folder}/${name}`,
          url,
        })
      })
      .catch((copyError: any) => {
        console.log('上传异常', copyError)
        send.error(res, 'upload failed')
      })
  })
}

export default { upload }
