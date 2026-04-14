<template>
  <div class="assistant">
    <div class="assistant-head">ai海报</div>
      <div class="section">
        <div class="section-title"><el-icon><Grid /></el-icon><span>模板</span></div>
        <div class="preset-grid">
          <button
            v-for="preset in posterPresets"
            :key="preset.key"
            :class="['preset-card', { active: form.presetKey === preset.key }]"
            @click="applyPreset(preset.key)"
          >
            <span class="preset-name">{{ preset.name }}</span>
            <span class="preset-meta">{{ preset.industry }} / {{ preset.style }}</span>
          </button>
        </div>
      </div>

      <el-form label-position="top" class="compact-form">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="主题">
              <el-input v-model="form.theme" placeholder="例如：春季健身课、五一活动、新品上新" />
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

        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="尺寸">
              <el-select v-model="form.sizeKey" style="width: 100%">
                <el-option
                  v-for="item in sizePresets"
                  :key="item.key"
                  :label="`${item.name} (${item.width} x ${item.height})`"
                  :value="item.key"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="二维码链接">
              <el-input v-model="form.qrUrl" placeholder="可选：https://..." />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="图片生成">
          <div class="hero-toggle-row hero-toggle-row--stack">
            <el-checkbox v-model="form.generateHeroImage">生成前景小图</el-checkbox>
            <el-checkbox v-model="form.generateBackgroundImage">生成 AI 背景图</el-checkbox>
          </div>
        </el-form-item>

        <el-form-item label="补充文案">
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="2"
            placeholder="时间、地点、卖点..."
          />
        </el-form-item>
      </el-form>

      <div class="toolbar">
        <el-button :loading="loading.recommend" @click="recommendCopyAndPalette"><el-icon><MagicStick /></el-icon>推荐配色</el-button>
        <el-button type="primary" :loading="loading.generate" @click="applyPoster"><el-icon><Promotion /></el-icon>生成</el-button>
      </div>

      <div class="section">
        <div class="section-title"><el-icon><Tools /></el-icon><span>快捷操作</span></div>
        <div class="actions">
          <el-button :loading="loading.replaceText" @click="replaceTextOnly"><el-icon><EditPen /></el-icon>换字</el-button>
          <el-button :loading="loading.background" @click="applyBackgroundOnly"><el-icon><PictureFilled /></el-icon>背景</el-button>
          <el-button :loading="loading.image" @click="replaceHeroOnly"><el-icon><Picture /></el-icon>主图</el-button>
          <el-button :loading="loading.relayout" @click="relayoutLayout"><el-icon><Tools /></el-icon>排版</el-button>
          <el-button @click="adaptCanvasSize"><el-icon><ScaleToOriginal /></el-icon>尺寸</el-button>
        </div>
      </div>

  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElForm, ElFormItem, ElRow, ElCol, ElSelect, ElOption, ElCheckbox } from 'element-plus'
import { EditPen, Grid, MagicStick, Picture, PictureFilled, Promotion, ScaleToOriginal, Tools } from '@element-plus/icons-vue'
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
  type BackgroundGenerateResult,
  type ReplaceImageResult,
  type RelayoutResult,
} from '@/api/ai'
import { applyPosterPalette, buildPosterLayout, getPosterGradient, getSizePresets, replaceHeroImage, replacePosterTexts } from './posterEngine'

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
  presetKey: 'campaign',
  theme: '',
  purpose: '引流',
  industry: '活动',
  style: '高级简约',
  sizeKey: 'xiaohongshu',
  content: '',
  qrUrl: '',
  generateHeroImage: true,
  generateBackgroundImage: true,
})

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
  background: false,
  image: false,
  relayout: false,
})

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

function getPayload(): PosterGenerateInput {
  return {
    theme: form.theme.trim(),
    purpose: form.purpose.trim(),
    sizeKey: form.sizeKey,
    style: form.style,
    industry: form.industry,
    content: form.content.trim(),
    qrUrl: form.qrUrl.trim(),
    generateHeroImage: form.generateHeroImage,
    generateBackgroundImage: form.generateBackgroundImage,
  }
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
  }
}

