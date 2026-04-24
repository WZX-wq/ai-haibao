import { LocalStorageKey } from '@/config'
import fetch from '@/utils/axios.ts'

let BASE_URL = ''

export type KunbiApiConfig = {
  baseUrl?: string
  kunbiIcon?: string
}

export type KunbiRechargePackage = {
  packges_id?: number
  packages_id?: number
  kunbi: number
  money: number | string
}

export type KunbiRechargeInfo = {
  recharge_packages: KunbiRechargePackage[]
  kunbi_balance: number
}

export type KunbiUserHomeResult = {
  kunbi_balance?: number
  [key: string]: any
}

export type CreateRechargeOrderParams =
  | {
      packages_id: number
      pay_type: 1 | 2
    }
  | {
      recharge_money: string
      pay_type: 1 | 2
    }

export type CreateRechargeOrderResult = {
  order_sn: string
  pay_url?: string
  pay_data?: Record<string, any> | string
  qrcode_img_url?: string
  pay_amount?: number | string
  buy_kunbi_count?: number
  [key: string]: any
}

export type RechargeOrderStatusResult = {
  order_sn: string
  pay_status: number
  pay_time?: string
}

export type KunbiRechargeRecordItem = {
  id: number
  order_sn: string
  recharge_money: number | string
  kunbi: number
  pay_type: number
  pay_status: number
  create_time: string
  pay_time?: string
}

export type KunbiDetailRecordItem = {
  id: number
  type: number
  amount: number | string
  balance: number | string
  description?: string
  create_time: string
}

export type PagedResult<T> = {
  list: T[]
  total: number
  page: number
  limit: number
}

function isBusinessError(payload: any) {
  return payload && typeof payload === 'object' && typeof payload.code === 'number' && payload.code !== 200
}

function resolveBase(path: string) {
  const cleanPath = path.replace(/^\//, '')
  if (!BASE_URL) return cleanPath
  return `${BASE_URL.replace(/\/$/, '')}/${cleanPath}`
}

export function setBaseUrl(url: string) {
  BASE_URL = String(url || '').trim()
}

export function getBaseUrl() {
  return BASE_URL
}

export function getToken() {
  if (typeof localStorage === 'undefined') return ''
  return (
    localStorage.getItem(LocalStorageKey.tokenKey) ||
    localStorage.getItem('token') ||
    localStorage.getItem('kq_token') ||
    sessionStorage.getItem('token') ||
    sessionStorage.getItem('kq_token') ||
    ''
  )
}

export function setToken(token: string, remember = true) {
  const value = String(token || '').trim()
  if (!value || typeof localStorage === 'undefined') return
  if (remember) {
    localStorage.setItem(LocalStorageKey.tokenKey, value)
    localStorage.setItem('token', value)
    localStorage.setItem('kq_token', value)
  } else {
    sessionStorage.setItem('token', value)
    sessionStorage.setItem('kq_token', value)
  }
}

export function clearToken() {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(LocalStorageKey.tokenKey)
  localStorage.removeItem('token')
  localStorage.removeItem('kq_token')
  sessionStorage.removeItem('token')
  sessionStorage.removeItem('kq_token')
}

async function request<T>(path: string, params: Record<string, string | number> = {}) {
  const token = getToken()
  const payload = await fetch<T | { code?: number; msg?: string }>(
    resolveBase(path),
    params,
    'post',
    { Authorization: token || '' },
  )

  if (isBusinessError(payload)) {
    if ((payload as any).code === 401) {
      throw new Error((payload as any).msg || '登录已过期，请重新登录')
    }
    throw new Error((payload as any).msg || '请求失败')
  }

  return payload as T
}

export function getUserAllInfo() {
  return request<Record<string, any>>('kunbi/user-all-info')
}

export function getUserInfo() {
  return request<Record<string, any>>('kunbi/user-info')
}

export function getUserHome() {
  return request<KunbiUserHomeResult>('kunbi/user-home')
}

export function getKunbiRechargeInfo() {
  return request<KunbiRechargeInfo>('kunbi/recharge-info')
}

export function createRechargeOrder(params: CreateRechargeOrderParams) {
  return request<CreateRechargeOrderResult>('kunbi/create-order', params)
}

export function checkRechargeOrderStatus(orderSn: string) {
  return request<RechargeOrderStatusResult>('kunbi/order-pay-status', {
    order_sn: orderSn,
  })
}

export function getKunbiRechargeRecord(page = 1, limit = 10) {
  return request<PagedResult<KunbiRechargeRecordItem>>('kunbi/recharge-record', {
    page,
    limit,
  })
}

export function getKunbiDetailRecord(page = 1, limit = 30, type = 0) {
  return request<PagedResult<KunbiDetailRecordItem>>('kunbi/detail-record', {
    page,
    limit,
    type,
  })
}

export default {
  setBaseUrl,
  getBaseUrl,
  getToken,
  setToken,
  clearToken,
  getUserAllInfo,
  getUserInfo,
  getUserHome,
  getKunbiRechargeInfo,
  createRechargeOrder,
  checkRechargeOrderStatus,
  getKunbiRechargeRecord,
  getKunbiDetailRecord,
}
