<template>
  <div id="page-design-index" ref="pageDesignIndex" :class="['page-design-bg-color', { 'is-welcome-mode': isWelcomeMode }]">
    <div :class="['page-design-index-wrap', { 'page-design-index-wrap--welcome': isWelcomeMode }]">
      <widget-panel ref="ref2" :class="{ 'mobile-panel-open': state.mobilePanelOpen }" />

      <WorkspaceWelcome v-if="isWelcomeMode" class="page-welcome-wrap" />

      <div v-else class="page-design-shell">
        <design-board ref="designBoardRef" class="page-design-wrap" pageDesignCanvasId="page-design-canvas">
          <template v-if="showBoardShelter">
            <div class="shelter" :style="boardViewportStyle"></div>
          </template>
        </design-board>

        <div v-if="state.aiPosterLoadingVisible" class="ai-poster-loading-layer">
          <div class="ai-poster-loading-layer__card">
            <div class="ai-poster-loading-layer__eyebrow">{{ state.aiPosterLoadingEyebrow }}</div>
            <div class="ai-poster-loading-layer__title">{{ state.aiPosterLoadingTitle }}</div>
            <div class="ai-poster-loading-layer__desc">{{ state.aiPosterLoadingMessage }}</div>
            <div class="ai-poster-loading-layer__bar">
              <div class="ai-poster-loading-layer__bar-fill" :style="{ width: `${state.aiPosterLoadingPercent}%` }"></div>
            </div>
            <div class="ai-poster-loading-layer__foot">
              <span>{{ state.aiPosterLoadingShowPercent ? `${Math.max(1, Math.round(state.aiPosterLoadingPercent))}%` : (state.aiPosterLoadingPhaseLabel || '处理中…') }}</span>
              <span>别急，正在把画面往顺眼的方向推</span>
            </div>
          </div>
        </div>

        <div class="editor-action-dock">
          <div class="editor-action-dock__tools">
            <button
              type="button"
              :class="['dock-icon-btn', { 'is-disabled': !undoable }]"
              :aria-label="ui.undo"
              @click="undoable ? handleHistory('undo') : undefined"
            >
              <i class="iconfont icon-undo" />
            </button>
            <button
              type="button"
              :class="['dock-icon-btn', { 'is-disabled': !redoable }]"
              :aria-label="ui.redo"
              @click="redoable ? handleHistory('redo') : undefined"
            >
              <i class="iconfont icon-redo" />
            </button>

            <span class="dock-divider" />

            <Folder @select="dealWith">
              <button type="button" class="dock-file-btn">
                <i class="icon sd-wenjian" />
                <span>{{ ui.file }}</span>
              </button>
            </Folder>
          </div>

          <div class="editor-action-dock__options">
            <HeaderOptions ref="optionsRef" v-model="state.isContinue" @change="optionsChange">
              <el-dropdown trigger="click" @command="onDownloadFormatCommand">
                <button type="button" class="dock-primary-btn">
                  {{ ui.download }}
                </button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="png">{{ ui.downloadPng }}</el-dropdown-item>
                    <el-dropdown-item command="jpg">{{ ui.downloadJpg }}</el-dropdown-item>
                    <el-dropdown-item command="pdf">{{ ui.downloadPdf }}</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </HeaderOptions>
          </div>
        </div>

        <multipleBoards />
      </div>
    </div>

    <button
      class="mobile-panel-toggle"
      @click="toggleMobilePanel"
      :aria-label="state.mobilePanelOpen ? '关闭侧栏' : '打开侧栏'"
    >
      <span v-if="state.mobilePanelOpen" class="mobile-panel-toggle__fallback">关闭</span>
      <span v-else class="mobile-panel-toggle__fallback">侧栏</span>
    </button>

    <div v-if="state.isMobile && state.mobilePanelOpen" class="mobile-panel-overlay" @click="closeMobilePanel"></div>

    <line-guides v-if="!isWelcomeMode" :show="state.showLineGuides" />
    <zoom-control v-if="!isWelcomeMode" ref="zoomControlRef" />
    <TopEditToolbar v-if="!isWelcomeMode" />
    <right-click-menu v-if="!isWelcomeMode" />
    <Moveable v-if="!isWelcomeMode" />

    <ProgressLoading
      :percent="state.downloadPercent"
      :text="state.downloadText"
      :msg="state.downloadMsg"
      :imageSrc="state.downloadImage"
      :cancelText="ui.cancel"
      @cancel="downloadCancel"
      @done="state.downloadPercent = 0"
    />
    <createDesign v-if="!isWelcomeMode" ref="createDesignRef" />
  </div>
