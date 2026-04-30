<template>
  <div class="assistant">
    <div class="assistant-head">
      <div>
        <div class="assistant-title">AI 海报</div>
      </div>
      <el-button class="ai-action-card ai-action-card--header" text :loading="loading.recommend" @click="recommendCopyAndPalette">
        <span class="ai-action-card__icon"><el-icon><MagicStick /></el-icon></span>
        <span class="ai-action-card__content" :class="{ 'is-loading': loading.recommend }">
          <span class="ai-action-card__title">优化文案与配色</span>
        </span>
        <span v-show="!loading.recommend" class="ai-action-card__cost">10鲲币</span>
      </el-button>
    </div>

    <div class="section section--template">
      <div class="section-title"><el-icon><Grid /></el-icon><span>模板选择</span></div>
      <div class="preset-grid">
        <button
          v-for="preset in posterPresets"
          :key="preset.key"
          :class="['preset-card', { active: isPresetActive(preset.key) }]"
          @click="applyPreset(preset.key)"
        >
          <span class="preset-name">{{ preset.name }}</span>
        </button>
      </div>
    </div>

    <div class="section">
      <div class="section-title"><el-icon><EditPen /></el-icon><span>核心输入</span></div>
      <el-form label-position="top" class="compact-form">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="主题">
              <el-input v-model="form.theme" placeholder="例如：五一活动、新品上新、课程招生" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="用途">
              <el-select v-model="form.purpose" style="width: 100%" placeholder="选择传播用途">
                <el-option v-for="item in purposeOptions" :key="item" :label="item" :value="item" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="行业">
              <el-select v-model="form.industry" style="width: 100%">
                <el-option v-for="item in industries" :key="item" :label="item" :value="item" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="风格">
              <el-select v-model="form.style" style="width: 100%">
                <el-option v-for="item in styles" :key="item" :label="item" :value="item" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="常用尺寸" class="size-select-item">
          <el-select v-model="form.sizeKey" class="size-select" style="width: 100%" @change="adaptCanvasSize()">
            <el-option v-for="item in sizePresets" :key="item.key" :label="item.name" :value="item.key" />
          </el-select>
        </el-form-item>

        <el-form-item label="二维码链接">
          <el-input v-model="form.qrUrl" placeholder="可选：https://..." />
        </el-form-item>

        <el-form-item label="补充文案">
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="3"
            placeholder="补充时间、地点、价格、福利、人群、权益等信息，海报会优先把这些真实内容放进画面。"
          />
        </el-form-item>
      </el-form>
    </div>

    <div class="generate-mode-panel">
      <div class="generate-mode-title">生成海报</div>
      <div class="primary-actions" data-testid="poster-generate-actions">
        <el-button
          v-for="action in generateActions"
          :key="action.mode"
          :type="action.mode === 'quality' ? 'primary' : 'default'"
          :class="['ai-action-card', 'ai-action-card--primary', `ai-action-card--${action.mode}`]"
          :data-testid="`poster-generate-${action.mode}`"
          :loading="loading.generate && activeGenerateMode === action.mode"
          :disabled="loading.generate"
          @click="applyPoster(action.mode)"
        >
          <span class="ai-action-card__icon"><el-icon><component :is="action.icon" /></el-icon></span>
          <span class="ai-action-card__content" :class="{ 'is-loading': loading.generate && activeGenerateMode === action.mode }">
            <span class="ai-action-card__title">{{ loading.generate && activeGenerateMode === action.mode ? '生成中...' : action.title }}</span>
          </span>
          <span v-show="!(loading.generate && activeGenerateMode === action.mode)" class="ai-action-card__cost">10鲲币</span>
        </el-button>
      </div>
    </div>

    <div v-if="heroCandidates.length" class="section">
      <div class="section-title"><el-icon><Picture /></el-icon><span>主图候选</span></div>
      <div class="candidate-tip">
        {{ heroSelectionTip }}
      </div>
      <div class="hero-candidate-grid">
        <button
          v-for="(candidate, index) in heroCandidates"
          :key="`${candidate.imageUrl}-${index}`"
          type="button"
          :class="['hero-candidate-card', { active: selectedHeroCandidateIndex === index, recommended: recommendedHeroCandidateIndex === index }]"
          @click="selectedHeroCandidateIndex = index"
        >
          <span v-if="recommendedHeroCandidateIndex === index" class="hero-candidate-badge">推荐</span>
          <img class="hero-candidate-image" :src="candidate.imageUrl" :alt="`候选主图${index + 1}`">
          <span class="hero-candidate-score">总分 {{ candidate.score }}</span>
          <span class="hero-candidate-breakdown">
            留白 {{ candidate.scoreBreakdown?.whitespace ?? 0 }} / 构图 {{ candidate.scoreBreakdown?.subjectPosition ?? 0 }}
          </span>
          <span class="hero-candidate-breakdown">
            清晰 {{ candidate.scoreBreakdown?.clarity ?? 0 }} / 色调 {{ candidate.scoreBreakdown?.toneMatch ?? 0 }}
          </span>
        </button>
      </div>
      <div class="candidate-actions">
        <el-button type="primary" class="candidate-apply-btn" @click="applySelectedHeroCandidate">
          {{ pendingQualityCandidateSelection ? '使用当前主图并继续上版' : '应用当前主图' }}
        </el-button>
      </div>
    </div>

    <div class="section">
      <div class="section-title"><el-icon><Tools /></el-icon><span>快捷微调</span></div>
      <div class="refine-mode-panel">
        <span class="refine-mode-label">微调模型</span>
        <div class="refine-mode-toggle">
          <button
            type="button"
            :class="['refine-mode-chip', { active: activeRefineMode === 'quality' }]"
            @click="activeRefineMode = 'quality'"
          >
            高质量
          </button>
          <button
            type="button"
            :class="['refine-mode-chip', { active: activeRefineMode === 'fast' }]"
            @click="activeRefineMode = 'fast'"
          >
            快速
          </button>
        </div>
      </div>
      <div class="actions">
        <el-button
          v-for="action in refineActions"
          :key="action.key"
          class="ai-action-card ai-action-card--secondary"
          :loading="loading[action.loadingKey]"
          @click="action.handler"
        >
          <span class="ai-action-card__icon"><el-icon><component :is="action.icon" /></el-icon></span>
          <span class="ai-action-card__content" :class="{ 'is-loading': loading[action.loadingKey] }">
            <span class="ai-action-card__title">{{ loading[action.loadingKey] ? '处理中...' : action.title }}</span>
          </span>
          <span v-show="!loading[action.loadingKey]" class="ai-action-card__cost">10鲲币</span>
        </el-button>
      </div>
    </div>

  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElForm, ElFormItem, ElRow, ElCol, ElSelect, ElOption } from 'element-plus'
import { EditPen, Grid, MagicStick, Picture, Promotion, Tools } from '@element-plus/icons-vue'
import { useCanvasStore, useUserStore, useWidgetStore } from '@/store'
import { normalizeLoopbackMediaUrl } from '@/utils/publicMediaUrl'
import {
  requestAi,
  type PosterGenerateInput,
  type PosterGenerateResult,
  type PosterPalette,
  type AiProviderMeta,
  type CopyGenerateResult,
  type PaletteGenerateResult,
  type ReplaceImageResult,
  type RelayoutResult,
} from '@/api/ai'
import { applyPosterPalette, buildPosterLayout, getPosterGradient, getSizePresets, replaceHeroImage, replacePosterTexts } from './posterEngine'

type PosterGenerationMode = 'fast' | 'quality'

type PosterPreset = {
  key: string
  name: string
  industry: string
  style: string
  purpose: string
  sizeKey: string
}

const posterPresets: PosterPreset[] = [
  { key: 'campaign', name: '活动主视觉', industry: '活动', style: '高级简约', purpose: '引流', sizeKey: 'xiaohongshu' },
  { key: 'recruitment', name: '招聘招募', industry: '招聘', style: '专业商务', purpose: '招聘', sizeKey: 'moments' },
  { key: 'commerce', name: '电商促销', industry: '电商', style: '活力促销', purpose: '促销', sizeKey: 'ecommerce' },
  { key: 'course', name: '课程招生', industry: '课程', style: '清新温暖', purpose: '报名', sizeKey: 'wechat-cover' },
  { key: 'fitness', name: '健身打卡', industry: '健身', style: '年轻潮流', purpose: '报名', sizeKey: 'xiaohongshu' },
  { key: 'food', name: '餐饮上新', industry: '餐饮', style: '活力促销', purpose: '促销', sizeKey: 'flyer' },
  { key: 'festival', name: '节日模板', industry: '节日', style: '活力促销', purpose: '促销', sizeKey: 'moments' },
]
const presetThemeNames = new Set(posterPresets.map((item) => item.name))

