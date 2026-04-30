/*
 * @Author: ShawnPhang
 * @Date: 2022-02-01 13:41:59
 * @Description:
 * @LastEditors: ShawnPhang <https://m.palxp.cn>
 * @LastEditTime: 2024-11-14 17:36:17
 */

import express from 'express'
import bodyParser from 'body-parser'
import fs from 'fs'
import path from 'path'
import router from './control/router'
import { filePath, servicePort } from './configs'
import handleTimeout from './utils/timeout'

function loadEnvFile() {
  const envPath = `${process.cwd()}/.env`
  if (!fs.existsSync(envPath)) return
  const content = fs.readFileSync(envPath, 'utf8')
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const index = trimmed.indexOf('=')
    if (index <= 0) return
    const key = trimmed.slice(0, index).trim()
    const rawValue = trimmed.slice(index + 1).trim()
    const value = rawValue.replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) {
      process.env[key] = value
    }
  })
}

loadEnvFile()

const port = process.env.PORT || servicePort
const app = express()
function resolveExistingFile(candidates: string[]) {
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  return ''
}
const rootFaviconPng = resolveExistingFile([
  path.join(process.cwd(), 'public', 'favicon.png'),
  path.join(process.cwd(), '..', 'public', 'favicon.png'),
])
const rootFaviconSvg = resolveExistingFile([
  path.join(process.cwd(), 'public', 'favicon.svg'),
  path.join(process.cwd(), '..', 'public', 'favicon.svg'),
])

// 创建目录
const createFolder = (folder: string) => {
  try {
    fs.accessSync(folder)
  } catch (e) {
    fs.mkdirSync(folder, { recursive: true })
  }
}
createFolder(filePath)
const legacyStorageRoot = path.resolve(String(process.env.FILE_STORAGE_PATH || '/cache/'))
const staticRoots = Array.from(
  new Set(
    [String(filePath || '').trim(), path.join(process.cwd(), 'static'), legacyStorageRoot]
      .filter(Boolean)
      .map((item) => path.resolve(String(item).replace(/[\\/]+$/, ''))),
  ),
)

app.all('*', (req: any, res: any, next: any) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'X-Access-Token,Content-Type,Authorization,Content-Length,Content-Size')
  res.header('Access-Control-Allow-Methods', '*')
  const p = String(req.path || '')
  if (!p.includes('/screenshots') && !p.includes('/printscreen')) {
    res.header('Content-Type', 'application/json;charset=utf-8')
  }
  if (req.method === 'OPTIONS') {
    res.sendStatus(200)
    return
  }
  next()
})

staticRoots.forEach((root) => {
  createFolder(root)
  app.use(
    '/static',
    setUploadContentType,
    express.static(root, {
      etag: true,
      lastModified: true,
      setHeaders: setStaticCacheHeaders,
    }),
  )
})
if (fs.existsSync(process.cwd() + `/src/mock/assets`)) {
  app.use(
    '/store',
    setUploadContentType,
    express.static(process.cwd() + `/src/mock/assets`, {
      etag: true,
      lastModified: true,
      setHeaders: setStaticCacheHeaders,
    }),
  )
}
app.get('/favicon.ico', (req: any, res: any) => {
  if (rootFaviconPng) {
    res.setHeader('Content-Type', 'image/png')
    res.sendFile(rootFaviconPng)
    return
  }
  if (rootFaviconSvg) {
    res.setHeader('Content-Type', 'image/svg+xml')
    res.sendFile(rootFaviconSvg)
    return
  }
  res.sendStatus(204)
})

app.use(handleTimeout)

app.use((req: any, res: any, next: any) => {
  console.log(req.path)
  next()
})

app.use(bodyParser.urlencoded({ limit: '100mb', extended: true, parameterLimit: 100000 }))
app.use(bodyParser.json({ limit: '100mb' }))
app.use(router)

app.listen(port, () => console.log(`Screenshot Server start on port:${port}`))

const getContentType = function (path: any) {
  const extension = path.split('.').pop().toLowerCase()
  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'gif':
      return 'image/gif'
    case 'svg':
      return 'image/svg+xml'
    case 'webp':
      return 'image/webp'
    default:
      return null
  }
}

function setStaticCacheHeaders(res: any, filePath: string) {
  const normalizedPath = String(filePath || '').replace(/\\/g, '/').toLowerCase()
  const isUserAsset = normalizedPath.includes('/static/user/')
  const isLogFile = normalizedPath.includes('/static/logs/')
  const isImageAsset = /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(normalizedPath)

  if (isLogFile) {
    res.setHeader('Cache-Control', 'no-store')
    return
  }

  if (isUserAsset) {
    res.setHeader('Cache-Control', isImageAsset ? 'private, max-age=86400, stale-while-revalidate=604800' : 'private, max-age=3600')
    return
  }

  if (isImageAsset) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    return
  }

  res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
}

function setUploadContentType(req: any, res: any, next: any) {
  const contentType = getContentType(req.path)
  if (contentType) {
    res.setHeader('Content-Type', contentType)
  }
  next()
}
