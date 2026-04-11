<template>
  <div class="ai-poster-page">
    <header class="topbar">
      <div class="topbar__content">
        <button class="ghost-btn" type="button" @click="goBack">返回编辑器</button>
        <h1>一句话生成海报</h1>
        <p class="subtitle">先生成预览，再决定是否应用到编辑器。左侧调整只更新预览，不会直接改画布。</p>
      </div>
      <div class="topbar__actions">
        <el-dropdown trigger="click" @command="handleExportCommand">
          <el-button :disabled="!hasPreview">导出</el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="png">导出 PNG</el-dropdown-item>
              <el-dropdown-item command="jpg">导出 JPG</el-dropdown-item>
              <el-dropdown-item command="pdf">导出 PDF</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button plain type="primary" :loading="loading.generate" @click="generatePreview">立即生成</el-button>
        <el-button v-if="hasPreview" type="success" @click="applyToEditor">应用到编辑器精修</el-button>
      </div>
    </header>

    <main class="workspace">
      <aside class="sidebar">
        <div class="sidebar-shell">
          <div class="sidebar-scroll">
            <div class="sidebar-head">
              <div>
                <p class="eyebrow">工作流程</p>
                <h2>先定方向，再细调结果</h2>
              </div>
              <div class="mode-switch">
                <button type="button" :class="['mode-chip', { active: viewState.sidebarMode === 'setup' }]" @click="viewState.sidebarMode = 'setup'">基础设置</button>
                <button
                  type="button"
                  :class="['mode-chip', { active: viewState.sidebarMode === 'refine', disabled: !hasPreview }]"
                  :disabled="!hasPreview"
                  @click="viewState.sidebarMode = 'refine'"
                >
                  微调结果
                </button>
              </div>
            </div>

            <div v-if="viewState.sidebarMode === 'setup'" class="sidebar-body sidebar-body--setup">
              <section class="panel panel--compact">
                <div class="panel__title">
                  <div>
                    <p class="eyebrow">第一步</p>
                    <h3>选一个场景起点</h3>
                  </div>
                  <span class="tag">热门</span>
                </div>
                <div class="preset-grid">
                  <button
                    v-for="preset in posterPresetsTop"
                    :key="preset.key"
                    type="button"
                    :class="['preset-card', { active: form.presetKey === preset.key }]"
                    @click="onSelectPreset(preset.key)"
                  >
                    <strong>{{ preset.name }}</strong>
                    <span>{{ preset.industry }} / {{ preset.style }}</span>
                  </button>
                </div>
                <button class="link-btn link-btn--block" type="button" @click="viewState.showMorePresets = !viewState.showMorePresets">
                  {{ viewState.showMorePresets ? '收起更多场景' : '更多场景' }}
                </button>
                <div v-show="viewState.showMorePresets" class="preset-grid preset-grid--more">
                  <button
                    v-for="preset in posterPresetsMore"
                    :key="preset.key"
                    type="button"
                    :class="['preset-card', { active: form.presetKey === preset.key }]"
                    @click="onSelectPreset(preset.key)"
                  >
                    <strong>{{ preset.name }}</strong>
                    <span>{{ preset.industry }} / {{ preset.style }}</span>
                  </button>
                </div>
              </section>

              <section v-if="templateCandidates.length" class="panel panel--compact">
                <div class="panel__title">
                  <div>
                    <p class="eyebrow">视觉方向</p>
                    <h3>候选模板骨架</h3>
                  </div>
                  <span class="mini-summary">{{ activeDesignPlan?.layoutFamily || 'auto' }}</span>
                </div>
                <div class="candidate-grid">
                  <button
                    v-for="candidate in templateCandidates"
                    :key="candidate.familyId + candidate.layoutFamily"
                    type="button"
                    :class="['candidate-card', { active: isCandidateActive(candidate) }]"
                    @click="useTemplateCandidate(candidate)"
                  >
                    <strong>{{ candidate.title }}</strong>
                    <span>{{ candidate.layoutFamily }} · {{ candidate.tone }}</span>
                  </button>
                </div>
              </section>

            <section class="panel panel--compact">
              <div class="panel__title">
                <div>
                  <p class="eyebrow">第二步</p>
                  <h3>关键参数</h3>
                </div>
                <span class="mini-summary">{{ form.purpose }} · {{ activeSizePreset.name }}</span>
              </div>
              <el-form label-position="top" class="compact-form">
                <el-form-item label="主题">
                  <el-input v-model="form.theme" placeholder="例如：春季上新、健身训练营、门店招聘、会员活动" maxlength="36" show-word-limit />
                </el-form-item>
              </el-form>

              <el-form label-position="top" class="compact-form compact-form--grid">
                <div class="form-grid form-grid--hero">
                  <el-form-item label="行业">
                    <el-select v-model="form.industry" style="width: 100%">
                      <el-option v-for="item in industries" :key="item" :label="item" :value="item" />
                    </el-select>
                  </el-form-item>
                  <el-form-item label="尺寸">
                    <el-select v-model="form.sizeKey" style="width: 100%">
                      <el-option v-for="item in sizePresets" :key="item.key" :label="`${item.name} (${item.width} x ${item.height})`" :value="item.key" />
                    </el-select>
                  </el-form-item>
                </div>
              </el-form>

              <button class="link-btn" type="button" @click="viewState.showAdvanced = !viewState.showAdvanced">
                {{ viewState.showAdvanced ? '收起高级设置' : '展开高级设置' }}
              </button>

              <div v-show="viewState.showAdvanced" class="advanced-block">
                <el-form label-position="top" class="compact-form">
                  <el-form-item label="用途">
                    <div class="chip-row">
                      <button
                        v-for="purpose in purposes"
                        :key="purpose"
                        type="button"
                        :class="['choice-chip', { active: form.purpose === purpose }]"
                        @click="form.purpose = purpose"
                      >
                        {{ purpose }}
                      </button>
                    </div>
                  </el-form-item>
                  <el-form-item label="风格">
                    <el-select v-model="form.style" style="width: 100%">
                      <el-option v-for="item in styles" :key="item" :label="item" :value="item" />
                    </el-select>
                  </el-form-item>
                  <el-form-item label="二维码链接">
                    <el-input v-model="form.qrUrl" placeholder="可选，例如 https://example.com/signup" />
                  </el-form-item>
                  <el-form-item label="补充文案">
                    <el-input
                      v-model="form.content"
                      type="textarea"
                      :rows="4"
                      placeholder="可填写活动时间、地点、卖点、联系方式，AI 会生成更完整的标题和正文"
                    />
                  </el-form-item>
                </el-form>
              </div>
            </section>

          </div>

          <div v-else class="sidebar-body sidebar-body--refine">
            <section class="panel panel--compact">
              <div class="panel__title">
                <div>
                  <p class="eyebrow">快速微调</p>
                  <h3>只更新预览，不改主画布</h3>
                </div>
              </div>
              <div class="button-group">
                <el-button :loading="loading.copy" :disabled="!hasPreview" @click="replaceTextOnly">更新预览文案</el-button>
                <el-button :loading="loading.copy" @click="recommendCopyAndPalette">推荐标题 / 配色</el-button>
                <el-button :loading="loading.image" :disabled="!hasPreview" @click="replaceHeroOnly">更新预览主图</el-button>
                <el-button :loading="loading.background" :disabled="!hasPreview" @click="applyBackgroundOnly">更新预览背景</el-button>
                <el-button :loading="loading.relayout" :disabled="!hasPreview" @click="relayoutPreview">一键重排</el-button>
                <el-button :disabled="!hasPreview" @click="adaptCanvasSize">尺寸适配预览</el-button>
                <el-button v-if="previousLayout" plain @click="viewState.compareMode = !viewState.compareMode">{{ viewState.compareMode ? '返回当前版本' : '查看上一版本' }}</el-button>
              </div>
              <p class="hint">这些操作只会更新当前预览，让你先看结果，再决定要不要应用到编辑器。</p>
            </section>
            <section class="panel panel--compact">
              <div class="panel__title">
                <div>
                  <p class="eyebrow">所见即所得</p>
                  <h3>直接编辑当前结果</h3>
                </div>
              </div>
              <el-form label-position="top" class="compact-form">
                <el-form-item label="主标题"><el-input v-model="result.title" :disabled="!hasPreview" /></el-form-item>
                <el-form-item label="副标题"><el-input v-model="result.slogan" :disabled="!hasPreview" /></el-form-item>
                <el-form-item label="正文"><el-input v-model="result.body" type="textarea" :rows="3" :disabled="!hasPreview" /></el-form-item>
                <el-form-item label="按钮文案"><el-input v-model="result.cta" :disabled="!hasPreview" /></el-form-item>
              </el-form>
              <div class="palette-label">推荐配色</div>
              <div class="palette-swatches">
                <button
                  v-for="color in editableSwatches"
                  :key="color"
                  type="button"
                  :class="['swatch', { active: color === selectedSwatch }]"
                  :style="{ background: color }"
                  :disabled="!hasPreview"
                  @click="selectSwatch(color)"
                />
              </div>
            </section>
          </div>
          </div>

          <div class="sidebar-sticky">
            <div class="action-dock">
              <div class="action-dock__meta">
                <strong>{{ form.theme.trim() || activePreset.name }}</strong>
                <span>{{ activeSizePreset.name }} · {{ form.industry }} · {{ form.style }}</span>
              </div>
              <el-button class="action-dock__button" type="primary" :loading="loading.generate" @click="generatePreview">
                {{ hasPreview ? '重新生成' : '立即生成海报' }}
              </el-button>
            </div>
          </div>
        </div>
      </aside>

      <section class="preview-area">
        <div class="preview-toolbar">
          <div class="meta-row">
            <span class="meta-pill">{{ hasPreview ? '预览已就绪' : '等待生成' }}</span>
            <span>{{ activeSizePreset.name }}</span>
            <span>{{ activeSizePreset.width }} x {{ activeSizePreset.height }}</span>
          </div>
          <div class="zoom-row">
            <button v-for="item in zoomOptions" :key="item.value" type="button" :class="['zoom-chip', { active: viewState.zoomMode === item.value }]" @click="viewState.zoomMode = item.value">{{ item.label }}</button>
          </div>
        </div>
        
        <div ref="previewStageRef" class="preview-frame" :style="previewBackgroundStyle">
          <div v-if="!hasPreview && !loading.generate" class="empty-preview">
            <span class="empty-badge">第 1 版预览</span>
            <h3>输入主题后，约 10–30 秒生成第 1 版</h3>
            <p class="empty-preview__lead">右侧会始终显示预览，无需下载即可确认效果。</p>
            <p class="empty-preview__try">试试这些主题：</p>
            <div class="empty-examples">
              <button v-for="(ex, i) in themeExamples" :key="i" type="button" class="example-chip" @click="applyThemeExample(ex)">{{ ex }}</button>
            </div>
          </div>
          <div v-else class="preview-canvas">
            <design-board class="preview-board" pageDesignCanvasId="page-design-canvas" :padding="previewPadding" :render-d-page="renderPage" :render-d-wdigets="renderWidgets" :zoom="previewZoom" />
            <div v-if="loadingState.active" class="loading-overlay">
              <div class="loading-card">
                <div class="spinner" />
                <strong>{{ loadingState.title }}</strong>
                <p>{{ loadingState.text }}</p>
              </div>
            </div>
          </div>
        </div>
        <footer v-if="hasPreview" class="preview-footer preview-footer--compact">
          <div class="footer-card"><span>最近更新时间</span><strong>{{ lastUpdatedText }}</strong></div>
          <div class="footer-card"><span>当前状态</span><strong>{{ hasUnappliedChanges ? '预览尚未应用到编辑器' : '当前预览已同步完成' }}</strong></div>
        </footer>
      </section>
    </main>

    <div v-if="hasPreview" class="export-stage" aria-hidden="true">
      <design-board
        class="export-board"
        pageDesignCanvasId="page-design-export-canvas"
        :padding="0"
        :render-d-page="renderPage"
        :render-d-wdigets="renderWidgets"
        :zoom="100"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { ElButton, ElDropdown, ElDropdownItem, ElDropdownMenu, ElForm, ElFormItem, ElInput, ElMessage, ElOption, ElSelect } from 'element-plus'
