import fs from 'fs'
import path from 'path'
import axios from '../utils/http'
import { send, randomCode } from '../utils/tools'
import { ensureUserDesignsSchema, getMysqlPool, isMysqlConfigured } from '../utils/mysql'
import { tryResolveSession } from './account'
import { getTemplateCategories, getTemplateDetail, getTemplateList } from './templateCatalog'
import { getClientStaticBaseUrl, internalApiUrl } from '../utils/clientPublicUrl'
import { mockPath, mockRel } from '../utils/mockRoot'
/** 涓庡唴缃ā鏉?id 鍖哄垎锛涘ぇ浜庣瓑浜庢鍊肩殑 id 浠呰蛋 user_designs */
const USER_DESIGN_ID_MIN = 1000000000

function isUserDesignId(id: unknown): boolean {
  const n = Number(id)
  return Number.isFinite(n) && n >= USER_DESIGN_ID_MIN
}

function formatSqlDateTime(value: Date | string | null | undefined): string {
  if (!value) return ''
  const dt = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(dt.getTime())) return ''
  return dt.toISOString().slice(0, 19).replace('T', ' ')
}

function getAssetVersion(value: Date | string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(Math.round(value)) : ''
  }
  const asDate = new Date(value)
  if (!Number.isNaN(asDate.getTime())) {
    return String(asDate.getTime())
  }
  const trimmed = String(value).trim()
  return trimmed ? encodeURIComponent(trimmed) : ''
}

function appendVersionQuery(url: string, version?: Date | string | number | null) {
  const normalized = getAssetVersion(version)
  if (!normalized) return url
  return `${url}${url.includes('?') ? '&' : '?'}v=${normalized}`
}

function listCoverUrl(id: number | string, width: number, height: number, version?: Date | string | number | null) {
  const cw = Math.max(1, Math.round(Number(width)))
  const ch = Math.max(1, Math.round(Number(height)))
  return appendVersionQuery(`${getClientStaticBaseUrl()}${id}-screenshot-vp-${cw}x${ch}.png`, version)
}

function listPreviewUrl(
  source: 'id' | 'tempid',
  id: number | string,
  width: number,
  height: number,
  version?: Date | string | number | null,
) {
  const cw = Math.max(1, Math.round(Number(width)))
  const ch = Math.max(1, Math.round(Number(height)))
  const query = `${source}=${encodeURIComponent(String(id))}&width=${cw}&height=${ch}&type=file&index=0`
  return appendVersionQuery(internalApiUrl(`api/screenshots?${query}`), version)
}

function isProductionAssetMode() {
  return String(process.env.NODE_ENV || '').toLowerCase() === 'production'
}

function getWorkPreviewCoverUrl(
  id: number | string,
  width: number,
  height: number,
  version?: Date | string | number | null,
) {
  return isProductionAssetMode()
    ? listCoverUrl(id, width, height, version)
    : listPreviewUrl('id', id, width, height, version)
}

function rowToDetailPayload(row: Record<string, any>, cover: string) {
  const dataStr =
    typeof row.data_json === 'string' ? row.data_json : JSON.stringify(row.data_json ?? '')
  return {
    id: Number(row.id),
    title: row.title || '',
    width: Number(row.width) || 0,
    height: Number(row.height) || 0,
    cate: Number(row.cate) || 0,
    category: Number(row.cate) || 0,
    data: dataStr,
    cover,
    created_time: formatSqlDateTime(row.created_at),
    updated_time: formatSqlDateTime(row.updated_at),
    original: '',
    resource: '',
    state: String(row.state ?? 1),
    tag: null,
  }
}

function parseJsonFile(filePath: string) {
  const raw = fs.readFileSync(filePath, 'utf8')
  return JSON.parse(raw.replace(/^\uFEFF/, ''))
}

function readJsonIfExists(filePath: string, fallback: any) {
  try {
    if (fs.existsSync(filePath)) {
      return parseJsonFile(filePath)
    }
  } catch (error) {
    console.log(error)
  }
  return fallback
}

function writeJsonFile(filePath: string, payload: any) {
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2))
}

type TTemplateListCache = {
  stamp: string
  merged: any[]
  queryMap: Map<string, any[]>
}

const templateListCache: TTemplateListCache = {
  stamp: '',
  merged: [],
  queryMap: new Map(),
}

function getFileMtimeStamp(filePath: string) {
  try {
    if (fs.existsSync(filePath)) {
      return String(fs.statSync(filePath).mtimeMs)
    }
  } catch {}
  return '0'
}

function getTemplateSourceStamp() {
  const customListPath = mockPath('templates', 'list.json')
  const templateDir = mockPath('templates')
  return [
    getFileMtimeStamp(customListPath),
    getFileMtimeStamp(templateDir),
  ].join(':')
}