</template>

<script lang="ts" setup>
import _config from '../config'
import {
  computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, Ref, watch,
} from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { ElDropdown, ElDropdownItem, ElDropdownMenu } from 'element-plus'
import RightClickMenu from '@/components/business/right-click-menu/RcMenu.vue'
import Moveable from '@/components/business/moveable/Moveable.vue'
import TopEditToolbar from '@/components/business/top-edit-toolbar/TopEditToolbar.vue'
import designBoard from '@/components/modules/layout/designBoard/index.vue'
import zoomControl from '@/components/modules/layout/zoomControl/index.vue'
import lineGuides from '@/components/modules/layout/lineGuides.vue'
import widgetPanel from '@/components/modules/panel/widgetPanel.vue'
import shortcuts from '@/mixins/shortcuts'
import HeaderOptions from './components/HeaderOptions.vue'
import Folder from './components/Folder.vue'
import ProgressLoading from '@/components/common/ProgressLoading/download.vue'
import { wGroupSetting } from '@/components/modules/widgets/wGroup/groupSetting'
import { useCanvasStore, useControlStore, useHistoryStore, useWidgetStore, useGroupStore } from '@/store'
import createDesign from '@/components/business/create-design'
import multipleBoards from '@/components/modules/layout/multipleBoards'
import WorkspaceWelcome from '@/components/welcome/WorkspaceWelcome.vue'
import useHistory from '@/common/hooks/history'
import { deepNormalizeLoopbackMediaUrls } from '@/utils/publicMediaUrl'

useHistory()
const route = useRoute()
const router = useRouter()

const pageDesignIndex = ref<HTMLElement | null>(null)
const ref2 = ref<any>()
const appliedDesignSessionKey = 'aiPosterAppliedDesign'
const ui = {
  file: '\u6587\u4ef6',
  cancel: '\u53d6\u6d88',
  undo: '\u64a4\u9500',
  redo: '\u91cd\u505a',
  download: '\u4e0b\u8f7d\u6a21\u677f',
  downloadPng: '\u4e0b\u8f7d PNG',
  downloadJpg: '\u4e0b\u8f7d JPG',
  downloadPdf: '\u4e0b\u8f7d PDF',
} as const

const pageStore = useCanvasStore()
const widgetStore = useWidgetStore()
const historyStore = useHistoryStore()
const groupStore = useGroupStore()
const controlStore = useControlStore()

const { dPage } = storeToRefs(pageStore)
const { dZoom } = storeToRefs(pageStore)
const { dHistoryParams, dHistoryStack } = storeToRefs(useHistoryStore())

type TState = {
  downloadPercent: number
  downloadText: string
  downloadMsg: string | undefined
  downloadImage: string
  aiPosterLoadingVisible: boolean
  aiPosterLoadingPercent: number
  aiPosterLoadingTitle: string
  aiPosterLoadingMessage: string
  aiPosterLoadingEyebrow: string
  aiPosterLoadingPhaseLabel: string
  aiPosterLoadingShowPercent: boolean
  isContinue: boolean
  APP_NAME: string
  showLineGuides: boolean
  isMobile: boolean
  mobilePanelOpen: boolean
}

const state = reactive<TState>({
  downloadPercent: 0,
  downloadText: '',
  downloadMsg: '',
  downloadImage: '',
  aiPosterLoadingVisible: false,
  aiPosterLoadingPercent: 0,
  aiPosterLoadingTitle: '',
  aiPosterLoadingMessage: '',
  aiPosterLoadingEyebrow: 'AI 海报出片中',
  aiPosterLoadingPhaseLabel: '',
  aiPosterLoadingShowPercent: true,
  isContinue: true,
  APP_NAME: _config.APP_NAME,
  showLineGuides: false,
  isMobile: false,
  mobilePanelOpen: false,
})

