<template>
  <div id="page-design-index" ref="pageDesignIndex" class="page-design-bg-color">
    <!-- 顶部导航 -->
    <div class="top-nav">
      <div class="top-nav-wrap">
        <div class="top-left">
          <div class="name">{{ state.APP_NAME }}</div>
          <el-button size="small" plain class="back-welcome-btn" @click="goWelcome">{{ ui.welcome }}</el-button>
          <div class="operation">
            <div :class="['operation-item', { disable: !undoable }]" @click="undoable ? handleHistory('undo') : ''"><i class="iconfont icon-undo" /></div>
            <div :class="['operation-item', { disable: !redoable }]" @click="redoable ? handleHistory('redo') : ''"><i class="iconfont icon-redo" /></div>
          </div>
          <el-divider direction="vertical" />
          <Folder @select="dealWith" ref="ref1">
            <div class="operation-item"><i class="icon sd-wenjian" /> <span class="text">{{ ui.file }}</span></div>
          </Folder>
          <el-divider direction="vertical" />
          
          <!-- 移动端更多菜单 -->
          <el-dropdown v-if="state.isMobile" trigger="click" class="mobile-more-dropdown">
            <div class="operation-item mobile-more-btn">
              <i class="iconfont icon-ego-caidan" />
            </div>
            <template #dropdown>
              <el-dropdown-menu class="mobile-dropdown-menu">
                <el-dropdown-item @click="dealWith('newDesign')">
                  <i class="icon sd-wenjian" />
                  <span>新建设计</span>
                </el-dropdown-item>
                <el-dropdown-item @click="dealWith('save')">
                  <i class="iconfont icon-save" />
                  <span>保存</span>
                </el-dropdown-item>
                <el-dropdown-item @click="changeLineGuides">
                  <i class="iconfont icon-ruler" />
                  <span>{{ state.showLineGuides ? '隐藏' : '显示' }}辅助线</span>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
        <HeaderOptions ref="optionsRef" v-model="state.isContinue" @change="optionsChange">
          <el-dropdown trigger="click" @command="onDownloadFormatCommand">
            <el-button ref="ref4" class="primary-btn header-download-btn" type="primary">
              {{ $t('header.download') }}
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="png">下载 PNG</el-dropdown-item>
                <el-dropdown-item command="jpg">下载 JPG</el-dropdown-item>
                <el-dropdown-item command="pdf">下载 PDF</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </HeaderOptions>
      </div>
    </div>

    <div class="page-design-index-wrap">
      <!-- 组件面板 -->
      <widget-panel ref="ref2" :class="{ 'mobile-panel-open': state.mobilePanelOpen }"></widget-panel>
      
      <!-- 画布区域 -->
      <design-board class="page-design-wrap" pageDesignCanvasId="page-design-canvas">
        <div class="shelter" :style="{ width: Math.floor((dPage.width * dZoom) / 100) + 'px', height: Math.floor((dPage.height * dZoom) / 100) + 'px' }"></div>
        <div class="shelter-bg transparent-bg" :style="{ width: Math.floor((dPage.width * dZoom) / 100) + 'px', height: Math.floor((dPage.height * dZoom) / 100) + 'px' }"></div>
        <template #bottom> <multipleBoards /> </template>
      </design-board>
      
    </div>
    
    <!-- 移动端面板切换按钮 -->
    <button v-if="state.isMobile" class="mobile-panel-toggle" @click="toggleMobilePanel" :aria-label="state.mobilePanelOpen ? '关闭面板' : '打开面板'">
      <i v-if="state.mobilePanelOpen" class="icon sd-quxiao"></i>
      <i v-else class="iconfont icon-ego-caidan"></i>
    </button>
    
    <!-- 移动端遮罩层 -->
    <div v-if="state.isMobile && state.mobilePanelOpen" class="mobile-panel-overlay" @click="closeMobilePanel"></div>
    
    <!-- 辅助线 -->
    <line-guides :show="state.showLineGuides" />
    
    <!-- 缩放控制 -->
    <zoom-control ref="zoomControlRef" />
    
    <!-- 顶部编辑工具栏 -->
    <TopEditToolbar />
    
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
    <Tour ref="tourRef" :steps="[ref1, ref2, ref4]" />
    <createDesign ref="createDesignRef" />
  </div>
</template>