function invalidateTemplateListCache() {
  templateListCache.stamp = ''
  templateListCache.merged = []
  templateListCache.queryMap.clear()
}

function paginateList<T>(list: T[], page: number, pageSize: number) {
  const safePage = Number.isFinite(page) && page > 0 ? page : 1
  const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 10
  const start = (safePage - 1) * safePageSize
  return list.slice(start, start + safePageSize)
}

function mergeUniqueById<T extends { id: number | string }>(baseList: T[], incoming: T[]) {
  const seen: Record<string, boolean> = {}
  const result: T[] = []
  // Locally saved entries should override built-in catalog entries with the same id.
  const all = incoming.concat(baseList)
  for (let i = 0; i < all.length; i++) {
    const item = all[i]
    const key = String(item.id)
    if (seen[key]) continue
    seen[key] = true
    result.push(item)
  }
  return result
}

function getCustomTemplateList() {
  return readJsonIfExists(mockPath('templates', 'list.json'), [])
}

function getSavedTemplatePath(id: number | string) {
  return mockPath('templates', `${id}.json`)
}

const templateStaticDir = () => path.resolve(__dirname, '../../static')

/** 鍖归厤 ${id}-screenshot-vp-WxH.png 鎴栨棫鐗?${id}-screenshot-vp.png */
function findViewportScreenshotBasename(id: number | string): string | null {
  const dir = templateStaticDir()
  const spref = `${String(id)}-screenshot-vp-`
  try {
    for (const name of fs.readdirSync(dir)) {
      if (name.startsWith(spref) && name.endsWith('.png')) return name
    }
  } catch {
    /* ignore */
  }
  const legacy = `${id}-screenshot-vp.png`
  if (fs.existsSync(path.join(dir, legacy))) return legacy
  return null
}

function getTemplateScreenshotPath(id: number | string) {
  const base = findViewportScreenshotBasename(id)
  if (base) return path.join(templateStaticDir(), base)
  return path.resolve(__dirname, `../../static/${id}-screenshot.png`)
}

function getTemplateScreenshotUrl(id: number | string, version?: number | string) {
  const query = version ? `?v=${version}` : ''
  const base = findViewportScreenshotBasename(id)
  const name = base || `${id}-screenshot.png`
  return `${getClientStaticBaseUrl()}${name}${query}`
}

function getTemplatePreviewUrl(id: number | string, savedTemplatePath: string, width: number, height: number) {
  const savedStats = fs.statSync(savedTemplatePath)
  if (width > 0 && height > 0) {
    return internalApiUrl(
      `api/screenshots?tempid=${id}&width=${width}&height=${height}&type=file&index=0&v=${savedStats.mtimeMs}`,
    )
  }

  return ''
}

function extractTemplateHeadline(data: any) {
  if (!data) return ''
  try {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data
    const layers = Array.isArray(parsed) ? parsed?.[0]?.layers || [] : parsed?.widgets || []
    const textLayers = layers
      .filter((layer: any) => String(layer?.type || '').includes('text') && String(layer?.text || '').trim())
      .map((layer: any) => ({
        text: String(layer.text || '').replace(/\s+/g, ' ').trim(),
        fontSize: Number(layer.fontSize || 0),
      }))
      .sort((a: any, b: any) => b.fontSize - a.fontSize)

    const headline = textLayers.find((layer: any) => layer.text.length >= 2)
    return headline?.text || ''
  } catch (error) {
    console.log(error)
    return ''
  }
}

function extractTemplatePrimaryImage(data: any) {
  if (!data) return ''
  try {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data
    const pages = Array.isArray(parsed)
      ? parsed
      : parsed?.page || parsed?.widgets
        ? [{ global: parsed.page, layers: parsed.widgets }]
        : []

    for (const page of pages) {
      const pageBackground = String(page?.global?.backgroundImage || '').trim()
      if (pageBackground) return pageBackground

      const layers = Array.isArray(page?.layers) ? page.layers : []
      for (const layer of layers) {
        const layerImage = String(layer?.imgUrl || '').trim()
        if (layerImage) return layerImage
      }
    }
  } catch (error) {
    console.log(error)
  }
  return ''
}

function isRenderableTemplateData(data: any) {
  if (!data) return false
  try {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data
    if (Array.isArray(parsed)) {
      const firstPage = parsed[0]
      return !!firstPage?.global && Array.isArray(firstPage?.layers)
    }
    return !!parsed?.page && Array.isArray(parsed?.widgets)
  } catch (error) {
    console.log(error)
    return false
  }
}