const industries = [
  '电商',
  '招聘',
  '活动',
  '课程',
  '节日',
  '健身',
  '餐饮',
  '美妆',
  '母婴',
  '地产',
  '金融',
  '科技互联网',
  '旅游',
  '汽车',
  '政务公益',
]
const styles = [
  '高级简约',
  '活力促销',
  '专业商务',
  '年轻潮流',
  '清新温暖',
  '国潮中式',
  '复古胶片',
  '极简科技',
  '轻奢质感',
  '卡通插画',
  '黑金大气',
  '杂志大片',
  '日系侘寂',
  '赛博朋克',
  '新中式雅致',
  '潮酷街头',
  '手绘涂鸦',
  '北欧极简',
  '法式优雅',
  '蒸汽波复古',
  '玻璃拟态',
  '酸性设计',
  '水墨写意',
  '孟菲斯几何',
  '暗黑神秘',
]
/** 与文案/主图情绪提示中的用途关键词尽量对齐（computed 避免 HMR/下拉层渲染时绑定丢失） */
const purposeOptions = computed(() => [
  '引流',
  '促销',
  '报名',
  '招聘',
  '上新',
  '品牌宣传',
  '活动预告',
  '课程推广',
  '门店导流',
  '直播预告',
  '会员招募',
  '周年庆',
  '公益倡导',
  '产品发布',
  '节日祝福',
])
const sizePresets = getSizePresets()
const AI_POSTER_FORM_STORAGE_KEY = 'ai-poster-assistant-form-v1'

const pageStore = useCanvasStore()
const widgetStore = useWidgetStore()
const userStore = useUserStore()
const route = useRoute()
const router = useRouter()
const autoGenerateHandledKey = ref('')

function assertAiLogin(): boolean {
  if (!userStore.online) {
    ElMessage.warning('请先登录后再使用 AI 海报功能')
    return false
  }
  if (userStore.permissions.allow_ai_tools === false) {
    ElMessage.warning('当前账号无 AI 功能权限，请联系管理员开通。')
    return false
  }
  return true
}


const form = reactive<PosterGenerateInput & { presetKey: string }>({
  presetKey: '',
  theme: '',
  purpose: '品牌宣传',
  industry: '活动',
  style: '高级简约',
  sizeKey: 'xiaohongshu',
  content: '',
  qrUrl: '',
  generateHeroImage: true,
  generateBackgroundImage: false,
})

function buildPersistedPosterFormState() {
  return {
    presetKey: String(form.presetKey || '').trim(),
    theme: String(form.theme || '').trim(),
    purpose: String(form.purpose || '').trim(),
    industry: String(form.industry || '').trim(),
    style: String(form.style || '').trim(),
    sizeKey: String(form.sizeKey || '').trim(),
    qrUrl: String(form.qrUrl || '').trim(),
    content: String(form.content || '').trim(),
  }
}

function restorePersistedPosterForm() {
  if (typeof window === 'undefined') return
  try {
    const raw = window.localStorage.getItem(AI_POSTER_FORM_STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw || '{}') as Partial<PosterGenerateInput & { presetKey: string }>
    const presetKey = String(parsed.presetKey || '').trim()
    if (presetKey && posterPresets.some((item) => item.key === presetKey)) {
      form.presetKey = presetKey === 'smart' ? '' : presetKey
    }
    form.theme = String(parsed.theme || '').trim()
    form.purpose = purposeOptions.value.includes(String(parsed.purpose || '').trim())
      ? String(parsed.purpose || '').trim()
      : form.purpose
    form.industry = industries.includes(String(parsed.industry || '').trim())
      ? String(parsed.industry || '').trim()
      : form.industry
    form.style = styles.includes(String(parsed.style || '').trim())
      ? String(parsed.style || '').trim()
      : form.style
    form.sizeKey = sizePresets.some((item) => item.key === String(parsed.sizeKey || '').trim())
      ? String(parsed.sizeKey || '').trim()
      : form.sizeKey
    form.qrUrl = String(parsed.qrUrl || '').trim()
    form.content = String(parsed.content || '').trim()
    // 当前界面未暴露主图/背景生成开关，避免旧本地状态把主图生成永久关掉。
    form.generateHeroImage = true
    form.generateBackgroundImage = false
    adaptCanvasSize(true)
    persistPosterForm()
  } catch (error) {
    console.warn('restore ai poster form failed', error)
  }
}

function persistPosterForm() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(AI_POSTER_FORM_STORAGE_KEY, JSON.stringify(buildPersistedPosterFormState()))
  } catch (error) {
    console.warn('persist ai poster form failed', error)
  }
}

const result = reactive({
  title: '',
  slogan: '',
  body: '',
  cta: '',
})

const loading = reactive({
  generate: false,
  recommend: false,
  replaceText: false,
  image: false,
  relayout: false,
})
const activeGenerateMode = ref<PosterGenerationMode | ''>('')
const activeRefineMode = ref<PosterGenerationMode>('fast')
const AI_POSTER_LOADING_EVENT = 'ai-poster-loading'

const generateActions = computed(() => [
  {
    mode: 'quality' as PosterGenerationMode,
    title: '高质量',
    meta: '细节和氛围更强，适合直接出成品',
    icon: MagicStick,
  },
  {
    mode: 'fast' as PosterGenerationMode,
    title: '快速生成',
    meta: '更快出首版，再继续微调到成片状态',
    icon: Promotion,
  },
])

const refineModeMeta = computed(() =>
  activeRefineMode.value === 'quality'
    ? '高质量模型'
    : '快速模型',
)

const refineActions = computed(() => [
  {
    key: 'replaceText',
    title: '换文案',
    meta: `${refineModeMeta.value}，重写标题、卖点和 CTA`,
    icon: EditPen,
    handler: replaceTextOnly,
    loadingKey: 'replaceText' as const,
  },
  {
    key: 'image',
    title: '换主图',
    meta: `${refineModeMeta.value}，强化主体和主视觉冲击`,
    icon: Picture,
    handler: replaceHeroOnly,
    loadingKey: 'image' as const,
  },
  {
    key: 'relayout',
    title: '重排版',
    meta: `${refineModeMeta.value}，优化标题层级和可读性`,
    icon: Tools,
    handler: relayoutLayout,
    loadingKey: 'relayout' as const,
  },
])

const providerTip = ref('')
const currentPalette = ref<PosterPalette>({
  background: '#FFF1F2',
  surface: '#FFFFFF',
  primary: '#E11D48',
  secondary: '#FFD6E0',
  text: '#3F1020',
  muted: '#9F1239',
  swatches: ['#FFF1F2', '#FFD6E0', '#FB7185', '#3F1020'],
})
const lastPosterResult = ref<PosterGenerateResult | null>(null)
const selectedHeroCandidateIndex = ref(0)
const pendingQualityCandidateSelection = ref(false)
const heroCandidates = computed(() => Array.isArray(lastPosterResult.value?.heroCandidates) ? lastPosterResult.value?.heroCandidates || [] : [])
const recommendedHeroCandidateIndex = computed(() => {
  const raw = Number(lastPosterResult.value?.recommendedHeroCandidateIndex ?? lastPosterResult.value?.heroSelectionMeta?.recommendedIndex ?? 0)
  return Number.isFinite(raw) ? Math.max(0, raw) : 0
})
const heroSelectionTip = computed(() => {
  const poster = lastPosterResult.value
  if (!poster || !heroCandidates.value.length) return ''
  const selectionMeta = poster.heroSelectionMeta
  const modeText = poster.heroSelectionMode === 'manual'
    ? '高质量模式可先挑主图，再继续上版。'
    : '快速模式已自动选择最佳主图。'
  const confidenceText = selectionMeta?.lowConfidence ? '当前推荐图把握一般，建议人工挑选。' : '已按留白、主体位置、清晰度和色调做过自动评分。'
  return `${modeText}${confidenceText}`
})
const absoluteLayoutLayers = computed(() => {
  const layers = ((lastPosterResult.value?.designPlan as any)?.absoluteLayout?.layers || []) as Array<Record<string, any>>
  return layers.map((layer) => ({
    role: String(layer.role || ''),
    left: Number(layer.left || 0).toFixed(3),
    top: Number(layer.top || 0).toFixed(3),
    width: Number(layer.width || 0).toFixed(3),
    height: Number(layer.height || 0).toFixed(3),
    fontSize: Number(layer.fontSize || 0) > 0 ? Number(layer.fontSize).toFixed(3) : '',
    textAlign: String(layer.textAlign || ''),
  }))
})
const activePalette = computed(() => currentPalette.value)

