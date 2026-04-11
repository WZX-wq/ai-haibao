<template>
  <el-dialog v-model="visible" title="AI 海报助手" width="720" destroy-on-close align-center>
    <div class="assistant">
      <div class="section">
        <div class="section-title">行业模板</div>
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

      <el-form label-position="top">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="主题">
              <el-input v-model="form.theme" placeholder="例如：春季健身课、五一活动、新品上新" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="用途">
              <el-input v-model="form.purpose" placeholder="例如：引流、报名、促销、招聘" />
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
              <el-input v-model="form.qrUrl" placeholder="https://example.com/signup" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="补充文字">
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="3"
            placeholder="可以填写时间、地点、卖点、联系方式等，AI 会一起生成标题、正文和 CTA。"
          />
        </el-form-item>
      </el-form>

      <div class="toolbar">
        <el-button :loading="loading.copy" @click="recommendCopyAndPalette">推荐标题/配色</el-button>
        <el-button type="primary" :loading="loading.generate" @click="applyPoster">生成海报</el-button>
      </div>

      <div class="result-card">
        <div class="result-title">当前推荐</div>
        <div class="result-item">
          <span class="label">标题</span>
          <el-input v-model="result.title" />
        </div>
        <div class="result-item">
          <span class="label">Slogan</span>
          <el-input v-model="result.slogan" />
        </div>
        <div class="result-item">
          <span class="label">正文</span>
          <el-input v-model="result.body" type="textarea" :rows="2" />
        </div>
        <div class="result-item">
          <span class="label">CTA</span>
          <el-input v-model="result.cta" />
        </div>
        <div class="result-item">
          <span class="label">推荐配色</span>
          <div class="palette">
            <span
              v-for="color in activePalette.swatches"
              :key="color"
              class="swatch"
              :style="{ background: color }"
            />
          </div>
        </div>
        <div v-if="providerTip" class="provider">{{ providerTip }}</div>
      </div>

      <div class="section">
        <div class="section-title">快捷编辑</div>
        <div class="actions">
          <el-button :loading="loading.copy" @click="replaceTextOnly">一键换字</el-button>
          <el-button :loading="loading.background" @click="applyBackgroundOnly">一键换背景</el-button>
          <el-button :loading="loading.image" @click="replaceHeroOnly">一键换图</el-button>
          <el-button @click="adaptCanvasSize">尺寸自动适配</el-button>
        </div>
      </div>

      <div class="section">
        <div class="section-title">导出</div>
        <div class="actions">
          <el-button @click="handleExport('png')">导出 PNG</el-button>
          <el-button @click="handleExport('jpg')">导出 JPG</el-button>
          <el-button @click="handleExport('pdf')">导出 PDF</el-button>
        </div>
      </div>

      <div class="tips">
        当前版本支持：需求输入、行业模板、AI 文案、推荐配色、主视觉/背景生成、自动排版、换字换图、二维码嵌入与 PNG/JPG/PDF 导出。
      </div>
    </div>
  </el-dialog>
</template>

<script lang="ts" setup>
import { computed, reactive, ref } from 'vue'
import { ElMessage, ElForm, ElFormItem, ElRow, ElCol, ElSelect, ElOption } from 'element-plus'
import { useCanvasStore, useWidgetStore } from '@/store'
import _config from '@/config'
import { exportPoster } from '@/common/methods/download/exportPoster'
import type {
  PosterGenerateInput,
  PosterGenerateResult,
  PosterPalette,
  AiProviderMeta,
  CopyGenerateResult,
  PaletteGenerateResult,
  BackgroundGenerateResult,
  ReplaceImageResult,
} from '@/api/ai'
import { buildPosterLayout, getPosterGradient, getSizePresets, replaceHeroImage, replacePosterTexts } from './posterEngine'

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
]

const industries = ['电商', '招聘', '活动', '课程', '节日', '健身', '餐饮']
const styles = ['高级简约', '活力促销', '专业商务', '年轻潮流', '清新温暖']
const sizePresets = getSizePresets()

const visible = ref(false)
const pageStore = useCanvasStore()
const widgetStore = useWidgetStore()

const form = reactive<PosterGenerateInput & { presetKey: string }>({
  presetKey: 'campaign',
  theme: '',
  purpose: '引流',
  industry: '活动',
  style: '高级简约',
  sizeKey: 'xiaohongshu',
  content: '',
  qrUrl: '',
})

const result = reactive({
  title: '',
  slogan: '',
  body: '',
  cta: '',
})

