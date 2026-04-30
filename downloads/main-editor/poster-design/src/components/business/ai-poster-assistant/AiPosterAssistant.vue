<template>
  <div class="assistant">
    <div class="assistant-head">
      <div>
        <div class="assistant-title">AI 海报</div>
      </div>
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

        <el-form-item>
          <template #label>
            <span class="field-label-with-tip">
              <span>补充描述</span>
              <span class="field-label-tip">越详细生成效果越好</span>
            </span>
          </template>
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
            <span class="ai-action-card__title">{{ loading.generate && activeGenerateMode === action.mode ? '正在生成' : action.title }}</span>
          </span>
          <span v-show="!(loading.generate && activeGenerateMode === action.mode)" class="ai-action-card__cost">{{ action.costText }}</span>
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
            <span class="ai-action-card__title">{{ loading[action.loadingKey] ? '正在处理' : action.title }}</span>
          </span>
          <span v-show="!loading[action.loadingKey]" class="ai-action-card__cost">{{ action.costText }}</span>
        </el-button>
      </div>
    </div>

    <KunbiRechargeModal
      v-model="rechargeVisible"
      :balance="kunbiBalance"
      :packages="rechargePackages"
      :api-config="rechargeApiConfig"
      @pay="handleRechargePay"
      @history="handleRechargeHistory"
    />

    <el-dialog v-model="wechatPayVisible" width="360px" append-to-body destroy-on-close class="ac-pay-dialog">
      <div class="ac-pay-dialog__title">微信扫码支付</div>
      <div class="ac-pay-dialog__desc">请使用微信扫一扫完成支付，支付成功后会自动刷新鲲币余额。</div>
      <div class="ac-pay-dialog__qr-wrap">
        <img v-if="wechatPayQrCode" :src="wechatPayQrCode" alt="微信支付二维码" class="ac-pay-dialog__qr" />
      </div>
      <div class="ac-pay-dialog__meta">
        <span v-if="wechatPayAmountText">{{ wechatPayAmountText }}</span>
        <span v-if="wechatPayKunbiText">到账鲲币：{{ wechatPayKunbiText }}</span>
      </div>
    </el-dialog>

    <el-dialog v-model="alipayPayVisible" width="360px" append-to-body destroy-on-close class="ac-pay-dialog">
      <div class="ac-pay-dialog__title">支付宝支付</div>
      <div class="ac-pay-dialog__desc">请使用支付宝扫一扫完成支付，支付成功后会自动刷新鲲币余额。</div>
      <div class="ac-pay-dialog__qr-wrap ac-pay-dialog__qr-wrap--alipay">
        <img v-if="alipayPayQrCode" :src="alipayPayQrCode" alt="支付宝二维码" class="ac-pay-dialog__qr" />
      </div>
      <div class="ac-pay-dialog__meta">
        <span v-if="alipayPayAmountText">{{ alipayPayAmountText }}</span>
        <span v-if="alipayPayKunbiText">到账鲲币：{{ alipayPayKunbiText }}</span>
      </div>
    </el-dialog>

  </div>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElForm, ElFormItem, ElRow, ElCol, ElSelect, ElOption } from 'element-plus'
import { EditPen, Grid, MagicStick, Picture, Promotion, Tools } from '@element-plus/icons-vue'
import { useCanvasStore, useUserStore, useWidgetStore } from '@/store'
import { normalizeLoopbackMediaUrl } from '@/utils/publicMediaUrl'
import KunbiRechargeModal from '@/components/business/kunbi-recharge/KunbiRechargeModal.vue'
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
import {
  checkRechargeOrderStatus,
  consumeAiToolKunbi,
  createRechargeOrder,
  getKunbiRechargeInfo,
  getUserHome,
  type CreateRechargeOrderParams,
  type KunbiApiConfig,
  type KunbiRechargePackage,
} from '@/api/kunbi'
import { applyPosterPalette, buildPosterLayout, getPosterGradient, getSizePresets, replaceHeroImage, replacePosterTexts } from './posterEngine'
import { formatAiPosterKunbiCost, getAiPosterKunbiPrice, type AiPosterKunbiActionKey } from './kunbiPricing'

type PosterGenerationMode = 'fast' | 'quality'
type PosterLoadingAction = 'generate' | 'copy' | 'image' | 'relayout' | 'recommend'
type VisibleKunbiActionKey = 'generateQuality' | 'optimizeCopyPalette' | 'generateFast' | 'replaceText' | 'replaceHero' | 'relayout'

type LoadingCopyFrame = {
  stage: string
  title: string
  subtitle: string
  status: string
  fun: string
}

type LoadingCopyView = LoadingCopyFrame & {
  badge: string
}

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
const rechargeApiConfig: KunbiApiConfig = {
  baseUrl: '',
  kunbiIcon: '/images/kunbi.png',
}
const kunbiBalance = ref(0)
const rechargePackages = ref<KunbiRechargePackage[]>([])
const rechargeVisible = ref(false)
const wechatPayVisible = ref(false)
const wechatPayQrCode = ref('')
const wechatPayAmountText = ref('')
const wechatPayKunbiText = ref('')
const alipayPayVisible = ref(false)
const alipayPayQrCode = ref('')
const alipayPayAmountText = ref('')
const alipayPayKunbiText = ref('')
let rechargeStatusTimer: ReturnType<typeof setInterval> | null = null
let rechargePollCount = 0
const activeGenerateMode = ref<PosterGenerationMode | ''>('')
const activeRefineMode = ref<PosterGenerationMode>('fast')
const AI_POSTER_LOADING_EVENT = 'ai-poster-loading'

