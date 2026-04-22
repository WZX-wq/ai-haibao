import fs from 'fs'
import path from 'path'

const images = require('images')

const THUMB_SUFFIX = '__thumb'
const THUMB_MAX_EDGE = 480
const JPG_QUALITY = 72
const PNG_QUALITY = 90
const SUPPORTED_RASTER_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp'])

function normalizeExt(ext: string) {
  return String(ext || '').trim().toLowerCase()
}

function getThumbExt(sourceExt: string) {
  const ext = normalizeExt(sourceExt)
  if (ext === '.png' || ext === '.webp') return 'png'
  if (ext === '.jpg' || ext === '.jpeg') return 'jpg'
  return ''
}

function getThumbCandidates(sourcePath: string) {
  const parsed = path.parse(sourcePath)
  return [
    path.join(parsed.dir, `${parsed.base}${THUMB_SUFFIX}.jpg`),
    path.join(parsed.dir, `${parsed.base}${THUMB_SUFFIX}.png`),
  ]
}

export function isGeneratedImageThumb(fileName: string) {
  return new RegExp(`${THUMB_SUFFIX}\\.(jpg|png)$`, 'i').test(String(fileName || ''))
}

export function findExistingImageThumbnail(sourcePath: string) {
  const candidates = getThumbCandidates(sourcePath)
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate
    }
  }
  return ''
}

export function ensureImageThumbnail(sourcePath: string, maxEdge = THUMB_MAX_EDGE) {
  const ext = normalizeExt(path.extname(sourcePath))
  if (!SUPPORTED_RASTER_EXTS.has(ext)) return ''
  if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) return ''

  const sourceStat = fs.statSync(sourcePath)
  const existingThumb = findExistingImageThumbnail(sourcePath)
  if (existingThumb) {
    const thumbStat = fs.statSync(existingThumb)
    if (thumbStat.mtimeMs >= sourceStat.mtimeMs) {
      return existingThumb
    }
  }

  const thumbExt = getThumbExt(ext)
  if (!thumbExt) return ''

  const parsed = path.parse(sourcePath)
  const thumbPath = path.join(parsed.dir, `${parsed.base}${THUMB_SUFFIX}.${thumbExt}`)
  try {
    images(sourcePath)
      .size(Number(maxEdge) || THUMB_MAX_EDGE)
      .save(thumbPath, { quality: thumbExt === 'jpg' ? JPG_QUALITY : PNG_QUALITY })
    return thumbPath
  } catch (error) {
    console.warn('[ensureImageThumbnail] failed', sourcePath, error)
    return ''
  }
}

export function deleteImageThumbnail(sourcePath: string) {
  const candidates = getThumbCandidates(sourcePath)
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        fs.unlinkSync(candidate)
      }
    } catch (error) {
      console.warn('[deleteImageThumbnail] failed', candidate, error)
    }
  }
}