function samePosterImageUrl(a: string, b: string) {
  const x = (normalizeLoopbackMediaUrl(a) || '').trim().split('?')[0]
  const y = (normalizeLoopbackMediaUrl(b) || '').trim().split('?')[0]
  return x.length > 0 && x === y
}

function formatProviderMeta(meta?: AiProviderMeta) {
  if (!meta) return ''
  const mode = meta.isMockFallback ? '演示回退' : '真实模型'
  return `${mode} · ${meta.provider} · ${meta.model}${meta.message ? `：${meta.message}` : ''}`
}

function updateProviderTip(meta?: Record<string, AiProviderMeta>) {
  const messages = Object.values(meta || {})
    .map((item) => formatProviderMeta(item))
    .filter(Boolean)
  providerTip.value = messages.join('\n')
}

function open() {
  applyPreset(form.presetKey)
}

function routeQuerySingle(key: string) {
  const v = route.query[key]
  return Array.isArray(v) ? String(v[0] || '') : String(v || '')
}

async function maybeAutoGenerateFromWelcome() {
  const auto = routeQuerySingle('aiAutoGenerate').trim() === '1'
  const theme = routeQuerySingle('aiTheme').trim()
  const prompt = routeQuerySingle('aiPrompt').trim()
  if (!auto) return
  const key = `${auto}|${theme}|${prompt}|${route.fullPath}`
  if (autoGenerateHandledKey.value === key) return
  autoGenerateHandledKey.value = key
  if (theme) form.theme = theme
  if (prompt && !form.content) form.content = prompt
  await applyPoster()
  const nextQuery = { ...route.query } as Record<string, any>
  delete nextQuery.aiAutoGenerate
  void router.replace({ path: route.path, query: nextQuery })
}

function applyPreset(key: string) {
  const preset = posterPresets.find((item) => item.key === key)
  if (!preset) return
  form.presetKey = preset.key
  form.theme = preset.name
  form.industry = preset.industry
  form.style = preset.style
  form.purpose = preset.purpose
  form.sizeKey = preset.sizeKey
}

async function recommendCopyAndPalette() {
  if (!assertAiLogin()) return
  loading.recommend = true
  try {
    const payload = getPayload()
    const hasContent = hasCanvasContent()
    const [copyRes, paletteRes] = await Promise.all([
      requestAi<CopyGenerateResult>('ai/poster/copy', payload, 120000),
      requestAi<PaletteGenerateResult>('ai/poster/palette', payload, 120000),
    ])
    currentPalette.value = paletteRes.palette
    providerTip.value = [formatProviderMeta(copyRes.providerMeta), formatProviderMeta(paletteRes.providerMeta)].filter(Boolean).join('\n')
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
        ElMessage.success('已推荐并更新配色。')
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
        pageStore.setDPage({
          ...pageStore.getDPage(),
          width: layout.page.width,
          height: layout.page.height,
          backgroundColor: layout.page.backgroundColor,
          backgroundGradient: layout.page.backgroundGradient,
          backgroundImage: layout.page.backgroundImage,
          backgroundTransform: {},
        } as any)
        widgetStore.setDWidgets([])
        widgetStore.selectWidget({ uuid: '-1' })
        layout.widgets.forEach((widget) => widgetStore.addWidget(widget))
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
      ElMessage.success('已推荐并更新配色。')
    } else {
      syncResult(copyRes as Pick<PosterGenerateResult, 'title' | 'slogan' | 'body' | 'cta'>)
      ElMessage.success('已生成推荐文案与配色。')
    }
  } catch (error) {
    console.error(error)
    ElMessage.error(`推荐失败：${(error as Error).message}`)
  } finally {
    loading.recommend = false
  }
}