const optionsRef = ref<typeof HeaderOptions | null>(null)
const zoomControlRef = ref<typeof zoomControl | null>(null)
const designBoardRef = ref<InstanceType<typeof designBoard> | null>(null)
const createDesignRef: Ref<typeof createDesign | null> = ref(null)
const isWelcomeMode = computed(() => String(route.query.section || 'welcome') === 'welcome')
const isAiPosterMode = computed(() => String(route.query.section || '') === 'ai-poster')
const hasAiPosterLayers = computed(() =>
  widgetStore.dWidgets.some((item) => {
    const name = String(item?.name || '').trim()
    return name.startsWith('ai_')
  }),
)
const showBoardShelter = computed(() => !isAiPosterMode.value && !hasAiPosterLayers.value)
const boardViewportStyle = computed(() => ({
  width: Math.floor((Number(dPage.value.width || 0) * Number(dZoom.value || 100)) / 100) + 'px',
  height: Math.floor((Number(dPage.value.height || 0) * Number(dZoom.value || 100)) / 100) + 'px',
}))

type AiPosterLoadingAction = 'generate' | 'copy' | 'image' | 'relayout' | 'recommend'
type AiPosterLoadingMode = 'fast' | 'quality'
type AiPosterLoadingEventDetail = {
  status: 'start' | 'finish'
  action: AiPosterLoadingAction
  mode?: AiPosterLoadingMode
  success?: boolean
}

const AI_POSTER_LOADING_EVENT = 'ai-poster-loading'
const aiPosterLoadingTimer = ref<number | null>(null)
const aiPosterLoadingCloseTimer = ref<number | null>(null)
const aiPosterLoadingPhaseIndex = ref(0)
const aiPosterLoadingStartedAt = ref(0)
const AI_POSTER_LOADING_LONG_WAIT_MS = 18000
const AI_POSTER_LOADING_DEEP_STAGE_MS = 12000

const aiPosterLoadingPhrases: Record<AiPosterLoadingAction, string[]> = {
  generate: [
    '先铺一层灵感底稿',
    '在替你找更顺眼的主视觉',
    '标题和画面正在互相让位',
    '卖点、按钮和节奏感开始归位',
    '最后再压一压成片质感',
  ],
  copy: [
    '标题先瘦身，别让它说废话',
    '副标题正在改成更像海报的短句',
    '把卖点压成能直接上版的词块',
    'CTA 正在换一身更会转化的语气',
  ],
  image: [
    '主视觉正在换一张更搭主题的脸',
    '先把背景情绪拉到同一频道',
    '主体位置在给文字腾安全区',
    '再检查一遍图和文有没有抢戏',
  ],
  relayout: [
    '先给标题腾出第一眼的位置',
    '卡片和按钮正在重新站队',
    '把拥挤的地方慢慢压松一点',
    '最后对齐节奏，让版面更像成片',
  ],
  recommend: [
    '先闻一闻这张海报该是什么气质',
    '文案、配色和语气正在重新配对',
    '把生硬的信息压成更能上版的句子',
    '顺手给画面补一层更舒服的颜色关系',
  ],
}

const beforeUnload = function (e: Event): any {
  if (dHistoryStack.value.changes.length > 0) {
    const confirmationMessage = '\u7cfb\u7edf\u4e0d\u4f1a\u81ea\u52a8\u4fdd\u5b58\u4f60\u5c1a\u672a\u4fdd\u5b58\u7684\u4fee\u6539\u5185\u5bb9\u3002'
    ;(e || window.event).returnValue = confirmationMessage as any
    return confirmationMessage
  }
  return false
}

!_config.isDev && window.addEventListener('beforeunload', beforeUnload)

const undoable = computed(() => dHistoryParams.value.stackPointer >= 0)
const redoable = computed(() => !(dHistoryParams.value.stackPointer === dHistoryStack.value.changes.length - 1))

function zoomSub() {
  zoomControlRef.value?.sub()
}

function zoomAdd() {
  zoomControlRef.value?.add()
}

function save() {
  optionsRef.value?.save()
}

function changeLineGuides() {
  state.showLineGuides = !state.showLineGuides
}

function downloadCancel() {
  state.downloadPercent = 0
  state.downloadImage = ''
  if (state.isContinue) {
    state.isContinue = false
  } else {
    optionsRef.value?.abortActiveDownload?.()
  }
}

