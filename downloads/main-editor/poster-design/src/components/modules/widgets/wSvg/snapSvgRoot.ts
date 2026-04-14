/**
 * Snap.parse / Snap.load 返回的 wrapper 根节点常为 DocumentFragment，
 * 必须解析出真正的 <svg> 元素后再调用 removeAttribute / appendChild。
 */
export function resolveSnapRootToSvgElement(frag: Record<string, any>, Snap: any) {
  const n = frag?.node as Node | undefined
  if (n && n.nodeType === 1 && (n as Element).nodeName.toLowerCase() === 'svg') {
    return Snap(n)
  }
  if (typeof frag?.select === 'function') {
    const sel = frag.select('svg')
    if (sel?.node && typeof (sel.node as Element).removeAttribute === 'function') {
      return sel
    }
  }
  const root = n as Element | undefined
  const el = root?.querySelector?.('svg') ?? root?.getElementsByTagName?.('svg')?.[0]
  if (el && typeof el.removeAttribute === 'function') {
    return Snap(el)
  }
  return null
}

/** 远程 SVG 资源走 Snap.load；内联 markup / data URL 走 Snap.parse */
export function shouldUseSnapLoad(svgUrl: string) {
  const u = String(svgUrl || '').trim()
  if (!u || u.startsWith('<')) return false
  if (/^data:image\/svg\+xml/i.test(u)) return false
  return /^https?:\/\//i.test(u) || u.startsWith('/') || u.startsWith('./')
}