function parseHexColor(input: string) {
  const raw = String(input || '').trim().replace('#', '')
  const safe = /^[0-9a-fA-F]{3,8}$/.test(raw) ? raw : '111111'
  if (safe.length === 3 || safe.length === 4) {
    return {
      r: parseInt(safe[0] + safe[0], 16),
      g: parseInt(safe[1] + safe[1], 16),
      b: parseInt(safe[2] + safe[2], 16),
    }
  }
  return {
    r: parseInt(safe.slice(0, 2), 16),
    g: parseInt(safe.slice(2, 4), 16),
    b: parseInt(safe.slice(4, 6), 16),
  }
}

function relativeLuminance(input: string) {
  const { r, g, b } = parseHexColor(input)
  const tf = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * tf(r) + 0.7152 * tf(g) + 0.0722 * tf(b)
}

function contrastRatio(a: string, b: string) {
  const l1 = relativeLuminance(a)
  const l2 = relativeLuminance(b)
  const high = Math.max(l1, l2)
  const low = Math.min(l1, l2)
  return (high + 0.05) / (low + 0.05)
}

function pickReadableTextOn(bg: string, preferred: string) {
  const candidates = [preferred, '#111111', '#ffffff']
  let best = candidates[0]
  let score = -1
  candidates.forEach((c) => {
    const s = contrastRatio(c, bg)
    if (s > score) {
      score = s
      best = c
    }
  })
  return best
}

function getPayload(generationMode: PosterGenerationMode = 'quality'): PosterGenerateInput {
  const page = pageStore.getDPage() as any
  const heroWidget = getCanvasImageWidget() as any
  const sourceImageUrl = normalizeLoopbackMediaUrl(String(heroWidget?.imgUrl || '').trim())
  const pageBackgroundUrl = normalizeLoopbackMediaUrl(String(page?.backgroundImage || '').trim())
  return {
    presetKey: form.presetKey.trim(),
    theme: form.theme.trim(),
    purpose: form.purpose.trim(),
    sizeKey: form.sizeKey,
    style: form.style,
    industry: form.industry,
    content: form.content.trim(),
    qrUrl: form.qrUrl.trim(),
    generationMode,
    sourceImageUrl,
    baseImageUrl: pageBackgroundUrl || sourceImageUrl,
    generateHeroImage: true,
    generateBackgroundImage: false,
    selectedHeroCandidateIndex: selectedHeroCandidateIndex.value,
  }
}

function getModeLabel(mode: PosterGenerationMode) {
  return mode === 'quality' ? '高质量' : '快速'
}

function emitAiPosterLoading(
  status: 'start' | 'finish',
  detail: {
    action: 'generate' | 'copy' | 'image' | 'relayout' | 'recommend'
    mode?: PosterGenerationMode
    success?: boolean
  },
) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(AI_POSTER_LOADING_EVENT, {
      detail: {
        status,
        ...detail,
      },
    }),
  )
}

function getPosterTimeout(mode: PosterGenerationMode, kind: 'copy' | 'palette' | 'background' | 'image' | 'generate' | 'relayout') {
  const quality = {
    copy: 220000,
    palette: 220000,
    background: 300000,
    image: 300000,
    generate: 480000,
    relayout: 220000,
  }
  const fast = {
    copy: 120000,
    palette: 120000,
    background: 180000,
    image: 180000,
    generate: 240000,
    relayout: 120000,
  }
  return (mode === 'quality' ? quality : fast)[kind]
}

function syncResult(data: Pick<PosterGenerateResult, 'title' | 'slogan' | 'body' | 'cta'>) {
  result.title = data.title || ''
  result.slogan = data.slogan || ''
  result.body = data.body || ''
  result.cta = data.cta || ''
}

function normalizePosterMedia(poster: PosterGenerateResult): PosterGenerateResult {
  const bg = normalizeLoopbackMediaUrl(poster.background?.imageUrl || '') || ''
  const hero = normalizeLoopbackMediaUrl(poster.hero?.imageUrl || '') || ''
  const heroCandidates = Array.isArray(poster.heroCandidates)
    ? poster.heroCandidates.map((candidate) => ({
      ...candidate,
      imageUrl: normalizeLoopbackMediaUrl(candidate.imageUrl || '') || '',
    }))
    : []
  return {
    ...poster,
    background: {
      ...(poster.background || { prompt: '' }),
      imageUrl: bg,
    },
    hero: {
      ...(poster.hero || { prompt: '' }),
      imageUrl: hero,
    },
    heroCandidates,
  }
}
function buildPosterWithSelectedHero(poster: PosterGenerateResult, index: number): PosterGenerateResult {
  const candidates = Array.isArray(poster.heroCandidates) ? poster.heroCandidates : []
  if (!candidates.length) return poster
  const safeIndex = Math.max(0, Math.min(index, candidates.length - 1))
  const nextHero = candidates[safeIndex]
  return {
    ...poster,
    hero: {
      imageUrl: nextHero.imageUrl,
      prompt: nextHero.prompt,
    },
    heroCandidates: candidates.map((candidate, candidateIndex) => ({
      ...candidate,
      selected: candidateIndex === safeIndex,
    })),
    multimodalLayoutHints: nextHero.multimodalLayoutHints || poster.multimodalLayoutHints,
    heroSelectionMeta: {
      ...(poster.heroSelectionMeta || {
        recommendedIndex: recommendedHeroCandidateIndex.value,
        selectionMode: poster.heroSelectionMode || 'manual',
      }),
      selectedIndex: safeIndex,
    },
  }
}
function applySelectedHeroCandidate() {
  if (!lastPosterResult.value) return
  const merged = buildPosterWithSelectedHero(lastPosterResult.value, selectedHeroCandidateIndex.value)
  lastPosterResult.value = merged
  const layout = buildPosterLayout({ input: getPayload(merged.heroSelectionMode === 'auto' ? 'fast' : 'quality'), result: merged })
  applyGeneratedLayoutToCanvas(layout)
  pendingQualityCandidateSelection.value = false
  ElMessage.success(merged.heroSelectionMode === 'manual' ? '已应用所选主图并完成上版。' : '已切换主图。')
}