const loading = reactive({
  generate: false,
  copy: false,
  background: false,
  image: false,
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

async function requestAi<T>(path: string, payload: PosterGenerateInput, timeout = 240000): Promise<T> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeout)
  try {
    const response = await window.fetch(`${_config.API_URL}/${path}`.replace(/([^:]\/)\/+/g, '$1'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    const json = await response.json()
    if (!response.ok) {
      throw new Error(json?.msg || json?.message || `Request failed with status ${response.status}`)
    }
    if (json?.code === 200 && json?.result) {
      return json.result as T
    }
    return json as T
  } finally {
    window.clearTimeout(timer)
  }
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
  }
}

function syncResult(data: Pick<PosterGenerateResult, 'title' | 'slogan' | 'body' | 'cta'>) {
  result.title = data.title || ''
  result.slogan = data.slogan || ''
  result.body = data.body || ''
  result.cta = data.cta || ''
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
  visible.value = true
  applyPreset(form.presetKey)
}

function applyPreset(key: string) {
  const preset = posterPresets.find((item) => item.key === key)
  if (!preset) return
  form.presetKey = preset.key
  form.industry = preset.industry
  form.style = preset.style
  form.purpose = preset.purpose
  form.sizeKey = preset.sizeKey
  if (!form.theme) form.theme = preset.name
}

async function recommendCopyAndPalette() {
  loading.copy = true
  try {
    const payload = getPayload()
    const [copyRes, paletteRes] = await Promise.all([
      requestAi<CopyGenerateResult>('ai/poster/copy', payload, 120000),
      requestAi<PaletteGenerateResult>('ai/poster/palette', payload, 120000),
    ])
    syncResult(copyRes as PosterGenerateResult)
    currentPalette.value = paletteRes.palette
    providerTip.value = [formatProviderMeta(copyRes.providerMeta), formatProviderMeta(paletteRes.providerMeta)].filter(Boolean).join('\n')
  } catch (error) {
    console.error(error)
    ElMessage.error(`推荐失败：${(error as Error).message}`)
  } finally {
    loading.copy = false
  }
}

async function applyPoster() {
  loading.generate = true
  try {
    const poster = await requestAi<PosterGenerateResult>('ai/poster/generate', getPayload(), 240000)
    lastPosterResult.value = poster
    syncResult(poster)
    currentPalette.value = poster.palette
    updateProviderTip(poster.providerMeta)

    const layout = buildPosterLayout({
      input: getPayload(),
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
    ElMessage.warning('当前画布还没有 AI 海报草稿，请先生成海报。')
    return false
  }
  return true
}

async function replaceTextOnly() {
  if (!ensurePosterWidgets()) return
  loading.copy = true
  try {
    const copyRes = await requestAi<CopyGenerateResult>('ai/poster/copy', getPayload(), 120000)
    syncResult(copyRes as PosterGenerateResult)
    replacePosterTexts(widgetStore.dWidgets, getPayload(), {
      title: result.title,
      slogan: result.slogan,
      body: result.body,
      cta: result.cta,
      palette: activePalette.value,
    } as any)
    widgetStore.updateDWidgets()
    providerTip.value = formatProviderMeta(copyRes.providerMeta)
    ElMessage.success('文案已替换。')
  } catch (error) {
    console.error(error)
    ElMessage.error(`换字失败：${(error as Error).message}`)
  } finally {
    loading.copy = false
  }
}

async function applyBackgroundOnly() {
  if (!ensurePosterWidgets()) return
  loading.background = true
  try {
    const backgroundRes = await requestAi<BackgroundGenerateResult>('ai/poster/background', getPayload(), 240000)
    pageStore.setDPage({
      ...pageStore.getDPage(),
      backgroundColor: activePalette.value.background,
      backgroundGradient: backgroundRes.background?.imageUrl ? '' : getPosterGradient(activePalette.value),
      backgroundImage: backgroundRes.background?.imageUrl || '',
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
  if (!ensurePosterWidgets()) return
  loading.image = true
  try {
    const imageRes = await requestAi<ReplaceImageResult>('ai/poster/replace-image', getPayload(), 240000)
    replaceHeroImage(widgetStore.dWidgets, imageRes.hero?.imageUrl || '')
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

function adaptCanvasSize() {
  if (!ensurePosterWidgets()) return
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

async function handleExport(format: 'png' | 'jpg' | 'pdf') {
  try {
    await exportPoster(result.title || form.theme || 'AI海报', format)
    ElMessage.success(`已导出 ${format.toUpperCase()}`)
  } catch (error) {
    console.error(error)
    ElMessage.error(`导出失败：${(error as Error).message}`)
  }
}

defineExpose({ open })
</script>

<style lang="less" scoped>
.assistant {
  .section {
    margin-bottom: 16px;
  }

  .section-title {
    margin-bottom: 10px;
    font-size: 15px;
    font-weight: 600;
    color: #1f2937;
  }

  .preset-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 12px;
  }

  .preset-card {
    padding: 12px;
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
    font-weight: 600;
    color: #111827;
  }

  .preset-meta {
    display: block;
    margin-top: 4px;
    font-size: 12px;
    color: #6b7280;
  }

  .toolbar,
  .actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
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
    margin-bottom: 12px;
    font-size: 15px;
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
    margin-top: 8px;
    color: #92400e;
    font-size: 12px;
    line-height: 1.6;
    white-space: pre-line;
  }

  .tips {
    margin-top: 12px;
    font-size: 12px;
    line-height: 1.7;
    color: #6b7280;
  }
}
</style>
