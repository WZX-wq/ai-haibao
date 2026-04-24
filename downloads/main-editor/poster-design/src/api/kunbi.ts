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
  kunbi_balance?: number
  kunbi?: number
}

export type KunbiUserHomeResult = {
  kunbi_balance?: number
  kunbi?: number
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
  id: number | string
  order_sn: string
  recharge_money?: number | string
  money?: number | string
  kunbi: number
  pay_type?: number
  payment_method?: number
  payment_method_text?: string
  pay_status?: number
  create_time: string
  pay_time?: string
}

export type KunbiDetailRecordItem = {
  id: number | string
  type?: number
  amount?: number | string
  balance?: number | string
  description?: string
  remark?: string
  kunbi?: number | string
  before_kunbi?: number | string
  after_kunbi?: number | string
  change_type?: string
  create_time: string
}

export type PagedResult<T> = {
  list: T[]
  total: number
  page: number
  limit: number
}

function toNumber(value: unknown, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function normalizeRechargeInfo(payload: any): KunbiRechargeInfo {
  const rechargePackages = Array.isArray(payload?.recharge_packages) ? payload.recharge_packages : []
  return {
    ...payload,
    recharge_packages: rechargePackages.map((item: any) => ({
      ...item,
      packges_id: item?.packges_id ?? item?.packages_id,
      packages_id: item?.packages_id ?? item?.packges_id,
      kunbi: toNumber(item?.kunbi, 0),
      money: item?.money ?? '',
    })),
    kunbi_balance: toNumber(payload?.kunbi_balance ?? payload?.kunbi, 0),
    kunbi: toNumber(payload?.kunbi ?? payload?.kunbi_balance, 0),
  }
}

function normalizeCreateOrderResult(payload: any): CreateRechargeOrderResult {
  return {
    ...payload,
    pay_amount: payload?.pay_amount ?? payload?.money ?? '',
    buy_kunbi_count: toNumber(payload?.buy_kunbi_count ?? payload?.kunbi ?? payload?.buy_kunbi, 0),
  }
}

function normalizeRechargeOrderStatus(payload: any): RechargeOrderStatusResult {
  return {
    ...payload,
    order_sn: String(payload?.order_sn || ''),
    pay_status: toNumber(payload?.pay_status, 0),
  }
}

function normalizeRechargeRecordItem(item: any, index: number): KunbiRechargeRecordItem {
  return {
    ...item,
    id: item?.id ?? item?.order_sn ?? `recharge-${index}`,
    order_sn: String(item?.order_sn || ''),
    recharge_money: item?.recharge_money ?? item?.money ?? '',
    money: item?.money ?? item?.recharge_money ?? '',
    kunbi: toNumber(item?.kunbi, 0),
    pay_type: toNumber(item?.pay_type ?? item?.payment_method, 0),
    payment_method: toNumber(item?.payment_method ?? item?.pay_type, 0),
    payment_method_text: item?.payment_method_text || '',
    pay_status:
      item?.pay_status === undefined || item?.pay_status === null || item?.pay_status === ''
        ? undefined
        : toNumber(item?.pay_status, 0),
    create_time: String(item?.create_time || ''),
    pay_time: item?.pay_time,
  }
}

function normalizeRechargeRecordPage(payload: any): PagedResult<KunbiRechargeRecordItem> {
  const list = Array.isArray(payload?.list) ? payload.list : []
  return {
    ...payload,
    list: list.map(normalizeRechargeRecordItem),
    total: toNumber(payload?.total, list.length),
    page: toNumber(payload?.page, 1),
    limit: toNumber(payload?.limit, list.length || 10),
  }
}

function normalizeDetailRecordItem(item: any, index: number): KunbiDetailRecordItem {
  const amountText = item?.amount ?? item?.kunbi ?? '0'
  const changeType = String(item?.change_type || '').trim()
  const normalizedType =
    item?.type != null
      ? toNumber(item.type, 0)
      : changeType.includes('支') || String(amountText).trim().startsWith('-')
        ? 1
        : 2
  return {
    ...item,
    id: item?.id ?? `${item?.create_time || 'detail'}-${index}`,
    type: normalizedType,
    amount: amountText,
    balance: item?.balance ?? item?.after_kunbi ?? '',
    description: item?.description ?? item?.remark ?? (changeType || '鲲币变动'),
    create_time: String(item?.create_time || ''),
  }
}

function normalizeDetailRecordPage(payload: any): PagedResult<KunbiDetailRecordItem> {
  const list = Array.isArray(payload?.list) ? payload.list : []
  return {
    ...payload,
    list: list.map(normalizeDetailRecordItem),
    total: toNumber(payload?.total, list.length),
    page: toNumber(payload?.page, 1),
    limit: toNumber(payload?.limit, list.length || 30),
  }
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
  return request<KunbiUserHomeResult>('kunbi/user-home').then((payload) => ({
    ...payload,
    kunbi_balance: toNumber((payload as any)?.kunbi_balance ?? (payload as any)?.kunbi, 0),
    kunbi: toNumber((payload as any)?.kunbi ?? (payload as any)?.kunbi_balance, 0),
  }))
}

export function getKunbiRechargeInfo() {
  return request<KunbiRechargeInfo>('kunbi/recharge-info').then(normalizeRechargeInfo)
}

export function createRechargeOrder(params: CreateRechargeOrderParams) {
  return request<CreateRechargeOrderResult>('kunbi/create-order', params).then(normalizeCreateOrderResult)
}

export function checkRechargeOrderStatus(orderSn: string) {
  return request<RechargeOrderStatusResult>('kunbi/order-pay-status', {
    order_sn: orderSn,
  }).then(normalizeRechargeOrderStatus)
}

export function getKunbiRechargeRecord(page = 1, limit = 10) {
  return request<PagedResult<KunbiRechargeRecordItem>>('kunbi/recharge-record', {
    page,
    limit,
  }).then(normalizeRechargeRecordPage)
}

export function getKunbiDetailRecord(page = 1, limit = 30, type = 0) {
  return request<PagedResult<KunbiDetailRecordItem>>('kunbi/detail-record', {
    page,
    limit,
    type,
  }).then(normalizeDetailRecordPage)
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
