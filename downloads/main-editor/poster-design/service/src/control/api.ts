/*
 * @Author: ShawnPhang
 * @Date: 2020-07-22 20:13:14
 * @Description: 接口名称
 * @LastEditors: ShawnPhang <https://m.palxp.cn>
 * @LastEditTime: 2024-08-12 13:39:59
 */
let path = '/api'

export default {
  SCREENGHOT: path + '/screenshots',
  PRINTSCREEN: path + '/printscreen',
  // 后端示例
  UPLOAD: path + '/file/upload',
  USER_IMAGES: '/design/user/image',
  DELETE_USER_IMAGE: '/design/user/image/del',
  ADD_USER_IMAGE: '/design/user/add_image',
  GET_TEMPLATE_LIST: '/design/list',
  GET_CATEGORIES: '/design/cate',
  GET_TEMPLATE: '/design/temp',
  GET_MY_DESIGNS: '/design/my',
  GET_WORK_DETAIL: '/design/poster',
  SAVE_WORK: '/design/save',
  DELETE_WORK: '/design/poster/del',
  GET_MATERIAL: '/design/material',
  GET_PHOTOS: '/design/imgs',
  UPDATE_TEMPLATE: '/design/edit',
  AUTH_BOOTSTRAP: '/auth/bootstrap',
  AUTH_LOGIN_URL: '/auth/login-url',
  AUTH_CALLBACK: '/auth/callback',
  AUTH_ME: '/auth/me',
  AUTH_ACCOUNT_CENTER: '/auth/account-center',
  AUTH_LOGOUT: '/auth/logout',
  KUNBI_USER_HOME: '/kunbi/user-home',
  KUNBI_USER_INFO: '/kunbi/user-info',
  KUNBI_USER_ALL_INFO: '/kunbi/user-all-info',
  KUNBI_RECHARGE_INFO: '/kunbi/recharge-info',
  KUNBI_CREATE_ORDER: '/kunbi/create-order',
  KUNBI_ALIPAY_PAGE: '/kunbi/alipay-page',
  KUNBI_ORDER_PAY_STATUS: '/kunbi/order-pay-status',
  KUNBI_RECHARGE_RECORD: '/kunbi/recharge-record',
  KUNBI_DETAIL_RECORD: '/kunbi/detail-record',
  USAGE_DOWNLOAD_CONSUME: '/usage/download/consume',
  USAGE_AI_CONSUME: '/usage/ai/consume',
  ADMIN_USERS: '/admin/users',
  ADMIN_USER_PERMISSIONS: '/admin/user/permissions',
  ADMIN_SESSIONS: '/admin/sessions',
  ADMIN_REVOKE_SESSION: '/admin/session/revoke',
  AI_POSTER_GENERATE: '/ai/poster/generate',
  AI_POSTER_COPY: '/ai/poster/copy',
  AI_POSTER_PALETTE: '/ai/poster/palette',
  AI_POSTER_BACKGROUND: '/ai/poster/background',
  AI_POSTER_REPLACE_IMAGE: '/ai/poster/replace-image',
  AI_POSTER_RELAYOUT: '/ai/poster/relayout',
  AI_POSTER_CUTOUT: '/ai/poster/cutout',
}
