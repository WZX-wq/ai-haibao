<template>
  <div v-if="isMobileOrTablet" class="mobile-toolbar-container">
    <!-- 遮罩层 -->
    <div 
      class="mobile-overlay" 
      :class="{ active: showDrawer }"
      @click="closeDrawer"
    ></div>

    <!-- 底部工具栏 -->
    <div class="mobile-toolbar">
      <button 
        class="toolbar-btn"
        :class="{ active: activeTab === 'widgets' }"
        @click="toggleDrawer('widgets')"
      >
        <i class="iconfont icon-widget"></i>
        <span>{{ $t('mobile.widgets') || '组件' }}</span>
      </button>

      <button 
        class="toolbar-btn"
        :class="{ active: activeTab === 'layers' }"
        @click="toggleDrawer('layers')"
      >
        <i class="iconfont icon-layer"></i>
        <span>{{ $t('mobile.layers') || '图层' }}</span>
      </button>

      <button 
        class="toolbar-btn"
        @click="handleUndo"
        :disabled="!undoable"
      >
        <i class="iconfont icon-undo"></i>
        <span>{{ $t('mobile.undo') || '撤销' }}</span>
      </button>

      <button 
        class="toolbar-btn"
        @click="handleRedo"
        :disabled="!redoable"
      >
        <i class="iconfont icon-redo"></i>
        <span>{{ $t('mobile.redo') || '重做' }}</span>
      </button>

      <button 
        class="toolbar-btn toolbar-btn-primary"
        @click="handleExport"
      >
        <i class="iconfont icon-download"></i>
        <span>{{ $t('mobile.export') || '导出' }}</span>
      </button>
    </div>

    <!-- 抽屉面板 -->
    <div class="mobile-drawer" :class="{ active: showDrawer }">
      <div class="drawer-handle"></div>
      <div class="drawer-content">
        <div v-if="activeTab === 'widgets'" class="drawer-section">
          <h3 class="drawer-title">{{ $t('mobile.widgets') || '组件' }}</h3>
          <slot name="widgets"></slot>
        </div>
        <div v-else-if="activeTab === 'layers'" class="drawer-section">
          <h3 class="drawer-title">{{ $t('mobile.layers') || '图层' }}</h3>
          <slot name="layers"></slot>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useResponsive } from '@/common/hooks/useResponsive'
import { useHistoryStore } from '@/store'
import { storeToRefs } from 'pinia'

const emit = defineEmits<{
  undo: []
  redo: []
  export: []
}>()

const { isMobileOrTablet } = useResponsive()
const historyStore = useHistoryStore()
const { dHistoryParams, dHistoryStack } = storeToRefs(historyStore)

const showDrawer = ref(false)
const activeTab = ref<'widgets' | 'layers' | null>(null)

const undoable = computed(() => dHistoryParams.value.stackPointer >= 0)
const redoable = computed(() => !(dHistoryParams.value.stackPointer === dHistoryStack.value.changes.length - 1))

function toggleDrawer(tab: 'widgets' | 'layers') {
  if (activeTab.value === tab && showDrawer.value) {
    closeDrawer()
  } else {
    activeTab.value = tab
    showDrawer.value = true
  }
}

function closeDrawer() {
  showDrawer.value = false
  setTimeout(() => {
    activeTab.value = null
  }, 300)
}

function handleUndo() {
  if (undoable.value) {
    emit('undo')
  }
}

function handleRedo() {
  if (redoable.value) {
    emit('redo')
  }
}

function handleExport() {
  emit('export')
}

defineExpose({
  closeDrawer,
})
</script>

<style lang="less" scoped>
@import '@/assets/styles/responsive.less';

.mobile-toolbar-container {
  @media (max-width: @tablet) {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 1000;
  }
}

.mobile-overlay {
  @media (max-width: @tablet) {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 998;
    background: rgba(15, 23, 42, 0.4);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
    
    &.active {
      opacity: 1;
      pointer-events: auto;
    }
  }
}

.mobile-toolbar {
  @media (max-width: @tablet) {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: space-around;
    gap: 4px;
    padding: 8px 12px;
    padding-bottom: calc(8px + env(safe-area-inset-bottom));
    background: rgba(255, 255, 255, 0.94);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    border-top: 1px solid rgba(15, 23, 42, 0.08);
    box-shadow: 0 -2px 8px rgba(15, 23, 42, 0.04);
  }
}

.toolbar-btn {
  @media (max-width: @tablet) {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    min-height: 48px;
    padding: 6px 8px;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: #64748b;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.18s ease;
    -webkit-tap-highlight-color: transparent;

    i {
      font-size: 20px;
    }

    span {
      font-weight: 510;
      letter-spacing: -0.01em;
    }

    &:active {
      transform: scale(0.95);
      background: rgba(59, 130, 246, 0.08);
    }

    &.active {
      color: #2563eb;
      background: rgba(59, 130, 246, 0.12);
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    &.toolbar-btn-primary {
      color: #ffffff;
      background: #2563eb;
      
      &:active {
        background: #1d4ed8;
      }
    }
  }
}

.mobile-drawer {
  @media (max-width: @tablet) {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 999;
    background: #ffffff;
    border-top-left-radius: 16px;
    border-top-right-radius: 16px;
    border-top: 1px solid rgba(15, 23, 42, 0.08);
    box-shadow: 0 -4px 16px rgba(15, 23, 42, 0.08);
    max-height: 70vh;
    overflow-y: auto;
    transform: translateY(100%);
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    -webkit-overflow-scrolling: touch;
    
    &.active {
      transform: translateY(0);
    }
  }
}

.drawer-handle {
  @media (max-width: @tablet) {
    width: 40px;
    height: 4px;
    background: rgba(15, 23, 42, 0.2);
    border-radius: 2px;
    margin: 12px auto 16px;
  }
}

.drawer-content {
  @media (max-width: @tablet) {
    padding: 0 16px 24px;
    padding-bottom: calc(24px + 64px + env(safe-area-inset-bottom)); // 64px = toolbar height
  }
}

.drawer-section {
  @media (max-width: @tablet) {
    margin-bottom: 24px;
  }
}

.drawer-title {
  @media (max-width: @tablet) {
    font-size: 20px;
    font-weight: 590;
    color: #0f172a;
    margin: 0 0 16px;
    letter-spacing: -0.24px;
  }
}

// 横屏优化
@media (max-width: @tablet) and (orientation: landscape) {
  .mobile-toolbar {
    padding: 6px 12px;
    padding-bottom: calc(6px + env(safe-area-inset-bottom));
  }

  .toolbar-btn {
    min-height: 40px;
    font-size: 10px;

    i {
      font-size: 18px;
    }
  }

  .mobile-drawer {
    max-height: 60vh;
  }
}
</style>
