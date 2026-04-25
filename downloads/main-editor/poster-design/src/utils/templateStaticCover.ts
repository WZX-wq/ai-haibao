const assetModules = import.meta.glob('../assets/template-covers/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>

const OFFICIAL_TEMPLATE_IDS = [
  101, 102, 103, 104, 105, 106, 107,
  201, 202, 203, 204, 205, 206, 207, 208,
  301, 302, 303, 304, 305, 306, 307, 308,
  401, 402, 403, 404, 405, 406, 407, 408,
] as const

const templateStaticCoverMap = Object.fromEntries(
  OFFICIAL_TEMPLATE_IDS.map((id) => {
    const assetKey = Object.keys(assetModules).find((key) => key.endsWith(`/template-${id}.webp`))
    return [id, assetKey ? assetModules[assetKey] : '']
  }),
) as Record<number, string>

export function isOfficialTemplateId(id: number | string | undefined | null) {
  const key = Number(id)
  if (!Number.isFinite(key)) return false
  return key in templateStaticCoverMap
}

export function getStaticTemplateCoverUrl(id: number | string | undefined | null) {
  const key = Number(id)
  if (!Number.isFinite(key)) return ''
  return templateStaticCoverMap[key] || ''
}