function normalizeTemplatePayload(data: any) {
  if (data === undefined || data === null) return null
  if (typeof data === 'string') {
    const trimmed = data.trim()
    if (!trimmed) return null
    return JSON.parse(trimmed)
  }
  return data
}

function normalizeComparableText(value: unknown) {
  return typeof value === 'string' ? value : JSON.stringify(value ?? '')
}

function hasPosterPayloadChanged(
  current: {
    title?: unknown
    width?: unknown
    height?: unknown
    cate?: unknown
    dataJson?: unknown
    componentListKey?: unknown
  } | null,
  next: {
    title?: unknown
    width?: unknown
    height?: unknown
    cate?: unknown
    dataJson?: unknown
    componentListKey?: unknown
  },
) {
  if (!current) return true
  return (
    String(current.title || '') !== String(next.title || '') ||
    Number(current.width || 0) !== Number(next.width || 0) ||
    Number(current.height || 0) !== Number(next.height || 0) ||
    Number(current.cate || 0) !== Number(next.cate || 0) ||
    normalizeComparableText(current.dataJson) !== normalizeComparableText(next.dataJson) ||
    String(current.componentListKey || '') !== String(next.componentListKey || '')
  )
}

function buildTemplateTitle(currentTitle: string, headline: string) {
  if (!headline) return currentTitle
  if (currentTitle?.includes(headline)) return currentTitle
  if (currentTitle?.startsWith('绀轰緥妯℃澘 - ')) {
    return `绀轰緥妯℃澘 - ${headline}`
  }
  return headline
}

function getTemplateScreenshotFallback(id: number | string, version?: Date | string | number | null) {
  const base = findViewportScreenshotBasename(id)
  if (base) return appendVersionQuery(`${getClientStaticBaseUrl()}${base}`, version)
  const screenshotPath = path.resolve(__dirname, `../../static/${id}-screenshot.png`)
  if (!fs.existsSync(screenshotPath)) return ''
  return appendVersionQuery(`${getClientStaticBaseUrl()}${id}-screenshot.png`, version)
}

function getMergedTemplateList() {
  const stamp = getTemplateSourceStamp()
  if (templateListCache.stamp === stamp && templateListCache.merged.length) {
    return templateListCache.merged
  }

  const baseList = getTemplateList()
  const customList = getCustomTemplateList()
  /**
   * Built-in catalog metadata should win for duplicated built-in template ids,
   * otherwise old list.json entries can pin the sidebar to stale SVG/default covers.
   * Custom-only ids are still preserved and saved-detail overlays still apply below.
   */
  const merged = enrichTemplateListWithSavedDetails(mergeUniqueById(customList, baseList))
  templateListCache.stamp = stamp
  templateListCache.merged = merged
  templateListCache.queryMap.clear()
  return merged
}

function findMergedTemplateMeta(id: number | string) {
  const mergedList = getMergedTemplateList()
  return mergedList.find((item: any) => String(item.id) === String(id)) || null
}

function enrichTemplateListWithSavedDetails(list: any[]) {
  return list.map((item) => {
    const savedTemplatePath = getSavedTemplatePath(item.id)
    if (!fs.existsSync(savedTemplatePath)) {
      return item
    }

    const savedDetail = readJsonIfExists(savedTemplatePath, null)
    if (!savedDetail) {
      return item
    }
    if (!isRenderableTemplateData(savedDetail.data)) {
      return null
    }

    const width = Number(savedDetail.width || item.width)
    const height = Number(savedDetail.height || item.height)
    const imageFallback = extractTemplatePrimaryImage(savedDetail.data)
    const screenshotUrl = getTemplatePreviewUrl(item.id, savedTemplatePath, width, height) || getTemplateScreenshotFallback(item.id)
    const headline = extractTemplateHeadline(savedDetail.data)
    return {
      ...item,
      title: buildTemplateTitle(savedDetail.title || item.title, headline),
      width,
      height,
      cate: typeof savedDetail.cate === 'number' ? savedDetail.cate : item.cate,
      thumb: screenshotUrl || imageFallback || item.thumb,
      cover: screenshotUrl || imageFallback || item.cover,
      url: imageFallback || item.url,
    }
  }).filter(Boolean)
}

function getMockPosterList() {
  return readJsonIfExists(mockPath('posters', 'list.json'), [])
}

function filterTemplateList(list: any[], query: any) {
  const cate = Number(query.cate || 0)
  const search = String(query.search || '').trim()
  return list.filter((item) => {
    const matchCate = !cate || Number(item.cate || 0) === cate
    const matchSearch = !search || String(item.title || '').includes(search)
    return matchCate && matchSearch
  })
}