function loadData() {
  if (isWelcomeMode.value || !optionsRef.value) return
  optionsRef.value.load(async () => {
    const shouldZoomToPoster = !!(route.query.tempid || route.query.id)
    const appliedAiPoster = applyAiPosterDesignIfNeeded()
    if (shouldZoomToPoster || appliedAiPoster) {
      await forcePosterZoom(40)
    }
    widgetStore.selectWidget({ uuid: '-1' })
  })
}

async function normalizeWelcomeRoute() {
  if (!isWelcomeMode.value) return
  const nextQuery = { ...route.query } as Record<string, string | string[] | undefined>
  let changed = false
  const removableKeys = [
    'id',
    'tempid',
    'tempType',
    'cate',
    'aiTheme',
    'aiPrompt',
    'aiAutoGenerate',
    'aiPurpose',
    'aiIndustry',
    'aiStyle',
    'aiSizeKey',
    'aiQrUrl',
    'aiContent',
    'preset',
  ]

  removableKeys.forEach((key) => {
    if (key in nextQuery) {
      delete nextQuery[key]
      changed = true
    }
  })

  if (!changed) return
  await router.replace({ path: '/home', query: nextQuery, replace: true })
}

async function forcePosterZoom(value: number) {
  const apply = () => {
    zoomControlRef.value?.setZoomValue?.(value)
    designBoardRef.value?.resetViewport?.()
  }
  await nextTick()
  apply()
  window.setTimeout(apply, 0)
  window.setTimeout(apply, 120)
  window.setTimeout(apply, 260)
}

function applyAiPosterDesignIfNeeded() {
  const raw = sessionStorage.getItem(appliedDesignSessionKey)
  if (!raw) return false
  try {
    const payload = deepNormalizeLoopbackMediaUrls(JSON.parse(raw))
    if (!payload?.page || !Array.isArray(payload.widgets)) return false
    pageStore.setDCurrentPage(0)
    widgetStore.setDLayouts([{ global: payload.page, layers: payload.widgets }])
    pageStore.setDPage(payload.page)
    widgetStore.selectWidget({ uuid: '-1' })
    return true
  } catch (error) {
    console.error('failed to apply ai poster design handoff', error)
    return false
  } finally {
    sessionStorage.removeItem(appliedDesignSessionKey)
  }
}

function optionsChange({ downloadPercent, downloadText, downloadMsg, downloadImage }: { downloadPercent: number; downloadText: string; downloadMsg?: string; downloadImage?: string }) {
  state.downloadPercent = downloadPercent
  state.downloadText = downloadText
  state.downloadMsg = downloadMsg
  if (downloadImage !== undefined) {
    state.downloadImage = downloadImage
  }
}

function clearAiPosterLoadingTimers() {
  if (aiPosterLoadingTimer.value) {
    window.clearInterval(aiPosterLoadingTimer.value)
    aiPosterLoadingTimer.value = null
  }
  if (aiPosterLoadingCloseTimer.value) {
    window.clearTimeout(aiPosterLoadingCloseTimer.value)
    aiPosterLoadingCloseTimer.value = null
  }
}

function getAiPosterLoadingMeta(action: AiPosterLoadingAction, mode: AiPosterLoadingMode = 'quality', percent: number) {
  const phrases = aiPosterLoadingPhrases[action] || aiPosterLoadingPhrases.generate
  const index = Math.min(phrases.length - 1, Math.max(0, aiPosterLoadingPhaseIndex.value))
  const title = phrases[index]
  const eyebrowMap: Record<AiPosterLoadingAction, string> = {
    generate: mode === 'fast' ? 'AI 快速起版中' : 'AI 高质量出片中',
    copy: 'AI 正在重写文案',
    image: 'AI 正在重做主图',
    relayout: 'AI 正在重排版式',
    recommend: 'AI 正在润色内容',
  }
  const messageMap: Record<AiPosterLoadingAction, string[]> = {
    generate: [
      '先把主题、风格和画面气质对齐。',
      '主图、标题和信息块正在找彼此舒服的位置。',
      '这一轮会优先保证你看到的是能继续编辑的成片草案。',
    ],
    copy: [
      '这次会把说明句往封面短句和词块方向再压一压。',
      '尽量让标题、副标题和卡片各说各的，不互相复读。',
      '文案会保留成文本图层，改起来还是很轻松。',
    ],
    image: [
      '会先看场景，再决定主体该更满、更轻还是更干净。',
      '顺手会避开一上来就把人物硬塞满画面的老毛病。',
      '图出来后还会再让它给文字留出呼吸区。',
    ],
    relayout: [
      '重点先处理遮挡、重叠、字太小这些肉眼会先皱眉的问题。',
      '能不加底框就不加，只有背景真的吵才会帮文字垫一层。',
      '这一轮主要是把结构拧顺，不是简单挪两下位置。',
    ],
    recommend: [
      '会优先把语气、节奏和配色拧到同一条线上。',
      '不让文案只剩“主题 + 描述”的说明腔。',
      '配色建议会尽量贴近当前画面，而不是另起一套风格。',
    ],
  }
  const msgs = messageMap[action] || messageMap.generate
  const msgIndex = percent < 32 ? 0 : percent < 68 ? 1 : 2
  return {
    eyebrow: eyebrowMap[action],
    title,
    message: msgs[msgIndex],
  }
}

