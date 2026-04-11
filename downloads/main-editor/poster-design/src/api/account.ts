import fetch from '@/utils/axios.ts'

export type AccountBootstrap = {
  provider_name: string
  oauth_ready: boolean
  mysql_ready: boolean
  app_base_url: string
  callback_route: string
  post_login_redirect: string
  token_storage_mode: string
  config_missing: {
    oauth: boolean
    mysql: boolean
  }
}

export type LoginUrlResult = {
  login_url: string
  state: string
  redirect_uri: string
  oauth_provider: string
}

export type AccountPermissions = {
  is_vip: boolean
  vip_level: number
  vip_expire_time: string | null
  daily_limit_count: number
  max_file_size: number
  allow_batch: boolean
  allow_no_watermark: boolean
  allow_ai_tools: boolean
  allow_template_manage: boolean
}

export type AccountUser = {
  id: number
  name: string
  avatar: string
  email: string
  provider: string
  provider_user_id: string
}

export type CurrentSession = {
  local_token: string
  user_id: number
  session_status: string
  expired_at: string
  user: AccountUser
  permissions: AccountPermissions
}

export type AccountCenterResult = {
  account_overview: {
    user: AccountUser
    session_status: string
    expired_at: string
  }
  vip_status: {
    is_vip: boolean
    vip_level: number
    vip_expire_time: string | null
  }
  quota_card: {
    daily_limit_count: number
    max_file_size: number
  }
  feature_permission_card: {
    allow_batch: boolean
    allow_no_watermark: boolean
    allow_ai_tools: boolean
    allow_template_manage: boolean
  }
  quick_actions: Array<{ label: string; path: string }>
  recent_records: any[]
}

export const getBootstrap = () => fetch<AccountBootstrap>('auth/bootstrap', {}, 'get')
export const getLoginUrl = (params: Type.Object = {}) => fetch<LoginUrlResult>('auth/login-url', params, 'get')
export const callbackLogin = (params: Type.Object = {}) => fetch<CurrentSession>('auth/callback', params, 'post')
export const getCurrentUser = () => fetch<CurrentSession>('auth/me', {}, 'get')
export const getAccountCenter = () => fetch<AccountCenterResult>('auth/account-center', {}, 'get')
export const logout = () => fetch<boolean>('auth/logout', {}, 'post')