function getCachedFilteredTemplateList(query: any) {
  const mergedList = getMergedTemplateList()
  const queryKey = JSON.stringify({
    cate: Number(query?.cate || 0),
    search: String(query?.search || '').trim(),
    page: Number(query?.page || 1),
    pageSize: Number(query?.pageSize || mergedList.length || 20),
  })
  const cached = templateListCache.queryMap.get(queryKey)
  if (cached) return cached

  const filtered = filterTemplateList(mergedList, query || {})
  const page = Number(query?.page || 1)
  const pageSize = Number(query?.pageSize || filtered.length || 20)
  const paged = paginateList(filtered, page, pageSize)
  templateListCache.queryMap.set(queryKey, paged)
  return paged
}

export async function getTemplates(req: any, res: any) {
  const type = Number(req.query.type || 0)
  if (type === 1) {
    const cate = req.query.cate || 'text'
    const listKey = String(cate)
    const tempPath = mockPath('components', 'list', `${cate}.json`)
    let list: any[] = readJsonIfExists(tempPath, [])

    if (isMysqlConfigured()) {
      const session = await tryResolveSession(req)
      if (session) {
        await ensureUserDesignsSchema()
        const db = await getMysqlPool()
        const [rows] = await db.query(
          `SELECT id, title, width, height, cate, state, updated_at FROM user_designs
           WHERE user_id = ? AND design_type = 1 AND component_list_key = ? ORDER BY updated_at DESC`,
          [session.userId, listKey],
        )
        const fromDb = (rows as Record<string, any>[]).map((row) => ({
          id: row.id,
          title: row.title,
          width: row.width,
          height: row.height,
          cate: listKey,
          state: row.state ?? 1,
          cover: listCoverUrl(row.id, row.width, row.height, row.updated_at),
        }))
        list = mergeUniqueById(fromDb, list)
      }
    }

    const page = Number(req.query.page || 1)
    const pageSize = Number(req.query.pageSize || list.length || 20)
    send.success(res, { list: paginateList(list, page, pageSize) })
    return
  }

  send.success(res, { list: getCachedFilteredTemplateList(req.query || {}) })
}

export async function getDetail(req: any, res: any) {
  const type = Number(req.query.type || 0)
  const id = req.query.id
  if (type === 1) {
    if (id != null && id !== '' && isUserDesignId(id) && isMysqlConfigured()) {
      const session = await tryResolveSession(req)
      if (!session) {
        send.error(res, 'template not found')
        return
      }
      await ensureUserDesignsSchema()
      const db = await getMysqlPool()
      const [rows] = await db.query(
        'SELECT * FROM user_designs WHERE id = ? AND user_id = ? AND design_type = 1 LIMIT 1',
        [String(id), session.userId],
      )
      const row = Array.isArray(rows) ? (rows as Record<string, any>[])[0] : null
      if (!row) {
        send.error(res, 'template not found')
        return
      }
      const cover =
        getTemplateScreenshotFallback(row.id, row.updated_at) || listCoverUrl(row.id, row.width, row.height, row.updated_at)
      send.success(res, rowToDetailPayload(row, cover))
      return
    }

    const detailPath = mockPath('components', 'detail', `${id}.json`)
    const detail = readJsonIfExists(detailPath, null)
    if (!detail) {
      send.error(res, 'template not found')
      return
    }
    send.success(res, detail)
    return
  }

  if (id != null && id !== '' && isUserDesignId(id) && isMysqlConfigured()) {
    const session = await tryResolveSession(req)
    if (!session) {
      send.error(res, 'template not found')
      return
    }
    await ensureUserDesignsSchema()
    const db = await getMysqlPool()
    const [rows] = await db.query(
      'SELECT * FROM user_designs WHERE id = ? AND user_id = ? AND design_type = 0 LIMIT 1',
      [String(id), session.userId],
    )
    const row = Array.isArray(rows) ? (rows as Record<string, any>[])[0] : null
    if (!row) {
      send.error(res, 'template not found')
      return
    }
    const cover =
      getTemplateScreenshotFallback(row.id, row.updated_at) || listCoverUrl(row.id, row.width, row.height, row.updated_at)
    send.success(res, rowToDetailPayload(row, cover))
    return
  }

  const catalogDetail = getTemplateDetail(id)
  const savedTemplatePath = mockPath('templates', `${id}.json`)
  if (fs.existsSync(savedTemplatePath)) {
    const savedDetail = parseJsonFile(savedTemplatePath)
    if (isRenderableTemplateData(savedDetail?.data)) {
      const meta = findMergedTemplateMeta(id)
      const withCate =
        meta && typeof meta.cate === 'number' ? { ...savedDetail, cate: meta.cate } : { ...savedDetail }
      send.success(res, withCate)
      return
    }
    if (catalogDetail) {
      const meta = findMergedTemplateMeta(id)
      const payload =
        meta && typeof meta.cate === 'number' ? { ...(catalogDetail as Record<string, unknown>), cate: meta.cate } : catalogDetail
      send.success(res, payload)
      return
    }
    send.error(res, 'template not found')
    return
  }

  if (catalogDetail) {
    const meta = findMergedTemplateMeta(id)
    const payload =
      meta && typeof meta.cate === 'number' ? { ...(catalogDetail as Record<string, unknown>), cate: meta.cate } : catalogDetail
    send.success(res, payload)
    return
  }

  send.error(res, 'template not found')
}