import { customAlphabet } from 'nanoid/non-secure'
import designBoard from '@/components/modules/layout/designBoard/index.vue'
import { useCanvasStore, useWidgetStore } from '@/store'
import type { PosterDesignPlan, PosterGenerateInput, PosterGenerateResult, PosterPalette, PosterTemplateCandidate } from '@/api/ai'
import { generateBackground, generateCopy, generatePalette, generatePoster, relayoutPoster, replacePosterImage } from '@/api/ai'
import { exportPoster } from '@/common/methods/download/exportPoster'
import { buildPosterLayout, getSizePresets, normalizeLayoutFamily, type SizePreset } from '@/components/business/ai-poster-assistant/posterEngine'
import pageDefault from '@/store/design/canvas/page-default'
import type { TPageState } from '@/store/design/canvas/d'
import type { TdWidgetData } from '@/store/design/widget'

type PosterPreset = { key: string; name: string; industry: string; style: string; purpose: string; sizeKey: string }
/** 与 buildPosterLayout 返回结构一致，避免 `|| []` 将 widgets 推断成 unknown[] */
type PosterLayoutSnapshot = {
  page: Record<string, unknown>
  widgets: TdWidgetData[]
  meta?: { layoutFamily?: string; sizeProfile?: string }
}
type PosterPreviewState = {
  current: PosterLayoutSnapshot | null
  previous: PosterLayoutSnapshot | null
  lastUpdatedAt: number
  hasUnappliedChanges: boolean
}
type PosterDraftState = PosterGenerateInput & { presetKey: string }
type PosterViewState = {
  zoomMode: 'fit' | '100' | '150'
  showAdvanced: boolean
  compareMode: boolean
  sidebarMode: 'setup' | 'refine'
  showMorePresets: boolean
}

