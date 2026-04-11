<template>
  <div id="page-design-index" ref="pageDesignIndex" class="page-design-bg-color">
    <div :style="state.style" class="top-nav">
      <div class="top-nav-wrap">
        <div class="top-left">
          <div class="name">{{ state.APP_NAME }}</div>
          <div class="operation">
            <div :class="['operation-item', { disable: !undoable }]" @click="undoable ? handleHistory('undo') : ''"><i class="iconfont icon-undo" /></div>
            <div :class="['operation-item', { disable: !redoable }]" @click="redoable ? handleHistory('redo') : ''"><i class="iconfont icon-redo" /></div>
          </div>
          <el-divider direction="vertical" />
          <Folder @select="dealWith" ref="ref1">
            <div class="operation-item"><i class="icon sd-wenjian" /> <span class="text">{{ ui.file }}</span></div>
          </Folder>
          <el-divider direction="vertical" />
        </div>
        <HeaderOptions ref="optionsRef" v-model="state.isContinue" @change="optionsChange">
          <el-button ref="ref4" size="large" class="primary-btn" type="primary" @click="dealWith('download')">{{ $t('header.download') }}</el-button>
        </HeaderOptions>
      </div>
    </div>

    <div class="page-design-index-wrap">
      <widget-panel ref="ref2"></widget-panel>
      <design-board class="page-design-wrap" pageDesignCanvasId="page-design-canvas">
        <div class="shelter" :style="{ width: Math.floor((dPage.width * dZoom) / 100) + 'px', height: Math.floor((dPage.height * dZoom) / 100) + 'px' }"></div>
        <div class="shelter-bg transparent-bg" :style="{ width: Math.floor((dPage.width * dZoom) / 100) + 'px', height: Math.floor((dPage.height * dZoom) / 100) + 'px' }"></div>
        <template #bottom> <multipleBoards /> </template>
      </design-board>
      <style-panel ref="ref3"></style-panel>
    </div>
    <line-guides :show="state.showLineGuides" />
    <zoom-control ref="zoomControlRef" />
    <right-click-menu />
    <Moveable />
    <ProgressLoading
      :percent="state.downloadPercent"
      :text="state.downloadText"
      :msg="state.downloadMsg"
      :imageSrc="state.downloadImage"
      :cancelText="ui.cancel"
      @cancel="downloadCancel"
      @done="state.downloadPercent = 0"
    />
    <Tour ref="tourRef" :steps="[ref1, ref2, ref3, ref4]" />
    <createDesign ref="createDesignRef" />
  </div>
</template>

<script lang="ts" setup>
import _config from '../config'
import {
  CSSProperties, computed, onBeforeUnmount, onMounted, reactive, ref, Ref,
} from 'vue'
import RightClickMenu from '@/components/business/right-click-menu/RcMenu.vue'
import Moveable from '@/components/business/moveable/Moveable.vue'
import designBoard from '@/components/modules/layout/designBoard/index.vue'
import zoomControl from '@/components/modules/layout/zoomControl/index.vue'
import lineGuides from '@/components/modules/layout/lineGuides.vue'
import shortcuts from '@/mixins/shortcuts'
import HeaderOptions from './components/HeaderOptions.vue'
import Folder from './components/Folder.vue'
import ProgressLoading from '@/components/common/ProgressLoading/download.vue'
import { wGroupSetting } from '@/components/modules/widgets/wGroup/groupSetting'
import { storeToRefs } from 'pinia'
import { useCanvasStore, useControlStore, useHistoryStore, useWidgetStore, useGroupStore } from '@/store'
import type { ButtonInstance } from 'element-plus'
import Tour from './components/Tour.vue'
import createDesign from '@/components/business/create-design'
import multipleBoards from '@/components/modules/layout/multipleBoards'
import useHistory from '@/common/hooks/history'

useHistory()

const ref1 = ref<ButtonInstance>()
const ref2 = ref<any>()
const ref3 = ref<any>()
const ref4 = ref<ButtonInstance>()
const appliedDesignSessionKey = 'aiPosterAppliedDesign'
const ui = {
  file: '\u6587\u4ef6',
  cancel: '\u53d6\u6d88',
} as const
const pageStore = useCanvasStore()

type TState = {
  style: CSSProperties
  downloadPercent: number
  downloadText: string
  downloadMsg: string | undefined
  downloadImage: string
  isContinue: boolean
  APP_NAME: string
  showLineGuides: boolean
}


const widgetStore = useWidgetStore()
const historyStore = useHistoryStore()
const groupStore = useGroupStore()
const { dPage } = storeToRefs(pageStore)
const { dZoom } = storeToRefs(pageStore)
const { dHistoryParams, dHistoryStack } = storeToRefs(useHistoryStore())