<script lang="ts" setup>
import _config from '../config'
import {
  computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, Ref, watch,
} from 'vue'
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
import { storeToRefs } from 'pinia'
import { useCanvasStore, useControlStore, useHistoryStore, useWidgetStore, useGroupStore } from '@/store'
import type { ButtonInstance } from 'element-plus'
import { ElDropdown, ElDropdownItem, ElDropdownMenu } from 'element-plus'
import Tour from './components/Tour.vue'
import createDesign from '@/components/business/create-design'
import multipleBoards from '@/components/modules/layout/multipleBoards'
import useHistory from '@/common/hooks/history'
import { useRoute, useRouter } from 'vue-router'
import { deepNormalizeLoopbackMediaUrls } from '@/utils/publicMediaUrl'

useHistory()
const router = useRouter()
const route = useRoute()

const ref1 = ref<ButtonInstance>()
const ref2 = ref<any>()
const ref4 = ref<ButtonInstance>()
const appliedDesignSessionKey = 'aiPosterAppliedDesign'
const ui = {
  file: '\u6587\u4ef6',
  cancel: '\u53d6\u6d88',
  welcome: '\u8fd4\u56de\u9996\u9875',
} as const
const pageStore = useCanvasStore()

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


const widgetStore = useWidgetStore()
const historyStore = useHistoryStore()
const groupStore = useGroupStore()
const { dPage } = storeToRefs(pageStore)
const { dZoom } = storeToRefs(pageStore)
const { dHistoryParams, dHistoryStack } = storeToRefs(useHistoryStore())

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
  document.addEventListener('keydown', handleKeydowm(controlStore, checkCtrl, instanceFn, dealCtrl), false)
  document.addEventListener('keyup', handleKeyup(controlStore, checkCtrl), false)
  checkMobile()
  window.addEventListener('resize', checkMobile)
  loadData()
})

watch(
  () => [route.name, route.query.tempid, route.query.id, route.query.tempType] as const,
  (next, prev) => {
    if (next[0] !== 'Home') return
    if (prev && next[1] === prev[1] && next[2] === prev[2] && next[3] === prev[3]) return
    void nextTick(() => loadData())
  },
)

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydowm(controlStore, checkCtrl, instanceFn, dealCtrl), false)
  document.removeEventListener('keyup', handleKeyup(controlStore, checkCtrl), false)
  window.removeEventListener('resize', checkMobile)
  document.oncontextmenu = null
})

function handleHistory(data: 'undo' | 'redo') {
  historyStore.handleHistory(data)
}

function goWelcome() {
  if (dHistoryStack.value.changes.length > 0) {
    const shouldLeave = window.confirm('当前有未保存修改，确认返回首页吗？')
    if (!shouldLeave) return
  }
  router.push('/welcome')
}

function changeLineGuides() {
  state.showLineGuides = !state.showLineGuides
}

function downloadCancel() {
  state.downloadPercent = 0
  state.downloadImage = ''
  /** isContinue 为 true 时通过 v-model 触发中断；否则直接调用中断，避免 loading 卡住。 */
  if (state.isContinue) {
    state.isContinue = false
  } else {
    optionsRef.value?.abortActiveDownload?.()
  }
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
    const payload = deepNormalizeLoopbackMediaUrls(JSON.parse(raw))
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
  download: (format?: string) => {
    optionsRef.value?.download(format || 'png')
  },
  changeLineGuides,
  newDesign: () => {
    createDesignRef.value?.open()
  },
}

const dealWith = (fnName: string, params?: any) => {
  fns[fnName](params)
}

function onDownloadFormatCommand(cmd: string) {
  dealWith('download', cmd)
}

function checkMobile() {
  state.isMobile = window.innerWidth < 1024
  if (!state.isMobile) {
    state.mobilePanelOpen = false
  }
}

function toggleMobilePanel() {
  state.mobilePanelOpen = !state.mobilePanelOpen
}

function closeMobilePanel() {
  state.mobilePanelOpen = false
}

defineExpose({
  jump2home: () => undefined,
})
</script>

<style lang="less" scoped>
@import url('@/assets/styles/design.less');
@import '@/assets/styles/responsive.less';

// ============================================
@media (min-width: 1024px) {
  #page-design-index {
    min-width: 1180px !important;
    
    .top-nav {
      height: 54px !important;
      min-width: 1180px !important;
      
      .top-nav-wrap {
        height: 54px !important;
        min-width: 1180px !important;
        padding: 0 !important;
      }
    }
    
    .page-design-index-wrap {
      display: flex !important;
      flex-direction: row !important;
      flex: 1 !important;
      height: 100% !important;
      min-height: 0 !important;
      overflow: hidden !important;
      width: 100% !important;
      padding-top: 0 !important;
      background: #eef3f8 !important;
    }
  }
  
  .page-design-wrap {
    flex: 1 !important;
    min-height: 0 !important;
    min-width: 0 !important;
    width: auto !important;
    height: auto !important;
    display: block !important;
  }
  
  .mobile-panel-toggle,
  .mobile-panel-overlay {
    display: none !important;
  }
}

