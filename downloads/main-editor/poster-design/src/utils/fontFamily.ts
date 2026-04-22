const GENERIC_FONT_FAMILIES = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui'])

function normalizeFontName(name: string) {
  return String(name || '').trim().replace(/^['"]|['"]$/g, '')
}

function splitFontFamilies(value: string) {
  return String(value || '')
    .split(',')
    .map((item) => normalizeFontName(item))
    .filter(Boolean)
}

function stringifyFontFamily(name: string) {
  return GENERIC_FONT_FAMILIES.has(name) ? name : `'${name}'`
}

export function buildWidgetFontFamily(...families: Array<string | undefined | null>) {
  const merged: string[] = []
  const fallback = [
    'CodexScreenshotFallback',
    'Source Han Sans SC',
    'Noto Sans SC',
    'Microsoft YaHei',
    'PingFang SC',
    'Hiragino Sans GB',
    'WenQuanYi Micro Hei',
    'sans-serif',
  ]

  for (const family of families) {
    for (const name of splitFontFamilies(String(family || ''))) {
      if (!merged.includes(name)) merged.push(name)
    }
  }
  for (const name of fallback) {
    if (!merged.includes(name)) merged.push(name)
  }
  return merged.map(stringifyFontFamily).join(', ')
}
