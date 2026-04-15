import axiosFetch from '@/utils/axios'
import _config, { LocalStorageKey } from '@/config'
import { useUserStore } from '@/store/index'

export type TCommonUploadCb = (up: number, dp: number) => void

export type PosterGenerateInput = {
  theme: string
  purpose: string
  sizeKey: string
  style: string
  industry: string
  content: string
  qrUrl: string
  sourceImageUrl?: string
  baseImageUrl?: string
  /** 默认 true；传 false 时不生成 AI 主图（仅背景+叠字） */
  generateHeroImage?: boolean
  /** 默认 true；传 false 时不调用 AI 背景图（画布用配色渐变） */
  generateBackgroundImage?: boolean
}

export type PosterPalette = {
  background: string
  surface: string
  primary: string
  secondary: string
  text: string
  muted: string
  swatches: string[]
}

export type PosterTemplateCandidate = {
  familyId: string
  title: string
  industry: string
  layoutFamily: string
  tone: string
  score: number
  reason?: string
  cover?: string
}

export type PosterAbsoluteLayoutLayer = {
  role: 'title' | 'slogan' | 'body' | 'cta' | 'hero' | 'qrcode'
  left: number
  top: number
  width: number
  height: number
  fontSize?: number
  textAlign?: 'left' | 'center' | 'right'
}

export type PosterAbsoluteLayout = {
  version: 'v1'
  layers: PosterAbsoluteLayoutLayer[]
}

export type PosterDesignPlan = {
  industry: string
  tone: string
  layoutFamily: string
  density: 'light' | 'balanced' | 'dense'
  heroStrategy: 'product' | 'person' | 'scene' | 'editorial'
  ctaStrength: 'soft' | 'balanced' | 'strong'
  qrStrategy: 'none' | 'corner' | 'cta'
  templateCandidates: PosterTemplateCandidate[]
  /** 增强模式：AI 返回绝对坐标排版块；前端优先按此布局，缺失时回退骨架算法 */
  absoluteLayout?: PosterAbsoluteLayout
}

export type AiProviderMeta = {
  provider: string
  model: string
  isMockFallback: boolean
  message: string
}

export type PosterGenerateResult = {
  title: string
  slogan: string
  body: string
  cta: string
  palette: PosterPalette
  background: {
    imageUrl: string
    prompt: string
  }
  hero: {
    imageUrl: string
    prompt: string
  }
  recommendedTemplate?: {
    id: number
    cover: string
    title: string
    width: number
    height: number
    state: number
    cate: number
  }
  recommendedTemplates?: PosterTemplateCandidate[]
  templateCandidates?: PosterTemplateCandidate[]
  designPlan?: PosterDesignPlan
  size: {
    key: string
    name: string
    width: number
    height: number
  }
  providerMeta: Record<string, AiProviderMeta>
}

export type CopyGenerateResult = {
  title: string
  slogan: string
  body: string
  cta: string
  providerMeta: AiProviderMeta
}

export type PaletteGenerateResult = {
  palette: PosterPalette
  providerMeta: AiProviderMeta
}

export type BackgroundGenerateResult = {
  background: {
    imageUrl: string
    prompt: string
  }
  providerMeta: AiProviderMeta
}

export type ReplaceImageResult = {
  hero: {
    imageUrl: string
    prompt: string
  }
  providerMeta: AiProviderMeta
}

export type RelayoutResult = {
  designPlan: PosterDesignPlan
  providerMeta: AiProviderMeta
}

export type CutoutResult = {
  rawUrl: string
  resultUrl: string
  providerMeta: AiProviderMeta
}

export async function requestAi<T>(url: string, params: PosterGenerateInput, timeout = 240000): Promise<T> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeout)
  const finalUrl = url.startsWith('http') ? url : `${_config.API_URL}/${url}`.replace(/([^:]\/)\/+/g, '$1')
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem(LocalStorageKey.tokenKey) || '' : ''
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = token

  try {
    const response = await window.fetch(finalUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
      signal: controller.signal,
    })
    const payload = await response.json()
    if (response.status === 401 || payload?.code === 401) {
      useUserStore().changeOnline(false)
    }
    if (!response.ok) {
      throw new Error('AI 服务暂时不可用，请稍后重试')
    }
    if (payload?.code === 200 && payload?.result) {
      return payload.result as T
    }
    if (payload?.code && payload.code !== 200) {
      throw new Error('AI 服务暂时不可用，请稍后重试')
    }
    return payload as T
  } finally {
    window.clearTimeout(timer)
  }
}

export const generatePoster = (params: PosterGenerateInput) =>
  requestAi<PosterGenerateResult>('ai/poster/generate', params, 240000)

export const generateCopy = (params: PosterGenerateInput) =>
  requestAi<CopyGenerateResult>('ai/poster/copy', params, 120000)

export const generatePalette = (params: PosterGenerateInput) =>
  requestAi<PaletteGenerateResult>('ai/poster/palette', params, 120000)

export const generateBackground = (params: PosterGenerateInput) =>
  requestAi<BackgroundGenerateResult>('ai/poster/background', params, 240000)

export const replacePosterImage = (params: PosterGenerateInput) =>
  requestAi<ReplaceImageResult>('ai/poster/replace-image', params, 240000)

export const relayoutPoster = (params: PosterGenerateInput) =>
  requestAi<RelayoutResult>('ai/poster/relayout', params, 120000)

export const cutoutImage = (file: File, cb?: TCommonUploadCb) => {
  const formData = new FormData()
  formData.append('file', file)
  const extra = {
    responseType: 'json',
    onUploadProgress: (progress: { loaded: number; total: number }) => {
      cb?.(Math.floor((progress.loaded / progress.total) * 100), 0)
    },
    onDownloadProgress: (progress: { loaded: number; total: number }) => {
      cb?.(100, Math.floor((progress.loaded / progress.total) * 100))
    },
  }
  return axiosFetch<CutoutResult>('ai/poster/cutout', formData, 'post', {}, extra)
}

export const upload = (file: File, cb?: TCommonUploadCb, folder = 'user') => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('folder', folder)
  const extra = {
    responseType: 'json',
    onUploadProgress: (progress: { loaded: number; total: number }) => {
      cb?.(Math.floor((progress.loaded / progress.total) * 100), 0)
    },
    onDownloadProgress: (progress: { loaded: number; total: number }) => {
      cb?.(100, Math.floor((progress.loaded / progress.total) * 100))
    },
  }
  return axiosFetch<{ key: string; url: string }>(`${_config.SCREEN_URL}/api/file/upload`, formData, 'post', {}, extra)
}
