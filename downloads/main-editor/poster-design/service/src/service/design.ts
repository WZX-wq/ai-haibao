import fs from 'fs'
import path from 'path'
import axios from '../utils/http'
import { send, randomCode } from '../utils/tools'
import { ensureUserDesignsSchema, getMysqlPool, isMysqlConfigured } from '../utils/mysql'
import { tryResolveSession } from './account'
import { getTemplateCategories, getTemplateDetail, getTemplateList } from './templateCatalog'
import { getClientStaticBaseUrl, internalApiUrl } from '../utils/clientPublicUrl'
import { mockPath, mockRel } from '../utils/mockRoot'
/** 与内置模板 id 区分；大于等于此值的 id 仅走 user_designs */
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

function listCoverUrl(id: number | string, width: number, height: number) {
  const cw = Math.max(1, Math.round(Number(width)))
  const ch = Math.max(1, Math.round(Number(height)))
  return `${getClientStaticBaseUrl()}${id}-screenshot-vp-${cw}x${ch}.png`
}

function listWorkPreviewUrl(id: number | string, width: number, height: number, version?: Date | string | number | null) {
  const cw = Math.max(1, Math.round(Number(width)))
  const ch = Math.max(1, Math.round(Number(height)))
  const q = new URLSearchParams({
    id: String(id),
    width: String(cw),
    height: String(ch),
    type: 'file',
    index: '0',
  })
  if (version !== undefined && version !== null && version !== '') {
    const dt = typeof version === 'number' ? version : new Date(version).getTime()
    if (Number.isFinite(Number(dt)) && Number(dt) > 0) {
      q.set('v', String(Math.round(Number(dt))))
    }
  }
  return internalApiUrl(`api/screenshots?${q.toString()}`)
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

async function saveWorkToMysql(req: any, res: any) {
  const session = await tryResolveSession(req)
  if (!session) {
    res.status(401).json({ code: 401, msg: '未登录' })
    return
  }

  await ensureUserDesignsSchema()
  const db = await getMysqlPool()
  const userId = session.userId
  let id = String(req.body.id || '').trim()
  const title = String(req.body.title || '')
  const dataJson = typeof req.body.data === 'string' ? req.body.data : JSON.stringify(req.body.data ?? null)
  const width = Number(req.body.width) || 0
  const height = Number(req.body.height) || 0
  const cate = Number(req.body.cate || 0) || 0

  if (id) {
    const [ownRows] = await db.query(
      'SELECT id FROM user_designs WHERE id = ? AND user_id = ? AND design_type = 0 LIMIT 1',
      [id, userId],
    )
    const ownedList = ownRows as { id: number | string }[]
    if (ownedList?.length) {
      id = String(ownedList[0].id)
      await db.query(
        `UPDATE user_designs
         SET title = ?, width = ?, height = ?, cate = ?, data_json = ?, updated_at = NOW()
         WHERE id = ? AND user_id = ? AND design_type = 0`,
        [title, width, height, cate, dataJson, id, userId],
      )
    } else {
      id = ''
    }
  }

  if (!id) {
    const [ins] = await db.query(
      `INSERT INTO user_designs (user_id, design_type, title, width, height, cate, state, data_json)
       VALUES (?, 0, ?, ?, ?, ?, 1, ?)`,
      [userId, title, width, height, cate, dataJson],
    )
    id = String((ins as { insertId?: number | string }).insertId ?? '')
  }

  if (!id) {
    send.error(res, 'save work failed')
    return
  }

  const size = width > height ? 640 : 320
  const authToken = String(req.headers.authorization || '').trim()
  const fetchScreenshotUrl = internalApiUrl(
    `api/screenshots?id=${id}&width=${width}&height=${height}&type=file&size=${size}&quality=75&force=1${
      authToken ? `&authToken=${encodeURIComponent(authToken)}` : ''
    }`,
  )
  await axios.get(fetchScreenshotUrl, { responseType: 'arraybuffer' })

  send.success(res, { id })
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

function getSavedWorkPath(id: number | string) {
  return mockPath('posters', `${id}.json`)
}

function upsertTemplateCover(id: number | string, cover: string) {
  const listPath = mockPath('templates', 'list.json')
  const list = readJsonIfExists(listPath, [])
  const currentIndex = list.findIndex((item: any) => String(item.id) === String(id))
  if (currentIndex >= 0) {
    list[currentIndex] = { ...list[currentIndex], cover }
    writeJsonFile(listPath, list)
    return
  }

  const meta = findMergedTemplateMeta(id)
  if (!meta) return
  list.unshift({
    id: meta.id,
    cover,
    title: meta.title,
    width: meta.width,
    height: meta.height,
    cate: meta.cate,
    state: meta.state ?? 1,
  })
  writeJsonFile(listPath, list)
}

const templateStaticDir = () => path.resolve(__dirname, '../../static')

/** 匹配 ${id}-screenshot-vp-WxH.png 或旧版 ${id}-screenshot-vp.png */
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
      `api/screenshots?tempid=${id}&width=${width}&height=${height}&type=file&index=0&force=1&v=${savedStats.mtimeMs}`,
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

function buildTemplateTitle(currentTitle: string, headline: string) {
  if (!headline) return currentTitle
  if (currentTitle?.includes(headline)) return currentTitle
  if (currentTitle?.startsWith('示例模板 - ')) {
    return `示例模板 - ${headline}`
  }
  return headline
}

function getTemplateScreenshotFallback(id: number | string) {
  const base = findViewportScreenshotBasename(id)
  if (base) return `${getClientStaticBaseUrl()}${base}`
  const screenshotPath = path.resolve(__dirname, `../../static/${id}-screenshot.png`)
  if (!fs.existsSync(screenshotPath)) return ''
  return `${getClientStaticBaseUrl()}${id}-screenshot.png`
}

function getMergedTemplateList() {
  const baseList = getTemplateList()
  const customList = getCustomTemplateList()
  return enrichTemplateListWithSavedDetails(mergeUniqueById(baseList, customList))
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
    const screenshotUrl = getTemplatePreviewUrl(item.id, savedTemplatePath, width, height) || getTemplateScreenshotFallback(item.id)
    const headline = extractTemplateHeadline(savedDetail.data)
    return {
      ...item,
      title: buildTemplateTitle(savedDetail.title || item.title, headline),
      width,
      height,
      cate: typeof savedDetail.cate === 'number' ? savedDetail.cate : item.cate,
      thumb: screenshotUrl || item.thumb,
      cover: screenshotUrl || item.cover,
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
          cover: listCoverUrl(row.id, row.width, row.height),
        }))
        list = mergeUniqueById(fromDb, list)
      }
    }

    const page = Number(req.query.page || 1)
    const pageSize = Number(req.query.pageSize || list.length || 20)
    send.success(res, { list: paginateList(list, page, pageSize) })
    return
  }

  const mergedList = getMergedTemplateList()
  const filtered = filterTemplateList(mergedList, req.query || {})
  const page = Number(req.query.page || 1)
  const pageSize = Number(req.query.pageSize || filtered.length || 20)
  send.success(res, { list: paginateList(filtered, page, pageSize) })
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
        getTemplateScreenshotFallback(row.id) || listCoverUrl(row.id, row.width, row.height)
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
      getTemplateScreenshotFallback(row.id) || listCoverUrl(row.id, row.width, row.height)
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
    const list = getMockPosterList().map((item: any) => ({
      ...item,
      url:
        String(item.url || '').trim() ||
        listWorkPreviewUrl(item.id, Number(item.width) || 1242, Number(item.height) || 1660, Date.now()),
      isDelect: false,
    }))
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
    cover: listCoverUrl(row.id, row.width, row.height),
    url: listWorkPreviewUrl(row.id, row.width, row.height, row.updated_at),
    isDelect: false,
    fail: false,
    top: 0,
    left: 0,
  }))

  send.success(res, { list, total })
}

