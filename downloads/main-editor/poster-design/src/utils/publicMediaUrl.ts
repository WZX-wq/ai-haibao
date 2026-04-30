/**
 * 公网访问时，页面若仍请求 127.0.0.1/localhost 上的资源，会触发浏览器「私网访问」拦截，
 * 且 127.0.0.1 指向的是访问者本机而非服务器。将此类绝对地址改为同源相对路径（由 Nginx 反代 /api、/static）。
 */

export function isPageLoopbackHost(): boolean {
  if (typeof window === 'undefined') return false
  const h = window.location.hostname
  return h === '127.0.0.1' || h === 'localhost' || h === '0.0.0.0'
}

function isLoopbackHostname(hostname: string): boolean {
  return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '0.0.0.0'
}

function isInternalMediaHostname(hostname: string): boolean {
  const value = String(hostname || '').trim().toLowerCase()
  return value === 'poster-local.kunqiongai.com'
}

function getStableMediaPath(url: URL): string {
  return `${url.pathname}${url.search}${url.hash}` || '/'
}

function isLikelyMediaUrl(value: string): boolean {
  const s = String(value || '').trim()
  if (!s) return false
  if (/^url\(/i.test(s)) return true
  if (/^(https?:)?\/\//i.test(s)) return true
  if (/^(?:\.{0,2}\/)?(?:static|api|fonts|uploads|storage|temp)\b/i.test(s)) return true
  return false
}

/** 构建期误写入的 VITE_API_URL / VITE_SCREEN_URL 等：在非本机页面下丢弃 */
export function sanitizeLoopbackApiBase(url: string | undefined): string | undefined {
  if (!url || typeof window === 'undefined') return url
  if (isPageLoopbackHost()) return url
  try {
    const u = new URL(url)
    if (isLoopbackHostname(u.hostname)) return undefined
  } catch {
    return url
  }
  return url
}

/**
 * 将数据里误存的 http://127.0.0.1:7001/... 转为 /...，使浏览器请求当前站点并由 Nginx 转发。
 */
export function normalizeLoopbackMediaUrl(url: string | undefined | null): string {
  let s = String(url || '').trim()
  if (!s || typeof window === 'undefined') return s

  const urlFn = /^url\(\s*(['"]?)(.+?)\1\s*\)$/i.exec(s)
  if (urlFn?.[2]) {
    s = String(urlFn[2]).trim()
  }

  if (!isLikelyMediaUrl(s)) {
    return String(url || '').trim()
  }

  if (/^\/\/(127\.0\.0\.1|localhost|0\.0\.0\.0)\b/i.test(s)) {
    s = `http:${s}`
  }

  try {
    const u = new URL(s, window.location.origin)
    if (isInternalMediaHostname(u.hostname)) {
      const path = getStableMediaPath(u)
      return isPageLoopbackHost() ? `http://127.0.0.1:7001${path}` : path
    }
    if (isLoopbackHostname(u.hostname)) {
      if (isPageLoopbackHost()) return s
      return getStableMediaPath(u)
    }
    if (window.location.protocol === 'https:' && u.protocol === 'http:') {
      u.protocol = 'https:'
      return u.toString()
    }
  } catch {
    /* 非绝对 URL，原样返回 */
  }
  return s
}

/**
 * 深度遍历模板/作品 JSON，将其中所有字符串里的 loopback 媒体地址改为同源路径。
 * 用于服务端返回的数据里仍带 http://127.0.0.1:7001/... 时，避免公网页触发私网访问拦截。
 */
export function deepNormalizeLoopbackMediaUrls<T>(input: T): T {
  if (input === null || input === undefined) return input
  if (typeof input === 'string') {
    return normalizeLoopbackMediaUrl(input) as T
  }
  if (Array.isArray(input)) {
    const arr = input as unknown[]
    for (let i = 0; i < arr.length; i++) {
      arr[i] = deepNormalizeLoopbackMediaUrls(arr[i])
    }
    return input
  }
  if (typeof input === 'object') {
    const o = input as Record<string, unknown>
    for (const k of Object.keys(o)) {
      o[k] = deepNormalizeLoopbackMediaUrls(o[k]) as unknown
    }
    return input
  }
  return input
}