async function applyPoster() {
  if (!assertAiLogin()) return
  loading.generate = true
  try {
    const payload = getPayload()
    let poster = await requestAi<PosterGenerateResult>('ai/poster/generate', payload, 240000)
    const providerNotes: string[] = []

    // 主接口未返回背景图时自动补调背景（用户勾选「生成 AI 背景图」时）
    if (payload.generateBackgroundImage !== false && !String(poster.background?.imageUrl || '').trim()) {
      try {
        const bg = await requestAi<BackgroundGenerateResult>(
          'ai/poster/background',
          { ...payload, generateBackgroundImage: true, sourceImageUrl: poster.hero?.imageUrl || payload.sourceImageUrl || '' },
          240000,
        )
        poster = { ...poster, background: { ...poster.background, ...bg.background } }
        providerNotes.push(formatProviderMeta(bg.providerMeta))
      } catch (error) {
        console.warn('fallback background generation failed', error)
      }
    }

    // 勾选前景小图但主接口未返回时，自动补调换图接口
    if (payload.generateHeroImage !== false && !String(poster.hero?.imageUrl || '').trim()) {
      try {
        const hero = await requestAi<ReplaceImageResult>(
          'ai/poster/replace-image',
          { ...payload, baseImageUrl: poster.background?.imageUrl || payload.baseImageUrl || '' },
          240000,
        )
        poster = { ...poster, hero: { ...poster.hero, ...hero.hero } }
        providerNotes.push(formatProviderMeta(hero.providerMeta))
      } catch (error) {
        console.warn('fallback hero generation failed', error)
      }
    }

    poster = normalizePosterMedia(poster)
    if (
      payload.generateHeroImage !== false &&
      payload.generateBackgroundImage !== false &&
      samePosterImageUrl(poster.hero?.imageUrl || '', poster.background?.imageUrl || '')
    ) {
      try {
        const hero = await requestAi<ReplaceImageResult>(
          'ai/poster/replace-image',
          { ...payload, baseImageUrl: '', sourceImageUrl: payload.sourceImageUrl || '' },
          240000,
        )
        poster = normalizePosterMedia({ ...poster, hero: { ...poster.hero, ...hero.hero } })
        providerNotes.push(formatProviderMeta(hero.providerMeta))
      } catch (error) {
        console.warn('hero/background dedupe retry failed', error)
      }
    }
    lastPosterResult.value = poster
    syncResult(poster)
    currentPalette.value = poster.palette
    updateProviderTip(poster.providerMeta)
    if (providerNotes.length) {
      providerTip.value = [providerTip.value, ...providerNotes].filter(Boolean).join('\n')
    }
    if (payload.generateBackgroundImage !== false && !poster.background?.imageUrl) {
      ElMessage.warning('背景图生成失败，已使用配色背景。可点击“背景”重试。')
    }
    if (payload.generateHeroImage !== false && !poster.hero?.imageUrl) {
      ElMessage.warning('前景主图生成失败，可点击“主图”重试。')
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

    pageStore.setDPage({
      ...pageStore.getDPage(),
      width: layout.page.width,
      height: layout.page.height,
      backgroundColor: layout.page.backgroundColor,
      backgroundGradient: layout.page.backgroundGradient,
      backgroundImage: layout.page.backgroundImage,
      backgroundTransform: {},
    } as any)

    widgetStore.setDWidgets([])
    widgetStore.selectWidget({ uuid: '-1' })
    layout.widgets.forEach((widget) => widgetStore.addWidget(widget))
    ElMessage.success('海报草稿已生成，可以继续换字、换图和导出。')
  } catch (error) {
    console.error(error)
    ElMessage.error(`生成失败：${(error as Error).message}`)
  } finally {
    loading.generate = false
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

function applyCopyToCurrentCanvas(copy: Pick<PosterGenerateResult, 'title' | 'slogan' | 'body' | 'cta'>) {
  if (ensurePosterWidgets()) {
    replacePosterTexts(widgetStore.dWidgets, getPayload(), {
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
  try {
    const before = {
      title: result.title,
      slogan: result.slogan,
      body: result.body,
      cta: result.cta,
    }
    const copyRes = await requestAi<CopyGenerateResult>('ai/poster/copy', getPayload(), 120000)
    syncResult(copyRes as Pick<PosterGenerateResult, 'title' | 'slogan' | 'body' | 'cta'>)
    const applied = applyCopyToCurrentCanvas({
      title: result.title,
      slogan: result.slogan,
      body: result.body,
      cta: result.cta,
    })
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
    ElMessage.success(changed ? '文案已替换。' : '已重新应用文案（本次推荐与上次相同）。')
  } catch (error) {
    console.error(error)
    ElMessage.error(`换字失败：${(error as Error).message}`)
  } finally {
    loading.replaceText = false
  }
}

async function applyBackgroundOnly() {
  if (!assertAiLogin()) return
  loading.background = true
  try {
    const backgroundRes = await requestAi<BackgroundGenerateResult>(
      'ai/poster/background',
      { ...getPayload(), generateBackgroundImage: true },
      240000,
    )
    const backgroundUrl = normalizeLoopbackMediaUrl(backgroundRes.background?.imageUrl || '') || ''
    pageStore.setDPage({
      ...pageStore.getDPage(),
      backgroundColor: activePalette.value.background,
      backgroundGradient: backgroundUrl ? '' : getPosterGradient(activePalette.value),
      backgroundImage: backgroundUrl,
      backgroundTransform: {},
    } as any)
    providerTip.value = formatProviderMeta(backgroundRes.providerMeta)
    ElMessage.success('背景已更新。')
  } catch (error) {
    console.error(error)
    ElMessage.error(`换背景失败：${(error as Error).message}`)
  } finally {
    loading.background = false
  }
}

async function replaceHeroOnly() {
  if (!assertAiLogin()) return
  if (!hasCanvasContent()) {
    ElMessage.warning('当前画布为空，请先添加一个模板或元素。')
    return
  }
  loading.image = true
  try {
    const imageRes = await requestAi<ReplaceImageResult>('ai/poster/replace-image', getPayload(), 240000)
    const heroUrl = normalizeLoopbackMediaUrl(imageRes.hero?.imageUrl || '') || ''
    if (ensurePosterWidgets()) {
      replaceHeroImage(widgetStore.dWidgets, heroUrl)
    } else {
      const target = getCanvasImageWidget()
      if (!target) {
        ElMessage.warning('当前画布没有可替换的图片图层。')
        return
      }
      ;(target as any).imgUrl = heroUrl
    }
    widgetStore.updateDWidgets()
    providerTip.value = formatProviderMeta(imageRes.providerMeta)
    ElMessage.success('主图已更新。')
  } catch (error) {
    console.error(error)
    ElMessage.error(`换图失败：${(error as Error).message}`)
  } finally {
    loading.image = false
  }
}

async function relayoutLayout() {
  if (!assertAiLogin()) return
  if (!hasCanvasContent()) {
    ElMessage.warning('当前画布为空，请先添加一个模板或元素。')
    return
  }
  loading.relayout = true
  try {
    const relayout = await requestAi<RelayoutResult>('ai/poster/relayout', getPayload(), 120000)
    if (!lastPosterResult.value) {
      const applied = relayoutCurrentTemplate(relayout.designPlan)
      providerTip.value = formatProviderMeta(relayout.providerMeta)
      ElMessage.success(applied ? '已完成智能排版（模板模式）。' : '当前模板缺少可重排元素。')
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
    const layout = buildPosterLayout({ input: getPayload(), result: merged })
    pageStore.setDPage({
      ...pageStore.getDPage(),
      width: layout.page.width,
      height: layout.page.height,
      backgroundColor: layout.page.backgroundColor,
      backgroundGradient: layout.page.backgroundGradient,
      backgroundImage: layout.page.backgroundImage,
      backgroundTransform: {},
    } as any)
    widgetStore.setDWidgets([])
    widgetStore.selectWidget({ uuid: '-1' })
    layout.widgets.forEach((widget) => widgetStore.addWidget(widget))
    providerTip.value = formatProviderMeta(relayout.providerMeta)
    ElMessage.success('已完成智能排版。')
  } catch (error) {
    console.error(error)
    ElMessage.error(`智能排版失败：${(error as Error).message}`)
  } finally {
    loading.relayout = false
  }
}

function adaptCanvasSize() {
  const activeSize = sizePresets.find((item) => item.key === form.sizeKey) || sizePresets[0]
  const previousPage = pageStore.getDPage()
  pageStore.setDPage({
    ...previousPage,
    width: activeSize.width,
    height: activeSize.height,
  } as any)
  widgetStore.autoResizeAll({
    width: previousPage.width,
    height: previousPage.height,
  })
  ElMessage.success('尺寸已自动适配。')
}

defineExpose({ open })

onMounted(() => {
  void maybeAutoGenerateFromWelcome()
})

watch(
  () => route.fullPath,
  () => {
    void maybeAutoGenerateFromWelcome()
  },
)
</script>

<style lang="less" scoped>
.assistant {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 4px;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    width: 0;
    height: 0;
    display: none;
  }

  .assistant-head {
    margin-bottom: 12px;
    font-size: 16px;
    font-weight: 700;
    color: #0f172a;
  }

  .section {
    margin-bottom: 16px;
  }

  .section-title {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 10px;
    font-size: 14px;
    font-weight: 600;
    color: #1f2937;
  }
  .section-title :deep(.el-icon) {
    color: #2563eb;
  }

  .preset-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    margin-bottom: 8px;
  }

  .preset-card {
    padding: 8px 10px;
    min-height: 42px;
    text-align: left;
    cursor: pointer;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    background: #fff;
    transition: all 0.18s ease;
  }

  .preset-card:hover,
  .preset-card.active {
    border-color: #f97316;
    box-shadow: 0 0 0 2px rgba(249, 115, 22, 0.12);
  }

  .preset-name {
    display: block;
    font-size: 15px;
    line-height: 1.2;
    font-weight: 600;
    color: #111827;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .preset-meta {
    display: none;
  }

  .toolbar,
  .actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }
  .actions {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }
  .toolbar :deep(.el-button),
  .actions :deep(.el-button) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    min-height: 34px;
    padding: 0 10px;
  }
  .toolbar :deep(.el-button + .el-button),
  .actions :deep(.el-button + .el-button) {
    margin-left: 0;
  }

  .toolbar {
    margin: 6px 0 18px;
  }

  .result-card {
    margin-bottom: 16px;
    padding: 14px;
    border: 1px solid #ebeef5;
    border-radius: 12px;
    background: #fafbfd;
  }

  .result-title {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 12px;
    font-size: 14px;
    font-weight: 600;
    color: #1f2937;
  }

  .result-item {
    margin-bottom: 12px;
  }

  .label {
    display: inline-block;
    margin-bottom: 6px;
    font-size: 13px;
    color: #606266;
  }

  .palette {
    display: flex;
    gap: 8px;
  }

  .swatch {
    width: 28px;
    height: 28px;
    border: 1px solid rgba(15, 23, 42, 0.08);
    border-radius: 999px;
  }

  .provider {
    display: none;
    margin-top: 8px;
    color: #92400e;
    font-size: 12px;
    line-height: 1.6;
    white-space: pre-line;
  }

  .compact-form :deep(.el-form-item) { margin-bottom: 8px; }

  .hero-toggle-row {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 10px 12px;
  }

  .hero-toggle-row--stack {
    flex-direction: row;
    align-items: center;
    gap: 10px 16px;
  }

  .hero-toggle-row--stack :deep(.el-checkbox) {
    height: auto;
    white-space: normal;
    align-items: flex-start;
  }

  .hero-toggle-row--stack :deep(.el-checkbox__label) {
    white-space: normal;
    line-height: 1.45;
  }

  .hero-toggle-hint {
    display: none;
  }
}
</style>