// ============================================
.top-nav {
  :deep(.el-divider--vertical) {
    margin: 0 10px;
    border-left-color: rgba(148, 163, 184, 0.32);
  }

  :deep(.back-welcome-btn) {
    margin-right: 8px;
    border-color: rgba(148, 163, 184, 0.45);
    color: #475569;
  }
}

@media (max-width: 1023px) {
  #page-design-index {
    min-width: 0 !important;
    
    .top-nav {
      min-width: 0;
      height: auto;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 100;
      
      .top-nav-wrap {
        min-width: 0;
        padding: 8px 12px;
        min-height: 48px;
        height: auto;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
        justify-content: space-between;
      }
    }
    
    .page-design-index-wrap {
      padding-top: 100px;
    }
  }
  
  .top-nav {
    :deep(.top-nav-wrap) {
      .top-left {
        display: flex;
        align-items: center;
        gap: 6px;
        flex: 1;
        min-width: 0;
        order: 1;
        
        .name {
          display: none; // 移动端隐藏品牌名称，节省空间
        }
        
        .back-welcome-btn {
          font-size: 11px;
          padding: 5px 10px;
          height: 32px;
          white-space: nowrap;
          flex-shrink: 0;
        }
        
        .el-divider--vertical {
          display: none;
        }
        
        > div:has(.sd-wenjian):not(.mobile-more-dropdown) {
          display: none;
        }
        
        .operation {
          display: flex;
          gap: 5px;
          
          &-item {
            width: 32px;
            height: 32px;
            padding: 0;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 6px;
            background: rgba(248, 250, 252, 0.95);
            border: 1px solid rgba(226, 232, 240, 0.8);
            transition: all 0.2s ease;
            flex-shrink: 0;
            
            .icon,
            .iconfont {
              font-size: 15px;
              color: #475569;
            }
            
            .text {
              display: none;
            }
            
            &:active {
              transform: scale(0.94);
              background: rgba(239, 246, 255, 0.98);
              border-color: rgba(147, 197, 253, 0.6);
              
              .icon,
              .iconfont {
                color: #2563eb;
              }
            }
          }
          
          .disable {
            opacity: 0.3;
            cursor: not-allowed;
            
            &:active {
              transform: none;
              background: rgba(248, 250, 252, 0.95);
              border-color: rgba(226, 232, 240, 0.8);
              
              .icon,
              .iconfont {
                color: #475569;
              }
            }
          }
        }
        
        .mobile-more-dropdown {
          display: flex;
          flex-shrink: 0;
          
          .mobile-more-btn {
            width: 32px;
            height: 32px;
            padding: 0;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 6px;
            background: rgba(248, 250, 252, 0.95);
            border: 1px solid rgba(226, 232, 240, 0.8);
            transition: all 0.2s ease;
            
            .iconfont {
              font-size: 15px;
              color: #475569;
            }
            
            &:active {
              transform: scale(0.94);
              background: rgba(239, 246, 255, 0.98);
              border-color: rgba(147, 197, 253, 0.6);
              
              .iconfont {
                color: #2563eb;
              }
            }
          }
        }
      }
      
      > div:has(.top-icon-wrap) {
        display: contents; // 让子元素直接参与父级 flex 布局
      }
      
      .account-entry {
        order: 0 !important;
        width: 32px;
        height: 32px;
        min-width: 32px;
        min-height: 32px;
        flex-shrink: 0;
        
        &__avatar {
          width: 28px;
          height: 28px;
          
          img {
            width: 100%;
            height: 100%;
          }
        }
        
        &__login-text {
          font-size: 11px;
        }
      }
      
      .top-icon-wrap {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
        order: 2;
        
        > :not(.header-download-btn):not(.account-entry) {
          display: none;
        }
        
        :deep(.el-button) {
          min-height: 32px;
          height: 32px;
          padding: 0 12px;
          font-size: 11px;
          border-radius: 6px;
          white-space: nowrap;
        }
        
        :deep(.header-download-btn) {
          min-height: 32px;
          height: 32px;
          padding: 0 12px;
          font-size: 11px;
          font-weight: 600;
        }
      }
      
      .top-title {
        width: 100%;
        padding: 0;
        order: 3;
        
        .input-wrap {
          width: 100%;
          
          :deep(input) {
            height: 32px;
            font-size: 12px;
            padding: 0 10px;
            border-radius: 6px;
            border: 1px solid rgba(226, 232, 240, 0.8);
            background: rgba(248, 250, 252, 0.6);
            
            &:focus {
              border-color: rgba(147, 197, 253, 0.8);
              background: #ffffff;
            }
          }
        }
      }
    }
    
    :deep(.primary-btn) {
      font-size: 11px;
      padding: 0 12px;
      height: 32px;
    }
  }
  
  :deep(.mobile-dropdown-menu) {
    min-width: 160px;
    
    .el-dropdown-menu__item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      font-size: 12px;
      
      .icon,
      .iconfont {
        font-size: 14px;
        color: #64748b;
      }
      
      span {
        color: #334155;
      }
      
      &:hover {
        background: rgba(239, 246, 255, 0.8);
        
        .icon,
        .iconfont {
          color: #2563eb;
        }
        
        span {
          color: #2563eb;
        }
      }
    }
  }
  
  .page-design-wrap {
    width: 100% !important;
    min-width: 0 !important;
    height: calc(100vh - 100px - 80px - env(safe-area-inset-top) - env(safe-area-inset-bottom)) !important;
    margin-top: 0 !important;
    overflow: auto !important;
    -webkit-overflow-scrolling: touch;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    
    :deep(.ruler),
    :deep(.guide-line) {
      display: none !important;
    }
    
    :deep(.db-scroll) {
      width: 100% !important;
      height: 100% !important;
      overflow: visible !important;
      -webkit-overflow-scrolling: touch;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 20px 0 !important;
    }
    
    :deep(#out-page) {
      margin: auto !important;
    }
    
    :deep(.resize-page) {
      display: none !important;
    }
  }
  
  :deep(.artboards) {
    position: fixed !important;
    bottom: calc(16px + env(safe-area-inset-bottom)) !important;
    left: 16px !important;
    right: auto !important;
    width: auto !important;
    z-index: 90 !important;
    
    &.fold {
      width: auto !important;
      margin-bottom: 0 !important;
      
      .wrap {
        min-width: 120px;
      }
    }
    
    &.unfold {
      width: calc(100vw - 180px) !important;
      max-width: 400px;
    }
  }
  
  :deep(#zoom-control) {
    position: fixed !important;
    right: 16px !important;
    bottom: calc(16px + env(safe-area-inset-bottom)) !important;
    left: auto !important;
    z-index: 90 !important;
    
    .zoom-control-wrap {
      background: rgba(255, 255, 255, 0.94);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(15, 23, 42, 0.08);
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.1);
      overflow: hidden;
      
      .zoom-icon,
      .zoom-text {
        background: transparent;
        border-color: rgba(15, 23, 42, 0.08);
      }
    }
  }
  
  :deep(#widget-panel) {
    position: fixed;
    left: 0;
    top: 60px;
    bottom: 0;
    z-index: 95;
    transform: translateX(-100%);
    transition: transform 0.3s ease;
    box-shadow: 2px 0 12px rgba(15, 23, 42, 0.15);
    
    &.mobile-panel-open {
      transform: translateX(0);
    }
  }
  
  .mobile-panel-toggle {
    position: fixed;
    left: 16px;
    bottom: calc(80px + env(safe-area-inset-bottom));
    z-index: 101;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.98);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(15, 23, 42, 0.08);
    box-shadow: 0 6px 20px rgba(15, 23, 42, 0.18);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    -webkit-tap-highlight-color: transparent;
    
    .iconfont,
    .icon {
      font-size: 22px;
      color: #334155;
    }
    
    &:active {
      transform: scale(0.94);
      background: rgba(239, 246, 255, 0.98);
      
      .iconfont,
      .icon {
        color: #2563eb;
      }
    }
  }
  
  .mobile-panel-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 94;
    background: rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
    animation: fadeIn 0.2s ease;
  }
}

@media (max-width: 600px) {
  .page-design-wrap {
    height: calc(100vh - 100px - 80px - env(safe-area-inset-top) - env(safe-area-inset-bottom)) !important;
  }
}

@media (min-width: 1024px) {
  .mobile-panel-toggle,
  .mobile-panel-overlay {
    display: none !important;
  }
  
  :deep(#widget-panel) {
    position: relative !important;
    transform: none !important;
    top: auto !important;
    bottom: auto !important;
    left: auto !important;
    box-shadow: none !important;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