const generateActions = computed(() => [
  {
    mode: 'quality' as PosterGenerationMode,
    title: '高质量',
    meta: '细节和氛围更强，适合直接出成品',
    icon: MagicStick,
    kunbiActionKey: 'generateQuality' as VisibleKunbiActionKey,
    costText: formatAiPosterKunbiCost('generateQuality'),
  },
  {
    mode: 'fast' as PosterGenerationMode,
    title: '快速生成',
    meta: '更快出首版，再继续微调到成片状态',
    icon: Promotion,
    kunbiActionKey: 'generateFast' as VisibleKunbiActionKey,
    costText: formatAiPosterKunbiCost('generateFast'),
  },
])

const refineModeMeta = computed(() =>
  activeRefineMode.value === 'quality'
    ? '高质量模型'
    : '快速模型',
)

const refineActions = computed(() => [
  {
    key: 'recommend',
    title: '优化文案与配色',
    meta: `${refineModeMeta.value}，同步优化文案、CTA 和配色关系`,
    icon: MagicStick,
    handler: recommendCopyAndPalette,
    loadingKey: 'recommend' as const,
    kunbiActionKey: 'optimizeCopyPalette' as VisibleKunbiActionKey,
    costText: formatAiPosterKunbiCost('optimizeCopyPalette'),
  },
  {
    key: 'replaceText',
    title: '换文案',
    meta: `${refineModeMeta.value}，重写标题、卖点和 CTA`,
    icon: EditPen,
    handler: replaceTextOnly,
    loadingKey: 'replaceText' as const,
    kunbiActionKey: 'replaceText' as VisibleKunbiActionKey,
    costText: formatAiPosterKunbiCost('replaceText'),
  },
  {
    key: 'image',
    title: '换主图',
    meta: `${refineModeMeta.value}，强化主体和主视觉冲击`,
    icon: Picture,
    handler: replaceHeroOnly,
    loadingKey: 'image' as const,
    kunbiActionKey: 'replaceHero' as VisibleKunbiActionKey,
    costText: formatAiPosterKunbiCost('replaceHero'),
  },
  {
    key: 'relayout',
    title: '重排版',
    meta: `${refineModeMeta.value}，优化标题层级和可读性`,
    icon: Tools,
    handler: relayoutLayout,
    loadingKey: 'relayout' as const,
    kunbiActionKey: 'relayout' as VisibleKunbiActionKey,
    costText: formatAiPosterKunbiCost('relayout'),
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
const loadingSession = reactive({
  action: '' as PosterLoadingAction | '',
  mode: 'quality' as PosterGenerationMode,
  stepIndex: 0,
  progress: 0,
})
let loadingCopyTimer: ReturnType<typeof setInterval> | null = null

function inferLoadingIndustryBucket(industry: string) {
  const text = String(industry || '').trim()
  if (/餐饮|美食|咖啡|茶饮/.test(text)) return '餐饮'
  if (/招聘|招募|人力/.test(text)) return '招聘'
  if (/课程|教育|培训/.test(text)) return '课程'
  if (/电商|零售|商品|促销/.test(text)) return '电商'
  return '通用'
}

function getLoadingFlavor(action: PosterLoadingAction, industry: string, index: number) {
  const bucket = inferLoadingIndustryBucket(industry)
  const groups: Record<string, string[]> = {
    餐饮: [
      '先把食欲拉起来，再让标题站稳。',
      '这口画面正在努力变得更想下单。',
      '主图在变香，卖点在排队上场。',
    ],
    招聘: [
      '先把岗位说清，再把吸引力提上来。',
      '正在压缩废话，保留真正打动人的点。',
      '让福利更醒目，让投递更顺手。',
    ],
    课程: [
      '先讲结果，再讲适合谁。',
      '正在把报名理由往更前面放。',
      '少一点套话，多一点行动理由。',
    ],
    电商: [
      '正在让卖点更清楚，按钮更想点。',
      '先突出核心利益，再安排价格权益。',
      '这张图正在努力变得更会卖。',
    ],
    通用: [
      '先让信息站稳，再让画面出彩。',
      '这次不想只出图，想直接出成片。',
      '正在帮你避开字压图和信息打架。',
    ],
  }
  const actionLead: Record<PosterLoadingAction, string> = {
    generate: '主图、标题和 CTA 先商量一下。',
    recommend: '先把文案和颜色关系理顺。',
    copy: '正在把长句拧成更利落的海报话。',
    image: '先给主图留呼吸感，再考虑冲击力。',
    relayout: '先把层级摆正，再把留白疏通。',
  }
  const pool = groups[bucket] || groups.通用
  return `${pool[index % pool.length]}${actionLead[action]}`
}

function getLoadingStepLabels(action: PosterLoadingAction, mode: PosterGenerationMode) {
  const steps: Record<PosterLoadingAction, string[]> = {
    generate: mode === 'quality'
      ? ['理解需求', '筛主图', '看安全区', '打磨版式', '检查成片']
      : ['理解需求', '出主图', '挑主图', '压文案', '查成片'],
    recommend: ['理文案', '配颜色'],
    copy: ['压标题', '修卖点'],
    image: ['做主图', '避标题'],
    relayout: ['调层级', '疏留白'],
  }
  return steps[action] || ['处理中']
}

function buildLoadingFrames(action: PosterLoadingAction, mode: PosterGenerationMode, industry: string): LoadingCopyFrame[] {
  const framesByAction: Record<PosterLoadingAction, LoadingCopyFrame[]> = {
    generate: mode === 'quality'
      ? [
          { stage: '步骤 1/5', title: '先铺一层灵感底稿', subtitle: '先确认这张海报最该先讲什么。', status: '理解需求中', fun: getLoadingFlavor(action, industry, 0) },
          { stage: '步骤 2/5', title: '给主图多留几个稳选择', subtitle: '正在生成更适合排字的候选画面。', status: '候选主图生成中', fun: getLoadingFlavor(action, industry, 1) },
          { stage: '步骤 3/5', title: '让标题和画面先错开', subtitle: '正在比较安全区、留白和主体位置。', status: '安全区比较中', fun: getLoadingFlavor(action, industry, 2) },
          { stage: '步骤 4/5', title: '把版式往顺眼的方向推', subtitle: '标题、卖点和 CTA 正在重新站位。', status: '版式打磨中', fun: getLoadingFlavor(action, industry, 3) },
          { stage: '步骤 5/5', title: '最后收一遍成片感', subtitle: '再看一次焦点、留白和整体节奏。', status: '成片检查中', fun: getLoadingFlavor(action, industry, 4) },
        ]
      : [
          { stage: '步骤 1/5', title: '先抓住这张海报的重心', subtitle: '先找出最该先突出的利益点。', status: '理解需求中', fun: getLoadingFlavor(action, industry, 0) },
          { stage: '步骤 2/5', title: '先出一张更稳的主视觉', subtitle: '正在优先做适合直接出片的画面。', status: '主视觉生成中', fun: getLoadingFlavor(action, industry, 1) },
          { stage: '步骤 3/5', title: '自动挑更顺手的主图', subtitle: '正在比较留白、清晰度和构图。', status: '主图择优中', fun: getLoadingFlavor(action, industry, 2) },
          { stage: '步骤 4/5', title: '让文字先利落下来', subtitle: '先减拥挤感，再把信息说准。', status: '标题卖点压缩中', fun: getLoadingFlavor(action, industry, 3) },
          { stage: '步骤 5/5', title: '最后确认成片是不是顺', subtitle: '再检查一次版式和阅读节奏。', status: '成片检查中', fun: getLoadingFlavor(action, industry, 4) },
        ],
    recommend: [
      { stage: '步骤 1/2', title: '先把话说得更利落', subtitle: '先收紧标题、卖点和 CTA。', status: '文案提炼中', fun: getLoadingFlavor(action, industry, 0) },
      { stage: '步骤 2/2', title: '再把颜色关系理顺', subtitle: '给这张海报换一套更顺眼的配色。', status: '配色整理中', fun: getLoadingFlavor(action, industry, 1) },
    ],
    copy: [
      { stage: '步骤 1/2', title: '先把标题压短一点', subtitle: '先把一句话说短，也说清。', status: '标题压缩中', fun: getLoadingFlavor(action, industry, 0) },
      { stage: '步骤 2/2', title: '把该留的卖点挑出来', subtitle: '再保留真正值得上版的信息。', status: '卖点精修中', fun: getLoadingFlavor(action, industry, 1) },
    ],
    image: [
      { stage: '步骤 1/2', title: '先把主图重新拉顺', subtitle: '先保住主体，再让画面更能排字。', status: '主图重做中', fun: getLoadingFlavor(action, industry, 0) },
      { stage: '步骤 2/2', title: '给标题和按钮留出呼吸位', subtitle: '正在给标题区和 CTA 区找更干净的位置。', status: '标题区避让中', fun: getLoadingFlavor(action, industry, 1) },
    ],
    relayout: [
      { stage: '步骤 1/2', title: '先把层级摆正', subtitle: '先让标题、副标题和 CTA 分出主次。', status: '层级调整中', fun: getLoadingFlavor(action, industry, 0) },
      { stage: '步骤 2/2', title: '再把留白疏通开', subtitle: '正在减少拥挤感，让阅读更顺。', status: '留白整理中', fun: getLoadingFlavor(action, industry, 1) },
    ],
  }
  return framesByAction[action] || []
}

const activeLoadingContext = computed<null | { action: PosterLoadingAction; mode: PosterGenerationMode }>(() => {
  if (loading.generate) return { action: 'generate', mode: activeGenerateMode.value === 'quality' ? 'quality' : 'fast' }
  if (loading.recommend) return { action: 'recommend', mode: activeRefineMode.value }
  if (loading.replaceText) return { action: 'copy', mode: activeRefineMode.value }
  if (loading.image) return { action: 'image', mode: activeRefineMode.value }
  if (loading.relayout) return { action: 'relayout', mode: activeRefineMode.value }
  return null
})

const currentLoadingCopy = computed<LoadingCopyView | null>(() => {
  const context = activeLoadingContext.value
  if (!context) return null
  const frames = buildLoadingFrames(context.action, context.mode, form.industry)
  if (!frames.length) return null
  const safeIndex = Math.max(0, Math.min(loadingSession.stepIndex, frames.length - 1))
  const frame = frames[safeIndex]
  return {
    ...frame,
    badge: context.mode === 'quality' ? '高质量生成' : context.action === 'generate' ? '快速生成' : '快捷微调',
  }
})

const loadingStepItems = computed(() => {
  const context = activeLoadingContext.value
  if (!context) return []
  return getLoadingStepLabels(context.action, context.mode)
})

const currentLoadingStepIndex = computed(() => {
  return Math.max(0, loadingSession.stepIndex)
})

const currentLoadingProgress = computed(() => {
  return Math.max(0, Math.min(100, Math.round(loadingSession.progress)))
})

function getLoadingProgressBase(stepIndex: number, steps: number, action: PosterLoadingAction) {
  const start = action === 'generate' ? 10 : 14
  const end = action === 'generate' ? 86 : 90
  if (steps <= 1) return end
  const ratio = Math.max(0, Math.min(1, stepIndex / Math.max(1, steps - 1)))
  return start + (end - start) * ratio
}

function beginLoadingSession(action: PosterLoadingAction, mode: PosterGenerationMode) {
  loadingSession.action = action
  loadingSession.mode = mode
  loadingSession.stepIndex = 0
  loadingSession.progress = getLoadingProgressBase(0, Math.max(loadingStepItems.value.length, 1), action)
}

function advanceLoadingSession(stepIndex: number) {
  const context = activeLoadingContext.value
  if (!context) return
  const steps = Math.max(loadingStepItems.value.length, 1)
  const safeIndex = Math.max(0, Math.min(stepIndex, steps - 1))
  loadingSession.stepIndex = safeIndex
  loadingSession.progress = Math.max(
    loadingSession.progress,
    getLoadingProgressBase(safeIndex, steps, context.action),
  )
}

function finalizeLoadingSession(success: boolean) {
  loadingSession.progress = success ? 100 : Math.max(0, loadingSession.progress)
}

function startLoadingCopyRotation() {
  if (loadingCopyTimer) return
  loadingCopyTimer = setInterval(() => {
    const context = activeLoadingContext.value
    if (!context) return
    const steps = Math.max(loadingStepItems.value.length, 1)
    const base = getLoadingProgressBase(loadingSession.stepIndex, steps, context.action)
    const nextBase = loadingSession.stepIndex >= steps - 1
      ? (context.action === 'generate' ? 92 : 95)
      : getLoadingProgressBase(loadingSession.stepIndex + 1, steps, context.action)
    const ceiling = Math.max(base + 4, nextBase - 4)
    if (loadingSession.progress < ceiling) {
      loadingSession.progress = Math.min(ceiling, loadingSession.progress + (context.action === 'generate' ? 1.8 : 2.4))
    }
  }, 2600)
}

function stopLoadingCopyRotation() {
  if (!loadingCopyTimer) return
  clearInterval(loadingCopyTimer)
  loadingCopyTimer = null
}

function stopRechargePolling() {
  if (!rechargeStatusTimer) return
  window.clearInterval(rechargeStatusTimer)
  rechargeStatusTimer = null
  rechargePollCount = 0
}

function closeWechatPayDialog() {
  wechatPayVisible.value = false
  wechatPayQrCode.value = ''
  wechatPayAmountText.value = ''
  wechatPayKunbiText.value = ''
}

function closeAlipayPayDialog() {
  alipayPayVisible.value = false
  alipayPayQrCode.value = ''
  alipayPayAmountText.value = ''
  alipayPayKunbiText.value = ''
}

function openWechatPayDialog(payload: { qrCode: string; amount?: string; kunbi?: string }) {
  const qrCode = String(payload.qrCode || '').trim()
  if (!qrCode) return false
  wechatPayAmountText.value = payload.amount || ''
  wechatPayKunbiText.value = payload.kunbi || ''
  wechatPayQrCode.value = qrCode
  wechatPayVisible.value = true
  return true
}

function openAlipayPayDialog(payload: { qrCode: string; amount?: string; kunbi?: string }) {
  const qrCode = String(payload.qrCode || '').trim()
  if (!qrCode) return false
  alipayPayAmountText.value = payload.amount || ''
  alipayPayKunbiText.value = payload.kunbi || ''
  alipayPayQrCode.value = qrCode
  alipayPayVisible.value = true
  return true
}

function openPayTarget(target: string) {
  const url = String(target || '').trim()
  if (!url) return false
  if (/^data:image\//i.test(url)) return false
  window.location.assign(url)
  return true
}

function tryHandleWechatPay(data: Record<string, any>) {
  const qrCode = String(data.qrcode_img_url || data.qr_code_img_url || data.qr_code || '').trim()
  if (!qrCode) return false
  if (!/^data:image\//i.test(qrCode) && !/^https?:\/\//i.test(qrCode)) return false
  return openWechatPayDialog({
    qrCode,
    amount: data.pay_amount != null && String(data.pay_amount).trim() ? `¥${String(data.pay_amount).trim()}` : '',
    kunbi: data.buy_kunbi_count != null && String(data.buy_kunbi_count).trim() ? `${String(data.buy_kunbi_count).trim()} 鲲币` : '',
  })
}

function tryHandleAlipayPay(data: Record<string, any>) {
  const qrCode = String(data.alipay_qr_code || '').trim()
  if (!qrCode) return false
  return openAlipayPayDialog({
    qrCode,
    amount: data.pay_amount != null && String(data.pay_amount).trim() ? `¥${String(data.pay_amount).trim()}` : '',
    kunbi: data.buy_kunbi_count != null && String(data.buy_kunbi_count).trim() ? `${String(data.buy_kunbi_count).trim()} 鲲币` : '',
  })
}

function tryHandlePayData(payData: unknown) {
  if (!payData) return false
  if (typeof payData === 'string') {
    const trimmed = payData.trim()
    if (!trimmed) return false
    if (trimmed.startsWith('<form') || trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) return false
    return openPayTarget(trimmed)
  }
  if (typeof payData !== 'object') return false
  const data = payData as Record<string, any>
  if (tryHandleAlipayPay(data) || tryHandleWechatPay(data)) return true
  const urlKeys = ['pay_url', 'url', 'redirect_url', 'h5_url', 'mweb_url', 'deep_link', 'qr_code']
  for (const key of urlKeys) {
    if (data[key] && openPayTarget(String(data[key]))) {
      return true
    }
  }
  for (const [key, value] of Object.entries(data)) {
    const text = String(value || '').trim()
    if (!text) continue
    if ((key.toLowerCase().includes('url') || key.toLowerCase().includes('link')) && openPayTarget(text)) {
      return true
    }
  }
  return false
}

async function refreshKunbiBalance() {
  if (!userStore.online) return 0
  const data = await getUserHome()
  const balance = Number(data?.my_kunbin_count ?? data?.kunbi_balance ?? data?.kunbi ?? 0)
  kunbiBalance.value = Number.isFinite(balance) ? balance : 0
  return kunbiBalance.value
}

async function loadRechargeInfo(showError = false) {
  if (!userStore.online) return
  try {
    const data = await getKunbiRechargeInfo()
    const balance = Number(data?.kunbi_balance ?? data?.kunbi ?? kunbiBalance.value ?? 0)
    kunbiBalance.value = Number.isFinite(balance) ? balance : 0
    rechargePackages.value = Array.isArray(data?.recharge_packages) ? data.recharge_packages : []
  } catch (error: any) {
    if (showError) {
      ElMessage.error(error?.message || '获取充值信息失败')
    }
  }
}

async function openRechargeCenter() {
  if (!userStore.online) return
  await Promise.allSettled([refreshKunbiBalance(), loadRechargeInfo(true)])
  rechargeVisible.value = true
}

async function handleRechargeHistory() {
  rechargeVisible.value = false
  await router.push('/account')
}

async function startRechargePolling(orderSn: string) {
  stopRechargePolling()
  const poll = async () => {
    rechargePollCount += 1
    try {
      const status = await checkRechargeOrderStatus(orderSn)
      if (Number(status?.pay_status) === 1) {
        stopRechargePolling()
        rechargeVisible.value = false
        closeWechatPayDialog()
        closeAlipayPayDialog()
        await refreshKunbiBalance()
        ElMessage.success('支付成功，鲲币余额已刷新')
        return
      }
    } catch {
      // 轮询期间静默重试
    }
    if (rechargePollCount >= 20) {
      stopRechargePolling()
    }
  }
  void poll()
  rechargeStatusTimer = window.setInterval(() => {
    void poll()
  }, 3000)
}

async function handleRechargePay(params: CreateRechargeOrderParams) {
  try {
    const data = await createRechargeOrder(params)
    if (!data?.order_sn) {
      throw new Error('订单创建成功，但未返回订单号')
    }
    const opened =
      (params.pay_type === 2 &&
        data.alipay_qr_code &&
        openAlipayPayDialog({
          qrCode: String(data.alipay_qr_code),
          amount: data.pay_amount != null && String(data.pay_amount).trim() ? `¥${String(data.pay_amount).trim()}` : '',
          kunbi:
            data.buy_kunbi_count != null && String(data.buy_kunbi_count).trim()
              ? `${String(data.buy_kunbi_count).trim()} 鲲币`
              : '',
        })) ||
      (data.pay_url && openPayTarget(data.pay_url)) ||
      (data.pay_data && tryHandlePayData(data.pay_data)) ||
      tryHandlePayData(data)

    ElMessage.success(
      params.pay_type === 1
        ? opened
          ? '订单已创建，请扫码完成微信支付'
          : '订单已创建，请继续完成支付'
        : opened
          ? '订单已创建，请在弹层内完成支付宝支付'
          : '订单已创建，请继续完成支付',
    )
    await startRechargePolling(data.order_sn)
  } catch (error: any) {
    ElMessage.error(error?.message || '创建充值订单失败')
  }
}

async function ensureSufficientKunbiBalance(actionKey: VisibleKunbiActionKey) {
  try {
    const price = getAiPosterKunbiPrice(actionKey)
    const balance = await refreshKunbiBalance()
    if (balance >= price.cost) return true
    ElMessage.warning(`${price.label}需要 ${price.cost} 鲲币，当前余额不足。`)
    await openRechargeCenter()
    return false
  } catch (error: any) {
    ElMessage.error(error?.message || '获取鲲币余额失败，请稍后重试')
    return false
  }
}

async function consumeKunbiAfterSuccess(actionKey: VisibleKunbiActionKey) {
  try {
    const consumeResult = await consumeAiToolKunbi({ actionKey })
    if (consumeResult?.skipped) {
      console.warn('[ai-poster] consume kunbi hook skipped', consumeResult)
      ElMessage.warning(`${consumeResult.label || '当前功能'}暂未完成主站扣费配置，余额还不会变动。`)
    } else if (Number(consumeResult?.remoteResult?.deducted ?? -1) === 0) {
      ElMessage.info(`${consumeResult.label || '当前功能'}本次未实际扣币，可能命中了主站免费次数或零成本规则。`)
    }
  } catch (error) {
    console.warn('[ai-poster] consume kunbi hook failed', error)
    const message = error instanceof Error ? error.message : '主站扣费失败，余额暂未扣减'
    ElMessage.warning(message)
  } finally {
    await refreshKunbiBalance().catch(() => undefined)
  }
}

watch(activeLoadingContext, (next) => {
  if (next) {
    startLoadingCopyRotation()
  } else {
    stopLoadingCopyRotation()
  }
}, { immediate: true })

onBeforeUnmount(() => {
  stopLoadingCopyRotation()
  stopRechargePolling()
})

function mapLoadingKeyToAction(key: string): PosterLoadingAction {
  if (key === 'replaceText') return 'copy'
  if (key === 'image') return 'image'
  if (key === 'relayout') return 'relayout'
  return 'recommend'
}

function getLoadingButtonTitle(action: PosterLoadingAction, fallback: string) {
  const context = activeLoadingContext.value
  if (!context || context.action !== action) return fallback
  return currentLoadingCopy.value?.title || fallback
}
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

function getCurrentPosterSnapshot() {
  const poster = lastPosterResult.value
  return {
    title: String(poster?.title || result.title || '').trim(),
    slogan: String(poster?.slogan || result.slogan || '').trim(),
    body: String(poster?.body || result.body || '').trim(),
    cta: String(poster?.cta || result.cta || '').trim(),
    layoutFamily: String((poster?.designPlan as any)?.layoutFamily || '').trim(),
  }
}

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

function getRefinePayload(generationMode: PosterGenerationMode = 'quality'): PosterGenerateInput {
  const payload = getPayload(generationMode)
  const current = getCurrentPosterSnapshot()
  return {
    ...payload,
    currentTitle: current.title,
    currentSlogan: current.slogan,
    currentBody: current.body,
    currentCta: current.cta,
    currentLayoutFamily: current.layoutFamily,
  }
}

function getModeLabel(mode: PosterGenerationMode) {
  return mode === 'quality' ? '高质量' : '快速'
}

function emitAiPosterLoading(
  status: 'start' | 'finish',
  detail: {
    action: PosterLoadingAction
    mode?: PosterGenerationMode
    success?: boolean
  },
) {
  if (typeof window === 'undefined') return
  const loadingCopy = currentLoadingCopy.value
  window.dispatchEvent(
    new CustomEvent(AI_POSTER_LOADING_EVENT, {
      detail: {
        status,
        loadingCopy,
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

function syncPosterTextState(
  data: Pick<PosterGenerateResult, 'title' | 'slogan' | 'body' | 'cta'>,
  extras?: Partial<PosterGenerateResult>,
) {
  syncResult(data)
  if (!lastPosterResult.value) return
  lastPosterResult.value = {
    ...lastPosterResult.value,
    title: data.title || '',
    slogan: data.slogan || '',
    body: data.body || '',
    cta: data.cta || '',
    ...(extras || {}),
  } as PosterGenerateResult
}

function appendMediaCacheBust(url: string) {
  const safe = String(url || '').trim()
  if (!safe) return ''
  const joiner = safe.includes('?') ? '&' : '?'
  return `${safe}${joiner}v=${Date.now()}`
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
    persistPosterForm()
    return
  }
  if (canReplaceTheme) form.theme = preset.name
  form.industry = preset.industry
  form.style = preset.style
  form.purpose = preset.purpose
  form.sizeKey = preset.sizeKey
  persistPosterForm()
}

function isPresetActive(key: string) {
  return key === 'smart' ? !form.presetKey : form.presetKey === key
}

async function recommendCopyAndPalette() {
  if (!assertAiLogin()) return
  if (!(await ensureSufficientKunbiBalance('optimizeCopyPalette'))) return
  loading.recommend = true
  let success = false
  beginLoadingSession('recommend', activeRefineMode.value)
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
    advanceLoadingSession(1)
    const nextCopy = copyRes
      ? {
        title: copyRes.title || '',
        slogan: copyRes.slogan || '',
        body: copyRes.body || '',
        cta: copyRes.cta || '',
      }
      : null
    if (paletteRes?.palette) {
      currentPalette.value = paletteRes.palette
    }
    providerTip.value = [formatProviderMeta(copyRes?.providerMeta), formatProviderMeta(paletteRes?.providerMeta)].filter(Boolean).join('\n')
    if (hasContent) {
      const currentPage = pageStore.getDPage()
      const hasBackgroundImage = Boolean(String((currentPage as any)?.backgroundImage || '').trim())
      // 有背景图时：只改字体/前景颜色，不更改背景颜色/渐变，也不删除背景图
      if (hasBackgroundImage) {
        if (nextCopy) {
          syncPosterTextState(nextCopy, {
            palette: currentPalette.value,
          })
          replacePosterTexts(widgetStore.dWidgets, payload, {
            ...nextCopy,
            palette: currentPalette.value,
          } as any)
        } else if (lastPosterResult.value) {
          lastPosterResult.value = {
            ...lastPosterResult.value,
            palette: currentPalette.value,
          } as PosterGenerateResult
        }
        applyPaletteToCurrentCanvas()
        widgetStore.updateDWidgets()
        ElMessage.success(copyRes && paletteRes ? `${getModeLabel(mode)}模型已优化文案与配色。` : copyRes ? `${getModeLabel(mode)}模型已优化文案。` : `${getModeLabel(mode)}模型已优化配色。`)
        return
      }
      if (lastPosterResult.value) {
        const merged = {
          ...lastPosterResult.value,
          title: nextCopy?.title ?? lastPosterResult.value.title,
          slogan: nextCopy?.slogan ?? lastPosterResult.value.slogan,
          body: nextCopy?.body ?? lastPosterResult.value.body,
          cta: nextCopy?.cta ?? lastPosterResult.value.cta,
          palette: currentPalette.value,
        } as PosterGenerateResult
        lastPosterResult.value = merged
        syncResult(merged)
        const layout = buildPosterLayout({ input: payload, result: merged })
        applyGeneratedLayoutToCanvas(layout)
      } else {
        if (nextCopy) {
          syncResult(nextCopy)
          applyCopyToCurrentCanvas(nextCopy, mode)
        }
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
      if (nextCopy) {
        syncResult(nextCopy)
      }
      ElMessage.success(copyRes && paletteRes ? `${getModeLabel(mode)}模型已生成文案与推荐配色。` : copyRes ? `${getModeLabel(mode)}模型已生成推荐文案。` : `${getModeLabel(mode)}模型已生成推荐配色。`)
    }
    success = true
    finalizeLoadingSession(true)
    await consumeKunbiAfterSuccess('optimizeCopyPalette')
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
  const actionKey: VisibleKunbiActionKey = generationMode === 'quality' ? 'generateQuality' : 'generateFast'
  if (!(await ensureSufficientKunbiBalance(actionKey))) return
  loading.generate = true
  activeGenerateMode.value = generationMode
  let success = false
  beginLoadingSession('generate', generationMode)
  emitAiPosterLoading('start', { action: 'generate', mode: generationMode })
  try {
    const payload = getPayload(generationMode)
    advanceLoadingSession(1)
    const timeout = getPosterTimeout(generationMode, 'generate')
    const poster = normalizePosterMedia(await requestAi<PosterGenerateResult>('ai/poster/generate', payload, timeout))
    advanceLoadingSession(3)
    lastPosterResult.value = poster
    selectedHeroCandidateIndex.value = Math.max(0, Number(poster.heroSelectionMeta?.selectedIndex ?? poster.recommendedHeroCandidateIndex ?? 0))
    pendingQualityCandidateSelection.value = generationMode === 'quality' && heroCandidates.value.length > 0
    syncResult(poster)
    currentPalette.value = poster.palette
    updateProviderTip(poster.providerMeta)
    if (generationMode === 'quality' && heroCandidates.value.length > 0) {
      advanceLoadingSession(4)
      success = true
      finalizeLoadingSession(true)
      await consumeKunbiAfterSuccess(actionKey)
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
    advanceLoadingSession(4)
    applyGeneratedLayoutToCanvas(layout)
    pendingQualityCandidateSelection.value = false
    success = true
    finalizeLoadingSession(true)
    await consumeKunbiAfterSuccess(actionKey)
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

function resolveAbsoluteRatio(layer: Record<string, any>, primaryKey: string, fallbackKey: string, pageSize: number, fallbackRatio: number) {
  const raw = Number(layer?.[primaryKey] ?? layer?.[fallbackKey])
  if (!Number.isFinite(raw)) return Math.max(0, Math.min(1, fallbackRatio))
  if (raw >= 0 && raw <= 1) return raw
  return Math.max(0, Math.min(1, raw / Math.max(1, pageSize)))
}

function resolveAbsoluteFontSizeForCanvas(layer: Record<string, any>, pageW: number, pageH: number) {
  const raw = Number(layer?.fontSize)
  if (!Number.isFinite(raw) || raw <= 0) return 0
  if (raw <= 1) {
    const base = Math.min(pageW, pageH)
    return Math.max(12, Math.round(base * raw))
  }
  return Math.max(12, Math.round(raw))
}

function normalizeAbsoluteLayerRect(layer: Record<string, any>, pageW: number, pageH: number) {
  const leftRatio = resolveAbsoluteRatio(layer, 'left', 'x', pageW, 0)
  const topRatio = resolveAbsoluteRatio(layer, 'top', 'y', pageH, 0)
  const widthRatio = resolveAbsoluteRatio(layer, 'width', 'w', pageW, 0.2)
  const heightRatio = resolveAbsoluteRatio(layer, 'height', 'h', pageH, 0.08)
  return clampRectToPage({
    left: leftRatio * pageW,
    top: topRatio * pageH,
    width: Math.max(0.04, widthRatio) * pageW,
    height: Math.max(0.04, heightRatio) * pageH,
  }, pageW, pageH)
}

function findCanvasWidgetByRole(role: string) {
  const roleMap: Record<string, string[]> = {
    title: ['ai_title'],
    slogan: ['ai_slogan'],
    body: ['ai_body'],
    cta: ['ai_cta', 'ai_button'],
    hero: ['ai_hero'],
    qrcode: ['ai_qrcode'],
    badge: ['ai_badge'],
    priceTag: ['ai_price_tag'],
    priceNum: ['ai_price_num'],
    meta1: ['ai_meta_1', 'ai_meta1'],
    meta2: ['ai_meta_2', 'ai_meta2'],
    chip1: ['ai_chip_1', 'ai_chip1'],
    chip2: ['ai_chip_2', 'ai_chip2'],
    chip3: ['ai_chip_3', 'ai_chip3'],
    chip4: ['ai_chip_4', 'ai_chip4'],
    logo: ['ai_logo'],
  }
  const names = roleMap[String(role || '').trim()] || []
  return widgetStore.dWidgets.find((item: any) => names.includes(String(item?.name || '').trim())) as any
}

function applyAbsoluteRelayout(designPlan?: RelayoutResult['designPlan']) {
  const layers = (designPlan as any)?.absoluteLayout?.layers
  if (!Array.isArray(layers) || !layers.length) return false
  const page = pageStore.getDPage()
  const pageW = Number(page.width || 1242)
  const pageH = Number(page.height || 1660)
  const byRole = new Map<string, any>(layers.map((item: any) => [String(item.role || ''), item]))
  const titleWidget = findCanvasWidgetByRole('title') || getCanvasTextWidgets()[0]
  const sloganWidget = findCanvasWidgetByRole('slogan') || getCanvasTextWidgets()[1]
  const bodyWidget = findCanvasWidgetByRole('body') || getCanvasTextWidgets()[2]
  const ctaWidget = findCanvasWidgetByRole('cta') || getCanvasTextWidgets().find((w: any) => /cta|button|btn|占位|报名|立即|咨询|抢|预定|预约/i.test(String(w.name || '') + String(w.text || '')))
  const hero = findCanvasWidgetByRole('hero') || getCanvasImageWidget()
  const qrcode = findCanvasWidgetByRole('qrcode') || (widgetStore.dWidgets.find((item: any) => item?.type === 'w-qrcode') as any)

  const assignText = (widget: any, role: string) => {
    if (!widget) return
    const layer = byRole.get(role)
    if (!layer) return
    const rect = normalizeAbsoluteLayerRect(layer, pageW, pageH)
    widget.left = rect.left
    widget.top = rect.top
    widget.width = rect.width
    widget.height = rect.height
    if (widget.record) {
      widget.record.width = rect.width
      widget.record.height = rect.height
    }
    const nextFontSize = resolveAbsoluteFontSizeForCanvas(layer, pageW, pageH)
    if (nextFontSize > 0) {
      widget.fontSize = nextFontSize
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
    const rect = normalizeAbsoluteLayerRect(byRole.get('hero'), pageW, pageH)
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
    const rect = normalizeAbsoluteLayerRect(byRole.get('qrcode'), pageW, pageH)
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
  if (!(await ensureSufficientKunbiBalance('replaceText'))) return
  loading.replaceText = true
  let success = false
  beginLoadingSession('copy', activeRefineMode.value)
  emitAiPosterLoading('start', { action: 'copy', mode: activeRefineMode.value })
  try {
    const mode = activeRefineMode.value
    const before = {
      title: result.title,
      slogan: result.slogan,
      body: result.body,
      cta: result.cta,
    }
    const copyRes = await requestAi<CopyGenerateResult>('ai/poster/copy', getRefinePayload(mode), getPosterTimeout(mode, 'copy'))
    advanceLoadingSession(1)
    const nextCopy = {
      title: copyRes.title || '',
      slogan: copyRes.slogan || '',
      body: copyRes.body || '',
      cta: copyRes.cta || '',
    }
    syncPosterTextState(nextCopy, copyRes as Partial<PosterGenerateResult>)
    const applied = applyCopyToCurrentCanvas(nextCopy, mode)
    if (!applied) {
      ElMessage.warning('当前画布没有可替换的文字图层。')
      return
    }
    widgetStore.updateDWidgets()
    providerTip.value = formatProviderMeta(copyRes.providerMeta)
    const changed =
      before.title !== nextCopy.title ||
      before.slogan !== nextCopy.slogan ||
      before.body !== nextCopy.body ||
      before.cta !== nextCopy.cta
    success = true
    finalizeLoadingSession(true)
    await consumeKunbiAfterSuccess('replaceText')
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
  if (!(await ensureSufficientKunbiBalance('replaceHero'))) return
  loading.image = true
  let success = false
  beginLoadingSession('image', activeRefineMode.value)
  emitAiPosterLoading('start', { action: 'image', mode: activeRefineMode.value })
  try {
    const mode = activeRefineMode.value
    const payload = getRefinePayload(mode)
    let heroUrl = ''
    let providerMessage = ''
    if (String(payload.sourceImageUrl || '').trim()) {
      const imageRes = await requestAi<ReplaceImageResult>('ai/poster/replace-image', payload, getPosterTimeout(mode, 'image'))
      advanceLoadingSession(1)
      heroUrl = appendMediaCacheBust(normalizeLoopbackMediaUrl(imageRes.hero?.imageUrl || '') || '')
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
      advanceLoadingSession(1)
      heroUrl = appendMediaCacheBust(normalizeLoopbackMediaUrl(poster.hero?.imageUrl || '') || '')
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
    if (lastPosterResult.value) {
      lastPosterResult.value = {
        ...lastPosterResult.value,
        hero: {
          ...(lastPosterResult.value.hero || {}),
          imageUrl: heroUrl,
          prompt: lastPosterResult.value.hero?.prompt || '',
        },
      } as PosterGenerateResult
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
    finalizeLoadingSession(true)
    await consumeKunbiAfterSuccess('replaceHero')
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
  if (!(await ensureSufficientKunbiBalance('relayout'))) return
  loading.relayout = true
  let success = false
  beginLoadingSession('relayout', activeRefineMode.value)
  emitAiPosterLoading('start', { action: 'relayout', mode: activeRefineMode.value })
  try {
    const mode = activeRefineMode.value
    const relayout = await requestAi<RelayoutResult>('ai/poster/relayout', getRefinePayload(mode), getPosterTimeout(mode, 'relayout'))
    advanceLoadingSession(1)
    if (!lastPosterResult.value) {
      const applied = relayoutCurrentTemplate(relayout.designPlan)
      providerTip.value = formatProviderMeta(relayout.providerMeta)
      success = applied
      finalizeLoadingSession(applied)
      if (applied) {
        await consumeKunbiAfterSuccess('relayout')
      }
      ElMessage.success(applied ? `${getModeLabel(mode)}模型已完成智能排版（模板模式）。` : '当前模板缺少可重排元素。')
      return
    }
    const merged = {
      ...lastPosterResult.value,
      designPlan: relayout.designPlan,
      posterIntent: relayout.posterIntent || lastPosterResult.value.posterIntent,
      copyDeck: relayout.copyDeck || lastPosterResult.value.copyDeck,
      slotContent: relayout.slotContent || lastPosterResult.value.slotContent,
      supplementFacts: relayout.supplementFacts || lastPosterResult.value.supplementFacts,
      finishCheck: relayout.finishCheck || lastPosterResult.value.finishCheck,
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
    finalizeLoadingSession(true)
    await consumeKunbiAfterSuccess('relayout')
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
  if (userStore.online) {
    void refreshKunbiBalance()
  }
  void maybeAutoGenerateFromWelcome()
})

watch(
  () => userStore.online,
  (online) => {
    if (online) {
      void refreshKunbiBalance()
      return
    }
    kunbiBalance.value = 0
  },
  { immediate: false },
)

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

  :deep(.ac-pay-dialog) {
    border-radius: 16px;
  }

  .ac-pay-dialog__title {
    font-size: 18px;
    font-weight: 700;
    text-align: center;
    color: #111827;
  }

  .ac-pay-dialog__desc {
    margin-top: 10px;
    font-size: 13px;
    line-height: 1.7;
    text-align: center;
    color: #6b7280;
  }

  .ac-pay-dialog__qr-wrap {
    display: flex;
    justify-content: center;
    margin-top: 18px;
  }

  .ac-pay-dialog__qr {
    width: 220px;
    height: 220px;
    object-fit: contain;
    border-radius: 12px;
    background: #fff;
    box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
  }

  .ac-pay-dialog__meta {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 16px;
    text-align: center;
    font-size: 13px;
    color: #4b5563;
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

  .field-label-with-tip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    line-height: 1.2;
  }

  .field-label-tip {
    color: #64748b;
    font-size: 10px;
    font-weight: 500;
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
