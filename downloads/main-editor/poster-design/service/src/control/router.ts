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
import designService from '../service/design'
import aiService from '../service/ai'
import accountService from '../service/account'
import api from './api'
const rRouter = rExpress.Router()

rRouter.get(api.SCREENGHOT, screenshots.screenshots)
rRouter.get(api.PRINTSCREEN, screenshots.printscreen)
rRouter.post(api.UPLOAD, fileService.upload)
rRouter.get(api.GET_CATEGORIES, designService.getCategories)
rRouter.get(api.USER_IMAGES, userService.getUserImages)
rRouter.get(api.ADD_USER_IMAGE, userService.addUserImage)
rRouter.get(api.GET_TEMPLATE_LIST, designService.getTemplates)
rRouter.get(api.GET_TEMPLATE, designService.getDetail)
rRouter.get(api.GET_MY_DESIGNS, designService.getMyDesigns)
rRouter.get(api.GET_WORK_DETAIL, designService.getWorkDetail)
rRouter.get(api.GET_MATERIAL, designService.getMaterial)
rRouter.get(api.GET_PHOTOS, designService.getPhotos)
rRouter.post(api.DELETE_WORK, designService.deleteWork)
rRouter.post(api.UPDATE_TEMPLATE, designService.saveTemplate)
rRouter.get(api.AUTH_BOOTSTRAP, accountService.getOAuthBootstrap)
rRouter.get(api.AUTH_LOGIN_URL, accountService.getLoginUrl)
rRouter.post(api.AUTH_CALLBACK, accountService.handleOAuthCallback)
rRouter.get(api.AUTH_ME, accountService.getCurrentUser)
rRouter.get(api.AUTH_ACCOUNT_CENTER, accountService.getAccountCenter)
rRouter.post(api.AUTH_LOGOUT, accountService.logout)
rRouter.get(api.ADMIN_USERS, accountService.adminListUsers)
rRouter.post(api.ADMIN_USER_PERMISSIONS, accountService.adminUpdatePermissions)
rRouter.get(api.ADMIN_SESSIONS, accountService.adminListSessions)
rRouter.post(api.ADMIN_REVOKE_SESSION, accountService.adminRevokeSession)
rRouter.post(api.AI_POSTER_GENERATE, aiService.generatePosterDraft)
rRouter.post(api.AI_POSTER_COPY, aiService.generateCopy)
rRouter.post(api.AI_POSTER_PALETTE, aiService.generatePalette)
rRouter.post(api.AI_POSTER_BACKGROUND, aiService.generateBackgroundImage)
rRouter.post(api.AI_POSTER_REPLACE_IMAGE, aiService.replacePosterImage)
rRouter.post(api.AI_POSTER_RELAYOUT, aiService.relayoutPoster)
rRouter.post(api.AI_POSTER_CUTOUT, aiService.cutoutImage)

export default rRouter