function startAiPosterLoading(action: AiPosterLoadingAction, mode: AiPosterLoadingMode = 'quality') {
  clearAiPosterLoadingTimers()
  aiPosterLoadingPhaseIndex.value = 0
  aiPosterLoadingStartedAt.value = Date.now()
  state.aiPosterLoadingVisible = true
  state.aiPosterLoadingPercent = 6
  state.aiPosterLoadingPhaseLabel = ''
  state.aiPosterLoadingShowPercent = true
  const initial = getAiPosterLoadingMeta(action, mode, state.aiPosterLoadingPercent)
  state.aiPosterLoadingEyebrow = initial.eyebrow
  state.aiPosterLoadingTitle = initial.title
  state.aiPosterLoadingMessage = initial.message
  aiPosterLoadingTimer.value = window.setInterval(() => {
    const current = state.aiPosterLoadingPercent
    const elapsed = Date.now() - aiPosterLoadingStartedAt.value
    const deepStage = elapsed >= AI_POSTER_LOADING_DEEP_STAGE_MS
    const longWait = elapsed >= AI_POSTER_LOADING_LONG_WAIT_MS
    const cap = longWait ? 94 : mode === 'fast' ? 90 : 92
    if (current >= cap) {
      state.aiPosterLoadingPhaseLabel = longWait ? '成片处理中…' : deepStage ? '成片深化中…' : ''
      state.aiPosterLoadingShowPercent = !(deepStage || longWait)
      if (longWait && action === 'generate') {
        state.aiPosterLoadingTitle = mode === 'fast' ? '主图和版式还在收尾' : '正在做最后的成片检查'
        state.aiPosterLoadingMessage = mode === 'fast'
          ? '这轮是质量优先，主图、文案和版式会一起等到能落画布再回来。'
          : '会继续把主图安全区、文字可读性和 CTA 节奏一起压顺。'
      } else if (deepStage && action === 'generate') {
        state.aiPosterLoadingTitle = mode === 'fast' ? '已经进入成片阶段' : '正在继续打磨成片细节'
        state.aiPosterLoadingMessage = mode === 'fast'
          ? '这不是卡住，后面还会继续生成海报；现在主要在等主图、文案和排版一起落稳。'
          : '这一段会比前面的起版慢一些，因为正在做主图、文字和层级的联合收束。'
      }
      return
    }
    const step = current < 28 ? 5 : current < 56 ? 3.5 : current < 78 ? 2.2 : longWait ? 0.5 : 1.1
    const next = Math.min(cap, current + step)
    state.aiPosterLoadingPercent = next
    state.aiPosterLoadingPhaseLabel = longWait ? '成片处理中…' : deepStage ? '成片深化中…' : ''
    state.aiPosterLoadingShowPercent = !(deepStage || longWait)
    const phaseCount = aiPosterLoadingPhrases[action]?.length || 1
    aiPosterLoadingPhaseIndex.value = Math.min(phaseCount - 1, Math.floor((next / 100) * phaseCount))
    const meta = getAiPosterLoadingMeta(action, mode, next)
    state.aiPosterLoadingEyebrow = meta.eyebrow
    state.aiPosterLoadingTitle = meta.title
    state.aiPosterLoadingMessage = meta.message
  }, 950)
}