const routeQueryValue = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

const PRESET_TOP_KEYS = new Set(['campaign', 'recruitment', 'commerce'])

const posterPresets: PosterPreset[] = [
  { key: 'campaign', name: '活动主视觉', industry: '活动', style: '高级简约', purpose: '引流', sizeKey: 'xiaohongshu' },
  { key: 'recruitment', name: '招聘招募', industry: '招聘', style: '专业商务', purpose: '招募', sizeKey: 'moments' },
  { key: 'commerce', name: '电商促销', industry: '电商', style: '活力促销', purpose: '促销', sizeKey: 'ecommerce' },
  { key: 'course', name: '课程招生', industry: '课程', style: '清新温暖', purpose: '报名', sizeKey: 'wechat-cover' },
  { key: 'fitness', name: '健身打卡', industry: '健身', style: '年轻潮流', purpose: '报名', sizeKey: 'xiaohongshu' },
  { key: 'food', name: '餐饮上新', industry: '餐饮', style: '活力促销', purpose: '上新', sizeKey: 'flyer' },
  { key: 'festival', name: '节日营销', industry: '节日', style: '活力促销', purpose: '促销', sizeKey: 'moments' },
]
const posterPresetsTop = computed(() => posterPresets.filter((p) => PRESET_TOP_KEYS.has(p.key)))
const posterPresetsMore = computed(() => posterPresets.filter((p) => !PRESET_TOP_KEYS.has(p.key)))
const themeExamples = ['春季健身房招新，面向大学生', '618 大促倒计时，满减+赠品', '门店新品上市，限时试吃']
const industries = ['电商', '招聘', '活动', '课程', '节日', '健身', '餐饮']
const styles = ['高级简约', '活力促销', '专业商务', '年轻潮流', '清新温暖']
const purposes = ['引流', '报名', '促销', '上新', '招募']
const sizePresets = getSizePresets()
const zoomOptions = [
  { label: '适应屏幕', value: 'fit' as const },
  { label: '100%', value: '100' as const },
  { label: '150%', value: '150' as const },
]
const defaultPalette: PosterPalette = {
  background: '#fff5f0',
  surface: '#ffffff',
  primary: '#ea580c',
  secondary: '#fed7aa',
  text: '#2f1706',
  muted: '#9a3412',
  swatches: ['#fff5f0', '#fed7aa', '#fb923c', '#2f1706'],
}
const nanoid = customAlphabet('1234567890abcdef', 12)

const route = useRoute()
const router = useRouter()
const pageStore = useCanvasStore()
const widgetStore = useWidgetStore()
const form = reactive<PosterDraftState>({
  presetKey: 'campaign',
  theme: '',
  purpose: '引流',
  industry: '活动',
  style: '高级简约',
  sizeKey: 'xiaohongshu',
  content: '',
  qrUrl: '',
})
const result = reactive({ title: '', slogan: '', body: '', cta: '' })
const loading = reactive({ generate: false, copy: false, background: false, image: false, relayout: false })
const viewState = reactive<PosterViewState>({ zoomMode: 'fit', showAdvanced: false, compareMode: false, sidebarMode: 'setup', showMorePresets: false })
const previewState = reactive<PosterPreviewState>({ current: null, previous: null, lastUpdatedAt: 0, hasUnappliedChanges: false })
const currentPalette = ref<PosterPalette>({ ...defaultPalette })
const lastPosterResult = ref<PosterGenerateResult | null>(null)
const selectedLayoutFamily = ref('')
const selectedSwatch = ref('')
const previewStageRef = ref<HTMLElement | null>(null)
const fitZoom = ref(52)
const originalHtmlOverflow = ref('')
const originalBodyOverflow = ref('')
const appliedDesignSessionKey = 'aiPosterAppliedDesign'
const previewBackgroundStyle = computed(() => {
  const palette = currentPalette.value
  return {
    '--preview-primary': palette.primary,
    '--preview-secondary': palette.secondary,
    '--preview-bg': palette.background,
  }
})

function routeQuerySingle(key: string): string | undefined {
  const v = route.query[key]
  if (typeof v === 'string' && v) return v
  if (Array.isArray(v) && typeof v[0] === 'string' && v[0]) return v[0]
  return undefined
}
/** 回到编辑器（或带 tempid 的模板页）；需与 router.push 对象形式兼容，避免 query 丢在 path 里 */
function locationFromReturnTo(raw: string): { path: string; query?: Record<string, string> } {
  const s = raw.trim() || '/home'
  if (!s.startsWith('/')) return { path: '/home' }
  const q = s.indexOf('?')
  if (q === -1) return { path: s }
  const path = s.slice(0, q) || '/home'
  const query: Record<string, string> = {}
  new URLSearchParams(s.slice(q + 1)).forEach((val, key) => {
    query[key] = val
  })
  return Object.keys(query).length ? { path, query } : { path }
}