export async function getCategories(req: any, res: any) {
  const type = Number(req.query.type || 1)
  if (type === 1) {
    send.success(res, getTemplateCategories())
    return
  }
  send.success(res, [])
}

export async function getMyDesigns(req: any, res: any) {
  const page = Number(req.query.page || 1)
  const pageSize = Number(req.query.pageSize || 10)

  if (!isMysqlConfigured()) {
    const list = getMockPosterList()
    send.success(res, { list: paginateList(list, page, pageSize) })
    return
  }

  const userId = req.userDesignUserId as number | undefined
  if (!userId) {
    send.error(res, '未登录')
    return
  }

  await ensureUserDesignsSchema()
  const db = await getMysqlPool()
  const safePage = Math.max(1, page)
  const safePageSize = Math.max(1, pageSize)
  const offset = (safePage - 1) * safePageSize

  const [[countRow]]: any = await db.query(
    'SELECT COUNT(*) AS total FROM user_designs WHERE user_id = ? AND design_type = 0',
    [userId],
  )
  const total = Number(countRow?.total) || 0

  const [rows] = await db.query(
    `SELECT id, title, width, height, cate, state, updated_at FROM user_designs
     WHERE user_id = ? AND design_type = 0 ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
    [userId, safePageSize, offset],
  )

  const list = (rows as Record<string, any>[]).map((row) => ({
    id: row.id,
    title: row.title,
    width: row.width,
    height: row.height,
    cate: row.cate,
    state: row.state,
    cover: getWorkPreviewCoverUrl(row.id, row.width, row.height, row.updated_at),
    thumb: getWorkPreviewCoverUrl(row.id, row.width, row.height, row.updated_at),
    isDelect: true,
    fail: false,
    top: 0,
    left: 0,
    url: getWorkPreviewCoverUrl(row.id, row.width, row.height, row.updated_at),
  }))

  send.success(res, { list, total })
}

export async function getWorkDetail(req: any, res: any) {
  const id = req.query.id
  if (id == null || id === '') {
    send.error(res, 'work not found')
    return
  }

  if (isMysqlConfigured()) {
    const session = await tryResolveSession(req)
    if (!session) {
      send.error(res, 'work not found')
      return
    }
    await ensureUserDesignsSchema()
    const db = await getMysqlPool()
    const [rows] = await db.query(
      'SELECT * FROM user_designs WHERE id = ? AND user_id = ? AND design_type = 0 LIMIT 1',
      [String(id), session.userId],
    )
    const row = Array.isArray(rows) ? (rows as Record<string, any>[])[0] : null
    if (!row) {
      send.error(res, 'work not found')
      return
    }
    const cover =
      getTemplateScreenshotFallback(row.id, row.updated_at) || getWorkPreviewCoverUrl(row.id, row.width, row.height, row.updated_at)
    send.success(res, rowToDetailPayload(row, cover))
    return
  }

  const detailPath = mockPath('posters', `${id}.json`)
  const detail = readJsonIfExists(detailPath, null)
  if (!detail) {
    send.error(res, 'work not found')
    return
  }
  send.success(res, {
    ...detail,
    cover: getWorkPreviewCoverUrl(detail.id, detail.width, detail.height, Date.now()),
    thumb: getWorkPreviewCoverUrl(detail.id, detail.width, detail.height, Date.now()),
  })
}

export async function getMaterial(req: any, res: any) {
  const cate = req.query.cate
  const page = Number(req.query.page || 1)
  const pageSize = Number(req.query.pageSize || 20)
  const detail = readJsonIfExists(mockPath('materials', `${cate}.json`), [])
  send.success(res, { list: paginateList(detail, page, pageSize) })
}

export async function getPhotos(req: any, res: any) {
  const cate = req.query.cate
  const page = Number(req.query.page || 1)
  const pageSize = Number(req.query.pageSize || 30)
  const detail = readJsonIfExists(mockPath('materials', 'photos', `${cate}.json`), [])
  send.success(res, { list: paginateList(detail, page, pageSize) })
}

export async function deleteWork(req: any, res: any) {
  const id = String(req.body.id || '')
  if (!id) {
    send.error(res, 'missing work id')
    return
  }

  if (isMysqlConfigured()) {
    const userId = req.userDesignUserId as number | undefined
    if (!userId) {
      res.status(401).json({ code: 401, msg: '未登录' })
      return
    }
    await ensureUserDesignsSchema()
    const db = await getMysqlPool()
    const [result] = await db.query('DELETE FROM user_designs WHERE id = ? AND user_id = ?', [id, userId])
    const affected = (result as { affectedRows?: number })?.affectedRows ?? 0
    if (affected > 0) {
      send.success(res, true)
      return
    }
    send.error(res, 'work not found')
    return
  }

  const listPath = mockPath('posters', 'list.json')
  const list = readJsonIfExists(listPath, [])
  const nextList = list.filter((item: any) => String(item.id) !== id)

  if (nextList.length === list.length) {
    send.error(res, 'work not found')
    return
  }

  writeJsonFile(listPath, nextList)
  send.success(res, true)
}

export async function saveWork(req: any, res: any) {
  let id = req.body.id
  const title = req.body.title
  const data = req.body.data
  const width = Number(req.body.width) || 0
  const height = Number(req.body.height) || 0
  const cate = Number(req.body.cate || 0) || 0

  try {
    const parsedData = normalizeTemplatePayload(data)
    if (!isRenderableTemplateData(parsedData)) {
      send.error(res, 'invalid work data')
      return
    }

    if (isMysqlConfigured()) {
      const userId = req.userDesignUserId as number | undefined
      if (!userId) {
        res.status(401).json({ code: 401, msg: '未登录' })
        return
      }

      await ensureUserDesignsSchema()
      const db = await getMysqlPool()
      const dataJson = typeof data === 'string' ? data : JSON.stringify(data ?? null)
      const nextPayload = {
        title: String(title || ''),
        width,
        height,
        cate,
        dataJson,
      }

      let targetId: string
      let shouldRefreshPreview = true
      if (id) {
        const [ownRows] = await db.query(
          'SELECT id, title, width, height, cate, data_json, updated_at FROM user_designs WHERE id = ? AND user_id = ? AND design_type = 0 LIMIT 1',
          [String(id), userId],
        )
        const ownedList = ownRows as Record<string, any>[]
        if (ownedList?.length) {
          const existing = ownedList[0]
          targetId = String(existing.id)
          shouldRefreshPreview = hasPosterPayloadChanged(
            {
              title: existing.title,
              width: existing.width,
              height: existing.height,
              cate: existing.cate,
              dataJson: existing.data_json,
            },
            nextPayload,
          )
          if (shouldRefreshPreview) {
            await db.query(
              `UPDATE user_designs SET title = ?, width = ?, height = ?, cate = ?, data_json = ?, updated_at = NOW()
               WHERE id = ? AND user_id = ?`,
              [nextPayload.title, width, height, cate, dataJson, targetId, userId],
            )
          }
        } else {
          const [ins] = await db.query(
            `INSERT INTO user_designs (user_id, design_type, title, width, height, cate, state, data_json)
             VALUES (?, 0, ?, ?, ?, ?, 1, ?)`,
            [userId, nextPayload.title, width, height, cate, dataJson],
          )
          targetId = String((ins as { insertId?: number | string }).insertId ?? '')
          shouldRefreshPreview = true
        }
      } else {
        const [ins] = await db.query(
          `INSERT INTO user_designs (user_id, design_type, title, width, height, cate, state, data_json)
           VALUES (?, 0, ?, ?, ?, ?, 1, ?)`,
          [userId, nextPayload.title, width, height, cate, dataJson],
        )
        targetId = String((ins as { insertId?: number | string }).insertId ?? '')
        shouldRefreshPreview = true
      }

      if (!targetId) {
        send.error(res, 'save work failed')
        return
      }

      if (shouldRefreshPreview) {
        const size = width > height ? 640 : 320
        const fetchScreenshotUrl = internalApiUrl(
          `api/screenshots?id=${targetId}&width=${width}&height=${height}&type=file&size=${size}&quality=75&force=1`,
        )
        await axios.get(fetchScreenshotUrl, { responseType: 'arraybuffer' })
      }

      send.success(res, { id: targetId })
      return
    }

    const listPath = mockPath('posters', 'list.json')
    const isAdd = !id
    id = id || randomCode(8)
    const savePath = mockPath('posters', `${id}.json`)
    const jsonData = { id, data, title, width, height, cate }
    const previous = isAdd ? null : readJsonIfExists(savePath, null)
    const shouldRefreshPreview = hasPosterPayloadChanged(
      previous
        ? {
            title: previous.title,
            width: previous.width,
            height: previous.height,
            cate: previous.cate,
            dataJson: previous.data,
          }
        : null,
      {
        title,
        width,
        height,
        cate,
        dataJson: data,
      },
    )
    if (shouldRefreshPreview || !fs.existsSync(savePath)) {
      writeJsonFile(savePath, jsonData)
    }

    if (shouldRefreshPreview) {
      const size = width > height ? 640 : 320
      const fetchScreenshotUrl = internalApiUrl(
        `api/screenshots?id=${id}&width=${width}&height=${height}&type=file&size=${size}&quality=75&force=1`,
      )
      await axios.get(fetchScreenshotUrl, { responseType: 'arraybuffer' })
    }

    const list = readJsonIfExists(listPath, [])
    const currentItemIndex = list.findIndex((item: any) => String(item.id) === String(id))
    const currentItem = currentItemIndex >= 0 ? list[currentItemIndex] : null
    const cover = shouldRefreshPreview ? listCoverUrl(id, width, height, Date.now()) : currentItem?.cover || listCoverUrl(id, width, height)
    if (isAdd) {
      list.unshift({ id, cover, title, width, height, cate, state: 1 })
    } else {
      const nextItem = { id, cover, title, width, height, cate, state: 1 }
      if (currentItemIndex >= 0) {
        list.splice(currentItemIndex, 1, nextItem)
      } else {
        list.unshift(nextItem)
      }
    }
    writeJsonFile(listPath, list)
    send.success(res, { id })
  } catch (error) {
    console.log(error)
    send.error(res, 'save work failed')
  }
}

export async function saveTemplate(req: any, res: any) {
  const type = Number(req.body.type || 0)
  let id = req.body.id
  const title = req.body.title
  const data = req.body.data
  const width = req.body.width
  const height = req.body.height
  const cate = Number(req.body.cate || 0)
  const folder = type === 1 ? 'components/detail' : 'templates'
  const listPath = type === 1 ? 'components/list/comp.json' : 'templates/list.json'

  try {
    if (type !== 1) {
      const parsedData = normalizeTemplatePayload(data)
      if (!isRenderableTemplateData(parsedData)) {
        send.error(res, 'invalid template data')
        return
      }
    }

    if (isMysqlConfigured()) {
      const session = await tryResolveSession(req)
      if (!session) {
        res.status(401).json({ code: 401, msg: '未登录' })
        return
      }

      await ensureUserDesignsSchema()
      const db = await getMysqlPool()
      const userId = session.userId
      const designType = type === 1 ? 1 : 0
      const compListKey =
        designType === 1 ? String(req.body.comp_cate || '').trim() || 'text' : null
      const dataJson = typeof data === 'string' ? data : JSON.stringify(data ?? null)
      const numCate = Number(req.body.cate || 0) || 0
      const nextPayload = {
        title: String(title || ''),
        width: Number(width) || 0,
        height: Number(height) || 0,
        cate: designType === 1 ? numCate : cate,
        dataJson,
        componentListKey: compListKey,
      }

      let targetId: string
      let shouldRefreshPreview = true
      if (id) {
        const [ownRows] = await db.query(
          'SELECT id, title, width, height, cate, data_json, component_list_key FROM user_designs WHERE id = ? AND user_id = ? AND design_type = ? LIMIT 1',
          [String(id), userId, designType],
        )
        const ownedList = ownRows as Record<string, any>[]
        if (ownedList?.length) {
          const existing = ownedList[0]
          targetId = String(existing.id)
          shouldRefreshPreview = hasPosterPayloadChanged(
            {
              title: existing.title,
              width: existing.width,
              height: existing.height,
              cate: existing.cate,
              dataJson: existing.data_json,
              componentListKey: existing.component_list_key,
            },
            nextPayload,
          )
          if (designType === 1) {
            if (shouldRefreshPreview) {
              await db.query(
                `UPDATE user_designs SET title = ?, width = ?, height = ?, cate = ?, data_json = ?, component_list_key = ?, updated_at = NOW()
                 WHERE id = ? AND user_id = ?`,
                [
                  nextPayload.title,
                  nextPayload.width,
                  nextPayload.height,
                  numCate,
                  dataJson,
                  compListKey,
                  targetId,
                  userId,
                ],
              )
            }
          } else {
            if (shouldRefreshPreview) {
              await db.query(
                `UPDATE user_designs SET title = ?, width = ?, height = ?, cate = ?, data_json = ?, updated_at = NOW()
                 WHERE id = ? AND user_id = ?`,
                [
                  nextPayload.title,
                  nextPayload.width,
                  nextPayload.height,
                  cate,
                  dataJson,
                  targetId,
                  userId,
                ],
              )
            }
          }
        } else {
          if (designType === 1) {
            const [ins] = await db.query(
              `INSERT INTO user_designs (user_id, design_type, title, width, height, cate, component_list_key, state, data_json)
               VALUES (?, 1, ?, ?, ?, ?, ?, 1, ?)`,
              [
                userId,
                String(title || ''),
                Number(width) || 0,
                Number(height) || 0,
                numCate,
                compListKey,
                dataJson,
              ],
            )
            targetId = String((ins as { insertId?: number | string }).insertId ?? '')
          } else {
            const [ins] = await db.query(
              `INSERT INTO user_designs (user_id, design_type, title, width, height, cate, state, data_json)
               VALUES (?, 0, ?, ?, ?, ?, 1, ?)`,
              [userId, String(title || ''), Number(width) || 0, Number(height) || 0, cate, dataJson],
            )
            targetId = String((ins as { insertId?: number | string }).insertId ?? '')
          }
          shouldRefreshPreview = true
        }
      } else if (designType === 1) {
        const [ins] = await db.query(
          `INSERT INTO user_designs (user_id, design_type, title, width, height, cate, component_list_key, state, data_json)
           VALUES (?, 1, ?, ?, ?, ?, ?, 1, ?)`,
          [
            userId,
            String(title || ''),
            Number(width) || 0,
            Number(height) || 0,
            numCate,
            compListKey,
            dataJson,
          ],
        )
        targetId = String((ins as { insertId?: number | string }).insertId ?? '')
        shouldRefreshPreview = true
      } else {
        const [ins] = await db.query(
          `INSERT INTO user_designs (user_id, design_type, title, width, height, cate, state, data_json)
           VALUES (?, 0, ?, ?, ?, ?, 1, ?)`,
          [userId, String(title || ''), Number(width) || 0, Number(height) || 0, cate, dataJson],
        )
        targetId = String((ins as { insertId?: number | string }).insertId ?? '')
        shouldRefreshPreview = true
      }

      if (!targetId) {
        send.error(res, 'save template failed')
        return
      }

      if (shouldRefreshPreview) {
        const size = width > height ? 640 : 320
        const fetchScreenshotUrl = internalApiUrl(
          `api/screenshots?tempid=${targetId}&tempType=${type}&width=${width}&height=${height}&type=file&size=${size}&quality=75&force=1`,
        )
        await axios.get(fetchScreenshotUrl, { responseType: 'arraybuffer' })
      }

      invalidateTemplateListCache()
      send.success(res, { id: targetId })
      return
    }

    const isAdd = !id
    id = id || randomCode(8)
    const savePath = mockRel(`${folder}/${id}.json`)
    const jsonData = { id, data, title, width, height, cate }
    const previous = isAdd ? null : readJsonIfExists(savePath, null)
    const shouldRefreshPreview = hasPosterPayloadChanged(
      previous
        ? {
            title: previous.title,
            width: previous.width,
            height: previous.height,
            cate: previous.cate,
            dataJson: previous.data,
            componentListKey: type === 1 ? String(req.body.comp_cate || '').trim() || 'text' : '',
          }
        : null,
      {
        title,
        width,
        height,
        cate,
        dataJson: data,
        componentListKey: type === 1 ? String(req.body.comp_cate || '').trim() || 'text' : '',
      },
    )
    if (shouldRefreshPreview || !fs.existsSync(savePath)) {
      fs.writeFileSync(savePath, JSON.stringify(jsonData))
    }

    if (shouldRefreshPreview) {
      const size = width > height ? 640 : 320
      // Use file/png here to avoid the Windows-native jpg compression path
      // that can crash the local dev service during save.
      const fetchScreenshotUrl = internalApiUrl(
        `api/screenshots?tempid=${id}&tempType=${type}&width=${width}&height=${height}&type=file&size=${size}&quality=75&force=1`,
      )
      await axios.get(fetchScreenshotUrl, { responseType: 'arraybuffer' })
    }

    if (isAdd) {
      const list = readJsonIfExists(mockRel(listPath), [])
      const cw = Math.max(1, Math.round(Number(width)))
      const ch = Math.max(1, Math.round(Number(height)))
      const cover = listCoverUrl(id, cw, ch, Date.now())
      list.unshift({ id, cover, title, width, height, cate, state: 1 })
      writeJsonFile(mockRel(listPath), list)
    }
    invalidateTemplateListCache()
    send.success(res, { id })
  } catch (error) {
    console.log(error)
    send.error(res, 'save template failed')
  }
}

export default {
  getTemplates,
  getDetail,
  getCategories,
  getMyDesigns,
  getWorkDetail,
  saveWork,
  getMaterial,
  getPhotos,
  saveTemplate,
  deleteWork,
}