function finishAiPosterLoading(action: AiPosterLoadingAction, mode: AiPosterLoadingMode = 'quality', success = true) {
  clearAiPosterLoadingTimers()
  state.aiPosterLoadingPercent = 100
  state.aiPosterLoadingPhaseLabel = success ? '已完成' : ''
  state.aiPosterLoadingShowPercent = false
  state.aiPosterLoadingEyebrow = success ? '马上出片' : '这次没完全接住'
  state.aiPosterLoadingTitle = success ? '收最后一笔，准备把海报放上来' : '灵感有点卡壳，先把现场收一收'
  state.aiPosterLoadingMessage = success
    ? getAiPosterLoadingMeta(action, mode, 100).message
    : '你可以直接再点一次，系统会重新拉起这一轮生成。'
  aiPosterLoadingCloseTimer.value = window.setTimeout(() => {
    state.aiPosterLoadingVisible = false
    state.aiPosterLoadingPercent = 0
    state.aiPosterLoadingPhaseLabel = ''
    state.aiPosterLoadingShowPercent = true
  }, success ? 420 : 900)
}

function handleAiPosterLoadingEvent(event: Event) {
  const detail = (event as CustomEvent<AiPosterLoadingEventDetail>).detail
  if (!detail?.action || !detail?.status) return
  if (detail.status === 'start') {
    startAiPosterLoading(detail.action, detail.mode || 'quality')
    return
  }
  finishAiPosterLoading(detail.action, detail.mode || 'quality', detail.success !== false)
}

function handleHistory(data: 'undo' | 'redo') {
  historyStore.handleHistory(data)
}

const fns: Record<string, (params?: any) => void> = {
  save: () => optionsRef.value?.save(false),
  download: (format?: string) => optionsRef.value?.download(format || 'png'),
  changeLineGuides,
  newDesign: () => createDesignRef.value?.open(),
}

const dealWith = (fnName: string, params?: any) => {
  fns[fnName]?.(params)
}

function onDownloadFormatCommand(cmd: string) {
  dealWith('download', cmd)
}

function checkMobile() {
  state.isMobile = window.innerWidth < 1024
  if (!state.isMobile) state.mobilePanelOpen = false
}

function toggleMobilePanel() {
  state.mobilePanelOpen = !state.mobilePanelOpen
}

function closeMobilePanel() {
  state.mobilePanelOpen = false
}

function syncAiPosterEmptyCanvasBackground() {
  const page = pageStore.getDPage() as any
  const transparentBackgroundColor = '#ffffff00'
  const defaultBackgroundColor = '#ffffffff'
  const isPlainTransparentBackground = (
    String(page?.backgroundColor || '').toLowerCase() === transparentBackgroundColor &&
    !String(page?.backgroundGradient || '').trim() &&
    !String(page?.backgroundImage || '').trim()
  )

  if (!isAiPosterMode.value || widgetStore.dWidgets.length > 0) {
    if (!isPlainTransparentBackground) return
    pageStore.setDPage({
      ...page,
      backgroundColor: defaultBackgroundColor,
      backgroundGradient: '',
      backgroundImage: '',
      backgroundTransform: {},
    } as any)
    return
  }

  if (
    isPlainTransparentBackground
  ) {
    return
  }
  pageStore.setDPage({
    ...page,
    backgroundColor: transparentBackgroundColor,
    backgroundGradient: '',
    backgroundImage: '',
    backgroundTransform: {},
  } as any)
}

const { handleKeydowm, handleKeyup, dealCtrl } = shortcuts.methods
let checkCtrl: number | undefined
const instanceFn = { save, zoomAdd, zoomSub }

onMounted(() => {
  groupStore.initGroupJson(JSON.stringify(wGroupSetting))
  document.addEventListener('keydown', handleKeydowm(controlStore, checkCtrl, instanceFn, dealCtrl), false)
  document.addEventListener('keyup', handleKeyup(controlStore, checkCtrl), false)
  window.addEventListener(AI_POSTER_LOADING_EVENT, handleAiPosterLoadingEvent as EventListener)
  checkMobile()
  window.addEventListener('resize', checkMobile)
  loadData()
})