const returnTo = computed(() => routeQuerySingle('returnTo')?.trim() || '/home')
const activePreset = computed(() => posterPresets.find((item: PosterPreset) => item.key === form.presetKey) || posterPresets[0])
const activeSizePreset = computed<SizePreset>(() => sizePresets.find((item: SizePreset) => item.key === form.sizeKey) || sizePresets[0])
const hasPreview = computed(() => Boolean(previewState.current))
const hasUnappliedChanges = computed(() => previewState.hasUnappliedChanges)
const previousLayout = computed(() => previewState.previous)
const activeLayout = computed(() => (viewState.compareMode && previewState.previous ? previewState.previous : previewState.current))
const editableSwatches = computed(() => (currentPalette.value.swatches?.length ? currentPalette.value.swatches : defaultPalette.swatches))
const previewPadding = computed(() => (previewZoom.value >= 100 ? 56 : 44))
const previewZoom = computed(() => (viewState.zoomMode === '100' ? 100 : viewState.zoomMode === '150' ? 150 : fitZoom.value))
const renderPage = computed<TPageState>(() => createRenderablePage(activeLayout.value?.page || createBlankPage()))
const renderWidgets = computed<TdWidgetData[]>(() => cloneValue(activeLayout.value?.widgets ?? ([] as TdWidgetData[])))
const lastUpdatedText = computed(() =>
  previewState.lastUpdatedAt
    ? new Date(previewState.lastUpdatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '还没有生成预览',
)
const loadingState = computed(() => {
  if (loading.generate) return { active: true, title: '正在生成第 1 版海报（约 10–30 秒）', text: '正在组合文案、配色、背景和主图，请稍候。' }
  if (loading.copy) return { active: true, title: '正在更新文案与配色', text: '会保留已有预览，只替换你刚刚调整的部分。' }
  if (loading.background) return { active: true, title: '正在更新背景', text: '这一轮只刷新预览背景，不会改动编辑器。' }
  if (loading.image) return { active: true, title: '正在更新主图', text: '新的主图准备好后会直接显示在右侧预览里。' }
  return { active: false, title: '', text: '' }
})
const templateCandidates = computed<PosterTemplateCandidate[]>(() => {
  const poster = lastPosterResult.value
  if (!poster) return []
  return poster.templateCandidates || poster.recommendedTemplates || poster.designPlan?.templateCandidates || []
})
const activeDesignPlan = computed<PosterDesignPlan | null>(() => {
  if (!lastPosterResult.value) return null
  const plan = lastPosterResult.value.designPlan
  if (plan) return plan
  return null
})
/** 引擎实际落版的骨架 id（与模板 seed 的 split/price 等可能不同） */
const resolvedLayoutFamily = computed(() => {
  const meta = previewState.current?.meta as { layoutFamily?: string; sizeProfile?: string } | undefined
  return meta?.layoutFamily || normalizeLayoutFamily(activeDesignPlan.value?.layoutFamily || '') || ''
})
const layoutFamilyLabel = computed(() => {
  const m: Record<string, string> = {
    'hero-center': '居中主视觉',
    'hero-left': '左文右图 / 上图下文',
    'split-editorial': '分栏编辑',
    'grid-product': '商品卡陈列',
    'magazine-cover': '杂志封面',
    'festive-frame': '节庆装饰框',
    'list-recruitment': '招聘清单',
    'xiaohongshu-note': '笔记封面',
    'clean-course': '课程信息',
    'premium-offer': '强转化价签',
  }
  return m[resolvedLayoutFamily.value] || resolvedLayoutFamily.value || '自动'
})

const cloneValue = <T,>(value: T): T => {
  if (value === undefined || value === null) return value
  return JSON.parse(JSON.stringify(value))
}
function ensureUniqueWidgetUuids(widgets: TdWidgetData[]) {
  const seen = new Set<string>()
  return widgets.map((widget) => {
    const nextWidget = cloneValue(widget)
    const rawUuid = String(nextWidget.uuid || '')
    if (!rawUuid || rawUuid === '-1' || seen.has(rawUuid)) {
      nextWidget.uuid = nanoid()
    } else {
      nextWidget.uuid = rawUuid
    }
    seen.add(String(nextWidget.uuid))
    if (!nextWidget.parent) {
      nextWidget.parent = '-1'
    }
    return nextWidget
  })
}
function createRenderablePage(page: Partial<TPageState>) {
  return { ...(cloneValue(pageDefault) as TPageState), name: 'AI 海报预览', ...page, backgroundTransform: {} }
}
function createBlankPage() {
  return createRenderablePage({ width: activeSizePreset.value.width, height: activeSizePreset.value.height, backgroundColor: '#fffaf5', backgroundGradient: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 58%, #fed7aa 100%)', backgroundImage: '' })
}
function sizeToResult(size: SizePreset) {
  return { key: size.key, name: size.name, width: size.width, height: size.height }
}
function getPayload(includeAssets = false): PosterGenerateInput {
  const heroUrl = includeAssets ? lastPosterResult.value?.hero?.imageUrl || '' : ''
  return {
    theme: form.theme.trim() || activePreset.value.name,
    purpose: form.purpose.trim() || activePreset.value.purpose,
    sizeKey: form.sizeKey,
    style: form.style,
    industry: form.industry,
    content: form.content.trim(),
    qrUrl: form.qrUrl.trim(),
    sourceImageUrl: heroUrl,
    baseImageUrl: heroUrl,
  }
}
function syncResult(data: Pick<PosterGenerateResult, 'title' | 'slogan' | 'body' | 'cta'>) {
  result.title = data.title || ''
  result.slogan = data.slogan || ''
  result.body = data.body || ''
  result.cta = data.cta || ''
}
function markPreviewUpdated() {
  previewState.lastUpdatedAt = Date.now()
  previewState.hasUnappliedChanges = true
}
function capturePreviousLayout() {
  if (previewState.current) {
    previewState.previous = cloneValue(previewState.current)
    viewState.compareMode = false
  }
}
function rebuildPreviewFromDraft() {
  if (!lastPosterResult.value) return
  const currentPlan = cloneValue(lastPosterResult.value.designPlan || null) as PosterDesignPlan | null
  if (currentPlan && selectedLayoutFamily.value) {
    const n = normalizeLayoutFamily(selectedLayoutFamily.value)
    if (n) currentPlan.layoutFamily = n
  }
  previewState.current = buildPosterLayout({
    input: getPayload(),
    result: {
      ...lastPosterResult.value,
      title: result.title || lastPosterResult.value.title,
      slogan: result.slogan || lastPosterResult.value.slogan,
      body: result.body || lastPosterResult.value.body,
      cta: result.cta || lastPosterResult.value.cta,
      palette: cloneValue(currentPalette.value),
      designPlan: currentPlan || undefined,
      size: sizeToResult(activeSizePreset.value),
    },
  })
  markPreviewUpdated()
}
async function generatePreview() {
  if (loading.generate) return
  loading.generate = true
  try {
    capturePreviousLayout()
    const payload = getPayload()
    const poster = await generatePoster(payload)
    lastPosterResult.value = { ...poster, size: sizeToResult(activeSizePreset.value) }
    selectedLayoutFamily.value =
      normalizeLayoutFamily(poster.designPlan?.layoutFamily || poster.templateCandidates?.[0]?.layoutFamily || '') ||
      String(poster.designPlan?.layoutFamily || poster.templateCandidates?.[0]?.layoutFamily || '')
    currentPalette.value = cloneValue(poster.palette)
    selectedSwatch.value = poster.palette.swatches?.[0] || poster.palette.primary
    syncResult(poster)
    previewState.current = buildPosterLayout({ input: payload, result: { ...poster, size: sizeToResult(activeSizePreset.value) } })
    markPreviewUpdated()
    viewState.sidebarMode = 'refine'
    await nextTick()
    recalcFitZoom()
    ElMessage.success('第 1 版已生成，可继续微调。')
  } catch (error) {
    console.error(error)
    ElMessage.error('生成失败，请重试，已保留你的输入和当前结果。')
  } finally {
    loading.generate = false
  }
}
function useTemplateCandidate(candidate: PosterTemplateCandidate) {
  if (!hasPreview.value || !lastPosterResult.value) return
  selectedLayoutFamily.value = normalizeLayoutFamily(candidate.layoutFamily) || candidate.layoutFamily
  capturePreviousLayout()
  rebuildPreviewFromDraft()
  ElMessage.success(`已切换版式骨架：${candidate.title}`)
}
function isCandidateActive(candidate: PosterTemplateCandidate) {
  const cur =
    normalizeLayoutFamily(selectedLayoutFamily.value) ||
    normalizeLayoutFamily(activeDesignPlan.value?.layoutFamily || '') ||
    ''
  return normalizeLayoutFamily(candidate.layoutFamily) === cur
}
async function recommendCopyAndPalette() {
  if (loading.copy) return
  loading.copy = true
  try {
    const payload = getPayload()
    const [copyRes, paletteRes] = await Promise.all([generateCopy(payload), generatePalette(payload)])
    syncResult(copyRes as unknown as Pick<PosterGenerateResult, 'title' | 'slogan' | 'body' | 'cta'>)
    currentPalette.value = cloneValue(paletteRes.palette)
    selectedSwatch.value = paletteRes.palette.swatches?.[0] || paletteRes.palette.primary
    if (hasPreview.value) {
      capturePreviousLayout()
      rebuildPreviewFromDraft()
    }
    ElMessage.success(hasPreview.value ? '标题和配色已更新到预览。' : '已准备好新的标题和配色建议。')
  } catch (error) {
    console.error(error)
    ElMessage.error('推荐失败，请稍后重试，当前结果已保留。')
  } finally {
    loading.copy = false
  }
}
async function replaceTextOnly() {
  if (!hasPreview.value || loading.copy) return
  loading.copy = true
  try {
    capturePreviousLayout()
    const copyRes = await generateCopy(getPayload())
    syncResult(copyRes as unknown as Pick<PosterGenerateResult, 'title' | 'slogan' | 'body' | 'cta'>)
    rebuildPreviewFromDraft()
    ElMessage.success('预览文案已更新。')
  } catch (error) {
    console.error(error)
    ElMessage.error('更新文案失败，请稍后重试，当前预览已保留。')
  } finally {
    loading.copy = false
  }
}
async function applyBackgroundOnly() {
  if (!hasPreview.value || !lastPosterResult.value || loading.background) return
  loading.background = true
  try {
    capturePreviousLayout()
    const backgroundRes = await generateBackground(getPayload(true))
    lastPosterResult.value = { ...lastPosterResult.value, background: backgroundRes.background, palette: cloneValue(currentPalette.value), size: sizeToResult(activeSizePreset.value) }
    rebuildPreviewFromDraft()
    ElMessage.success('预览背景已更新。')
  } catch (error) {
    console.error(error)
    ElMessage.error('更新背景失败，请稍后重试，当前预览已保留。')
  } finally {
    loading.background = false
  }
}
async function replaceHeroOnly() {
  if (!hasPreview.value || !lastPosterResult.value || loading.image) return
  loading.image = true
  try {
    capturePreviousLayout()
    const imageRes = await replacePosterImage(getPayload(true))
    lastPosterResult.value = { ...lastPosterResult.value, hero: imageRes.hero, palette: cloneValue(currentPalette.value), size: sizeToResult(activeSizePreset.value) }
    rebuildPreviewFromDraft()
    ElMessage.success('预览主图已更新。')
  } catch (error) {
    console.error(error)
    ElMessage.error('更新主图失败，请稍后重试，当前预览已保留。')
  } finally {
    loading.image = false
  }
}

async function relayoutPreview() {
  if (!hasPreview.value || !lastPosterResult.value || loading.relayout) return
  loading.relayout = true
  try {
    capturePreviousLayout()
    const payload = getPayload(true)
    const relayoutRes = await relayoutPoster(payload)
    lastPosterResult.value = {
      ...lastPosterResult.value,
      designPlan: relayoutRes.designPlan,
      palette: cloneValue(currentPalette.value),
      size: sizeToResult(activeSizePreset.value),
    }
    // 让“候选模板骨架”的选中态跟随重排结果
    selectedLayoutFamily.value = normalizeLayoutFamily(relayoutRes.designPlan.layoutFamily) || relayoutRes.designPlan.layoutFamily
    rebuildPreviewFromDraft()
    ElMessage.success('已完成一键重排，可继续微调。')
  } catch (error) {
    console.error(error)
    ElMessage.error('一键重排失败，请稍后重试，当前预览已保留。')
  } finally {
    loading.relayout = false
  }
}
function adaptCanvasSize() {
  if (!hasPreview.value || !lastPosterResult.value) return
  capturePreviousLayout()
  lastPosterResult.value = { ...lastPosterResult.value, palette: cloneValue(currentPalette.value), size: sizeToResult(activeSizePreset.value) }
  rebuildPreviewFromDraft()
  recalcFitZoom()
  ElMessage.success('预览尺寸已适配到当前选择。')
}
function selectSwatch(color: string) {
  if (!hasPreview.value) return
  selectedSwatch.value = color
  currentPalette.value = { ...currentPalette.value, primary: color, swatches: editableSwatches.value.slice() }
  capturePreviousLayout()
  rebuildPreviewFromDraft()
}
async function handleExportCommand(command: string) {
  if (!hasPreview.value) return
  try {
    await nextTick()
    await exportPoster(result.title || form.theme || activePreset.value.name || 'AI海报预览', command as 'png' | 'jpg' | 'pdf', 'page-design-export-canvas')
    ElMessage.success(`导出成功，${command.toUpperCase()} 文件已保存到本地。`)
  } catch (error) {
    console.error(error)
    ElMessage.error('导出失败，请稍后重试。')
  }
}
function applyToEditor() {
  if (!previewState.current) return
  const currentPage = pageStore.getDPage() || createRenderablePage({})
  const nextPage = { ...cloneValue(currentPage), ...(cloneValue(previewState.current.page) as TPageState), backgroundTransform: {} } as TPageState
  const nextWidgets = ensureUniqueWidgetUuids(previewState.current.widgets)
  pageStore.setDPage({ ...currentPage, ...nextPage } as TPageState)
  widgetStore.setDWidgets(nextWidgets)
  widgetStore.selectWidget({ uuid: '-1' })
  sessionStorage.setItem(appliedDesignSessionKey, JSON.stringify({ page: nextPage, widgets: nextWidgets, returnTo: returnTo.value, appliedAt: Date.now() }))
  previewState.hasUnappliedChanges = false
  ElMessage.success('已应用到编辑器，可继续精修文字、图片和布局。')
  router.push(locationFromReturnTo(returnTo.value))
}
async function onSelectPreset(key: string) {
  if (form.presetKey === key) return
  if (hasPreview.value && !window.confirm('切换场景会基于当前输入重新生成预览，是否继续？')) return
  applyPreset(key)
  if (hasPreview.value) await generatePreview()
}
function applyPreset(key: string) {
  const preset = posterPresets.find((item) => item.key === key)
  if (!preset) return
  form.presetKey = preset.key
  form.industry = preset.industry
  form.style = preset.style
  form.purpose = preset.purpose
  form.sizeKey = preset.sizeKey
  if (!form.theme.trim()) form.theme = preset.name
  recalcFitZoom()
}
async function goBack() {
  if (!(await confirmDiscardIfNeeded())) return
  router.push(locationFromReturnTo(returnTo.value))
}
async function confirmDiscardIfNeeded() {
  return !hasUnappliedChanges.value || window.confirm('当前修改尚未应用到编辑器，离开后将丢失，确定离开吗？')
}
function applyThemeExample(text: string) {
  form.theme = text.slice(0, 36)
  viewState.sidebarMode = 'setup'
}
function recalcFitZoom() {
  const stage = previewStageRef.value
  const page = renderPage.value
  if (!stage || !page.width || !page.height) return
  const usableWidth = Math.max(stage.clientWidth - 96, 320)
  const usableHeight = Math.max(stage.clientHeight - 120, 320)
  fitZoom.value = Math.max(18, Math.min(100, Math.floor(Math.min(usableWidth / page.width, usableHeight / page.height) * 100)))
}
function handleBeforeUnload(event: BeforeUnloadEvent) {
  if (!hasUnappliedChanges.value) return
  event.preventDefault()
  event.returnValue = ''
}
onMounted(() => {
  originalHtmlOverflow.value = document.documentElement.style.overflow
  originalBodyOverflow.value = document.body.style.overflow
  document.documentElement.style.overflowY = 'auto'
  document.body.style.overflowY = 'auto'
  const routeTheme = routeQueryValue(route.query.theme)
  const routeIndustry = routeQueryValue(route.query.industry)
  const routeSizeKey = routeQueryValue(route.query.sizeKey)
  const routePresetKey = routeQueryValue(route.query.presetKey) || routeQueryValue(route.query.preset)
  if (routePresetKey) {
    applyPreset(routePresetKey)
  } else {
    applyPreset(form.presetKey)
  }
  if (routeTheme) form.theme = routeTheme
  if (routeIndustry && industries.includes(routeIndustry)) form.industry = routeIndustry
  if (routeSizeKey && sizePresets.some((item: SizePreset) => item.key === routeSizeKey)) form.sizeKey = routeSizeKey
  nextTick(recalcFitZoom)
  window.addEventListener('resize', recalcFitZoom)
  window.addEventListener('beforeunload', handleBeforeUnload)
})
onBeforeUnmount(() => {
  document.documentElement.style.overflow = originalHtmlOverflow.value
  document.body.style.overflow = originalBodyOverflow.value
  window.removeEventListener('resize', recalcFitZoom)
  window.removeEventListener('beforeunload', handleBeforeUnload)
})
onBeforeRouteLeave(async (_to, _from, next) => {
  if (await confirmDiscardIfNeeded()) next()
  else next(false)
})
watch(() => [result.title, result.slogan, result.body, result.cta], () => {
  if (!hasPreview.value || !lastPosterResult.value || loading.generate || loading.copy || loading.background || loading.image) return
  rebuildPreviewFromDraft()
})
watch(() => form.sizeKey, () => {
  nextTick(recalcFitZoom)
})
</script>

<style lang="less" scoped>
.ai-poster-page {
  min-height: 100vh;
  height: auto;
  display: flex;
  flex-direction: column;
  padding: 20px;
  overflow-x: hidden;
  overflow-y: auto;
  color: #1f2937;
  background: radial-gradient(circle at top left, rgba(255, 236, 214, 0.85), transparent 30%), radial-gradient(circle at top right, rgba(216, 236, 255, 0.85), transparent 28%), linear-gradient(180deg, #f7f3ec 0%, #edf4fb 100%);
  font-family: 'Avenir Next', 'PingFang SC', 'Hiragino Sans GB', sans-serif;
}
.topbar,
.sidebar-shell,
.preview-area,
.panel {
  border: 1px solid rgba(255, 255, 255, 0.66);
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 18px 52px rgba(30, 41, 59, 0.08);
  backdrop-filter: blur(18px);
}
.topbar {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 6px 14px;
  margin-bottom: 10px;
  border-radius: 22px;
}
.topbar__content {
  flex: 1;
  max-width: 880px;
}
.topbar__content .ghost-btn {
  margin-bottom: 2px;
}
.topbar h1,
.panel__title h3,
.sidebar-head h2 {
  margin: 2px 0 0;
}
.topbar h1 {
  font-size: 18px;
  line-height: 1.1;
}
.topbar__actions,
.button-group,
.palette-swatches,
.meta-row,
.zoom-row,
.chip-row,
.mode-switch {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.ghost-btn,
.preset-card,
.zoom-chip,
.swatch,
.link-btn,
.choice-chip,
.mode-chip {
  transition: all 0.18s ease;
}
.ghost-btn {
  margin-bottom: 6px;
  padding: 7px 14px;
  border: 1px solid rgba(148, 163, 184, 0.34);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  cursor: pointer;
  font-size: 13px;
}
.ghost-btn:hover,
.preset-card.active,
.preset-card:hover,
.zoom-chip.active,
.choice-chip.active,
.mode-chip.active {
  border-color: rgba(234, 88, 12, 0.45);
  box-shadow: 0 10px 24px rgba(234, 88, 12, 0.12);
  transform: translateY(-1px);
}
.eyebrow {
  margin: 0;
  color: #c2410c;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
.subtitle,
.hint,
.loading-card p,
.empty-preview p,
.action-dock__meta span,
.mini-panel p {
  color: #64748b;
  line-height: 1.7;
}
.subtitle {
  margin: 3px 0 0;
  font-size: 13px;
  line-height: 1.45;
}
.topbar__actions {
  flex-shrink: 0;
  align-self: center;
  gap: 8px;
}
.workspace {
  flex: 1;
  display: grid;
  grid-template-columns: 368px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
  min-height: calc(100vh - 124px);
}
.sidebar {
  min-width: 0;
  height: auto;
  min-height: auto;
}
.sidebar-shell {
  display: flex;
  flex-direction: column;
  gap: 0;
  height: auto;
  min-height: auto;
  overflow: visible;
  padding: 10px;
  border-radius: 22px;
}
.sidebar-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 8px;
}
.sidebar-sticky {
  flex-shrink: 0;
  position: sticky;
  bottom: 0;
  z-index: 2;
  padding-top: 8px;
  margin-top: auto;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, rgba(247, 243, 236, 0.96) 28%, rgba(247, 243, 236, 0.98) 100%);
}
.mini-panel {
  padding: 12px;
  border: 1px solid rgba(226, 232, 240, 0.92);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.92);
}
.mini-panel__title {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
}
.mini-panel__title strong {
  font-size: 14px;
  line-height: 1.35;
}
.sidebar-head {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sidebar-head h2 {
  font-size: 18px;
  line-height: 1.2;
}
.mode-chip,
.choice-chip,
.zoom-chip {
  padding: 6px 10px;
  border: 1px solid rgba(203, 213, 225, 0.9);
  border-radius: 999px;
  background: #fff;
  cursor: pointer;
  font-size: 12px;
}
.mode-chip.disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}
.sidebar-body {
  min-height: auto;
}
.sidebar-body--setup,
.sidebar-body--refine {
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: visible;
}
.sidebar-body--refine { padding-right: 4px; }
.button-group {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.button-group :deep(.el-button) {
  margin: 0;
  width: 100%;
  min-height: 34px;
  padding-inline: 10px;
}
.panel,
.preview-area {
  border-radius: 20px;
  padding: 12px;
}
.panel--compact {
  padding: 12px;
}
.panel__title {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 8px;
}
.panel__title h3 {
  font-size: 16px;
  line-height: 1.2;
}
.mini-summary {
  align-self: flex-start;
  padding: 3px 7px;
  border-radius: 999px;
  background: rgba(15, 118, 110, 0.08);
  color: #0f766e;
  font-size: 10px;
  font-weight: 600;
}
.tag,
.meta-pill,
.empty-badge {
  display: inline-flex;
  align-items: center;
  padding: 5px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
}
.empty-badge {
  background: rgba(255, 255, 255, 0.84);
  color: rgba(15, 23, 42, 0.82);
  border: 1px solid rgba(148, 163, 184, 0.34);
}
.tag {
  background: rgba(254, 215, 170, 0.75);
  color: #9a3412;
}
.meta-pill {
  background: rgba(15, 118, 110, 0.12);
  color: #0f766e;
}
.preset-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.candidate-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}
.preset-card {
  padding: 7px;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 14px;
  background: #fff;
  text-align: left;
  cursor: pointer;
  min-height: 58px;
}
.candidate-card {
  padding: 8px 10px;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 12px;
  background: #fff;
  text-align: left;
  cursor: pointer;
}
.candidate-card strong,
.candidate-card span {
  display: block;
}
.candidate-card strong {
  font-size: 13px;
}
.candidate-card span {
  margin-top: 2px;
  color: #64748b;
  font-size: 12px;
}
.candidate-card.active {
  border-color: rgba(234, 88, 12, 0.45);
  box-shadow: 0 10px 24px rgba(234, 88, 12, 0.12);
}
.preset-card strong,
.preset-card span {
  display: block;
}
.preset-card strong {
  font-size: 13px;
}
.preset-card span,
.palette-label,
.footer-card span,
.quick-field__label {
  color: #64748b;
  font-size: 12px;
}
.compact-form :deep(.el-form-item) {
  margin-bottom: 6px;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.form-grid--triple {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.form-grid--hero {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.compact-form :deep(.el-form-item__label) {
  margin-bottom: 2px;
  line-height: 16px;
  font-size: 13px;
}
.compact-form--grid :deep(.el-form-item) {
  margin-bottom: 0;
}
.panel :deep(.el-input__wrapper),
.panel :deep(.el-select .el-input__wrapper) {
  height: 32px;
  padding-top: 2px;
  padding-bottom: 2px;
}
.quick-field {
  margin-bottom: 8px;
}
.quick-field__label {
  display: block;
  margin-bottom: 6px;
  font-weight: 600;
}
.link-btn {
  padding: 0;
  border: 0;
  background: none;
  color: #2563eb;
  font-weight: 600;
  cursor: pointer;
}
.link-btn--block {
  display: block;
  width: 100%;
  text-align: center;
  margin-top: 8px;
  padding: 6px 0;
  font-size: 13px;
}
.preset-grid--more {
  margin-top: 8px;
}
.advanced-block {
  margin-top: 8px;
}
.palette-label {
  margin-bottom: 8px;
  font-weight: 600;
}
.swatch {
  width: 30px;
  height: 30px;
  border: 2px solid rgba(255, 255, 255, 0.95);
  border-radius: 999px;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.12);
  cursor: pointer;
}
.swatch.active {
  box-shadow: 0 0 0 3px rgba(234, 88, 12, 0.2);
  transform: scale(1.08);
}
.action-dock {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(255, 247, 237, 0.96), rgba(255, 255, 255, 0.96));
  border: 1px solid rgba(251, 191, 36, 0.22);
}
.action-dock__meta {
  min-width: 0;
}
.action-dock__meta strong,
.footer-card strong {
  display: block;
  margin-top: 4px;
}
.action-dock__button {
  flex-shrink: 0;
}
.preview-area {
  min-height: 100%;
  overflow: visible;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.preview-toolbar {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}
.plan-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
}
.plan-strip__card {
  padding: 8px 10px;
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.35);
  border: 1px solid rgba(148, 163, 184, 0.25);
}
.plan-strip__label {
  display: block;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #94a3b8;
  margin-bottom: 4px;
}
.plan-strip__card strong {
  display: block;
  font-size: 13px;
  color: #f1f5f9;
  line-height: 1.35;
}
.plan-strip__hint {
  margin: 6px 0 0;
  font-size: 11px;
  line-height: 1.45;
  color: #94a3b8;
}
.plan-strip__meta {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  font-size: 11px;
  color: #cbd5e1;
  padding-top: 4px;
  border-top: 1px solid rgba(148, 163, 184, 0.2);
}
@media (max-width: 900px) {
  .plan-strip {
    grid-template-columns: 1fr;
  }
}
.preview-frame {
  position: relative;
  flex: 1;
  min-height: 520px;
  overflow: auto;
  padding: 12px;
  border-radius: 18px;
  background:
    radial-gradient(circle at 18% 22%, color-mix(in srgb, var(--preview-secondary, #fed7aa) 22%, transparent) 0%, transparent 46%),
    radial-gradient(circle at 86% 74%, color-mix(in srgb, var(--preview-primary, #ea580c) 18%, transparent) 0%, transparent 52%),
    radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.14), transparent 40%),
    radial-gradient(circle at 50% 112%, rgba(15, 23, 42, 0.14), transparent 54%),
    linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%);
  border: 1px solid rgba(148, 163, 184, 0.35);
}
.preview-frame::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    radial-gradient(circle at 1px 1px, rgba(15, 23, 42, 0.08) 1px, transparent 0);
  background-size: 22px 22px;
  opacity: 0.16;
}
.empty-preview,
.loading-overlay {
  display: flex;
  align-items: center;
  justify-content: center;
}
.empty-preview {
  min-height: 520px;
  flex-direction: column;
  text-align: center;
  padding: 24px 16px;
}
.empty-preview > * {
  position: relative;
  z-index: 1;
}
.empty-preview::before {
  content: '';
  position: absolute;
  inset: 12px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.66);
  border: 1px solid rgba(148, 163, 184, 0.28);
  backdrop-filter: blur(10px);
}
.empty-preview h3 {
  margin: 10px 0 8px;
  font-size: 22px;
  color: #0f172a;
  font-weight: 700;
}
.empty-preview__lead {
  max-width: 520px;
  margin: 0;
  color: rgba(15, 23, 42, 0.68);
  font-size: 15px;
}
.empty-preview__try {
  margin: 20px 0 10px;
  font-size: 13px;
  color: rgba(15, 23, 42, 0.68);
}
.empty-examples {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
  max-width: 560px;
}
.example-chip {
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.55);
  background: rgba(255, 255, 255, 0.78);
  color: #0f172a;
  font-size: 13px;
  cursor: pointer;
  transition: border-color 0.18s ease, background 0.18s ease;
}
.example-chip:hover {
  border-color: rgba(251, 146, 60, 0.55);
  background: rgba(234, 88, 12, 0.12);
}
.preview-canvas,
.preview-board {
  min-height: 520px;
}
.preview-canvas {
  display: flex;
  width: 100%;
  justify-content: center;
  align-items: flex-start;
  overflow: auto;
}
.preview-board {
  width: 100%;
}
.preview-board :deep(.db-root) {
  display: flex;
  justify-content: center;
  overflow: auto;
}
.preview-board :deep(.db-scroll) {
  min-width: 100% !important;
  display: flex;
  justify-content: center;
}
.preview-board :deep(#main) {
  background: transparent;
}
.preview-board :deep(#page-design) {
  padding-inline: 0;
  background: none;
  min-height: auto;
}
.preview-board :deep(.out-page) {
  padding: 0 !important;
  width: auto !important;
  height: auto !important;
  margin: 0 auto;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}
.preview-board :deep(.design-canvas) {
  transform-origin: center top !important;
  box-shadow: 0 22px 55px rgba(0, 0, 0, 0.38);
}
.loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.62);
  backdrop-filter: blur(8px);
}
.loading-card {
  min-width: 280px;
  padding: 22px 24px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.16);
  text-align: center;
}
.loading-card strong {
  display: block;
  margin-top: 12px;
  font-size: 18px;
}
.spinner {
  width: 40px;
  height: 40px;
  margin: 0 auto;
  border: 3px solid rgba(234, 88, 12, 0.18);
  border-top-color: #ea580c;
  border-radius: 999px;
  animation: spin 0.8s linear infinite;
}
.preview-footer {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 10px;
}
.preview-footer--compact {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.export-stage {
  position: fixed;
  left: 0;
  top: 0;
  width: auto;
  height: auto;
  opacity: 0;
  pointer-events: none;
  z-index: -1;
  overflow: visible;
}
.export-board {
  width: max-content;
}
.footer-card {
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(226, 232, 240, 0.92);
}
.footer-card strong {
  font-size: 12px;
  line-height: 1.5;
}
.multiline {
  white-space: pre-line;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@media (min-width: 1181px) {
  .ai-poster-page {
    height: 100vh;
    overflow: hidden;
  }
  .workspace {
    min-height: 0;
    height: calc(100vh - 108px);
    align-items: stretch;
  }
  .sidebar,
  .preview-area {
    min-height: 0;
    height: 100%;
  }
  .sidebar-shell {
    height: 100%;
    overflow: hidden;
  }
  .sidebar-body--setup,
  .sidebar-body--refine {
    min-height: 0;
    overflow: auto;
  }
}
@media (max-width: 1280px) {
  .workspace { grid-template-columns: 340px minmax(0, 1fr); }
}
@media (max-width: 1180px) {
  .workspace { grid-template-columns: 1fr; }
  .sidebar-shell,
  .preview-area { max-height: none; min-height: auto; height: auto; }
}
@media (max-width: 900px) {
  .ai-poster-page { height: auto; min-height: 100vh; padding: 14px; overflow: visible; }
  .workspace { height: auto; }
  .topbar,
  .action-dock,
  .preview-toolbar { flex-direction: column; }
  .topbar {
    width: 100%;
  }
  .preset-grid,
  .preview-footer,
  .form-grid,
  .form-grid--triple,
  .form-grid--hero { grid-template-columns: 1fr; }
  .button-group { grid-template-columns: 1fr; }
  .preview-frame { min-height: 520px; }
}
</style>
