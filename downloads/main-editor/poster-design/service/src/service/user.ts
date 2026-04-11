/*
 * @Author: ShawnPhang
 * @Date: 2024-05-16 18:25:10
 * @Description: 示例代码，仅供参考
 * @LastEditors: ShawnPhang <https://m.palxp.cn>
 * @LastEditTime: 2024-08-12 06:25:23
 */
import { Request, Response } from 'express'
const multiparty = require('multiparty')
const { filePath } = require('../configs.ts')
const { checkCreateFolder, filesReader, send } = require('../utils/tools.ts')

const FileUrl = 'http://127.0.0.1:7001/static/'

export default {
  // design/user/image 获取用户上传列表（虚拟）
  async getUserImages(req: Request, res: Response) {
    /**
     * @api {post} /design/user/image 获取用户上传列表（虚拟）
     * @apiVersion 1.0.0
     * @apiGroup user
     */
    const list = await filesReader('user')
    send.success(res, { list })
  },

  async addUserImage(req: any, res: Response) {
    const { width, height, url } = req.query
    send.success(res, {
      width: Number(width) || 0,
      height: Number(height) || 0,
      url: String(url || ''),
    })
  },
}