watch(
  () => [route.name, route.query.tempid, route.query.id, route.query.tempType, route.query.section] as const,
  (next, prev) => {
    if (next[0] !== 'Home') return
    if (isWelcomeMode.value) return
    if (prev && next[1] === prev[1] && next[2] === prev[2] && next[3] === prev[3] && next[4] === prev[4]) return
    void nextTick(() => loadData())
  },
)

watch(
  () => isWelcomeMode.value,
  (welcome) => {
    if (welcome) {
      void normalizeWelcomeRoute()
      return
    }
    void nextTick(() => loadData())
  },
  { immediate: true },
)

watch(
  () => [
    isAiPosterMode.value,
    widgetStore.dWidgets.length,
    dPage.value.backgroundColor,
    dPage.value.backgroundGradient,
    dPage.value.backgroundImage,
  ] as const,
  () => {
    syncAiPosterEmptyCanvasBackground()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydowm(controlStore, checkCtrl, instanceFn, dealCtrl), false)
  document.removeEventListener('keyup', handleKeyup(controlStore, checkCtrl), false)
  window.removeEventListener(AI_POSTER_LOADING_EVENT, handleAiPosterLoadingEvent as EventListener)
  window.removeEventListener('resize', checkMobile)
  clearAiPosterLoadingTimers()
  document.oncontextmenu = null
})

defineExpose({
  jump2home: () => undefined,
})
</script>

<style lang="less" scoped>
@import url('@/assets/styles/design.less');
@import '@/assets/styles/responsive.less';

#page-design-index {
  display: flex;
  height: 100vh;
  min-width: 1180px;
  background: #eef3f8;
}

.page-design-index-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
}

