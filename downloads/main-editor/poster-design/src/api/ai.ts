import axiosFetch from '@/utils/axios'
import _config from '@/config'

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

export type PosterDesignPlan = {
  industry: string
  tone: string
  layoutFamily: string
  density: 'light' | 'balanced' | 'dense'
  heroStrategy: 'product' | 'person' | 'scene' | 'editorial'
  ctaStrength: 'soft' | 'balanced' | 'strong'
  qrStrategy: 'none' | 'corner' | 'cta'
  templateCandidates: PosterTemplateCandidate[]
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

async function requestAi<T>(url: string, params: PosterGenerateInput, timeout = 240000): Promise<T> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeout)
  const finalUrl = url.startsWith('http') ? url : `${_config.API_URL}/${url}`.replace(/([^:]\/)\/+/g, '$1')

  try {
    const response = await window.fetch(finalUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
      signal: controller.signal,
    })
    const payload = await response.json()
    if (!response.ok) {
      throw new Error(payload?.msg || payload?.message || `Request failed with status ${response.status}`)
    }
    if (payload?.code === 200 && payload?.result) {
      return payload.result as T
    }
    if (payload?.code && payload.code !== 200) {
      throw new Error(payload.msg || payload.message || 'AI request failed')
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
