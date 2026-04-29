import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import multiparty from 'multiparty'
import axiosClient from 'axios'
import axios from '../utils/http'
import { filePath } from '../configs'
import { checkCreateFolder, copyFile, randomCode, send } from '../utils/tools'
import { getTemplateCandidatesSmart, getTemplateSuggestionSmart } from './templateCatalog'
import { getClientSiteRootUrl, getClientStaticBaseUrl, getInternalApiOrigin } from '../utils/clientPublicUrl'

type PosterGenerateInput = {
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
  /** 为 false 时不调用文生图主图，仅背景+版式（默认 true） */
  generateHeroImage?: boolean
  /** 为 false 时不调用背景模型；若未提供底图也会跳过背景模型 */
  generateBackgroundImage?: boolean
}

type PosterPalette = {
  background: string
  surface: string
  primary: string
  secondary: string
  text: string
  muted: string
  swatches: string[]
}

type AiProviderMeta = { provider: string; model: string; isMockFallback: boolean; message: string }
type CopyResult = {
  title: string
  slogan: string
  body: string
  cta: string
  ctaAlternatives?: string[]
  badge?: string
  offerLine?: string
  urgencyLine?: string
  actionReason?: string
  proofPoints?: string[]
  posterIntent?: PosterIntent
  copyDeck?: PosterCopyDeck
}
type PosterImageResult = { imageUrl: string; prompt: string }
type SizePreset = { key: string; name: string; width: number; height: number }
type ProviderResult<T> = { result: T; meta: AiProviderMeta }
type AiStage = 'copy' | 'palette' | 'image' | 'background' | 'imageEdit' | 'relayout' | 'multimodalLayout' | 'cutout'
type PosterGenerationMode = 'fast' | 'quality'
type PosterScene = 'commerce' | 'recruitment' | 'event' | 'course' | 'festival' | 'food' | 'fitness' | 'social'
type PosterGoal = 'sell' | 'lead' | 'recruit' | 'sign_up' | 'promote' | 'inform'
type PosterContentPattern = 'immersive-hero' | 'price-first' | 'info-cards' | 'cover-story' | 'list-info'
type PosterCtaVariant = 'solid' | 'outline' | 'ghost' | 'pill' | 'bar' | 'sticker' | 'underline'
type PosterCtaPlacement = 'inline' | 'bottom-bar' | 'floating' | 'with-price'
type PosterCtaTone = 'urgent' | 'premium' | 'friendly' | 'editorial' | 'utility'
type PosterCtaIconHint = 'none' | 'arrow' | 'plus' | 'spark' | 'chevron'
type PosterCtaWidthMode = 'content' | 'wide' | 'full'
type PosterEmphasisRole =
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
type PosterIntent = {
  scene: PosterScene
  goal: PosterGoal
  audience: string
  tone: string
}
type PosterFactCard = {
  label: string
  value: string
  hint: string
}
type PosterPriceBlock = {
  tag: string
  value: string
  suffix: string
  note: string
}
type PosterLayoutRect = {
  x: number
  y: number
  w: number
  h: number
}
type PosterLayoutZone = PosterLayoutRect & {
  kind: 'safe' | 'avoid'
  label: string
  reason?: string
}
type PosterPlacementRole = 'heroHeadline' | 'supportLine' | 'body' | 'cta' | 'badge' | 'priceBlock'
type PosterPlacementHint = PosterLayoutRect & {
  role: PosterPlacementRole
  align?: 'left' | 'center' | 'right'
  priority?: number
}
type PosterTextTreatment = 'clean' | 'outline' | 'panel'
type PosterTextStyleHint = {
  role: PosterPlacementRole
  fill: string
  stroke?: string
  panel?: string
  treatment: PosterTextTreatment
  weight?: 'regular' | 'medium' | 'bold'
}
type PosterMultimodalLayoutHints = {
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
type PosterCopyDeck = {
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
type PosterCtaStyle = {
  variant: PosterCtaVariant
  emphasis: 'soft' | 'balanced' | 'strong'
  shape: 'rounded' | 'square' | 'capsule'
  placement: PosterCtaPlacement
  tone: PosterCtaTone
  iconHint: PosterCtaIconHint
  widthMode: PosterCtaWidthMode
}
type PosterQualityIssue = {
  code: string
  message: string
  level: 'error' | 'warn'
}
type PosterQualityReport = {
  pass: boolean
  score: number
  needsRefine: boolean
  issues: PosterQualityIssue[]
  failureTags?: string[]
}
type PosterAbsoluteLayoutLayer = {
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
type PosterAbsoluteLayout = {
  version: 'v1'
  layers: PosterAbsoluteLayoutLayer[]
}
type CutoutSourceKind = 'direct-static' | 'dashscope-oss' | 'tmpfiles'
type DashScopeUploadPolicy = {
  policy: string
  signature: string
  upload_dir: string
  upload_host: string
  expire_in_seconds: number
  max_file_size_mb: number
  capacity_limit_mb: number
  oss_access_key_id: string
  x_oss_object_acl: string
  x_oss_forbid_overwrite: string
}
type PosterGenerateResult = CopyResult & {
  palette: PosterPalette
  background: PosterImageResult
  hero: PosterImageResult
  recommendedTemplate: any
  recommendedTemplates?: any[]
  templateCandidates?: any[]
  designPlan?: {
    industry: string
    tone: string
    layoutFamily: string
    density: 'light' | 'balanced' | 'dense'
    heroStrategy: 'product' | 'person' | 'scene' | 'editorial'
    ctaStrength: 'soft' | 'balanced' | 'strong'
    qrStrategy: 'none' | 'corner' | 'cta'
    ctaStyle?: PosterCtaStyle
    textStrategy?: 'clean' | 'outline' | 'panel'
    backgroundTone?: 'light' | 'dark' | 'mixed'
    contentPattern?: PosterContentPattern
    emphasisOrder?: PosterEmphasisRole[]
    templateCandidates: any[]
    absoluteLayout?: PosterAbsoluteLayout
  }
  posterIntent?: PosterIntent
  copyDeck?: PosterCopyDeck
  multimodalLayoutHints?: PosterMultimodalLayoutHints
  qualityHints?: string[]
  qualityReport?: PosterQualityReport
  size: SizePreset
  providerMeta: Record<string, AiProviderMeta>
}

type PosterProtocolSuggestion = {
  posterIntent?: Partial<PosterIntent>
  copyDeck?: Partial<PosterCopyDeck>
}

type RelayoutResult = {
  designPlan: PosterGenerateResult['designPlan']
  providerMeta: AiProviderMeta
}

const DEFAULT_BAILIAN_CHAT_TIMEOUT = 90000
const DEFAULT_BAILIAN_IMAGE_TIMEOUT = 60000
const BAILIAN_RETRY_TIMES = 3
const BAILIAN_REQUIRED_IMAGE_RETRY_TIMES = 3
const HIGH_TEXT_RISK_SCENE_RETRY_TIMES = 1
const DEFAULT_POSTER_DRAFT_RETRY_TIMES = 0
const DEFAULT_BAILIAN_IMAGE_COOLDOWN_MS = 0
const DEFAULT_BAILIAN_IMAGE_MAX_CONCURRENCY = 3
let bailianImageActiveCount = 0
const bailianImageWaiters: Array<() => void> = []
let lastBailianImageRequestAt = 0
let viapiImagesegClientPromise: Promise<any> | null = null
let viapiAsyncClientPromise: Promise<any> | null = null
const dashScopeUploadPolicyCache = new Map<string, { expiresAt: number; data: DashScopeUploadPolicy }>()

const sizeMap: Record<string, SizePreset> = {
  a4: { key: 'a4', name: 'A4 竖版', width: 2480, height: 3508 },
  'wechat-cover': { key: 'wechat-cover', name: '公众号封面', width: 900, height: 383 },
  xiaohongshu: { key: 'xiaohongshu', name: '小红书封面', width: 1242, height: 1660 },
  moments: { key: 'moments', name: '朋友圈海报', width: 1242, height: 2208 },
  ecommerce: { key: 'ecommerce', name: '电商主图', width: 800, height: 800 },
  flyer: { key: 'flyer', name: '宣传单页', width: 1125, height: 2001 },
}
const DEFAULT_INDUSTRY = '活动'
const paletteByIndustry: Record<string, PosterPalette> = {
  电商: { background: '#FFF4E6', surface: '#FFFFFF', primary: '#FF8157', secondary: '#FFD1BE', text: '#1F2937', muted: '#8C4A34', swatches: ['#FFF4E6', '#FFD1BE', '#FF8157', '#1F2937'] },
  招聘: { background: '#F5FAFF', surface: '#FFFFFF', primary: '#246BFD', secondary: '#D7E8FF', text: '#102A43', muted: '#486581', swatches: ['#F5FAFF', '#D7E8FF', '#246BFD', '#102A43'] },
  活动: { background: '#FFF1F2', surface: '#FFFFFF', primary: '#E11D48', secondary: '#FFD6E0', text: '#3F1020', muted: '#9F1239', swatches: ['#FFF1F2', '#FFD6E0', '#FB7185', '#3F1020'] },
  课程: { background: '#FAF5FF', surface: '#FFFFFF', primary: '#6D28D9', secondary: '#E9D5FF', text: '#2E1065', muted: '#5B21B6', swatches: ['#FAF5FF', '#E9D5FF', '#C084FC', '#2E1065'] },
  节日: { background: '#FFF7ED', surface: '#FFFFFF', primary: '#EA580C', secondary: '#FED7AA', text: '#431407', muted: '#9A3412', swatches: ['#FFF7ED', '#FED7AA', '#FB923C', '#431407'] },
  健身: { background: '#07111F', surface: '#101C2F', primary: '#F4C86A', secondary: '#1C8C5A', text: '#F8FAFC', muted: '#D7E1EE', swatches: ['#07111F', '#101C2F', '#F4C86A', '#1C8C5A', '#F8FAFC'] },
  餐饮: { background: '#FFFBEB', surface: '#FFFFFF', primary: '#D97706', secondary: '#FDE68A', text: '#422006', muted: '#92400E', swatches: ['#FFFBEB', '#FDE68A', '#F59E0B', '#422006'] },
}

function getEnv(name: string, fallback = '') { return String(process.env[name] || fallback || '').trim() }
function getEnvNumber(name: string, fallback: number) {
  const value = Number(getEnv(name, String(fallback)))
  return Number.isFinite(value) && value > 0 ? value : fallback
}
function getBailianOrigin() { return getEnv('AI_BAILIAN_BASE_URL', 'https://dashscope.aliyuncs.com').replace(/\/$/, '').replace(/\/compatible-mode\/v1$/, '').replace(/\/api\/v1$/, '') }
function getCompatibleBaseUrl() { return `${getBailianOrigin()}/compatible-mode/v1` }
function getApiBaseUrl() { return `${getBailianOrigin()}/api/v1` }
function getBailianApiKey() { return getEnv('AI_BAILIAN_API_KEY') }
function getViapiAccessKeyId() { return getEnv('AI_VIAPI_ACCESS_KEY_ID', getEnv('ALIBABA_CLOUD_ACCESS_KEY_ID')) }
function getViapiAccessKeySecret() { return getEnv('AI_VIAPI_ACCESS_KEY_SECRET', getEnv('ALIBABA_CLOUD_ACCESS_KEY_SECRET')) }
function getViapiRegion() { return getEnv('AI_VIAPI_REGION', 'cn-shanghai') }
function getViapiImagesegEndpoint() { return getEnv('AI_VIAPI_IMAGESEG_ENDPOINT', `imageseg.${getViapiRegion()}.aliyuncs.com`) }
function getViapiAsyncEndpoint() { return getEnv('AI_VIAPI_ASYNC_ENDPOINT', `viapi.${getViapiRegion()}.aliyuncs.com`) }
function getViapiCutoutMode() { return getEnv('AI_VIAPI_CUTOUT_MODE', 'common-first').toLowerCase() }
function getBailianChatTimeoutMs() { return getEnvNumber('AI_BAILIAN_CHAT_TIMEOUT_MS', DEFAULT_BAILIAN_CHAT_TIMEOUT) }
function getDraftChatTimeoutMs() { return getEnvNumber('AI_POSTER_DRAFT_CHAT_TIMEOUT_MS', 40000) }
function getRefineChatTimeoutMs() { return getEnvNumber('AI_POSTER_REFINE_CHAT_TIMEOUT_MS', 45000) }
function getDraftStageChatTimeoutMs(stage: 'copy' | 'palette' | 'relayout', generationMode: PosterGenerationMode) {
  if (generationMode === 'fast') {
    const fastDefaults = {
      copy: 38000,
      palette: 22000,
      relayout: 24000,
    }
    const envNames = {
      copy: 'AI_POSTER_FAST_COPY_TIMEOUT_MS',
      palette: 'AI_POSTER_FAST_PALETTE_TIMEOUT_MS',
      relayout: 'AI_POSTER_FAST_RELAYOUT_TIMEOUT_MS',
    } as const
    return getEnvNumber(envNames[stage], fastDefaults[stage])
  }
  const qualityDefaults = {
    copy: 70000,
    palette: 32000,
    relayout: 50000,
  }
  const envNames = {
    copy: 'AI_POSTER_QUALITY_COPY_TIMEOUT_MS',
    palette: 'AI_POSTER_QUALITY_PALETTE_TIMEOUT_MS',
    relayout: 'AI_POSTER_QUALITY_RELAYOUT_TIMEOUT_MS',
  } as const
  return getEnvNumber(envNames[stage], qualityDefaults[stage])
}
function getBailianImageTimeoutMs() { return getEnvNumber('AI_BAILIAN_IMAGE_TIMEOUT_MS', DEFAULT_BAILIAN_IMAGE_TIMEOUT) }
function getBailianTaskPollIntervalMs() { return getEnvNumber('AI_BAILIAN_TASK_POLL_INTERVAL_MS', 1200) }
function getBailianTaskMaxPolls() { return getEnvNumber('AI_BAILIAN_TASK_MAX_POLLS', 45) }
function getPosterDraftRetryTimes() { return getEnvNumber('AI_POSTER_DRAFT_RETRY_TIMES', DEFAULT_POSTER_DRAFT_RETRY_TIMES + 1) - 1 }
function getDraftChatRetryTimes() { return Math.max(0, getEnvNumber('AI_POSTER_DRAFT_CHAT_RETRY_TIMES', 1) - 1) }
function getRefineChatRetryTimes() { return Math.max(0, getEnvNumber('AI_POSTER_REFINE_CHAT_RETRY_TIMES', 1) - 1) }
function getDraftStageChatRetryTimes(stage: 'copy' | 'palette' | 'relayout', generationMode: PosterGenerationMode) {
  if (generationMode === 'fast') {
    const fastDefaults = {
      copy: 0,
      palette: 0,
      relayout: 0,
    }
    const envNames = {
      copy: 'AI_POSTER_FAST_COPY_RETRY_TIMES',
      palette: 'AI_POSTER_FAST_PALETTE_RETRY_TIMES',
      relayout: 'AI_POSTER_FAST_RELAYOUT_RETRY_TIMES',
    } as const
    return Math.max(0, getEnvNumber(envNames[stage], fastDefaults[stage] + 1) - 1)
  }
  const qualityDefaults = {
    copy: 1,
    palette: 0,
    relayout: 0,
  }
  const envNames = {
    copy: 'AI_POSTER_QUALITY_COPY_RETRY_TIMES',
    palette: 'AI_POSTER_QUALITY_PALETTE_RETRY_TIMES',
    relayout: 'AI_POSTER_QUALITY_RELAYOUT_RETRY_TIMES',
  } as const
  return Math.max(0, getEnvNumber(envNames[stage], qualityDefaults[stage] + 1) - 1)
}
function getStageTimeoutMs(stage: 'copy' | 'palette' | 'relayout', generationMode: PosterGenerationMode, mode: 'draft' | 'refine') {
  if (mode === 'draft') return getDraftStageChatTimeoutMs(stage, generationMode)
  if (generationMode === 'fast') return Math.max(getRefineChatTimeoutMs(), getDraftStageChatTimeoutMs(stage, generationMode))
  return getRefineChatTimeoutMs()
}
function getStageRetryTimes(stage: 'copy' | 'palette' | 'relayout', generationMode: PosterGenerationMode, mode: 'draft' | 'refine') {
  if (mode === 'draft') return getDraftStageChatRetryTimes(stage, generationMode)
  if (generationMode === 'fast') return Math.max(getRefineChatRetryTimes(), getDraftStageChatRetryTimes(stage, generationMode))
  return getRefineChatRetryTimes()
}
function getMultimodalLayoutTimeoutMs(generationMode: PosterGenerationMode) {
  return generationMode === 'fast'
    ? getEnvNumber('AI_FAST_MULTIMODAL_LAYOUT_TIMEOUT_MS', 26000)
    : getEnvNumber('AI_MULTIMODAL_LAYOUT_TIMEOUT_MS', getDraftChatTimeoutMs())
}
function getMultimodalLayoutRetryTimes(generationMode: PosterGenerationMode) {
  return generationMode === 'fast'
    ? Math.max(0, getEnvNumber('AI_FAST_MULTIMODAL_LAYOUT_RETRY_TIMES', 1) - 1)
    : Math.max(0, getEnvNumber('AI_MULTIMODAL_LAYOUT_RETRY_TIMES', 1))
}
function getCutoutTaskPollIntervalMs() { return getEnvNumber('AI_CUTOUT_TASK_POLL_INTERVAL_MS', 1500) }
function getCutoutTaskMaxPolls() { return getEnvNumber('AI_CUTOUT_TASK_MAX_POLLS', 120) }
function getCutoutTaskRetryTimes() { return getEnvNumber('AI_CUTOUT_TASK_RETRY_TIMES', 1) }
function getCutoutUploadMaxSide() { return getEnvNumber('AI_CUTOUT_UPLOAD_MAX_SIDE', 2048) }
function getCutoutUploadSizeLimitMb() { return getEnvNumber('AI_CUTOUT_UPLOAD_SIZE_LIMIT_MB', 3) }
function getCutoutUploadJpegQuality() { return getEnvNumber('AI_CUTOUT_UPLOAD_JPEG_QUALITY', 88) }
function getRembgModelName() { return getEnv('AI_CUTOUT_REMBG_MODEL', 'isnet-general-use') }
function getBackgroundModelVersion() { return getEnv('AI_BACKGROUND_MODEL_VERSION', 'v3') }
function useFastBackgroundGeneration() { return getEnv('AI_FAST_BACKGROUND_MODE', 'true').toLowerCase() !== 'false' }
/** 默认开启：百炼 prompt 延展，主图/背景更富氛围（可用 AI_POSTER_IMAGE_PROMPT_EXTEND=false 关闭） */
function imagePromptExtendEnabled() { return getEnv('AI_POSTER_IMAGE_PROMPT_EXTEND', 'true').toLowerCase() !== 'false' }
function supportsPromptExtend(model: string) { return !/^wan2\.7-image-pro$/i.test(String(model || '').trim()) }
function normalizeGenerationMode(raw: unknown): PosterGenerationMode { return String(raw || '').trim().toLowerCase() === 'fast' ? 'fast' : 'quality' }
function getProviderModel(stage: AiStage, generationMode: PosterGenerationMode = 'quality') {
  const qualityDefs = {
    copy: 'qwen3.6-plus',
    palette: 'qwen3.6-plus',
    image: 'wan2.7-image-pro',
    background: 'wanx-background-generation-v2',
    imageEdit: 'wan2.7-image-pro',
    relayout: 'qwen3.6-plus',
    multimodalLayout: 'qwen-vl-max-latest',
    cutout: 'image-instance-segmentation',
  } as Record<AiStage, string>
  const fastDefs = {
    copy: 'qwen3.6-flash',
    palette: 'qwen3.6-flash',
    image: 'wan2.7-image',
    background: 'wan2.7-image',
    imageEdit: 'wan2.7-image',
    relayout: 'qwen3.6-flash',
    multimodalLayout: 'qwen-vl-plus-latest',
    cutout: 'image-instance-segmentation',
  } as Record<AiStage, string>
  const qualityEnvs = {
    copy: 'AI_COPY_MODEL',
    palette: 'AI_PALETTE_MODEL',
    image: 'AI_IMAGE_MODEL',
    background: 'AI_BACKGROUND_MODEL',
    imageEdit: 'AI_IMAGE_EDIT_MODEL',
    relayout: 'AI_RELAYOUT_MODEL',
    multimodalLayout: 'AI_MULTIMODAL_LAYOUT_MODEL',
    cutout: 'AI_CUTOUT_MODEL',
  } as Record<AiStage, string>
  const fastEnvs = {
    copy: 'AI_FAST_COPY_MODEL',
    palette: 'AI_FAST_PALETTE_MODEL',
    image: 'AI_FAST_IMAGE_MODEL',
    background: 'AI_FAST_BACKGROUND_MODEL',
    imageEdit: 'AI_FAST_IMAGE_EDIT_MODEL',
    relayout: 'AI_FAST_RELAYOUT_MODEL',
    multimodalLayout: 'AI_FAST_MULTIMODAL_LAYOUT_MODEL',
    cutout: 'AI_CUTOUT_MODEL',
  } as Record<AiStage, string>
  const envs = generationMode === 'fast' ? fastEnvs : qualityEnvs
  const defs = generationMode === 'fast' ? fastDefs : qualityDefs
  return getEnv(envs[stage], defs[stage])
}
function getProviderMeta(stage: AiStage, overrides: Partial<AiProviderMeta>, generationMode: PosterGenerationMode = 'quality'): AiProviderMeta { return { provider: overrides.provider || 'aliyun-bailian', model: overrides.model || getProviderModel(stage, generationMode), isMockFallback: Boolean(overrides.isMockFallback), message: overrides.message || '' } }
function buildStrictProviderError(stage: string, error: unknown) { return `真实 AI ${stage}失败：${(error as Error)?.message || String(error || 'unknown error')}` }
function ensureBailianReady(stage: AiStage, generationMode: PosterGenerationMode = 'quality') { const apiKey = getBailianApiKey(); const model = getProviderModel(stage, generationMode); if (!apiKey || !model) throw new Error(`${stage} provider config missing`); return { apiKey, model } }
function hasViapiCutoutReady() { return Boolean(getViapiAccessKeyId() && getViapiAccessKeySecret()) }
function ensureViapiReady() {
  const accessKeyId = getViapiAccessKeyId()
  const accessKeySecret = getViapiAccessKeySecret()
  if (!accessKeyId || !accessKeySecret) throw new Error('viapi cutout provider config missing')
  return { accessKeyId, accessKeySecret }
}
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) }
function formatElapsedSeconds(ms: number) {
  return Math.max(1, Math.round(ms / 1000))
}
function isCutoutMediaInspectionError(error: unknown) {
  const message = String((error as any)?.message || error || '')
  const low = message.toLowerCase()
  return low.includes('invalidparameter.datainspection') || low.includes('failed to find the requested media resource during the data inspection process')
}
/** 缺省 true；兼容字符串 "false" 等，避免网关/表单把布尔量转成字符串后主图开关失效 */
function normalizeGenerateHeroImage(raw: unknown): boolean {
  if (raw === undefined || raw === null) return true
  if (raw === false || raw === 0) return false
  if (raw === true || raw === 1) return true
  if (typeof raw === 'string') {
    const s = raw.trim().toLowerCase()
    if (s === 'false' || s === '0' || s === 'no' || s === 'off') return false
    if (s === 'true' || s === '1' || s === 'yes' || s === 'on') return true
  }
  return true
}
function normalizeInput(body: any): PosterGenerateInput {
  return {
    presetKey: String(body.presetKey || '').trim(),
    theme: String(body.theme || '').trim(),
    purpose: String(body.purpose || '').trim(),
    sizeKey: String(body.sizeKey || 'xiaohongshu').trim(),
    style: String(body.style || '').trim(),
    industry: String(body.industry || DEFAULT_INDUSTRY).trim(),
    content: String(body.content || '').trim(),
    qrUrl: String(body.qrUrl || '').trim(),
    generationMode: normalizeGenerationMode(body.generationMode),
    sourceImageUrl: String(body.sourceImageUrl || '').trim(),
    baseImageUrl: String(body.baseImageUrl || '').trim(),
    generateHeroImage: normalizeGenerateHeroImage(body.generateHeroImage),
    generateBackgroundImage: normalizeGenerateHeroImage(body.generateBackgroundImage),
  }
}
function pickThemeCore(theme: string, industry: string) {
  const raw = String(theme || industry || 'AI 海报').trim().replace(/[，,。；;：:]/g, ' ')
  if (!raw) return 'AI 海报'
  const compact = raw.replace(/\s+/g, '')
  return compact.length > 10 ? compact.slice(0, 10) : compact
}
function normalizePosterText(value: unknown) {
  return String(value || '')
    .replace(/\s*([｜|/，,。；;：:+])\s*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}
function trimPosterTrailingNoise(value: string) {
  return String(value || '')
    .replace(/[｜|/，,。；;：:+·•\s-]+$/g, '')
    .replace(/[的了和与及并或在为让把将从向对给需可会能等着而其但突提系营报招课训设运销活]$/u, '')
    .trim()
}
function softClipPosterText(value: string, max: number) {
  const normalized = normalizePosterText(value)
  if (!normalized) return ''
  if (normalized.length <= max) return normalized
  const tolerance = max <= 8 ? 0 : max <= 14 ? 2 : 6
  const boundaryPattern = /[｜|/，,。；;：:\s]/g
  let boundary = -1
  for (const match of normalized.matchAll(boundaryPattern)) {
    const index = Number(match.index)
    if (index <= max && index >= Math.floor(max * 0.55)) boundary = index
    if (index > max) {
      if (index <= max + tolerance) return trimPosterTrailingNoise(normalized.slice(0, index))
      break
    }
  }
  if (boundary >= 0) return trimPosterTrailingNoise(normalized.slice(0, boundary))
  return trimPosterTrailingNoise(normalized.slice(0, max))
}
function clipPosterText(value: string, max = 18) {
  return softClipPosterText(String(value || ''), max)
}
const POSTER_BODY_SEGMENT_LIMIT = 5
function extractFactValueFromSegments(segments: string[], keys: string[]) {
  for (const segment of segments) {
    const safe = String(segment || '').trim()
    if (!safe) continue
    for (const key of keys) {
      const match = safe.match(new RegExp(`(?:${key})[：:\\s]*([^｜|；;，,。]+)`))
      if (match?.[1]) return clipPosterText(match[1], 18)
    }
  }
  return ''
}
function stripThemeEcho(value: string, theme: string) {
  const safe = String(value || '').trim()
  const themeSafe = String(theme || '').replace(/\s+/g, '').trim()
  if (!safe || !themeSafe) return safe
  return safe.replace(new RegExp(themeSafe, 'g'), '').replace(/\s+/g, ' ').trim()
}
function stripSelectionEcho(value: string) {
  return String(value || '')
    .replace(/^(引流|促销|报名|招聘|上新|品牌宣传|活动预告|课程推广|门店导流|直播预告|会员招募|周年庆|公益倡导|产品发布|节日祝福)$/u, '')
    .replace(/^(电商|招聘|活动|课程|节日|健身|餐饮|美妆|母婴|地产|金融|科技互联网|旅游|汽车|政务公益)$/u, '')
    .trim()
}
function sanitizeFactFragment(value: string, kind: 'audience' | 'benefit' | 'place' | 'time' | 'price') {
  let safe = String(value || '').trim()
  if (!safe) return ''
  if (kind === 'audience') {
    safe = safe.replace(/^(适合|面向|针对|对象|人群)[：:\s]*/u, '').trim()
    if (/^(适合|人群|对象|受众)$/u.test(safe)) return ''
  }
  if (kind === 'place') {
    safe = safe.replace(/^(地点|地址|门店|校区|会场)[：:\s]*/u, '').trim()
  }
  if (kind === 'benefit') {
    safe = safe.replace(/^(福利|亮点|权益|卖点|内容|课程亮点)[：:\s]*/u, '').trim()
  }
  if (kind === 'price') {
    safe = safe.replace(/^(薪资|价格|到手价|现价|活动价|优惠价|券后|仅需)[：:\s]*/u, '').trim()
  }
  return stripSelectionEcho(safe)
}
function collectPosterFacts(input: PosterGenerateInput) {
  const raw = [input.content, input.theme].filter(Boolean).join(' ｜ ')
  const segments = String(raw || '')
    .split(/[\n|｜/；;•·,，。]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => stripSelectionEcho(item))
    .filter(Boolean)
  const joined = segments.join(' ')
  const themeCore = String(input.theme || '').replace(/\s+/g, '').trim()
  const labelledTime = extractFactValueFromSegments(segments, ['时间', '日期', '档期', '开班', '上课'])
  const labelledPlace = extractFactValueFromSegments(segments, ['地点', '地址', '门店', '校区', '会场', '城市'])
  const labelledAudience = extractFactValueFromSegments(segments, ['适合', '面向', '针对', '对象', '人群'])
  const labelledBenefit = extractFactValueFromSegments(segments, ['福利', '亮点', '权益', '卖点', '内容', '课程亮点'])
  const labelledPrice = extractFactValueFromSegments(segments, ['薪资', '价格', '到手价', '现价', '活动价', '优惠价', '券后', '仅需'])
  const facts = {
    time: clipPosterText(sanitizeFactFragment((labelledTime || joined.match(/(?:\d{1,2}月\d{1,2}日(?:\s*[-~至到]\s*\d{1,2}月\d{1,2}日)?|\d{1,2}[:：]\d{2}(?:\s*[-~至到]\s*\d{1,2}[:：]\d{2})?|今日|本周|周末|限时|限量|限前\d+名|21天|30天)/)?.[0] || ''), 'time'), 14),
    price: clipPosterText(sanitizeFactFragment((labelledPrice || joined.match(/(?:￥|¥)\s*\d{1,4}(?:\.\d{1,2})?(?:起|元)?|(?<!\d)\d{1,4}(?:\.\d{1,2})?\s*元(?:起)?|(?:\d{1,2}K\s*-\s*\d{1,2}K)|(?:到手价|活动价|现价|仅需|券后)\s*\d{1,4}|(?:买一送一|第二件半价|第二份半价|立减\s*\d{1,4}\s*元?|直降\s*\d{1,4}\s*元?|新人专享|包邮|打卡返现)/i)?.[0] || ''), 'price'), 16),
    place: clipPosterText(sanitizeFactFragment((labelledPlace || joined.match(/(?:到店|到场|线上|线下|直播间|会场|校区|门店|展位|地址|杭州|上海|北京|广州|深圳)[^\n，。,；;|｜/]{0,12}/)?.[0] || ''), 'place'), 16),
    audience: clipPosterText(stripThemeEcho(sanitizeFactFragment(labelledAudience || joined.match(/(?:适合|面向|针对|久坐上班族|大学生|转行人群|1-3年经验)[^\n，。,；;|｜/]{0,14}/)?.[0] || '', 'audience'), themeCore), 16),
    benefit: clipPosterText(stripThemeEcho(sanitizeFactFragment(labelledBenefit || joined.match(/(?:五险一金|双休|包吃住|可兼职|免费试听|双师带练|项目实战|私教带练|打卡返现|当天发货|新品首发|人气招牌|福利加码|爆款主推|限时报名|落日市集|乐队演出|露营体验|外酥里嫩|现炸现卖|第二份半价)/)?.[0] || '', 'benefit'), themeCore), 16),
  }
  return { segments, facts }
}
function extractRecruitmentRoles(input: PosterGenerateInput) {
  const joined = `${input.theme || ''} ${input.content || ''}`.replace(/[，。,；;：:]/g, ' ')
  const roleMatches = Array.from(joined.matchAll(/(店长|副店长|咖啡师|运营助理|招商主管|招商主管理|招商主管助理|导购|收银|服务员|营业员|招商主管|招商主管理|招商主管助理|招商主管专员|招商主管顾问|门店运营|招商主管|招商主管理|招商主管助理|招商主管专员|招商主管顾问|招商主管经理|销售顾问|招商主管招商主管|招商主管理|助教|讲师|课程顾问|主播|剪辑师|设计师|招商主管理助理|招商主管招商主管经理)/g)).map((item) => item[1])
  const unique = roleMatches.filter((item, index, arr) => item && arr.indexOf(item) === index)
  return unique.slice(0, 3)
}
function buildRecruitmentRoleLine(input: PosterGenerateInput, fallback = '') {
  const roles = extractRecruitmentRoles(input)
  const combined = roles.join(' / ')
  return compactDeckLine(combined, 18, fallback)
}
function buildRecruitmentBenefitLine(input: PosterGenerateInput, facts: ReturnType<typeof collectPosterFacts>['facts'], copy: CopyResult) {
  const segments = normalizeCopySegments([
    facts.benefit,
    ...normalizeCopySegments(copy.proofPoints?.length ? copy.proofPoints : copy.body, 5),
    input.content,
    facts.price,
  ], 6)
  const picked = segments.find((item) => /五险一金|双休|包吃住|带薪|晋升|培训|排班|弹性|补贴|社保|年假|住宿|餐补|交通补|零经验|应届|带教/.test(item))
  if (picked || facts.benefit) return compactDeckLine(picked || facts.benefit || '', 18, '')
  const joined = `${input.theme || ''} ${input.content || ''}`
  const placeholders = [
    /兼职|小时工/.test(joined) ? '排班灵活 / 时段可协商' : '',
    /咖啡|轻食|餐饮|门店/.test(joined) ? '带教培训 / 晋升通道' : '',
    '带教培训 / 晋升通道清晰',
  ].filter(Boolean)
  return compactDeckLine(placeholders[0] || placeholders[1] || '', 18, '')
}
function buildMissingCommerceLikeOffer(intent: PosterIntent, input: PosterGenerateInput, facts: ReturnType<typeof collectPosterFacts>['facts']) {
  if (facts.price) return compactDeckLine(facts.price, 18, '')
  if (intent.scene === 'food') {
    const joined = `${input.theme || ''} ${input.content || ''}`
    if (/咖啡|茶饮/.test(joined)) return compactDeckLine('到店尝鲜 / 第二杯更划算', 18, '')
    if (/轻食|沙拉|能量碗|低卡/.test(joined)) return compactDeckLine('尝鲜套餐 / 轻负担更满足', 18, '')
    return compactDeckLine('到店尝鲜 / 限时礼遇', 18, '')
  }
  return compactDeckLine('限时礼遇 / 下单加赠', 18, '')
}
function buildMissingCommerceLikeUrgency(intent: PosterIntent, input: PosterGenerateInput, facts: ReturnType<typeof collectPosterFacts>['facts']) {
  if (facts.time) return compactDeckLine(facts.time, 16, '')
  if (intent.scene === 'food') return compactDeckLine('本周到店更划算', 16, '')
  if (/上新|新品/.test(`${input.theme || ''} ${input.content || ''}`)) return compactDeckLine('新品期内可优先体验', 16, '')
  return compactDeckLine('限时开放 / 先到先享', 16, '')
}
function buildPlaceholderPriceBlock(intent: PosterIntent, input: PosterGenerateInput, copy: CopyResult): PosterPriceBlock | null {
  if (!['commerce', 'food', 'festival'].includes(intent.scene)) return null
  const joined = `${input.theme || ''} ${input.content || ''} ${copy.offerLine || ''} ${copy.urgencyLine || ''}`
  if (intent.scene === 'food') {
    return {
      tag: compactDeckLine(/咖啡|茶饮/.test(joined) ? '到店礼遇' : '尝鲜推荐', 6, '尝鲜推荐'),
      value: compactDeckLine(/套餐|组合/.test(joined) ? '套餐更划算' : '到店尝鲜', 12, '到店尝鲜'),
      suffix: '',
      note: compactDeckLine(copy.urgencyLine || '门店活动以实际为准', 16, '门店活动以实际为准'),
    }
  }
  return {
    tag: compactDeckLine(/礼盒|组合|套装/.test(joined) ? '组合礼遇' : '限时礼遇', 6, '限时礼遇'),
    value: compactDeckLine(/赠|加码/.test(joined) ? '下单加赠' : '咨询现价', 12, '咨询现价'),
    suffix: '',
    note: compactDeckLine(copy.urgencyLine || '库存与活动以页面为准', 16, '库存与活动以页面为准'),
  }
}
function buildRecruitmentAudienceHint(input: PosterGenerateInput, facts: ReturnType<typeof collectPosterFacts>['facts']) {
  const joined = `${input.content || ''} ${input.theme || ''} ${facts.audience || ''}`.replace(/\s+/g, '')
  const picks: string[] = []
  if (/应届/.test(joined)) picks.push('应届可投')
  if (/零经验|无经验|小白/.test(joined)) picks.push('零经验可投')
  if (/兼职/.test(joined)) picks.push('兼职可投')
  if (/全职/.test(joined)) picks.push('全职优先')
  if (/门店经验|有经验|熟手/.test(joined)) picks.push('门店经验优先')
  if (/热爱咖啡|咖啡爱好者/.test(joined)) picks.push('咖啡爱好者')
  if (/转行/.test(joined)) picks.push('转行也友好')
  if (/服务意识|沟通/.test(joined)) picks.push('沟通服务佳')
  const unique = picks.filter((item, index, arr) => item && arr.indexOf(item) === index)
  if (unique.length) return compactDeckLine(unique.slice(0, 2).join(' / '), 18, '')
  return compactDeckLine(stripThemeEcho(facts.audience || '', input.theme), 18, '')
}
function buildRecruitmentRoleHint(input: PosterGenerateInput, facts: ReturnType<typeof collectPosterFacts>['facts'], copy: CopyResult) {
  const picked = normalizeCopySegments([
    copy.actionReason,
    facts.benefit,
    ...normalizeCopySegments(copy.proofPoints?.length ? copy.proofPoints : copy.body, 6),
    input.content,
  ], 6).find((item) => /培训|带教|晋升|成长|上手|通道|师徒|新人/.test(item))
  return compactDeckLine(picked || '系统培训 / 上手更快', 12, '系统培训 / 上手更快')
}
function buildRecruitmentSalaryHint(input: PosterGenerateInput, facts: ReturnType<typeof collectPosterFacts>['facts'], copy: CopyResult) {
  const picked = normalizeCopySegments([
    facts.benefit,
    copy.actionReason,
    ...normalizeCopySegments(copy.proofPoints?.length ? copy.proofPoints : copy.body, 6),
    input.content,
  ], 6).find((item) => /排班|双休|灵活|补贴|提成上不封顶|奖金|社保|五险/.test(item))
  return compactDeckLine(picked || '排班灵活 / 激励清晰', 12, '排班灵活 / 激励清晰')
}
function buildRecruitmentBenefitHint(input: PosterGenerateInput, facts: ReturnType<typeof collectPosterFacts>['facts'], copy: CopyResult) {
  const audience = buildRecruitmentAudienceHint(input, facts)
  if (audience) return compactDeckLine(audience, 12, '')
  const picked = normalizeCopySegments([
    facts.price,
    copy.offerLine,
    copy.urgencyLine,
    input.content,
  ], 5).find((item) => /应届|零经验|门店经验|兼职|全职/.test(item))
  return compactDeckLine(picked || '应届可投 / 经验优先', 12, '应届可投 / 经验优先')
}
function buildRecruitmentOfferLine(input: PosterGenerateInput, facts: ReturnType<typeof collectPosterFacts>['facts'], copy: CopyResult) {
  const compLine = buildRecruitmentCompLine(input, facts, copy)
  const benefitLine = buildRecruitmentBenefitLine(input, facts, copy)
  const joined = `${input.content || ''} ${copy.body || ''} ${copy.proofPoints?.join(' ') || ''}`
  const salaryShort = /底薪/.test(joined) || /提成/.test(joined) ? '底薪+提成' : (hasExplicitRecruitmentSalarySignal(compLine) ? compLine : '薪酬激励清晰')
  const benefitShort = /五险/.test(joined) || /社保/.test(joined) ? '五险保障' : (/培训|带教/.test(joined) ? '培训清晰' : '成长通道明确')
  const flexShort = /排班|弹性/.test(joined) ? '排班灵活' : (/晋升/.test(joined) ? '晋升可见' : '')
  const unique = [salaryShort, benefitShort, flexShort || compactDeckLine(benefitLine, 8, '')]
    .filter(Boolean)
    .filter((item, index, arr) => arr.findIndex((current) => canonicalCopyText(String(current || '')) === canonicalCopyText(String(item || ''))) === index)
  return compactDeckLine(unique.join('｜'), 22, '薪酬激励清晰｜培训清晰｜排班灵活')
}
function hasRecruitmentCompSignal(value: unknown) {
  return /薪资|底薪|高薪|面议|提成|奖金|补贴|社保|五险|公积金|餐补|住宿|年假|双休|排班|培训|晋升/.test(String(value || ''))
}
function hasExplicitRecruitmentSalarySignal(value: unknown) {
  return /薪资|底薪|高薪|面议|提成|奖金|补贴|月薪|时薪|K\b|k\b/.test(String(value || ''))
}
function buildRecruitmentCompLine(input: PosterGenerateInput, facts: ReturnType<typeof collectPosterFacts>['facts'], copy: CopyResult) {
  const segments = normalizeCopySegments([
    facts.price,
    copy.offerLine,
    copy.actionReason,
    copy.urgencyLine,
    ...normalizeCopySegments(copy.proofPoints?.length ? copy.proofPoints : copy.body, 6),
    input.content,
  ], 8)
  const joined = `${input.content || ''} ${copy.body || ''} ${copy.proofPoints?.join(' ') || ''}`
  if (/底薪/.test(joined) || /提成/.test(joined)) {
    if (/五险/.test(joined)) return compactDeckLine('底薪+提成｜五险保障', 18, '底薪+提成｜五险保障')
    return compactDeckLine('底薪+提成｜激励清晰', 18, '底薪+提成｜激励清晰')
  }
  const salaryPicked = segments.find((item) => hasExplicitRecruitmentSalarySignal(item))
  const picked = salaryPicked || segments.find((item) => hasRecruitmentCompSignal(item))
  if (picked) return compactDeckLine(picked, 18, '')
  if (/咖啡|轻食|餐饮|门店/.test(`${input.theme || ''} ${input.content || ''}`)) {
    return compactDeckLine('薪资面议 / 提成激励', 18, '薪资面议 / 提成激励')
  }
  return compactDeckLine('薪资福利可谈 / 支持沟通', 18, '薪资福利可谈 / 支持沟通')
}
function buildCourseAudienceHint(input: PosterGenerateInput, facts: ReturnType<typeof collectPosterFacts>['facts']) {
  const joined = `${input.content || ''} ${input.theme || ''}`
  const matched = joined.match(/设计师[^，。,；;|｜/]{0,10}|运营转型人群[^，。,；;|｜/]{0,6}|零基础[^，。,；;|｜/\s]{0,8}|副业人群[^，。,；;|｜/\s]{0,8}|新手[^，。,；;|｜/\s]{0,8}|转行[^，。,；;|｜/\s]{0,8}|运营[^，。,；;|｜/\s]{0,8}/)
  return compactDeckLine(stripThemeEcho(matched?.[0] || facts.audience || '', input.theme), 18, '')
}
function buildCourseOutcomeLine(input: PosterGenerateInput, facts: ReturnType<typeof collectPosterFacts>['facts'], copy: CopyResult) {
  const joined = `${input.content || ''} ${copy.slogan || ''} ${copy.body || ''}`
  const tokens = [
    /海报策划/.test(joined) ? '海报策划' : '',
    /排版/.test(joined) ? '排版提升' : '',
    /高转化文案|转化文案/.test(joined) ? '转化文案' : '',
    /作业点评|1对1优化|导师/.test(joined) ? '作业点评' : '',
    /案例/.test(joined) ? '案例实战' : '',
    /提示词/.test(joined) ? '提示词应用' : '',
  ].filter(Boolean)
  if (tokens.length >= 2) return compactDeckLine(tokens.slice(0, 3).join(' / '), 18, '')
  const segments = normalizeCopySegments([
    facts.benefit,
    copy.offerLine,
    ...normalizeCopySegments(copy.proofPoints?.length ? copy.proofPoints : copy.body, 5),
    input.content,
  ], 6)
  const clauseMatch = `${input.content || ''} ${copy.slogan || ''}`.match(/(?:\d+周)?直播[^，。,；;|｜/]{0,12}|作业点评[^，。,；;|｜/]{0,12}|案例库[^，。,；;|｜/]{0,10}|提示词模板[^，。,；;|｜/]{0,10}|实战[^，。,；;|｜/]{0,10}|陪跑[^，。,；;|｜/]{0,10}/)
  const picked = clauseMatch?.[0] || segments.find((item) => /起号|脚本|拍摄|剪辑|直播|转化|定位|变现|训练营|陪跑|诊断|实战|案例|提示词/.test(item))
  return compactDeckLine(stripThemeEcho(picked || facts.benefit || copy.offerLine || '', input.theme), 18, '')
}
function buildCourseSignupLine(input: PosterGenerateInput, facts: ReturnType<typeof collectPosterFacts>['facts'], copy: CopyResult) {
  const joined = `${copy.urgencyLine || ''} ${copy.offerLine || ''} ${input.content || ''}`
  if (/早鸟/.test(joined)) return compactDeckLine('早鸟报名中', 18, '早鸟报名中')
  if (/试听/.test(joined)) return compactDeckLine('试听预约中', 18, '试听预约中')
  const matched = joined.match(/早鸟[^，。,；;|｜/]{0,10}|限时报名[^，。,；;|｜/]{0,10}|立即报名[^，。,；;|｜/]{0,10}|抢占名额[^，。,；;|｜/]{0,10}|名额有限[^，。,；;|｜/]{0,10}/)
  return compactDeckLine(matched?.[0] || facts.time || copy.urgencyLine || '早鸟报名通道开启', 18, '早鸟报名通道开启')
}
function buildFitnessSignupValue(input: PosterGenerateInput, facts: ReturnType<typeof collectPosterFacts>['facts'], copy: CopyResult) {
  const joined = `${copy.urgencyLine || ''} ${copy.offerLine || ''} ${input.content || ''}`
  if (/体验价|试课/.test(joined)) return compactDeckLine('体验价报名中', 18, '体验价报名中')
  if (/限时|前\d+名|名额/.test(joined)) return compactDeckLine('限时报名中', 18, '限时报名中')
  return compactDeckLine(buildCourseSignupLine(input, facts, copy), 18, '立即开练')
}
function isSameCourseSupportTopic(left: string, right: string) {
  const a = String(left || '')
  const b = String(right || '')
  if (!a || !b) return false
  const topicGroups = [
    ['直播', '陪跑'],
    ['作业', '点评', '精批'],
    ['案例', '案例库'],
    ['提示词', '工作流'],
    ['实战', '变现'],
  ]
  return topicGroups.some((group) => group.some((token) => a.includes(token)) && group.some((token) => b.includes(token)))
}
function dedupeScenarioSegments(values: string[], fallback: string[]) {
  const merged: string[] = []
  const add = (value: string) => {
    const safe = clipPosterText(String(value || ''), 14)
    if (!safe) return
    const normalized = canonicalCopyText(safe)
    if (!normalized) return
    if (merged.some((item) => canonicalCopyText(item) === normalized)) return
    merged.push(safe)
  }
  values.forEach(add)
  fallback.forEach(add)
  return merged.slice(0, POSTER_BODY_SEGMENT_LIMIT)
}
function getCopyScenario(input: PosterGenerateInput) {
  const preset = String(input.presetKey || '').trim()
  if (preset === 'recruitment') return 'recruit'
  if (preset === 'course') return 'course'
  if (preset === 'festival') return 'festival'
  if (preset === 'food') return 'food'
  if (preset === 'fitness') return 'fitness'
  if (preset === 'campaign') return 'event'
  if (preset === 'commerce') return 'commerce'
  if (preset === 'xiaohongshu') return 'social'
  const text = `${input.theme || ''} ${input.industry || ''} ${input.purpose || ''} ${input.content || ''}`
  if (/招聘|招募/.test(text)) return 'recruit'
  if (/课程|教育|培训|报名/.test(text)) return 'course'
  if (/节日|庆典|假日|春节|新春|元宵|端午|中秋|国庆|圣诞|七夕|元旦/.test(text)) return 'festival'
  if (/活动|发布|展会|预告|露营|音乐节|生活节|市集|邀请函|周年庆|开业|快闪/.test(text)) return 'event'
  if (/餐饮|美食|咖啡|茶饮|轻食|沙拉|能量碗|food/i.test(text)) return 'food'
  if (/健身|运动|瑜伽|训练|塑形|燃脂|增肌/.test(text)) return 'fitness'
  if (/电商|零售|商品|上新|促销|抢购|礼盒|新品/.test(text)) return 'commerce'
  if (/小红书|笔记|种草|探店|攻略|合集|分享|打卡|测评|开箱/.test(text)) return 'social'
  return 'generic'
}
function reconcilePosterScene(baseScene: PosterScene, suggestedScene: PosterScene | null) {
  if (!suggestedScene || suggestedScene === baseScene) return baseScene
  if (baseScene === 'festival' && suggestedScene === 'event') return baseScene
  if (baseScene === 'fitness' && suggestedScene === 'social') return baseScene
  if (baseScene === 'course' && suggestedScene === 'social') return baseScene
  if (baseScene === 'food' && (suggestedScene === 'social' || suggestedScene === 'event')) return baseScene
  if (baseScene === 'commerce' && (suggestedScene === 'social' || suggestedScene === 'event')) return baseScene
  if (baseScene === 'recruitment' && suggestedScene === 'social') return baseScene
  if (baseScene === 'event' && suggestedScene === 'social') return baseScene
  return suggestedScene
}
function buildSceneCopyDirective(input: PosterGenerateInput) {
  switch (getCopyScenario(input)) {
    case 'commerce':
      return [
        '电商专项：标题要像真正会卖货的广告 headline，优先突出爆点、利益点、优惠触发或购买理由。',
        '电商 slogan 不能空喊氛围，必须补足使用场景、产品组合价值、适合人群或购买理由。',
        '电商 body 的 5 个信息点优先写成：核心卖点、优惠时机、适用人群/场景、价格/赠品/权益、稀缺或下单触发。',
        '电商 CTA 优先使用“立即抢购 / 领取优惠 / 马上下单 / 立即加购”这类真实成交动作。'
      ].join('\n')
    case 'food':
      return [
        '餐饮专项：标题第一眼就要勾起食欲或到店冲动，不能只是“新品上线”。',
        '餐饮 slogan 要补足口味记忆点、到店理由、限定时机或人群场景。',
        '餐饮 body 的 5 个信息点优先写成：招牌风味、供应时段、门店/到店信息、套餐/赠饮/优惠、行动触发。',
        '餐饮 CTA 优先使用“到店尝鲜 / 立即下单 / 门店预订 / 现在抢鲜”这类动作。'
      ].join('\n')
    case 'recruit':
      return [
        '招聘专项：标题必须带出岗位价值、成长机会或团队气质，不要做成普通招聘口号。',
        '招聘 slogan 要让候选人知道为什么值得投，不要只写企业愿景。',
        '招聘 body 的 5 个信息点优先写成：岗位方向、到岗/面试时间、城市/地点、福利制度、投递窗口。',
        '招聘 CTA 优先使用“立即投递 / 投递简历 / 预约面谈 / 马上报名”。'
      ].join('\n')
    case 'course':
      return [
        '课程专项：标题要明确学习价值或结果预期，不能只是“火热招生”。',
        '课程 slogan 必须补足适合谁学、能拿到什么结果、为什么值得现在报名。',
        '课程 body 的 5 个信息点优先写成：学习结果、人群、开班/课时、福利/试听/资料、报名触发。',
        '课程 CTA 优先使用“立即报名 / 领取试听 / 抢占名额 / 预约咨询”。'
      ].join('\n')
    case 'social':
      return [
        '内容种草专项：标题要像真实会被点开的封面文案，优先一句话结论、情绪钩子或场景利益点，避免硬广腔。',
        '种草 slogan 要补足“为什么值得看/收藏/去试”，不能只是重复标题。',
        '种草 body 的 5 个信息点优先写成：适合谁、最值得冲的点、避坑/省心理由、场景感、收藏或行动触发。',
        '种草 CTA 优先使用“先收藏 / 点开看看 / 抄作业去 / 顺手保存 / 立即查看”这类更像内容入口的表达。'
      ].join('\n')
    case 'festival':
      return [
        '节日专项：标题要兼顾节日情绪与商业转化，不能只有节日名。',
        '节日 slogan 要补足限定权益、送礼场景、参与理由或节日前夕紧迫感。',
        '节日 body 的 5 个信息点优先写成：节日卖点、活动时间、领取/配送/到店信息、礼盒/优惠权益、行动触发。',
        '节日 CTA 优先使用“立即参与 / 立即下单 / 领取礼遇 / 抢先预订”。'
      ].join('\n')
    case 'fitness':
      return [
        '健身专项：标题要体现结果感或行动感，不能只说“开始训练”。',
        '健身 slogan 要补足适合人群、训练收益、陪练方式或坚持理由。',
        '健身 body 的 5 个信息点优先写成：训练收益、适合对象、开练时间/课次、福利/陪练/体验权益、报名触发。',
        '健身 CTA 优先使用“立即报名 / 预约体验 / 现在开练 / 抢占名额”。'
      ].join('\n')
    case 'event':
      return [
        '活动专项：标题要像 campaign headline，先把主看点或参与理由抬出来。',
        '活动 slogan 要补足现场氛围、参与价值、嘉宾/内容亮点或传播记忆点。',
        '活动 body 的 5 个信息点优先写成：活动亮点、时间、地点、人群/权益、到场触发。',
        '活动 CTA 优先使用“查看日程 / 立即参与 / 预约到场 / 抢先报名”。'
      ].join('\n')
    default:
      return [
        '通用专项：标题必须先承担第一眼抓人功能，slogan 补足价值，body 给出真实信息层，CTA 给出明确动作。',
        '不要生成“看起来像海报”的空口号，而要生成真的能上画面、能支撑决策的信息结构。'
      ].join('\n')
  }
}
function buildIndustryCopyDirective(input: PosterGenerateInput) {
  const industry = String(input.industry || '')
  if (/美妆/.test(industry)) return '行业补充：美妆海报要优先突出肤感/妆效/成分安心感，文案语气更精致，避免大卖场叫卖腔。'
  if (/母婴/.test(industry)) return '行业补充：母婴海报优先突出安心、家庭场景、囤货理由与适龄/适用信息，文案要温和可信。'
  if (/地产/.test(industry)) return '行业补充：地产海报优先突出区位价值、样板间/看房窗口、改善场景与稀缺感，信息要稳重克制。'
  if (/金融/.test(industry)) return '行业补充：金融海报优先突出可信、专业、收益逻辑或服务价值，避免夸张促销话术。'
  if (/科技互联网/.test(industry)) return '行业补充：科技海报优先突出效率、升级、能力提升或产品价值，语言更简洁利落。'
  if (/旅游/.test(industry)) return '行业补充：旅游海报优先突出目的地画面感、时令窗口、路线亮点和出发理由。'
  if (/汽车/.test(industry)) return '行业补充：汽车海报优先突出性能、空间、设计亮点与试驾理由，语气更有张力。'
  if (/政务公益/.test(industry)) return '行业补充：政务公益海报优先突出倡议目标、参与方式、时间地点与公信力，语气正式清晰。'
  return ''
}
function buildPurposeCopyDirective(input: PosterGenerateInput) {
  const purpose = String(input.purpose || '')
  if (/品牌宣传/.test(purpose)) return '用途补充：品牌宣传优先做品牌印象、价值主张与记忆点，不要默认写成强促销。'
  if (/活动预告|直播预告/.test(purpose)) return '用途补充：预告类海报要优先抬出时间窗口、看点和预约动作，让人一眼知道何时来看。'
  if (/门店导流|引流/.test(purpose)) return '用途补充：导流类海报要优先写清到店理由、到店利益点和立刻行动入口。'
  if (/产品发布|上新/.test(purpose)) return '用途补充：发布/上新类海报优先写新品亮点、首发理由和第一波参与价值。'
  if (/周年庆/.test(purpose)) return '用途补充：周年庆海报要兼顾庆祝氛围、礼遇权益和参与理由，不要只有庆典感。'
  if (/公益倡导/.test(purpose)) return '用途补充：公益倡导类海报优先写清倡议对象、行动方式和社会价值，不写空口号。'
  return ''
}
function buildStyleCopyDirective(input: PosterGenerateInput) {
  const style = String(input.style || '')
  if (/高级简约|北欧极简|日系侘寂/.test(style)) return '风格补充：文案要更短、更克制，每层一句话就能成立，避免堆太满。'
  if (/活力促销|酸性设计|潮酷街头|年轻潮流/.test(style)) return '风格补充：文案可以更有节奏和冲击力，但仍要保证信息块可读、不是喊口号。'
  if (/专业商务|极简科技|黑金大气/.test(style)) return '风格补充：文案要更利落可信，少感叹句，强调判断依据和专业感。'
  if (/杂志大片|轻奢质感|法式优雅/.test(style)) return '风格补充：文案更像封面式短句，headline 要有气质，support line 要有场景和价值。'
  if (/卡通插画|手绘涂鸦|孟菲斯几何/.test(style)) return '风格补充：文案可以更轻快亲和，但信息角色仍要完整。'
  if (/国潮中式|新中式雅致|水墨写意/.test(style)) return '风格补充：文案允许更有东方语感，但不要变成空泛文艺句。'
  return ''
}
function buildSelectionAwareCopyDirective(input: PosterGenerateInput) {
  return [
    buildIndustryCopyDirective(input),
    buildPurposeCopyDirective(input),
    buildStyleCopyDirective(input),
  ].filter(Boolean).join('\n')
}
function pickScenarioCopy(input: PosterGenerateInput) {
  const theme = pickThemeCore(input.theme || '', input.industry || '')
  const purpose = String(input.purpose || '')
  const { facts } = collectPosterFacts(input)
  const withFacts = (baseTitle: string, baseSlogan: string, baseBody: string[], cta: string, extras: Partial<CopyResult> = {}) => ({
    title: clipPosterText(baseTitle, 12),
    slogan: clipPosterText(baseSlogan, 24),
    body: dedupeScenarioSegments(
      [facts.price, facts.time, facts.place, facts.audience, facts.benefit],
      baseBody,
    ).join('｜'),
    cta,
    badge: pickBlueprintBadge(facts, String(extras.badge || '').trim()),
    offerLine: clipPosterText(String(extras.offerLine || facts.price || facts.benefit || '').trim(), 18),
    urgencyLine: clipPosterText(String(extras.urgencyLine || facts.time || '').trim(), 16),
    proofPoints: dedupeScenarioSegments(
      [facts.price, facts.time, facts.place, facts.audience, facts.benefit],
      baseBody,
    ),
  })
  const namedTheme = theme && theme !== 'AI海报'
  switch (getCopyScenario(input)) {
    case 'commerce':
      return withFacts(
        namedTheme ? `${theme}现在闭眼入` : '这波爆款现在最值',
        namedTheme ? `${theme}把主卖点、优惠力度和下单理由一次讲透` : '把主卖点、优惠力度和下单理由一次讲透',
        ['主卖点一眼能懂', '优惠理由直接说透', '适用场景更好代入', '赠品权益明确可感', '现在下单更有理由'],
        /引流/.test(purpose) ? '立即咨询' : '立即抢购',
        { badge: '爆款主推', offerLine: facts.price || '到手更划算', urgencyLine: facts.time || '现在下单更值' },
      )
    case 'food':
      return withFacts(
        namedTheme ? `${theme}现在就想吃` : '这口新品先安排',
        '把招牌风味、到店理由、尝鲜冲动和下单入口一次说透',
        ['招牌风味先勾食欲', '限定供应更有理由', '到店福利写清楚', '分享场景更好代入', '现在下单更不犹豫'],
        /引流/.test(purpose) ? '到店咨询' : '立即下单',
        { badge: '人气上新', offerLine: facts.price || '招牌福利到位', urgencyLine: facts.time || '现在来更对味' },
      )
    case 'recruit':
      return withFacts(
        namedTheme ? `${theme}热招中` : '优岗补位进行中',
        '把岗位吸引点、成长空间、团队方向和福利条件一眼说透',
        ['岗位方向直接说清', '成长空间更有想象', '城市场景别再含糊', '福利制度给足判断', '投递窗口现在更值'],
        '马上投递',
        { badge: '岗位开放', offerLine: facts.benefit || '机会窗口已打开', urgencyLine: facts.time || '优先投递更占先机' },
      )
    case 'course':
      return withFacts(
        namedTheme ? `${theme}现在开班` : '这期课程别错过',
        '把适合谁学、能拿到什么结果和为什么值得现在报名一次讲透',
        ['学习结果先说人话', '适合人群容易对号', '课次节奏更有把握', '试听权益与名额写清', '现在报名更有理由'],
        '立即报名',
        { badge: '报名通道', offerLine: facts.benefit || '试听与名额同步释放', urgencyLine: facts.time || '本期开班别再错过' },
      )
    case 'festival':
      return withFacts(
        namedTheme ? `${theme}礼遇正当时` : '节日礼遇别错过',
        '把节日情绪、限定权益、送礼场景和参与理由一次铺满画面',
        ['节日氛围先抓眼球', '限定权益写得够直白', '送礼场景更好代入', '福利时间别再模糊', '参与入口一眼就懂'],
        '立即下单',
        { badge: '节日限定', offerLine: facts.price || '礼遇加码上线', urgencyLine: facts.time || '礼赠窗口别错过' },
      )
    case 'fitness':
      return withFacts(
        namedTheme ? `${theme}现在开练` : '训练计划现在开练',
        '把训练价值、适合谁练、预期结果和行动门槛讲得更有说服力',
        ['训练结果先给画面', '适合人群别再含糊', '练法门槛说得清楚', '打卡陪练更有安心', '现在开始更易坚持'],
        '立即报名',
        { badge: '训练企划', offerLine: facts.benefit || '体验与陪练同步到位', urgencyLine: facts.time || '越早开练越见效果' },
      )
    case 'event':
      return withFacts(
        namedTheme ? `${theme}这次别错过` : '活动亮点先上头',
        '把活动看点、参与信息、到场理由和现场氛围做成一眼能记住的画面',
        ['主看点必须先抬头', '时间地点更好判断', '现场体验更有想象', '报名权益别再埋没', '现在行动更容易到场'],
        /引流/.test(purpose) ? '立即咨询' : '立即参与',
        { badge: '现场企划', offerLine: facts.benefit || '亮点与权益都到位', urgencyLine: facts.time || '错过这一场就晚了' },
      )
    default:
      return withFacts(
        namedTheme ? `${theme}现在主推` : '核心亮点现在上版',
        '把第一眼吸引力、真实信息点和下一步动作一起做成成片',
        ['核心亮点先抓注意', '利益点说得更具体', '时间条件更好判断', '适合对象不要缺席', '下一步动作更直接'],
        buildCta(purpose),
        { badge: '重点推荐', offerLine: facts.price || facts.benefit || '核心卖点同步抬升', urgencyLine: facts.time || '现在行动更有收益' },
      )
  }
}
function canonicalCopyText(text: string) {
  return String(text || '').replace(/[·•|｜\-—_~～,，。；;:：!！?？（）()\[\]【】《》"“”'‘’\s]/g, '').trim().toLowerCase()
}
function isWeakCopy(value: string) {
  const raw = String(value || '').trim()
  const normalized = canonicalCopyText(raw)
  if (!normalized) return true
  if (normalized.length <= 6) return true
  return /限时狂欢开抢|立即抢购|本期主推|推荐副标题|活动亮点清晰|核心卖点更强|亮点更聚焦|质感升级即刻出片|核心亮点更聚焦|重磅开启|热卖上新|重点发布|限定开启|热招中|火热招生|立即了解/.test(raw)
}
function enrichPosterCopy(input: PosterGenerateInput, copy: CopyResult): CopyResult {
  const { facts } = collectPosterFacts(input)
  const factualFallback: CopyResult = {
    title: buildThemeFactHeadline(input, facts) || clipPosterText(String(input.theme || input.purpose || '').trim(), 18),
    slogan: clipPosterText([facts.benefit, facts.audience, facts.time].filter(Boolean).join('｜'), 26),
    body: normalizeCopySegments([facts.benefit, facts.price, facts.time, facts.place, facts.audience], POSTER_BODY_SEGMENT_LIMIT).join('｜'),
    cta: buildCta(input.purpose),
    ctaAlternatives: copy.ctaAlternatives?.length ? copy.ctaAlternatives : [],
    badge: compactDeckLine(copy.badge, 8, ''),
    offerLine: compactDeckLine(copy.offerLine, 18, facts.price || facts.benefit || ''),
    urgencyLine: compactDeckLine(copy.urgencyLine, 16, facts.time || ''),
    proofPoints: normalizeCopySegments(copy.proofPoints?.length ? copy.proofPoints : [facts.benefit, facts.price, facts.time, facts.place, facts.audience], POSTER_BODY_SEGMENT_LIMIT),
  }
  const next = mergePosterCopyStructure(input, copy, factualFallback)
  if (isWeakCopy(next.title)) next.title = factualFallback.title
  if (isWeakCopy(next.slogan) || canonicalCopyText(next.slogan) === canonicalCopyText(next.title)) next.slogan = factualFallback.slogan
  if (isWeakCopy(next.body)) next.body = factualFallback.body
  const bodySegments = splitPosterInfoSegments(next.body)
  if (bodySegments.length < POSTER_BODY_SEGMENT_LIMIT) {
    next.body = fillPosterSegments(bodySegments, splitPosterInfoSegments(factualFallback.body)).join('｜')
  }
  next.proofPoints = normalizeCopySegments(next.proofPoints?.length ? next.proofPoints : next.body, POSTER_BODY_SEGMENT_LIMIT)
  if (!String(next.offerLine || '').trim()) next.offerLine = String(factualFallback.offerLine || '').trim()
  if (!String(next.urgencyLine || '').trim()) next.urgencyLine = String(factualFallback.urgencyLine || '').trim()
  if (!String(next.badge || '').trim()) next.badge = String(factualFallback.badge || '').trim()
  if (isWeakCopy(next.cta)) next.cta = factualFallback.cta
  return next
}
function splitPosterInfoSegments(text: string) {
  return String(text || '')
    .split(/[\n|｜/；;•·]/)
    .map((item) => item.trim())
    .filter(Boolean)
}
function normalizeCopySegments(value: unknown, max = POSTER_BODY_SEGMENT_LIMIT) {
  const items = Array.isArray(value)
    ? value
    : splitPosterInfoSegments(String(value || ''))
  const merged: string[] = []
  items.forEach((item) => {
    const safe = clipPosterText(String(item || '').trim(), 16)
    if (!safe) return
    if (/主看点必须先抬头|时间地点更好判断|优惠理由直接说透|现场体验更有想象|快速判断是否适合/.test(safe)) return
    if (merged.some((current) => canonicalCopyText(current) === canonicalCopyText(safe))) return
    merged.push(safe)
  })
  return merged.slice(0, max)
}
function fillPosterSegments(base: string[], fallback: string[]) {
  const merged = [...base]
  fallback.forEach((item) => {
    const safe = String(item || '').trim()
    if (!safe) return
    if (merged.some((current) => current.replace(/\s+/g, '') === safe.replace(/\s+/g, ''))) return
    merged.push(safe)
  })
  return merged.slice(0, POSTER_BODY_SEGMENT_LIMIT)
}
function buildTitle(theme: string, purpose: string, industry: string) {
  return pickScenarioCopy({ theme, purpose, industry, sizeKey: '', style: '', content: '', qrUrl: '' }).title
}
function buildSlogan(theme: string, industry: string, style: string) {
  return pickScenarioCopy({ theme, purpose: '', industry, sizeKey: '', style, content: '', qrUrl: '' }).slogan
}
function buildBody(input: PosterGenerateInput) {
  return pickScenarioCopy(input).body
}
function buildCta(purpose: string) { if (purpose.includes('报名')) return '立即报名'; if (purpose.includes('招聘') || purpose.includes('招募')) return '马上投递'; if (purpose.includes('促销')) return '立即抢购'; if (purpose.includes('引流')) return '扫码咨询'; return '立即了解' }
function normalizeCtaList(values: any, maxCount = 4) {
  const list = Array.isArray(values) ? values : String(values || '').split(/[｜|/；;,\n]/)
  const normalized: string[] = []
  list.forEach((item) => {
    const safe = compactDeckLine(String(item || '').trim(), 8, '')
    if (!safe) return
    if (normalized.some((current) => current === safe)) return
    normalized.push(safe)
  })
  return normalized.slice(0, Math.max(1, maxCount))
}
function buildSceneCtaCandidates(input: PosterGenerateInput, intent: PosterIntent) {
  switch (intent.scene) {
    case 'commerce':
      return intent.goal === 'lead' ? ['领取优惠', '限时领券', '加购看看', '立即咨询'] : ['立即抢购', '马上下单', '领取优惠', '加购下单']
    case 'food':
      return ['到店尝鲜', '立即下单', '门店预订', '现在抢鲜']
    case 'recruitment':
      return ['立即投递', '投递简历', '预约面谈', '马上报名']
    case 'course':
      return ['立即报名', '领取试听', '预约咨询', '抢占名额']
    case 'festival':
      return ['领取礼遇', '立即参与', '抢先预订', '马上下单']
    case 'fitness':
      return ['预约体验', '现在开练', '立即报名', '抢占名额']
    case 'social':
      return ['点我查看', '继续阅读', '马上收藏', '立即了解']
    default:
      return /活动|发布|展览|峰会|论坛/.test(`${input.theme || ''} ${input.purpose || ''}`) ? ['查看日程', '预约到场', '立即参与', '抢先报名'] : ['立即了解', '马上查看', '继续了解', '立即咨询']
  }
}
function pickPrimaryCta(rawCta: string, candidates: string[]) {
  const preferred = compactDeckLine(rawCta, 8, '')
  if (preferred && !/^(立即了解|扫码咨询)$/.test(preferred)) return preferred
  return candidates[0] || preferred || '立即了解'
}
function derivePosterCtaStyle(input: PosterGenerateInput, intent: PosterIntent, copyDeck?: Partial<PosterCopyDeck>, plan?: Partial<NonNullable<PosterGenerateResult['designPlan']>>): PosterCtaStyle {
  const contentPattern = String(plan?.contentPattern || '').trim()
  const hasPrice = Boolean(String(copyDeck?.priceBlock?.value || '').trim())
  const strongGoal = ['sell', 'recruit', 'sign_up'].includes(intent.goal)
  const warmScene = intent.scene === 'food' || /美食|咖啡|茶饮|轻食|烘焙/.test(`${input.theme || ''} ${input.style || ''}`)
  const eventScene = intent.scene === 'event' || intent.scene === 'festival'
  const editorialScene = /杂志|封面|大片|高级|时尚| editorial /i.test(` ${input.style || ''} `) || contentPattern === 'cover-story'
  if (hasPrice || contentPattern === 'price-first') {
    return { variant: 'pill', emphasis: 'strong', shape: 'capsule', placement: 'with-price', tone: 'urgent', iconHint: 'arrow', widthMode: 'content' }
  }
  if (intent.scene === 'recruitment') {
    return { variant: 'bar', emphasis: 'strong', shape: 'square', placement: 'bottom-bar', tone: 'utility', iconHint: 'chevron', widthMode: 'wide' }
  }
  if (intent.scene === 'course' || intent.scene === 'fitness') {
    return { variant: 'outline', emphasis: strongGoal ? 'strong' : 'balanced', shape: 'rounded', placement: 'inline', tone: 'friendly', iconHint: 'plus', widthMode: 'content' }
  }
  if (eventScene) {
    return { variant: 'sticker', emphasis: 'balanced', shape: 'rounded', placement: 'floating', tone: 'friendly', iconHint: 'spark', widthMode: 'content' }
  }
  if (warmScene) {
    return { variant: 'pill', emphasis: 'balanced', shape: 'capsule', placement: 'inline', tone: 'premium', iconHint: 'arrow', widthMode: 'content' }
  }
  if (editorialScene) {
    return { variant: 'underline', emphasis: 'soft', shape: 'square', placement: 'inline', tone: 'editorial', iconHint: 'none', widthMode: 'content' }
  }
  return { variant: strongGoal ? 'solid' : 'outline', emphasis: strongGoal ? 'strong' : 'balanced', shape: 'rounded', placement: contentPattern === 'immersive-hero' ? 'floating' : 'inline', tone: strongGoal ? 'urgent' : 'premium', iconHint: strongGoal ? 'arrow' : 'none', widthMode: strongGoal ? 'wide' : 'content' }
}
function pickBlueprintBadge(facts: ReturnType<typeof collectPosterFacts>['facts'], fallback: string) {
  return clipPosterText(facts.time || facts.price || facts.place || fallback || '', 10)
}
function mergePosterCopyStructure(input: PosterGenerateInput, copy: CopyResult, fallback: CopyResult): CopyResult {
  const fallbackSegments = splitPosterInfoSegments(fallback.body)
  const proofPoints = normalizeCopySegments(copy.proofPoints, POSTER_BODY_SEGMENT_LIMIT)
  const bodySegments = normalizeCopySegments(copy.body, POSTER_BODY_SEGMENT_LIMIT)
  const offerLine = finalizeCopyField(String(copy.offerLine || '').trim(), '')
  const urgencyLine = finalizeCopyField(String(copy.urgencyLine || '').trim(), '')
  const mergedBody = fillPosterSegments(
    [
      ...proofPoints,
      ...bodySegments,
      ...normalizeCopySegments(offerLine, 1),
      ...normalizeCopySegments(urgencyLine, 1),
    ],
    fallbackSegments,
  )
  const nextTitle = finalizeCopyField(String(copy.title || '').trim(), fallback.title)
  const nextSlogan = finalizeCopyField(String(copy.slogan || offerLine || '').trim(), fallback.slogan)
  return {
    ...copy,
    title: nextTitle,
    slogan: nextSlogan,
    body: mergedBody.join('｜'),
    cta: finalizeCopyField(String(copy.cta || '').trim(), fallback.cta),
    badge: finalizeCopyField(String(copy.badge || '').trim(), String(fallback.badge || '').trim()),
    offerLine,
    urgencyLine,
    proofPoints: mergedBody,
  }
}
function toPosterScene(input: PosterGenerateInput): PosterScene {
  switch (getCopyScenario(input)) {
    case 'commerce': return 'commerce'
    case 'recruit': return 'recruitment'
    case 'course': return 'course'
    case 'festival': return 'festival'
    case 'food': return 'food'
    case 'fitness': return 'fitness'
    case 'event': return 'event'
    default: return input.sizeKey === 'xiaohongshu' ? 'social' : 'event'
  }
}
function toPosterGoal(input: PosterGenerateInput, scene: PosterScene): PosterGoal {
  const joined = `${input.purpose || ''} ${input.theme || ''} ${input.content || ''}`
  if (/招聘|招募|投递|入职/.test(joined) || scene === 'recruitment') return 'recruit'
  if (/报名|开班|试听|预约/.test(joined) || scene === 'course' || scene === 'fitness') return 'sign_up'
  if (/促销|抢购|下单|加购|立减|折扣|礼盒/.test(joined) || scene === 'commerce' || scene === 'food' || scene === 'festival') return 'sell'
  if (/引流|咨询|到店|线索/.test(joined)) return 'lead'
  if (/宣传|预热|发布|推广/.test(joined)) return 'promote'
  return 'inform'
}
function buildPosterIntent(input: PosterGenerateInput, fallback: CopyResult): PosterIntent {
  const { facts } = collectPosterFacts(input)
  const scene = toPosterScene(input)
  return {
    scene,
    goal: toPosterGoal(input, scene),
    audience: clipPosterText(facts.audience || facts.place || facts.benefit || fallback.slogan || input.content || '目标用户重点关注转化信息', 18),
    tone: clipPosterText(String(input.style || input.purpose || input.industry || '高级简约').trim(), 14),
  }
}
function normalizeScene(value: unknown) {
  return ['commerce', 'recruitment', 'event', 'course', 'festival', 'food', 'fitness', 'social'].includes(String(value || ''))
    ? String(value) as PosterScene
    : null
}
function normalizeGoal(value: unknown) {
  return ['sell', 'lead', 'recruit', 'sign_up', 'promote', 'inform'].includes(String(value || ''))
    ? String(value) as PosterGoal
    : null
}
function normalizeContentPattern(value: unknown) {
  return ['immersive-hero', 'price-first', 'info-cards', 'cover-story', 'list-info'].includes(String(value || ''))
    ? String(value) as PosterContentPattern
    : null
}
function buildThemeFactHeadline(input: PosterGenerateInput, facts: ReturnType<typeof collectPosterFacts>['facts']) {
  const theme = clipPosterText(stripThemeEcho(String(input.theme || '').trim(), ''), 18)
  const qualifierSource = /品牌宣传/.test(String(input.purpose || ''))
    ? (facts.benefit || facts.audience || '')
    : (facts.price || facts.benefit || facts.audience || facts.time || '')
  const qualifier = clipPosterText(qualifierSource, 8)
  const merged = clipPosterText([theme, qualifier].filter(Boolean).join(' '), 18)
  return merged || theme || clipPosterText(facts.benefit || facts.price || String(input.purpose || '').trim(), 18)
}
function buildInputFactCopy(input: PosterGenerateInput): CopyResult {
  const { facts } = collectPosterFacts(input)
  return {
    title: buildThemeFactHeadline(input, facts),
    slogan: clipPosterText([facts.benefit, facts.audience, facts.time].filter(Boolean).join('｜'), 26),
    body: normalizeCopySegments([facts.benefit, facts.price, facts.time, facts.place, facts.audience], POSTER_BODY_SEGMENT_LIMIT).join('｜'),
    cta: buildCta(input.purpose),
    ctaAlternatives: [],
    badge: '',
    offerLine: facts.price || facts.benefit || '',
    urgencyLine: facts.time || '',
    proofPoints: normalizeCopySegments([facts.benefit, facts.price, facts.time, facts.place, facts.audience], POSTER_BODY_SEGMENT_LIMIT),
  }
}
function buildFactDrivenSupportLine(
  input: PosterGenerateInput,
  intent: PosterIntent,
  facts: ReturnType<typeof collectPosterFacts>['facts'],
  copy: CopyResult,
  offerLine: string,
  proofPoints: string[],
) {
  if (intent.scene === 'recruitment') {
    const roleLine = buildRecruitmentRoleLine(input, '')
    const compLine = buildRecruitmentCompLine(input, facts, copy)
    const benefitLine = buildRecruitmentBenefitLine(input, facts, copy)
    return compactDeckLine([roleLine, compLine || benefitLine].filter(Boolean).join('｜'), 26, '岗位价值、福利条件和投递窗口一次说清')
  }
  if (intent.scene === 'course') {
    const audienceHint = buildCourseAudienceHint(input, facts)
    const outcomeLine = buildCourseOutcomeLine(input, facts, copy)
    const courseSupportSeed = normalizeCopySegments([
      copy.slogan,
      copy.offerLine,
      ...proofPoints,
      input.content,
    ], 6).find((item) => /直播|作业|点评|案例|提示词|实战|陪跑|诊断|变现|起号/.test(item))
    const unique = [courseSupportSeed, outcomeLine, audienceHint]
      .filter(Boolean)
      .filter((item, index, arr) => arr.findIndex((current, currentIndex) => {
        if (currentIndex > index) return false
        return canonicalCopyText(current || '') === canonicalCopyText(item || '') || isSameCourseSupportTopic(String(current || ''), String(item || ''))
      }) === index)
    return compactDeckLine(unique.join('｜'), 26, '适合谁学、能学到什么和为什么现在报名')
  }
  const merged = normalizeCopySegments([
    copy.slogan,
    facts.benefit,
    facts.audience,
    facts.time,
    facts.place,
    offerLine,
    ...proofPoints,
  ], 3)
  const unique = merged.filter((item, index) => merged.findIndex((current) => canonicalCopyText(current) === canonicalCopyText(item)) === index)
  const compact = clipPosterText(unique.slice(0, 2).join('｜'), 26)
  return compact || clipPosterText([facts.benefit, facts.audience, facts.time].filter(Boolean).join('｜'), 26)
}
function buildPosterIntentFromSuggestion(input: PosterGenerateInput, fallback: CopyResult, suggestion?: Partial<PosterIntent>): PosterIntent {
  const base = buildPosterIntent(input, fallback)
  const scene = reconcilePosterScene(base.scene, normalizeScene(suggestion?.scene))
  return {
    scene,
    goal: normalizeGoal(suggestion?.goal) || toPosterGoal(input, scene),
    audience: compactDeckLine(suggestion?.audience, 18, base.audience),
    tone: compactDeckLine(suggestion?.tone, 14, base.tone),
  }
}
function compactDeckLine(value: unknown, max: number, fallback = '') {
  return clipPosterText(String(value || '').trim(), max) || clipPosterText(fallback, max)
}
function looksLikeClippedPosterLine(source: unknown, clipped: string, max: number) {
  const raw = normalizePosterText(source)
  const safe = String(clipped || '').trim()
  if (!raw || !safe || raw.length <= max) return false
  if (/[｜|/，,。；;：:!?！？]$/.test(safe)) return false
  if (safe.length >= raw.length) return false
  if (/[培招报提系突营岗薪课]/u.test(safe.slice(-1))) return true
  return true
}
function normalizePosterHeadline(value: unknown, fallback: string) {
  const raw = compactDeckLine(value, 18, fallback)
  if (!raw) return ''
  let next = String(raw)
    .replace(/(现在就|立即|马上|立刻)(下单|抢|抢购|开吃|购买|报名|入手|安排|冲|了解)?$/u, '')
    .replace(/(快来|速来|快抢|抢先|马上|立即)体验$/u, '体验')
    .replace(/(现在|立即|马上)$/u, '')
    .trim()
  if (!next) next = compactDeckLine(fallback, 18, '')
  return clipPosterText(next, 18)
}
function buildPosterFactCards(input: PosterGenerateInput, copy: CopyResult, intent: PosterIntent): PosterFactCard[] {
  const { facts } = collectPosterFacts(input)
  const seed = normalizeCopySegments(copy.proofPoints?.length ? copy.proofPoints : copy.body, 6)
  const pairs: Array<[string, string, string]> = []
  if (intent.scene === 'food') {
    pairs.push(
      ['主推', facts.benefit || copy.offerLine || seed[0] || '', copy.urgencyLine || facts.time || ''],
      ['适合', facts.audience || seed[1] || '', facts.price || facts.place || ''],
      ['到店', facts.place || facts.time || seed[2] || '', copy.cta || ''],
    )
  } else if (intent.scene === 'commerce' || intent.scene === 'festival') {
    pairs.push(
      ['权益', facts.price || copy.offerLine || seed[0] || '', copy.urgencyLine || facts.time || ''],
      ['适合', facts.audience || facts.benefit || seed[1] || '', facts.place || copy.cta || ''],
      ['加码', facts.benefit || seed[2] || '', facts.time || copy.cta || ''],
    )
  } else if (intent.scene === 'recruitment') {
    const roleLine = buildRecruitmentRoleLine(input, stripThemeEcho(copy.title, input.theme) || seed[0] || '')
    const benefitLine = buildRecruitmentBenefitLine(input, facts, copy)
    const audienceLine = buildRecruitmentAudienceHint(input, facts)
    pairs.push(
      ['岗位', roleLine || stripThemeEcho(copy.title, input.theme) || seed[0] || '', benefitLine || copy.offerLine || ''],
      ['福利', benefitLine || facts.price || facts.benefit || seed[1] || '', facts.time || copy.cta || ''],
      ['对象', audienceLine || facts.audience || seed[2] || '', copy.cta || ''],
    )
  } else {
    pairs.push(
      ['时间', facts.time || copy.urgencyLine || seed[0] || '', facts.place || ''],
      ['地点', facts.place || facts.audience || seed[1] || '', copy.cta || ''],
      ['亮点', facts.benefit || copy.offerLine || seed[2] || '', facts.price || copy.cta || ''],
    )
  }
  return pairs
    .map(([label, value, hint]) => ({
      label: compactDeckLine(label, 6),
      value: compactDeckLine(value, 14),
      hint: compactDeckLine(hint, 12),
    }))
    .filter((item) => item.value)
    .filter((item, index, arr) => arr.findIndex((cur) => canonicalCopyText(cur.value) === canonicalCopyText(item.value)) === index)
    .slice(0, intent.scene === 'recruitment' ? 3 : 4)
}
function looksLikeWeakFactValue(value: string) {
  const safe = String(value || '').trim()
  if (!safe) return true
  if (/^(限时|报名|早鸟|名额|人才|人群|地点|时间|亮点|福利|对象|适合|导流|促销|品牌宣传|马上投递|立即报名)$/u.test(safe)) return true
  if (safe.length > 10) return true
  if (/一次|直接|更有|更好|更值|说透|安排|体验|判断|代入|画面|看懂|理解|成片/.test(safe)) return true
  return false
}
function buildSceneFactCardSeeds(intent: PosterIntent, facts: ReturnType<typeof collectPosterFacts>['facts'], input: PosterGenerateInput, copy: CopyResult) {
  const proof = normalizeCopySegments(copy.proofPoints?.length ? copy.proofPoints : copy.body, 6)
  if (intent.scene === 'commerce') {
    const purpose = String(input.purpose || '')
    const industry = String(input.industry || '')
    const middleLabel = /品牌宣传/.test(purpose) && /美妆|母婴/.test(industry) ? '场景' : '适合'
    const middleValue = /品牌宣传/.test(purpose)
      ? (buildCommerceAudienceValue(input, facts, copy) || facts.audience || buildCommerceFeatureValue(input, facts, copy))
      : (facts.audience || (/组合|套装|礼盒/.test(input.content || '') ? clipPosterText('囤货家庭 / 自用送礼', 14) : (facts.benefit || proof[1] || '')))
    const bonusValue = /品牌宣传/.test(purpose)
      ? (buildCommerceFeatureValue(input, facts, copy) || facts.benefit || proof[2] || copy.offerLine || '')
      : (facts.benefit || proof[2] || copy.offerLine || '')
    return [
      { label: '权益', value: facts.price || copy.offerLine || proof[0] || '', hint: buildCommerceLikeHint(intent, input, facts, copy, 'offer') || copy.urgencyLine || facts.time || '' },
      { label: middleLabel, value: middleValue, hint: buildCommerceLikeHint(intent, input, facts, copy, 'audience') || facts.benefit || facts.place || '' },
      { label: '加码', value: bonusValue, hint: buildCommerceLikeHint(intent, input, facts, copy, 'bonus') || facts.time || copy.cta || '' },
    ]
  }
  if (intent.scene === 'food') {
    return [
      { label: '风味', value: buildFoodFeatureValue(input, facts, copy) || facts.benefit || copy.offerLine || proof[0] || '', hint: buildCommerceLikeHint(intent, input, facts, copy, 'offer') || copy.urgencyLine || facts.time || '' },
      { label: '适合', value: buildFoodAudienceValue(input, facts) || facts.audience || clipPosterText('午餐 / 晚餐 / 轻负担', 14), hint: buildCommerceLikeHint(intent, input, facts, copy, 'audience') || facts.price || facts.place || '' },
      { label: '到店', value: buildFoodVisitLine(input, facts) || facts.place || facts.time || proof[2] || '', hint: buildCommerceLikeHint(intent, input, facts, copy, 'bonus') || copy.cta || '到店尝鲜' },
    ]
  }
  if (intent.scene === 'recruitment') {
    const roleLine = buildRecruitmentRoleLine(input, stripThemeEcho(copy.title, input.theme) || proof[0] || '')
    const benefitLine = buildRecruitmentBenefitLine(input, facts, copy)
    const compLine = buildRecruitmentCompLine(input, facts, copy)
    const audienceLine = buildRecruitmentAudienceHint(input, facts)
    return [
      { label: '岗位', value: roleLine || stripThemeEcho(copy.title, input.theme) || proof[0] || '', hint: buildRecruitmentRoleHint(input, facts, copy) || benefitLine || '' },
      { label: '薪酬', value: compLine || facts.price || copy.offerLine || proof[1] || '', hint: buildRecruitmentSalaryHint(input, facts, copy) || '' },
      { label: '福利', value: benefitLine || facts.benefit || proof[2] || '', hint: buildRecruitmentBenefitHint(input, facts, copy) || audienceLine || '' },
    ]
  }
  if (intent.scene === 'course' || intent.scene === 'fitness') {
    if (intent.scene === 'fitness') {
      return [
        { label: '适合谁', value: buildFitnessAudienceValue(input, facts, copy) || facts.audience || proof[0] || '', hint: compactDeckLine('新手友好 / 节奏稳', 12, '') },
        { label: '练什么', value: buildFitnessOutcomeValue(input, facts, copy) || facts.benefit || copy.offerLine || proof[1] || '', hint: compactDeckLine('结果可见 / 易坚持', 12, '') },
        { label: '开练', value: buildFitnessSignupValue(input, facts, copy) || copy.urgencyLine || proof[2] || '', hint: compactDeckLine(copy.cta || '立即报名', 12, '立即报名') },
      ]
    }
    return [
      { label: '适合谁', value: buildCourseAudienceHint(input, facts) || facts.audience || proof[0] || '', hint: buildCourseCardHint(input, 'audience') || facts.benefit || '' },
      { label: '学什么', value: buildCourseOutcomeLine(input, facts, copy) || facts.benefit || copy.offerLine || proof[1] || '', hint: buildCourseCardHint(input, 'outcome') || facts.time || '' },
      { label: '报名', value: buildCourseSignupLine(input, facts, copy) || copy.urgencyLine || proof[2] || '', hint: buildCourseCardHint(input, 'signup') || copy.cta || '立即报名' },
    ]
  }
  if (intent.scene === 'event') {
    return [
      { label: '时间', value: buildEventTimeValue(input, facts, copy) || copy.urgencyLine || proof[0] || '', hint: buildEventHint('time') },
      { label: '现场', value: buildEventPlaceValue(input, facts, copy) || facts.place || proof[1] || '', hint: buildEventHint('place') },
      { label: '亮点', value: buildEventHighlightValue(input, facts, copy) || facts.benefit || copy.offerLine || proof[2] || '', hint: buildEventHint('highlight') },
    ]
  }
  if (intent.scene === 'festival') {
    const benefitValue = facts.benefit || proof[2] || copy.urgencyLine || '节日限定 / 心意加赠'
    return [
      { label: '礼遇', value: facts.price || copy.offerLine || proof[0] || '', hint: compactDeckLine('节日限定 / 送礼有理', 12, '') },
      { label: '场景', value: buildFestivalSceneValue(input, facts, copy) || facts.audience || proof[1] || '', hint: compactDeckLine('团圆分享 / 心意到位', 12, '') },
      { label: '加码', value: benefitValue, hint: compactDeckLine(copy.cta || '立即下单', 12, '立即下单') },
    ]
  }
  return [
    { label: '时间', value: facts.time || copy.urgencyLine || proof[0] || '', hint: facts.place || '' },
    { label: '地点', value: facts.place || facts.audience || proof[1] || '', hint: copy.cta || '' },
    { label: '亮点', value: facts.benefit || copy.offerLine || proof[2] || '', hint: facts.price || copy.cta || '' },
  ]
}
function normalizeSceneFactCards(input: PosterGenerateInput, intent: PosterIntent, copy: CopyResult, cards: PosterFactCard[]) {
  const { facts } = collectPosterFacts(input)
  const seeds = buildSceneFactCardSeeds(intent, facts, input, copy)
  const merged = (cards || []).map((item, index) => {
    const seed = seeds[index] || seeds[0]
    const currentLabel = String(item?.label || '').trim()
    const purpose = String(input.purpose || '')
    const useSeedLabel = intent.scene === 'recruitment'
      || (intent.scene === 'food' && /风味|适合|到店|主推/.test(currentLabel))
      || !currentLabel
      || (intent.scene === 'commerce' && /品牌宣传/.test(purpose))
      || ((intent.scene === 'event' || intent.scene === 'festival') && /时间|地点|亮点|主推|适合/.test(currentLabel))
      || ((intent.scene === 'course' || intent.scene === 'fitness') && /时间|地点|亮点|主推|到店|适合/.test(currentLabel))
    const nextValue = useSeedLabel || looksLikeWeakFactValue(item?.value || '') ? (seed?.value || '') : item?.value
    const nextHint = intent.scene === 'recruitment'
      ? (seed?.hint || item?.hint || '')
      : (useSeedLabel ? (seed?.hint || '') : (item?.hint || seed?.hint || ''))
    return {
      label: compactDeckLine(useSeedLabel ? (seed?.label || '') : currentLabel, 6, seed?.label || ''),
      value: compactDeckLine(nextValue, 14, seed?.value || ''),
      hint: dedupePosterHint(nextValue, nextHint, seed?.hint || ''),
    }
  })
  const completed = merged.length >= Math.min(seeds.length, 3)
    ? merged
    : merged.concat(seeds.slice(merged.length).map((seed) => ({
      label: compactDeckLine(seed.label, 6),
      value: compactDeckLine(seed.value, 14),
      hint: compactDeckLine(seed.hint, 12),
    })))
  let normalized = completed
    .filter((item) => item.value)
    .filter((item, index, arr) => arr.findIndex((cur) => canonicalCopyText(cur.value) === canonicalCopyText(item.value)) === index)
    .slice(0, intent.scene === 'recruitment' ? 3 : 4)
  if (['event', 'festival', 'fitness', 'course'].includes(intent.scene) && normalized.length < 3) {
    const existingValues = new Set(normalized.map((item) => canonicalCopyText(item.value)))
    const existingLabels = new Set(normalized.map((item) => canonicalCopyText(item.label)))
    const fillers = seeds
      .filter((seed) => seed.value)
      .filter((seed) => !existingValues.has(canonicalCopyText(seed.value)) && !existingLabels.has(canonicalCopyText(seed.label)))
      .map((seed) => ({
        label: compactDeckLine(seed.label, 6),
        value: compactDeckLine(seed.value, 14),
        hint: compactDeckLine(seed.hint, 12),
      }))
    normalized = normalized.concat(fillers).slice(0, 3)
  }
  if (intent.scene === 'recruitment') {
    const compLine = buildRecruitmentCompLine(input, facts, copy)
    const hasBenefitCard = normalized.some((item) => /福利|保障|待遇/.test(item.label))
    const hasCompInfo = normalized.some((item) => hasRecruitmentCompSignal(item.value) || hasRecruitmentCompSignal(item.hint))
    const hasSalaryCard = normalized.some((item) => /薪|待遇|福利/.test(item.label) && hasExplicitRecruitmentSalarySignal(item.value || item.hint))
    if (compLine && !hasSalaryCard) {
      const compCard: PosterFactCard = {
        label: hasExplicitRecruitmentSalarySignal(facts.price) || hasExplicitRecruitmentSalarySignal(compLine) ? '薪酬' : '待遇',
        value: compactDeckLine(compLine, 14, '薪资福利可谈'),
        hint: compactDeckLine(buildRecruitmentSalaryHint(input, facts, copy) || copy.actionReason || '排班灵活 / 激励清晰', 12, '排班灵活 / 激励清晰'),
      }
      normalized = [
        normalized.find((item) => /岗位|方向|职位/.test(item.label)) || normalized[0],
        compCard,
        ...normalized.filter((item) => item && canonicalCopyText(item.value) !== canonicalCopyText(compCard.value) && !/岗位|方向|职位/.test(item.label)),
      ]
        .filter(Boolean)
        .slice(0, 3) as PosterFactCard[]
    }
    if (!hasBenefitCard || !hasCompInfo) {
      const benefitFallback: PosterFactCard = {
        label: '福利',
        value: compactDeckLine(buildRecruitmentBenefitLine(input, facts, copy) || '薪资面议 / 提成激励', 14, '薪资面议 / 提成激励'),
        hint: compactDeckLine(buildRecruitmentBenefitHint(input, facts, copy) || '应届可投 / 经验优先', 12, '应届可投 / 经验优先'),
      }
      normalized = normalized
        .filter((item) => !/福利|保障|待遇/.test(item.label))
        .concat(benefitFallback)
        .slice(0, 3)
    }
  }
  return normalized
}
function buildSceneAudienceLine(input: PosterGenerateInput, intent: PosterIntent, copy: CopyResult, factCards: PosterFactCard[]) {
  const { facts } = collectPosterFacts(input)
  const picked = pickFactCardValueByLabel(factCards, /适合|对象|人群|岗位|课程对象|适合谁/)
  if (intent.scene === 'recruitment') {
    const audienceLine = buildRecruitmentAudienceHint(input, facts)
    if (audienceLine) return compactDeckLine(audienceLine, 22, '')
    const roleLine = buildRecruitmentRoleLine(input, '')
    if (roleLine) return compactDeckLine(roleLine, 22, '')
  }
  if (facts.audience) return compactDeckLine(facts.audience, 22, '')
  if (picked && !looksLikeWeakFactValue(picked) && !/去油|洁净|包装|速溶|风味|亮点|课程|训练/.test(picked)) return compactDeckLine(picked, 22, '')
  if (intent.scene === 'commerce') return compactDeckLine(/家庭|母婴|宿舍|办公室/.test(input.content || '') ? RegExp.lastMatch : '家庭囤货 / 自用送礼', 22, '')
  if (intent.scene === 'food') return compactDeckLine('午餐轻食 / 晚餐加餐都适合', 22, '')
  if (intent.scene === 'course') return compactDeckLine(buildCourseAudienceHint(input, facts) || '零基础 / 想系统提升的人更适合', 22, '')
  if (intent.scene === 'fitness') return compactDeckLine('久坐人群 / 新手开练更友好', 22, '')
  return ''
}
function buildSceneTrustLine(input: PosterGenerateInput, intent: PosterIntent, copy: CopyResult, factCards: PosterFactCard[]) {
  const { facts } = collectPosterFacts(input)
  const picked = pickFactCardValueByLabel(factCards, /保障|时效|发货|福利|背书|服务|加码|亮点|报名/)
  if (intent.scene === 'recruitment') {
    const benefitLine = buildRecruitmentBenefitLine(input, facts, copy)
    if (benefitLine) return compactDeckLine(benefitLine, 22, '')
    return compactDeckLine('薪资福利可聊 / 支持快速沟通', 22, '')
  }
  if (facts.place && /门店|校区|线上|线下|直播间|会场/.test(facts.place)) return compactDeckLine(facts.place, 22, '')
  if (facts.time) return compactDeckLine(facts.time, 22, '')
  if (picked && !looksLikeWeakFactValue(picked) && !/去油|洁净|风味|训练|课程|速溶/.test(picked)) return compactDeckLine(picked, 22, '')
  if (intent.scene === 'commerce') return compactDeckLine(copy.urgencyLine || copy.offerLine, 22, '')
  if (intent.scene === 'course') return compactDeckLine(copy.urgencyLine || buildCourseOutcomeLine(input, facts, copy) || '名额有限，建议尽早锁定', 22, '')
  return compactDeckLine(copy.urgencyLine || facts.benefit || '', 22, '')
}
function buildPosterPriceBlock(input: PosterGenerateInput, copy: CopyResult, intent: PosterIntent): PosterPriceBlock | null {
  if (!['commerce', 'food', 'festival'].includes(intent.scene)) return null
  const raw = `${copy.offerLine || ''} ${copy.body || ''} ${input.content || ''}`
  const direct = raw.match(/(?:￥|¥)\s*\d{1,4}(?:\.\d{1,2})?(?:起|元)?/)
  const yuan = raw.match(/(?<!\d)(\d{1,4}(?:\.\d{1,2})?)\s*元(?:起)?/)
  const plainTagged = raw.match(/(?:到手价|活动价|现价|券后|仅需|只要)\s*(\d{1,4}(?:\.\d{1,2})?)/)
  const discount = raw.match(/(?<!\d)(\d(?:\.\d)?)\s*折/)
  const promoOnly = raw.match(/买一送一|第二件半价|第二份半价|立减\s*\d{1,4}\s*元?|直降\s*\d{1,4}\s*元?|新人专享|限时半价|加赠|赠旅行装|赠礼袋/i)
  const value = direct?.[0]?.replace(/\s+/g, '') || (yuan?.[1] ? `￥${yuan[1]}` : plainTagged?.[1] ? `￥${plainTagged[1]}` : discount?.[1] ? discount[1] : '')
  if (!value && !promoOnly?.[0]) return buildPlaceholderPriceBlock(intent, input, copy)
  const isDiscountOnly = Boolean(discount?.[1]) && !direct?.[0] && !yuan?.[1] && !plainTagged?.[1]
  return {
    tag: compactDeckLine(
      promoOnly?.[0] && !value
        ? '限时优惠'
        : (isDiscountOnly ? '限时折扣' : (/券后|到手|限时|尝鲜|活动|现价|仅需/.test(raw) ? raw.match(/券后|到手|限时|尝鲜|活动|现价|仅需/)?.[0] : '限时礼遇')),
      6,
      '限时礼遇',
    ),
    value: compactDeckLine(value || promoOnly?.[0] || '', 12, ''),
    suffix: compactDeckLine(isDiscountOnly ? '折' : (direct?.[0]?.endsWith('元') ? '元' : /起|元/.test(raw) ? raw.match(/起|元/)?.[0] : value ? '起' : ''), 4),
    note: compactDeckLine(copy.urgencyLine || copy.offerLine || '', 16),
  }
}
function buildCommerceLikeSupportLine(
  input: PosterGenerateInput,
  intent: PosterIntent,
  facts: ReturnType<typeof collectPosterFacts>['facts'],
  copy: CopyResult,
  offerLine: string,
  proofPoints: string[],
) {
  const themeCore = stripThemeEcho(pickThemeCore(input.theme || '', input.industry || ''), String(input.theme || '').replace(/\s+/g, '').trim())
  const purpose = String(input.purpose || '')
  const style = String(input.style || '')
  const sameMeaning = (left: string, right: string) => {
    const a = canonicalCopyText(left)
    const b = canonicalCopyText(right)
    if (!a || !b) return false
    return a === b || a.includes(b) || b.includes(a)
  }
  const descriptors = normalizeCopySegments([
    facts.benefit,
    facts.audience,
    facts.price,
    proofPoints[0],
    proofPoints[1],
    copy.slogan,
    copy.offerLine,
  ], 4).filter((item) => !isWeakQualityText(item, 4))
  const leader = descriptors.find((item) => !sameMeaning(item, themeCore)) || offerLine || facts.benefit || copy.slogan
  const tail = descriptors.find((item) => item !== leader && !sameMeaning(item, leader)) || facts.time || facts.place || facts.audience
  if (intent.scene === 'food') {
    const foodFallback = /品牌宣传/.test(purpose)
      ? '招牌风味、品牌记忆与到店氛围一次看懂'
      : /门店导流|引流/.test(purpose)
        ? '招牌风味、到店理由与限时礼遇一次看懂'
        : /高级简约|轻奢质感|杂志大片/.test(style)
          ? '招牌风味与轻负担体验一次说透'
          : '招牌风味、到店理由与尝鲜窗口一次说透'
    return compactDeckLine(copy.slogan, 26, [leader, tail].filter(Boolean).join('｜') || foodFallback)
  }
  const commerceFallback = /品牌宣传/.test(purpose)
    ? '核心卖点、品牌价值与适用场景一次看懂'
    : /产品发布|上新/.test(purpose)
      ? '新品亮点、首发理由与入手窗口一次看懂'
      : /高级简约|轻奢质感|杂志大片/.test(style)
        ? '核心卖点与使用价值一次看懂'
        : '核心卖点、优惠理由与行动窗口一次看懂'
  return compactDeckLine(copy.slogan, 26, [leader, tail].filter(Boolean).join('｜') || commerceFallback)
}
function buildCommerceLikeProofPoints(
  input: PosterGenerateInput,
  intent: PosterIntent,
  facts: ReturnType<typeof collectPosterFacts>['facts'],
  copy: CopyResult,
  offerLine: string,
  urgencyLine: string,
) {
  const themeCore = String(input.theme || '').replace(/\s+/g, '').trim()
  return normalizeCopySegments([
    ...(copy.proofPoints?.length ? copy.proofPoints : []),
    ...normalizeCopySegments(copy.body, 5),
    facts.benefit,
    facts.price,
    facts.audience,
    facts.place,
    facts.time,
    offerLine,
    urgencyLine,
  ], 5).map((item) => stripThemeEcho(item, themeCore))
}
function buildPosterShortCombo(values: Array<unknown>, max = 26, fallback = '') {
  const items = normalizeCopySegments(values, 6)
    .map((item) => clipPosterText(String(item || '').replace(/[｜|]/g, '/').replace(/\s+/g, ''), 10))
    .filter(Boolean)
  const unique = items.filter((item, index) => items.findIndex((cur) => canonicalCopyText(cur) === canonicalCopyText(item)) === index)
  return compactDeckLine(unique.slice(0, 3).join('/'), max, fallback)
}
function buildPosterTagCombo(values: Array<unknown>, fallback = '') {
  return buildPosterShortCombo(values, 12, fallback)
}
function dedupePosterHint(value: unknown, hint: unknown, fallback = '') {
  const safeValue = String(value || '').trim()
  const rawHint = String(hint || '').trim()
  if (!rawHint) return compactDeckLine(fallback, 12, '')
  const parts = rawHint.split(/[\/｜|]/).map((item) => item.trim()).filter(Boolean)
  const valueNorm = canonicalCopyText(safeValue)
  const kept = parts.filter((part, index) => {
    const norm = canonicalCopyText(part)
    if (!norm) return false
    if (valueNorm && (valueNorm.includes(norm) || norm.includes(valueNorm))) return false
    return parts.findIndex((cur) => canonicalCopyText(cur) === norm) === index
  })
  return compactDeckLine(kept.join('/'), 12, fallback)
}
function buildCommerceLikeHint(intent: PosterIntent, input: PosterGenerateInput, facts: ReturnType<typeof collectPosterFacts>['facts'], copy: CopyResult, slot: 'offer' | 'audience' | 'bonus') {
  const purpose = String(input.purpose || '')
  const style = String(input.style || '')
  const industry = String(input.industry || '')
  if (intent.scene === 'food') {
    if (slot === 'offer') return compactDeckLine(/品牌宣传/.test(purpose) ? '现制上桌/风味稳' : /门店导流|引流/.test(purpose) ? '到店更快/出餐稳' : '限时尝鲜/现在值', 12, '')
    if (slot === 'audience') return compactDeckLine(/健身|轻食/.test(`${industry} ${input.content || ''}`) ? '轻食午餐/健身友好' : '午晚餐都适合/轻负担', 12, '')
    return compactDeckLine(/高级简约|轻奢质感/.test(style) ? '清爽口感/轻盈体验' : '现点现做/风味在线', 12, '')
  }
  if (slot === 'offer') return compactDeckLine(/品牌宣传/.test(purpose) ? '品牌主推/场景准' : /产品发布|上新/.test(purpose) ? '首发亮相/入手有理' : '限时权益/入手更值', 12, '')
  if (slot === 'audience') {
    if (/母婴/.test(industry)) return compactDeckLine('家庭囤货/刚需友好', 12, '')
    if (/美妆/.test(industry)) return compactDeckLine('通勤妆容/新手友好', 12, '')
    return compactDeckLine('自用送礼/场景明确', 12, '')
  }
  return compactDeckLine(/高级简约|杂志大片|轻奢质感/.test(style) ? '质感升级/使用有感' : '赠品加码/现在可冲', 12, '')
}
function buildEventHint(slot: 'time' | 'place' | 'highlight') {
  if (slot === 'time') return compactDeckLine('周末到场/预约入场', 12, '')
  if (slot === 'place') return compactDeckLine('沉浸展区/联名共创', 12, '')
  return compactDeckLine('打卡福利/限定周边', 12, '')
}
function buildFoodVisitLine(input: PosterGenerateInput, facts: ReturnType<typeof collectPosterFacts>['facts']) {
  const joined = `${input.content || ''} ${facts.place || ''}`
  const matched = joined.match(/到店自提更快|到店即取|工作日午晚餐|午晚餐都适合|现点现做|门店现制/)
  if (/到店自提/.test(joined)) return compactDeckLine('到店自提更快', 14, '')
  if (/午晚餐/.test(joined)) return compactDeckLine('午晚餐都适合', 14, '')
  if (matched?.[0]) return compactDeckLine(matched[0], 14, '')
  return compactDeckLine(facts.place || '工作日到店更省时', 14, '工作日到店更省时')
}
function buildFoodAudienceValue(input: PosterGenerateInput, facts: ReturnType<typeof collectPosterFacts>['facts']) {
  const joined = `${input.content || ''} ${facts.audience || ''} ${facts.benefit || ''}`
  if (/健身|高蛋白|轻食/.test(joined)) return compactDeckLine('轻食午餐/健身友好', 14, '轻食午餐/健身友好')
  if (/午餐|晚餐/.test(joined)) return compactDeckLine('午餐晚餐/轻负担', 14, '午餐晚餐/轻负担')
  return compactDeckLine(facts.audience || '午餐晚餐/轻负担', 14, '午餐晚餐/轻负担')
}
function buildFoodFeatureValue(input: PosterGenerateInput, facts: ReturnType<typeof collectPosterFacts>['facts'], copy: CopyResult) {
  const joined = `${input.content || ''} ${input.theme || ''} ${facts.benefit || ''} ${copy.slogan || ''}`
  if (/低脂/.test(joined) && /高蛋白/.test(joined)) return compactDeckLine('低脂高蛋白', 14, '低脂高蛋白')
  if (/牛油果|鸡胸|能量碗/.test(joined)) return compactDeckLine('鸡胸牛油果碗', 14, '鸡胸牛油果碗')
  return compactDeckLine(facts.benefit || copy.offerLine || '现制轻食', 14, '现制轻食')
}
function buildCommerceAudienceValue(input: PosterGenerateInput, facts: ReturnType<typeof collectPosterFacts>['facts'], copy: CopyResult) {
  const purpose = String(input.purpose || '')
  const industry = String(input.industry || '')
  const joined = `${input.content || ''} ${copy.slogan || ''} ${copy.body || ''}`
  if (/品牌宣传/.test(purpose) && /美妆/.test(industry)) {
    const matched = joined.match(/通勤妆容|养肤底妆|全天持妆|伪素颜/)
    return compactDeckLine(matched?.[0] || '通勤妆容/养肤底妆', 14, '通勤妆容/养肤底妆')
  }
  if (/品牌宣传/.test(purpose) && /母婴/.test(industry)) return compactDeckLine('安心育儿/家庭日常', 14, '安心育儿/家庭日常')
  return compactDeckLine(facts.audience || '', 14, '')
}
function buildCommerceFeatureValue(input: PosterGenerateInput, facts: ReturnType<typeof collectPosterFacts>['facts'], copy: CopyResult) {
  const purpose = String(input.purpose || '')
  const industry = String(input.industry || '')
  const joined = `${input.content || ''} ${copy.slogan || ''} ${copy.body || ''}`
  if (/品牌宣传/.test(purpose) && /美妆/.test(industry)) {
    const matched = joined.match(/服帖光泽|原生光感|持妆在线|轻透无瑕/)
    return compactDeckLine(matched?.[0] || '服帖光泽/持妆在线', 14, '服帖光泽/持妆在线')
  }
  if (/品牌宣传/.test(purpose)) {
    const matched = joined.match(/新品首发|限定加赠|体验礼遇|光泽妆效|养肤底妆|核心卖点/)
    if (matched?.[0]) return compactDeckLine(matched[0], 14, '')
  }
  return compactDeckLine(facts.benefit || copy.offerLine || '', 14, '')
}
function buildCommerceSupportValue(input: PosterGenerateInput, facts: ReturnType<typeof collectPosterFacts>['facts'], copy: CopyResult) {
  const joined = `${input.content || ''} ${copy.slogan || ''} ${copy.body || ''}`
  if (/美妆/.test(String(input.industry || ''))) {
    if (/通勤/.test(joined) && /光泽|焕亮|服帖/.test(joined)) return compactDeckLine('通勤养肤底妆 · 轻透融肤光泽', 26, '')
    if (/养肤/.test(joined) && /底妆/.test(joined)) return compactDeckLine('养肤底妆 · 轻薄不假面', 26, '')
  }
  return buildPosterShortCombo([
    buildCommerceAudienceValue(input, facts, copy),
    buildCommerceFeatureValue(input, facts, copy),
    copy.offerLine,
  ], 18, '')
}
function buildBrandCommerceOfferLine(input: PosterGenerateInput, facts: ReturnType<typeof collectPosterFacts>['facts'], copy: CopyResult) {
  const industry = String(input.industry || '')
  if (/美妆/.test(industry)) return compactDeckLine('新品体验礼遇 / 尊享品牌加赠', 22, '新品体验礼遇 / 尊享品牌加赠')
  if (/母婴/.test(industry)) return compactDeckLine('新品体验礼遇 / 家庭安心之选', 22, '新品体验礼遇 / 家庭安心之选')
  return compactDeckLine('品牌体验礼遇 / 限定加赠上线', 22, '品牌体验礼遇 / 限定加赠上线')
}
function buildEventTimeValue(input: PosterGenerateInput, facts: ReturnType<typeof collectPosterFacts>['facts'], copy: CopyResult) {
  if (facts.time) return compactDeckLine(facts.time, 14, '')
  const joined = `${input.content || ''} ${copy.urgencyLine || ''}`
  const matched = joined.match(/周末|本周|限时开放|本周末|即将开启|限量席位/)
  return compactDeckLine(matched?.[0] || '周末限定开放', 14, '周末限定开放')
}
function buildEventPlaceValue(input: PosterGenerateInput, facts: ReturnType<typeof collectPosterFacts>['facts'], copy: CopyResult) {
  const joined = `${input.content || ''} ${copy.slogan || ''} ${copy.body || ''}`
  const matched = joined.match(/品牌联名展区|生活方式展区|会场体验区|现场打卡区|城市中心展区|沉浸展区|周末沉浸体验/)
  if (matched?.[0]) return compactDeckLine(matched[0], 14, '沉浸式现场体验')
  if (facts.place && !/生活方式、品牌联名展区与周末/.test(facts.place)) return compactDeckLine(facts.place, 14, '')
  return compactDeckLine('品牌联名展区', 14, '品牌联名展区')
}
function buildEventHighlightValue(input: PosterGenerateInput, facts: ReturnType<typeof collectPosterFacts>['facts'], copy: CopyResult) {
  const purpose = String(input.purpose || '')
  const joined = `${input.content || ''} ${copy.offerLine || ''} ${copy.slogan || ''}`
  if (/品牌宣传/.test(purpose)) {
    const matched = joined.match(/品牌联名|沉浸体验|主视觉氛围|限定展区|周末体验|打卡福利|限定周边/)
    return compactDeckLine(matched?.[0] || '联名体验', 14, '联名体验')
  }
  return compactDeckLine(copy.offerLine || facts.benefit || '现场亮点', 14, '现场亮点')
}
function buildFestivalSceneValue(input: PosterGenerateInput, facts: ReturnType<typeof collectPosterFacts>['facts'], copy: CopyResult) {
  const joined = `${input.content || ''} ${copy.slogan || ''}`
  const matched = joined.match(/送礼场景|节日心意|限定礼盒|团圆分享|节日氛围|限定上新/)
  if (matched?.[0] === '限定礼盒') return compactDeckLine('送礼分享 / 团圆心意', 14, '送礼分享 / 团圆心意')
  return compactDeckLine(matched?.[0] || facts.audience || '送礼场景 / 节日心意', 14, '送礼场景 / 节日心意')
}
function buildFitnessAudienceValue(input: PosterGenerateInput, facts: ReturnType<typeof collectPosterFacts>['facts'], copy: CopyResult) {
  const joined = `${input.content || ''} ${copy.slogan || ''}`
  const matched = joined.match(/久坐人群|新手友好|塑形需求|体态改善|核心训练|上班族/)
  return compactDeckLine(matched?.[0] || facts.audience || '久坐人群 / 新手友好', 14, '久坐人群 / 新手友好')
}
function buildFitnessOutcomeValue(input: PosterGenerateInput, facts: ReturnType<typeof collectPosterFacts>['facts'], copy: CopyResult) {
  const joined = `${input.content || ''} ${copy.offerLine || ''} ${copy.slogan || ''}`
  const matched = joined.match(/体态改善|燃脂塑形|线条紧致|轻松开练|陪练打卡|核心稳定/)
  return compactDeckLine(matched?.[0] || facts.benefit || copy.offerLine || '燃脂塑形 / 线条更稳', 14, '燃脂塑形 / 线条更稳')
}
function buildCourseCardHint(input: PosterGenerateInput, slot: 'audience' | 'outcome' | 'signup') {
  const purpose = String(input.purpose || '')
  if (slot === 'audience') return compactDeckLine(/品牌宣传/.test(purpose) ? '适合系统进阶' : '适合立即入门', 12, '')
  if (slot === 'outcome') return compactDeckLine(/课程推广|报名/.test(purpose) ? '结果导向 / 可落地' : '模块清晰 / 可实践', 12, '')
  return compactDeckLine(/报名/.test(purpose) ? '立即锁定席位' : '咨询后可报名', 12, '')
}
function buildCommerceLikeBadge(
  intent: PosterIntent,
  facts: ReturnType<typeof collectPosterFacts>['facts'],
  offerLine: string,
  urgencyLine: string,
  copy: CopyResult,
) {
  const raw = compactDeckLine(copy.badge, 8, '')
  if (raw) return compactDeckLine(raw, 8, raw)
  if (intent.scene === 'recruitment') {
    const recruitCandidates = [
      /应届|零经验/.test(`${copy.slogan || ''} ${copy.body || ''} ${copy.offerLine || ''}`) ? '零经验可投' : '',
      facts.time && /急招|限时|本周|今日/.test(facts.time) ? facts.time : '',
      '品牌直聘',
      '门店热招',
    ].filter(Boolean)
    return compactDeckLine(recruitCandidates[0] || '', 8, '')
  }
  const candidates = intent.scene === 'food'
    ? [facts.time, facts.price, offerLine, urgencyLine]
    : [facts.time, facts.price, offerLine, urgencyLine]
  return compactDeckLine(candidates.find((item) => String(item || '').trim()) || '', 8, '')
}
function shouldUseRefinedHeadline(headline: string, intent: PosterIntent) {
  const raw = String(headline || '').trim()
  if (!raw || isWeakCopy(raw)) return true
  if (/[把将需已可更来在闭]$/.test(raw)) return true
  if (/把.+一次|下单理由|卖点|优惠力度|关键信息|核心亮点/.test(raw)) return true
  if ((intent.scene === 'food' || intent.scene === 'commerce') && raw.length > 14) return true
  return false
}
function shouldUseRefinedSupportLine(supportLine: string, heroHeadline: string) {
  const raw = String(supportLine || '').trim()
  if (!raw || isWeakCopy(raw)) return true
  if (canonicalCopyText(raw) === canonicalCopyText(heroHeadline)) return true
  if (/把.+一次|主卖点|优惠力度|下单理由|关键信息已整理/.test(raw)) return true
  if (/^(人才|人群|适合谁|限时|报名)$/u.test(raw)) return true
  if (/｜(?:限时|报名|优惠|同|人|群)$/u.test(raw)) return true
  if (/[培招报提系突营岗薪课]$/u.test(raw)) return true
  if (/零基础运营和设计同$|久坐上班族与新手｜限时$/u.test(raw)) return true
  const slashParts = raw.split(/[\/｜|]/).map((item) => canonicalCopyText(item)).filter(Boolean)
  if (slashParts.length >= 2 && slashParts.some((item, index) => slashParts.findIndex((cur) => cur === item || cur.includes(item) || item.includes(cur)) !== index)) return true
  const segments = splitPosterInfoSegments(raw).map((item) => canonicalCopyText(item)).filter(Boolean)
  if (segments.length >= 3) return true
  if (segments.some((item, index) => segments.indexOf(item) !== index)) return true
  if (/[｜|]/.test(raw) && /底薪|提成|薪资|面议/.test(raw)) return true
  if (/[｜|]/.test(raw) && /直播|作业|点评|案例|提示词|实战|陪跑/.test(raw)) return true
  return false
}
function deriveContentPattern(intent: PosterIntent, copyDeck: PosterCopyDeck, sizeKey: string): PosterContentPattern {
  if (copyDeck.priceBlock) return sizeKey === 'ecommerce' ? 'price-first' : 'info-cards'
  if (['festival', 'event', 'social', 'fitness'].includes(intent.scene)) return 'immersive-hero'
  if (copyDeck.factCards.length >= 3 && intent.scene === 'recruitment') return 'list-info'
  if (copyDeck.factCards.length >= 3) return 'info-cards'
  if (sizeKey === 'wechat-cover') return 'cover-story'
  return 'cover-story'
}
function deriveEmphasisOrder(intent: PosterIntent, copyDeck: PosterCopyDeck): PosterEmphasisRole[] {
  const roles: PosterEmphasisRole[] = ['heroHeadline', 'supportLine']
  if (copyDeck.priceBlock) roles.push('priceBlock')
  if (copyDeck.factCards.length) roles.push('factCards')
  if (copyDeck.offerLine) roles.push('offerLine')
  if (copyDeck.proofPoints.length) roles.push('proofPoints')
  if (intent.scene === 'recruitment' && copyDeck.audienceLine) roles.push('audienceLine')
  if (copyDeck.trustLine) roles.push('trustLine')
  if (copyDeck.urgencyLine) roles.push('urgencyLine')
  if (copyDeck.actionReason) roles.push('actionReason')
  roles.push('cta')
  return roles
}
function normalizeFactCards(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map((item: any) => ({
      label: compactDeckLine(item?.label, 6),
      value: compactDeckLine(item?.value, 18),
      hint: compactDeckLine(item?.hint, 16),
    }))
    .filter((item) => item.value)
    .slice(0, 4)
}
function pickFactCardValueByLabel(cards: PosterFactCard[], pattern: RegExp) {
  const hit = cards.find((item) => pattern.test(String(item.label || '')))
  return hit?.value || hit?.hint || ''
}
function normalizePriceBlockValue(value: any): PosterPriceBlock | null {
  if (!value || typeof value !== 'object') return null
  const tag = compactDeckLine(value.tag, 6)
  const amount = compactDeckLine(value.value, 12)
  if (!tag && !amount) return null
  return {
    tag,
    value: amount,
    suffix: compactDeckLine(value.suffix, 4),
    note: compactDeckLine(value.note, 16),
  }
}
function buildPosterCopyDeck(input: PosterGenerateInput, copy: CopyResult, intent: PosterIntent, suggestion?: Partial<PosterCopyDeck>): PosterCopyDeck {
  const { facts } = collectPosterFacts(input)
  const offerFallback = (intent.scene === 'commerce' || intent.scene === 'food' || intent.scene === 'festival')
    ? (/品牌宣传/.test(String(input.purpose || '')) && intent.scene === 'commerce'
      ? buildBrandCommerceOfferLine(input, facts, copy)
      : buildMissingCommerceLikeOffer(intent, input, facts))
    : (intent.scene === 'recruitment'
      ? (buildRecruitmentOfferLine(input, facts, copy) || '培训清晰 / 晋升可见 / 节奏友好')
      : (facts.price || facts.benefit || copy.slogan))
  const urgencyFallback = (intent.scene === 'commerce' || intent.scene === 'food' || intent.scene === 'festival')
    ? buildMissingCommerceLikeUrgency(intent, input, facts)
    : facts.time || ''
  let offerLine = compactDeckLine(suggestion?.offerLine || copy.offerLine, 22, offerFallback)
  if (intent.scene === 'recruitment' && (/店长|咖啡师|运营助理|招聘|岗位开放/.test(offerLine) || canonicalCopyText(offerLine) === canonicalCopyText(buildRecruitmentRoleLine(input, '')))) {
    offerLine = compactDeckLine(offerFallback, 22, offerFallback)
  }
  if (intent.scene === 'commerce' && /品牌宣传/.test(String(input.purpose || '')) && /首发|限时礼遇|赠同款|体验装|加赠/.test(offerLine) && offerLine.length > 18) {
    offerLine = compactDeckLine(buildBrandCommerceOfferLine(input, facts, copy), 22, offerFallback)
  }
  const urgencyLine = compactDeckLine(suggestion?.urgencyLine || copy.urgencyLine, 18, urgencyFallback)
  const suggestedProofPoints = normalizeCopySegments(suggestion?.proofPoints, 5)
  const proofPoints = suggestedProofPoints.length
    ? suggestedProofPoints
    : (intent.scene === 'commerce' || intent.scene === 'food')
      ? buildCommerceLikeProofPoints(input, intent, facts, copy, offerLine, urgencyLine)
      : normalizeCopySegments(copy.proofPoints?.length ? copy.proofPoints : copy.body, 5)
  const factCards = normalizeFactCards(suggestion?.factCards).length
    ? normalizeFactCards(suggestion?.factCards)
    : buildPosterFactCards(input, {
    ...copy,
    offerLine,
    urgencyLine,
    proofPoints,
  }, intent)
  const normalizedFactCards = normalizeSceneFactCards(input, intent, {
    ...copy,
    offerLine,
    urgencyLine,
    proofPoints,
  }, factCards)
  const ctaAlternatives = normalizeCtaList(
    suggestion?.ctaAlternatives?.length ? suggestion.ctaAlternatives : copy.ctaAlternatives?.length ? copy.ctaAlternatives : copy.cta ? [copy.cta] : [],
    4,
  )
  const sceneSupportFallback = buildSceneRefinedSupport(input, intent, facts, {
    heroHeadline: '',
    supportLine: '',
    offerLine,
    urgencyLine,
    actionReason: copy.actionReason || facts.benefit || offerLine,
    cta: copy.cta,
    ctaAlternatives,
    badge: copy.badge || '',
    proofPoints,
    factCards: normalizedFactCards,
    priceBlock: null,
    audienceLine: '',
    trustLine: '',
  })
  const factSupportFallback = buildFactDrivenSupportLine(input, intent, facts, copy, offerLine, proofPoints)
  const supportFallback = intent.scene === 'recruitment'
    ? (factSupportFallback || sceneSupportFallback)
    : intent.scene === 'course' || intent.scene === 'fitness' || intent.scene === 'event' || intent.scene === 'festival'
      ? (sceneSupportFallback || factSupportFallback)
    : (sceneSupportFallback || factSupportFallback)
  const priceBlock = normalizePriceBlockValue(suggestion?.priceBlock) || buildPosterPriceBlock(input, {
    ...copy,
    offerLine,
    urgencyLine,
    proofPoints,
  }, intent)
  const rawHeadline = suggestion?.heroHeadline || copy.title
  const headline = normalizePosterHeadline(rawHeadline, buildThemeFactHeadline(input, facts))
  const heroHeadline = shouldUseRefinedHeadline(headline, intent) || looksLikeClippedPosterLine(rawHeadline, headline, 18)
    ? buildThemeFactHeadline(input, facts)
    : headline
  const rawSupportLine = suggestion?.supportLine || copy.slogan
  const supportLine = compactDeckLine(rawSupportLine, 26, supportFallback)
  const finalSupportLine = shouldUseRefinedSupportLine(supportLine, heroHeadline) || looksLikeClippedPosterLine(rawSupportLine, supportLine, 26)
    ? supportFallback
    : supportLine
  const derivedAudienceLine = pickFactCardValueByLabel(normalizedFactCards, /适合|对象|人群|岗位|课程对象|适合谁/)
  const derivedTrustLine = pickFactCardValueByLabel(normalizedFactCards, /保障|时效|发货|福利|背书|服务|加码|亮点|报名/)
  const audienceLine = buildSceneAudienceLine(input, intent, {
    ...copy,
    offerLine,
    urgencyLine,
    proofPoints,
  }, normalizedFactCards)
  const trustLine = buildSceneTrustLine(input, intent, {
    ...copy,
    offerLine,
    urgencyLine,
    proofPoints,
  }, normalizedFactCards)
  return {
    heroHeadline,
    supportLine: finalSupportLine,
    offerLine,
    urgencyLine: compactDeckLine(suggestion?.urgencyLine || urgencyLine, 18, ''),
    actionReason: compactDeckLine(
      suggestion?.actionReason || facts.benefit || proofPoints.find((item) => !canonicalCopyText(item).includes(canonicalCopyText(offerLine))) || offerLine,
      22,
      '',
    ),
    cta: pickPrimaryCta(compactDeckLine(suggestion?.cta || copy.cta, 8, buildCta(input.purpose || '')), ctaAlternatives),
    ctaAlternatives,
    badge: compactDeckLine(suggestion?.badge || buildCommerceLikeBadge(intent, facts, offerLine, urgencyLine, copy), 8, ''),
    proofPoints,
    factCards: normalizedFactCards,
    priceBlock,
    audienceLine: compactDeckLine(
      suggestion?.audienceLine || audienceLine || facts.audience || derivedAudienceLine || '',
      22,
      '',
    ),
    trustLine: compactDeckLine(
      suggestion?.trustLine || trustLine || facts.place || facts.benefit || derivedTrustLine || '',
      22,
      '',
    ),
  }
}
function applyCopyDeckToCopy(copy: CopyResult, copyDeck: PosterCopyDeck, intent: PosterIntent): CopyResult {
  return {
    ...copy,
    title: copyDeck.heroHeadline,
    slogan: copyDeck.supportLine,
    body: normalizeCopySegments([
      ...copyDeck.proofPoints,
      copyDeck.offerLine,
      copyDeck.urgencyLine,
      copyDeck.actionReason,
      copyDeck.audienceLine,
    ], 5).join('｜'),
    cta: copyDeck.cta,
    ctaAlternatives: copyDeck.ctaAlternatives,
    badge: copyDeck.badge,
    offerLine: copyDeck.offerLine,
    urgencyLine: copyDeck.urgencyLine,
    proofPoints: copyDeck.proofPoints,
    posterIntent: intent,
    copyDeck,
  }
}
function buildPosterProtocol(input: PosterGenerateInput, copy: CopyResult, suggestion?: PosterProtocolSuggestion) {
  const normalized = enrichPosterCopy(input, copy)
  const intent = buildPosterIntentFromSuggestion(input, normalized, suggestion?.posterIntent)
  const copyDeck = buildPosterCopyDeck(input, normalized, intent, suggestion?.copyDeck)
  return {
    posterIntent: intent,
    copyDeck,
    copy: applyCopyDeckToCopy(normalized, copyDeck, intent),
  }
}
function buildPosterQualityHints(plan: NonNullable<PosterGenerateResult['designPlan']>, copyDeck: PosterCopyDeck, hasHero: boolean) {
  const hints = new Set<string>()
  if (hasHero) hints.add('主视觉已全屏铺满并保持不透明')
  if (plan.textStrategy === 'panel') hints.add('已启用信息面板增强文字可读性')
  if (copyDeck.priceBlock) hints.add('已启用价格块模式')
  if (copyDeck.factCards.length >= 3) hints.add('已启用信息卡模式')
  if (copyDeck.urgencyLine) hints.add('已加入稀缺提醒')
  if (copyDeck.ctaAlternatives?.length >= 3) hints.add('已生成多种 CTA 表达可供排版选择')
  if (plan.ctaStyle?.placement === 'with-price') hints.add('已启用价格联动 CTA')
  if (plan.ctaStyle?.placement === 'bottom-bar') hints.add('已启用底部行动条 CTA')
  if (plan.ctaStyle?.variant === 'sticker') hints.add('已启用贴纸式 CTA 强化氛围感')
  if (plan.ctaStyle?.variant === 'underline') hints.add('已启用编辑感轻按钮样式')
  if (plan.contentPattern === 'list-info') hints.add('已启用清单式信息排版')
  if (plan.contentPattern === 'price-first') hints.add('已优先突出转化利益点')
  if (plan.contentPattern === 'immersive-hero') hints.add('已启用主视觉沉浸式排版')
  return Array.from(hints)
}
function normalizeQualityText(value: string) {
  return String(value || '')
    .trim()
    .replace(/[：:、,，。.!！?？\s\-_/｜|]+/g, '')
    .toLowerCase()
}
function isWeakQualityText(value: string, minLength = 4) {
  return normalizeQualityText(value).length < minLength
}
function isHeadlineDuplicate(heroHeadline: string, supportLine: string) {
  const left = normalizeQualityText(heroHeadline)
  const right = normalizeQualityText(supportLine)
  if (!left || !right) return false
  return left === right || left.includes(right) || right.includes(left)
}
function evaluatePosterQuality(plan: NonNullable<PosterGenerateResult['designPlan']>, copyDeck: PosterCopyDeck, hasHero: boolean): PosterQualityReport {
  const issues: PosterQualityIssue[] = []
  if (!hasHero) issues.push({ code: 'hero_missing', message: '主视觉缺失，当前成片更像纯排版草案。', level: 'warn' })
  if (plan.layoutFamily !== 'split-editorial' && plan.layoutFamily !== 'clean-course' && !hasHero) {
    issues.push({ code: 'full_bleed_expected', message: '当前骨架更适合全屏主图，但未检测到可用主图。', level: 'warn' })
  }
  if (!copyDeck.heroHeadline || !copyDeck.supportLine) issues.push({ code: 'headline_weak', message: '标题或副标题不足，成片层级会偏弱。', level: 'error' })
  if (isHeadlineDuplicate(copyDeck.heroHeadline, copyDeck.supportLine)) {
    issues.push({ code: 'headline_duplicate', message: '标题与副标题表达过近，第一屏层级不够分工。', level: 'error' })
  }
  if (isWeakQualityText(copyDeck.cta, 2)) issues.push({ code: 'cta_missing', message: 'CTA 过弱或缺失，转化动作不明确。', level: 'error' })
  if (!copyDeck.factCards.length && !copyDeck.proofPoints.length) issues.push({ code: 'detail_missing', message: '缺少卖点条或信息卡，商业完成度不足。', level: 'error' })
  if (!copyDeck.urgencyLine && !copyDeck.priceBlock && !copyDeck.actionReason) issues.push({ code: 'conversion_missing', message: '缺少价格、稀缺或行动理由，转化信息偏弱。', level: 'warn' })
  if (copyDeck.proofPoints.length > 0) {
    const uniqueProofs = new Set(copyDeck.proofPoints.map((item) => normalizeQualityText(item)).filter(Boolean))
    if (uniqueProofs.size <= 1 && copyDeck.proofPoints.length > 1) {
      issues.push({ code: 'proof_duplicate', message: '卖点信息重复度过高，容易显得模板化。', level: 'warn' })
    }
  }
  if (plan.contentPattern === 'price-first' && !copyDeck.priceBlock) {
    issues.push({ code: 'price_missing', message: '当前版式需要价格利益块，但未生成有效价格结构。', level: 'error' })
  }
  if (plan.contentPattern === 'list-info' && copyDeck.factCards.length < 2) {
    issues.push({ code: 'list_info_thin', message: '当前版式偏清单信息型，但信息卡数量不足。', level: 'warn' })
  }
  if (plan.contentPattern === 'immersive-hero' && !copyDeck.offerLine && !copyDeck.urgencyLine) {
    issues.push({ code: 'hero_info_thin', message: '主视觉气氛足够，但利益点或稀缺提醒偏弱。', level: 'warn' })
  }
  if (plan.layoutFamily === 'premium-offer' && !copyDeck.priceBlock) {
    issues.push({ code: 'premium_offer_without_price', message: '优惠型骨架缺少价格块，成片感会明显下降。', level: 'error' })
  }
  if (plan.layoutFamily === 'grid-product' && copyDeck.factCards.length < 2) {
    issues.push({ code: 'grid_product_without_cards', message: '商品信息栅格缺少足够信息卡，画面会显得空。', level: 'warn' })
  }
  if (plan.layoutFamily === 'list-recruitment') {
    if (copyDeck.factCards.length < 2) issues.push({ code: 'recruitment_cards_missing', message: '招聘版式缺少岗位/福利信息卡，完成度不足。', level: 'error' })
    if (!copyDeck.audienceLine) issues.push({ code: 'recruitment_audience_missing', message: '招聘海报缺少适合人群提示，筛选效率偏弱。', level: 'warn' })
    if (!copyDeck.trustLine) issues.push({ code: 'recruitment_trust_missing', message: '招聘海报缺少背书句，可信度不足。', level: 'warn' })
  }
  if (plan.layoutFamily === 'clean-course') {
    if (!copyDeck.audienceLine) issues.push({ code: 'course_audience_missing', message: '课程海报缺少适合谁，报名判断成本偏高。', level: 'warn' })
    if (!copyDeck.actionReason) issues.push({ code: 'course_reason_missing', message: '课程海报缺少立即行动理由，转化驱动偏弱。', level: 'warn' })
  }
  const errorCount = issues.filter((item) => item.level === 'error').length
  const warnCount = issues.filter((item) => item.level === 'warn').length
  const score = Math.max(0, 100 - errorCount * 25 - warnCount * 10)
  const failureTags = issues.map((item) => item.code)
  return {
    pass: errorCount === 0,
    score,
    needsRefine: score < 85,
    issues,
    failureTags,
  }
}
function buildSceneRefinedHeadline(input: PosterGenerateInput, intent: PosterIntent, facts: ReturnType<typeof collectPosterFacts>['facts']) {
  const theme = pickThemeCore(input.theme || '', input.industry || '')
  const named = theme && theme !== 'AI海报'
  switch (intent.scene) {
    case 'commerce':
      return clipPosterText(named ? `${theme}现在更值得买` : '这波优惠现在就下单', 18)
    case 'food':
      return clipPosterText(named ? `${theme}这一口先尝鲜` : '人气新品现在开吃', 18)
    case 'recruitment':
      return clipPosterText(named ? `${theme}岗位正在补位` : '这份机会现在别错过', 18)
    case 'course':
      return clipPosterText(named ? `${theme}这一期现在报名` : '这门课现在开始更值', 18)
    case 'social':
      return clipPosterText(named ? `${theme}这篇先收藏` : '这条内容先存住', 18)
    case 'festival':
      return clipPosterText(named ? `${theme}限定礼遇正在上新` : '节日礼遇现在就安排', 18)
    case 'fitness':
      return clipPosterText(named ? `${theme}现在开练更容易坚持` : '训练计划现在就开始', 18)
    case 'event':
      return clipPosterText(named ? `${theme}这场活动值得到场` : '这场活动现在就锁定', 18)
    default:
      return clipPosterText(facts.benefit || facts.price || '核心亮点现在上版', 18)
  }
}
function buildSceneRefinedSupport(input: PosterGenerateInput, intent: PosterIntent, facts: ReturnType<typeof collectPosterFacts>['facts'], deck: PosterCopyDeck) {
  switch (intent.scene) {
    case 'commerce':
      return compactDeckLine(
        buildCommerceSupportValue(input, facts, { ...deck, title: '', slogan: '', body: '' } as CopyResult),
        26,
        '核心卖点/适用场景/入手理由',
      )
    case 'food':
      return buildPosterShortCombo([
        /低脂|高蛋白|轻食|牛油果|鸡胸/.test(`${input.content || ''} ${facts.benefit || ''}`)
          ? buildPosterShortCombo([
            /低脂/.test(`${input.content || ''} ${facts.benefit || ''}`) ? '低脂轻负担' : '',
            /高蛋白/.test(`${input.content || ''} ${facts.benefit || ''}`) ? '高蛋白饱腹' : '',
            /牛油果|鸡胸|能量碗/.test(`${input.content || ''} ${input.theme || ''}`) ? '招牌能量碗' : '',
          ], 18, '')
          : facts.benefit,
        buildFoodVisitLine(input, facts),
        /午晚餐/.test(`${input.content || ''} ${deck.offerLine || ''}`) ? '午晚餐都适合' : deck.offerLine,
      ], 26, '招牌风味/到店更快/现在尝鲜')
    case 'recruitment':
      return compactDeckLine(facts.benefit || facts.price || facts.place, 26, '岗位价值、福利条件和投递窗口一次说清')
    case 'course':
      return compactDeckLine([buildCourseOutcomeLine(input, facts, { ...deck, title: '', slogan: '', body: '' } as CopyResult), buildCourseAudienceHint(input, facts)].filter(Boolean).join('｜'), 26, '适合谁学、能学到什么和为什么现在报名')
    case 'social':
      return compactDeckLine(facts.benefit || deck.offerLine || deck.actionReason, 26, '最值得冲的点、适合谁看和为什么先收藏一次说透')
    case 'festival':
      return compactDeckLine(deck.offerLine || deck.urgencyLine || facts.benefit, 26, '限定礼遇、送礼场景和参与理由一次到位')
    case 'fitness':
      return compactDeckLine([buildFitnessAudienceValue(input, facts, { ...deck, title: '', slogan: '', body: '' } as CopyResult), buildFitnessOutcomeValue(input, facts, { ...deck, title: '', slogan: '', body: '' } as CopyResult)].filter(Boolean).join('｜'), 26, '适合对象、训练收益和开练理由一次说透')
    case 'event':
      return compactDeckLine(
        buildPosterShortCombo([
          buildEventPlaceValue(input, facts, { ...deck, title: '', slogan: '', body: '' } as CopyResult),
          buildEventHighlightValue(input, facts, { ...deck, title: '', slogan: '', body: '' } as CopyResult),
          buildEventTimeValue(input, facts, { ...deck, title: '', slogan: '', body: '' } as CopyResult),
        ], 20, '联名展区/打卡福利/周末到场'),
        26,
        '联名展区/打卡福利/周末到场',
      )
    default:
      return compactDeckLine(deck.offerLine || deck.actionReason || facts.benefit, 26, '关键信息已经整理成适合海报成片的结构')
  }
}
function refinePosterProtocolLocally(
  input: PosterGenerateInput,
  protocol: { posterIntent: PosterIntent; copyDeck: PosterCopyDeck; copy: CopyResult },
  report: PosterQualityReport,
) {
  const fallback = buildInputFactCopy(input)
  const facts = collectPosterFacts(input).facts
  const nextDeck: PosterCopyDeck = clone(protocol.copyDeck)
  const nextIntent = clone(protocol.posterIntent)
  if (report.failureTags?.includes('headline_weak') || report.failureTags?.includes('headline_duplicate')) {
    nextDeck.heroHeadline = buildThemeFactHeadline(input, facts)
    nextDeck.supportLine = buildFactDrivenSupportLine(input, nextIntent, facts, protocol.copy, nextDeck.offerLine, nextDeck.proofPoints)
  }
  if (!nextDeck.offerLine) nextDeck.offerLine = compactDeckLine(facts.price || facts.benefit || fallback.offerLine, 18, fallback.offerLine || '')
  if (!nextDeck.urgencyLine) nextDeck.urgencyLine = compactDeckLine(facts.time || fallback.urgencyLine, 16, fallback.urgencyLine || '')
  if ((nextIntent.scene === 'commerce' || nextIntent.scene === 'food') && (!nextDeck.supportLine || report.failureTags?.includes('detail_missing'))) {
    nextDeck.supportLine = buildFactDrivenSupportLine(input, nextIntent, facts, protocol.copy, nextDeck.offerLine, nextDeck.proofPoints)
  }
  if (!nextDeck.actionReason) nextDeck.actionReason = compactDeckLine(facts.benefit || nextDeck.offerLine || fallback.offerLine, 18, facts.time || facts.place || '')
  if (!nextDeck.badge) nextDeck.badge = buildCommerceLikeBadge(nextIntent, facts, nextDeck.offerLine, nextDeck.urgencyLine, protocol.copy)
  if (!nextDeck.cta || isWeakQualityText(nextDeck.cta, 2)) nextDeck.cta = compactDeckLine(fallback.cta || buildCta(input.purpose || ''), 8, buildCta(input.purpose || ''))
  if (!nextDeck.ctaAlternatives?.length) nextDeck.ctaAlternatives = normalizeCtaList(nextDeck.cta ? [nextDeck.cta] : [], 4)
  nextDeck.cta = pickPrimaryCta(nextDeck.cta, nextDeck.ctaAlternatives)
  if (!nextDeck.proofPoints.length || report.failureTags?.includes('detail_missing') || report.failureTags?.includes('proof_duplicate')) {
    if (nextIntent.scene === 'commerce' || nextIntent.scene === 'food') {
      nextDeck.proofPoints = buildCommerceLikeProofPoints(input, nextIntent, facts, {
        ...protocol.copy,
        offerLine: nextDeck.offerLine,
        urgencyLine: nextDeck.urgencyLine,
      }, nextDeck.offerLine, nextDeck.urgencyLine)
    } else {
    nextDeck.proofPoints = normalizeCopySegments([
      facts.price,
      facts.benefit,
      facts.time,
      facts.place,
      facts.audience,
      ...nextDeck.proofPoints,
      ...normalizeCopySegments(fallback.body, 5),
    ], 5)
    }
  }
  if ((!nextDeck.factCards.length || nextDeck.factCards.length < 2) && ['recruitment', 'commerce', 'food', 'course', 'event', 'festival'].includes(nextIntent.scene)) {
    nextDeck.factCards = buildPosterFactCards(input, {
      ...protocol.copy,
      title: nextDeck.heroHeadline,
      slogan: nextDeck.supportLine,
      offerLine: nextDeck.offerLine,
      urgencyLine: nextDeck.urgencyLine,
      proofPoints: nextDeck.proofPoints,
      cta: nextDeck.cta,
    }, nextIntent)
  }
  nextDeck.factCards = normalizeSceneFactCards(input, nextIntent, {
    ...protocol.copy,
    title: nextDeck.heroHeadline,
    slogan: nextDeck.supportLine,
    offerLine: nextDeck.offerLine,
    urgencyLine: nextDeck.urgencyLine,
    body: nextDeck.proofPoints.join('｜'),
    cta: nextDeck.cta,
    proofPoints: nextDeck.proofPoints,
  }, nextDeck.factCards)
  if (!nextDeck.priceBlock && (report.failureTags?.includes('price_missing') || nextIntent.goal === 'sell')) {
    nextDeck.priceBlock = buildPosterPriceBlock(input, {
      ...protocol.copy,
      title: nextDeck.heroHeadline,
      slogan: nextDeck.supportLine,
      offerLine: nextDeck.offerLine,
      urgencyLine: nextDeck.urgencyLine,
      body: nextDeck.proofPoints.join('｜'),
      cta: nextDeck.cta,
    }, nextIntent)
  }
  if (!nextDeck.audienceLine) nextDeck.audienceLine = buildSceneAudienceLine(input, nextIntent, protocol.copy, nextDeck.factCards)
  if (!nextDeck.trustLine) nextDeck.trustLine = buildSceneTrustLine(input, nextIntent, protocol.copy, nextDeck.factCards)
  return {
    posterIntent: nextIntent,
    copyDeck: nextDeck,
    copy: applyCopyDeckToCopy(protocol.copy, nextDeck, nextIntent),
  }
}
function clamp01(value: number, fallback = 0) {
  const safe = Number.isFinite(value) ? value : fallback
  return Math.max(0, Math.min(1, safe))
}
function normalizeLayoutRect(input: any, fallback: PosterLayoutRect): PosterLayoutRect {
  const x = clamp01(Number(input?.x), fallback.x)
  const y = clamp01(Number(input?.y), fallback.y)
  const maxW = Math.max(0.06, 1 - x)
  const maxH = Math.max(0.06, 1 - y)
  return {
    x,
    y,
    w: Math.max(0.06, Math.min(maxW, clamp01(Number(input?.w), fallback.w))),
    h: Math.max(0.06, Math.min(maxH, clamp01(Number(input?.h), fallback.h))),
  }
}
function buildLocalMultimodalLayoutHints(
  input: PosterGenerateInput,
  posterIntent: PosterIntent,
  copyDeck: PosterCopyDeck,
  designPlan: NonNullable<PosterGenerateResult['designPlan']>,
): PosterMultimodalLayoutHints {
  const darkLike = designPlan.backgroundTone === 'dark' || /夜|黑金|暗黑|科技|霓虹|健身/.test(`${input.style || ''} ${input.theme || ''} ${input.industry || ''}`)
  const recommendedFamily = designPlan.layoutFamily || (copyDeck.priceBlock ? 'premium-offer' : copyDeck.factCards.length >= 3 ? 'grid-product' : posterIntent.scene === 'recruitment' ? 'list-recruitment' : 'hero-center')
  const leftSafe: PosterLayoutZone = { kind: 'safe', label: 'left-copy', reason: '本地兜底文案安全区', ...normalizeLayoutRect({ x: 0.06, y: 0.08, w: 0.42, h: 0.42 }, { x: 0.06, y: 0.08, w: 0.42, h: 0.42 }) }
  const bottomSafe: PosterLayoutZone = { kind: 'safe', label: 'bottom-cta', reason: '底部行动区', ...normalizeLayoutRect({ x: 0.06, y: 0.78, w: 0.36, h: 0.12 }, { x: 0.06, y: 0.78, w: 0.36, h: 0.12 }) }
  const heroAvoid: PosterLayoutZone = { kind: 'avoid', label: 'hero-focus', reason: '默认避开主视觉主体', ...normalizeLayoutRect({ x: 0.54, y: 0.16, w: 0.34, h: 0.52 }, { x: 0.54, y: 0.16, w: 0.34, h: 0.52 }) }
  return {
    safeZones: [leftSafe, bottomSafe],
    avoidZones: [heroAvoid],
    suggestedPlacement: [
      { role: 'badge', align: 'left', priority: 1, ...normalizeLayoutRect({ x: 0.06, y: 0.05, w: 0.14, h: 0.05 }, { x: 0.06, y: 0.05, w: 0.14, h: 0.05 }) },
      { role: 'heroHeadline', align: 'left', priority: 2, ...normalizeLayoutRect({ x: 0.06, y: 0.12, w: 0.42, h: 0.14 }, { x: 0.06, y: 0.12, w: 0.42, h: 0.14 }) },
      { role: 'supportLine', align: 'left', priority: 3, ...normalizeLayoutRect({ x: 0.06, y: 0.28, w: 0.42, h: 0.08 }, { x: 0.06, y: 0.28, w: 0.42, h: 0.08 }) },
      { role: 'body', align: 'left', priority: 4, ...normalizeLayoutRect({ x: 0.06, y: 0.37, w: 0.44, h: 0.16 }, { x: 0.06, y: 0.37, w: 0.44, h: 0.16 }) },
      { role: 'priceBlock', align: 'left', priority: 5, ...normalizeLayoutRect({ x: 0.06, y: 0.58, w: 0.28, h: 0.12 }, { x: 0.06, y: 0.58, w: 0.28, h: 0.12 }) },
      { role: 'cta', align: 'left', priority: 6, ...normalizeLayoutRect({ x: 0.06, y: 0.8, w: 0.32, h: 0.08 }, { x: 0.06, y: 0.8, w: 0.32, h: 0.08 }) },
    ],
    textStyleHints: [
      { role: 'heroHeadline', fill: darkLike ? '#FFFFFF' : '#111827', stroke: darkLike ? '#02061799' : '#FFFFFF88', panel: darkLike ? '#07111FE0' : '#FFFFFFD9', treatment: darkLike ? 'panel' : 'clean', weight: 'bold' },
      { role: 'supportLine', fill: darkLike ? '#E5EDF6' : '#334155', stroke: darkLike ? '#02061780' : '#FFFFFF66', panel: darkLike ? '#07111FD8' : '#FFFFFFD2', treatment: darkLike ? 'panel' : 'clean', weight: 'medium' },
      { role: 'body', fill: darkLike ? '#F8FAFC' : '#1F2937', stroke: darkLike ? '#02061770' : '#FFFFFF55', panel: darkLike ? '#07111FD2' : '#FFFFFFCC', treatment: darkLike ? 'panel' : 'clean', weight: 'regular' },
      { role: 'cta', fill: '#FFFFFF', stroke: '#00000000', panel: '', treatment: 'clean', weight: 'bold' },
      { role: 'badge', fill: '#FFFFFF', stroke: '#00000000', panel: '', treatment: 'clean', weight: 'bold' },
      { role: 'priceBlock', fill: darkLike ? '#FBBF24' : '#C2410C', stroke: darkLike ? '#02061799' : '#FFFFFF88', panel: darkLike ? '#07111FD8' : '#FFFFFFD4', treatment: darkLike ? 'panel' : 'clean', weight: 'bold' },
    ],
    visualAnalysis: {
      dominantTone: darkLike ? 'dark' : (designPlan.backgroundTone || 'mixed'),
      texture: darkLike ? 'detailed' : 'clean',
      focusBias: recommendedFamily === 'split-editorial' ? 'right' : 'left',
      needsPanel: darkLike || designPlan.textStrategy === 'panel',
    },
    layoutDecision: {
      recommendedFamily,
      confidence: 0.44,
      rationale: '无可用多模态图像时，使用本地海报规划与场景规则兜底。',
    },
  }
}
function buildAiPlanDerivedMultimodalLayoutHints(
  posterIntent: PosterIntent,
  copyDeck: PosterCopyDeck,
  designPlan: NonNullable<PosterGenerateResult['designPlan']>,
): PosterMultimodalLayoutHints {
  const planAbsoluteLayout = designPlan && designPlan.absoluteLayout ? designPlan.absoluteLayout : null
  const absoluteLayers = planAbsoluteLayout && Array.isArray(planAbsoluteLayout.layers) ? planAbsoluteLayout.layers : []
  const pick = (role: string) => absoluteLayers.find((item) => item.role === role)
  const hero = pick('hero')
  const title = pick('title')
  const slogan = pick('slogan')
  const body = pick('body')
  const badge = pick('badge')
  const cta = pick('cta')
  const priceNum = pick('priceNum')
  const fallbackSafe = title
    ? normalizeLayoutRect(title, { x: 0.08, y: 0.1, w: 0.34, h: 0.14 })
    : { x: 0.08, y: 0.1, w: 0.34, h: 0.14 }
  const heroAvoid = hero
    ? { kind: 'avoid' as const, label: 'hero-focus', reason: '由 AI 版式规划推断主视觉主体区', ...normalizeLayoutRect(hero, { x: 0.52, y: 0.12, w: 0.34, h: 0.56 }) }
    : { kind: 'avoid' as const, label: 'hero-focus', reason: '由 AI 版式规划推断主视觉主体区', x: 0.54, y: 0.16, w: 0.34, h: 0.52 }
  const placements: PosterPlacementHint[] = [
    badge ? { role: 'badge', align: badge.textAlign || 'left', priority: 1, ...normalizeLayoutRect(badge, { x: 0.08, y: 0.05, w: 0.16, h: 0.045 }) } : null,
    title ? { role: 'heroHeadline', align: title.textAlign || 'left', priority: 2, ...normalizeLayoutRect(title, fallbackSafe) } : null,
    slogan ? { role: 'supportLine', align: slogan.textAlign || 'left', priority: 3, ...normalizeLayoutRect(slogan, { x: fallbackSafe.x, y: Math.min(0.34, fallbackSafe.y + fallbackSafe.h + 0.02), w: fallbackSafe.w, h: 0.08 }) } : null,
    body ? { role: 'body', align: body.textAlign || 'left', priority: 4, ...normalizeLayoutRect(body, { x: fallbackSafe.x, y: 0.38, w: Math.max(0.32, fallbackSafe.w), h: 0.14 }) } : null,
    priceNum ? { role: 'priceBlock', align: priceNum.textAlign || 'left', priority: 5, ...normalizeLayoutRect(priceNum, { x: 0.08, y: 0.62, w: 0.26, h: 0.1 }) } : null,
    cta ? { role: 'cta', align: cta.textAlign || 'center', priority: 6, ...normalizeLayoutRect(cta, { x: 0.08, y: 0.82, w: 0.28, h: 0.08 }) } : null,
  ].filter(Boolean) as PosterPlacementHint[]
  const darkLike = designPlan.backgroundTone === 'dark'
  const panelLike = designPlan.textStrategy === 'panel'
  return {
    safeZones: [
      { kind: 'safe', label: 'primary-copy', reason: '由 AI 版式规划推导主文案安全区', ...fallbackSafe },
      cta ? { kind: 'safe', label: 'cta-zone', reason: '由 AI 版式规划推导行动区', ...normalizeLayoutRect(cta, { x: 0.08, y: 0.82, w: 0.28, h: 0.08 }) } : { kind: 'safe', label: 'cta-zone', reason: '由 AI 版式规划推导行动区', x: 0.08, y: 0.82, w: 0.28, h: 0.08 },
    ],
    avoidZones: [heroAvoid],
    suggestedPlacement: placements,
    textStyleHints: [
      { role: 'heroHeadline', fill: darkLike ? '#FFFFFF' : '#111827', stroke: darkLike ? '#02061799' : '#FFFFFF88', panel: darkLike ? '#07111FE0' : '#FFFFFFE0', treatment: panelLike ? 'panel' : (darkLike ? 'outline' : 'clean'), weight: 'bold' },
      { role: 'supportLine', fill: darkLike ? '#E5EDF6' : '#334155', stroke: darkLike ? '#02061780' : '#FFFFFF66', panel: darkLike ? '#07111FD8' : '#FFFFFFD8', treatment: panelLike ? 'panel' : (darkLike ? 'outline' : 'clean'), weight: 'medium' },
      { role: 'body', fill: darkLike ? '#F8FAFC' : '#1F2937', stroke: darkLike ? '#02061770' : '#FFFFFF55', panel: darkLike ? '#07111FD2' : '#FFFFFFCC', treatment: panelLike ? 'panel' : 'clean', weight: 'regular' },
      { role: 'cta', fill: '#FFFFFF', stroke: '#00000000', panel: '', treatment: 'clean', weight: 'bold' },
      { role: 'badge', fill: '#FFFFFF', stroke: '#00000000', panel: '', treatment: 'clean', weight: 'bold' },
      { role: 'priceBlock', fill: darkLike ? '#FBBF24' : '#C2410C', stroke: darkLike ? '#02061799' : '#FFFFFF88', panel: darkLike ? '#07111FD8' : '#FFFFFFD4', treatment: panelLike ? 'panel' : (darkLike ? 'outline' : 'clean'), weight: 'bold' },
    ],
    visualAnalysis: {
      dominantTone: designPlan.backgroundTone || 'mixed',
      texture: panelLike ? 'detailed' : 'clean',
      focusBias: hero && hero.left >= 0.4 ? 'right' : hero && hero.left <= 0.2 ? 'left' : 'center',
      needsPanel: panelLike,
    },
    layoutDecision: {
      recommendedFamily: String(designPlan.layoutFamily || 'hero-center'),
      confidence: 0.72,
      rationale: '多模态未返回时，沿用上游 AI 版式规划与绝对布局结果，而非本地模板规则。',
    },
  }
}
function guessRectFromVisionText(text: string, fallback: PosterLayoutRect): PosterLayoutRect {
  const hint = String(text || '')
  if (!hint) return fallback
  if (/左上|左侧|左栏|左边/.test(hint)) return normalizeLayoutRect({ x: 0.06, y: 0.1, w: 0.36, h: 0.42 }, fallback)
  if (/右上|右侧|右栏|右边/.test(hint)) return normalizeLayoutRect({ x: 0.58, y: 0.1, w: 0.3, h: 0.42 }, fallback)
  if (/顶部|上方|上部/.test(hint)) return normalizeLayoutRect({ x: 0.08, y: 0.06, w: 0.78, h: 0.14 }, fallback)
  if (/底部|下方|下部/.test(hint)) return normalizeLayoutRect({ x: 0.08, y: 0.76, w: 0.78, h: 0.14 }, fallback)
  if (/中部偏上|中上/.test(hint)) return normalizeLayoutRect({ x: 0.12, y: 0.18, w: 0.7, h: 0.14 }, fallback)
  if (/中部|中央|居中|中间/.test(hint)) return normalizeLayoutRect({ x: 0.16, y: 0.24, w: 0.68, h: 0.26 }, fallback)
  return fallback
}
function mapVisionRoleName(input: any, fallbackRole: PosterPlacementRole = 'body'): PosterPlacementRole {
  const text = String(input?.role || input?.name || input?.label || input?.title || '').toLowerCase()
  if (/heroheadline|maintitle|title|标题/.test(text)) return 'heroHeadline'
  if (/supportline|subtitle|sub.?title|副标题|标语/.test(text)) return 'supportLine'
  if (/cta|button|action|行动|按钮/.test(text)) return 'cta'
  if (/badge|tag|角标|品牌/.test(text)) return 'badge'
  if (/price|价格|售价|优惠/.test(text)) return 'priceBlock'
  if (/body|info|detail|正文|信息|招聘|说明/.test(text)) return 'body'
  return fallbackRole
}
function inferToneFromVisionAnalysis(raw: any, fallback: PosterMultimodalLayoutHints['visualAnalysis']) {
  const source = `${raw?.visualAnalysis?.colorScheme || ''} ${raw?.visualAnalysis?.imageContent || ''} ${raw?.visualAnalysis?.typography || ''}`
  const dominantTone = /深|黑|暗|夜|炭|dark/i.test(source)
    ? 'dark'
    : /白|浅|米白|亮|light/i.test(source)
      ? 'light'
      : fallback.dominantTone
  const texture = /复杂|丰富|细节|dense|detailed/i.test(source) ? 'detailed' : fallback.texture
  const focusBias = /右下|右侧|right/i.test(source)
    ? 'right'
    : /左侧|left/i.test(source)
      ? 'left'
      : /居中|中部|center/i.test(source)
        ? 'center'
        : fallback.focusBias
  const needsPanel = typeof raw?.visualAnalysis?.needsPanel === 'boolean'
    ? raw.visualAnalysis.needsPanel
    : /底板|面板|panel|可读性|反差不足|复杂背景/.test(source)
  return { dominantTone, texture, focusBias, needsPanel }
}
function coerceVisionSafeZones(raw: any, fallback: PosterMultimodalLayoutHints) {
  const items = Array.isArray(raw?.safeZones) ? raw.safeZones : []
  return items.map((zone: any, index: number) => {
    const hint = `${zone?.label || ''} ${zone?.name || ''} ${zone?.position || ''} ${zone?.description || ''}`
    const base = fallback.safeZones[index] || fallback.safeZones[0]
    return {
      kind: 'safe' as const,
      label: String(zone?.label || zone?.name || `safe-${index + 1}`).slice(0, 32),
      reason: String(zone?.reason || zone?.description || '').slice(0, 80),
      ...normalizeLayoutRect(zone?.x != null ? zone : guessRectFromVisionText(hint, base), base),
    }
  })
}
function coerceVisionAvoidZones(raw: any, fallback: PosterMultimodalLayoutHints) {
  const items = Array.isArray(raw?.avoidZones) ? raw.avoidZones : []
  return items.map((zone: any, index: number) => {
    const hint = `${zone?.label || ''} ${zone?.name || ''} ${zone?.position || ''} ${zone?.description || ''}`
    const base = fallback.avoidZones[index] || fallback.avoidZones[0]
    return {
      kind: 'avoid' as const,
      label: String(zone?.label || zone?.name || `avoid-${index + 1}`).slice(0, 32),
      reason: String(zone?.reason || zone?.description || '').slice(0, 80),
      ...normalizeLayoutRect(zone?.x != null ? zone : guessRectFromVisionText(hint, base), base),
    }
  })
}
function coerceVisionPlacement(raw: any, fallback: PosterMultimodalLayoutHints) {
  const items = Array.isArray(raw?.suggestedPlacement) ? raw.suggestedPlacement : []
  return items.map((item: any, index: number) => {
    const fallbackItem = fallback.suggestedPlacement[index] || fallback.suggestedPlacement[0]
    const role = mapVisionRoleName(item, fallbackItem?.role || 'body')
    const hint = `${item?.position || ''} ${item?.description || ''} ${item?.name || ''}`
    return {
      role,
      align: /居中|center/i.test(hint) ? 'center' : /右对齐|靠右|right/i.test(hint) ? 'right' : (item?.align === 'center' || item?.align === 'right' ? item.align : (fallbackItem?.align || 'left')),
      priority: Number.isFinite(Number(item?.priority)) ? Number(item.priority) : index + 1,
      ...normalizeLayoutRect(item?.x != null ? item : guessRectFromVisionText(hint, fallbackItem || fallback.safeZones[0]), fallbackItem || fallback.safeZones[0]),
    }
  })
}
function coerceVisionTextStyleHints(raw: any, fallback: PosterMultimodalLayoutHints) {
  if (Array.isArray(raw?.textStyleHints)) return raw.textStyleHints
  const fillMap = raw?.textStyleHints?.textColor || {}
  const weightMap = raw?.textStyleHints?.fontWeight || {}
  const tone = inferToneFromVisionAnalysis(raw, fallback.visualAnalysis)
  return [
    { role: 'heroHeadline', fill: String(fillMap.mainTitle || fillMap.title || (tone.dominantTone === 'dark' ? '#FFFFFF' : '#111827')), stroke: tone.dominantTone === 'dark' ? '#02061799' : '#FFFFFF88', panel: tone.needsPanel ? (tone.dominantTone === 'dark' ? '#07111FE0' : '#FFFFFFE0') : '', treatment: tone.needsPanel ? 'panel' : (tone.dominantTone === 'dark' ? 'outline' : 'clean'), weight: /bold|heavy|700/i.test(String(weightMap.mainTitle || weightMap.title || '')) ? 'bold' : 'medium' },
    { role: 'supportLine', fill: String(fillMap.subTitle || fillMap.subtitle || (tone.dominantTone === 'dark' ? '#E5EDF6' : '#334155')), stroke: tone.dominantTone === 'dark' ? '#02061780' : '#FFFFFF66', panel: tone.needsPanel ? (tone.dominantTone === 'dark' ? '#07111FD8' : '#FFFFFFD8') : '', treatment: tone.needsPanel ? 'panel' : (tone.dominantTone === 'dark' ? 'outline' : 'clean'), weight: /bold|semi|600/i.test(String(weightMap.subTitle || weightMap.subtitle || '')) ? 'bold' : 'medium' },
    { role: 'body', fill: String(fillMap.bodyText || fillMap.body || (tone.dominantTone === 'dark' ? '#F8FAFC' : '#1F2937')), stroke: tone.dominantTone === 'dark' ? '#02061770' : '#FFFFFF55', panel: tone.needsPanel ? (tone.dominantTone === 'dark' ? '#07111FD2' : '#FFFFFFCC') : '', treatment: tone.needsPanel ? 'panel' : 'clean', weight: 'regular' },
    { role: 'cta', fill: String(fillMap.buttonText || '#FFFFFF'), stroke: '#00000000', panel: '', treatment: 'clean', weight: 'bold' },
  ]
}
function coerceVisionLayoutDecision(raw: any, fallback: PosterMultimodalLayoutHints) {
  const source = `${raw?.layoutDecision?.recommendedFamily || ''} ${raw?.layoutDecision?.overallLayout || ''} ${raw?.layoutDecision?.alignment || ''} ${raw?.layoutDecision?.rationale || ''}`
  let recommendedFamily = String(raw?.layoutDecision?.recommendedFamily || '').trim()
  if (!recommendedFamily || !['hero-center', 'hero-left', 'split-editorial', 'grid-product', 'magazine-cover', 'festive-frame', 'list-recruitment', 'xiaohongshu-note', 'clean-course', 'premium-offer'].includes(recommendedFamily)) {
    if (/招聘|岗位|福利|投递/.test(source)) recommendedFamily = 'list-recruitment'
    else if (/price|价格|优惠|售价/i.test(source)) recommendedFamily = 'premium-offer'
    else if (/居中|center/i.test(source)) recommendedFamily = 'hero-center'
    else if (/左对齐|left/i.test(source)) recommendedFamily = 'hero-left'
    else recommendedFamily = fallback.layoutDecision.recommendedFamily
  }
  return {
    recommendedFamily,
    confidence: clamp01(Number(raw?.layoutDecision?.confidence), /overallLayout|alignment|spacing/.test(source) ? 0.58 : fallback.layoutDecision.confidence),
    rationale: String(raw?.layoutDecision?.rationale || raw?.layoutDecision?.overallLayout || fallback.layoutDecision.rationale).slice(0, 160),
  }
}
function normalizeMultimodalLayoutHints(raw: any, fallback: PosterMultimodalLayoutHints): PosterMultimodalLayoutHints {
  const safeZones = Array.isArray(raw?.safeZones) ? raw.safeZones : []
  const avoidZones = Array.isArray(raw?.avoidZones) ? raw.avoidZones : []
  const suggestedPlacement = Array.isArray(raw?.suggestedPlacement) ? raw.suggestedPlacement : []
  const textStyleHints = Array.isArray(raw?.textStyleHints) ? raw.textStyleHints : []
  const coercedSafeZones = safeZones.length && safeZones.every((item: any) => item?.x == null) ? coerceVisionSafeZones(raw, fallback) : []
  const coercedAvoidZones = avoidZones.length && avoidZones.every((item: any) => item?.x == null) ? coerceVisionAvoidZones(raw, fallback) : []
  const coercedPlacement = suggestedPlacement.length && suggestedPlacement.every((item: any) => item?.x == null) ? coerceVisionPlacement(raw, fallback) : []
  const coercedTextStyleHints = !textStyleHints.length && raw?.textStyleHints && !Array.isArray(raw?.textStyleHints)
    ? coerceVisionTextStyleHints(raw, fallback)
    : []
  const inferredVision = inferToneFromVisionAnalysis(raw, fallback.visualAnalysis)
  const layoutDecision = coerceVisionLayoutDecision(raw, fallback)
  return {
    safeZones: (coercedSafeZones.length ? coercedSafeZones : safeZones.length ? safeZones : fallback.safeZones).slice(0, 4).map((zone: any, index: number) => ({
      kind: zone?.kind === 'avoid' ? 'avoid' : 'safe',
      label: String(zone?.label || `${zone?.kind === 'avoid' ? 'avoid' : 'safe'}-${index + 1}`).slice(0, 32),
      reason: String(zone?.reason || '').slice(0, 80),
      ...normalizeLayoutRect(zone, fallback.safeZones[index] || fallback.safeZones[0]),
    })),
    avoidZones: (coercedAvoidZones.length ? coercedAvoidZones : avoidZones.length ? avoidZones : fallback.avoidZones).slice(0, 4).map((zone: any, index: number) => ({
      kind: 'avoid',
      label: String(zone?.label || `avoid-${index + 1}`).slice(0, 32),
      reason: String(zone?.reason || '').slice(0, 80),
      ...normalizeLayoutRect(zone, fallback.avoidZones[index] || fallback.avoidZones[0]),
    })),
    suggestedPlacement: (coercedPlacement.length ? coercedPlacement : suggestedPlacement.length ? suggestedPlacement : fallback.suggestedPlacement).slice(0, 8).map((item: any, index: number) => ({
      role: ['heroHeadline', 'supportLine', 'body', 'cta', 'badge', 'priceBlock'].includes(String(item?.role || '')) ? item.role : (fallback.suggestedPlacement[index]?.role || 'body'),
      align: item?.align === 'center' || item?.align === 'right' ? item.align : 'left',
      priority: Number.isFinite(Number(item?.priority)) ? Number(item.priority) : index + 1,
      ...normalizeLayoutRect(item, fallback.suggestedPlacement[index] || fallback.suggestedPlacement[0]),
    })),
    textStyleHints: (coercedTextStyleHints.length ? coercedTextStyleHints : textStyleHints.length ? textStyleHints : fallback.textStyleHints).slice(0, 8).map((item: any, index: number) => ({
      role: ['heroHeadline', 'supportLine', 'body', 'cta', 'badge', 'priceBlock'].includes(String(item?.role || '')) ? item.role : (fallback.textStyleHints[index]?.role || 'body'),
      fill: String(item?.fill || fallback.textStyleHints[index]?.fill || '#111827'),
      stroke: String(item?.stroke || fallback.textStyleHints[index]?.stroke || ''),
      panel: String(item?.panel || fallback.textStyleHints[index]?.panel || ''),
      treatment: ['clean', 'outline', 'panel'].includes(String(item?.treatment || '')) ? item.treatment : (fallback.textStyleHints[index]?.treatment || 'clean'),
      weight: ['regular', 'medium', 'bold'].includes(String(item?.weight || '')) ? item.weight : (fallback.textStyleHints[index]?.weight || 'regular'),
    })),
    visualAnalysis: {
      dominantTone: raw?.visualAnalysis?.dominantTone === 'dark' || raw?.visualAnalysis?.dominantTone === 'light' ? raw.visualAnalysis.dominantTone : inferredVision.dominantTone,
      texture: raw?.visualAnalysis?.texture === 'detailed' ? 'detailed' : raw?.visualAnalysis?.texture === 'clean' ? 'clean' : inferredVision.texture,
      focusBias: raw?.visualAnalysis?.focusBias === 'center' || raw?.visualAnalysis?.focusBias === 'right' ? raw.visualAnalysis.focusBias : raw?.visualAnalysis?.focusBias === 'left' ? 'left' : inferredVision.focusBias,
      needsPanel: typeof raw?.visualAnalysis?.needsPanel === 'boolean' ? raw.visualAnalysis.needsPanel : inferredVision.needsPanel,
    },
    layoutDecision,
  }
}
type CopyTaskMode = 'draft' | 'rewrite'
type ImageTaskMode = 'draft-hero' | 'refresh-hero' | 'draft-background' | 'refresh-background'
type LayoutTaskMode = 'draft' | 'refine'

function buildCommercialPosterDirective() {
  return [
    '总目标：设计一张高级感、可编辑、商业级海报。',
    '核心原则：图片是图片，文字是文字；图片层负责氛围与主体，所有关键信息都必须由后续可编辑文字层承担。',
    '版式必须采用清晰分层布局，保留完整可替换的标题区、副标题区、卖点区、时间区、地点区、按钮区、二维码预留区、品牌 Logo 预留区。',
    '整体要干净、现代、有设计感，信息层级明确，留白充足，方便后续二次编辑。',
    '风格要求：高级、精致、年轻化、视觉冲击力强、适合品牌宣传。',
    '设计要求：强排版感、网格化布局、模块清晰、可替换文案、可替换图片、可替换配色。',
    '画面要求：主视觉突出，背景有氛围感但不过度复杂，细节精致，具有商业海报质感。',
    '输出方向：竖版海报优先，适合社交媒体与印刷展示，追求高清与高分辨率成片观感。',
    '避免：文字变形、信息区混乱、元素拥挤、过度装饰、低级配色、排版松散、廉价感。',
    '任何文字都不能压在复杂背景上；未来可编辑文字区后方必须是规整、对比稳定、适合叠字的区域。',
  ].join('\n')
}

function inferRecruitmentCreativeMode(input: PosterGenerateInput) {
  const text = `${input.theme || ''} ${input.style || ''} ${input.content || ''} ${input.purpose || ''} ${input.industry || ''}`.toLowerCase()
  if (/复古|怀旧|旧纸|牛皮纸|宣传画|年代感|红蓝|国营|招贴|复刻/.test(text)) return 'retro'
  if (/黑金|鎏金|暗黑|夜场|奢华|奢感|高级黑|金融|尊享|典藏|高端/.test(text)) return 'black-gold'
  if (/红色|热烈|极简|品牌招募|高燃|冲击|醒目|国潮|大字报/.test(text)) return 'bold-red'
  if (/公告|通知|告示|张贴|门店|校区|校招|社区|工厂|园区|公告栏/.test(text)) return 'notice'
  return 'notice'
}

function buildRecruitmentCopyStyleDirective(input: PosterGenerateInput) {
  const mode = inferRecruitmentCreativeMode(input)
  if (mode === 'retro') {
    return [
      '当前招聘风格偏复古招贴：title 可以更热烈、更像招贴 headline，但仍要像成熟成品，不要喊空口号。',
      '复古风的 slogan 和 body 要多写岗位机会、城市/场景、福利和投递节奏，避免只剩年代感语气没有决策信息。',
    ].join('\n')
  }
  if (mode === 'black-gold') {
    return [
      '当前招聘风格偏黑金高级：title 要更克制有分量，少口号，多价值感与岗位级别感。',
      '黑金风的 body 要优先写核心岗位、城市、待遇、晋升或项目价值，让高级感建立在真实信息上，而不是空泛奢华语气。',
    ].join('\n')
  }
  if (mode === 'bold-red') {
    return [
      '当前招聘风格偏强红极简：title 可以更短、更猛、更有冲击，但 body 仍需完整承接岗位、地点、待遇、福利和动作入口。',
      '极简红色风不等于信息少，要求 headline 很大、信息条很硬朗，但层级仍然清楚可编辑。',
    ].join('\n')
  }
  return [
    '当前招聘风格偏公告栏信息型：文案要像已经整理好的成熟招聘成品，信息完整、清楚、可信，不要写成随手通知。',
    '公告栏风格的重点是信息密度与阅读效率，岗位、地点、待遇/福利、投递节奏要尽量具体。',
  ].join('\n')
}

function buildRecruitmentPaletteDirective(input: PosterGenerateInput) {
  const mode = inferRecruitmentCreativeMode(input)
  if (mode === 'retro') {
    return [
      '招聘配色偏复古招贴：允许旧纸米白、暖褐、砖红、墨蓝，但必须保留现代可读性和明确标题对比。',
      '避免做成普通黄底宣传单；要像成熟复古招贴成品，信息底板和 CTA 仍需清晰可编辑。',
    ].join('\n')
  }
  if (mode === 'black-gold') {
    return [
      '招聘配色偏黑金高级：优先深炭黑、冷黑、金属金、暖白或灰金，整体克制、高对比、像高端封面。',
      '不要回落到通用蓝白招聘色；黑金风必须通过深底与金属强调色建立高级感，同时保证标题和信息卡可读。',
    ].join('\n')
  }
  if (mode === 'bold-red') {
    return [
      '招聘配色偏强红极简：优先正红、酒红、暖白、深炭黑，形成高冲击 headline 气质。',
      '红色风必须控制层次，不能整张海报满屏同一红；要让标题面、信息面、CTA 面清楚分区。',
    ].join('\n')
  }
  return [
    '招聘配色偏公告栏信息型：优先米白、纸灰、深黑、暗红或工业蓝灰，整体像成熟信息海报，而不是办公系统截图。',
    '公告栏风格重在信息清晰和张贴感，标题、岗位卡、CTA、二维码区要分层明确。',
  ].join('\n')
}

function derivePosterCreativeDirection(input: PosterGenerateInput) {
  const purpose = String(input.purpose || '')
  const style = String(input.style || '')
  const sizeKey = String(input.sizeKey || '')
  const joined = `${input.theme || ''} ${input.content || ''} ${input.industry || ''} ${purpose} ${style} ${sizeKey}`
  if (/招聘|招募|岗位|投递|课程|教育|培训|公开课|训练营|报名|试听/.test(joined)) {
    return {
      name: '信息转化型',
      summary: '突出清晰信息层级与行动转化，让卖点、时间地点、条件福利和 CTA 都能稳定上版。',
      copyRule: '文案要更完整，标题抓眼但不能空，body 要优先沉淀成时间、地点、对象、权益、福利、课时、岗位等真实信息条。',
      imageRule: '主图和背景更克制，优先给信息模块留出完整安全区，不靠花哨图片抢戏。',
      layoutRule: '优先信息骨架、模块分区、chips 与 CTA 的可读性，避免只剩一个大标题。',
      paletteRule: '配色以高可读、高对比为主，按钮、信息底板和标题区要明显分层。',
    }
  }
  if (/促销|抢购|折扣|优惠|立减|满减|低至|券后|上新|爆款|套餐|电商|零售|商品|美妆|母婴|宠物/.test(joined)) {
    return {
      name: '商品转化型',
      summary: '突出主视觉冲击、价格权益和下单理由，形成成熟商业转化海报。',
      copyRule: '标题要更短更狠，slogan 补价值点，body 优先拆成卖点、权益、价格或稀缺信息。',
      imageRule: '主图要更像广告大片或高质感商品 KV，主体更大、更近、更干净，方便叠加价格与卖点。',
      layoutRule: '优先价格块、权益条、CTA 与大主体的协同，避免信息碎成小字。',
      paletteRule: '允许更强视觉冲击，但必须确保价格、按钮、卖点块一眼可见。',
    }
  }
  if (/活动|节日|庆典|开业|周年庆|邀请函|展会|市集|快闪/.test(joined)) {
    return {
      name: '氛围封面型',
      summary: '优先封面感、仪式感与传播记忆点，同时把时间地点 CTA 组织成成熟海报模块。',
      copyRule: '标题和 slogan 可以更有情绪与画面感，但 body 仍需保留关键参与信息与行动入口。',
      imageRule: '主图和背景优先氛围感、纵深、灯光与场景张力，但必须给文字留出完整阅读面。',
      layoutRule: '更像品牌活动主视觉或节日 campaign 封面，模块少而大，重点突出标题和参与信息。',
      paletteRule: '配色可以更有情绪张力，但不能牺牲标题和时间地点的可读性。',
    }
  }
  if (/小红书|笔记|种草|攻略|合集|封面|社媒|新媒体/.test(joined) || sizeKey === 'xiaohongshu') {
    return {
      name: '内容种草型',
      summary: '强调年轻化、内容感和第一眼点击欲，但仍然保持商业海报的规整与可编辑性。',
      copyRule: '文案要有记忆点和情绪钩子，但避免网感废话，body 保持可拆分信息条。',
      imageRule: '主图要更像成熟内容封面或品牌社媒主视觉，主体和留白并重。',
      layoutRule: '可更偏封面化和内容卡点，但按钮、信息条、标题层次必须规整。',
      paletteRule: '颜色更年轻，但要避免廉价高饱和堆叠，保证按钮和标题清晰。',
    }
  }
  if (/健身|运动|瑜伽|训练|潮流|大片|杂志|封面|lookbook|campaign|高级|轻奢/i.test(joined)) {
    return {
      name: '品牌大片型',
      summary: '优先高级感、封面感、主体冲击力与成熟商业排版，不做普通活动通知样式。',
      copyRule: '标题更像 campaign headline，副标题提供价值和氛围，正文少而精。',
      imageRule: '主图必须像品牌广告大片，构图更近、更大、更有情绪和光影层次。',
      layoutRule: '优先大标题、大主体和整块信息面板之间的高级平衡，减少零碎信息。',
      paletteRule: '配色更克制高级，允许深底强对比，确保标题像封面而不是说明书。',
    }
  }
  return {
    name: '品牌通用型',
    summary: '兼顾品牌质感、信息清晰和成片完成度，适配多数商业宣传海报。',
    copyRule: '文案要兼顾记忆点与信息效率，避免空泛，也不要写成通知。',
    imageRule: '主图和背景都要像品牌广告底图，既有质感，也要给文字留出可编辑空间。',
    layoutRule: '排版重视标题权重、信息模块和 CTA 的协调，不走单一模板化堆叠。',
    paletteRule: '配色统一、现代、可读，保证各信息层稳定落版。',
  }
}

function buildPosterCoordinationDirective(input: PosterGenerateInput) {
  const direction = derivePosterCreativeDirection(input)
  return [
    `本次海报创意方向：${direction.name}。`,
    `总协调原则：${direction.summary}`,
    `文案协同：${direction.copyRule}`,
    `图片协同：${direction.imageRule}`,
    `排版协同：${direction.layoutRule}`,
    `配色协同：${direction.paletteRule}`,
    '文案、图片、配色、排版必须围绕同一创意方向协同完成，不能各做各的，更不能所有行业都做成同一种海报。'
  ].join('\n')
}

function buildCopyPrompt(input: PosterGenerateInput, mode: CopyTaskMode = 'draft') {
  const generationMode = normalizeGenerationMode(input.generationMode)
  const actionHint = mode === 'rewrite'
    ? '当前任务是对已有海报执行「换字」微调，请直接输出能替换到现有版式中的成片终稿文案。不要只是同义改写，要明显提升海报完成度、传播感和转化力。'
    : '当前任务是生成一张新海报的首版成片文案，请直接给出可上版的终稿文案。'
  const posterDirective = buildCommercialPosterDirective()
  const coordinationDirective = buildPosterCoordinationDirective(input)
  const sceneCopyDirective = buildSceneCopyDirective(input)
  const selectionCopyDirective = buildSelectionAwareCopyDirective(input)
  const presetCopyDirective = input.presetKey === 'recruitment'
    ? [
        '招聘海报专项要求：文案必须像成熟招聘品牌海报，而不是招聘通知截图。',
        '招聘 title 优先体现平台吸引力、成长机会、团队气质或岗位价值，不要只写“诚聘英才”“招贤纳士”这种空标题。',
        '招聘 slogan 需要补足团队方向、工作氛围、城市/办公场景、成长空间或业务机会，让候选人第一眼知道为什么值得投。',
        '招聘 body 的 5 个信息点优先拆成：岗位方向、面试/到岗时间、城市或办公地点、福利/制度、投递动作或机会窗口。',
        '招聘文案必须同时具备“吸引力 + 决策信息”两层：title/slogan 负责让人想看，body 负责让人敢投，不能只会喊口号。',
        '招聘文案要更像成熟成品海报：既要有 headline 的气势，也要有足够丰富的信息密度，不能只有一句口号加几个零碎词。',
        '请尽量让 title / slogan / body / cta 彼此分工明确：title 抓眼，slogan 讲机会与氛围，body 给出岗位/地点/薪资/福利/流程，cta 明确投递动作。',
        '如果用户提供了岗位、地点、薪资、福利、面试时间、团队方向，请优先把这些关键信息拆进独立信息点，尤其要尽量保留岗位名、地点和薪资/福利中的至少两项。',
        '整套招聘文案要更像成熟招聘产品首屏海报：既有品牌感，也有明确岗位信息，不要生成空泛的企业文化套话。',
        '如果补充信息里出现岗位、人群、城市、福利、双休、五险一金、远程办公、核心项目、晋升空间等信息，优先写入 slogan 和 body，尽量让版面里既有情绪吸引力，也有决定性信息。',
        '允许根据风格做差异化表达：复古招贴可以更热烈直接，黑金招聘可以更高级克制，极简红色招聘可以更短更有冲击，但无论哪种风格都必须保证信息完整、易编辑、可直接上版。',
        '招聘 CTA 要像真实投递入口，优先使用“立即投递”“马上报名”“投递简历”“预约面谈”这类明确动作。',
        '招聘文案禁止把岗位信息藏进图片里暗示，岗位、地点、待遇、福利、时间、投递动作都要尽量由 title / slogan / body / cta 这几个可编辑字段承担。',
        buildRecruitmentCopyStyleDirective(input)
      ].join('\n')
    : ''
  if (mode === 'draft') {
    return [
    '只输出 JSON。必填字段：title、slogan、body、cta、posterIntent、copyDeck。',
      actionHint,
      posterDirective,
      coordinationDirective,
      sceneCopyDirective,
      selectionCopyDirective,
      presetCopyDirective,
      '请把这次输出理解为可编辑海报协议的文案层，不是随手写几句标题副标题。',
      '要求输出像已经过内容策划后的成片脚本：主标题负责第一眼，副标题负责补充价值，offerLine / urgencyLine / actionReason 负责拉开层次，factCards / proofPoints 负责填满信息区。',
      '文案结构要参考成熟商业海报：不能只靠 title+slogan 两句撑全画面，必须让价格块、卖点卡、对象提示、背书句、行动理由中至少三类成立。',
      `模板类型：${input.presetKey || '未指定'}`,
      '说明：模板类型/场景卡片只是创意提示，不是硬约束；请优先输出最适合当前主题、行业、风格、信息密度和尺寸的成片文案。',
      `主题：${input.theme || '未填写'}`,
      `用途：${input.purpose || '未填写'}`,
      `行业：${input.industry || DEFAULT_INDUSTRY}`,
      `风格：${input.style || '高级简约'}`,
      `补充信息：${input.content || '无'}`,
      generationMode === 'fast'
        ? '快速模式：直接给最抓眼、最易排版、最少废话的首版海报文案。'
        : '高质量模式：输出接近品牌 campaign 成片的海报文案，优先保证可直接上版。',
      '要求：title 6~14 字，像 headline；slogan 12~28 字，补充价值点和场景感；body 5 个短信息点，用｜分隔；cta 2~6 字，动词开头。',
    '同时必须输出：posterIntent{scene,goal,audience,tone} 与 copyDeck{heroHeadline,supportLine,offerLine,urgencyLine,actionReason,cta,ctaAlternatives,badge,proofPoints,factCards,priceBlock,audienceLine,trustLine}。',
    'factCards 输出 2~4 个对象，每个对象含 label/value/hint；priceBlock 如适合则输出 {tag,value,suffix,note}，否则传 null。',
    '如果你能写得更完整，请额外强化：badge(2~6 字标签)、offerLine(6~18 字权益/优惠/机会主张)、urgencyLine(6~16 字时间或稀缺提醒)、proofPoints(3~5 条短信息数组)、ctaAlternatives(2~4 条，每条 2~6 字，动作不同、语气不同、适合按钮)。这些字段用于提升成片海报层级。',
      'body 优先吸收时间、地点、价格、福利、人群、权益、限量等真实信息，不要写成长段。',
      'body 的 5 个信息点尽量分别承担：1 个核心利益点、1 个时间信息、1 个地点或对象信息、1 个权益或价格点、1 个行动诱因或信任点。',
      '如果用户提供的信息不够完整，也要补出适合海报的有效信息层级，至少让成片具备“卖点 / 条件 / 行动”三层，而不是只剩空标题。',
      '如果用户没写价格、薪资、课时、福利等关键值，不要直接留空：请根据场景补成可编辑占位式成片信息，例如餐饮补成套餐/尝鲜权益，招聘补成薪酬区间/福利结构，课程补成课时收益/报名权益，活动补成时间窗口/参与礼遇。',
      '招聘海报即使没有提供薪资，也要给出一版完整招聘成片结构，至少补出岗位价值、福利条件、投递动作；餐饮和电商即使没有数字价格，也要补出利益点块和卖点卡。',
      '所有文字都会作为可编辑图层上版，所以必须短、清晰、横向易排，不要依赖图片里的字。',
      '不要输出字段名回声、解释、Markdown、括号备注、空泛套话。',
    ].join('\n')
  }
  return [
    '以下为创作参数（仅供你理解需求，禁止把字段名或「主题：/用途：/行业：」这类标签格式写进任何输出字段）。',
    posterDirective,
    coordinationDirective,
    sceneCopyDirective,
    selectionCopyDirective,
    presetCopyDirective,
    `模板类型：${input.presetKey || '未指定'}`,
    '说明：模板类型/场景卡片只是创意提示，不是硬约束；请优先输出最适合当前主题、行业、风格、信息密度和尺寸的成片文案。',
    `主题：${input.theme || '未填写'}`,
    `用途：${input.purpose || '未填写'}`,
    `行业：${input.industry || DEFAULT_INDUSTRY}`,
    `风格：${input.style || '高级简约'}`,
    `尺寸：${input.sizeKey || 'xiaohongshu'}`,
    `补充信息：${input.content || '无'}`,
    '请只输出 JSON。必填字段：title、slogan、body、cta、posterIntent、copyDeck。',
    actionHint,
    generationMode === 'fast'
      ? '本次任务是快速生成模式：仍然要保证成片海报感，但请优先输出最抓眼、最易排版、最少废话的终稿，不要冗长发散。'
      : '本次任务以效果优先，不需要节省生成成本，请按最高质量思路完成，相当于把可用鲲币都用于提升成片效果。',
    '你的任务不是写说明文，而是直接输出可落版的海报成片文案。成片气质要像品牌 campaign、杂志封面、商业海报，而不是活动通知。',
    '请把输出当成最终会直接铺到海报上的文案，而不是给设计师的备注。要有记忆点、转化感、画面感，读起来就像已经能上版。',
    '请把文案写成真正要上画面的海报层级：title 负责第一眼抓住注意力，slogan 负责补充利益点或氛围，body 负责拆成信息条，cta 负责明确行动。',
    '同时请像在输出一份海报内容蓝图：copyDeck 中每个角色都要有明确职责，不要用同一句话重复占满 heroHeadline / supportLine / proofPoints / factCards。',
    '请默认所有文案最终都会以可编辑文字图层落到海报上，所以句子必须适合大字号排版和后续手动微调，不能依赖图片里自带字。',
    '请把 title / slogan / body / cta 当成四个独立可编辑图层来写：每一层都要能单独移动、放大、删减、替换，所以不要写彼此强依赖的半句结构。',
    '不要输出“如图所示”“见海报”“搭配上方大字”“配合图片文案”等依赖图片内文字的表达；图像层默认无字，信息必须由这些独立字段本身说清楚。',
    '文案必须考虑最终落版可读性：标题不要过长，不要写成长句；按钮文案要短促有力；信息条要适合做大字号 chips，不要生成又细又长的小字。',
    '请默认海报里的标题、按钮、信息条都要做成肉眼一眼能看清的大块信息，所以不要写需要缩成很小字号才能放下的词句。',
    '语言风格：口语化、凝练、有明确转化目标；避免空泛套话、企业汇报腔、口号堆砌；与所选行业、用途、风格一致。',
    'title：6～14 字，必须像海报 headline，短、狠、抓眼；优先体现核心利益点、稀缺感、价值感或强情绪；不要写成解释句、不要写标签、不要写标点堆砌。',
    'slogan：12～28 字，作为第二层视觉文案，补足价值、对象、场景、气氛；不能和 title 重复，不能写成流水账；要让人一眼知道这张海报为什么值得看。',
    'body：请输出 5 个短信息点，用 `｜` 分隔；每个信息点 4～14 字；优先吸收时间、地点、价格、福利、人群、权益、限量、卖点等真实信息；绝不要写成长段。',
    '必须额外输出：posterIntent{scene,goal,audience,tone} 与 copyDeck{heroHeadline,supportLine,offerLine,urgencyLine,actionReason,cta,ctaAlternatives,badge,proofPoints,factCards,priceBlock,audienceLine,trustLine}。',
    'factCards 输出 2～4 个对象，每个对象都要适合直接做成海报信息卡；priceBlock 适合有价格/优惠/权益场景时输出 {tag,value,suffix,note}，不适合时传 null。',
    '如果你能进一步完善成片层级，请额外强化：badge(2～6 字标签)、offerLine(6～18 字的优惠/机会/利益主张)、urgencyLine(6～16 字的时间/稀缺提醒)、proofPoints(3～5 条数组，每条 4～14 字)、ctaAlternatives(2～4 条数组，每条 2～6 字，分别适合强转化、轻引导、社媒感或服务感按钮)。这些字段会被前端拆成价格块、chips、卖点条与提示信息。',
    'body 里的每一个短信息点都应当可以单独拆成可编辑 chips、价格说明或卖点条，不要把前后逻辑绑成只能整段出现的说明句。',
    'body 的 5 个信息点请尽量分工明确：第 1 个讲核心利益点或卖点，第 2 个讲时间信息，第 3 个讲地点/对象信息，第 4 个讲价格/权益/福利，第 5 个讲行动触发或稀缺感。',
    '即使补充信息较少，也要主动补足“成片海报需要的结构感”，至少保证输出读起来像完整广告画面，而不是一句空口号加一个按钮。',
    '如果缺少明确价格、薪资、课时等数据，请补出可编辑占位结构，不得让价格区、说明区、福利区直接空掉。允许输出“到店尝鲜价”“综合薪酬面议”“限时体验权益”“报名即得资料包”这类可被用户后改的完整表达。',
    '请遵守“少而大但信息足够”的海报成片原则：不要写成长段废话，但也不能只剩一句空标题；要让标题、副标题、信息条、权益点、CTA 共同构成完整海报。',
    'cta：2～6 字行动按钮文案，动词开头，与用途匹配（报名/抢购/领券/预约/了解等）。同时尽量给出 ctaAlternatives，让同一海报可以在不同排版里选择更合适的按钮表达。',
    '标题优先短而横向展开，避免任何容易被排成竖条窄列的表达；CTA 最好控制在 2～4 字，确保按钮能做大、做醒目。',
    '如果补充信息里有价格、立减、时间、地点、福利、人群、限量、权益、岗位、课时等信息，优先把这些真实信息压缩进 slogan 或 body；不要编造不存在的数据。',
    'body 请尽量写成真正能拆成 chips / 价格块 / 卖点条 / 招聘条件 / 课程信息的短句，不要把所有信息揉成一整句废话。',
    '电商/餐饮/节日/活动场景可以更有传播感；招聘/课程/健身场景要兼顾专业可信和行动驱动；小红书/杂志大片风格允许更有情绪张力。',
    '电商海报要有商品利益点、优惠触发和下单理由；招聘海报要有岗位吸引点、福利或门槛信息；课程海报要有人群、收益和报名动机；活动/节日海报要有氛围点、参与信息和行动入口。',
    '禁止输出空泛表达，例如“品质之选”“不容错过”“精彩来袭”“火热进行中”这类没有真实信息和识别度的陈词滥调，除非它们已经被具体利益点支撑。',
    mode === 'rewrite' ? '换字结果要优先保留当前主题方向，但整体表达必须更像成熟海报成片，确保标题、卖点、CTA 更聚焦、更能直接上画面。' : '首版结果要兼顾记忆点和落版性，确保标题、卖点、CTA 一次到位。',
    '禁止输出画外说明、解释文字、字段名回声、括号备注、Markdown。只返回 JSON。',
  ].join('\n')
}
function buildFastCopyCorePrompt(input: PosterGenerateInput, mode: CopyTaskMode = 'draft') {
  const actionHint = mode === 'rewrite'
    ? '当前任务是海报换字优化，请给出更像成品海报的精炼文案。'
    : '当前任务是生成可直接上版的首版海报文案。'
  return [
    '只输出 JSON。',
    actionHint,
    `主题：${input.theme || '未填写'}`,
    `用途：${input.purpose || '未填写'}`,
    `行业：${input.industry || DEFAULT_INDUSTRY}`,
    `风格：${input.style || '高级简约'}`,
    `尺寸：${input.sizeKey || 'xiaohongshu'}`,
    `补充信息：${input.content || '无'}`,
    '输出字段仅限：title、slogan、body、cta、posterIntent。',
    'posterIntent 输出：scene(commerce|recruitment|event|course|festival|food|fitness|social)、goal(sell|lead|recruit|sign_up|promote|inform)、audience、tone。',
    'title 6~14 字，必须抓眼；slogan 12~26 字，补价值与场景；body 为 4~5 个短信息点，用｜分隔；cta 2~6 字，必须是动作表达。',
    '必须像成品海报文案：title 抓第一眼，slogan 补利益点，body 能拆成卖点条，不要写成通知或说明书。',
    '如果是电商/餐饮，优先写购买理由、优惠触发、使用场景；如果是招聘/课程，优先写对象、收益、行动门槛；如果是活动/节日，优先写氛围和参与理由。',
    '如果用户缺少价格、薪资、福利、课时等关键字段，也要补成可编辑占位式完整结构，不要把重要信息位留空。',
    '不要生成过长小字，不要让标题和副标题重复，不要写空泛套话。',
    '禁止输出解释、Markdown、字段名回声、空泛套话。',
  ].join('\n')
}
function buildFastCopyDeckPrompt(input: PosterGenerateInput) {
  return [
    '只输出 JSON。',
    `主题：${input.theme || '未填写'}`,
    `用途：${input.purpose || '未填写'}`,
    `行业：${input.industry || DEFAULT_INDUSTRY}`,
    `风格：${input.style || '高级简约'}`,
    `补充信息：${input.content || '无'}`,
    '输出字段仅限：copyDeck。',
    'copyDeck 输出：heroHeadline,supportLine,offerLine,urgencyLine,actionReason,cta,ctaAlternatives,badge,proofPoints,factCards,priceBlock,audienceLine,trustLine。',
    'factCards 为 2~4 个对象数组，每个对象必须有 label/value/hint；priceBlock 适合时输出 {tag,value,suffix,note}，否则为 null。',
    '内容必须像真正商业海报可直接拆成价格块、卖点条、信息卡和按钮，不要写占位词。',
    'ctaAlternatives 给 2~4 条不同按钮表达，proofPoints 给 3~5 条不同卖点短句。',
    '优先让信息卡和卖点条有不同职责，不要重复标题；按钮文案要像真实可点击按钮。',
    '有明确优惠时尽量给出 priceBlock；没有价格时也要给出 offerLine、urgencyLine、actionReason 中至少两项。',
    '信息卡尽量覆盖权益/适合谁/加码信息，不要输出空卡。',
    '电商/餐饮场景下，factCards 优先拆成「权益 / 适合 / 加码或发货」；招聘优先拆成「岗位 / 地点 / 福利」；课程优先拆成「适合谁 / 学什么 / 报名权益」。',
    '如果出现“第二件半价、买一送一、限时直降、前N名赠礼”等优惠，即使没有具体价格数字，也要把它体现在 priceBlock 或 factCards 里。',
    '如果用户没有提供价格、薪资、福利、时间等数据，也必须补出一版完整可编辑海报结构，不要让 factCards、priceBlock、proofPoints 变成空壳。',
    '招聘场景下，如果没有薪资数字，允许输出“综合薪酬面议 / 福利完整 / 晋升清晰”这类可编辑结构；餐饮和电商场景下，如果没有价格数字，允许输出“尝鲜权益 / 到店礼遇 / 限时加赠”这类可编辑结构。',
    '禁止输出解释、Markdown、字段名回声。',
  ].join('\n')
}
function buildPalettePrompt(input: PosterGenerateInput, mode: 'draft' | 'refine' = 'draft') {
  const generationMode = normalizeGenerationMode(input.generationMode)
  const posterDirective = buildCommercialPosterDirective()
  const coordinationDirective = buildPosterCoordinationDirective(input)
  const recruitPaletteDirective = input.presetKey === 'recruitment' || /招聘|招募/.test(`${input.industry || ''} ${input.purpose || ''} ${input.theme || ''}`)
    ? buildRecruitmentPaletteDirective(input)
    : ''
  if (mode === 'draft') {
    return [
      posterDirective,
      coordinationDirective,
      recruitPaletteDirective,
      `主题：${input.theme || '未填写'}`,
      `用途：${input.purpose || '未填写'}`,
      `行业：${input.industry || DEFAULT_INDUSTRY}`,
      `风格：${input.style || '高级简约'}`,
      '只输出 JSON：background、surface、primary、secondary、text、muted、swatches(4~6 个十六进制色)。',
      generationMode === 'fast'
        ? '快速模式：给出最稳、最容易直接成片的海报色板。'
        : '高质量模式：给出适合成品海报的色板，优先保证高级感、可读性和主按钮对比。',
      '要求：标题、正文、CTA 在图片或渐变上也要清晰；禁止浅字压浅底、暗字压暗底；背景、信息底板、按钮要有明确层次。',
    ].join('\n')
  }
  return [
    posterDirective,
    coordinationDirective,
    recruitPaletteDirective,
    `主题：${input.theme || '未填写'}`,
    `用途：${input.purpose || '未填写'}`,
    `行业：${input.industry || DEFAULT_INDUSTRY}`,
    `风格：${input.style || '高级简约'}`,
    '请输出 JSON：background、surface、primary、secondary、text、muted、swatches(数组 4～6 个十六进制色)。',
    mode === 'refine'
      ? '当前任务是对已有海报做配色优化，请直接给出更适合成品海报的最终色板，优先确保高级感、文字可读性、主按钮/标题对比度和整张海报的统一性。'
      : '当前任务是为新海报生成首版色板，请直接给出适合成品海报的最终色板。',
    generationMode === 'fast'
      ? '本次是快速生成模式：请直接给出最稳定、最容易形成成片海报层级的色板，减少犹豫和过度实验。'
      : '本次以最终海报效果优先，不需要节省生成成本，请按最高质量审美完成，相当于把可用鲲币都用于提升成片质感。',
    '微调要求：主色与辅助色层次分明；背景与 surface 拉开明度差；text 与 background 对比足够印刷可读；swatches 含主色与中性色，整体与行业+风格情绪一致。',
    '色板必须服务于海报成片，而不是只给出好看的单色卡：标题、信息 chips、CTA、二维码周边、背景层之间都要能建立清晰层次。',
    '硬性要求：标题和正文落在图片或渐变上时也必须清晰可读，禁止出现文字压在高亮区域看不清的情况；请主动提供更稳的背景色、surface 色和强调色，让前端可以生成高对比信息底板。',
    'CTA 按钮和 badge 的配色要具备强对比和明确点击感，不能出现浅字压浅底、暗字压暗底、主按钮太淡或信息 chips 像背景噪点的情况。',
    '请优先输出适合商业海报的高可读方案：主标题对比明显，副标题和正文次一级但仍清晰，按钮一眼可见，信息块不依赖很小字号才能成立。',
    '如果主题适合高饱和画面，也必须同时给出足够稳定的深浅对比关系，让深色标题面板、浅色信息面板和强对比 CTA 都能站得住。',
  ].join('\n')
}
/** 文生图 prompt 中禁止使用「用途：引流」这类标签式短句，否则模型容易把字直接画进画面 */
function buildImageSceneNarration(input: PosterGenerateInput) {
  const theme = String(input.theme || input.industry || '商业海报').trim() || '商业海报'
  const purpose = String(input.purpose || '推广').trim()
  const industry = String(input.industry || DEFAULT_INDUSTRY).trim()
  const style = String(input.style || '高级简约').trim()
  const note = String(input.content || '').trim()
  const combined = `${theme} ${purpose} ${industry} ${style} ${note}`
  const eventLike = /年会|周年庆|庆典|盛典|颁奖|发布会|峰会|活动主视觉|邀请函|晚会/.test(combined)
  const doodleLike = /手绘|涂鸦|插画|漫画|贴纸/.test(style)
  const parts = [`画面围绕「${theme}」展开`, `行业气质接近${industry}`, `传播意图偏${purpose}`, `视觉风格接近${style}`]
  if (eventLike) {
    parts.push(`主体语义必须先落在「${theme} / ${purpose} / ${industry}」对应的真实活动场景与品牌主视觉上，优先企业庆典舞台、周年庆主 KV、会场装置、灯光礼花、品牌庆祝氛围或活动现场主镜头`)
  }
  if (doodleLike) {
    parts.push('手绘/涂鸦/插画只作为视觉语言和图形修饰层，不能替代主题主体本身；先保证场景语义正确，再加入涂鸦感轮廓、贴纸、插画化笔触或图形点缀')
  }
  if (note) parts.push(`可参考的补充气氛（不要逐字写在图上）：${note.slice(0, 140)}`)
  return parts.join('，')
}
/** 行业向氛围锚点，强化「广告剧照」感而非白底素材（与 palette 行业键对齐，逐类微调） */
function buildImageIndustryMood(input: PosterGenerateInput) {
  const ind = String(input.industry || '')
  const themeText = `${input.theme || ''} ${input.content || ''}`
  if (/公司年会|企业年会|周年庆|庆典|品牌盛典|活动主视觉|发布会|峰会/.test(`${ind} ${themeText} ${input.purpose || ''}`)) {
    return '强调商业活动主视觉的明确语义：优先企业年会舞台、周年庆品牌庆典、发布会主 KV、礼花灯光装置、会场纵深、品牌级现场氛围与可叠字留白；不要生成无关街拍、时装人像、城市夜游或孤立人物写真。'
  }
  if (/宠物|萌宠|猫|狗|犬|猫咪|狗狗/.test(`${ind} ${themeText}`)) return '强调宠物商业海报感：主体近景更大、更灵动，毛发细节清晰，眼神有交流感，像宠物品牌广告封面或宠物摄影杂志大片；场景中的项圈吊牌、包装、海报牌一律无字。'
  if (/餐饮|美食|咖啡|茶饮/.test(ind)) return '强调食物质感与食欲氛围：热气或冷凝水珠、餐具高光、暖色与景深虚化背景，像美食杂志内页或品牌 TVC 静帧；禁止菜单字、店招字、餐盒字、杯身字、包装字。'
  if (/电商|零售/.test(ind)) return '强调商品级光影：柔和棚拍或生活场景中的体积光、材质高光与反射层次，像电商头图或礼盒广告；包装、吊牌、标签、瓶身、盒面全部无字化。'
  if (/招聘|人力|HR/.test(ind)) return `强调招聘海报成片感：${buildRecruitmentVisualMood(input)} 同时优先职业人物、团队交流、招募氛围或具海报感的场景化背景；禁止孤立设备、空椅子特写、无关静物、廉价办公室 stock 感。`
  if (/健身|运动|瑜伽|训练/.test(ind)) return '强调力量与动感：肌肉线条与环境光对比、汗水与织物细节、广角张力，像运动品牌 campaign；背景优先深色纯净墙面、灯带或虚化器械区域，必须预留大面积无字标题安全区；禁止墙面标语、器械 logo、T 恤字样、霓虹字牌、可读英文。'
  if (/课程|教育|培训/.test(ind)) return '强调专注与成长感：柔和侧光、书本/屏幕/教室元素虚化、清新空气感，像在线教育品牌主图。'
  if (/节日|庆典|年会/.test(ind)) return '强调节庆光色与层次：光斑、丝带或礼花氛围粒子、暖冷对比但不过曝，像节日限定海报底图。'
  if (/活动/.test(ind)) return '强调传播记忆点：人群能量或城市夜景纵深感、舞台灯或霓虹点缀、空气介质感，像品牌活动主视觉。'
  if (/门店|开业|店铺/.test(ind)) return '强调到店氛围：门面景深、橱窗反射与街景虚化、欢迎感暖光，像新店开业或门店引流主图；门头、灯箱、贴纸、立牌全部不可读无字。'
  return '强调品牌级氛围：有纵深的空间、环境反射与柔和体积光，像商业广告摄影底图。'
}
/** 用途向情绪微调（与表单「用途」选项对齐） */
function buildImagePurposeMood(input: PosterGenerateInput) {
  const p = String(input.purpose || '')
  if (/周年庆|庆典|盛典|颁奖|晚会/.test(p)) return '情绪偏庆祝、荣誉感与品牌仪式感：画面需要更像正式活动主视觉，允许礼花、舞台灯束、纪念装置与高完成度庆典氛围。'
  if (/促销|抢购/.test(p)) return '情绪偏紧迫与让利感：暖色点缀、高光略硬一点但仍干净。'
  if (/报名|招募/.test(p)) return '情绪偏信任与行动：画面稳定、主体眼神或手势有「邀请感」。'
  if (/引流/.test(p)) return '情绪偏好奇与探索：留白略多、视线引导线朝向画面内侧，便于后期放二维码。'
  if (/上新/.test(p)) return '情绪偏新鲜与期待：清爽高光、新品「首发」气质，避免陈旧库存感。'
  return '情绪积极正向、商业可信，避免廉价素材感。'
}
/** 用户所选「风格」映射到光影与调色倾向（与预设风格文案对齐） */
function buildImageStyleMood(styleRaw: string) {
  const s = String(styleRaw || '')
  if (/手绘|涂鸦|插画|漫画|贴纸/.test(s)) return '风格层使用手绘涂鸦/插画化语言：允许轮廓笔触、贴纸图形、图标化纹理、彩带涂写感或插画修饰，但前提是主体场景仍然真实表达主题，不要把整张图误生成无关潮流人像或街头写真。'
  if (/活力促销|活力|促销/.test(s)) return '调色偏饱和有 punch，可用边缘光或轻微镜头眩光增强能量，整体仍要干净不脏。'
  if (/年轻潮流|潮流|年轻/.test(s)) return '略广角透视、对比清晰、点缀霓虹或金属高光，偏青年文化品牌片。'
  if (/高级简约|极简|简约/.test(s)) return '低饱和克制配色、大面积留白呼吸感、细腻灰阶过渡与柔光箱式主光，偏奢侈品或科技极简广告。'
  if (/专业商务|商务|专业/.test(s)) return '中性光比、横平竖直构图、稳重景深，偏企业年报或发布会视觉。'
  if (/清新温暖|温暖|清新/.test(s)) return '柔和晨光或黄金时刻色温、轻雾感空气透视、材质柔软，偏生活方式品牌情绪片。'
  if (/严肃|政务/.test(s)) return '低反差、构图端正、色彩克制，偏政务与公共传播视觉。'
  return '光影统一、材质可信、整体像精修商业摄影而非随手快照。'
}
function hasExplicitPersonCreativeSignal(input: PosterGenerateInput) {
  const combined = `${input.theme || ''} ${input.purpose || ''} ${input.industry || ''} ${input.style || ''} ${input.content || ''}`
  return /人物主视觉|真人出镜|模特|人物海报|讲师出镜|老师出镜|导师出镜|职业人物|团队合影|形象照|肖像|半身像|全身像|人像/.test(combined)
}
function buildImageSubjectMatchDirective(
  input: PosterGenerateInput,
  mode: 'background' | 'hero',
  personMode: 'required' | 'optional' | 'avoid',
) {
  const scene = getCopyScenario(input)
  const theme = String(input.theme || input.industry || '商业海报').trim() || '商业海报'
  const note = clipPosterText(String(input.content || '').replace(/[|｜]/g, '，').trim(), 42)
  const layerLabel = mode === 'hero' ? '主视觉主体' : '背景主体'
  const explicitPerson = hasExplicitPersonCreativeSignal(input)
  const baseLead = `${layerLabel}必须直接回应「${theme}」这个主题`
  const noteLead = note ? `，并尽量吸收补充信息里的关键对象，例如${note}` : ''
  switch (scene) {
    case 'recruit':
      return [
        `${baseLead}${noteLead}。`,
        '招聘场景优先真实岗位环境、门店服务现场、团队协作、接待台、制作台、办公协作、校招交流、工厂/园区岗位场景或公告栏式招募氛围。',
        explicitPerson || personMode === 'required'
          ? '如果使用人物，必须是和岗位相关的职业动作、团队关系或工作状态，不要只给一个泛化半身肖像。'
          : '如果没有明确要求人物，不要默认单人半身肖像；可直接用团队场景、岗位环境、操作动作或空间氛围承担主语。',
        '禁止普通青年证件照、随手咖啡馆人像、空办公室摆拍、无关学生脸、只剩颜值没有岗位线索的 generic portrait。',
      ].join('')
    case 'food':
      return [
        `${baseLead}${noteLead}。`,
        '餐饮场景必须先让人看出卖的是什么：菜品、饮品、套餐或食材本体要足够大、足够近、足够诱人。',
        '优先食物本体、蒸汽/冷凝、水果/酱料/器皿、备餐台或门店氛围，不要让无关人物、网红自拍或室内摆拍抢走主语。',
      ].join('')
    case 'course':
      return [
        `${baseLead}${noteLead}。`,
        '课程场景必须先让人看出学什么或为什么值得报名：优先课堂空间、课程内容相关对象、屏幕意象、学习工具、导师讲解场景或知识图形化环境。',
        explicitPerson || personMode === 'required'
          ? '如果使用讲师或学员，必须服务课程主题，不要变成普通青春学习照。'
          : '没有明确要求真人时，不要默认学生坐电脑前的人像模板。',
      ].join('')
    case 'commerce':
      return [
        `${baseLead}${noteLead}。`,
        '电商场景必须先让人看出卖点对象：优先商品本体、成组陈列、使用场景、礼盒组合、材质特写或生活方式落地场景。',
        '不要把人物当默认主角，更不要生成和商品不相关的时尚肖像。',
      ].join('')
    case 'fitness':
      return [
        `${baseLead}${noteLead}。`,
        '健身场景优先训练动作、器械互动、力量感姿态、训练空间纵深或课程现场，不要生成和训练主题无关的潮流写真。',
      ].join('')
    case 'festival':
    case 'event':
      return [
        `${baseLead}${noteLead}。`,
        '活动/节日场景必须先落在品牌氛围、节庆装置、舞台空间、人群能量、礼盒主体或场景记忆点上，不要跑偏到无关人像写真。',
      ].join('')
    default:
      return `${baseLead}${noteLead}。主体必须与行业、用途和补充信息直接相关，不要给出泛化 stock 图答案。`
  }
}
function inferPersonVisualMode(input: PosterGenerateInput, heroStrategy?: 'product' | 'person' | 'scene' | 'editorial') {
  const combined = `${input.theme || ''} ${input.purpose || ''} ${input.industry || ''} ${input.style || ''} ${input.content || ''}`
  const styleText = String(input.style || '')
  const industryText = String(input.industry || '')
  const purposeText = String(input.purpose || '')
  const illustrationLike = /卡通|插画|手绘|涂鸦|漫画|几何|抽象|贴纸/.test(styleText)
  const explicitPerson = hasExplicitPersonCreativeSignal(input)
  if (explicitPerson) return 'required' as const
  if (/模特|美妆|穿搭/.test(combined)) return 'required' as const
  if (/课程|教育|培训/.test(industryText) && illustrationLike) return 'avoid' as const
  if (/课程|教育|培训/.test(industryText) && /活动|报名|推广|引流|公开课|训练营|课程推广/.test(`${purposeText} ${combined}`)) return 'avoid' as const
  if (/节日|庆典|活动主视觉|发布会|峰会|促销|上新|门店|餐饮|美食|咖啡|茶饮|电商|零售/.test(combined) && !explicitPerson) return 'avoid' as const
  if (/招聘|招募|健身|运动|瑜伽|训练/.test(combined)) return 'optional' as const
  if (heroStrategy === 'person') return 'optional' as const
  return 'optional' as const
}
function buildHeroSubjectDirective(input: PosterGenerateInput, heroStrategy: 'product' | 'person' | 'scene' | 'editorial', personMode: 'required' | 'optional' | 'avoid') {
  const combined = `${input.theme || ''} ${input.purpose || ''} ${input.industry || ''} ${input.style || ''} ${input.content || ''}`
  const styleText = String(input.style || '')
  const industryText = String(input.industry || '')
  const illustrationLike = /卡通|插画|手绘|涂鸦|漫画|贴纸/.test(styleText)
  const educationLike = /课程|教育|培训/.test(industryText)
  if (personMode === 'required') {
    return '主视觉主体可以明确使用人物，但仍要优先品牌海报式的人物关系、职业动作或情绪张力，不要退化成游客照、证件照、站桩摆拍或普通学生坐电脑前的 stock 图。'
  }
  if (educationLike && illustrationLike) {
    return [
      '课程/教育插画主视觉优先做知识传播型 KV，而不是默认人物肖像。',
      '优先主体：课程知识符号、编程界面意象、学习路径、课堂道具、屏幕与笔记本的组合、代码学习场景、抽象知识图形、教室/工作坊空间、教育品牌 campaign 式插画场景。',
      '不要默认生成单个学生半身像、年轻人坐在电脑前、通用备考写真、青春偶像式头像或把真人学习照简单卡通化。',
    ].join('')
  }
  if (educationLike && personMode === 'avoid') {
    return '课程/教育主视觉优先用课程内容相关场景、知识对象、设备界面意象、课堂空间、学习工具组合或品牌级信息化场景来表达，不要默认用单人学生肖像充当主题。'
  }
  if (/活动|节日|庆典|发布会|峰会/.test(combined) && personMode === 'avoid') {
    return '活动类主视觉优先表现现场氛围、舞台装置、品牌符号、空间纵深、礼花灯束或节庆视觉，而不是无关人物肖像。'
  }
  if (/音乐节|露营|市集/.test(combined) && personMode === 'avoid') {
    return '音乐节/露营/市集类主视觉优先使用舞台、草坪、帐篷、灯串、落日天空、摊位装置、群体氛围或品牌级场景镜头，不要退化成单人写真或旅行人像。'
  }
  if (/餐饮|美食|咖啡|茶饮|电商|零售|门店|开业/.test(combined) && personMode === 'avoid') {
    return '主视觉优先突出商品、场景、空间或氛围陈列，不要把人物当成默认主角，除非主题明确需要模特或顾客出镜。'
  }
  if (heroStrategy === 'scene') {
    return '主视觉优先使用完整场景、空间氛围或品牌级 KV，而不是把人物肖像当成唯一抓手。'
  }
  if (heroStrategy === 'editorial') {
    return '主视觉优先使用封面感构图、对象组合、信息化场景或高级 editorial 画面，不要偷懒回退到泛化青年人像。'
  }
  return '主体必须和主题真实相关，优先更有识别度的商品、场景、空间或概念对象；人物只作为可选元素，不是默认答案。'
}
function buildPersonBiasGuard(input: PosterGenerateInput, personMode: 'required' | 'optional' | 'avoid') {
  if (personMode === 'required') return ''
  const combined = `${input.theme || ''} ${input.purpose || ''} ${input.industry || ''} ${input.style || ''} ${input.content || ''}`
  if (/课程|教育|培训|活动|节日|庆典|餐饮|美食|咖啡|茶饮|电商|零售|门店|开业/.test(combined)) {
    return '人像纠偏：除非输入明确要求真人人物、讲师出镜、职业形象或团队群像，否则不要默认生成年轻男女肖像、学生站姿照、电脑前学习照、偶像感半身像或 generic 人物封面。'
  }
  return '不要把人物肖像当成默认解；当商品、场景、空间或概念对象更贴题时，应优先使用那些主体。'
}
function buildImageSemanticGuard(input: PosterGenerateInput) {
  const combined = `${input.theme || ''} ${input.purpose || ''} ${input.industry || ''} ${input.style || ''} ${input.content || ''}`
  if (/公司年会|企业年会|周年庆|庆典|盛典|发布会|峰会|活动主视觉/.test(combined)) {
    return '语义纠偏：不要生成无关的单人时装照、街头夜景人像、帽衫青年、城市漫游、酒吧氛围、赛博路人、随机明星感封面。必须先让人一眼看出这是企业年会/周年庆/品牌活动主视觉。'
  }
  if (/招聘|招募/.test(combined)) {
    return '招聘纠偏：不要偷懒生成普通半身职业头像、青春学生照、坐在咖啡馆里的文艺青年、电脑前摆拍或空办公室 stock 图。必须让岗位环境、团队关系、门店/校区/工位/业务氛围与“正在招人”这件事直接成立。'
  }
  if (/餐饮|美食|咖啡|茶饮/.test(combined)) {
    return '餐饮纠偏：不要生成无关的人像、空桌面、泛家居静物或只有门店氛围没有食物主体的画面。必须先让人一眼看出具体菜品、饮品、套餐或到店诱因。'
  }
  if (/课程|教育|培训/.test(combined)) {
    return '课程纠偏：不要退化成普通青春学习照、电脑前标准学生照或泛教育 stock 图。必须让课程内容、训练主题、课堂场景或知识对象与报名主题直接对应。'
  }
  if (/电商|零售|商品|上新|礼盒|促销/.test(combined)) {
    return '电商纠偏：不要生成空洞氛围图、无关时尚肖像或只有背景没有商品的画面。必须让商品本体、使用场景或组合卖点先成立。'
  }
  if (/手绘|涂鸦|插画/.test(combined)) {
    return '风格纠偏：手绘/涂鸦只是表现手法，不是主题本体。不要因为涂鸦风就改成街头潮牌写真、墙绘自拍或无关人物肖像。'
  }
  return ''
}
function buildRecruitmentVisualMood(input: PosterGenerateInput) {
  const mode = inferRecruitmentCreativeMode(input)
  if (mode === 'retro') {
    return '招聘视觉偏复古招贴与旧纸海报：允许旧纸纹理、印刷颗粒、复古红蓝或暖褐配色、宣传画式人物或群像、粗边框与整块留白底面；构图像成熟招工招贴成片而不是廉价仿古滤镜；标题安全区必须完整、稳定、无字。'
  }
  if (mode === 'black-gold') {
    return '招聘视觉偏黑金封面：允许深色背景、舞台光束、金属反射、垂直构图张力、人物剪影或职业肖像、黑金材质层次；留出大块纯净暗面承托标题和信息面板；绝不画入任何文字、logo、牌匾字。'
  }
  if (mode === 'bold-red') {
    return '招聘视觉偏强红极简成片：允许大面积红、酒红、暖白底面、抽象布幕或纸面层次、单人或双人职业形象、极强标题安全区与大片留白；整体要像品牌招募海报而不是办公宣传页；画面依旧绝对无字。'
  }
  return '招聘视觉优先做成熟公告栏/张贴式成片底图而不是普通办公素材：允许公告栏框架感、海报边框感、规整底面、岗位环境、团队场景、门店/校区/办公环境的受控留白区域；人物可以出现但不是硬要求，必须像已经可以承载大量招聘信息的专业底图。'
}
/** 强氛围优先时的通用质感后缀（仍禁止画面内可读字） */
function buildImageCraftSuffix(_mode: 'background' | 'hero') {
  return '整体追求高完成度商业视觉：电影感布光、统一色彩科学、细腻材质与微妙环境体积雾；浅景深突出主体；可带极轻微胶片颗粒或 halation，但不要脏噪点；像 8K 广告静帧的质感与层次。'
}
function isHighTextRiskInput(input: PosterGenerateInput) {
  const combined = `${input.industry || ''} ${input.theme || ''} ${input.content || ''} ${input.purpose || ''}`
  return /餐饮|美食|咖啡|茶饮|电商|零售|门店|开业|店铺|包装|礼盒|标签|瓶身|招牌|菜单|海报|宣传单|小吃|奶茶|饮品|商超|健身|运动|瑜伽|训练|招聘|招募|校招|公告栏|通知栏|工位|屏幕|白板/.test(combined)
}
function buildRetryTextFreeDirective(input: PosterGenerateInput, mode: 'background' | 'hero', retryIndex = 0) {
  const risky = isHighTextRiskInput(input)
  if (!risky && retryIndex <= 0) return ''
  const layerLabel = mode === 'background' ? '背景底图' : '主视觉底图'
  if (retryIndex <= 0) {
    return `这是容易出现包装字、招牌字或菜单字的高风险场景，请把 ${layerLabel} 做得更像纯视觉广告画面：所有包装、门头、价签、杯身、盒面、屏幕、贴纸、立牌都必须是空白无字版本。`
  }
  return [
    `这是第 ${retryIndex + 1} 次重新生成，请彻底清除一切潜在字形痕迹。`,
    `必须从头重生成更干净的 ${layerLabel}，宁可留白更多，也不要出现任何可读文字、伪文字、品牌字、价签、菜单字、包装字、招牌字。`,
    '所有可能承载文字的表面都要改成纯色、抽象纹理、模糊图形或完全背向镜头，不允许正面展示带字平面。',
  ].join('')
}
function buildImageTextCleanupPrompt(input: PosterGenerateInput) {
  return [
    `这是 AI 海报主视觉图的清理任务，主题是「${input.theme || input.industry || '海报主视觉'}」。`,
    '请严格保留原图的主体、构图、镜头距离、光影、景深、色彩氛围与商业广告质感，只做去字去标处理。',
    '删除所有可读汉字、英文字母、数字、价格、品牌字、Logo、水印、二维码、菜单字、包装字、杯身字、瓶身标签、盒面标题、门头招牌、贴纸、角标、屏幕界面。',
    '重点处理杯身、包装盒、瓶身、餐盒、门头、桌牌、招贴、海报板、菜单牌、价签、标签贴纸，这些区域必须改成彻底无字版本。',
    '所有带字区域要改成干净纯色、无字包装、抽象纹理、自然材质或模糊不可读图形，不要留下伪文字、乱码字、装饰性字形。',
    '如果原图主体本身是容易出现文字的容器或包装，请优先重绘该表面，让它变成纯净、可商用、无任何字样的空白表面。',
    '不要新增任何文字、海报版式、信息卡片、按钮、排版元素；结果仍然只能是一张无字主视觉图片。',
  ].join('')
}
async function sanitizeGeneratedPosterImageIfNeeded(input: PosterGenerateInput, imageUrl: string, size: SizePreset) {
  const rawUrl = String(imageUrl || '').trim()
  if (!rawUrl) {
    return { imageUrl: rawUrl, cleaned: false }
  }
  const generationMode = normalizeGenerationMode(input.generationMode)
  try {
    const ready = ensureBailianReady('imageEdit', generationMode)
    let workingUrl = rawUrl
    const cleanupRounds = isHighTextRiskInput(input) ? 2 : 1
    for (let round = 0; round < cleanupRounds; round += 1) {
      const resolvedSourceImageUrl = await resolveRemoteModelImageUrl(workingUrl, ready.model, 'ai-clean-source')
      const prompt = `${buildImageTextCleanupPrompt(input)}${round > 0 ? '这是再次清理轮次，请继续彻底抹掉残余字形、伪字、杯身字和包装字。' : ''}`
      const taskResult = await requestBailianImageEdit(prompt, ready.model, resolvedSourceImageUrl, size)
      workingUrl = await saveRemoteImageToLocal(extractTaskImageUrl(taskResult), 'ai')
    }
    return { imageUrl: workingUrl, cleaned: true }
  } catch (error) {
    console.warn('[ai] sanitize generated poster image skipped:', error)
    return { imageUrl: rawUrl, cleaned: false }
  }
}
function buildTextFreeImageGuard() {
  return [
    '这张图必须是纯无字海报底图，后续标题、副标题、卖点、价格、按钮、二维码全部由可编辑文字图层完成，绝不能提前画进图片。',
    '硬性规则：no text, no typography, no letters, no words, no numbers, no logo, no watermark, no UI, no poster-in-poster, no flyer, no coupon, no signage, no interface, no caption, no label.',
    '禁止任何可读汉字、英文字母、数字、价格数字、Logo、二维码、角标、贴纸、信息卡片、海报文案、包装大字、包装正面品牌字、门头招牌字、菜品名、促销字样、屏幕界面、网页界面、手机界面。',
    '如果模型有写字倾向，请宁可输出干净留白，也不要输出任何伪文字、乱码字、可辨识字形或装饰性字样。',
    '如果场景里天然会出现招牌、包装、海报、菜单、屏幕、路牌、广告牌、灯箱、瓶身标签、食品包装，请把它们全部做成不可读、无字、纯图形化处理，绝不允许出现清晰字形。',
  ].join('')
}
function buildEditablePosterCompositionRules(mode: 'background' | 'hero') {
  if (mode === 'background') {
    return [
      '请把它当成可编辑海报系统的背景底图，而不是最终扁平海报。',
      '默认工作流是「图片层」与「文字层」分开编辑：图片只负责氛围、空间和主体承托，所有信息文字都由后续独立文字图层承载。',
      '必须预留完整标题安全区、正文信息区和 CTA 区，方便后续叠加可编辑文字。',
      '文字安全区后方的亮度和纹理要稳定，避免高反差纹理、碎高光、密集细节和杂乱边缘。',
      '未来会单独编辑标题、副标题、卖点 chips、价格块、按钮和二维码，所以不要让任何图像元素替代这些文字信息位。',
      '背景层应该托住文字，让后续排版可以直接做成品海报。',
    ].join('')
  }
  return [
    '请把它当成可编辑海报系统的主视觉底图，而不是已经写好字的最终海报。',
    '默认工作流是「主图层」与「文字层」完全拆开编辑：主图负责主体、质感和氛围，文案全部交给后续独立可编辑图层。',
    '主体要强，但必须同时给标题区、信息区、CTA 区留下完整呼吸空间，让后续文字保持大字号、强层级、易编辑。',
    '主体轮廓不要侵入主要文字安全区，避免后续标题只能缩小或压在复杂细节上。',
    '如果主体是商品、包装、牌匾、屏幕、杯身、盒面、海报板、价格签等可承载文字的物体，也必须做成空白版，让后续文字继续保持可编辑。',
    '结果要像成熟品牌海报的无字主 KV：主图负责氛围和主体，文字完全交给后续可编辑图层。',
  ].join('')
}
function shouldUseCompactImagePrompt(input: PosterGenerateInput, mode: 'background' | 'hero', generationMode: PosterGenerationMode, retryIndex = 0) {
  const scenario = getCopyScenario(input)
  if (retryIndex >= 1) return true
  if (generationMode !== 'fast') return false
  if (mode === 'background') return ['course', 'fitness', 'food'].includes(scenario)
  return ['course', 'fitness', 'food'].includes(scenario)
}
function buildCompactImagePrompt(input: PosterGenerateInput, mode: 'background' | 'hero', retryIndex = 0) {
  const scenario = getCopyScenario(input)
  const sceneCore = clipPosterText(`${input.theme || ''} ${input.content || ''}`.replace(/[|｜]/g, '，'), 72) || String(input.theme || input.industry || '商业海报').trim()
  const industry = String(input.industry || '商业').trim()
  const purpose = String(input.purpose || '推广').trim()
  const personMode = inferPersonVisualMode(input, deriveHeroStrategy(input))
  const subjectMatchDirective = buildImageSubjectMatchDirective(input, mode, personMode)
  const scenarioHint = scenario === 'course'
    ? '课程招生感，适合报名海报，安静专业，留白清晰'
    : scenario === 'recruit'
      ? '招聘成片感，岗位语义明确，信息安全区稳定，像成熟招聘 campaign'
    : scenario === 'fitness'
      ? '健身训练感，力量明确，背景干净，暗色层次稳定'
      : scenario === 'food'
        ? '餐饮新品感，食欲明确，主体大，暖色干净'
        : scenario === 'commerce'
          ? '电商广告感，商品或组合卖点明确，转化氛围清晰'
          : '商业海报感，主体明确，排版友好'
  const safetyHint = mode === 'background'
    ? '生成单张无字背景层，结构简洁，给标题和按钮留出大块安全区'
    : '生成单张无字主视觉，主体大且明确，给标题和CTA留出大块安全区'
  const retryHint = retryIndex >= 1 ? '请进一步简化画面，不要复杂场景，不要多人，不要拼贴' : ''
  return [
    sceneCore,
    `画面必须一眼看出这是${industry}方向的${purpose}海报`,
    scenarioHint,
    subjectMatchDirective,
    safetyHint,
    '海报级构图，主体清晰，背景纯净，层次稳定，适合后续叠加可编辑文字',
    '构图必须像真实成片海报主视觉：edge-to-edge full-bleed，主体更近、更大、更满，不要像中间摆一件商品再留一圈白边',
    '不要生成居中小主体、产品孤立摆拍、白底展台、四周留大空边、像画框里再放一张产品图的构图',
    'no text, no letters, no numbers, no logo, no watermark, no UI, no poster-in-poster',
    '禁止招牌字、包装字、屏幕字、价签字、菜单字，宁可留白也不要伪文字',
    retryHint,
  ].filter(Boolean).join('。')
}
function buildImagePrompt(input: PosterGenerateInput, mode: 'background' | 'hero', taskMode?: ImageTaskMode, retryIndex = 0) {
  const generationMode = normalizeGenerationMode(input.generationMode)
  if (shouldUseCompactImagePrompt(input, mode, generationMode, retryIndex)) {
    return buildCompactImagePrompt(input, mode, retryIndex)
  }
  const narration = buildImageSceneNarration(input)
  const industryMood = buildImageIndustryMood(input)
  const purposeMood = buildImagePurposeMood(input)
  const styleMood = buildImageStyleMood(input.style || '')
  const semanticGuard = buildImageSemanticGuard(input)
  const inferredHeroStrategy = deriveHeroStrategy(input)
  const personMode = inferPersonVisualMode(input, inferredHeroStrategy)
  const subjectDirective = buildHeroSubjectDirective(input, inferredHeroStrategy, personMode)
  const subjectMatchDirective = buildImageSubjectMatchDirective(input, mode, personMode)
  const personBiasGuard = buildPersonBiasGuard(input, personMode)
  const craft = buildImageCraftSuffix(mode)
  const textFreeGuard = buildTextFreeImageGuard()
  const editableRules = buildEditablePosterCompositionRules(mode)
  const retryDirective = buildRetryTextFreeDirective(input, mode, retryIndex)
  const posterDirective = buildCommercialPosterDirective()
  const coordinationDirective = buildPosterCoordinationDirective(input)
  const recruitLike = /招聘|人力|hr/i.test(`${input.industry || ''} ${input.purpose || ''} ${input.theme || ''} ${input.content || ''}`)
  const isRefreshHero = taskMode === 'refresh-hero'
  const isRefreshBackground = taskMode === 'refresh-background'
  if (mode === 'background') {
    return [
      posterDirective,
      coordinationDirective,
      isRefreshBackground
        ? '当前任务是「换背景」微调，请直接生成更适合成品海报落版的背景终稿，重点提升层次、质感、信息区可读性与海报完成度。'
        : '当前任务是生成新海报的背景层，请直接给出可用于成品海报的背景终稿。',
      generationMode === 'fast'
        ? '本次是快速生成模式：请优先单一主体、清晰留白、稳定构图与可排版性，用更直接的镜头快速形成成片海报底图。'
        : '本次生成以效果优先，不需要节省生成成本，请按最高质量完成，相当于把可用鲲币都用于提升画面高级感与海报完成度。',
      '请生成商业海报可用的「背景层」：必须有成品海报级别的视觉张力、空间层次和高级感，像成熟品牌海报、杂志封面或广告 KV 的底层主画面。',
      '这不是普通背景素材，而是最终海报成功与否的关键底图。必须高级、完整、统一、干净，不能像图库陪衬。',
      narration + '。',
      subjectMatchDirective,
      industryMood,
      purposeMood,
      styleMood,
      subjectDirective,
      semanticGuard,
      personBiasGuard,
      craft,
      editableRules,
      textFreeGuard,
      retryDirective,
      '请把这个结果理解成现代 AI 设计工具里的独立背景图层：图像只负责气氛与空间，所有标题、卖点、价格、按钮都不允许烙死在像素里。',
      '单幅连续场景或有机纹理，景深自然；构图里要主动留出清晰标题安全区、主体承载区和信息区；前中后景层次明确，主色块清晰，允许有戏剧性光束、反射、空气透视、地面投影或环境虚化来增强海报感。',
      '标题安全区和按钮信息区必须是相对干净、亮度稳定、纹理不过分密集的区域，不能把最亮、最花、最高对比的细节放在文字预留位后面。',
      '标题区后方优先使用整块受控明暗面或大面积纯净渐变，不要把高频细节、霓虹字牌、颗粒纹理、密集商品阵列放到文字层背后。',
      '背景必须像给文案让位的专业海报底图，而不是随便一张风景或棚拍素材；不要白底、不要主体贴边撑满、不要凌乱小物堆积。',
      '画面要有明确主色和次色关系，信息区要相对平整、可叠字、可读，不允许整张图过花、过碎、过满导致无法排版。',
      recruitLike
        ? '如果是招聘海报背景，优先做大块稳定底面、公告栏式版心、边框感或墙面/纸面留白；不要把电脑屏幕、会议白板、投影页、工牌墙、办公标语、门头字牌放进主信息区。'
        : '',
      '如果是餐饮、门店、产品包装等容易自带文字的场景，必须主动规避菜单字、招牌字、包装字、品牌字、价格签、贴纸字；宁可用纯图形包装或虚化处理，也不要出现可读字。',
      '禁止任何可读文字、数字、Logo、二维码、UI 界面、画中画、套娃海报、小卡片、宣传单、海报边框内再套另一张海报。',
    ].join('')
  }
  const personHint = /招聘|人力|HR/.test(String(input.industry || ''))
    ? `以真实招聘品牌视觉为主：${buildRecruitmentVisualMood(input)} 优先岗位相关团队协作、门店服务、接待台、制作台、校招交流、办公协作、宣传画式群像或真实工作场景；只有在主题明确需要时才使用单人职业肖像。严禁把职位描述、公司 slogan、屏幕界面、工牌字、门头字、白板字、海报字画进主视觉；同时少出普通办公室 stock 感、小会议室摆拍、空工位、电脑特写。`
    : /健身|运动|瑜伽|训练/.test(String(input.industry || ''))
      ? '以真实健身房或运动场景摄影为主，人物自然，构图留白；背景保持深色纯净与层次感，不允许出现任何墙面大字、霓虹字牌、服饰字样、器械可读 logo。'
      : ''
  return [
    posterDirective,
    coordinationDirective,
    isRefreshHero
      ? '当前任务是「换主图」微调，请直接生成更强的海报主视觉终稿，要求比当前主图更像成熟广告大片或封面图，不能只是普通替换图。'
      : '当前任务是生成新海报主视觉，请直接给出可用于成品海报的主视觉终稿。',
    generationMode === 'fast'
      ? '本次是快速生成模式：请优先单主体、大主体、强层次、稳定留白，直接生成能上版的海报主视觉，不要复杂拼贴。'
      : '本次生成以效果优先，不需要节省生成成本，请按最高质量完成，相当于把可用鲲币都用于提升主视觉冲击力与成片质感。',
    '请生成一张用于商业海报的「主视觉摄影或插画底图」（单张连贯画面），后续会在上层由设计师排版叠字；这张图必须具备直接做成优秀海报成片的视觉冲击力，完成度接近成熟品牌海报、杂志封面或广告大片静帧。',
    '这张图不是普通配图，而是整张海报的主角。第一眼必须抓人，主体必须明确，气质必须高级，不能像电商白底图、游客照或随手素材。',
    personHint,
    recruitLike
      ? '招聘主视觉硬性要求：必须为标题、副标题、岗位信息卡、CTA 预留清晰安全区；宁可留白更多，也不要让人物、边框、屏幕、桌面杂物侵入这些区域。主视觉要像成熟招聘海报底图，而不是普通企业宣传照。'
      : '',
    narration + '。',
    subjectMatchDirective,
    industryMood,
    purposeMood,
    styleMood,
    subjectDirective,
    semanticGuard,
    personBiasGuard,
    craft,
    editableRules,
    textFreeGuard,
    retryDirective,
      '请把这个结果理解成现代 AI 设计工具里的独立主图层：图像只负责主体和氛围，标题、副标题、价格、卖点、CTA 将由后续独立文字图层完成。',
    '构图要像海报而不是素材库样片：主体明确且占画面较大比例，主体最好占主要视觉面积的 55%~75%，镜头更靠近主体，轮廓清楚，背景层次干净，高对比与主色块关系明确，同时保留至少一块适合放大标题的安全留白。',
    '画面必须是 edge-to-edge full-bleed 的完整主视觉，不要出现居中小主体、白底展台、产品被一圈大留白包住、像画框中再放一张商品图、像海报里嵌一张方形主图的构图。',
    '如果是电商、餐饮、课程、招聘等商业海报场景，优先用更近的镜头、更满的主体和更连续的背景面，宁可裁切更大胆，也不要松散地把主体缩在中间。',
    '标题安全区和 CTA 区必须留在相对平整、亮度受控的位置，避免把最亮高光、强纹理、碎细节或复杂边缘直接放到未来文字所在区域后面。',
    '标题安全区后方最好是单一大色块、柔和渐层、纯净墙面、虚化空间或受控光面，让后续大标题能保持清晰高对比，不要让头发丝、商品堆叠、发光招牌、复杂纹理进入文字层区域。',
    '主体必须避免呆站、僵硬、平拍、证件照式构图；优先生成具有品牌拍摄感的动作、姿态、表情、材质或戏剧性光影关系。',
    '如果主体是食品、商品包装、门店、招牌、餐盒、饮料杯、礼盒、设备面板、屏幕或背景广告位，必须全部做成无字版本，不能出现菜名、品牌字、标签字、规格字、价格字。',
    '硬性要求：画面中不得出现任何可读文字、汉字、字母、数字、二维码、Logo、App 界面、网页截图、手机边框内的界面、KT 板、传单、优惠券、信息卡片；禁止拼贴画框中的迷你海报、禁止画中画、禁止递归嵌套另一张带标题的海报、禁止圆角悬浮贴纸式「小海报」、禁止带标题栏的 UI 面板；不要出现「用途」「行业」「主题」「风格」等标签字样。',
    '构图：单一主体或单一场景镜头，主体清晰、光影戏剧感与层次丰富，同时在上半区或画面边缘保留可叠字的安全留白；鼓励低机位、侧逆光、近景特写、品牌级打光、明确前景遮挡、环境纵深或边缘轮廓光来提升海报张力。',
    '请优先生成像封面、像 campaign、像品牌广告的画面，而不是普通电商素材、游客照、会议照、产品白底图、呆站构图。',
  ].join('')
}
function cleanJsonText(content: string) { return String(content || '').replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim() }
function extractBalancedJsonObject(content: string) {
  const cleaned = cleanJsonText(content)
  const start = cleaned.indexOf('{')
  if (start < 0) return cleaned
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < cleaned.length; i += 1) {
    const ch = cleaned[i]
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (ch === '\\') {
        escaped = true
      } else if (ch === '"') {
        inString = false
      }
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{') depth += 1
    if (ch === '}') {
      depth -= 1
      if (depth === 0) return cleaned.slice(start, i + 1)
    }
  }
  const last = cleaned.lastIndexOf('}')
  return last > start ? cleaned.slice(start, last + 1) : cleaned
}
function normalizeLooseJsonText(content: string) {
  return extractBalancedJsonObject(content)
    .replace(/^\uFEFF/, '')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/[\u0000-\u0019]+/g, ' ')
    .trim()
}
function parseModelJsonObject(content: string) {
  const attempts = [
    cleanJsonText(content),
    normalizeLooseJsonText(content),
  ]
  let lastError: any = null
  for (const text of attempts) {
    if (!text) continue
    try {
      return JSON.parse(text)
    } catch (error) {
      lastError = error
    }
  }
  throw lastError || new Error('invalid json response')
}
function normalizeImageResult(imageUrl: string, prompt: string): PosterImageResult { return { imageUrl, prompt } }
function shouldRetryBailianError(error: any) { const status = Number(error?.response?.status || 0); const message = String(error?.message || ''); return status === 429 || status >= 500 || error?.code === 'ECONNRESET' || error?.code === 'ETIMEDOUT' || /timeout/i.test(message) || /socket hang up/i.test(message) }
async function withBailianRetry<T>(task: () => Promise<T>, retryTimes = BAILIAN_RETRY_TIMES) { let lastError: unknown; for (let i = 0; i <= retryTimes; i += 1) { try { return await task() } catch (error) { lastError = error; if (i >= retryTimes || !shouldRetryBailianError(error)) throw error; await new Promise((r) => setTimeout(r, (i + 1) * 2000)) } } throw lastError }
function getBailianImageCooldownMs() { const value = Number(getEnv('AI_BAILIAN_IMAGE_COOLDOWN_MS', String(DEFAULT_BAILIAN_IMAGE_COOLDOWN_MS))); return Number.isFinite(value) && value >= 0 ? value : DEFAULT_BAILIAN_IMAGE_COOLDOWN_MS }
function getBailianImageMaxConcurrency() { const value = Number(getEnv('AI_BAILIAN_IMAGE_MAX_CONCURRENCY', String(DEFAULT_BAILIAN_IMAGE_MAX_CONCURRENCY))); return Number.isFinite(value) && value >= 1 ? Math.floor(value) : DEFAULT_BAILIAN_IMAGE_MAX_CONCURRENCY }
async function acquireBailianImageSlot() {
  const maxConcurrency = getBailianImageMaxConcurrency()
  if (bailianImageActiveCount >= maxConcurrency) {
    await new Promise<void>((resolve) => bailianImageWaiters.push(resolve))
  }
  bailianImageActiveCount += 1
}
function releaseBailianImageSlot() {
  bailianImageActiveCount = Math.max(0, bailianImageActiveCount - 1)
  const next = bailianImageWaiters.shift()
  if (next) next()
}
async function queueBailianImageRequest<T>(task: () => Promise<T>) {
  await acquireBailianImageSlot()
  try {
    const wait = getBailianImageCooldownMs() - (Date.now() - lastBailianImageRequestAt)
    if (lastBailianImageRequestAt > 0 && wait > 0) {
      await new Promise((r) => setTimeout(r, wait))
    }
    lastBailianImageRequestAt = Date.now()
    return await task()
  } finally {
    releaseBailianImageSlot()
  }
}
function ensureInternalFetchUrl(url: string) {
  const raw = String(url || '').trim()
  if (!raw) return raw
  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw)
      const appHosts = new Set(
        [getClientSiteRootUrl(), getClientStaticBaseUrl()]
          .map((item) => {
            try { return /^https?:\/\//i.test(String(item || '').trim()) ? new URL(String(item)).hostname : '' } catch { return '' }
          })
          .filter(Boolean),
      )
      if (appHosts.has(parsed.hostname)) {
        return `${getInternalApiOrigin()}${parsed.pathname}${parsed.search}${parsed.hash}`
      }
    } catch {
      return raw
    }
    return raw
  }
  if (/^\/\//.test(raw)) return `https:${raw}`
  if (raw.startsWith('/')) return `${getInternalApiOrigin()}${raw}`
  return raw
}
function ensurePublicSourceUrl(url: string) {
  const raw = String(url || '').trim()
  if (!raw) return raw
  if (/^https?:\/\//i.test(raw)) return raw
  if (/^\/\//.test(raw)) return `https:${raw}`
  if (raw.startsWith('/')) {
    const siteRoot = String(getClientSiteRootUrl() || '').trim()
    if (/^https?:\/\//i.test(siteRoot)) {
      return `${siteRoot.replace(/\/$/, '')}${raw}`
    }
  }
  return raw
}
function getImageExtension(contentType: string, fallback = 'png') { if (contentType.includes('jpeg')) return 'jpg'; if (contentType.includes('webp')) return 'webp'; if (contentType.includes('gif')) return 'gif'; return fallback }
function buildRemoteAssetFileName(url: string, fallbackExt = 'png') {
  const raw = String(url || '').trim()
  const fallback = `${randomCode(14)}.${fallbackExt}`
  if (!raw) return fallback
  try {
    const parsed = new URL(raw, 'https://local.asset')
    const ext = String(path.extname(parsed.pathname || '') || '').replace(/^\./, '').trim()
    return `${randomCode(14)}.${ext || fallbackExt}`
  } catch {
    const ext = String(path.extname(raw.split('?')[0] || '') || '').replace(/^\./, '').trim()
    return `${randomCode(14)}.${ext || fallbackExt}`
  }
}
function getUrlExtension(url: string, fallback = 'png') {
  const raw = String(url || '').trim()
  if (!raw) return fallback
  try {
    const parsed = new URL(raw, 'https://local.asset')
    const ext = String(path.extname(parsed.pathname || '') || '').replace(/^\./, '').trim()
    return ext || fallback
  } catch {
    const ext = String(path.extname(raw.split('?')[0] || '') || '').replace(/^\./, '').trim()
    return ext || fallback
  }
}
function getMimeTypeByExtension(ext: string) {
  const safe = String(ext || '').trim().toLowerCase().replace(/^\./, '')
  if (safe === 'jpg' || safe === 'jpeg') return 'image/jpeg'
  if (safe === 'webp') return 'image/webp'
  if (safe === 'gif') return 'image/gif'
  return 'image/png'
}
async function saveRemoteImageToLocal(url: string, folder: string) { const finalUrl = ensureInternalFetchUrl(url); const targetFolder = path.join(filePath, folder); checkCreateFolder(targetFolder); const response = await axiosClient.get(finalUrl, { responseType: 'arraybuffer', timeout: 120000 }); const extension = getImageExtension(String(response.headers['content-type'] || ''), getUrlExtension(finalUrl, 'png')); const fileName = `${randomCode(14)}.${extension}`; fs.writeFileSync(path.join(targetFolder, fileName), Buffer.from(response.data)); return `${getClientStaticBaseUrl()}${folder}/${fileName}` }
async function saveRemoteImageToLocalAsset(url: string, folder: string) { const assetUrl = await saveRemoteImageToLocal(url, folder); const fileName = path.basename(assetUrl); return { fileName, assetPath: path.join(filePath, folder, fileName), assetUrl } }
function resolveExistingLocalImagePath(rawUrl: string) {
  const safe = String(rawUrl || '').trim()
  if (!safe) return ''
  let fileName = ''
  let folderName = 'ai'
  try {
    const parsed = /^https?:\/\//i.test(safe) || /^data:/i.test(safe) ? new URL(safe) : new URL(safe, 'https://local.asset')
    const segments = String(parsed.pathname || '').split('/').filter(Boolean)
    fileName = segments[segments.length - 1] || ''
    const staticIndex = segments.lastIndexOf('static')
    if (staticIndex >= 0 && segments[staticIndex + 1]) {
      folderName = segments[staticIndex + 1]
    } else if (segments.length >= 2) {
      folderName = segments[segments.length - 2]
    }
  } catch {
    fileName = path.basename(safe.split('?')[0] || '')
  }
  if (!fileName) return ''
  const candidates = [
    path.join(filePath, folderName, fileName),
    path.join(process.cwd(), 'static', folderName, fileName),
  ]
  return candidates.find((item) => fs.existsSync(item)) || ''
}
async function resolveInlineModelImageUrl(rawUrl: string, folder = 'ai-inline') {
  const safe = String(rawUrl || '').trim()
  if (!safe) throw new Error('empty image url')
  if (/^data:image\//i.test(safe)) return safe
  const localExisting = resolveExistingLocalImagePath(safe)
  const asset = localExisting
    ? { assetPath: localExisting, fileName: path.basename(localExisting) }
    : await saveRemoteImageToLocalAsset(safe, folder)
  const buffer = fs.readFileSync(asset.assetPath)
  const ext = path.extname(asset.fileName || asset.assetPath).replace(/^\./, '')
  const mime = getMimeTypeByExtension(ext)
  return `data:${mime};base64,${buffer.toString('base64')}`
}
function getPublicBaseHostname(input: string) {
  const raw = String(input || '').trim()
  if (!/^https?:\/\//i.test(raw)) return ''
  try {
    return new URL(raw).hostname
  } catch {
    return ''
  }
}
function canUseDirectRemoteModelSourceUrl(url: string) {
  if (!canUseDirectCutoutSourceUrl(url)) return false
  try {
    const parsed = new URL(url)
    const blockedHosts = new Set(
      [getClientSiteRootUrl(), getClientStaticBaseUrl()]
        .map((item) => getPublicBaseHostname(item))
        .filter(Boolean),
    )
    return !blockedHosts.has(parsed.hostname)
  } catch {
    return false
  }
}
async function resolveRemoteModelImageUrl(rawUrl: string, model: string, folder = 'ai-source', options?: { preferTmpfiles?: boolean }) {
  const preferredUrl = ensurePublicSourceUrl(rawUrl)
  if (canUseDirectRemoteModelSourceUrl(preferredUrl)) {
    return preferredUrl
  }
  const asset = await saveRemoteImageToLocalAsset(rawUrl, folder)
  if (options?.preferTmpfiles) {
    try {
      return await uploadLocalFileToTmpfiles(asset.assetPath, asset.fileName || buildRemoteAssetFileName(rawUrl))
    } catch (error) {
      console.warn('[ai] tmpfiles upload failed, retrying with dashscope oss:', error)
    }
  }
  try {
    return await uploadLocalFileToDashScopeOss(asset.assetPath, asset.fileName || buildRemoteAssetFileName(rawUrl), model)
  } catch (error) {
    console.warn('[ai] dashscope temporary upload failed, retrying with tmpfiles:', error)
  }
  return uploadLocalFileToTmpfiles(asset.assetPath, asset.fileName || buildRemoteAssetFileName(rawUrl))
}
function extractTaskImageUrl(response: any) { const output = response?.output || {}; const results = output.results || output.result || []; const candidates: string[] = []; const push = (value: any) => value && candidates.push(String(value)); if (Array.isArray(results)) results.forEach((item) => { push(item?.url); push(item?.image_url); push(item?.image?.url) }); else { push(results?.url); push(results?.image_url); push(results?.image?.url) } (output.choices || []).forEach((choice: any) => (choice?.message?.content || []).forEach((item: any) => { push(item?.image); push(item?.url) })); push(output?.image_url); push(output?.url); push(output?.result_url); const usable = candidates.find(Boolean); if (!usable) throw new Error('missing generated image url'); return usable }
async function pollBailianTask(
  taskId: string,
  options?: {
    maxPolls?: number
    pollIntervalMs?: number
    timeoutLabel?: string
  },
) {
  const maxPolls = options?.maxPolls || getBailianTaskMaxPolls()
  const pollIntervalMs = options?.pollIntervalMs || getBailianTaskPollIntervalMs()
  const timeoutLabel = options?.timeoutLabel || 'task timeout'
  for (let i = 0; i < maxPolls; i += 1) {
    const data: any = await axiosClient.get(`${getApiBaseUrl()}/tasks/${taskId}`, { headers: { Authorization: `Bearer ${getBailianApiKey()}` }, timeout: getBailianImageTimeoutMs() })
    const status = String(data?.output?.task_status || '').toUpperCase()
    if (status === 'SUCCEEDED') return data
    if (status === 'FAILED' || status === 'CANCELED') throw new Error(String(data?.output?.message || data?.message || data?.code || 'task failed'))
    await new Promise((r) => setTimeout(r, pollIntervalMs))
  }
  throw new Error(`${timeoutLabel} after ${maxPolls} polls`)
}
async function requestBailianChat(messages: Array<{ role: string; content: string }>, model: string, options?: { timeoutMs?: number; retryTimes?: number; enableThinking?: boolean }) { const body: any = { model, messages, temperature: 0.8, response_format: { type: 'json_object' } }; if (typeof options?.enableThinking === 'boolean') body.enable_thinking = options.enableThinking; const data: any = await withBailianRetry(() => axios.post(`${getCompatibleBaseUrl()}/chat/completions`, body, { headers: { Authorization: `Bearer ${getBailianApiKey()}`, 'Content-Type': 'application/json' }, timeout: options?.timeoutMs || getBailianChatTimeoutMs() }), options?.retryTimes); const content = data?.choices?.[0]?.message?.content || ''; if (!content) throw new Error('empty model response'); return parseModelJsonObject(content) }
async function repairVisionJsonViaTextModel(rawContent: string) {
  const repairModel = getProviderModel('relayout', 'fast')
  return requestBailianChat([
    { role: 'system', content: '你是 JSON 修复器。只输出严格 JSON，不要解释，不要 markdown。' },
    {
      role: 'user',
      content: [
        '把下面这段多模态海报分析结果整理为严格 JSON。',
        '仅允许输出字段：safeZones, avoidZones, suggestedPlacement, textStyleHints, visualAnalysis, layoutDecision。',
        'safeZones/avoidZones/suggestedPlacement 的每个对象都必须包含 x,y,w,h，范围 0~1。',
        'suggestedPlacement.role 仅允许：heroHeadline, supportLine, body, cta, badge, priceBlock。',
        'textStyleHints 必须是数组，role 仅允许：heroHeadline, supportLine, body, cta, badge, priceBlock；treatment 仅允许 clean/outline/panel。',
        'layoutDecision.recommendedFamily 仅允许：hero-center, hero-left, split-editorial, grid-product, magazine-cover, festive-frame, list-recruitment, xiaohongshu-note, clean-course, premium-offer。',
        '如果原文只有语义描述没有坐标，请根据语义补成最合理的相对坐标。',
        '原始内容如下：',
        String(rawContent || '').slice(0, 12000),
      ].join('\n'),
    },
  ], repairModel, {
    timeoutMs: 15000,
    retryTimes: 0,
    enableThinking: false,
  })
}
async function requestBailianVisionChat(imageUrl: string, prompt: string, model: string, options?: { timeoutMs?: number; retryTimes?: number }) {
  const data: any = await withBailianRetry(
    () =>
      axios.post(
        `${getCompatibleBaseUrl()}/chat/completions`,
        {
          model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: imageUrl } },
                { type: 'text', text: prompt },
              ],
            },
          ],
          temperature: 0.2,
          response_format: { type: 'json_object' },
        },
        {
          headers: {
            Authorization: `Bearer ${getBailianApiKey()}`,
            'Content-Type': 'application/json',
            'X-DashScope-OssResourceResolve': 'enable',
          },
          timeout: options?.timeoutMs || getEnvNumber('AI_MULTIMODAL_LAYOUT_TIMEOUT_MS', getDraftChatTimeoutMs()),
        },
      ),
    options?.retryTimes,
  )
  const content = data?.choices?.[0]?.message?.content || ''
  if (!content) throw new Error('empty multimodal layout response')
  try {
    return parseModelJsonObject(content)
  } catch (error) {
    try {
      return await repairVisionJsonViaTextModel(content)
    } catch (repairError) {
      throw new Error(`${(error as Error)?.message || 'invalid multimodal json'}; repair=${(repairError as Error)?.message || 'repair failed'}`)
    }
  }
}
async function requestBailianTextToImage(prompt: string, model: string, size: SizePreset, promptExtend = false) { return queueBailianImageRequest(() => withBailianRetry(() => axios.post(`${getApiBaseUrl()}/services/aigc/multimodal-generation/generation`, { model, input: { messages: [{ role: 'user', content: [{ text: prompt }] }] }, parameters: { size: `${Math.min(size.width, 2048)}*${Math.min(size.height, 2048)}`, n: 1, ...(promptExtend && supportsPromptExtend(model) ? { prompt_extend: true } : {}), watermark: false } }, { headers: { Authorization: `Bearer ${getBailianApiKey()}`, 'Content-Type': 'application/json' }, timeout: getBailianImageTimeoutMs() }))) }
async function requestBailianImageEdit(prompt: string, model: string, imageUrl: string, size: SizePreset) {
  return queueBailianImageRequest(() =>
    withBailianRetry(() =>
      axios.post(
        `${getApiBaseUrl()}/services/aigc/multimodal-generation/generation`,
        {
          model,
          input: { messages: [{ role: 'user', content: [{ image: imageUrl }, { text: prompt }] }] },
          parameters: { size: `${Math.min(size.width, 2048)}*${Math.min(size.height, 2048)}`, n: 1, watermark: false },
        },
        { headers: { Authorization: `Bearer ${getBailianApiKey()}`, 'Content-Type': 'application/json', 'X-DashScope-OssResourceResolve': 'enable' }, timeout: getBailianImageTimeoutMs() },
      ),
    ),
  )
}
async function requestBailianBackground(prompt: string, model: string, baseImageUrl: string) { const data: any = await queueBailianImageRequest(() => withBailianRetry(() => axios.post(`${getApiBaseUrl()}/services/aigc/background-generation/generation/`, { model, input: { base_image_url: baseImageUrl, ref_prompt: prompt }, parameters: { model_version: getBackgroundModelVersion() } }, { headers: { Authorization: `Bearer ${getBailianApiKey()}`, 'Content-Type': 'application/json', 'X-DashScope-Async': 'enable', 'X-DashScope-OssResourceResolve': 'enable' }, timeout: getBailianImageTimeoutMs() }))); const taskId = String(data?.output?.task_id || '').trim(); if (!taskId) throw new Error('missing background task id'); return pollBailianTask(taskId) }
async function withRequiredImageSuccess(stage: '主图生成' | '背景生成' | '换图', task: () => Promise<ProviderResult<PosterImageResult>>) {
  let lastError: unknown = new Error(`${stage}未返回图片`)
  for (let i = 0; i <= BAILIAN_REQUIRED_IMAGE_RETRY_TIMES; i += 1) {
    try {
      const result = await task()
      if (String(result?.result?.imageUrl || '').trim()) {
        return result
      }
      lastError = new Error(`${stage}未返回图片`)
    } catch (error) {
      lastError = error
    }
    if (i < BAILIAN_REQUIRED_IMAGE_RETRY_TIMES) {
      await new Promise((resolve) => setTimeout(resolve, (i + 1) * 1500))
    }
  }
  throw new Error(buildStrictProviderError(stage, lastError))
}
function sanitizeCopyEcho(raw: string) {
  let s = String(raw || '').trim()
  s = s.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !/^(主题|用途|行业|风格|尺寸|补充信息)[：:]/.test(l)).join('\n')
  s = s.replace(/主视觉预览图[/／、\s]*氛围图/g, '')
  s = s.replace(/(?:^|[\s\u3000；;，,])(主题|用途|行业|风格|尺寸)[：:]\s*[^\s\n\u3000；;，,。]{1,32}/g, ' ')
  s = s.replace(/\s{2,}/g, ' ').trim()
  return s
}
function finalizeCopyField(value: string, fallback: string) {
  const cleaned = sanitizeCopyEcho(value)
  return cleaned || sanitizeCopyEcho(fallback) || fallback
}
function buildLocalCopyResult(input: PosterGenerateInput): ProviderResult<CopyResult> {
  const fallback = buildPosterProtocol(input, pickScenarioCopy(input))
  return {
    result: fallback.copy,
    meta: getProviderMeta('copy', { provider: 'local-poster-engine', model: 'deterministic-copy', message: '已生成适合海报落版的文案。' }, normalizeGenerationMode(input.generationMode)),
  }
}
function buildLocalPaletteResult(input: PosterGenerateInput): ProviderResult<PosterPalette> {
  const recruitMode = inferRecruitmentCreativeMode(input)
  const recruitLike = input.presetKey === 'recruitment' || /招聘|招募/.test(`${input.industry || ''} ${input.purpose || ''} ${input.theme || ''}`)
  let result = clone(paletteByIndustry[input.industry] || paletteByIndustry[DEFAULT_INDUSTRY])
  if (recruitLike) {
    if (recruitMode === 'retro') {
      result = {
        background: '#EFE3CC',
        surface: '#FFF6E8',
        primary: '#A63322',
        secondary: '#6A4A36',
        text: '#2E221A',
        muted: '#7A5A46',
        swatches: ['#EFE3CC', '#FFF6E8', '#A63322', '#6A4A36', '#2E221A'],
      }
    } else if (recruitMode === 'black-gold') {
      result = {
        background: '#0D0D10',
        surface: '#17171C',
        primary: '#D4A851',
        secondary: '#40311A',
        text: '#F6E7C3',
        muted: '#C7B38A',
        swatches: ['#0D0D10', '#17171C', '#D4A851', '#40311A', '#F6E7C3'],
      }
    } else if (recruitMode === 'bold-red') {
      result = {
        background: '#FFF6F3',
        surface: '#FFFFFF',
        primary: '#C61F1F',
        secondary: '#8D1212',
        text: '#2A0E0E',
        muted: '#7A2B2B',
        swatches: ['#FFF6F3', '#FFFFFF', '#C61F1F', '#8D1212', '#2A0E0E'],
      }
    } else {
      result = {
        background: '#F4F0E8',
        surface: '#FFFDFC',
        primary: '#222222',
        secondary: '#A63A2B',
        text: '#1D1D1D',
        muted: '#5B5B5B',
        swatches: ['#F4F0E8', '#FFFDFC', '#222222', '#A63A2B', '#5B5B5B'],
      }
    }
  }
  return {
    result,
    meta: getProviderMeta('palette', { provider: 'local-poster-engine', model: recruitLike ? `recruitment-${recruitMode}-palette` : 'industry-palette', message: recruitLike ? '已按招聘海报风格生成专属配色。' : '已生成适合当前行业的海报配色。' }, normalizeGenerationMode(input.generationMode)),
  }
}
function buildAiProtocolPaletteFallback(input: PosterGenerateInput, reason: string): ProviderResult<PosterPalette> {
  const fallback = buildLocalPaletteResult(input)
  return {
    result: fallback.result,
    meta: getProviderMeta('palette', {
      provider: 'ai-protocol',
      model: 'scene-tone-derived-palette',
      isMockFallback: false,
      message: `AI 配色未及时返回，已沿用场景、风格与版式语义派生色板：${reason}`,
    }, normalizeGenerationMode(input.generationMode)),
  }
}
function buildLocalRelayoutResult(input: PosterGenerateInput, candidates: any[]): { plan: PosterGenerateResult['designPlan']; meta: AiProviderMeta } {
  const resolvedCandidates = candidates?.length
    ? candidates
    : getTemplateCandidatesSmart(input.presetKey || '', input.industry, 6, input)
  const size = sizeMap[input.sizeKey] || sizeMap.xiaohongshu
  return {
    plan: { ...deriveDesignPlan(input, resolvedCandidates, size), templateCandidates: resolvedCandidates },
    meta: getProviderMeta('relayout', { provider: 'local-poster-engine', model: 'layout-heuristic', message: '已按当前内容智能匹配更合适的稳定版式。' }, normalizeGenerationMode(input.generationMode)),
  }
}
async function generateCopyInternal(input: PosterGenerateInput, mode: CopyTaskMode = 'draft'): Promise<ProviderResult<CopyResult>> {
  const generationMode = normalizeGenerationMode(input.generationMode)
  try {
    const ready = ensureBailianReady('copy', generationMode)
    const isDraftMode = mode === 'draft'
    const requestOptions = {
      timeoutMs: getStageTimeoutMs('copy', generationMode, isDraftMode ? 'draft' : 'refine'),
      retryTimes: getStageRetryTimes('copy', generationMode, isDraftMode ? 'draft' : 'refine'),
      enableThinking: generationMode !== 'fast',
    }
    const parsed = generationMode === 'fast'
      ? await (async () => {
        const [core, deck] = await Promise.all([
          requestBailianChat(
            [
              { role: 'system', content: '你是中文海报文案助手。只输出 JSON。字段仅允许 title/slogan/body/cta/posterIntent。' },
              { role: 'user', content: buildFastCopyCorePrompt(input, mode) },
            ],
            ready.model,
            requestOptions,
          ),
          requestBailianChat(
            [
              { role: 'system', content: '你是中文海报成片结构助手。只输出 JSON。字段仅允许 copyDeck。' },
              { role: 'user', content: buildFastCopyDeckPrompt(input) },
            ],
            ready.model,
            requestOptions,
          ),
        ])
        return {
          ...core,
          copyDeck: deck?.copyDeck || {},
        }
      })()
      : await requestBailianChat(
        [
          { role: 'system', content: '你是中文海报文案助手。只输出 JSON。必填字段为 title/slogan/body/cta/posterIntent/copyDeck。copyDeck 必须包含 heroHeadline/supportLine/offerLine/urgencyLine/actionReason/cta/ctaAlternatives/badge/proofPoints/factCards/priceBlock/audienceLine/trustLine。slogan 必须是辅助性一行卖点，不得与 title 重复或同义复述。title/slogan/body 必须是给消费者看的句子，禁止出现「主题：」「用途：」「行业：」等字段名或参数清单。所有字段在语气与信息上相互补充，避免各说各话。ctaAlternatives 如输出，需给 2~4 条不同动作表达，不能只是同义重复。' },
          { role: 'user', content: buildCopyPrompt(input, mode) },
        ],
        ready.model,
        requestOptions,
      )
    const { facts } = collectPosterFacts(input)
    const baseHeadline = buildThemeFactHeadline(input, facts)
    const baseSlogan = clipPosterText([facts.benefit, facts.audience, facts.time].filter(Boolean).join('｜'), 26)
    const baseBody = normalizeCopySegments([facts.benefit, facts.price, facts.time, facts.place, facts.audience], POSTER_BODY_SEGMENT_LIMIT).join('｜')
    const baseCta = buildCta(input.purpose)
    const enriched = buildPosterProtocol(input, {
      title: finalizeCopyField(String(parsed.title || '').trim(), baseHeadline),
      slogan: finalizeCopyField(String(parsed.slogan || '').trim(), baseSlogan),
      body: finalizeCopyField(String(parsed.body || '').trim(), baseBody),
      cta: finalizeCopyField(String(parsed.cta || '').trim(), baseCta),
      ctaAlternatives: normalizeCtaList(parsed.ctaAlternatives, 4),
      badge: finalizeCopyField(String(parsed.badge || '').trim(), ''),
      offerLine: finalizeCopyField(String(parsed.offerLine || '').trim(), ''),
      urgencyLine: finalizeCopyField(String(parsed.urgencyLine || '').trim(), ''),
      proofPoints: normalizeCopySegments(parsed.proofPoints, POSTER_BODY_SEGMENT_LIMIT),
      posterIntent: parsed.posterIntent,
      copyDeck: parsed.copyDeck,
    } as any, {
      posterIntent: parsed.posterIntent,
      copyDeck: parsed.copyDeck,
    })
    return {
      result: enriched.copy,
      meta: getProviderMeta('copy', { provider: 'aliyun-bailian', model: ready.model, message: mode === 'rewrite' ? '已使用阿里百炼文案模型完成海报终稿换字优化。' : generationMode === 'fast' ? '已使用阿里百炼快速文案模型生成可直接上版的海报文案。' : '已使用阿里百炼高质量文案模型生成推荐文案。' }, generationMode),
    }
  } catch (error) {
    throw new Error(buildStrictProviderError('文案生成', error))
  }
}
async function generatePaletteInternal(input: PosterGenerateInput, mode: 'draft' | 'refine' = 'draft'): Promise<ProviderResult<PosterPalette>> {
  const generationMode = normalizeGenerationMode(input.generationMode)
  const preset = clone(paletteByIndustry[input.industry] || paletteByIndustry[DEFAULT_INDUSTRY])
  try {
    const ready = ensureBailianReady('palette', generationMode)
    const isDraftMode = mode === 'draft'
    const parsed = await requestBailianChat(
      [
        { role: 'system', content: '你是中文海报配色助手。只输出 JSON。色板需与行业情绪、所选风格一致；主色不宜过多（一至二个记忆色即可），中性色支撑文字阅读。' },
        { role: 'user', content: buildPalettePrompt(input, mode) },
      ],
      ready.model,
      {
        timeoutMs: getStageTimeoutMs('palette', generationMode, isDraftMode ? 'draft' : 'refine'),
        retryTimes: getStageRetryTimes('palette', generationMode, isDraftMode ? 'draft' : 'refine'),
        enableThinking: false,
      },
    )
    const swatches = Array.isArray(parsed.swatches) ? parsed.swatches.map(String).filter(Boolean) : preset.swatches
    return {
      result: {
        background: String(parsed.background || preset.background),
        surface: String(parsed.surface || preset.surface),
        primary: String(parsed.primary || preset.primary),
        secondary: String(parsed.secondary || preset.secondary),
        text: String(parsed.text || preset.text),
        muted: String(parsed.muted || preset.muted),
        swatches: swatches.length ? swatches : preset.swatches,
      },
      meta: getProviderMeta('palette', { provider: 'aliyun-bailian', model: ready.model, message: mode === 'refine' ? '已使用阿里百炼配色模型完成海报终稿配色优化。' : generationMode === 'fast' ? '已使用阿里百炼快速配色模型生成成片色板。' : '已使用阿里百炼高质量配色模型生成推荐配色。' }, generationMode),
    }
  } catch (error) {
    throw new Error(buildStrictProviderError('配色生成', error))
  }
}
async function generatePaletteWithBackups(input: PosterGenerateInput, mode: 'draft' | 'refine' = 'draft'): Promise<ProviderResult<PosterPalette>> {
  try {
    return await generatePaletteInternal(input, mode)
  } catch (primaryError) {
    const primaryMode = normalizeGenerationMode(input.generationMode)
    if (primaryMode === 'fast') {
      try {
        return await generatePaletteInternal({ ...input, generationMode: 'quality' }, mode)
      } catch (backupError) {
        return buildAiProtocolPaletteFallback(input, (backupError as Error)?.message || (primaryError as Error)?.message || 'unknown error')
      }
    }
    return buildAiProtocolPaletteFallback(input, (primaryError as Error)?.message || 'unknown error')
  }
}
async function bailianHeroProvider(input: PosterGenerateInput, size: SizePreset): Promise<ProviderResult<PosterImageResult>> {
  const generationMode = normalizeGenerationMode(input.generationMode)
  const ready = ensureBailianReady('image', generationMode)
  const extend = false
  const retryTimes = isHighTextRiskInput(input) ? HIGH_TEXT_RISK_SCENE_RETRY_TIMES : 0
  let lastError: unknown = null
  let prompt = ''
  let taskResult: any = null
  for (let attempt = 0; attempt <= retryTimes; attempt += 1) {
    prompt = buildImagePrompt(input, 'hero', 'draft-hero', attempt)
    try {
      taskResult = await requestBailianTextToImage(prompt, ready.model, size, extend)
      break
    } catch (error) {
      lastError = error
      if (attempt >= retryTimes) throw error
    }
  }
  if (!taskResult) throw lastError || new Error('hero image task failed')
  const msg = generationMode === 'fast'
    ? '已使用阿里百炼快速主视觉模型生成主图。'
    : '已使用阿里百炼高质量主视觉模型生成图片。'
  const savedImageUrl = await saveRemoteImageToLocal(extractTaskImageUrl(taskResult), 'ai')
  const sanitized = await sanitizeGeneratedPosterImageIfNeeded(input, savedImageUrl, size)
  return {
    result: normalizeImageResult(sanitized.imageUrl, prompt),
    meta: getProviderMeta('image', {
      provider: 'aliyun-bailian',
      model: ready.model,
      message: sanitized.cleaned ? `${msg}已自动清理图片中的字样与标签。` : msg,
    }, generationMode),
  }
}
async function bailianBackgroundSeedProvider(input: PosterGenerateInput, size: SizePreset): Promise<ProviderResult<PosterImageResult>> {
  const generationMode = normalizeGenerationMode(input.generationMode)
  const ready = ensureBailianReady('image', generationMode)
  const extend = false
  const retryTimes = isHighTextRiskInput(input) ? HIGH_TEXT_RISK_SCENE_RETRY_TIMES : 0
  let lastError: unknown = null
  let prompt = ''
  let taskResult: any = null
  for (let attempt = 0; attempt <= retryTimes; attempt += 1) {
    prompt = buildImagePrompt(input, 'background', 'draft-background', attempt)
    try {
      taskResult = await requestBailianTextToImage(prompt, ready.model, size, extend)
      break
    } catch (error) {
      lastError = error
      if (attempt >= retryTimes) throw error
    }
  }
  if (!taskResult) throw lastError || new Error('background seed task failed')
  const savedImageUrl = await saveRemoteImageToLocal(extractTaskImageUrl(taskResult), 'ai')
  const sanitized = await sanitizeGeneratedPosterImageIfNeeded(input, savedImageUrl, size)
  return {
    result: normalizeImageResult(sanitized.imageUrl, prompt),
    meta: getProviderMeta('image', { provider: 'aliyun-bailian', model: ready.model, message: '已先生成背景种子图，随后继续生成 AI 背景图。' }, generationMode),
  }
}
async function bailianBackgroundProvider(input: PosterGenerateInput, _size: SizePreset): Promise<ProviderResult<PosterImageResult>> {
  const generationMode = normalizeGenerationMode(input.generationMode)
  const retryTimes = isHighTextRiskInput(input) ? HIGH_TEXT_RISK_SCENE_RETRY_TIMES : 0
  let prompt = buildImagePrompt(input, 'background', 'refresh-background', 0)
  if (useFastBackgroundGeneration()) {
    const ready = generationMode === 'fast'
      ? ensureBailianReady('background', generationMode)
      : ensureBailianReady('image', generationMode)
    const size = sizeMap[input.sizeKey] || sizeMap.xiaohongshu
    const extend = false
    let lastError: unknown = null
    let taskResult: any = null
    for (let attempt = 0; attempt <= retryTimes; attempt += 1) {
      prompt = buildImagePrompt(input, 'background', 'refresh-background', attempt)
      try {
        taskResult = await requestBailianTextToImage(prompt, ready.model, size, extend)
        break
      } catch (error) {
        lastError = error
        if (attempt >= retryTimes) throw error
      }
    }
    if (!taskResult) throw lastError || new Error('background image task failed')
    const savedImageUrl = await saveRemoteImageToLocal(extractTaskImageUrl(taskResult), 'ai')
    const sanitized = await sanitizeGeneratedPosterImageIfNeeded(input, savedImageUrl, size)
    return {
      result: normalizeImageResult(sanitized.imageUrl, prompt),
      meta: getProviderMeta('background', {
        provider: 'aliyun-bailian',
        model: ready.model,
        message: generationMode === 'fast'
          ? (sanitized.cleaned ? '已使用阿里百炼快速背景模型生成背景图，并自动清理图片中的字样与标签。' : '已使用阿里百炼快速背景模型生成背景图。')
          : (sanitized.cleaned ? '已使用更快的直生背景策略生成高质量背景图，并自动清理图片中的字样与标签。' : '已使用更快的直生背景策略生成高质量背景图。'),
      }, generationMode),
    }
  }
  let baseImageUrl = String(input.baseImageUrl || '').trim()
  let seedMessage = ''
  if (!baseImageUrl) {
    const seed = await bailianBackgroundSeedProvider(input, sizeMap[input.sizeKey] || sizeMap.xiaohongshu)
    baseImageUrl = seed.result.imageUrl
    seedMessage = '已自动生成背景种子图。'
  }
  const backgroundReady = ensureBailianReady('background', generationMode)
  const backgroundModelVersion = getBackgroundModelVersion()
  const resolvedBaseImageUrl = await resolveRemoteModelImageUrl(baseImageUrl, backgroundReady.model, 'ai-background-source')
  const taskResult = await requestBailianBackground(prompt, backgroundReady.model, resolvedBaseImageUrl)
  const savedImageUrl = await saveRemoteImageToLocal(extractTaskImageUrl(taskResult), 'ai')
  const sanitized = await sanitizeGeneratedPosterImageIfNeeded(input, savedImageUrl, sizeMap[input.sizeKey] || sizeMap.xiaohongshu)
  return {
    result: normalizeImageResult(sanitized.imageUrl, prompt),
    meta: getProviderMeta('background', {
      provider: 'aliyun-bailian',
      model: `${backgroundReady.model}/${backgroundModelVersion}`,
      message: `${seedMessage}${sanitized.cleaned ? '已使用阿里百炼背景模型生成背景图，并自动清理图片中的字样与标签。' : '已使用阿里百炼背景模型生成背景图。'}`,
    }, generationMode),
  }
}
async function bailianImageEditProvider(input: PosterGenerateInput, size: SizePreset): Promise<ProviderResult<PosterImageResult>> {
  const generationMode = normalizeGenerationMode(input.generationMode)
  const sourceImageUrl = String(input.sourceImageUrl || '').trim()
  if (!sourceImageUrl) {
    throw new Error('换图需要提供 sourceImageUrl，当前未传入待编辑图片')
  }
  const ready = ensureBailianReady('imageEdit', generationMode)
  const resolvedSourceImageUrl = await resolveRemoteModelImageUrl(sourceImageUrl, ready.model, 'ai-edit-source')
  const retryTimes = isHighTextRiskInput(input) ? HIGH_TEXT_RISK_SCENE_RETRY_TIMES : 0
  let lastError: unknown = null
  let prompt = ''
  let taskResult: any = null
  for (let attempt = 0; attempt <= retryTimes; attempt += 1) {
    prompt = buildImagePrompt(input, 'hero', 'refresh-hero', attempt)
    try {
      taskResult = await requestBailianImageEdit(prompt, ready.model, resolvedSourceImageUrl, size)
      break
    } catch (error) {
      lastError = error
      if (attempt >= retryTimes) throw error
    }
  }
  if (!taskResult) throw lastError || new Error('image edit task failed')
  const savedImageUrl = await saveRemoteImageToLocal(extractTaskImageUrl(taskResult), 'ai')
  const sanitized = await sanitizeGeneratedPosterImageIfNeeded(input, savedImageUrl, size)
  return {
    result: normalizeImageResult(sanitized.imageUrl, prompt),
    meta: getProviderMeta('imageEdit', {
      provider: 'aliyun-bailian',
      model: ready.model,
      message: generationMode === 'fast'
        ? (sanitized.cleaned ? '已使用阿里百炼快速换图模型生成新主图，并自动清理图片中的字样与标签。' : '已使用阿里百炼快速换图模型生成新主图。')
        : (sanitized.cleaned ? '已使用阿里百炼高质量换图模型生成新主图，并自动清理图片中的字样与标签。' : '已使用阿里百炼高质量换图模型生成新主图。'),
    }, generationMode),
  }
}
async function generateHeroImageInternal(input: PosterGenerateInput, _palette: PosterPalette, size: SizePreset) {
  return withRequiredImageSuccess('主图生成', () => bailianHeroProvider(input, size))
}
async function generateBackgroundInternal(input: PosterGenerateInput, _palette: PosterPalette, size: SizePreset) {
  return withRequiredImageSuccess('背景生成', () => bailianBackgroundProvider(input, size))
}
async function replaceImageInternal(input: PosterGenerateInput, _palette: PosterPalette, size: SizePreset) {
  return withRequiredImageSuccess('换图', () => bailianImageEditProvider(input, size))
}
type CutoutMode = 'local' | 'remote'
function normalizeCutoutMode(raw: unknown): CutoutMode { return String(raw || '').trim().toLowerCase() === 'local' ? 'local' : 'remote' }
function runCutoutWorker(args: string[]) { return new Promise<any>((resolve, reject) => { const scriptPath = path.join(process.cwd(), 'scripts', 'cutout_worker.py'); const child = spawn(getEnv('AI_CUTOUT_PYTHON', 'python'), [scriptPath, ...args], { cwd: process.cwd(), windowsHide: true }); let stdout = ''; let stderr = ''; child.stdout.on('data', (chunk) => { stdout += String(chunk) }); child.stderr.on('data', (chunk) => { stderr += String(chunk) }); child.on('error', reject); child.on('close', (code) => { if (code !== 0) return reject(new Error(stderr || stdout || `cutout worker exited with code ${code}`)); try { resolve(stdout ? JSON.parse(stdout) : {}) } catch { reject(new Error(`invalid cutout worker response: ${stdout || stderr}`)) } }) }) }
async function inspectLocalImage(imagePath: string) { return runCutoutWorker(['inspect', imagePath]) }
async function mergeMaskToTransparent(rawPath: string, maskPath: string, outputPath: string) { return runCutoutWorker(['merge-mask', rawPath, maskPath, outputPath]) }
async function runRembgCutout(inputPath: string, outputPath: string) { return runCutoutWorker(['rembg', inputPath, outputPath, getRembgModelName()]) }
async function optimizeCutoutUpload(inputPath: string, outputPath: string) { return runCutoutWorker(['optimize-upload', inputPath, outputPath, String(getCutoutUploadMaxSide()), String(getCutoutUploadJpegQuality())]) }
function isPublicHttpUrl(url: string) {
  try {
    const parsed = new URL(String(url || '').trim())
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}
function isLikelyPrivateHostname(hostname: string) {
  const host = String(hostname || '').trim().toLowerCase()
  if (!host) return true
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true
  if (host.endsWith('.local') || host.endsWith('.lan')) return true
  if (/^10\./.test(host)) return true
  if (/^192\.168\./.test(host)) return true
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true
  return false
}
function canUseDirectCutoutSourceUrl(url: string) {
  if (!isPublicHttpUrl(url)) return false
  try {
    const parsed = new URL(url)
    return !isLikelyPrivateHostname(parsed.hostname)
  } catch {
    return false
  }
}
function buildCutoutSourceUrl(rawUrl: string, fileName: string) {
  const directBase = String(getEnv('AI_CUTOUT_SOURCE_BASE_URL', '')).trim().replace(/\/$/, '')
  if (directBase) return `${directBase}/${fileName}`
  return rawUrl
}
async function prepareRemoteCutoutUploadAsset(localPath: string, fileName: string) {
  const stat = fs.statSync(localPath)
  const imageInfo = await inspectLocalImage(localPath)
  const size = Array.isArray(imageInfo?.size) ? imageInfo.size : [0, 0]
  const width = Number(size[0] || 0)
  const height = Number(size[1] || 0)
  const maxSide = Math.max(width, height)
  const sizeLimit = getCutoutUploadSizeLimitMb() * 1024 * 1024
  const needOptimize = stat.size > sizeLimit || maxSide > getCutoutUploadMaxSide()
  if (!needOptimize) {
    return {
      uploadPath: localPath,
      uploadFileName: fileName,
      optimized: false,
      uploadStats: { bytes: stat.size, width, height },
    }
  }

  const ext = String(path.extname(fileName) || '').toLowerCase()
  const optimizedExt = ext === '.png' ? '.png' : '.jpg'
  const optimizedFileName = `${path.basename(fileName, path.extname(fileName))}_upload${optimizedExt}`
  const optimizedPath = path.join(filePath, 'cutout', optimizedFileName)
  const optimized = await optimizeCutoutUpload(localPath, optimizedPath)
  const optimizedStat = fs.statSync(optimizedPath)
  const optimizedSize = Array.isArray(optimized?.size) ? optimized.size : [width, height]
  return {
    uploadPath: optimizedPath,
    uploadFileName: optimizedFileName,
    optimized: true,
    uploadStats: {
      bytes: optimizedStat.size,
      width: Number(optimizedSize[0] || width),
      height: Number(optimizedSize[1] || height),
    },
  }
}
async function getViapiImagesegClient() {
  if (!viapiImagesegClientPromise) {
    viapiImagesegClientPromise = (async () => {
      const config = ensureViapiReady()
      const OpenApi = require('@alicloud/openapi-client')
      const Imageseg = require('@alicloud/imageseg20191230')
      return new Imageseg.default(new OpenApi.default({
        accessKeyId: config.accessKeyId,
        accessKeySecret: config.accessKeySecret,
        endpoint: getViapiImagesegEndpoint(),
      }))
    })()
  }
  return viapiImagesegClientPromise
}
async function getViapiAsyncClient() {
  if (!viapiAsyncClientPromise) {
    viapiAsyncClientPromise = (async () => {
      const config = ensureViapiReady()
      const OpenApi = require('@alicloud/openapi-client')
      const Viapi = require('@alicloud/viapi20230117')
      return new Viapi.default(new OpenApi.default({
        accessKeyId: config.accessKeyId,
        accessKeySecret: config.accessKeySecret,
        endpoint: getViapiAsyncEndpoint(),
      }))
    })()
  }
  return viapiAsyncClientPromise
}
async function pollViapiJobResult(jobId: string) {
  const client = await getViapiAsyncClient()
  const TeaUtil = require('@alicloud/tea-util')
  const runtime = new TeaUtil.RuntimeOptions({})
  const maxPolls = getCutoutTaskMaxPolls()
  const pollIntervalMs = Math.max(800, Math.min(getCutoutTaskPollIntervalMs(), 2500))
  for (let i = 0; i < maxPolls; i += 1) {
    const body = (await client.getAsyncJobResultWithOptions(new client.constructor.models.GetAsyncJobResultRequest({ jobId }), runtime))?.body || {}
    const data = body?.data || {}
    const status = String(data?.status || body?.status || '').toUpperCase()
    if (status === 'FINISHED' || status === 'SUCCEEDED' || status === 'SUCCESS') return body
    if (status === 'FAILED' || status === 'CANCELED' || status === 'CANCELLED') throw new Error(String(data?.message || body?.message || 'viapi async task failed'))
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
  }
  throw new Error('viapi cutout task timeout')
}
function extractViapiImageUrl(payload: any) {
  const body = payload?.body || payload || {}
  const data = body?.data || {}
  const candidates = [
    data?.imageURL,
    data?.imageUrl,
    data?.resultUrl,
    data?.url,
    data?.elements?.[0]?.imageURL,
    data?.elements?.[0]?.imageUrl,
  ].filter(Boolean)
  return String(candidates[0] || '').trim()
}
function extractViapiJobId(payload: any) {
  const body = payload?.body || payload || {}
  const data = body?.data || {}
  return String(data?.jobId || data?.jobID || body?.requestId || body?.requestID || '').trim()
}
function getViapiCutoutPlan() {
  const mode = getViapiCutoutMode()
  if (mode === 'human') return ['human']
  if (mode === 'common') return ['common']
  if (mode === 'common-first') return ['common', 'human']
  return ['human', 'common']
}
async function requestViapiSegmentHDBody(localPath: string) {
  const client = await getViapiImagesegClient()
  const TeaUtil = require('@alicloud/tea-util')
  const runtime = new TeaUtil.RuntimeOptions({})
  const response = await client.segmentHDBodyAdvance(new client.constructor.models.SegmentHDBodyAdvanceRequest({
    imageURLObject: fs.createReadStream(localPath),
  }), runtime)
  const imageUrl = extractViapiImageUrl(response)
  if (imageUrl) return { imageUrl, model: 'SegmentHDBody' }
  const jobId = extractViapiJobId(response)
  if (!jobId) throw new Error('SegmentHDBody missing image url and job id')
  const result = await pollViapiJobResult(jobId)
  const asyncImageUrl = extractViapiImageUrl(result)
  if (!asyncImageUrl) throw new Error('SegmentHDBody async result missing image url')
  return { imageUrl: asyncImageUrl, model: 'SegmentHDBody' }
}
async function requestViapiSegmentHDCommonImage(localPath: string) {
  const client = await getViapiImagesegClient()
  const TeaUtil = require('@alicloud/tea-util')
  const runtime = new TeaUtil.RuntimeOptions({})
  const response = await client.segmentHDCommonImageAdvance(new client.constructor.models.SegmentHDCommonImageAdvanceRequest({
    imageURLObject: fs.createReadStream(localPath),
  }), runtime)
  const imageUrl = extractViapiImageUrl(response)
  if (imageUrl) return { imageUrl, model: 'SegmentHDCommonImage' }
  const jobId = extractViapiJobId(response)
  if (!jobId) throw new Error('SegmentHDCommonImage missing image url and job id')
  const result = await pollViapiJobResult(jobId)
  const asyncImageUrl = extractViapiImageUrl(result)
  if (!asyncImageUrl) throw new Error('SegmentHDCommonImage async result missing image url')
  return { imageUrl: asyncImageUrl, model: 'SegmentHDCommonImage' }
}
async function viapiCutoutProvider(rawUrl: string, localPath: string, fileName: string) {
  const startedAt = Date.now()
  let lastError: unknown = null
  for (const step of getViapiCutoutPlan()) {
    try {
      const viapiResult = step === 'human'
        ? await requestViapiSegmentHDBody(localPath)
        : await requestViapiSegmentHDCommonImage(localPath)
      const remoteAsset = await saveRemoteImageToLocalAsset(viapiResult.imageUrl, 'cutout')
      const imageInfo = await inspectLocalImage(remoteAsset.assetPath)
      let resultUrl = remoteAsset.assetUrl
      if (String(imageInfo.mode || '').toUpperCase() === 'L') {
        const mergedFileName = `${path.basename(fileName, path.extname(fileName))}_${viapiResult.model}_cutout.png`
        const mergedPath = path.join(filePath, 'cutout', mergedFileName)
        await mergeMaskToTransparent(localPath, remoteAsset.assetPath, mergedPath)
        resultUrl = `${getClientStaticBaseUrl()}cutout/${mergedFileName}`
      }
      const elapsedSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000))
      return {
        result: { rawUrl, resultUrl },
        meta: getProviderMeta('cutout', {
          provider: 'aliyun-viapi-cutout',
          model: viapiResult.model,
          message: `已使用阿里云高清分割能力完成远程抠图，直接读取本地文件流，无需临时公网中转，耗时约 ${elapsedSeconds} 秒。`,
        }),
      } as ProviderResult<{ rawUrl: string; resultUrl: string }>
    } catch (error) {
      lastError = error
    }
  }
  throw lastError || new Error('viapi cutout failed')
}
async function getDashScopeUploadPolicy(model: string) {
  const cacheKey = String(model || '').trim()
  const cached = dashScopeUploadPolicyCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now() + 5000) {
    return cached.data
  }
  const response: any = await axiosClient.get(`${getApiBaseUrl()}/uploads?action=getPolicy&model=${encodeURIComponent(model)}`, {
    headers: {
      Authorization: `Bearer ${getBailianApiKey()}`,
      'Content-Type': 'application/json',
    },
    timeout: 30000,
  })
  const data = response?.data || response
  const policy = data?.data || {}
  if (!policy?.upload_host || !policy?.upload_dir || !policy?.policy || !policy?.signature || !policy?.oss_access_key_id) {
    throw new Error('dashscope upload policy missing required fields')
  }
  const expireInSeconds = Number(policy.expire_in_seconds || 300)
  const normalized: DashScopeUploadPolicy = {
    policy: String(policy.policy),
    signature: String(policy.signature),
    upload_dir: String(policy.upload_dir),
    upload_host: String(policy.upload_host),
    expire_in_seconds: expireInSeconds,
    max_file_size_mb: Number(policy.max_file_size_mb || 0),
    capacity_limit_mb: Number(policy.capacity_limit_mb || 0),
    oss_access_key_id: String(policy.oss_access_key_id),
    x_oss_object_acl: String(policy.x_oss_object_acl || 'private'),
    x_oss_forbid_overwrite: String(policy.x_oss_forbid_overwrite || 'true'),
  }
  dashScopeUploadPolicyCache.set(cacheKey, {
    data: normalized,
    expiresAt: Date.now() + Math.max(30000, (expireInSeconds - 10) * 1000),
  })
  return normalized
}
async function uploadLocalFileToDashScopeOss(filePathname: string, fileName: string, model: string) {
  const policy = await getDashScopeUploadPolicy(model)
  const maxFileSizeMb = Number(policy.max_file_size_mb || 0)
  const fileBuffer = fs.readFileSync(filePathname)
  if (maxFileSizeMb > 0 && fileBuffer.byteLength > maxFileSizeMb * 1024 * 1024) {
    throw new Error(`dashscope temporary upload file too large: ${fileBuffer.byteLength} bytes > ${maxFileSizeMb} MB`)
  }
  const key = `${policy.upload_dir}/${fileName}`
  const FormDataCtor = (global as any).FormData
  const BlobCtor = (global as any).Blob
  const form: any = new FormDataCtor()
  form.append('OSSAccessKeyId', policy.oss_access_key_id)
  form.append('Signature', policy.signature)
  form.append('policy', policy.policy)
  form.append('x-oss-object-acl', policy.x_oss_object_acl)
  form.append('x-oss-forbid-overwrite', policy.x_oss_forbid_overwrite)
  form.append('key', key)
  form.append('success_action_status', '200')
  form.append('file', new BlobCtor([fileBuffer]), fileName)
  await axiosClient.post(policy.upload_host, form, {
    timeout: 120000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    validateStatus: (status) => status >= 200 && status < 300,
  })
  return `oss://${key}`
}
async function uploadLocalFileToTmpfiles(filePathname: string, fileName: string) {
  const FormDataCtor = (global as any).FormData
  const BlobCtor = (global as any).Blob
  const form: any = new FormDataCtor()
  form.append('file', new BlobCtor([fs.readFileSync(filePathname)]), fileName)
  const response = await axiosClient.post('https://tmpfiles.org/api/v1/upload', form, {
    timeout: 120000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  })
  const tempUrl = response?.data?.data?.url || ''
  if (!tempUrl) throw new Error('temporary public upload failed')
  return String(tempUrl).replace('http://', 'https://').replace('tmpfiles.org/', 'tmpfiles.org/dl/')
}
async function resolveCutoutSourceCandidates(rawUrl: string, localPath: string, fileName: string, model: string) {
  const candidates: Array<{ imageUrl: string; source: CutoutSourceKind }> = []
  const preferredUrl = buildCutoutSourceUrl(rawUrl, fileName)
  if (canUseDirectCutoutSourceUrl(preferredUrl)) {
    candidates.push({ imageUrl: preferredUrl, source: 'direct-static' })
  }
  try {
    candidates.push({ imageUrl: await uploadLocalFileToDashScopeOss(localPath, fileName, model), source: 'dashscope-oss' })
  } catch (error) {
    console.warn('[cutout] dashscope temporary upload failed, retrying with tmpfiles:', error)
  }
  candidates.push({ imageUrl: await uploadLocalFileToTmpfiles(localPath, fileName), source: 'tmpfiles' })
  return candidates
}
async function requestBailianCutout(model: string, imageUrl: string) {
  let lastError: unknown = new Error('cutout task timeout')
  const maxAttempts = getCutoutTaskRetryTimes() + 1
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response: any = await axiosClient({
        method: 'post',
        url: `${getApiBaseUrl()}/services/aigc/image2image/image-synthesis`,
        data: { model, input: { image_url: imageUrl }, parameters: { return_form: 'transparent' } },
        headers: { Authorization: `Bearer ${getBailianApiKey()}`, 'Content-Type': 'application/json', 'X-DashScope-Async': 'enable', 'X-DashScope-OssResourceResolve': 'enable' },
        timeout: 120000,
      })
      const taskId = String(response.data?.output?.task_id || '').trim()
      if (!taskId) throw new Error('missing cutout task id')
      return await pollBailianTask(taskId, {
        maxPolls: getCutoutTaskMaxPolls(),
        pollIntervalMs: getCutoutTaskPollIntervalMs(),
        timeoutLabel: 'cutout task timeout',
      })
    } catch (error) {
      lastError = error
      const message = String((error as Error)?.message || error || '')
      const shouldRetry = /cutout task timeout/i.test(message) || /task timeout/i.test(message)
      if (!shouldRetry || attempt >= maxAttempts - 1) {
        throw error
      }
      await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)))
    }
  }
  throw lastError
}
function extractCutoutUrl(response: any) { const output = response?.output || {}; const results = Array.isArray(output.results) ? output.results[0] : output.results || output.result || {}; return results?.transparent_image_url || results?.output_image_url || results?.output_image_url_list?.[0] || results?.image_url || results?.url || output?.transparent_image_url || output?.output_image_url || output?.image_url || output?.url || '' }
async function bailianCutoutProvider(rawUrl: string, localPath: string, fileName: string) {
  const ready = ensureBailianReady('cutout')
  const startedAt = Date.now()
  const prepareStartedAt = Date.now()
  const uploadAsset = await prepareRemoteCutoutUploadAsset(localPath, fileName)
  const prepareMs = Date.now() - prepareStartedAt
  const uploadRawUrl = uploadAsset.optimized ? `${getClientStaticBaseUrl()}cutout/${uploadAsset.uploadFileName}` : rawUrl
  const sourceStartedAt = Date.now()
  const sourceCandidates = await resolveCutoutSourceCandidates(uploadRawUrl, uploadAsset.uploadPath, uploadAsset.uploadFileName, ready.model)
  const sourceMs = Date.now() - sourceStartedAt
  let activeSource = sourceCandidates[0]
  let taskStartedAt = Date.now()
  let taskResult: any = null
  let lastError: unknown = null
  for (let i = 0; i < sourceCandidates.length; i += 1) {
    activeSource = sourceCandidates[i]
    taskStartedAt = Date.now()
    try {
      taskResult = await requestBailianCutout(ready.model, activeSource.imageUrl)
      lastError = null
      break
    } catch (error) {
      lastError = error
      if (!isCutoutMediaInspectionError(error) || i >= sourceCandidates.length - 1) {
        throw error
      }
      console.warn(`[cutout] source ${activeSource.source} failed media inspection, switching source`, error)
    }
  }
  if (!taskResult) {
    throw lastError || new Error('cutout task failed')
  }
  const taskMs = Date.now() - taskStartedAt
  const remoteUrl = extractCutoutUrl(taskResult)
  if (!remoteUrl) throw new Error('cutout result missing image url')
  const downloadStartedAt = Date.now()
  const remoteAsset = await saveRemoteImageToLocalAsset(remoteUrl, 'cutout')
  const downloadMs = Date.now() - downloadStartedAt
  const postStartedAt = Date.now()
  const imageInfo = await inspectLocalImage(remoteAsset.assetPath)
  let resultUrl = remoteAsset.assetUrl
  if (String(imageInfo.mode || '').toUpperCase() === 'L') {
    const mergedFileName = `${path.basename(fileName, path.extname(fileName))}_aliyun_cutout.png`
    const mergedPath = path.join(filePath, 'cutout', mergedFileName)
    await mergeMaskToTransparent(localPath, remoteAsset.assetPath, mergedPath)
    resultUrl = `${getClientStaticBaseUrl()}cutout/${mergedFileName}`
  }
  const postMs = Date.now() - postStartedAt
  const elapsedSeconds = formatElapsedSeconds(Date.now() - startedAt)
  const optimizeNote = uploadAsset.optimized
    ? `已将上传图自动优化为 ${uploadAsset.uploadStats.width}x${uploadAsset.uploadStats.height}，减少远程处理耗时。`
    : ''
  const sourceNoteMap: Record<CutoutSourceKind, string> = {
    'direct-static': '已直接使用服务公网静态图发起远程抠图，避免文件再次上传。',
    'dashscope-oss': '已改为使用阿里云百炼临时 OSS 上传源图，省去第三方文件站中转，稳定性更高。',
    tmpfiles: '当前环境无法直接暴露公网源图，已切换为临时公网文件中转。',
  }
  const timingNote = `耗时约 ${elapsedSeconds} 秒（预处理 ${formatElapsedSeconds(prepareMs)} 秒 / 源图准备 ${formatElapsedSeconds(sourceMs)} 秒 / 远程任务 ${formatElapsedSeconds(taskMs)} 秒 / 结果下载 ${formatElapsedSeconds(downloadMs)} 秒 / 本地合成 ${formatElapsedSeconds(postMs)} 秒）。`
  const speedNote = `${optimizeNote}${sourceNoteMap[activeSource.source as CutoutSourceKind]}${timingNote}`
  return {
    result: { rawUrl, resultUrl },
    meta: getProviderMeta('cutout', { provider: 'aliyun-cutout', model: ready.model, message: speedNote }),
  } as ProviderResult<{ rawUrl: string; resultUrl: string }>
}
async function remoteCutoutProvider(rawUrl: string, localPath: string, fileName: string) {
  if (hasViapiCutoutReady()) {
    try {
      return await viapiCutoutProvider(rawUrl, localPath, fileName)
    } catch (error) {
      console.warn('[cutout] viapi failed, fallback to bailian:', error)
    }
  }
  return bailianCutoutProvider(rawUrl, localPath, fileName)
}
async function rembgCutoutProvider(rawUrl: string, localPath: string, fileName: string) { const outputFileName = `${path.basename(fileName, path.extname(fileName))}_local_cutout.png`; const outputPath = path.join(filePath, 'cutout', outputFileName); await runRembgCutout(localPath, outputPath); return { result: { rawUrl, resultUrl: `${getClientStaticBaseUrl()}cutout/${outputFileName}` }, meta: getProviderMeta('cutout', { provider: 'rembg-local', model: getRembgModelName(), message: '已使用本地高质量抠图模型生成透明底图片。' }) } as ProviderResult<{ rawUrl: string; resultUrl: string }> }
function sanitizeCutoutFailure(error: unknown) {
  const message = String((error as Error)?.message || error || 'unknown error')
    .replace(/\s+/g, ' ')
    .trim()
  if (isCutoutMediaInspectionError(message)) {
    return '远程抠图读取源图失败，系统已自动切换图片源；若当前仍未完成，请稍后重试'
  }
  if (/cannot identify image file/i.test(message) || /UnidentifiedImageError/i.test(message)) {
    return '当前图片格式暂不支持抠图，请先替换为 PNG、JPG 或 WebP 位图后再试'
  }
  if (/status code 400/i.test(message)) {
    return '远程抠图当前未通过这张图片的处理校验，建议优先切换“本地抠图”重试；如仍失败，再更换图片'
  }
  if (/cutout task timeout/i.test(message) || /task timeout/i.test(message)) {
    return '远程抠图处理时间过长，系统已自动重试，当前仍未完成，请稍后重试'
  }
  return message.split('Traceback')[0].trim().slice(0, 180) || '抠图失败'
}
function getPresetPreferredFamilies(input: PosterGenerateInput) {
  const presetKey = String(input.presetKey || '').trim()
  const sizeKey = String(input.sizeKey || '').trim()
  const recruitmentMode = inferRecruitmentCreativeMode(input)
  const recruitmentDenseSignal =
    String(input.content || '').length > 72 ||
    ((String(input.content || '').match(/[|｜\n；;、]/g) || []).length >= 4) ||
    /薪资|待遇|福利|地点|地址|时间|流程|投递|面试|岗位|职责|要求|双休|五险一金/.test(`${input.theme || ''} ${input.content || ''} ${input.style || ''}`)
  const mapping: Record<string, string[]> = {
    campaign: ['festive-frame', 'magazine-cover', 'split-editorial'],
    recruitment: recruitmentDenseSignal
      ? ['list-recruitment', 'split-editorial', 'hero-left', 'magazine-cover']
      : recruitmentMode === 'black-gold'
        ? ['magazine-cover', 'hero-left', 'split-editorial', 'list-recruitment']
        : recruitmentMode === 'bold-red' || recruitmentMode === 'retro'
          ? ['hero-left', 'magazine-cover', 'split-editorial', 'list-recruitment']
          : ['hero-left', 'split-editorial', 'magazine-cover', 'list-recruitment'],
    commerce: sizeKey === 'ecommerce'
      ? ['premium-offer', 'grid-product', 'hero-center']
      : ['premium-offer', 'hero-center', 'grid-product'],
    course: ['clean-course', 'split-editorial', 'grid-product'],
    fitness: ['magazine-cover', 'hero-center', 'premium-offer'],
    food: ['hero-center', 'split-editorial', 'premium-offer'],
    festival: ['festive-frame', 'magazine-cover', 'hero-center'],
    xiaohongshu: ['xiaohongshu-note', 'magazine-cover', 'hero-center'],
  }
  return mapping[presetKey] || []
}
function choosePreferredLayoutFamily(input: PosterGenerateInput, candidates: any[]) {
  const pool = (candidates || []).map((c: any) => String(c?.layoutFamily || '').trim()).filter(Boolean)
  const allow = ['hero-center', 'hero-left', 'split-editorial', 'grid-product', 'magazine-cover', 'festive-frame', 'list-recruitment', 'xiaohongshu-note', 'clean-course', 'premium-offer']
  const purpose = String(input.purpose || '')
  const style = String(input.style || '')
  const sizeKey = String(input.sizeKey || '')
  const themeText = `${input.theme || ''} ${input.content || ''} ${input.industry || ''} ${purpose} ${style}`
  const contentText = String(input.content || '')
  const structuredInfoCount = (contentText.match(/[|｜\n；;、]/g) || []).length
  const denseSignal = contentText.length > 74 || structuredInfoCount >= 4 || /价格|福利|地址|时间|对象|人群|岗位|课时|限量|赠送|流程/.test(themeText)
  const mediumInfoSignal = contentText.length > 28 || structuredInfoCount >= 2 || /优惠|亮点|卖点|到店|报名|招募/.test(themeText)
  const promoSignal = /促销|抢购|折扣|优惠|立减|满减|低至|到手价|券后|￥|\d+\s*元|爆款|套餐|限时/.test(themeText + purpose)
  const editorialSignal = /杂志|大片|黑金|轻奢|高级|法式|胶片|封面|lookbook|campaign/i.test(style + themeText)
  const explicitNoteSignal = /小红书|种草|笔记|教程|攻略|合集|开箱|测评|打卡|探店|vlog|分享/.test(`${themeText} ${purpose} ${style}`)
  const noteSceneFallback = sizeKey === 'xiaohongshu' && !promoSignal && !/价格|福利|岗位|课程|活动|节日|餐饮|美食|咖啡|茶饮|新品|促销|报名|招聘/.test(themeText + purpose)
  const foodSignal = /餐饮|美食|咖啡|茶饮|套餐|到店|外卖|招牌|新品菜/.test(themeText)
  const recruitSignal = /招聘|招募|岗位|投递|入职|面试/.test(themeText + purpose)
  const courseSignal = /课程|教育|培训|报名|试听|公开课|训练营|学习/.test(themeText + purpose)
  const festivalSignal = /节日|庆典|假日|端午|中秋|新年|春节|七夕/.test(themeText + purpose)
  const eventSignal = /活动|开业|快闪|展会|周年庆|邀请函|市集|预告|露营|音乐节|生活节/.test(themeText + purpose)
  const illustrativeEventSignal = eventSignal && /手绘|涂鸦|插画|漫画|贴纸|年轻|活力/.test(`${style} ${themeText}`)
  const prefer = (...names: string[]) => names.find((name) => allow.includes(name)) || names[0]
  const presetPreferred = getPresetPreferredFamilies(input)
  const presetFallback = presetPreferred.find((name) => allow.includes(name)) || pool.find((name) => allow.includes(name)) || ''
  if (recruitSignal) {
    const recruitMode = inferRecruitmentCreativeMode(input)
    if (denseSignal)
      return prefer('list-recruitment', 'split-editorial', 'hero-left')
    if (recruitMode === 'black-gold')
      return prefer('magazine-cover', 'hero-left', 'split-editorial')
    if (recruitMode === 'bold-red' || recruitMode === 'retro')
      return prefer('hero-left', 'magazine-cover', 'split-editorial')
    return prefer('hero-left', 'split-editorial', 'magazine-cover')
  }
  if (courseSignal) return prefer(denseSignal ? 'split-editorial' : mediumInfoSignal ? 'clean-course' : 'hero-left', 'clean-course', presetFallback)
  if (festivalSignal) {
    if (denseSignal) return prefer('festive-frame', 'magazine-cover', 'hero-center')
    return prefer(editorialSignal ? 'magazine-cover' : 'festive-frame', 'hero-center', 'split-editorial')
  }
  if (eventSignal) {
    if (denseSignal) return prefer('split-editorial', 'festive-frame', 'hero-center')
    if (illustrativeEventSignal) return prefer('hero-center', 'festive-frame', 'magazine-cover')
    return prefer(editorialSignal ? 'magazine-cover' : 'festive-frame', 'hero-center', 'split-editorial')
  }
  if (foodSignal && promoSignal) return prefer('premium-offer', 'hero-center', 'grid-product')
  if (foodSignal) return prefer('hero-center', 'magazine-cover', 'premium-offer')
  if (promoSignal) return prefer(denseSignal ? 'premium-offer' : 'hero-center', 'grid-product', 'hero-left')
  if (/电商|零售|商品|萌宠|宠物|美妆|母婴/.test(themeText)) return prefer(denseSignal ? 'premium-offer' : 'hero-center', 'hero-left', 'grid-product')
  if (explicitNoteSignal) return prefer(editorialSignal ? 'magazine-cover' : 'xiaohongshu-note', 'hero-center', 'hero-left')
  if (noteSceneFallback) return prefer(editorialSignal ? 'magazine-cover' : 'xiaohongshu-note', 'hero-center', 'hero-left')
  if (editorialSignal) return prefer('magazine-cover', 'hero-center', 'split-editorial')
  if (/健身|运动|训练/.test(themeText)) return prefer(editorialSignal ? 'magazine-cover' : 'hero-center', 'hero-left', 'premium-offer')
  if (/专业商务|极简科技|政务公益|金融|科技互联网/.test(`${style} ${input.industry}`)) return prefer(denseSignal ? 'split-editorial' : 'hero-left', 'magazine-cover', presetFallback)
  if (denseSignal) return prefer('split-editorial', 'clean-course', 'hero-left', presetFallback)
  if (mediumInfoSignal) return prefer('hero-left', 'hero-center', 'premium-offer', presetFallback)
  if (/潮流|年轻|海报感|赛博|街头/.test(style)) return prefer('magazine-cover', 'hero-center', 'grid-product', presetFallback)
  if (presetFallback) return presetFallback
  return pool.find((name) => allow.includes(name)) || 'hero-left'
}
function clampUnit(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value))
}
function layoutLayer(role: PosterAbsoluteLayoutLayer['role'], left: number, top: number, width: number, height: number, extra: Partial<PosterAbsoluteLayoutLayer> = {}): PosterAbsoluteLayoutLayer {
  return {
    role,
    left: clampUnit(left),
    top: clampUnit(top),
    width: clampUnit(width, 0.04, 1),
    height: clampUnit(height, 0.04, 1),
    ...extra,
  }
}
function inferBackgroundTone(input: PosterGenerateInput, layoutFamily: string): 'light' | 'dark' | 'mixed' {
  const joined = `${input.industry || ''} ${input.style || ''} ${input.theme || ''} ${layoutFamily}`
  if (/手绘|涂鸦|插画|清新|庆典|周年庆|年会|festive-frame|hero-center/i.test(joined) && !/黑金|暗黑|夜景|赛博/i.test(joined)) return 'mixed'
  if (/黑金|暗黑|赛博|科技|夜景|运动|健身|商务|premium|magazine/i.test(joined)) return 'dark'
  if (/节日|活动|杂志|大片|复古|胶片|店铺|咖啡|餐饮/i.test(joined)) return 'mixed'
  return 'light'
}
function inferTextStrategy(input: PosterGenerateInput, density: 'light' | 'balanced' | 'dense', layoutFamily: string, backgroundTone: 'light' | 'dark' | 'mixed'): 'clean' | 'outline' | 'panel' {
  const joined = `${input.industry || ''} ${input.style || ''} ${input.purpose || ''} ${layoutFamily}`
  const celebratoryIllustrative = /活动|节日|年会|周年庆|庆典|发布会|手绘|涂鸦|插画/i.test(joined)
  if (celebratoryIllustrative && density !== 'dense' && backgroundTone !== 'dark') {
    return /magazine-cover|hero-center|festive-frame/i.test(joined) ? 'outline' : 'clean'
  }
  if (density === 'dense' || backgroundTone === 'dark' || /招聘|课程|报名|价格|促销|电商/i.test(joined)) return 'panel'
  if (/杂志|大片|封面|活动|节日|hero-center|magazine-cover|festive-frame/i.test(joined)) return 'outline'
  return 'clean'
}
function buildAbsoluteLayout(size: SizePreset, plan: {
  layoutFamily: string
  density: 'light' | 'balanced' | 'dense'
  heroStrategy: 'product' | 'person' | 'scene' | 'editorial'
  qrStrategy: 'none' | 'corner' | 'cta'
}): PosterAbsoluteLayout {
  const isWide = size.width > size.height
  const isSquare = Math.abs(size.width - size.height) <= size.width * 0.08
  const isPortrait = !isWide && !isSquare
  const family = String(plan.layoutFamily || 'hero-left').trim()
  const titleAlign: 'left' | 'center' | 'right' =
    family === 'hero-center' || family === 'magazine-cover' || family === 'festive-frame' || isSquare
      ? 'center'
      : 'left'
  const layers: PosterAbsoluteLayoutLayer[] = []
  if (family === 'split-editorial' || isWide) {
    layers.push(
      layoutLayer('badge', 0.07, 0.05, 0.13, 0.045, { textAlign: 'center' }),
      layoutLayer('title', 0.07, 0.1, 0.34, 0.16, { fontSize: 0.072, textAlign: 'left' }),
      layoutLayer('slogan', 0.07, 0.28, 0.34, 0.08, { fontSize: 0.03, textAlign: 'left' }),
      layoutLayer('body', 0.07, 0.39, 0.34, 0.18, { fontSize: 0.026, textAlign: 'left' }),
      layoutLayer('meta1', 0.07, 0.59, 0.22, 0.045, { fontSize: 0.02, textAlign: 'left' }),
      layoutLayer('meta2', 0.07, 0.645, 0.22, 0.045, { fontSize: 0.02, textAlign: 'left' }),
      layoutLayer('cta', 0.07, 0.74, 0.21, 0.09, { fontSize: 0.028, textAlign: 'center' }),
      layoutLayer('hero', 0.5, 0.06, 0.41, 0.84),
      layoutLayer('logo', 0.07, 0.88, 0.12, 0.05, { textAlign: 'left' }),
    )
  } else if (family === 'premium-offer') {
    layers.push(
      layoutLayer('badge', 0.37, 0.06, 0.26, 0.045, { textAlign: 'center' }),
      layoutLayer('hero', isPortrait ? 0 : 0.16, isPortrait ? 0 : 0.12, isPortrait ? 1 : 0.68, isPortrait ? 1 : 0.32),
      layoutLayer('title', 0.08, 0.5, 0.84, 0.12, { fontSize: 0.068, textAlign: 'center' }),
      layoutLayer('slogan', 0.12, 0.63, 0.76, 0.08, { fontSize: 0.03, textAlign: 'center' }),
      layoutLayer('chip1', 0.14, 0.72, 0.16, 0.05, { textAlign: 'center' }),
      layoutLayer('chip2', 0.32, 0.72, 0.16, 0.05, { textAlign: 'center' }),
      layoutLayer('chip3', 0.5, 0.72, 0.16, 0.05, { textAlign: 'center' }),
      layoutLayer('chip4', 0.68, 0.72, 0.16, 0.05, { textAlign: 'center' }),
      layoutLayer('body', 0.1, 0.73, 0.8, 0.09, { fontSize: 0.026, textAlign: 'center' }),
      layoutLayer('priceTag', 0.1, 0.79, 0.16, 0.05, { textAlign: 'center' }),
      layoutLayer('priceNum', 0.1, 0.835, 0.26, 0.075, { textAlign: 'left' }),
      layoutLayer('cta', 0.31, 0.85, 0.38, 0.08, { fontSize: 0.03, textAlign: 'center' }),
      layoutLayer('logo', 0.08, 0.93, 0.12, 0.04, { textAlign: 'left' }),
    )
  } else if (family === 'clean-course') {
    layers.push(
      layoutLayer('badge', 0.11, 0.06, 0.16, 0.045, { textAlign: 'center' }),
      layoutLayer('title', 0.11, 0.12, 0.34, 0.16, { fontSize: 0.06, textAlign: 'left' }),
      layoutLayer('slogan', 0.11, 0.3, 0.34, 0.08, { fontSize: 0.028, textAlign: 'left' }),
      layoutLayer('body', 0.11, 0.41, 0.35, 0.18, { fontSize: 0.024, textAlign: 'left' }),
      layoutLayer('meta1', 0.11, 0.61, 0.28, 0.05, { fontSize: 0.02, textAlign: 'left' }),
      layoutLayer('meta2', 0.11, 0.665, 0.28, 0.05, { fontSize: 0.02, textAlign: 'left' }),
      layoutLayer('cta', 0.11, 0.74, 0.24, 0.08, { fontSize: 0.026, textAlign: 'center' }),
      layoutLayer('hero', 0.39, 0.08, 0.52, 0.8),
      layoutLayer('logo', 0.11, 0.88, 0.12, 0.04, { textAlign: 'left' }),
    )
  } else if (family === 'list-recruitment') {
    layers.push(
      layoutLayer('badge', 0.08, 0.04, 0.16, 0.045, { textAlign: 'center' }),
      layoutLayer('title', 0.08, 0.08, 0.84, 0.14, { fontSize: 0.066, textAlign: 'left' }),
      layoutLayer('slogan', 0.08, 0.23, 0.84, 0.07, { fontSize: 0.028, textAlign: 'left' }),
      layoutLayer('body', 0.08, 0.33, 0.84, 0.22, { fontSize: 0.024, textAlign: 'left' }),
      layoutLayer('meta1', 0.08, 0.56, 0.38, 0.05, { fontSize: 0.02, textAlign: 'left' }),
      layoutLayer('meta2', 0.08, 0.615, 0.38, 0.05, { fontSize: 0.02, textAlign: 'left' }),
      layoutLayer('hero', isPortrait ? 0 : 0.13, isPortrait ? 0 : 0.6, isPortrait ? 1 : 0.74, isPortrait ? 1 : 0.22),
      layoutLayer('cta', 0.08, 0.87, 0.36, 0.07, { fontSize: 0.026, textAlign: 'center' }),
      layoutLayer('qrcode', 0.76, 0.84, 0.12, 0.12),
    )
  } else if (family === 'xiaohongshu-note') {
    layers.push(
      layoutLayer('badge', 0.08, 0.04, 0.18, 0.045, { textAlign: 'center' }),
      layoutLayer('title', 0.08, 0.08, 0.84, 0.12, { fontSize: 0.062, textAlign: 'left' }),
      layoutLayer('slogan', 0.08, 0.22, 0.84, 0.07, { fontSize: 0.027, textAlign: 'left' }),
      layoutLayer('hero', isPortrait ? 0 : 0.11, isPortrait ? 0 : 0.38, isPortrait ? 1 : 0.78, isPortrait ? 1 : 0.3),
      layoutLayer('chip1', 0.08, 0.32, 0.18, 0.05, { textAlign: 'center' }),
      layoutLayer('chip2', 0.28, 0.32, 0.18, 0.05, { textAlign: 'center' }),
      layoutLayer('chip3', 0.48, 0.32, 0.18, 0.05, { textAlign: 'center' }),
      layoutLayer('chip4', 0.68, 0.32, 0.18, 0.05, { textAlign: 'center' }),
      layoutLayer('body', 0.08, 0.71, 0.84, 0.1, { fontSize: 0.024, textAlign: 'left' }),
      layoutLayer('cta', 0.31, 0.86, 0.38, 0.07, { fontSize: 0.026, textAlign: 'center' }),
    )
  } else {
    const heroTop = isPortrait ? 0 : family === 'hero-left' ? 0.1 : family === 'magazine-cover' ? 0.06 : 0.26
    const heroHeight = isPortrait ? 1 : family === 'hero-left' ? 0.3 : family === 'magazine-cover' ? 0.48 : 0.3
    layers.push(
      layoutLayer('badge', family === 'hero-left' ? 0.1 : 0.37, 0.05, family === 'hero-left' ? 0.18 : 0.26, 0.045, { textAlign: family === 'hero-left' ? 'left' : 'center' }),
      layoutLayer('title', family === 'hero-left' ? 0.1 : 0.09, family === 'hero-left' ? 0.47 : 0.09, family === 'hero-left' ? 0.8 : 0.82, family === 'hero-left' ? 0.12 : 0.12, { fontSize: family === 'magazine-cover' ? 0.07 : 0.064, textAlign: titleAlign }),
      layoutLayer('slogan', family === 'hero-left' ? 0.1 : 0.12, family === 'hero-left' ? 0.61 : 0.23, family === 'hero-left' ? 0.8 : 0.76, 0.07, { fontSize: 0.028, textAlign: titleAlign }),
      layoutLayer('chip1', family === 'hero-left' ? 0.1 : 0.18, family === 'hero-left' ? 0.71 : 0.32, 0.16, 0.05, { textAlign: 'center' }),
      layoutLayer('chip2', family === 'hero-left' ? 0.28 : 0.38, family === 'hero-left' ? 0.71 : 0.32, 0.16, 0.05, { textAlign: 'center' }),
      layoutLayer('chip3', family === 'hero-left' ? 0.46 : 0.58, family === 'hero-left' ? 0.71 : 0.32, 0.16, 0.05, { textAlign: 'center' }),
      layoutLayer('body', family === 'hero-left' ? 0.1 : 0.12, family === 'hero-left' ? 0.71 : 0.76, family === 'hero-left' ? 0.8 : 0.76, plan.density === 'dense' ? 0.11 : 0.08, { fontSize: 0.024, textAlign: titleAlign }),
      layoutLayer('cta', family === 'hero-left' ? 0.1 : 0.31, 0.86, family === 'hero-left' ? 0.32 : 0.38, 0.07, { fontSize: 0.026, textAlign: 'center' }),
      layoutLayer('hero', isPortrait ? 0 : family === 'hero-left' ? 0.1 : 0.11, heroTop, isPortrait ? 1 : family === 'hero-left' ? 0.8 : 0.78, heroHeight),
      layoutLayer('logo', family === 'hero-left' ? 0.1 : 0.08, 0.93, 0.14, 0.04, { textAlign: family === 'hero-left' ? 'left' : 'center' }),
    )
  }
  if (plan.qrStrategy !== 'none') {
    if (plan.qrStrategy === 'cta') {
      layers.push(layoutLayer('qrcode', 0.72, 0.845, 0.12, 0.12))
    } else {
      layers.push(layoutLayer('qrcode', 0.78, 0.81, 0.13, 0.13))
    }
  }
  return { version: 'v1', layers }
}
function normalizeAbsoluteLayout(layout: any, size: SizePreset, fallback: PosterAbsoluteLayout): PosterAbsoluteLayout {
  const layers = Array.isArray(layout?.layers) ? layout.layers : []
  const allowedRoles = new Set(['title', 'slogan', 'body', 'cta', 'hero', 'qrcode', 'badge', 'priceTag', 'priceNum', 'meta1', 'meta2', 'chip1', 'chip2', 'chip3', 'chip4', 'logo'])
  const safeLayers = layers
    .map((layer: any) => {
      const role = String(layer?.role || '').trim()
      if (!allowedRoles.has(role)) return null
      const left = Number(layer.left)
      const top = Number(layer.top)
      const width = Number(layer.width)
      const height = Number(layer.height)
      if (![left, top, width, height].every(Number.isFinite)) return null
      return layoutLayer(role as PosterAbsoluteLayoutLayer['role'], left, top, width, height, {
        fontSize: Number.isFinite(Number(layer.fontSize)) ? Number(layer.fontSize) : undefined,
        textAlign: ['left', 'center', 'right'].includes(String(layer.textAlign || '').trim()) ? String(layer.textAlign).trim() as 'left' | 'center' | 'right' : undefined,
      })
    })
    .filter(Boolean) as PosterAbsoluteLayoutLayer[]
  const mergedByRole = new Map<string, PosterAbsoluteLayoutLayer>()
  safeLayers.forEach((layer) => mergedByRole.set(layer.role, layer))
  fallback.layers.forEach((layer) => {
    if (!mergedByRole.has(layer.role)) mergedByRole.set(layer.role, layer)
  })
  return {
    version: 'v1',
    layers: Array.from(mergedByRole.values()),
  }
}
function buildAbsoluteLayoutFromMultimodalHints(
  size: SizePreset,
  plan: NonNullable<PosterGenerateResult['designPlan']>,
  hints: PosterMultimodalLayoutHints,
): PosterAbsoluteLayout {
  const fallback = buildAbsoluteLayout(size, {
    layoutFamily: plan.layoutFamily,
    density: plan.density,
    heroStrategy: plan.heroStrategy,
    qrStrategy: plan.qrStrategy,
  })
  const roleMap: Record<PosterPlacementRole, PosterAbsoluteLayoutLayer['role']> = {
    heroHeadline: 'title',
    supportLine: 'slogan',
    body: 'body',
    cta: 'cta',
    badge: 'badge',
    priceBlock: 'priceNum',
  }
  const candidateLayers = (hints.suggestedPlacement || [])
    .map((item) => {
      const mappedRole = roleMap[item.role]
      if (!mappedRole) return null
      const rect = normalizeLayoutRect(item, { x: 0.08, y: 0.08, w: 0.32, h: 0.08 })
      const fontSize = mappedRole === 'title'
        ? 0.062
        : mappedRole === 'slogan'
          ? 0.03
          : mappedRole === 'cta'
            ? 0.028
            : mappedRole === 'badge'
              ? 0.022
              : mappedRole === 'priceNum'
                ? 0.052
                : 0.024
      return layoutLayer(mappedRole, rect.x, rect.y, rect.w, rect.h, {
        fontSize,
        textAlign: item.align === 'center' || item.align === 'right' ? item.align : 'left',
      })
    })
    .filter(Boolean) as PosterAbsoluteLayoutLayer[]
  const pricePlacement = (hints.suggestedPlacement || []).find((item) => item.role === 'priceBlock')
  if (pricePlacement) {
    const rect = normalizeLayoutRect(pricePlacement, { x: 0.08, y: 0.62, w: 0.26, h: 0.1 })
    candidateLayers.push(
      layoutLayer('priceTag', rect.x, Math.max(0.04, rect.y - 0.034), Math.min(0.22, rect.w), 0.038, {
        fontSize: 0.02,
        textAlign: 'center',
      }),
    )
  }
  const byRole = new Map<string, PosterAbsoluteLayoutLayer>()
  candidateLayers.forEach((layer) => byRole.set(layer.role, layer))
  fallback.layers.forEach((layer) => {
    if (!byRole.has(layer.role)) byRole.set(layer.role, layer)
  })
  return {
    version: 'v1',
    layers: Array.from(byRole.values()),
  }
}
function applyMultimodalPlanOverride(
  size: SizePreset,
  currentPlan: NonNullable<PosterGenerateResult['designPlan']>,
  hints: PosterMultimodalLayoutHints,
): NonNullable<PosterGenerateResult['designPlan']> {
  const recommendedFamily = String(hints?.layoutDecision?.recommendedFamily || '').trim()
  const confidence = Number(hints?.layoutDecision?.confidence || 0)
  const allowedFamilies = new Set(['hero-center', 'hero-left', 'split-editorial', 'grid-product', 'magazine-cover', 'festive-frame', 'list-recruitment', 'xiaohongshu-note', 'clean-course', 'premium-offer'])
  const nextFamily = allowedFamilies.has(recommendedFamily) && confidence >= 0.32
    ? recommendedFamily
    : currentPlan.layoutFamily
  const absoluteLayout = buildAbsoluteLayoutFromMultimodalHints(size, { ...currentPlan, layoutFamily: nextFamily }, hints)
  return {
    ...currentPlan,
    layoutFamily: nextFamily,
    absoluteLayout,
    textStrategy: hints.visualAnalysis?.needsPanel
      ? 'panel'
      : (hints.textStyleHints?.find((item) => item.role === 'heroHeadline')?.treatment || currentPlan.textStrategy),
    backgroundTone: hints.visualAnalysis?.dominantTone === 'light' || hints.visualAnalysis?.dominantTone === 'dark'
      ? hints.visualAnalysis.dominantTone
      : currentPlan.backgroundTone,
  }
}
function deriveHeroStrategy(input: PosterGenerateInput): 'product' | 'person' | 'scene' | 'editorial' {
  const joined = `${input.theme || ''} ${input.content || ''} ${input.industry || ''} ${input.purpose || ''} ${input.style || ''}`
  const illustrationLike = /卡通|插画|手绘|涂鸦|漫画|贴纸/.test(joined)
  const educationLike = /课程|教育|培训/.test(joined)
  const explicitPerson = hasExplicitPersonCreativeSignal(input)
  if (/招聘|招募|健身|运动|瑜伽|训练/.test(joined)) return 'person'
  if (explicitPerson) return 'person'
  if (educationLike && illustrationLike) return 'scene'
  if (educationLike) return 'editorial'
  if (/活动|节日|庆典|展会|旅游|门店|餐饮|美食|咖啡|茶饮|杂志|小红书/.test(joined)) return 'scene'
  if (/科技互联网|金融|政务公益|专业商务|高级简约/.test(joined)) return 'editorial'
  return 'product'
}
function deriveDesignPlan(input: PosterGenerateInput, candidates: any[], size: SizePreset, posterIntent?: PosterIntent, copyDeck?: PosterCopyDeck) {
  const purpose = String(input.purpose || '')
  const joined = `${input.theme || ''} ${input.content || ''} ${input.industry || ''} ${purpose} ${input.style || ''}`
  const contentLen = String(input.content || '').length
  const content = String(input.content || '')
  const structuredInfoCount = (content.match(/[|｜\n；;、]/g) || []).length
  const hasQr = Boolean(String(input.qrUrl || '').trim())
  const heavyInfoSignal = contentLen > 84 || structuredInfoCount >= 4 || /价格|福利|地址|时间|对象|人群|岗位|课时|限量|赠送|流程/.test(joined)
  const mediumInfoSignal = contentLen > 26 || structuredInfoCount >= 2 || /优惠|亮点|卖点|到店|报名|招募/.test(joined)
  const density: 'light' | 'balanced' | 'dense' = heavyInfoSignal ? 'dense' : mediumInfoSignal ? 'balanced' : 'light'
  const ctaStrength: 'soft' | 'balanced' | 'strong' = /促销|报名|招募|抢购|领券|预约|投递/.test(joined) ? 'strong' : /引流|上新|预告|宣传/.test(joined) ? 'balanced' : 'soft'
  const qrStrategy: 'none' | 'corner' | 'cta' = hasQr ? (ctaStrength === 'strong' && density !== 'dense' ? 'cta' : 'corner') : 'none'
  const layoutFamily = choosePreferredLayoutFamily(input, candidates)
  const heroStrategy = deriveHeroStrategy(input)
  const backgroundTone = inferBackgroundTone(input, layoutFamily)
  const textStrategy = inferTextStrategy(input, density, layoutFamily, backgroundTone)
  const fallbackCopy = buildInputFactCopy(input)
  const fallbackIntent = posterIntent || buildPosterIntentFromSuggestion(input, fallbackCopy)
  const fallbackDeck = copyDeck || buildPosterCopyDeck(input, fallbackCopy, fallbackIntent)
  const contentPattern = deriveContentPattern(fallbackIntent, fallbackDeck, input.sizeKey)
  const emphasisOrder = deriveEmphasisOrder(fallbackIntent, fallbackDeck)
  const ctaStyle = derivePosterCtaStyle(input, fallbackIntent, fallbackDeck, { contentPattern, ctaStrength })
  const absoluteLayout = buildAbsoluteLayout(size, {
    layoutFamily,
    density,
    heroStrategy,
    qrStrategy,
  })
  return {
    industry: input.industry || DEFAULT_INDUSTRY,
    tone: input.style || '高级简约',
    layoutFamily,
    density,
    heroStrategy,
    ctaStrength,
    ctaStyle,
    qrStrategy,
    textStrategy,
    backgroundTone,
    contentPattern,
    emphasisOrder,
    templateCandidates: candidates,
    absoluteLayout,
  }
}

async function relayoutDesignPlanInternal(input: PosterGenerateInput, candidates: any[], mode: LayoutTaskMode = 'draft', posterIntent?: PosterIntent, copyDeck?: PosterCopyDeck) {
  const generationMode = normalizeGenerationMode(input.generationMode)
  const size = sizeMap[input.sizeKey] || sizeMap.xiaohongshu
  const basePlan = deriveDesignPlan(input, candidates, size, posterIntent, copyDeck)
  const posterDirective = buildCommercialPosterDirective()
  const coordinationDirective = buildPosterCoordinationDirective(input)
  const allow = [
    'hero-center',
    'hero-left',
    'split-editorial',
    'grid-product',
    'magazine-cover',
    'festive-frame',
    'list-recruitment',
    'xiaohongshu-note',
    'clean-course',
    'premium-offer',
  ]
  const prompt = mode === 'draft'
    ? [
        '只输出 JSON，不要解释。',
        '你是商业海报版式规划器，负责给可编辑文字图层推荐成片级排版。',
        `前端偏好：${input.presetKey || 'AI自由推荐'}（仅作风格参考，不是版式约束）`,
        `主题：${input.theme || '未填写'}`,
        `行业：${input.industry || DEFAULT_INDUSTRY}`,
        `用途：${input.purpose || '推广'}`,
        `风格：${input.style || '高级简约'}`,
        `补充信息：${input.content || '无'}`,
        `场景：${posterIntent?.scene || ''}`,
        `目标：${posterIntent?.goal || ''}`,
        `标题：${copyDeck?.heroHeadline || ''}`,
        `副标题：${copyDeck?.supportLine || ''}`,
        `利益点：${copyDeck?.offerLine || ''}`,
        `价格块：${copyDeck?.priceBlock ? `${copyDeck.priceBlock.tag} ${copyDeck.priceBlock.value}${copyDeck.priceBlock.suffix}` : '无'}`,
        `信息卡：${(copyDeck?.factCards || []).map((item) => `${item.label}:${item.value}`).join(' | ') || '无'}`,
        `是否有二维码：${String(Boolean(input.qrUrl))}`,
        `可用骨架：${allow.join(', ')}`,
        generationMode === 'fast'
          ? '快速模式：优先最稳、最清晰、最容易直接成片的版式。'
          : '高质量模式：优先成片感、标题权重、信息可读性和按钮清晰度。',
        '输出字段：layoutFamily、density、heroStrategy、ctaStrength、ctaStyle、qrStrategy、textStrategy、backgroundTone、contentPattern、emphasisOrder。',
        '要求：版式必须先服务主题和主图，不要机械套模板；标题区要大，按钮要清晰，信息卡不要拥挤，不要挡住主体。',
        '除非主图背景确实复杂或主体紧贴文字区，否则不要默认给整块深色大面板；优先用留白、安全区、描边字、浅色磨砂条解决可读性。',
      ].join('\n')
    : [
        '你是中文海报版式优化器。只输出 JSON，不要解释。',
        '当前任务是「排版」微调，请把现有海报重排到更像成品海报的状态，目标是信息层级更清晰、标题更抓眼、主体与文字更协调、整体更像成熟设计稿。',
        '这是可编辑文字叠加式海报，不允许依赖图片内文字。',
        generationMode === 'fast'
          ? '本次是快速生成模式：请给出最稳、最清晰、最适合直接成片的版式规划，优先减少冲突和信息拥挤。'
          : '本次排版规划以效果优先，不需要节省生成成本，请按最高质量完成，相当于把可用鲲币都用于提升成片版式完成度。',
        `前端偏好：${input.presetKey || 'AI自由推荐'}（仅作风格参考，不是版式约束）`,
        `主题：${input.theme || '未填写'}`,
        `行业：${input.industry || DEFAULT_INDUSTRY}`,
        `用途：${input.purpose || '推广'}`,
        `风格：${input.style || '高级简约'}`,
        `尺寸：${input.sizeKey || 'xiaohongshu'}`,
        `补充信息：${input.content || '无'}`,
        `场景：${posterIntent?.scene || ''}`,
        `目标：${posterIntent?.goal || ''}`,
        `标题：${copyDeck?.heroHeadline || ''}`,
        `副标题：${copyDeck?.supportLine || ''}`,
        `利益点：${copyDeck?.offerLine || ''}`,
        `稀缺提醒：${copyDeck?.urgencyLine || ''}`,
        `CTA：${copyDeck?.cta || ''}`,
        `价格块：${copyDeck?.priceBlock ? `${copyDeck.priceBlock.tag} ${copyDeck.priceBlock.value}${copyDeck.priceBlock.suffix}` : '无'}`,
        `信息卡：${(copyDeck?.factCards || []).map((item) => `${item.label}:${item.value}`).join(' | ') || '无'}`,
        `是否有二维码：${String(Boolean(input.qrUrl))}`,
        `可用骨架列表：${allow.join(', ')}`,
        '输出字段：layoutFamily、density、heroStrategy、ctaStrength、ctaStyle、qrStrategy、textStrategy、backgroundTone、contentPattern、emphasisOrder。',
        '目标：标题更大，信息分区更清楚，按钮更醒目，尽量避免黑色大面板压住主图；版式要跟主题和图片语义匹配，不要机械复用固定模板感。',
        '如果画面本身有足够干净的留白区，请优先输出 clean / outline 文字策略，而不是 panel。',
      ].join('\n')

  try {
    const ready = ensureBailianReady('relayout', generationMode)
    const isDraftMode = mode === 'draft'
    const activeIntent = posterIntent || buildPosterIntentFromSuggestion(input, buildInputFactCopy(input))
    const parsed: any = await requestBailianChat([{ role: 'system', content: '只输出 JSON。字段值须在允许列表内，与主题与行业一致。' }, { role: 'user', content: prompt }], ready.model, {
      timeoutMs: getStageTimeoutMs('relayout', generationMode, isDraftMode ? 'draft' : 'refine'),
      retryTimes: getStageRetryTimes('relayout', generationMode, isDraftMode ? 'draft' : 'refine'),
      enableThinking: false,
    })
    let layoutFamily = String(parsed.layoutFamily || basePlan.layoutFamily || 'hero-left').trim()
    const density = (['light', 'balanced', 'dense'].includes(parsed.density) ? parsed.density : basePlan.density) as any
    const heroStrategy = (['product', 'person', 'scene', 'editorial'].includes(parsed.heroStrategy) ? parsed.heroStrategy : basePlan.heroStrategy) as any
    const ctaStrength = (['soft', 'balanced', 'strong'].includes(parsed.ctaStrength) ? parsed.ctaStrength : basePlan.ctaStrength) as any
    const parsedCtaStyle = parsed?.ctaStyle || {}
    const ctaStyle: PosterCtaStyle = {
      variant: (['solid', 'outline', 'ghost', 'pill', 'bar', 'sticker', 'underline'].includes(String(parsedCtaStyle.variant)) ? parsedCtaStyle.variant : basePlan.ctaStyle?.variant) as PosterCtaVariant,
      emphasis: (['soft', 'balanced', 'strong'].includes(String(parsedCtaStyle.emphasis)) ? parsedCtaStyle.emphasis : basePlan.ctaStyle?.emphasis || ctaStrength) as PosterCtaStyle['emphasis'],
      shape: (['rounded', 'square', 'capsule'].includes(String(parsedCtaStyle.shape)) ? parsedCtaStyle.shape : basePlan.ctaStyle?.shape) as PosterCtaStyle['shape'],
      placement: (['inline', 'bottom-bar', 'floating', 'with-price'].includes(String(parsedCtaStyle.placement)) ? parsedCtaStyle.placement : basePlan.ctaStyle?.placement) as PosterCtaPlacement,
      tone: (['urgent', 'premium', 'friendly', 'editorial', 'utility'].includes(String(parsedCtaStyle.tone)) ? parsedCtaStyle.tone : basePlan.ctaStyle?.tone) as PosterCtaTone,
      iconHint: (['none', 'arrow', 'plus', 'spark', 'chevron'].includes(String(parsedCtaStyle.iconHint)) ? parsedCtaStyle.iconHint : basePlan.ctaStyle?.iconHint) as PosterCtaIconHint,
      widthMode: (['content', 'wide', 'full'].includes(String(parsedCtaStyle.widthMode)) ? parsedCtaStyle.widthMode : basePlan.ctaStyle?.widthMode) as PosterCtaWidthMode,
    }
    const qrStrategy = (['none', 'corner', 'cta'].includes(parsed.qrStrategy) ? parsed.qrStrategy : basePlan.qrStrategy) as any
    const textStrategy = (['clean', 'outline', 'panel'].includes(parsed.textStrategy) ? parsed.textStrategy : basePlan.textStrategy) as any
    const backgroundTone = (['light', 'dark', 'mixed'].includes(parsed.backgroundTone) ? parsed.backgroundTone : basePlan.backgroundTone) as any
    const contentPattern = (['immersive-hero', 'price-first', 'info-cards', 'cover-story', 'list-info'].includes(parsed.contentPattern) ? parsed.contentPattern : basePlan.contentPattern) as any
    const emphasisOrder = Array.isArray(parsed.emphasisOrder) && parsed.emphasisOrder.length ? parsed.emphasisOrder : basePlan.emphasisOrder
    const explicitNoteSignal = /小红书|种草|笔记|教程|攻略|合集|开箱|测评|打卡|探店|vlog|分享/.test(`${input.theme || ''} ${input.purpose || ''} ${input.style || ''} ${input.content || ''}`)
    const hasPriceBlock = Boolean(String(copyDeck?.priceBlock?.value || '').trim())
    const factCards = Array.isArray(copyDeck?.factCards) ? copyDeck?.factCards || [] : []
    const factCardCount = factCards.filter((item) => String(item?.label || item?.value || item?.hint || '').trim()).length
    if (activeIntent.scene === 'recruitment' && contentPattern === 'list-info') {
      layoutFamily = 'list-recruitment'
    }
    if ((activeIntent.scene === 'event' || activeIntent.scene === 'festival') && !hasPriceBlock && layoutFamily === 'premium-offer') {
      layoutFamily = activeIntent.scene === 'festival' ? 'festive-frame' : 'magazine-cover'
    }
    if ((activeIntent.scene === 'event' || activeIntent.scene === 'festival') && contentPattern === 'immersive-hero') {
      layoutFamily = ['magazine-cover', 'hero-center', 'festive-frame'].includes(layoutFamily) ? layoutFamily : 'magazine-cover'
    }
    if ((activeIntent.scene === 'food' || activeIntent.scene === 'commerce') && layoutFamily === 'xiaohongshu-note' && !explicitNoteSignal) {
      layoutFamily = hasPriceBlock ? 'premium-offer' : factCardCount >= 3 ? 'hero-center' : 'magazine-cover'
    }
    if (activeIntent.scene === 'food' && contentPattern === 'info-cards' && !['hero-center', 'magazine-cover', 'premium-offer', 'grid-product'].includes(layoutFamily)) {
      layoutFamily = hasPriceBlock ? 'premium-offer' : factCardCount >= 3 ? 'hero-center' : 'magazine-cover'
    }
    if (activeIntent.scene === 'commerce' && hasPriceBlock && !['premium-offer', 'grid-product', 'hero-center'].includes(layoutFamily)) {
      layoutFamily = factCardCount >= 3 ? 'grid-product' : 'premium-offer'
    }
    if (activeIntent.scene === 'course' && layoutFamily === 'clean-course' && size.height > size.width && (contentPattern === 'info-cards' || factCardCount >= 3)) {
      layoutFamily = 'split-editorial'
    }
    const fallbackAbsoluteLayout = buildAbsoluteLayout(size, {
      layoutFamily: allow.includes(layoutFamily) ? layoutFamily : basePlan.layoutFamily,
      density,
      heroStrategy,
      qrStrategy,
    })
    const absoluteLayout = normalizeAbsoluteLayout(parsed.absoluteLayout, size, fallbackAbsoluteLayout)

    return {
      plan: {
        ...basePlan,
        layoutFamily: allow.includes(layoutFamily) ? layoutFamily : basePlan.layoutFamily,
        density,
        heroStrategy,
        ctaStrength,
        ctaStyle,
        qrStrategy,
        textStrategy,
        backgroundTone,
        contentPattern,
        emphasisOrder,
        templateCandidates: candidates,
        absoluteLayout,
      },
      meta: getProviderMeta('relayout', { provider: 'aliyun-bailian', model: ready.model, message: mode === 'refine' ? '已使用阿里百炼排版模型完成海报终稿排版优化。' : generationMode === 'fast' ? '已使用阿里百炼快速排版模型完成海报版式规划。' : '已使用阿里百炼高质量排版模型完成海报版式规划。' }, generationMode),
    }
  } catch (error) {
    throw new Error(buildStrictProviderError('一键重排', error))
  }
}
async function relayoutDesignPlanWithBackups(
  input: PosterGenerateInput,
  candidates: any[],
  mode: LayoutTaskMode = 'draft',
  posterIntent?: PosterIntent,
  copyDeck?: PosterCopyDeck,
): Promise<{ plan: PosterGenerateResult['designPlan']; meta: AiProviderMeta }> {
  try {
    return await relayoutDesignPlanInternal(input, candidates, mode, posterIntent, copyDeck)
  } catch (primaryError) {
    const primaryMode = normalizeGenerationMode(input.generationMode)
    if (primaryMode === 'fast') {
      try {
        return await relayoutDesignPlanInternal({ ...input, generationMode: 'quality' }, candidates, mode, posterIntent, copyDeck)
      } catch (backupError) {
        const localFallback = buildLocalRelayoutResult(input, candidates)
        return {
          plan: localFallback.plan,
          meta: getProviderMeta('relayout', {
            provider: 'local-poster-engine',
            model: `${mode}-relayout-last-resort`,
            isMockFallback: true,
            message: `AI 主/备排版均失败，已启用最后本地兜底：${(backupError as Error)?.message || (primaryError as Error)?.message || 'unknown error'}`,
          }, primaryMode),
        }
      }
    }
    const localFallback = buildLocalRelayoutResult(input, candidates)
    return {
      plan: localFallback.plan,
      meta: getProviderMeta('relayout', {
        provider: 'local-poster-engine',
        model: `${mode}-relayout-last-resort`,
        isMockFallback: true,
        message: `AI 排版失败，已启用最后本地兜底：${(primaryError as Error)?.message || 'unknown error'}`,
      }, primaryMode),
    }
  }
}
async function generateMultimodalLayoutHintsInternal(
  input: PosterGenerateInput,
  imageUrl: string,
  posterIntent: PosterIntent,
  copyDeck: PosterCopyDeck,
  designPlan: NonNullable<PosterGenerateResult['designPlan']>,
): Promise<ProviderResult<PosterMultimodalLayoutHints>> {
  const generationMode = normalizeGenerationMode(input.generationMode)
  const aiPlanFallback = buildAiPlanDerivedMultimodalLayoutHints(posterIntent, copyDeck, designPlan)
  const hardFallback = buildLocalMultimodalLayoutHints(input, posterIntent, copyDeck, designPlan)
  const safeImageUrl = String(imageUrl || '').trim()
  if (!safeImageUrl) {
    return {
      result: aiPlanFallback,
      meta: getProviderMeta('multimodalLayout', { provider: 'ai-protocol', model: 'design-plan-derived', isMockFallback: false, message: '未检测到可用主图，已沿用上游 AI 版式规划结果生成排版提示。' }, generationMode),
    }
  }
  try {
    const ready = ensureBailianReady('multimodalLayout', generationMode)
    let remoteImageUrl = ''
    try {
      remoteImageUrl = await resolveInlineModelImageUrl(safeImageUrl, 'ai-layout-inline')
    } catch {
      remoteImageUrl = await resolveRemoteModelImageUrl(safeImageUrl, ready.model, 'ai-layout', { preferTmpfiles: true })
    }
    const prompt = generationMode === 'fast'
      ? [
        '你是商业海报多模态布局分析器，只输出 JSON。',
        '基于主图判断哪里能安全放字，哪里需要避让主体，不要把文字烤进图片。',
        `场景：${posterIntent.scene}；目标：${posterIntent.goal}；当前布局：${designPlan.layoutFamily}`,
        `主标题：${copyDeck.heroHeadline}`,
        `副标题：${copyDeck.supportLine}`,
        `利益点：${copyDeck.offerLine || '无'}`,
        `CTA：${copyDeck.cta}`,
        `价格块：${copyDeck.priceBlock ? `${copyDeck.priceBlock.tag} ${copyDeck.priceBlock.value}${copyDeck.priceBlock.suffix}` : '无'}`,
        '返回字段固定为：safeZones, avoidZones, suggestedPlacement, textStyleHints, visualAnalysis, layoutDecision。',
        'suggestedPlacement 只允许 role: heroHeadline/supportLine/body/cta/badge/priceBlock；坐标全部用 0~1 的 x/y/w/h。',
        'textStyleHints.treatment 只允许 clean/outline/panel。',
        'layoutDecision.recommendedFamily 只允许：hero-center, hero-left, split-editorial, grid-product, magazine-cover, festive-frame, list-recruitment, xiaohongshu-note, clean-course, premium-offer。',
        '若主体占据中心、人物靠近文字区、背景过亮或纹理复杂，请给 avoidZones，并在 visualAnalysis.needsPanel 中明确 true/false。',
        '只有在确实没有可读文字安全区时才把 needsPanel 设为 true；若存在大片干净留白或单色区域，优先给 clean 或 outline。',
        '不要解释，不要 markdown，不要额外字段。',
      ].join('\n')
      : [
        '你是商业海报多模态版式分析器。你会看图，并只输出 JSON。',
        '任务：分析这张海报主视觉图，给出适合后续“可编辑文字图层”叠加的布局提示。',
        '不要建议把文字烤进图片。只输出适合前端矢量文本渲染的参数。',
        `场景：${posterIntent.scene}`,
        `目标：${posterIntent.goal}`,
        `受众：${posterIntent.audience}`,
        `语气：${posterIntent.tone}`,
        `当前建议布局：${designPlan.layoutFamily}`,
        `主标题：${copyDeck.heroHeadline}`,
        `副标题：${copyDeck.supportLine}`,
        `利益点：${copyDeck.offerLine}`,
        `稀缺提醒：${copyDeck.urgencyLine}`,
        `行动理由：${copyDeck.actionReason}`,
        `CTA：${copyDeck.cta}`,
        `价格块：${copyDeck.priceBlock ? `${copyDeck.priceBlock.tag} ${copyDeck.priceBlock.value}${copyDeck.priceBlock.suffix} ${copyDeck.priceBlock.note}` : '无'}`,
        `信息卡：${(copyDeck.factCards || []).map((item) => `${item.label}:${item.value}`).join(' | ') || '无'}`,
        '返回字段：safeZones, avoidZones, suggestedPlacement, textStyleHints, visualAnalysis, layoutDecision。',
        '坐标全部使用 0 到 1 的相对值，字段为 x/y/w/h。',
        'safeZones/avoidZones 说明可叠字区与应避让主体区。',
        'suggestedPlacement 仅允许 role 为 heroHeadline/supportLine/body/cta/badge/priceBlock。',
        'textStyleHints 仅允许 treatment 为 clean/outline/panel。',
        'layoutDecision.recommendedFamily 仅允许以下之一：hero-center, hero-left, split-editorial, grid-product, magazine-cover, festive-frame, list-recruitment, xiaohongshu-note, clean-course, premium-offer。',
        '如果图片主体在中间或右下，请优先给出避让建议和更合适的文字安全区。',
        '必须考虑文字可读性：背景复杂或反差不足时 needsPanel=true，并为标题/正文给出 panel 颜色。',
        '如果主图已经有可用留白区，请优先使用 clean 或 outline，并尽量避免输出会遮挡主体的大面板建议。',
        '只输出 JSON，不要解释。',
      ].join('\n')
    const parsed = await requestBailianVisionChat(remoteImageUrl, prompt, ready.model, {
      timeoutMs: getMultimodalLayoutTimeoutMs(generationMode),
      retryTimes: getMultimodalLayoutRetryTimes(generationMode),
    })
    const normalized = normalizeMultimodalLayoutHints(parsed, aiPlanFallback)
    if (!String(parsed?.layoutDecision?.rationale || '').trim()) {
      normalized.layoutDecision.rationale = '已基于主图构图、主体避让和文字安全区完成多模态排版建议。'
    }
    return {
      result: normalized,
      meta: getProviderMeta('multimodalLayout', { provider: 'aliyun-bailian', model: ready.model, message: generationMode === 'fast' ? '已使用阿里云 Qwen 多模态快速分析主图与文字安全区。' : '已使用阿里云 Qwen 多模态高质量分析主图与文字安全区。' }, generationMode),
    }
  } catch (error) {
    return {
      result: normalizeMultimodalLayoutHints(aiPlanFallback, hardFallback),
      meta: getProviderMeta('multimodalLayout', { provider: 'ai-protocol', model: 'design-plan-derived', isMockFallback: false, message: `多模态布局分析失败，已沿用上游 AI 版式规划结果：${(error as Error)?.message || 'unknown error'}` }, generationMode),
    }
  }
}
async function generateMultimodalLayoutHintsWithBackups(
  input: PosterGenerateInput,
  imageUrl: string,
  posterIntent: PosterIntent,
  copyDeck: PosterCopyDeck,
  designPlan: NonNullable<PosterGenerateResult['designPlan']>,
): Promise<ProviderResult<PosterMultimodalLayoutHints>> {
  try {
    return await generateMultimodalLayoutHintsInternal(input, imageUrl, posterIntent, copyDeck, designPlan)
  } catch (error) {
    const backupInput = normalizeGenerationMode(input.generationMode) === 'fast'
      ? { ...input, generationMode: 'quality' as PosterGenerationMode }
      : input
    try {
      return await generateMultimodalLayoutHintsInternal(backupInput, imageUrl, posterIntent, copyDeck, designPlan)
    } catch (backupError) {
      const aiPlanFallback = buildAiPlanDerivedMultimodalLayoutHints(posterIntent, copyDeck, designPlan)
      return {
        result: aiPlanFallback,
        meta: getProviderMeta('multimodalLayout', {
          provider: 'ai-protocol',
          model: 'design-plan-derived',
          isMockFallback: false,
          message: `多模态主/备分析均失败，已沿用上游 AI 版式规划结果：${(backupError as Error)?.message || (error as Error)?.message || 'unknown error'}`,
        }, normalizeGenerationMode(backupInput.generationMode)),
      }
    }
  }
}
async function generatePosterDraftOnce(input: PosterGenerateInput): Promise<PosterGenerateResult> {
  const size = sizeMap[input.sizeKey] || sizeMap.xiaohongshu
  const generationMode = normalizeGenerationMode(input.generationMode)
  const templateCandidates = getTemplateCandidatesSmart(input.presetKey || '', input.industry, 6, input)
  const recommendation = getTemplateSuggestionSmart(input.presetKey || '', input.industry, input)
  const wantHero = input.generateHeroImage !== false
  const wantBackground = input.generateBackgroundImage !== false
  const hasBackgroundBase = Boolean(String(input.baseImageUrl || '').trim())
  const fastBackground = useFastBackgroundGeneration()
  const buildHeroFallback = (error: unknown): ProviderResult<PosterImageResult> => ({
    result: { imageUrl: '', prompt: '' },
    meta: getProviderMeta('image', { provider: 'none', model: 'hero-fallback', isMockFallback: true, message: `主图生成失败，已返回可编辑排版草案：${sanitizeCutoutFailure(error) || (error as Error)?.message || 'unknown error'}` }, generationMode),
  })
  const buildBackgroundFallback = (error: unknown): ProviderResult<PosterImageResult> => ({
    result: { imageUrl: '', prompt: '' },
    meta: getProviderMeta('background', { provider: 'none', model: 'background-fallback', isMockFallback: true, message: `背景生成失败，已回退为纯排版草案：${sanitizeCutoutFailure(error) || (error as Error)?.message || 'unknown error'}` }, generationMode),
  })

  const copyTask = generateCopyInternal(input, 'draft')
  const paletteTask = generatePaletteWithBackups(input, 'draft')
  const heroPromise = wantHero
    ? generateHeroImageInternal(input, paletteByIndustry[input.industry] || paletteByIndustry[DEFAULT_INDUSTRY], size)
      .catch((error) => buildHeroFallback(error))
    : Promise.resolve({
      result: { imageUrl: '', prompt: '' },
      meta: getProviderMeta('image', { provider: 'none', model: 'skipped', isMockFallback: false, message: '已跳过 AI 主图，仅生成背景与文案版式。' }, generationMode),
      } as ProviderResult<PosterImageResult>)

  const backgroundPromise = wantBackground && (hasBackgroundBase || fastBackground)
    ? generateBackgroundInternal(input, paletteByIndustry[input.industry] || paletteByIndustry[DEFAULT_INDUSTRY], size)
      .catch((error) => buildBackgroundFallback(error))
    : null

  const [paletteState, copyState] = await Promise.allSettled([
    paletteTask,
    copyTask,
  ])
  const paletteResult = paletteState.status === 'fulfilled'
    ? paletteState.value
    : await generatePaletteWithBackups(input, 'draft')
  if (copyState.status !== 'fulfilled') {
    throw copyState.reason instanceof Error ? copyState.reason : new Error(String(copyState.reason || '真实 AI 文案生成失败'))
  }
  const copyResult = copyState.value
  const copyProtocol = buildPosterProtocol(input, copyResult.result)
  const relayoutResult = await relayoutDesignPlanWithBackups(input, templateCandidates, 'draft', copyProtocol.posterIntent, copyProtocol.copyDeck)
  const heroResult = await heroPromise
  const backgroundInput = wantBackground && !hasBackgroundBase && heroResult.result.imageUrl
    ? { ...input, baseImageUrl: heroResult.result.imageUrl }
    : input
  const backgroundResult = backgroundPromise
    ? await backgroundPromise
    : wantBackground
      ? await generateBackgroundInternal(backgroundInput, paletteResult.result, size).catch((error) => buildBackgroundFallback(error))
      : ({
          result: { imageUrl: '', prompt: '' },
          meta: getProviderMeta('background', { provider: 'none', model: 'skipped', isMockFallback: false, message: '已跳过 AI 背景图生成。' }, generationMode),
        } as ProviderResult<PosterImageResult>)
  const designPlan = relayoutResult.plan
  const multimodalSourceUrl = String(heroResult.result.imageUrl || backgroundResult.result.imageUrl || input.sourceImageUrl || input.baseImageUrl || '').trim()
  const multimodalLayoutResult = await generateMultimodalLayoutHintsWithBackups(
    input,
    multimodalSourceUrl,
    copyProtocol.posterIntent,
    copyProtocol.copyDeck,
    designPlan!,
  )
  let finalProtocol = copyProtocol
  let finalDesignPlan = applyMultimodalPlanOverride(size, designPlan!, multimodalLayoutResult.result)
  let finalMultimodalLayoutResult = multimodalLayoutResult
  let qualityHints = buildPosterQualityHints(finalDesignPlan, finalProtocol.copyDeck, Boolean(String(heroResult.result.imageUrl || '').trim()))
  let qualityReport = evaluatePosterQuality(finalDesignPlan, finalProtocol.copyDeck, Boolean(String(heroResult.result.imageUrl || '').trim()))
  let finalRelayoutMeta = relayoutResult.meta
  if (generationMode !== 'fast' && qualityReport.needsRefine) {
    const refinedProtocol = refinePosterProtocolLocally(input, finalProtocol, qualityReport)
    const refinedRelayoutResult = await relayoutDesignPlanWithBackups(input, templateCandidates, 'refine', refinedProtocol.posterIntent, refinedProtocol.copyDeck)
    const refinedPlan = refinedRelayoutResult.plan || finalDesignPlan
    const refinedMultimodal = await generateMultimodalLayoutHintsWithBackups(
      input,
      multimodalSourceUrl,
      refinedProtocol.posterIntent,
      refinedProtocol.copyDeck,
      refinedPlan!,
    )
    const refinedPlanWithHints = applyMultimodalPlanOverride(size, refinedPlan!, refinedMultimodal.result)
    const refinedHints = buildPosterQualityHints(refinedPlanWithHints, refinedProtocol.copyDeck, Boolean(String(heroResult.result.imageUrl || '').trim()))
    const refinedQuality = evaluatePosterQuality(refinedPlanWithHints, refinedProtocol.copyDeck, Boolean(String(heroResult.result.imageUrl || '').trim()))
    if (refinedQuality.score >= qualityReport.score) {
      finalProtocol = refinedProtocol
      finalDesignPlan = refinedPlanWithHints
      finalMultimodalLayoutResult = refinedMultimodal
      finalRelayoutMeta = refinedRelayoutResult.meta || finalRelayoutMeta
      qualityHints = Array.from(new Set([...refinedHints, '已执行一次自动成片细化']))
      qualityReport = refinedQuality
    }
  }
  return {
    title: finalProtocol.copy.title,
    slogan: finalProtocol.copy.slogan,
    body: finalProtocol.copy.body,
    cta: finalProtocol.copy.cta,
    badge: finalProtocol.copy.badge,
    offerLine: finalProtocol.copy.offerLine,
    urgencyLine: finalProtocol.copy.urgencyLine,
    proofPoints: finalProtocol.copy.proofPoints,
    palette: paletteResult.result,
    background: backgroundResult.result,
    hero: heroResult.result,
    recommendedTemplate: recommendation.listItem,
    recommendedTemplates: templateCandidates,
    templateCandidates,
    designPlan: finalDesignPlan,
    posterIntent: finalProtocol.posterIntent,
    copyDeck: finalProtocol.copyDeck,
    multimodalLayoutHints: finalMultimodalLayoutResult.result,
    qualityHints,
    qualityReport,
    size,
    providerMeta: { copy: copyResult.meta, palette: paletteResult.meta, background: backgroundResult.meta, image: heroResult.meta, relayout: finalRelayoutMeta, multimodalLayout: finalMultimodalLayoutResult.meta, generation: getProviderMeta('image', { provider: 'aliyun-bailian', model: generationMode === 'fast' ? 'fast-poster-flow' : 'quality-poster-flow', message: generationMode === 'fast' ? '当前为快速生成：优先更快出成片。' : '当前为高质量生成：优先更强质感与成片效果。' }, generationMode) },
  }
}
async function generatePosterDraftInternal(input: PosterGenerateInput): Promise<PosterGenerateResult> {
  let lastError: unknown = new Error('海报生成失败')
  const retryTimes = getPosterDraftRetryTimes()
  for (let attempt = 0; attempt <= retryTimes; attempt += 1) {
    try {
      return await generatePosterDraftOnce(input)
    } catch (error) {
      lastError = error
      if (attempt >= retryTimes) break
      await new Promise((resolve) => setTimeout(resolve, 1800 * (attempt + 1)))
    }
  }
  throw new Error(buildStrictProviderError('海报生成', lastError))
}
export async function generatePosterDraft(req: any, res: any) { try { send.success(res, await generatePosterDraftInternal(normalizeInput(req.body || {}))) } catch (error) { console.error(error); send.error(res, (error as Error).message || 'generate poster failed') } }
export async function generateCopy(req: any, res: any) {
  const input = normalizeInput(req.body || {})
  try {
    const result = await generateCopyInternal(input, 'rewrite')
    send.success(res, {
      title: result.result.title,
      slogan: result.result.slogan,
      body: result.result.body,
      cta: result.result.cta,
      posterIntent: result.result.posterIntent,
      copyDeck: result.result.copyDeck,
      providerMeta: result.meta,
    })
  } catch (error) {
    console.error(error)
    send.error(res, (error as Error).message || 'generate copy failed')
  }
}
export async function generatePalette(req: any, res: any) {
  const input = normalizeInput(req.body || {})
  try {
    const result = await generatePaletteInternal(input, 'refine')
    send.success(res, { palette: result.result, providerMeta: result.meta })
  } catch (error) {
    console.error(error)
    const fallback = buildLocalPaletteResult(input)
    send.success(res, {
      palette: fallback.result,
      providerMeta: {
        ...fallback.meta,
        message: '配色模型响应较慢，已快速生成适合当前海报的配色。',
      },
    })
  }
}
export async function generateBackgroundImage(req: any, res: any) { try { const input = normalizeInput(req.body || {}); const size = sizeMap[input.sizeKey] || sizeMap.xiaohongshu; const result = await generateBackgroundInternal(input, paletteByIndustry[input.industry] || paletteByIndustry[DEFAULT_INDUSTRY], size); send.success(res, { background: result.result, providerMeta: result.meta }) } catch (error) { console.error(error); send.error(res, (error as Error).message || 'generate background failed') } }
export async function replacePosterImage(req: any, res: any) { try { const input = normalizeInput(req.body || {}); const size = sizeMap[input.sizeKey] || sizeMap.xiaohongshu; const result = await replaceImageInternal(input, paletteByIndustry[input.industry] || paletteByIndustry[DEFAULT_INDUSTRY], size); send.success(res, { hero: result.result, providerMeta: result.meta }) } catch (error) { console.error(error); send.error(res, (error as Error).message || 'replace image failed') } }
export async function relayoutPoster(req: any, res: any) {
  try {
    const input = normalizeInput(req.body || {})
  const candidates = getTemplateCandidatesSmart(input.presetKey || '', input.industry, 6, input)
    const { plan, meta } = await relayoutDesignPlanInternal(input, candidates, 'refine')
    send.success(res, { designPlan: plan, providerMeta: meta } as RelayoutResult)
  } catch (error) {
    console.error(error)
    send.error(res, (error as Error).message || 'relayout failed')
  }
}
export async function cutoutImage(req: any, res: any) { const form = new multiparty.Form(); form.parse(req, async (err: Error | null, fields: any, files: any) => { if (err) return send.error(res, 'cutout upload failed'); const file = files?.file?.[0]; if (!file) return send.error(res, 'file not found'); const folder = 'cutout'; const folderPath = `${filePath}${folder}/`; const suffix = (file.originalFilename || 'cutout.png').split('.').pop() || 'png'; const fileName = `${randomCode(12)}.${suffix}`; const targetPath = `${folderPath}${fileName}`; checkCreateFolder(folderPath); try { await copyFile(file.path, targetPath); const rawUrl = `${getClientStaticBaseUrl()}${folder}/${fileName}`; const provider = normalizeCutoutMode(fields?.provider?.[0]); const cutout = provider === 'local' ? await rembgCutoutProvider(rawUrl, targetPath, fileName) : await remoteCutoutProvider(rawUrl, targetPath, fileName); send.success(res, { rawUrl: cutout.result.rawUrl, resultUrl: cutout.result.resultUrl, providerMeta: cutout.meta }) } catch (error) { console.error(error); send.error(res, sanitizeCutoutFailure(error) || 'cutout failed') } }) }
export default { generatePosterDraft, generateCopy, generatePalette, generateBackgroundImage, replacePosterImage, relayoutPoster, cutoutImage }
