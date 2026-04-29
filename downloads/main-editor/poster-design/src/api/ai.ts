import axiosFetch from '@/utils/axios'
import _config, { LocalStorageKey } from '@/config'
import { useUserStore } from '@/store/index'

export type TCommonUploadCb = (up: number, dp: number) => void

export type PosterGenerateInput = {
  presetKey?: string
  theme: string
  purpose: string
  sizeKey: string
  style: string
  industry: string
  content: string
  qrUrl: string
  generationMode?: 'fast' | 'quality'
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
  role:
    | 'title'
    | 'slogan'
    | 'body'
    | 'cta'
    | 'hero'
    | 'qrcode'
    | 'badge'
    | 'priceTag'
    | 'priceNum'
    | 'meta1'
    | 'meta2'
    | 'chip1'
    | 'chip2'
    | 'chip3'
    | 'chip4'
    | 'logo'
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

export type PosterScene = 'commerce' | 'recruitment' | 'event' | 'course' | 'festival' | 'food' | 'fitness' | 'social'
export type PosterGoal = 'sell' | 'lead' | 'recruit' | 'sign_up' | 'promote' | 'inform'
export type PosterContentPattern = 'immersive-hero' | 'price-first' | 'info-cards' | 'cover-story' | 'list-info'
export type PosterCtaVariant = 'solid' | 'outline' | 'ghost' | 'pill' | 'bar' | 'sticker' | 'underline'
export type PosterCtaPlacement = 'inline' | 'bottom-bar' | 'floating' | 'with-price'
export type PosterCtaTone = 'urgent' | 'premium' | 'friendly' | 'editorial' | 'utility'
export type PosterCtaIconHint = 'none' | 'arrow' | 'plus' | 'spark' | 'chevron'
export type PosterCtaWidthMode = 'content' | 'wide' | 'full'
export type PosterEmphasisRole =
  | 'heroHeadline'
  | 'supportLine'
  | 'priceBlock'
  | 'factCards'
  | 'offerLine'
  | 'proofPoints'
  | 'audienceLine'
  | 'trustLine'
  | 'urgencyLine'
  | 'actionReason'
  | 'cta'

export type PosterIntent = {
  scene: PosterScene
  goal: PosterGoal
  audience: string
  tone: string
}

export type PosterFactCard = {
  label: string
  value: string
  hint: string
}

export type PosterPriceBlock = {
  tag: string
  value: string
  suffix: string
  note: string
}

export type PosterLayoutRect = {
  x: number
  y: number
  w: number
  h: number
}

export type PosterLayoutZone = PosterLayoutRect & {
  kind: 'safe' | 'avoid'
  label: string
  reason?: string
}

export type PosterPlacementRole = 'heroHeadline' | 'supportLine' | 'body' | 'cta' | 'badge' | 'priceBlock'

export type PosterPlacementHint = PosterLayoutRect & {
  role: PosterPlacementRole
  align?: 'left' | 'center' | 'right'
  priority?: number
}

export type PosterTextTreatment = 'clean' | 'outline' | 'panel'

export type PosterTextStyleHint = {
  role: PosterPlacementRole
  fill: string
  stroke?: string
  panel?: string
  treatment: PosterTextTreatment
  weight?: 'regular' | 'medium' | 'bold'
}

export type PosterMultimodalLayoutHints = {
  safeZones: PosterLayoutZone[]
  avoidZones: PosterLayoutZone[]
  suggestedPlacement: PosterPlacementHint[]
  textStyleHints: PosterTextStyleHint[]
  visualAnalysis: {
    dominantTone: 'light' | 'dark' | 'mixed'
    texture: 'clean' | 'detailed'
    focusBias: 'left' | 'center' | 'right'
    needsPanel: boolean
  }
  layoutDecision: {
    recommendedFamily: string
    confidence: number
    rationale: string
  }
}

export type PosterCopyDeck = {
  heroHeadline: string
  supportLine: string
  offerLine: string
  urgencyLine: string
  actionReason: string
  cta: string
  ctaAlternatives: string[]
  badge: string
  proofPoints: string[]
  factCards: PosterFactCard[]
  priceBlock: PosterPriceBlock | null
  audienceLine: string
  trustLine: string
}
export type PosterCtaStyle = {
  variant: PosterCtaVariant
  emphasis: 'soft' | 'balanced' | 'strong'
  shape: 'rounded' | 'square' | 'capsule'
  placement: PosterCtaPlacement
  tone: PosterCtaTone
  iconHint: PosterCtaIconHint
  widthMode: PosterCtaWidthMode
}

export type PosterQualityIssue = {
  code: string
  message: string
  level: 'error' | 'warn'
}

export type PosterQualityReport = {
  pass: boolean
  score: number
  needsRefine: boolean
  issues: PosterQualityIssue[]
  failureTags?: string[]
}

export type PosterDesignPlan = {
  industry: string
  tone: string
  layoutFamily: string
  density: 'light' | 'balanced' | 'dense'
  heroStrategy: 'product' | 'person' | 'scene' | 'editorial'
  ctaStrength: 'soft' | 'balanced' | 'strong'
  ctaStyle?: PosterCtaStyle
  qrStrategy: 'none' | 'corner' | 'cta'
  textStrategy?: 'clean' | 'outline' | 'panel'
  backgroundTone?: 'light' | 'dark' | 'mixed'
  contentPattern?: PosterContentPattern
  emphasisOrder?: PosterEmphasisRole[]
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

export type CutoutProviderMode = 'local' | 'remote'

export type PosterGenerateResult = {
  title: string
  slogan: string
  body: string
  cta: string
  ctaAlternatives?: string[]
  badge?: string
  offerLine?: string
  urgencyLine?: string
  proofPoints?: string[]
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
  posterIntent?: PosterIntent
  copyDeck?: PosterCopyDeck
  multimodalLayoutHints?: PosterMultimodalLayoutHints
  qualityHints?: string[]
  qualityReport?: PosterQualityReport
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
  const timer = window.setTimeout(() => controller.abort('timeout'), timeout)
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
    const rawText = await response.text()
    let payload: any = null
    try {
      payload = rawText ? JSON.parse(rawText) : null
    } catch {
      payload = null
    }
    const getPayloadMessage = () => {
      const message = payload?.message || payload?.msg || payload?.error || payload?.result?.message || payload?.result?.msg
      if (String(message || '').trim()) return String(message || '').trim()
      const plainText = String(rawText || '').replace(/\s+/g, ' ').trim()
      if (!plainText) return ''
      if (plainText.startsWith('<!DOCTYPE') || plainText.startsWith('<html')) {
        return 'AI 服务暂时不可用，请稍后重试'
      }
      return plainText.slice(0, 180)
    }
    if (response.status === 401 || payload?.code === 401) {
      useUserStore().changeOnline(false)
    }
    if (!response.ok) {
      throw new Error(getPayloadMessage() || `AI 服务暂时不可用（${response.status}），请稍后重试`)
    }
    if (payload?.code === 200 && payload?.result) {
      return payload.result as T
    }
    if (payload?.code && payload.code !== 200) {
      throw new Error(getPayloadMessage() || 'AI 服务暂时不可用，请稍后重试')
    }
    if (payload) return payload as T
    throw new Error(getPayloadMessage() || 'AI 服务返回为空，请稍后重试')
  } catch (error) {
    const err = error as any
    if (err?.name === 'AbortError' || controller.signal.aborted) {
      throw new Error('AI 生成时间较长，请稍候重试')
    }
    throw error
  } finally {
    window.clearTimeout(timer)
  }
}

export const generatePoster = (params: PosterGenerateInput) =>
  requestAi<PosterGenerateResult>('ai/poster/generate', params, 480000)

export const generateCopy = (params: PosterGenerateInput) =>
  requestAi<CopyGenerateResult>('ai/poster/copy', params, 120000)

export const generatePalette = (params: PosterGenerateInput) =>
  requestAi<PaletteGenerateResult>('ai/poster/palette', params, 120000)

export const generateBackground = (params: PosterGenerateInput) =>
  requestAi<BackgroundGenerateResult>('ai/poster/background', params, 360000)

export const replacePosterImage = (params: PosterGenerateInput) =>
  requestAi<ReplaceImageResult>('ai/poster/replace-image', params, 360000)

export const relayoutPoster = (params: PosterGenerateInput) =>
  requestAi<RelayoutResult>('ai/poster/relayout', params, 120000)

export const cutoutImage = (file: File, provider: CutoutProviderMode = 'local', cb?: TCommonUploadCb) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('provider', provider)
  const extra = {
    timeout: 600000,
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
