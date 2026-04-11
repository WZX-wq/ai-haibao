import { Request, Response } from 'express'
import fs from 'fs'
import path from 'path'
import axios from '../utils/http'
import { send, randomCode } from '../utils/tools'
import { getTemplateCategories, getTemplateDetail, getTemplateList } from './templateCatalog'

const FileUrl = 'http://127.0.0.1:7001/static/'

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
  return readJsonIfExists(path.resolve(__dirname, '../mock/templates/list.json'), [])
}

function getSavedTemplatePath(id: number | string) {
  return path.resolve(__dirname, `../mock/templates/${id}.json`)
}

function getTemplateScreenshotPath(id: number | string) {
  return path.resolve(__dirname, `../../static/${id}-screenshot.png`)
}

function getTemplateScreenshotUrl(id: number | string, version?: number | string) {
  const query = version ? `?v=${version}` : ''
  return `${FileUrl}${id}-screenshot.png${query}`
}

function getTemplatePreviewUrl(id: number | string, savedTemplatePath: string, width: number, height: number) {
  const savedStats = fs.statSync(savedTemplatePath)
  if (width > 0 && height > 0) {
    return `http://127.0.0.1:7001/api/screenshots?tempid=${id}&width=${width}&height=${height}&type=file&index=0&force=1&v=${savedStats.mtimeMs}`
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
  const screenshotPath = path.resolve(__dirname, `../../static/${id}-screenshot.png`)
  if (!fs.existsSync(screenshotPath)) return ''
  return `${FileUrl}${id}-screenshot.png`
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
  return readJsonIfExists(path.resolve(__dirname, '../mock/posters/list.json'), [])
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

export async function getTemplates(req: any, res: Response) {
  const type = Number(req.query.type || 0)
  if (type === 1) {
    const cate = req.query.cate || 'text'
    const tempPath = path.resolve(__dirname, `../mock/components/list/${cate}.json`)
    const list = readJsonIfExists(tempPath, [])
    const page = Number(req.query.page || 1)
    const pageSize = Number(req.query.pageSize || list.length || 20)
    send.success(res, { list: paginateList(list, page, pageSize) })
    return
  }

  const baseList = getTemplateList()
  const customList = getCustomTemplateList()
  const mergedList = enrichTemplateListWithSavedDetails(mergeUniqueById(baseList, customList))
  const filtered = filterTemplateList(mergedList, req.query || {})
  const page = Number(req.query.page || 1)
  const pageSize = Number(req.query.pageSize || filtered.length || 20)
  send.success(res, { list: paginateList(filtered, page, pageSize) })
}

export async function getDetail(req: any, res: Response) {
  const type = Number(req.query.type || 0)
  const id = req.query.id
  if (type === 1) {
    const detailPath = path.resolve(__dirname, `../mock/components/detail/${id}.json`)
    const detail = readJsonIfExists(detailPath, null)
    if (!detail) {
      send.error(res, 'template not found')
      return
    }
    send.success(res, detail)
    return
  }

  const catalogDetail = getTemplateDetail(id)
  const savedTemplatePath = path.resolve(__dirname, `../mock/templates/${id}.json`)
  if (fs.existsSync(savedTemplatePath)) {
    const savedDetail = parseJsonFile(savedTemplatePath)
    if (isRenderableTemplateData(savedDetail?.data)) {
      send.success(res, savedDetail)
      return
    }
    if (catalogDetail) {
      send.success(res, catalogDetail)
      return
    }
    send.error(res, 'template not found')
    return
  }

  if (catalogDetail) {
    send.success(res, catalogDetail)
    return
  }

  send.error(res, 'template not found')
}

export async function getCategories(req: any, res: Response) {
  const type = Number(req.query.type || 1)
  if (type === 1) {
    send.success(res, getTemplateCategories())
    return
  }
  send.success(res, [])
}

export async function getMyDesigns(req: any, res: Response) {
  const page = Number(req.query.page || 1)
  const pageSize = Number(req.query.pageSize || 10)
  const list = getMockPosterList()
  send.success(res, { list: paginateList(list, page, pageSize) })
}

export async function getWorkDetail(req: any, res: Response) {
  return getDetail(req, res)
}

export async function getMaterial(req: any, res: Response) {
  const cate = req.query.cate
  const page = Number(req.query.page || 1)
  const pageSize = Number(req.query.pageSize || 20)
  const detail = readJsonIfExists(path.resolve(__dirname, `../mock/materials/${cate}.json`), [])
  send.success(res, { list: paginateList(detail, page, pageSize) })
}

export async function getPhotos(req: any, res: Response) {
  const cate = req.query.cate
  const page = Number(req.query.page || 1)
  const pageSize = Number(req.query.pageSize || 30)
  const detail = readJsonIfExists(path.resolve(__dirname, `../mock/materials/photos/${cate}.json`), [])
  send.success(res, { list: paginateList(detail, page, pageSize) })
}

export async function deleteWork(req: any, res: Response) {
  const id = String(req.body.id || '')
  if (!id) {
    send.error(res, 'missing work id')
    return
  }

  const listPath = path.resolve(__dirname, '../mock/posters/list.json')
  const list = readJsonIfExists(listPath, [])
  const nextList = list.filter((item: any) => String(item.id) !== id)

  if (nextList.length === list.length) {
    send.error(res, 'work not found')
    return
  }

  writeJsonFile(listPath, nextList)
  send.success(res, true)
}

export async function saveTemplate(req: any, res: Response) {
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

    const isAdd = !id
    id = id || randomCode(8)
    const savePath = path.resolve(__dirname, `../mock/${folder}/${id}.json`)
    const jsonData = { id, data, title, width, height, cate }
    fs.writeFileSync(savePath, JSON.stringify(jsonData))

    const size = width > height ? 640 : 320
    // Use file/png here to avoid the Windows-native jpg compression path
    // that can crash the local dev service during save.
    const fetchScreenshotUrl = `http://127.0.0.1:7001/api/screenshots?tempid=${id}&tempType=${type}&width=${width}&height=${height}&type=file&size=${size}&quality=75&force=1`
    await axios.get(fetchScreenshotUrl, { responseType: 'arraybuffer' })

    if (isAdd) {
      const list = readJsonIfExists(path.resolve(__dirname, `../mock/${listPath}`), [])
      const cover = `${FileUrl}/${id}-screenshot.png`
      list.unshift({ id, cover, title, width, height, cate, state: 1 })
      writeJsonFile(path.resolve(__dirname, `../mock/${listPath}`), list)
    }
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
  getMaterial,
  getPhotos,
  saveTemplate,
  deleteWork,
}
