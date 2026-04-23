<template>
  <div id="page-design-index" ref="pageDesignIndex" :class="['page-design-bg-color', { 'is-welcome-mode': isWelcomeMode }]">
    <div :class="['page-design-index-wrap', { 'page-design-index-wrap--welcome': isWelcomeMode }]">
      <widget-panel ref="ref2" :class="{ 'mobile-panel-open': state.mobilePanelOpen }" />

      <WorkspaceWelcome v-if="isWelcomeMode" class="page-welcome-wrap" />

      <div v-else class="page-design-shell">
        <design-board ref="designBoardRef" class="page-design-wrap" pageDesignCanvasId="page-design-canvas">
          <div class="shelter" :style="{ width: Math.floor((dPage.width * dZoom) / 100) + 'px', height: Math.floor((dPage.height * dZoom) / 100) + 'px' }"></div>
          <div class="shelter-bg transparent-bg" :style="{ width: Math.floor((dPage.width * dZoom) / 100) + 'px', height: Math.floor((dPage.height * dZoom) / 100) + 'px' }"></div>
          <template #bottom><multipleBoards /></template>
        </design-board>

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
      </div>
    </div>

    <button v-if="state.isMobile && !isWelcomeMode" class="mobile-panel-toggle" @click="toggleMobilePanel" :aria-label="state.mobilePanelOpen ? '关闭面板' : '打开面板'">
      <i v-if="state.mobilePanelOpen" class="icon sd-quxiao"></i>
      <i v-else class="iconfont icon-ego-caidan"></i>
    </button>

    <div v-if="state.isMobile && state.mobilePanelOpen && !isWelcomeMode" class="mobile-panel-overlay" @click="closeMobilePanel"></div>

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
    widgetStore.setDLayouts([{ global: payload.page, layers: payload.widgets }])
    pageStore.setDCurrentPage(0)
    widgetStore.setDWidgets(payload.widgets)
    pageStore.setDPage(payload.page)
    widgetStore.selectWidget({ uuid: payload.widgets[0]?.uuid || '-1' })
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

const { handleKeydowm, handleKeyup, dealCtrl } = shortcuts.methods
let checkCtrl: number | undefined
const instanceFn = { save, zoomAdd, zoomSub }

onMounted(() => {
  groupStore.initGroupJson(JSON.stringify(wGroupSetting))
  document.addEventListener('keydown', handleKeydowm(controlStore, checkCtrl, instanceFn, dealCtrl), false)
  document.addEventListener('keyup', handleKeyup(controlStore, checkCtrl), false)
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

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydowm(controlStore, checkCtrl, instanceFn, dealCtrl), false)
  document.removeEventListener('keyup', handleKeyup(controlStore, checkCtrl), false)
  window.removeEventListener('resize', checkMobile)
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

.editor-action-dock :deep(.watermark-switch-wrap) {
  display: inline-flex;
  align-items: center;
  height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.18);
}

.editor-action-dock :deep(.watermark-switch-wrap .el-switch) {
  height: 22px;
  line-height: 22px;
  --el-switch-height: 22px;
  --el-switch-width: 38px;
  --el-switch-button-size: 18px;
}

.editor-action-dock :deep(.watermark-switch-wrap .el-switch__label) {
  font-size: 12px;
  color: #475569;
  font-weight: 600;
}

.editor-action-dock :deep(.watermark-switch-wrap .el-switch__label.is-active) {
  color: #1d4ed8;
}

.editor-action-dock :deep(.watermark-switch-wrap .el-switch__label.is-inactive) {
  color: #64748b;
}

.editor-action-dock :deep(.watermark-switch-wrap .el-switch.is-text) {
  gap: 6px;
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
    left: 16px;
    bottom: 18px;
    z-index: 30;
    width: 52px;
    height: 52px;
    border: none;
    border-radius: 50%;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 16px 36px rgba(15, 23, 42, 0.16);
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