export async function getWorkDetail(req: any, res: any) {
  if (!isMysqlConfigured()) {
    const id = req.query.id
    const detail = readJsonIfExists(getSavedWorkPath(id), null)
    if (detail) {
      send.success(res, detail)
      return
    }
  }
  return getDetail(req, res)
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
  const detailPath = getSavedWorkPath(id)
  if (fs.existsSync(detailPath)) {
    fs.unlinkSync(detailPath)
  }
  send.success(res, true)
}

export async function saveTemplate(req: any, res: any) {
  const type = Number(req.body.type || 0)
  let id = req.body.id
  const title = req.body.title
  const data = req.body.data
  const width = req.body.width
  const height = req.body.height
  const cate = Number(req.body.cate || 0)
  const cover = String(req.body.cover || '').trim()
  const coverOnly = String(req.body.coverOnly || '') === '1' || req.body.coverOnly === true
  const folder = type === 1 ? 'components/detail' : 'templates'
  const listPath = type === 1 ? 'components/list/comp.json' : 'templates/list.json'

  try {
    if (coverOnly && id && cover) {
      if (!isMysqlConfigured()) {
        upsertTemplateCover(id, cover)
      }
      send.success(res, { id, cover })
      return
    }

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

      let targetId: string
      if (id) {
        const [ownRows] = await db.query(
          'SELECT id FROM user_designs WHERE id = ? AND user_id = ? AND design_type = ? LIMIT 1',
          [String(id), userId, designType],
        )
        const ownedList = ownRows as { id: number | string }[]
        if (ownedList?.length) {
          targetId = String(ownedList[0].id)
          if (designType === 1) {
            await db.query(
              `UPDATE user_designs SET title = ?, width = ?, height = ?, cate = ?, data_json = ?, component_list_key = ?, updated_at = NOW()
               WHERE id = ? AND user_id = ?`,
              [
                String(title || ''),
                Number(width) || 0,
                Number(height) || 0,
                numCate,
                dataJson,
                compListKey,
                targetId,
                userId,
              ],
            )
          } else {
            await db.query(
              `UPDATE user_designs SET title = ?, width = ?, height = ?, cate = ?, data_json = ?, updated_at = NOW()
               WHERE id = ? AND user_id = ?`,
              [
                String(title || ''),
                Number(width) || 0,
                Number(height) || 0,
                cate,
                dataJson,
                targetId,
                userId,
              ],
            )
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
      } else {
        const [ins] = await db.query(
          `INSERT INTO user_designs (user_id, design_type, title, width, height, cate, state, data_json)
           VALUES (?, 0, ?, ?, ?, ?, 1, ?)`,
          [userId, String(title || ''), Number(width) || 0, Number(height) || 0, cate, dataJson],
        )
        targetId = String((ins as { insertId?: number | string }).insertId ?? '')
      }

      if (!targetId) {
        send.error(res, 'save template failed')
        return
      }

      const size = width > height ? 640 : 320
      const fetchScreenshotUrl = internalApiUrl(
        `api/screenshots?tempid=${targetId}&tempType=${type}&width=${width}&height=${height}&type=file&size=${size}&quality=75&force=1`,
      )
      await axios.get(fetchScreenshotUrl, { responseType: 'arraybuffer' })

      send.success(res, { id: targetId })
      return
    }

    const isAdd = !id
    id = id || randomCode(8)
    const savePath = mockRel(`${folder}/${id}.json`)
    const jsonData = { id, data, title, width, height, cate }
    fs.writeFileSync(savePath, JSON.stringify(jsonData))

    const size = width > height ? 640 : 320
    // Use file/png here to avoid the Windows-native jpg compression path
    // that can crash the local dev service during save.
    const fetchScreenshotUrl = internalApiUrl(
      `api/screenshots?tempid=${id}&tempType=${type}&width=${width}&height=${height}&type=file&size=${size}&quality=75&force=1`,
    )
    await axios.get(fetchScreenshotUrl, { responseType: 'arraybuffer' })

    if (isAdd) {
      const list = readJsonIfExists(mockRel(listPath), [])
      const cw = Math.max(1, Math.round(Number(width)))
      const ch = Math.max(1, Math.round(Number(height)))
      const cover = `${getClientStaticBaseUrl()}${id}-screenshot-vp-${cw}x${ch}.png`
      list.unshift({ id, cover, title, width, height, cate, state: 1 })
      writeJsonFile(mockRel(listPath), list)
    }
    send.success(res, { id })
  } catch (error) {
    console.log(error)
    send.error(res, 'save template failed')
  }
}

export async function saveWork(req: any, res: any) {
  if (isMysqlConfigured()) {
    return saveWorkToMysql(req, res)
  }

  try {
    let id = String(req.body.id || '').trim()
    const title = String(req.body.title || '')
    const data = req.body.data
    const width = Number(req.body.width) || 0
    const height = Number(req.body.height) || 0
    const cate = Number(req.body.cate || 0) || 0

    const isAdd = !id
    if (!id) {
      id = randomCode(8)
    }

    const detailPath = getSavedWorkPath(id)
    const detailPayload = { id, data, title, width, height, cate }
    writeJsonFile(detailPath, detailPayload)

    const size = width > height ? 640 : 320
    const fetchScreenshotUrl = internalApiUrl(
      `api/screenshots?id=${id}&width=${width}&height=${height}&type=file&size=${size}&quality=75&force=1`,
    )
    await axios.get(fetchScreenshotUrl, { responseType: 'arraybuffer' })

    const listPath = mockPath('posters', 'list.json')
    const list = readJsonIfExists(listPath, [])
    const cw = Math.max(1, Math.round(width))
    const ch = Math.max(1, Math.round(height))
    const cover = `${getClientStaticBaseUrl()}${id}-screenshot-vp-${cw}x${ch}.png`
    const nextItem = {
      id,
      cover,
      title,
      width,
      height,
      cate,
      state: 1,
      isDelect: false,
      fail: false,
      top: 0,
      left: 0,
      url: listWorkPreviewUrl(id, width, height, Date.now()),
    }
    const nextList = isAdd
      ? [nextItem, ...list]
      : [nextItem, ...list.filter((item: any) => String(item.id) !== id)]
    writeJsonFile(listPath, nextList)

    send.success(res, { id })
  } catch (error) {
    console.log(error)
    send.error(res, 'save work failed')
  }
}

export default {
  getTemplates,
  getDetail,
  getCategories,
  getMyDesigns,
  getWorkDetail,
  getMaterial,
  getPhotos,
  saveWork,
  saveTemplate,
  deleteWork,
}
