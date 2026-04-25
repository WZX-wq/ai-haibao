/**
 * 写入 API 响应、给浏览器请求的 URL 前缀。
 * 默认相对路径 /static/、站点根 /，避免 JSON 里出现 127.0.0.1 导致公网用户 ERR_CONNECTION_REFUSED。
 */

function getFrontendPublicBaseUrl(): string {
  const raw = String(
    process.env.SERVICE_PUBLIC_BASE_URL ||
    process.env.FRONTEND_PUBLIC_BASE_URL ||
    process.env.APP_BASE_URL ||
    '',
  ).trim()
  return raw ? raw.replace(/\/$/, '') : ''
}

export function getClientStaticBaseUrl(): string {
  const raw = String(process.env.SERVICE_STATIC_BASE_URL || '').trim()
  if (raw) return raw.replace(/\/?$/, '/')
  const publicBase = getFrontendPublicBaseUrl()
  if (publicBase) return `${publicBase}/static/`
  if (String(process.env.NODE_ENV || '').toLowerCase() !== 'production') {
    return `${getInternalApiOrigin()}/static/`
  }
  return '/static/'
}

/** 列表 thumb、截图类接口的站点根（同源），默认 / */
export function getClientSiteRootUrl(): string {
  const raw = String(process.env.SERVICE_SCREENSHOT_LIST_BASE || '').trim()
  if (raw) return raw.replace(/\/?$/, '/')
  const publicBase = getFrontendPublicBaseUrl()
  if (publicBase) return `${publicBase}/`
  return '/'
}

/**
 * 本进程内 HTTP 自调用（axios 等），相对路径无效，须用绝对地址。
 * 默认 http://127.0.0.1:${PORT}；Docker/K8s 可设 INTERNAL_API_ORIGIN=http://127.0.0.1:7001
 */
export function getInternalApiOrigin(): string {
  const raw = String(process.env.INTERNAL_API_ORIGIN || '').trim()
  if (raw) return raw.replace(/\/$/, '')
  const port = String(process.env.PORT || '7001')
  return `http://127.0.0.1:${port}`
}

export function internalApiUrl(pathAndQuery: string): string {
  const p = pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`
  return `${getInternalApiOrigin()}${p}`
}
