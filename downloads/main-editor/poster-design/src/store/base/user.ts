/*
 * @Author: Jeremy Yu
 * @Date: 2024-03-17 15:00:00
 * @Description: User鍏ㄥ眬鐘舵€佺鐞?
 * @LastEditors: Jeremy Yu <https://github.com/JeremyYu-cn>
 * @LastEditTime: 2026-04-10 19:20:00
 */

import { Store, defineStore } from 'pinia'
import { LocalStorageKey } from '@/config.ts'

export type TPermissionSnapshot = {
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

export type TAuthUser = {
  id: number | null
  name: string | null
  avatar?: string | null
  email?: string | null
  provider?: string | null
}

type TUserStoreState = {
  online: boolean
  user: TAuthUser
  localToken: string | null
  permissions: TPermissionSnapshot
  manager: string
  tempEditing: boolean
}

type TUserAction = {
  changeOnline: (state: boolean) => void
  changeUser: (userName: string) => void
  setAuthSession: (payload: { token: string; user: TAuthUser; permissions: TPermissionSnapshot }) => void
  clearAuthSession: () => void
  managerEdit: (status: boolean) => void
}

const defaultPermissions: TPermissionSnapshot = {
  is_vip: false,
  vip_level: 0,
  vip_expire_time: null,
  daily_limit_count: 10,
  max_file_size: 52428800,
  allow_batch: false,
  allow_no_watermark: false,
  allow_ai_tools: true,
  allow_template_manage: true,
}

function readJson<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key)
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

const storedToken = localStorage.getItem(LocalStorageKey.tokenKey)
const storedUser = readJson<TAuthUser>(LocalStorageKey.authUserKey, {
  id: null,
  name: localStorage.getItem('username'),
  avatar: '',
  email: '',
  provider: '',
})
const storedPermissions = readJson<TPermissionSnapshot>(LocalStorageKey.authPermissionsKey, defaultPermissions)

const useUserStore = defineStore<'userStore', TUserStoreState, {}, TUserAction>('userStore', {
  state: () => ({
    online: !!(storedToken || storedUser.name),
    user: storedUser,
    localToken: storedToken,
    permissions: storedPermissions,
    manager: '',
    tempEditing: false,
  }),
  actions: {
    changeOnline(status: boolean) {
      this.online = status
    },
    changeUser(name: string) {
      this.user = { ...this.user, name }
      this.online = true
      localStorage.setItem('username', name)
      localStorage.setItem(LocalStorageKey.authUserKey, JSON.stringify(this.user))
    },
    setAuthSession(payload) {
      this.localToken = payload.token
      this.user = payload.user
      this.permissions = payload.permissions
      this.online = true
      localStorage.setItem(LocalStorageKey.tokenKey, payload.token)
      localStorage.setItem(LocalStorageKey.authUserKey, JSON.stringify(payload.user))
      localStorage.setItem(LocalStorageKey.authPermissionsKey, JSON.stringify(payload.permissions))
      if (payload.user.name) {
        localStorage.setItem('username', payload.user.name)
      }
    },
    clearAuthSession() {
      this.localToken = null
      this.online = false
      this.user = { id: null, name: null, avatar: '', email: '', provider: '' }
      this.permissions = { ...defaultPermissions }
      localStorage.removeItem(LocalStorageKey.tokenKey)
      localStorage.removeItem(LocalStorageKey.authUserKey)
      localStorage.removeItem(LocalStorageKey.authPermissionsKey)
      localStorage.removeItem('username')
    },
    managerEdit(status: boolean) {
      this.tempEditing = status
    },
  },
})

export type TUserStore = Store<'userStore', TUserStoreState, {}, TUserAction>

export default useUserStore