const state = reactive<TState>({
  style: {
    left: '0px',
  },
  downloadPercent: 0,
  downloadText: '',
  downloadMsg: '',
  downloadImage: '',
  isContinue: true,
  APP_NAME: _config.APP_NAME,
  showLineGuides: false,
})

const optionsRef = ref<typeof HeaderOptions | null>(null)
const zoomControlRef = ref<typeof zoomControl | null>(null)
const controlStore = useControlStore()
const createDesignRef: Ref<typeof createDesign | null> = ref(null)

const beforeUnload = function (e: Event): any {
  if (dHistoryStack.value.changes.length > 0) {
    const confirmationMessage = '系统不会自动保存你尚未保存的修改内容。'
    ;(e || window.event).returnValue = confirmationMessage as any
    return confirmationMessage
  }
  return false
}

!_config.isDev && window.addEventListener('beforeunload', beforeUnload)

const undoable = computed(() => dHistoryParams.value.stackPointer >= 0)
const redoable = computed(() => !(dHistoryParams.value.stackPointer === dHistoryStack.value.changes.length - 1))

function zoomSub() {
  if (!zoomControlRef.value) return
  zoomControlRef.value.sub()
}

function zoomAdd() {
  if (!zoomControlRef.value) return
  zoomControlRef.value.add()
}

function save() {
  if (!optionsRef.value) return
  optionsRef.value.save()
}

const { handleKeydowm, handleKeyup, dealCtrl } = shortcuts.methods
let checkCtrl: number | undefined
const instanceFn = { save, zoomAdd, zoomSub }

onMounted(() => {
  groupStore.initGroupJson(JSON.stringify(wGroupSetting))
  window.addEventListener('scroll', fixTopBarScroll)
  document.addEventListener('keydown', handleKeydowm(controlStore, checkCtrl, instanceFn, dealCtrl), false)
  document.addEventListener('keyup', handleKeyup(controlStore, checkCtrl), false)
  loadData()
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', fixTopBarScroll)
  document.removeEventListener('keydown', handleKeydowm(controlStore, checkCtrl, instanceFn, dealCtrl), false)
  document.removeEventListener('keyup', handleKeyup(controlStore, checkCtrl), false)
  document.oncontextmenu = null
})

function handleHistory(data: 'undo' | 'redo') {
  historyStore.handleHistory(data)
}

function changeLineGuides() {
  state.showLineGuides = !state.showLineGuides
}

function downloadCancel() {
  state.downloadPercent = 0
  state.downloadImage = ''
  state.isContinue = false
}

function loadData() {
  if (!optionsRef.value) return
  optionsRef.value.load(async () => {
    applyAiPosterDesignIfNeeded()
    if (!zoomControlRef.value) return
    widgetStore.selectWidget({ uuid: '-1' })
  })
}

function applyAiPosterDesignIfNeeded() {
  const raw = sessionStorage.getItem(appliedDesignSessionKey)
  if (!raw) return
  try {
    const payload = JSON.parse(raw)
    if (!payload?.page || !Array.isArray(payload.widgets)) return
    widgetStore.setDLayouts([{ global: payload.page, layers: payload.widgets }])
    pageStore.setDCurrentPage(0)
    widgetStore.setDWidgets(payload.widgets)
    pageStore.setDPage(payload.page)
    widgetStore.selectWidget({ uuid: payload.widgets[0]?.uuid || '-1' })
  } catch (error) {
    console.error('failed to apply ai poster design handoff', error)
  } finally {
    sessionStorage.removeItem(appliedDesignSessionKey)
  }
}

function fixTopBarScroll() {
  const scrollLeft = document.documentElement.scrollLeft || document.body.scrollLeft
  state.style.left = `-${scrollLeft}px`
}

function optionsChange({ downloadPercent, downloadText, downloadMsg, downloadImage }: { downloadPercent: number; downloadText: string; downloadMsg?: string; downloadImage?: string }) {
  state.downloadPercent = downloadPercent
  state.downloadText = downloadText
  state.downloadMsg = downloadMsg
  if (downloadImage !== undefined) {
    state.downloadImage = downloadImage
  }
}

const tourRef = ref<any>()
const fns: any = {
  save: () => {
    optionsRef.value?.save(false)
  },
  download: () => {
    optionsRef.value?.download()
  },
  changeLineGuides,
  newDesign: () => {
    createDesignRef.value?.open()
  },
}

const dealWith = (fnName: string, params?: any) => {
  fns[fnName](params)
}

defineExpose({
  jump2home: () => undefined,
})
</script>

<style lang="less" scoped>
@import url('@/assets/styles/design.less');

.top-nav {
  :deep(.el-divider--vertical) {
    margin: 0 10px;
    border-left-color: rgba(148, 163, 184, 0.32);
  }
}

</style>