.page-design-index-wrap--welcome {
  background: linear-gradient(180deg, #f5fbff 0%, #f8f7ff 100%);
}

.page-welcome-wrap,
.page-design-shell,
.page-design-wrap {
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.page-design-shell {
  position: relative;
}

.page-design-wrap {
  position: relative;
  display: block;
}

.ai-poster-loading-layer {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ai-poster-loading-layer {
  z-index: 28;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.28) 0%, rgba(241, 245, 249, 0.52) 100%);
  backdrop-filter: blur(10px);
}

.ai-poster-loading-layer__card {
  width: min(460px, calc(100% - 40px));
  padding: 22px 22px 18px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(226, 232, 240, 0.92);
  box-shadow: 0 22px 48px rgba(15, 23, 42, 0.14);
}

.ai-poster-loading-layer__eyebrow {
  margin-bottom: 8px;
  color: #7c3aed;
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
}

.ai-poster-loading-layer__title {
  color: #0f172a;
  font-size: 24px;
  font-weight: 800;
  line-height: 1.2;
}

.ai-poster-loading-layer__desc {
  margin-top: 10px;
  color: #475569;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.6;
}

.ai-poster-loading-layer__bar {
  margin-top: 18px;
  height: 10px;
  border-radius: 999px;
  background: rgba(226, 232, 240, 0.9);
  overflow: hidden;
}

.ai-poster-loading-layer__bar-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(135deg, #a17bfd 0%, #976dfd 58%, #8757fb 100%);
  box-shadow: 0 8px 18px rgba(151, 109, 253, 0.28);
  transition: width 0.5s ease;
}

.ai-poster-loading-layer__foot {
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.4;
}

.editor-action-dock {
  position: absolute;
  top: 10px;
  left: 12px;
  right: 12px;
  z-index: 26;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  pointer-events: none;
}

.editor-action-dock__tools,
.editor-action-dock__options {
  pointer-events: auto;
}

.editor-action-dock__tools {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 6px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(226, 232, 240, 0.9);
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(10px);
}

.dock-icon-btn,
.dock-file-btn,
.dock-primary-btn {
  border: none;
  background: transparent;
  color: #334155;
  transition: background-color 0.18s ease, color 0.18s ease, opacity 0.18s ease;
}

.dock-icon-btn {
  width: 30px;
  height: 30px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  cursor: pointer;
}

.dock-icon-btn:hover,
.dock-file-btn:hover {
  background: rgba(241, 245, 249, 0.92);
  color: #0f172a;
}

.dock-icon-btn.is-disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.dock-divider {
  width: 1px;
  height: 18px;
  background: rgba(148, 163, 184, 0.32);
}

.dock-file-btn {
  height: 30px;
  padding: 0 10px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.editor-action-dock__options {
  min-width: 0;
  max-width: min(100%, 620px);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(226, 232, 240, 0.92);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(10px);
  padding: 4px 6px;
}

.dock-primary-btn {
  min-width: 104px;
  height: 30px;
  padding: 0 14px;
  border-radius: 999px;
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 8px 16px rgba(37, 99, 235, 0.18);
}

.dock-primary-btn:hover {
  background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
}

.editor-action-dock :deep(.top-title) {
  padding-left: 0;
  padding-right: 8px;
}

.editor-action-dock :deep(.top-title .input-wrap) {
  width: 128px;
}

.editor-action-dock :deep(.top-title .input-wrap input) {
  height: 30px;
  border-radius: 10px;
  background: rgba(248, 250, 252, 0.96);
  border-color: rgba(148, 163, 184, 0.2);
  font-size: 12px;
  padding-left: 10px;
}

.editor-action-dock :deep(.top-icon-wrap) {
  gap: 6px;
  min-height: 30px;
  height: 30px;
  padding-right: 0;
  align-items: center;
  min-width: 0;
}

.editor-action-dock :deep(.top-icon-wrap .el-button) {
  min-height: 30px;
  height: 30px;
  border-radius: 999px;
  padding: 0 8px;
  background: rgba(255, 255, 255, 0.88);
  font-size: 12px;
  font-weight: 600;
  color: #334155;
}

.editor-action-dock :deep(.top-icon-wrap .el-button span) {
  color: inherit;
}

.editor-action-dock :deep(.top-icon-wrap .el-button--primary.is-plain),
.editor-action-dock :deep(.top-icon-wrap .el-button--primary.is-plain:hover),
.editor-action-dock :deep(.top-icon-wrap .el-button--primary.is-plain:focus) {
  color: #1d4ed8;
  background: rgba(239, 246, 255, 0.98);
  border-color: rgba(59, 130, 246, 0.28);
  box-shadow: inset 0 0 0 1px rgba(59, 130, 246, 0.08);
}

.editor-action-dock :deep(.top-icon-wrap > *) {
  display: inline-flex;
  align-items: center;
  height: 30px;
}

.editor-action-dock :deep(.account-entry) {
  display: none;
}

.mobile-panel-toggle,
.mobile-panel-overlay {
  display: none;
}

@media (max-width: 1023px) {
  #page-design-index {
    min-width: 0;
  }

  .page-design-index-wrap {
    position: relative;
  }

  .editor-action-dock {
    top: 8px;
    left: 8px;
    right: 8px;
    flex-direction: column;
    align-items: stretch;
  }

  .editor-action-dock__options {
    width: 100%;
  }

  .editor-action-dock :deep(.top-title .input-wrap) {
    width: 100%;
  }

  .editor-action-dock :deep(.top-icon-wrap) {
    flex-wrap: wrap;
  }

  .ai-poster-loading-layer__card {
    width: min(360px, calc(100% - 24px));
    padding: 18px 16px 16px;
    border-radius: 18px;
  }

  .ai-poster-loading-layer__title {
    font-size: 20px;
  }

  .ai-poster-loading-layer__desc {
    font-size: 13px;
  }

  .ai-poster-loading-layer__foot {
    flex-direction: column;
    align-items: flex-start;
  }

  :deep(#widget-panel) {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 25;
    transform: translateX(-100%);
    transition: transform 0.3s ease;
    box-shadow: 8px 0 24px rgba(15, 23, 42, 0.15);
  }

  :deep(#widget-panel.mobile-panel-open) {
    transform: translateX(0);
  }

  .mobile-panel-toggle {
    display: flex;
    position: fixed;
    right: 12px;
    bottom: calc(18px + env(safe-area-inset-bottom));
    z-index: 1300;
    min-width: 64px;
    height: 48px;
    padding: 0 14px;
    border: 1px solid rgba(255, 255, 255, 0.7);
    border-radius: 999px;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #6d5efc 0%, #5b4cf5 100%);
    box-shadow: 0 12px 30px rgba(88, 76, 245, 0.45);
  }

  .mobile-panel-toggle__fallback {
    font-size: 14px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: 0.02em;
    line-height: 1;
  }

  .mobile-panel-overlay {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 24;
    background: rgba(15, 23, 42, 0.4);
  }

}
</style>
