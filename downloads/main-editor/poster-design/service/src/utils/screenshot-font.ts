const SCREENSHOT_FALLBACK_FONT_FAMILY = 'CodexScreenshotFallback'
const SCREENSHOT_FALLBACK_FONT_STACK = [
  SCREENSHOT_FALLBACK_FONT_FAMILY,
  'Source Han Sans SC',
  'Noto Sans SC',
  'Microsoft YaHei',
  'PingFang SC',
  'Hiragino Sans GB',
  'WenQuanYi Micro Hei',
  'sans-serif',
].join(', ')

const SCREENSHOT_FALLBACK_FONT_WOFF2_BASE64 =
  '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'

const FONT_STYLE_TAG_ID = 'codex-screenshot-fallback-font'

export async function ensureScreenshotFonts(page: any) {
  const fontFaceCss = `
    @font-face {
      font-family: "${SCREENSHOT_FALLBACK_FONT_FAMILY}";
      src: url(data:font/woff2;base64,${SCREENSHOT_FALLBACK_FONT_WOFF2_BASE64}) format("woff2");
      font-display: swap;
    }
  `

  await page.addStyleTag({ content: fontFaceCss }).catch(() => undefined)
  type EvaluatePayload = {
    fontStyleTagId: string
    fontFaceCss: string
    fontStack: string
  }
  await page.evaluate(
    async ({ fontStyleTagId, fontFaceCss, fontStack }: EvaluatePayload) => {
      const ensureStyleTag = () => {
        let style = document.getElementById(fontStyleTagId) as HTMLStyleElement | null
        if (!style) {
          style = document.createElement('style')
          style.id = fontStyleTagId
          document.head.appendChild(style)
        }
        style.textContent = fontFaceCss
      }

      const mergeFontFamily = (raw: string | null | undefined) => {
        const merged = String(raw || '')
          .split(',')
          .map((item: string) => item.trim())
          .filter(Boolean)
        for (const family of fontStack.split(',').map((item: string) => item.trim()).filter(Boolean)) {
          if (!merged.includes(family)) merged.push(family)
        }
        return merged.join(', ')
      }

      ensureStyleTag()

      document.querySelectorAll<HTMLElement>('*').forEach((el) => {
        const inlineFontFamily = el.style?.fontFamily
        const hasOwnText = Array.from(el.childNodes).some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())
        if (inlineFontFamily) {
          el.style.fontFamily = mergeFontFamily(inlineFontFamily)
          return
        }
        if (hasOwnText && (el.classList.contains('w-text') || el.classList.contains('edit-text'))) {
          el.style.fontFamily = mergeFontFamily('')
        }
      })

      document.querySelectorAll<SVGTextElement>('text').forEach((node) => {
        node.setAttribute('font-family', mergeFontFamily(node.getAttribute('font-family')))
      })

      try {
        await (document as any).fonts?.load?.(`16px "${SCREENSHOT_FALLBACK_FONT_FAMILY}"`)
        await (document as any).fonts?.ready
      } catch {}

      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    },
    {
      fontStyleTagId: FONT_STYLE_TAG_ID,
      fontFaceCss,
      fontStack: SCREENSHOT_FALLBACK_FONT_STACK,
    },
  )
}