function formatProviderMeta(meta?: AiProviderMeta) {
  if (!meta) return ''
  const raw = `${meta.provider} ${meta.model} ${meta.message || ''}`
  let stage = 'AI 处理'
  if (/copy|qwen|文案/.test(raw)) stage = '文案'
  else if (/palette|配色/.test(raw)) stage = '配色'
  else if (/background|背景/.test(raw)) stage = '背景'
  else if (/imageedit|replace-image|换图/.test(raw)) stage = '主图'
  else if (/image|wan|主视觉/.test(raw)) stage = '主图'
  else if (/relayout|排版/.test(raw)) stage = '排版'
  else if (/cutout|抠图/.test(raw)) stage = '抠图'

  const detail = String(meta.message || '')
    .replace(/^Aliyun /i, '')
    .replace(/ completed.*$/i, '')
    .replace(/returned.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (meta.provider === 'none') return `${stage}：本次未生成`
  if (detail) return `${stage}：${detail}`
  return `${stage}：已完成`
}

function notifyFriendlyError(prefix: string, error: unknown) {
  const message = String((error as any)?.message || '')
  const low = message.toLowerCase()
  if (low.includes('network') || low.includes('timeout') || low.includes('err_connection_refused')) {
    ElMessage.error(`${prefix}：网络异常，请稍后重试`)
    return
  }
  if (message.includes('AI 生成时间较长')) {
    ElMessage.error(`${prefix}：AI 生成时间较长，请稍候再试`)
    return
  }
  if (low.includes('401') || low.includes('403') || low.includes('429')) {
    ElMessage.error(`${prefix}：权限或额度不足，请检查账号状态`)
    return
  }
  if (message) {
    ElMessage.error(`${prefix}：${message}`)
    return
  }
  ElMessage.error(`${prefix}：服务繁忙，请稍后重试`)
}

function updateProviderTip(meta?: Record<string, AiProviderMeta>) {
  const messages = Object.values(meta || {})
    .map((item) => formatProviderMeta(item))
    .filter(Boolean)
  providerTip.value = messages.join('\n')
}

function open() {
  applyPreset(form.presetKey || 'smart')
}

function applyGeneratedLayoutToCanvas(layout: { page: Record<string, any>; widgets: any[] }) {
  const pageData = {
    ...pageStore.getDPage(),
    width: layout.page.width,
    height: layout.page.height,
    backgroundColor: layout.page.backgroundColor,
    backgroundGradient: layout.page.backgroundGradient,
    backgroundImage: layout.page.backgroundImage,
    backgroundTransform: {},
  } as any
  pageStore.setDPage(pageData)
  pageStore.setDCurrentPage(0)
  widgetStore.setDLayouts([{ global: pageData, layers: layout.widgets as any[] }])
  widgetStore.selectWidget({ uuid: '-1' })
}

function routeQuerySingle(key: string) {
  const v = route.query[key]
  return Array.isArray(v) ? String(v[0] || '') : String(v || '')
}

async function maybeAutoGenerateFromWelcome() {
  const auto = routeQuerySingle('aiAutoGenerate').trim() === '1'
  const preset = routeQuerySingle('preset').trim()
  const theme = routeQuerySingle('aiTheme').trim()
  const prompt = routeQuerySingle('aiPrompt').trim()
  const purpose = routeQuerySingle('aiPurpose').trim()
  const industry = routeQuerySingle('aiIndustry').trim()
  const style = routeQuerySingle('aiStyle').trim()
  const sizeKey = routeQuerySingle('aiSizeKey').trim()
  const qrUrl = routeQuerySingle('aiQrUrl').trim()
  const content = routeQuerySingle('aiContent').trim()
  if (!auto) return
  const key = `${auto}|${preset}|${theme}|${prompt}|${purpose}|${industry}|${style}|${sizeKey}|${qrUrl}|${content}|${route.fullPath}`
  if (autoGenerateHandledKey.value === key) return
  autoGenerateHandledKey.value = key
  if (preset) {
    applyPreset(preset)
  }
  if (theme) form.theme = theme
  if (purpose) form.purpose = purpose
  if (industry) form.industry = industry
  if (style) form.style = style
  if (sizeKey && sizePresets.some((item) => item.key === sizeKey)) form.sizeKey = sizeKey
  if (qrUrl) form.qrUrl = qrUrl
  if (content) {
    form.content = content
  } else if (prompt && !form.content) {
    form.content = prompt
  }
  await applyPoster()
  const nextQuery = { ...route.query } as Record<string, any>
  delete nextQuery.aiAutoGenerate
  void router.replace({ path: route.path, query: nextQuery })
}

function applyPreset(key: string) {
  const preset = posterPresets.find((item) => item.key === key)
  if (!preset) return
  const canReplaceTheme = !form.theme.trim() || presetThemeNames.has(form.theme.trim())
  form.presetKey = preset.key === 'smart' ? '' : preset.key
  if (preset.key === 'smart') {
    if (canReplaceTheme) form.theme = ''
    form.industry = '活动'
    form.style = '高级简约'
    form.purpose = '品牌宣传'
    form.sizeKey = preset.sizeKey
    adaptCanvasSize(true)
    return
  }
  if (canReplaceTheme) form.theme = preset.name
  form.industry = preset.industry
  form.style = preset.style
  form.purpose = preset.purpose
  form.sizeKey = preset.sizeKey
  adaptCanvasSize(true)
}

function isPresetActive(key: string) {
  return key === 'smart' ? !form.presetKey : form.presetKey === key
}

async function recommendCopyAndPalette() {
  if (!assertAiLogin()) return
  loading.recommend = true
  let success = false
  emitAiPosterLoading('start', { action: 'recommend', mode: activeRefineMode.value })
  try {
    const mode = activeRefineMode.value
    const payload = getPayload(mode)
    const hasContent = hasCanvasContent()
    const [copyState, paletteState] = await Promise.allSettled([
      requestAi<CopyGenerateResult>('ai/poster/copy', payload, getPosterTimeout(mode, 'copy')),
      requestAi<PaletteGenerateResult>('ai/poster/palette', payload, getPosterTimeout(mode, 'palette')),
    ])
    const copyRes = copyState.status === 'fulfilled' ? copyState.value : null
    const paletteRes = paletteState.status === 'fulfilled' ? paletteState.value : null
    if (!copyRes && !paletteRes) {
      throw new Error(
        String(copyState.status === 'rejected' ? copyState.reason?.message || copyState.reason || '' : '') ||
        String(paletteState.status === 'rejected' ? paletteState.reason?.message || paletteState.reason || '' : '') ||
        '文案与配色优化失败',
      )
    }
    if (paletteRes?.palette) {
      currentPalette.value = paletteRes.palette
    }
    providerTip.value = [formatProviderMeta(copyRes?.providerMeta), formatProviderMeta(paletteRes?.providerMeta)].filter(Boolean).join('\n')
    if (hasContent) {
      const currentPage = pageStore.getDPage()
      const hasBackgroundImage = Boolean(String((currentPage as any)?.backgroundImage || '').trim())
      // 有背景图时：只改字体/前景颜色，不更改背景颜色/渐变，也不删除背景图
      if (hasBackgroundImage) {
        if (lastPosterResult.value) {
          lastPosterResult.value = {
            ...lastPosterResult.value,
            palette: currentPalette.value,
          } as PosterGenerateResult
        }
        applyPaletteToCurrentCanvas()
        widgetStore.updateDWidgets()
        ElMessage.success(`${getModeLabel(mode)}模型已优化文案与配色。`)
        return
      }
      if (lastPosterResult.value) {
        const merged = {
          ...lastPosterResult.value,
          // 「推荐配色」只改色，不改用户当前文案
          title: lastPosterResult.value.title,
          slogan: lastPosterResult.value.slogan,
          body: lastPosterResult.value.body,
          cta: lastPosterResult.value.cta,
          palette: currentPalette.value,
        } as PosterGenerateResult
        lastPosterResult.value = merged
        const layout = buildPosterLayout({ input: payload, result: merged })
        applyGeneratedLayoutToCanvas(layout)
      } else {
        const page = pageStore.getDPage()
        pageStore.setDPage({
          ...page,
          backgroundColor: currentPalette.value.background,
          backgroundGradient: page.backgroundImage ? '' : getPosterGradient(currentPalette.value),
        } as any)
      }
      applyPaletteToCurrentCanvas()
      widgetStore.updateDWidgets()
      ElMessage.success(copyRes && paletteRes ? `${getModeLabel(mode)}模型已优化文案与配色。` : copyRes ? `${getModeLabel(mode)}模型已优化文案。` : `${getModeLabel(mode)}模型已优化配色。`)
    } else {
      if (copyRes) {
        syncResult(copyRes as Pick<PosterGenerateResult, 'title' | 'slogan' | 'body' | 'cta'>)
      }
      ElMessage.success(copyRes && paletteRes ? `${getModeLabel(mode)}模型已生成文案与推荐配色。` : copyRes ? `${getModeLabel(mode)}模型已生成推荐文案。` : `${getModeLabel(mode)}模型已生成推荐配色。`)
    }
    success = true
  } catch (error) {
    console.error(error)
    notifyFriendlyError('推荐失败', error)
  } finally {
    loading.recommend = false
    emitAiPosterLoading('finish', { action: 'recommend', mode: activeRefineMode.value, success })
  }
}

async function applyPoster(generationMode: PosterGenerationMode = 'quality') {
  if (!assertAiLogin()) return
  loading.generate = true
  activeGenerateMode.value = generationMode
  let success = false
  emitAiPosterLoading('start', { action: 'generate', mode: generationMode })
  try {
    const payload = getPayload(generationMode)
    const timeout = getPosterTimeout(generationMode, 'generate')
    const poster = normalizePosterMedia(await requestAi<PosterGenerateResult>('ai/poster/generate', payload, timeout))
    lastPosterResult.value = poster
    selectedHeroCandidateIndex.value = Math.max(0, Number(poster.heroSelectionMeta?.selectedIndex ?? poster.recommendedHeroCandidateIndex ?? 0))
    pendingQualityCandidateSelection.value = generationMode === 'quality' && heroCandidates.value.length > 0
    syncResult(poster)
    currentPalette.value = poster.palette
    updateProviderTip(poster.providerMeta)
    if (generationMode === 'quality' && heroCandidates.value.length > 0) {
      success = true
      ElMessage.success('高质量候选主图已生成，请先选择一张主图继续上版。')
      return
    }
    const layout = buildPosterLayout({
      input: payload,
      result: {
        ...poster,
        title: result.title,
        slogan: result.slogan,
        body: result.body,
        cta: result.cta,
      },
    })

    if (!layout.widgets.length) {
      throw new Error('AI 已返回结果，但当前排版未生成有效图层，请重试')
    }
    applyGeneratedLayoutToCanvas(layout)
    pendingQualityCandidateSelection.value = false
    success = true
    ElMessage.success(generationMode === 'fast' ? '快速海报已生成，系统已自动选出最佳主图。' : '高质量海报已生成，可以继续换字、换图和排版。')
  } catch (error) {
    console.error(error)
    notifyFriendlyError('生成失败', error)
  } finally {
    loading.generate = false
    activeGenerateMode.value = ''
    emitAiPosterLoading('finish', { action: 'generate', mode: generationMode, success })
  }
}

function ensurePosterWidgets() {
  if (!widgetStore.dWidgets.some((item) => String(item.name || '').startsWith('ai_'))) {
    return false
  }
  return true
}

function hasCanvasContent() {
  return Array.isArray(widgetStore.dWidgets) && widgetStore.dWidgets.length > 0
}

function applyPaletteToCurrentCanvas() {
  const palette = activePalette.value
  const text = String(palette.text || '#111111')
  const muted = String(palette.muted || text)

  // 先更新 AI 命名图层配色
  applyPosterPalette(widgetStore.dWidgets as any, palette as any)

  // 再覆盖到当前画布全部文字层（用户诉求：推荐配色要应用到所有文字）
  widgetStore.dWidgets.forEach((widget: any) => {
    if (widget?.type === 'w-text') {
      const bg = String(widget.backgroundColor || '').trim()
      const isSloganLike = String(widget.name || '').includes('slogan')
      const preferred = isSloganLike ? muted : text
      widget.color = bg ? pickReadableTextOn(bg, preferred) : preferred
    }
    if (widget?.type === 'w-qrcode') {
      widget.dotColor = text
      widget.dotColor2 = text
    }
  })
}

function getCanvasTextWidgets() {
  return [...widgetStore.dWidgets]
    .filter((item: any) => item?.type === 'w-text')
    .sort((a: any, b: any) => Number(a.top || 0) - Number(b.top || 0) || Number(a.left || 0) - Number(b.left || 0))
}

function getCanvasImageWidget() {
  const images = [...widgetStore.dWidgets].filter((item: any) => item?.type === 'w-image')
  if (!images.length) return null
  images.sort((a: any, b: any) => Number(b.width || 0) * Number(b.height || 0) - Number(a.width || 0) * Number(a.height || 0))
  return images[0]
}

function estimateWidgetTextHeight(widget: any, width: number) {
  const text = String(widget?.text || '').trim()
  const fontSize = Math.max(12, Number(widget?.fontSize || 22))
  const lineHeightRatio = Math.max(1.1, Number(widget?.lineHeight || 1.4))
  if (!text) return Math.round(fontSize * lineHeightRatio + fontSize * 0.6)
  const cjkCount = (text.match(/[\u3000-\u9FFF\uFF00-\uFFEF]/g) || []).length
  const cjkHeavy = cjkCount >= Math.max(1, text.length * 0.35)
  const avgCharPx = cjkHeavy ? Math.max(fontSize * 0.96, 12) : Math.max(fontSize * 0.58, 10)
  const charsPerLine = Math.max(3, Math.floor(Math.max(1, width) / avgCharPx))
  const lines = Math.max(1, Math.ceil(text.length / charsPerLine))
  return Math.round(fontSize * lineHeightRatio * lines + fontSize * 0.7)
}

function clampRectToPage(rect: { left: number; top: number; width: number; height: number }, pageW: number, pageH: number) {
  const width = Math.max(8, Math.min(pageW, Math.round(rect.width)))
  const height = Math.max(8, Math.min(pageH, Math.round(rect.height)))
  const left = Math.max(0, Math.min(Math.round(rect.left), pageW - width))
  const top = Math.max(0, Math.min(Math.round(rect.top), pageH - height))
  return { left, top, width, height }
}

function applyAbsoluteRelayout(designPlan?: RelayoutResult['designPlan']) {
  const layers = (designPlan as any)?.absoluteLayout?.layers
  if (!Array.isArray(layers) || !layers.length) return false
  const page = pageStore.getDPage()
  const pageW = Number(page.width || 1242)
  const pageH = Number(page.height || 1660)
  const textWidgets = getCanvasTextWidgets()
  const hero = getCanvasImageWidget()
  const qrcode = widgetStore.dWidgets.find((item: any) => item?.type === 'w-qrcode') as any

  const byRole = new Map<string, any>(layers.map((item: any) => [String(item.role || ''), item]))
  const titleWidget = textWidgets[0]
  const sloganWidget = textWidgets[1]
  const bodyWidget = textWidgets[2]
  const ctaWidget = textWidgets.find((w: any) => /cta|button|btn|占位|报名|立即|咨询|抢|预定|预约/i.test(String(w.name || '') + String(w.text || '')))

  const assignText = (widget: any, role: string) => {
    if (!widget) return
    const layer = byRole.get(role)
    if (!layer) return
    const rect = clampRectToPage(layer, pageW, pageH)
    widget.left = rect.left
    widget.top = rect.top
    widget.width = rect.width
    widget.height = rect.height
    if (widget.record) {
      widget.record.width = rect.width
      widget.record.height = rect.height
    }
    if (layer.fontSize && Number.isFinite(Number(layer.fontSize))) {
      widget.fontSize = Math.max(12, Math.round(Number(layer.fontSize)))
    }
    if (['left', 'center', 'right'].includes(String(layer.textAlign || ''))) {
      widget.textAlign = layer.textAlign
      widget.textAlignLast = layer.textAlign
    }
  }

  assignText(titleWidget, 'title')
  assignText(sloganWidget, 'slogan')
  assignText(bodyWidget, 'body')
  assignText(ctaWidget, 'cta')

  if (hero && byRole.get('hero')) {
    const rect = clampRectToPage(byRole.get('hero'), pageW, pageH)
    hero.left = rect.left
    hero.top = rect.top
    hero.width = rect.width
    hero.height = rect.height
    if (hero.record) {
      hero.record.width = rect.width
      hero.record.height = rect.height
    }
  }
  if (qrcode && byRole.get('qrcode')) {
    const rect = clampRectToPage(byRole.get('qrcode'), pageW, pageH)
    qrcode.left = rect.left
    qrcode.top = rect.top
    qrcode.width = rect.width
    qrcode.height = rect.height
    if (qrcode.record) {
      qrcode.record.width = rect.width
      qrcode.record.height = rect.height
    }
  }
  widgetStore.updateDWidgets()
  return true
}

function relayoutCurrentTemplate(designPlan?: RelayoutResult['designPlan']) {
  if (applyAbsoluteRelayout(designPlan)) {
    return true
  }
  const widgets = widgetStore.dWidgets
  if (!widgets.length) return false
  const textWidgets = getCanvasTextWidgets()
  const hero = getCanvasImageWidget()
  if (!textWidgets.length && !hero) return false

  const page = pageStore.getDPage()
  const pageW = Number(page.width || 1242)
  const pageH = Number(page.height || 1660)
  const marginX = Math.round(pageW * 0.08)
  const marginTop = Math.round(pageH * 0.08)
  const gap = Math.max(16, Math.round(pageH * 0.024))
  const textGap = Math.max(18, Math.round(pageH * 0.028))
  const safeBottom = Math.round(pageH * 0.08)
  const layout = String(designPlan?.layoutFamily || 'hero-left')

  let textLeft = marginX
  let textWidth = Math.round(pageW * 0.44)
  let cursorTop = marginTop
  let contentBottomLimit = pageH - safeBottom
  let ctaWidget: any = null

  if (hero) {
    if (layout === 'split-editorial') {
      hero.left = pageW - marginX - Math.round(pageW * 0.42)
      hero.top = Math.round(pageH * 0.12)
      hero.width = Math.round(pageW * 0.42)
      hero.height = Math.round(pageH * 0.7)
      textWidth = Math.round(pageW * 0.4)
    } else if (layout === 'hero-center' || layout === 'magazine-cover') {
      hero.width = Math.round(pageW * 0.76)
      hero.height = Math.round(pageH * 0.32)
      hero.left = Math.round((pageW - hero.width) / 2)
      hero.top = Math.round(pageH * 0.28)
      textLeft = Math.round((pageW - Math.round(pageW * 0.76)) / 2)
      textWidth = Math.round(pageW * 0.76)
      cursorTop = marginTop
      contentBottomLimit = hero.top - Math.max(24, Math.round(pageH * 0.03))
    } else {
      hero.width = Math.round(pageW * 0.4)
      hero.height = Math.round(pageH * 0.46)
      hero.left = pageW - marginX - hero.width
      hero.top = Math.round(pageH * 0.22)
      textWidth = Math.round(pageW * 0.42)
      contentBottomLimit = hero.top + hero.height - Math.max(60, Math.round(pageH * 0.08))
    }
  } else {
    textWidth = Math.round(pageW * 0.82)
    textLeft = Math.round((pageW - textWidth) / 2)
  }

  const rankedTexts = textWidgets.map((w: any, idx: number) => ({ w, idx }))
  const ctaIdx = rankedTexts.findIndex(({ w }) => /cta|button|btn|占位|报名|立即|咨询|抢|预定|预约/i.test(String(w.name || '') + String(w.text || '')))
  if (ctaIdx >= 0) {
    ctaWidget = rankedTexts.splice(ctaIdx, 1)[0].w
  }

  const availableTextHeight = Math.max(160, contentBottomLimit - cursorTop)
  const rawHeights = rankedTexts.map(({ w, idx }) => {
    const maxW = idx === 0 ? textWidth : Math.round(textWidth * 0.96)
    const estimated = estimateWidgetTextHeight(w, maxW)
    const extra = idx === 0 ? Math.round(pageH * 0.02) : 0
    return Math.max(Number(w.height || 36), estimated + extra)
  })
  const totalHeight = rawHeights.reduce((sum, h) => sum + h, 0) + Math.max(0, rankedTexts.length - 1) * textGap
  const scale = totalHeight > availableTextHeight ? availableTextHeight / totalHeight : 1

  rankedTexts.forEach(({ w, idx }, order) => {
    const maxW = idx === 0 ? textWidth : Math.round(textWidth * 0.96)
    const baseH = rawHeights[order]
    const nextH = Math.max(idx === 0 ? 56 : 34, Math.round(baseH * scale))
    w.left = textLeft
    w.top = cursorTop
    w.width = maxW
    w.height = nextH
    if (w.record) {
      w.record.width = maxW
      w.record.height = nextH
    }
    if (layout === 'hero-center' || layout === 'magazine-cover') {
      w.textAlign = 'center'
      w.textAlignLast = 'center'
    } else {
      w.textAlign = 'left'
      w.textAlignLast = 'left'
    }
    cursorTop += nextH + textGap
  })

  if (ctaWidget) {
    const ctaWidth = Math.min(Math.round(pageW * 0.38), Math.max(Math.round(pageW * 0.18), Number(ctaWidget.width || 180)))
    const ctaHeight = Math.max(42, Math.round(Number(ctaWidget.fontSize || 22) * 2.1))
    ctaWidget.width = ctaWidth
    ctaWidget.height = ctaHeight
    ctaWidget.top = Math.min(
      pageH - safeBottom - ctaHeight,
      Math.max(cursorTop + Math.round(pageH * 0.01), contentBottomLimit - ctaHeight),
    )
    ctaWidget.left = layout === 'hero-center' || layout === 'magazine-cover'
      ? Math.round((pageW - ctaWidth) / 2)
      : textLeft
    ctaWidget.textAlign = 'center'
    ctaWidget.textAlignLast = 'center'
    if (ctaWidget.record) {
      ctaWidget.record.width = ctaWidth
      ctaWidget.record.height = ctaHeight
    }
  }

  widgetStore.updateDWidgets()
  return true
}

function applyCopyToCurrentCanvas(copy: Pick<PosterGenerateResult, 'title' | 'slogan' | 'body' | 'cta'>, mode: PosterGenerationMode = 'quality') {
  if (ensurePosterWidgets() && lastPosterResult.value) {
    const merged = {
      ...lastPosterResult.value,
      title: copy.title,
      slogan: copy.slogan,
      body: copy.body,
      cta: copy.cta,
      palette: activePalette.value,
    } as PosterGenerateResult
    lastPosterResult.value = merged
    const layout = buildPosterLayout({ input: getPayload(mode), result: merged })
    applyGeneratedLayoutToCanvas(layout)
    return true
  }
  if (ensurePosterWidgets()) {
    replacePosterTexts(widgetStore.dWidgets, getPayload(mode), {
      title: copy.title,
      slogan: copy.slogan,
      body: copy.body,
      cta: copy.cta,
      palette: activePalette.value,
    } as any)
    return true
  }
  const texts = getCanvasTextWidgets()
  if (!texts.length) return false
  const mapped = [copy.title, copy.slogan, copy.body, copy.cta].filter((t) => String(t || '').trim().length > 0)
  texts.slice(0, mapped.length).forEach((w: any, idx: number) => {
    w.text = mapped[idx]
  })
  return true
}

async function replaceTextOnly() {
  if (!assertAiLogin()) return
  if (!hasCanvasContent()) {
    ElMessage.warning('当前画布为空，请先添加一个模板或元素。')
    return
  }
  loading.replaceText = true
  let success = false
  emitAiPosterLoading('start', { action: 'copy', mode: activeRefineMode.value })
  try {
    const mode = activeRefineMode.value
    const before = {
      title: result.title,
      slogan: result.slogan,
      body: result.body,
      cta: result.cta,
    }
    const copyRes = await requestAi<CopyGenerateResult>('ai/poster/copy', getPayload(mode), getPosterTimeout(mode, 'copy'))
    syncResult(copyRes as Pick<PosterGenerateResult, 'title' | 'slogan' | 'body' | 'cta'>)
    const applied = applyCopyToCurrentCanvas({
      title: result.title,
      slogan: result.slogan,
      body: result.body,
      cta: result.cta,
    }, mode)
    if (!applied) {
      ElMessage.warning('当前画布没有可替换的文字图层。')
      return
    }
    widgetStore.updateDWidgets()
    providerTip.value = formatProviderMeta(copyRes.providerMeta)
    const changed =
      before.title !== result.title ||
      before.slogan !== result.slogan ||
      before.body !== result.body ||
      before.cta !== result.cta
    success = true
    ElMessage.success(changed ? `${getModeLabel(mode)}模型已替换文案。` : `${getModeLabel(mode)}模型已重新应用文案（本次推荐与上次相同）。`)
  } catch (error) {
    console.error(error)
    notifyFriendlyError('换字失败', error)
  } finally {
    loading.replaceText = false
    emitAiPosterLoading('finish', { action: 'copy', mode: activeRefineMode.value, success })
  }
}

async function replaceHeroOnly() {
  if (!assertAiLogin()) return
  if (!hasCanvasContent()) {
    ElMessage.warning('当前画布为空，请先添加一个模板或元素。')
    return
  }
  loading.image = true
  let success = false
  emitAiPosterLoading('start', { action: 'image', mode: activeRefineMode.value })
  try {
    const mode = activeRefineMode.value
    const payload = getPayload(mode)
    let heroUrl = ''
    let providerMessage = ''
    if (String(payload.sourceImageUrl || '').trim()) {
      const imageRes = await requestAi<ReplaceImageResult>('ai/poster/replace-image', payload, getPosterTimeout(mode, 'image'))
      heroUrl = normalizeLoopbackMediaUrl(imageRes.hero?.imageUrl || '') || ''
      providerMessage = formatProviderMeta(imageRes.providerMeta)
    } else {
      const poster = normalizePosterMedia(
        await requestAi<PosterGenerateResult>(
          'ai/poster/generate',
          {
            ...payload,
            generateHeroImage: true,
            generateBackgroundImage: false,
          },
          getPosterTimeout(mode, 'image'),
        ),
      )
      heroUrl = normalizeLoopbackMediaUrl(poster.hero?.imageUrl || '') || ''
      providerMessage = formatProviderMeta(poster.providerMeta?.image || poster.providerMeta?.generate)
      if (lastPosterResult.value) {
        lastPosterResult.value = {
          ...lastPosterResult.value,
          hero: poster.hero,
          providerMeta: {
            ...(lastPosterResult.value.providerMeta || {}),
            ...(poster.providerMeta || {}),
          },
        } as PosterGenerateResult
      }
    }
    if (!heroUrl) {
      throw new Error('AI 未返回新的主图，请重试')
    }
    if (ensurePosterWidgets()) {
      const page = pageStore.getDPage() as any
      replaceHeroImage(widgetStore.dWidgets, heroUrl, {
        width: Number(page?.width || 0),
        height: Number(page?.height || 0),
      })
    } else {
      const target = getCanvasImageWidget()
      if (!target) {
        ElMessage.warning('当前画布没有可替换的图片图层。')
        return
      }
      ;(target as any).imgUrl = heroUrl
    }
    widgetStore.updateDWidgets()
    providerTip.value = providerMessage
    success = true
    ElMessage.success(`${getModeLabel(mode)}模型已更新主图。`)
  } catch (error) {
    console.error(error)
    notifyFriendlyError('换图失败', error)
  } finally {
    loading.image = false
    emitAiPosterLoading('finish', { action: 'image', mode: activeRefineMode.value, success })
  }
}

async function relayoutLayout() {
  if (!assertAiLogin()) return
  if (!hasCanvasContent()) {
    ElMessage.warning('当前画布为空，请先添加一个模板或元素。')
    return
  }
  loading.relayout = true
  let success = false
  emitAiPosterLoading('start', { action: 'relayout', mode: activeRefineMode.value })
  try {
    const mode = activeRefineMode.value
    const relayout = await requestAi<RelayoutResult>('ai/poster/relayout', getPayload(mode), getPosterTimeout(mode, 'relayout'))
    if (!lastPosterResult.value) {
      const applied = relayoutCurrentTemplate(relayout.designPlan)
      providerTip.value = formatProviderMeta(relayout.providerMeta)
      success = applied
      ElMessage.success(applied ? `${getModeLabel(mode)}模型已完成智能排版（模板模式）。` : '当前模板缺少可重排元素。')
      return
    }
    const merged = {
      ...lastPosterResult.value,
      designPlan: relayout.designPlan,
      palette: currentPalette.value,
      title: result.title,
      slogan: result.slogan,
      body: result.body,
      cta: result.cta,
    } as PosterGenerateResult
    lastPosterResult.value = merged
    const layout = buildPosterLayout({ input: getPayload(mode), result: merged })
    applyGeneratedLayoutToCanvas(layout)
    providerTip.value = formatProviderMeta(relayout.providerMeta)
    success = true
    ElMessage.success(`${getModeLabel(mode)}模型已完成智能排版。`)
  } catch (error) {
    console.error(error)
    notifyFriendlyError('智能排版失败', error)
  } finally {
    loading.relayout = false
    emitAiPosterLoading('finish', { action: 'relayout', mode: activeRefineMode.value, success })
  }
}

function adaptCanvasSize(silent = false) {
  const activeSize = sizePresets.find((item) => item.key === form.sizeKey) || sizePresets[0]
  const previousPage = pageStore.getDPage()
  if (Number(previousPage.width || 0) === Number(activeSize.width) && Number(previousPage.height || 0) === Number(activeSize.height)) {
    return
  }
  pageStore.setDPage({
    ...previousPage,
    width: activeSize.width,
    height: activeSize.height,
  } as any)
  widgetStore.autoResizeAll({
    width: previousPage.width,
    height: previousPage.height,
  })
  if (!silent) {
    ElMessage.success('尺寸已自动适配。')
  }
}

defineExpose({ open })

onMounted(() => {
  restorePersistedPosterForm()
  void maybeAutoGenerateFromWelcome()
})

watch(
  () => route.fullPath,
  () => {
    void maybeAutoGenerateFromWelcome()
  },
)

watch(
  () => ({
    presetKey: form.presetKey,
    theme: form.theme,
    purpose: form.purpose,
    industry: form.industry,
    style: form.style,
    sizeKey: form.sizeKey,
    qrUrl: form.qrUrl,
    content: form.content,
  }),
  () => {
    persistPosterForm()
  },
  { deep: true },
)
</script>

<style lang="less" scoped>
.assistant {
  --ai-poster-accent: #976dfd;
  --ai-poster-accent-strong: #8757fb;
  --ai-poster-accent-soft: #f4efff;
  --ai-poster-accent-soft-2: #ede4ff;
  --ai-poster-accent-border: #d7c6ff;
  --ai-poster-accent-shadow: rgba(151, 109, 253, 0.18);
  --ai-poster-accent-shadow-strong: rgba(151, 109, 253, 0.26);
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
    padding: 0 4px 10px 0;
  scrollbar-width: none;
  color: #0f172a;

  &::-webkit-scrollbar {
    width: 0;
    height: 0;
    display: none;
  }

  .assistant-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 4px;
  }

  .assistant-title {
    font-size: 16px;
    font-weight: 700;
    line-height: 1.2;
  }

  .header-action {
    padding: 0 2px 0 6px;
    color: #3b82f6;
    min-height: 30px;
    font-size: 12px;
    font-weight: 600;
  }

  .section {
    margin-bottom: 6px;
    padding: 7px 9px;
    border: 1px solid #edf2f7;
    border-radius: 12px;
    background: linear-gradient(180deg, #ffffff 0%, #fbfcff 100%);
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.035);
  }

  .section-title {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 3px;
    font-size: 13px;
    font-weight: 600;
    color: #1f2937;
  }
  .section-title :deep(.el-icon) {
    color: #2563eb;
  }

  .candidate-tip {
    margin-bottom: 8px;
    font-size: 12px;
    line-height: 1.5;
    color: #475569;
  }

  .hero-candidate-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .hero-candidate-card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 6px;
    border: 1px solid #dbe4f0;
    border-radius: 8px;
    background: #fff;
    text-align: left;
    cursor: pointer;
  }

  .hero-candidate-card.active {
    border-color: #7c3aed;
    box-shadow: 0 0 0 1px rgba(124, 58, 237, 0.18);
  }

  .hero-candidate-card.recommended {
    background: linear-gradient(180deg, #ffffff 0%, #faf5ff 100%);
  }

  .hero-candidate-badge {
    position: absolute;
    top: 8px;
    right: 8px;
    padding: 1px 6px;
    border-radius: 999px;
    background: rgba(124, 58, 237, 0.92);
    color: #fff;
    font-size: 11px;
    line-height: 18px;
  }

  .hero-candidate-image {
    width: 100%;
    aspect-ratio: 1 / 1;
    border-radius: 6px;
    object-fit: cover;
    background: #f3f4f6;
  }

  .hero-candidate-score {
    font-size: 12px;
    font-weight: 700;
    color: #111827;
  }

  .hero-candidate-breakdown {
    font-size: 11px;
    line-height: 1.45;
    color: #64748b;
  }

  .candidate-actions {
    margin-top: 10px;
  }

  .candidate-apply-btn {
    width: 100%;
  }

  .provider-tip {
    white-space: pre-line;
    font-size: 12px;
    line-height: 1.55;
    color: #334155;
  }

  .qa-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin-top: 8px;
  }

  .qa-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px 8px;
    border-radius: 8px;
    background: #f8fafc;
  }

  .qa-label {
    font-size: 11px;
    color: #64748b;
  }

  .qa-value {
    font-size: 12px;
    line-height: 1.45;
    color: #0f172a;
    word-break: break-word;
  }

  .strategy-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin-top: 10px;
  }

  .strategy-chip {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 9px 10px;
    border: 1px solid rgba(37, 99, 235, 0.12);
    border-radius: 10px;
    background: #fff;
  }

  .strategy-chip__label {
    font-size: 11px;
    color: #64748b;
  }

  .strategy-chip__value {
    font-size: 12px;
    line-height: 1.4;
    color: #111827;
    font-weight: 600;
  }

  .recommend-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin-top: 10px;
  }

  .recommend-card {
    padding: 10px;
    border-radius: 10px;
    border: 1px solid rgba(15, 23, 42, 0.08);
    background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
  }

  .recommend-card__head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  .recommend-card__family {
    font-size: 11px;
    font-weight: 700;
    color: #2563eb;
  }

  .recommend-card__score {
    font-size: 11px;
    color: #475569;
  }

  .recommend-card__title {
    font-size: 12px;
    line-height: 1.45;
    color: #111827;
    font-weight: 600;
  }

  .recommend-card__reason {
    margin-top: 6px;
    font-size: 11px;
    line-height: 1.45;
    color: #64748b;
  }

  .preset-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }

  .preset-card {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 10px;
    min-height: 38px;
    text-align: center;
    cursor: pointer;
    border: 1px solid #dbe4f0;
    border-radius: 999px;
    background: linear-gradient(180deg, #ffffff 0%, #f7faff 100%);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
    transition: all 0.18s ease, transform 0.18s ease;
  }

  .preset-card:hover,
  .preset-card.active {
    border-color: var(--ai-poster-accent);
    background: linear-gradient(180deg, var(--ai-poster-accent-soft) 0%, #ffffff 100%);
    box-shadow: 0 6px 18px var(--ai-poster-accent-shadow), 0 0 0 2px rgba(151, 109, 253, 0.12);
    transform: translateY(-1px);
  }

  .preset-name {
    display: block;
    font-size: 12px;
    line-height: 1;
    font-weight: 700;
    color: #1f2937;
    letter-spacing: 0;
  }

  .generate-switches {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 5px;
  }

  .generate-switch-card {
    display: block;
    border: 1px solid #d6e2f2;
    border-radius: 12px;
    background: linear-gradient(180deg, #fcfdff 0%, #f4f7fb 100%);
    padding: 8px 9px;
    cursor: pointer;
    transition: all 0.18s ease;
  }

  .generate-switch-card.active {
    border-color: var(--ai-poster-accent);
    box-shadow: 0 0 0 2px rgba(151, 109, 253, 0.14);
    background: linear-gradient(180deg, #f5efff 0%, #efe6ff 100%);
  }

  .generate-switch-main {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .generate-switch-title {
    display: inline-flex;
    align-items: center;
    min-height: 22px;
    font-size: 13px;
    font-weight: 600;
    color: #0f172a;
  }

  .actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .debug-provider {
    white-space: pre-line;
    font-size: 11px;
    line-height: 1.5;
    color: #475569;
    margin-bottom: 8px;
  }

  .debug-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 8px;
  }

  .debug-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-height: 24px;
    padding: 0 8px;
    border-radius: 999px;
    background: #eff6ff;
    color: #1e3a5f;
    font-size: 10px;
    line-height: 1;
  }

  .debug-layout-list {
    display: grid;
    gap: 6px;
  }

  .debug-layout-item {
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 7px 8px;
    background: #f8fbff;
  }

  .debug-layout-role {
    font-size: 11px;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 4px;
  }

  .debug-layout-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    font-size: 10px;
    color: #64748b;
    line-height: 1.4;
  }

  .ai-action-card {
    margin-left: 0;
  }

  .ai-action-card :deep(.el-button) {
    margin-left: 0;
  }

  .ai-action-card__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 32px;
    width: 32px;
    height: 32px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.72);
    color: inherit;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
  }

  .ai-action-card__content {
    display: flex;
    min-width: 0;
    flex: 1;
    overflow: hidden;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: 2px;
    text-align: left;
  }

  .ai-action-card__content.is-loading {
    justify-content: center;
  }

  .ai-action-card__title {
    display: block;
    width: 100%;
    overflow: hidden;
    color: inherit;
    font-size: 13px;
    font-weight: 700;
    line-height: 1.3;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ai-action-card__meta {
    display: block;
    width: 100%;
    overflow: hidden;
    color: inherit;
    font-size: 11px;
    font-weight: 500;
    line-height: 1.2;
    opacity: 0.78;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ai-action-card__cost {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    min-width: 0;
    padding: 0 6px;
    height: 20px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.88);
    color: #6a43c7;
    font-size: 9px;
    font-weight: 700;
    line-height: 1;
    white-space: nowrap;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95);
  }

  .refine-mode-panel {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin: 2px 0 8px;
    padding: 8px 10px;
    border: 1px solid #d9e2f2;
    border-radius: 12px;
    background: #ffffff;
    box-shadow: 0 6px 16px rgba(15, 23, 42, 0.04);
  }

  .refine-mode-label {
    font-size: 12px;
    font-weight: 700;
    color: #111827;
    white-space: nowrap;
  }

  .refine-mode-toggle {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
    flex: 1;
  }

  .refine-mode-chip {
    min-height: 32px;
    padding: 0 10px;
    border: 1px solid #d6deea;
    border-radius: 10px;
    background: #ffffff;
    color: #111827;
    font-size: 12px;
    font-weight: 700;
    line-height: 1;
    transition: all 0.18s ease;
  }

  .refine-mode-chip.active {
    border-color: #976dfd;
    background: #ffffff;
    color: #111827;
    box-shadow: 0 0 0 2px rgba(151, 109, 253, 0.12);
  }

  .generate-mode-panel {
    margin: 2px 0 8px;
  }

  .generate-mode-title {
    margin: 0 0 6px 2px;
    font-size: 13px;
    line-height: 1.2;
    font-weight: 600;
    color: #1f2937;
  }

  .ai-action-card--header:deep(.el-button),
  .actions :deep(.el-button),
  .primary-actions :deep(.el-button) {
    display: inline-flex;
    align-items: center;
    justify-content: flex-start;
    gap: 8px;
    width: 100%;
    min-height: 42px;
    padding: 6px 10px;
    font-size: 12px;
    font-weight: 700;
    line-height: 1.25;
    white-space: nowrap;
    overflow: hidden;
    border: 1px solid #d7deea;
    color: #111827;
    background: #ffffff;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);
  }

  .primary-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .primary-generate {
    width: 100%;
    min-height: 42px;
    padding: 6px 10px;
    font-size: 11px;
    font-weight: 700;
    border-radius: 12px;
    line-height: 1.25;
  }

  .primary-actions :deep(.el-button) {
    margin-left: 0;
  }

  .primary-actions :deep(.el-button + .el-button) {
    margin-left: 0;
  }

  .primary-actions :deep(.ai-action-card--quality),
  .primary-actions :deep(.ai-action-card--fast) {
    background: linear-gradient(135deg, #a17bfd 0%, #976dfd 58%, #8757fb 100%);
    border-color: #8b63ef;
    color: #ffffff;
    box-shadow: 0 14px 30px rgba(151, 109, 253, 0.28);
  }

  .primary-actions :deep(.ai-action-card--quality .ai-action-card__icon),
  .primary-actions :deep(.ai-action-card--fast .ai-action-card__icon) {
    background: transparent;
    color: inherit;
    box-shadow: none;
  }

  .primary-actions :deep(.ai-action-card--quality .ai-action-card__cost),
  .primary-actions :deep(.ai-action-card--fast .ai-action-card__cost) {
    background: transparent;
    color: rgba(255, 255, 255, 0.86);
    box-shadow: none;
  }

  .primary-actions :deep(.ai-action-card--quality .ai-action-card__title),
  .primary-actions :deep(.ai-action-card--fast .ai-action-card__title) {
    color: inherit;
  }

  .ai-action-card--header:deep(.el-button + .el-button),
  .actions :deep(.el-button + .el-button) {
    margin-left: 0;
  }

  .primary-actions :deep(.el-button .el-icon),
  .actions :deep(.el-button .el-icon) {
    font-size: 13px;
    opacity: 0.92;
  }

  .primary-actions :deep(.el-button span),
  .actions :deep(.el-button span) {
    letter-spacing: 0;
  }

  .ai-action-card--header:deep(.el-button) {
    min-height: 44px;
    padding-right: 10px;
  }

  .primary-actions :deep(.el-button:hover),
  .actions :deep(.el-button:hover),
  .ai-action-card--header:deep(.el-button:hover) {
    border-color: #976dfd;
    box-shadow: 0 8px 18px rgba(151, 109, 253, 0.16);
    filter: saturate(1.01);
  }

  .primary-actions :deep(.ai-action-card--quality:hover),
  .primary-actions :deep(.ai-action-card--fast:hover) {
    border-color: #7f52f7;
    box-shadow: 0 16px 34px rgba(151, 109, 253, 0.34);
    filter: saturate(1.03);
  }

  .ai-action-card--secondary:deep(.el-button) {
    min-height: 52px;
    color: #111827;
    background: #ffffff;
    border-color: #d7deea;
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);
  }

  .ai-action-card--secondary .ai-action-card__icon {
    background: #f5f7fb;
    color: #111827;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.96);
  }

  .ai-action-card--secondary .ai-action-card__cost {
    background: #f5f7fb;
    color: #111827;
    box-shadow: none;
  }

  .ai-action-card--secondary :deep(.el-button.is-loading),
  .ai-action-card--header :deep(.el-button.is-loading),
  .primary-actions :deep(.el-button.is-loading) {
    opacity: 0.92;
  }

  .compact-form :deep(.el-form-item) {
    margin-bottom: 2px;
  }

  .compact-form :deep(.el-form-item__label) {
    padding-bottom: 2px;
    font-size: 10px;
    font-weight: 600;
    color: #475569;
  }

  .compact-form :deep(.el-input__wrapper),
  .compact-form :deep(.el-select__wrapper) {
    min-height: 28px;
  }

  .size-select-item {
    margin-top: 2px;
  }

  .size-select :deep(.el-select__wrapper) {
    min-height: 24px;
    padding: 0 8px;
    border-radius: 9px;
  }

  .size-select :deep(.el-select__selected-item),
  .size-select :deep(.el-select__placeholder) {
    font-size: 11px;
    font-weight: 600;
    line-height: 1.1;
  }

  .size-select :deep(.el-select__caret) {
    font-size: 11px;
  }

  .compact-form :deep(.el-textarea__inner) {
    min-height: 48px !important;
    padding-top: 5px;
    padding-bottom: 5px;
  }

  .generate-switch-card :deep(.el-checkbox) {
    margin-top: 0;
  }

  .generate-switch-card :deep(.el-checkbox__label) {
    display: none;
  }

  @media (max-width: 460px) {
    .assistant-head {
      flex-direction: column;
      align-items: stretch;
    }

    .preset-grid,
    .actions,
    .generate-switches,
    .primary-actions {
      grid-template-columns: minmax(0, 1fr);
    }

    .ai-action-card__meta {
      white-space: normal;
    }
  }
}
</style>
