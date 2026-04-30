/*
 * @Author: ShawnPhang
 * @Date: 2020-07-22 20:13:14
 * @Description: 路由
 * @LastEditors: ShawnPhang <https://m.palxp.cn>
 * @LastEditTime: 2024-08-12 13:40:13
 */
import rExpress from 'express'
import screenshots from '../service/screenshots'
import fileService from '../service/files'
import userService from '../service/user'
import {
  getTemplates,
  getDetail,
  getCategories,
  getMyDesigns,
  getWorkDetail,
  saveWork,
  getMaterial,
  getPhotos,
  deleteWork,
  saveTemplate,
} from '../service/design'
import aiService from '../service/ai'
import accountService, { tryResolveSession } from '../service/account'
import kunbiService from '../service/kunbi'
import kunbiConsumptionService from '../service/kunbiConsumption'
import usageService from '../service/usage'
import { consumeAiQuotaByUserId } from '../service/usage'
import { isMysqlConfigured } from '../utils/mysql'
import api from './api'
const rRouter = rExpress.Router()

/** MySQL 已配置时，AI 海报接口必须登录 */
async function requireAuthForMysqlAiPoster(req: any, res: any, next: any) {
  if (!isMysqlConfigured()) {
    return next()
  }
  const session = await tryResolveSession(req)
  if (!session) {
    res.status(401).json({ code: 401, msg: '请先登录后再使用 AI 海报功能' })
    return
  }
  try {
    await consumeAiQuotaByUserId(session.userId)
  } catch (error) {
    const err: any = error
    if (err?.status && err?.code) {
      res.status(Number(err.status)).json({ code: Number(err.code), msg: String(err.message || 'AI 权限或配额校验失败') })
      return
    }
    throw error
  }
  next()
}

/** MySQL 已配置时，「我的作品」列表与删除必须登录，避免读到共享 mock 文件 */
async function requireUserForMysqlDesigns(req: any, res: any, next: any) {
  if (!isMysqlConfigured()) {
    return next()
  }
  const session = await tryResolveSession(req)
  if (!session) {
    res.status(401).json({ code: 401, msg: '未登录' })
    return
  }
  req.userDesignUserId = session.userId
  next()
}

rRouter.get(api.SCREENGHOT, screenshots.screenshots)
rRouter.get(api.PRINTSCREEN, screenshots.printscreen)
rRouter.post(api.UPLOAD, fileService.upload)
rRouter.get(api.GET_CATEGORIES, getCategories)
rRouter.get(api.USER_IMAGES, userService.getUserImages)
rRouter.post(api.DELETE_USER_IMAGE, userService.deleteUserImage)
rRouter.get(api.ADD_USER_IMAGE, userService.addUserImage)
rRouter.get(api.GET_TEMPLATE_LIST, getTemplates)
rRouter.get(api.GET_TEMPLATE, getDetail)
rRouter.get(api.GET_MY_DESIGNS, requireUserForMysqlDesigns, getMyDesigns)
rRouter.get(api.GET_WORK_DETAIL, getWorkDetail)
rRouter.post(api.SAVE_WORK, requireUserForMysqlDesigns, saveWork)
rRouter.get(api.GET_MATERIAL, getMaterial)
rRouter.get(api.GET_PHOTOS, getPhotos)
rRouter.post(api.DELETE_WORK, requireUserForMysqlDesigns, deleteWork)
rRouter.post(api.UPDATE_TEMPLATE, saveTemplate)
rRouter.get(api.AUTH_BOOTSTRAP, accountService.getOAuthBootstrap)
rRouter.get(api.AUTH_LOGIN_URL, accountService.getLoginUrl)
rRouter.post(api.AUTH_CALLBACK, accountService.handleOAuthCallback)
rRouter.get(api.AUTH_ME, accountService.getCurrentUser)
rRouter.get(api.AUTH_ACCOUNT_CENTER, accountService.getAccountCenter)
rRouter.post(api.AUTH_LOGOUT, accountService.logout)
rRouter.post(api.KUNBI_USER_HOME, kunbiService.getUserHome)
rRouter.post(api.KUNBI_USER_INFO, kunbiService.getUserInfo)
rRouter.post(api.KUNBI_USER_ALL_INFO, kunbiService.getUserAllInfo)
rRouter.post(api.KUNBI_RECHARGE_INFO, kunbiService.getRechargeInfo)
rRouter.post(api.KUNBI_CREATE_ORDER, kunbiService.createRechargeOrder)
rRouter.get(api.KUNBI_ALIPAY_PAGE, kunbiService.getAlipayRelayPage)
rRouter.post(api.KUNBI_ORDER_PAY_STATUS, kunbiService.checkRechargeOrderPayStatus)
rRouter.post(api.KUNBI_RECHARGE_RECORD, kunbiService.getRechargeRecord)
rRouter.post(api.KUNBI_DETAIL_RECORD, kunbiService.getDetailRecord)
rRouter.post(api.KUNBI_CONSUME_AI_TOOL, kunbiConsumptionService.consumeAiToolKunbi)
rRouter.post(api.USAGE_DOWNLOAD_CONSUME, usageService.consumeDownloadQuota)
rRouter.post(api.USAGE_AI_CONSUME, usageService.consumeAiQuota)
rRouter.get(api.ADMIN_USERS, accountService.adminListUsers)
rRouter.post(api.ADMIN_USER_PERMISSIONS, accountService.adminUpdatePermissions)
rRouter.get(api.ADMIN_SESSIONS, accountService.adminListSessions)
rRouter.post(api.ADMIN_REVOKE_SESSION, accountService.adminRevokeSession)
rRouter.post(api.AI_POSTER_GENERATE, requireAuthForMysqlAiPoster, aiService.generatePosterDraft)
rRouter.post(api.AI_POSTER_COPY, requireAuthForMysqlAiPoster, aiService.generateCopy)
rRouter.post(api.AI_POSTER_PALETTE, requireAuthForMysqlAiPoster, aiService.generatePalette)
rRouter.post(api.AI_POSTER_BACKGROUND, requireAuthForMysqlAiPoster, aiService.generateBackgroundImage)
rRouter.post(api.AI_POSTER_REPLACE_IMAGE, requireAuthForMysqlAiPoster, aiService.replacePosterImage)
rRouter.post(api.AI_POSTER_RELAYOUT, requireAuthForMysqlAiPoster, aiService.relayoutPoster)
rRouter.post(api.AI_POSTER_CUTOUT, requireAuthForMysqlAiPoster, aiService.cutoutImage)

export default rRouter
