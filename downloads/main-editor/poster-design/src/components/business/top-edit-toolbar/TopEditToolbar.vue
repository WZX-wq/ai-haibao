<template>
  <div ref="toolbarRef" v-show="visible" class="top-edit-toolbar" :style="toolbarStyle">
    <div class="toolbar-title">{{ titleText }}</div>
    <div class="toolbar-actions toolbar-actions-main">
      <template v-if="activeType === 'w-text'">
        <button class="toolbar-btn toolbar-btn-pill" title="字号增加" @click="nudgeFontSize(1)">A+</button>
        <button class="toolbar-btn toolbar-btn-pill" title="字号减小" @click="nudgeFontSize(-1)">A-</button>
        <span class="toolbar-divider" />
        <button :class="toolbarIconClass(isBoldActive)" title="加粗" @click="toggleTextStyle('fontWeight', ['normal', 'bold'])"><i class="iconfont icon-bold" /></button>
        <button :class="toolbarIconClass(isItalicActive)" title="斜体" @click="toggleTextStyle('fontStyle', ['normal', 'italic'])"><i class="iconfont icon-italic" /></button>
        <button :class="toolbarIconClass(isUnderlineActive)" title="下划线" @click="toggleTextStyle('textDecoration', ['none', 'underline'])"><i class="iconfont icon-underline" /></button>
        <span class="toolbar-divider" />
        <button :class="toolbarIconClass(textAlign === 'left')" title="左对齐" @click="setTextAlign('left')"><i class="iconfont icon-align-left-text" /></button>
        <button :class="toolbarIconClass(textAlign === 'center')" title="居中对齐" @click="setTextAlign('center')"><i class="iconfont icon-align-center-text" /></button>
        <button :class="toolbarIconClass(textAlign === 'right')" title="右对齐" @click="setTextAlign('right')"><i class="iconfont icon-align-right-text" /></button>
      </template>
      <template v-else-if="activeType === 'w-image'">
        <button class="toolbar-btn toolbar-btn-pill" title="提高透明度" @click="nudgeNumber('opacity', 0.05, 0, 1)">透明+</button>
        <button class="toolbar-btn toolbar-btn-pill" title="降低透明度" @click="nudgeNumber('opacity', -0.05, 0, 1)">透明-</button>
        <span class="toolbar-divider" />
        <button class="toolbar-btn toolbar-btn-pill" title="增大圆角" @click="nudgeNumber('radius', 2, 0, 500)">圆角+</button>
        <button class="toolbar-btn toolbar-btn-pill" title="减小圆角" @click="nudgeNumber('radius', -2, 0, 500)">圆角-</button>
        <span class="toolbar-divider" />
        <button :class="toolbarIconClass(imageFlip === 'Y')" title="水平翻转" @click="toggleFlip('Y')"><i class="icon sd-zuoyoufanzhuan" /></button>
        <button :class="toolbarIconClass(imageFlip === 'X')" title="垂直翻转" @click="toggleFlip('X')"><i class="icon sd-shangxiafanzhuan" /></button>
      </template>
      <template v-else-if="activeType === 'w-qrcode'">
        <button class="toolbar-btn toolbar-btn-pill" title="提高透明度" @click="nudgeNumber('opacity', 0.05, 0, 1)">透明+</button>
        <button class="toolbar-btn toolbar-btn-pill" title="降低透明度" @click="nudgeNumber('opacity', -0.05, 0, 1)">透明-</button>
        <span class="toolbar-divider" />
        <button class="toolbar-color-btn" title="深色样式" @click="setWidgetValue('dotColor', '#111827')"><span style="background:#111827" /></button>
        <button class="toolbar-color-btn" title="蓝色样式" @click="setWidgetValue('dotColor', '#1d4ed8')"><span style="background:#1d4ed8" /></button>
        <button class="toolbar-color-btn" title="红色样式" @click="setWidgetValue('dotColor', '#dc2626')"><span style="background:#dc2626" /></button>
      </template>
      <span class="toolbar-divider" />
      <button class="toolbar-icon-btn" title="上一层" @click="moveLayer(1)"><i class="iconfont icon-layer-up" /></button>
      <button class="toolbar-icon-btn" title="下一层" @click="moveLayer(-1)"><i class="iconfont icon-layer-down" /></button>
      <button class="toolbar-icon-btn" title="复制" @click="duplicateActive">
        <el-icon><CopyDocument /></el-icon>
      </button>
      <button :class="toolbarIconClass(isLocked)" :title="isLocked ? '解锁' : '锁定'" @click="toggleLock">
        <i :class="['icon', isLocked ? 'sd-suoding' : 'sd-jiesuo']" />
      </button>
      <button class="toolbar-icon-btn toolbar-icon-btn-danger" title="删除" @click="removeActive">
        <i class="icon sd-delete" />
      </button>
      <span class="toolbar-divider" />
      <template v-if="activeType !== 'w-qrcode'">
        <button class="toolbar-icon-btn" title="左对齐画布" @click="alignToCanvas('left')"><i class="iconfont icon-align-left" /></button>
        <button class="toolbar-icon-btn" title="水平居中" @click="alignToCanvas('ch')"><i class="iconfont icon-align-center-horiz" /></button>
        <button class="toolbar-icon-btn" title="右对齐画布" @click="alignToCanvas('right')"><i class="iconfont icon-align-right" /></button>
      </template>
      <el-popover
        v-model:visible="editorVisible"
        trigger="click"
        placement="bottom-start"
        :width="430"
        popper-class="top-edit-toolbar-editor"
        @show="onEditorShow"
      >
        <template #reference>
          <button class="toolbar-btn toolbar-btn-primary toolbar-btn-pill">编辑</button>
        </template>
        <div class="editor-popover-wrap">
          <component :is="editorComponent" />
        </div>
      </el-popover>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useControlStore, useForceStore, useWidgetStore } from '@/store'
import WTextStyle from '@/components/modules/widgets/wText/wTextStyle.vue'
import WImageStyle from '@/components/modules/widgets/wImage/wImageStyle.vue'
import WQrcodeStyle from '@/components/modules/widgets/wQrcode/wQrcodeStyle.vue'
import { CopyDocument } from '@element-plus/icons-vue'
import type { TUpdateWidgetPayload } from '@/store/design/widget/actions/widget'
import type { TUpdateAlignData } from '@/store/design/widget/actions/align'

const widgetStore = useWidgetStore()
const controlStore = useControlStore()
const forceStore = useForceStore()
const { dActiveElement } = storeToRefs(widgetStore)

const editorVisible = ref(false)
const toolbarRef = ref<HTMLElement | null>(null)
const toolbarStyle = ref<Record<string, string>>({
  left: '-9999px',
  top: '-9999px',
})
const visible = ref(false)
let rafId = 0

const activeType = computed(() => String(dActiveElement.value?.type || ''))
const activeUuid = computed(() => String(dActiveElement.value?.uuid || ''))
const isSupported = computed(() => ['w-text', 'w-image', 'w-qrcode'].includes(activeType.value) && activeUuid.value !== '-1')
const isBoldActive = computed(() => String((dActiveElement.value as any)?.fontWeight || 'normal') === 'bold')
const isItalicActive = computed(() => String((dActiveElement.value as any)?.fontStyle || 'normal') === 'italic')
const isUnderlineActive = computed(() => String((dActiveElement.value as any)?.textDecoration || 'none') === 'underline')
const textAlign = computed(() => String((dActiveElement.value as any)?.textAlign || 'left'))
const isLocked = computed(() => Boolean((dActiveElement.value as any)?.lock))
const imageFlip = computed(() => String((dActiveElement.value as any)?.flip || ''))

const titleText = computed(() => {
  if (activeType.value === 'w-text') return '文字编辑'
  if (activeType.value === 'w-image') return '图片编辑'
  if (activeType.value === 'w-qrcode') return '二维码编辑'
  return '编辑'
})

const editorComponent = computed(() => {
  if (activeType.value === 'w-text') return WTextStyle
  if (activeType.value === 'w-image') return WImageStyle
  return WQrcodeStyle
})

function setWidgetValue(key: TUpdateWidgetPayload['key'], value: TUpdateWidgetPayload['value']) {
  if (!activeUuid.value || activeUuid.value === '-1') return
  widgetStore.updateWidgetData({ uuid: activeUuid.value, key, value })
}

function nudgeFontSize(delta: number) {
  const current = Number((dActiveElement.value as any)?.fontSize || 14)
  const next = Math.max(8, Math.min(300, current + delta))
  setWidgetValue('fontSize', next)
}

function toggleTextStyle(key: TUpdateWidgetPayload['key'], values: [string, string]) {
  const current = String((dActiveElement.value as any)?.[key] ?? values[0])
  const next = current === values[1] ? values[0] : values[1]
  setWidgetValue(key, next)
}

function nudgeNumber(key: TUpdateWidgetPayload['key'], delta: number, min: number, max: number) {
  const current = Number((dActiveElement.value as any)?.[key] ?? 0)
  const next = Math.max(min, Math.min(max, Number((current + delta).toFixed(2))))
  setWidgetValue(key, next)
}

function setTextAlign(value: 'left' | 'center' | 'right') {
  setWidgetValue('textAlign', value)
}

function toolbarIconClass(active = false) {
  return ['toolbar-icon-btn', { 'toolbar-icon-btn-active': active }]
}

function alignToCanvas(align: TUpdateAlignData['align']) {
  if (!activeUuid.value || activeUuid.value === '-1') return
  widgetStore.updateAlign({
    align,
    uuid: activeUuid.value,
  })
}

function moveLayer(value: 1 | -1) {
  if (!activeUuid.value || activeUuid.value === '-1') return
  widgetStore.updateLayerIndex({
    uuid: activeUuid.value,
    value,
  })
}

function duplicateActive() {
  widgetStore.copyWidget()
  widgetStore.pasteWidget()
}

function removeActive() {
  widgetStore.deleteWidget()
}

function toggleLock() {
  setWidgetValue('lock', !isLocked.value)
}

function toggleFlip(axis: 'X' | 'Y') {
  const current = imageFlip.value
  setWidgetValue('flip', current === axis ? null : axis)
}

function updateToolbarPosition() {
  if (!isSupported.value) {
    visible.value = false
    return
  }
  const target = document.getElementById(activeUuid.value)
  if (!target) {
    visible.value = false
    return
  }
  const rect = target.getBoundingClientRect()
  const canvasRect = document.getElementById('page-design-canvas')?.getBoundingClientRect()
  const topNavBottom = document.querySelector('.top-nav')?.getBoundingClientRect().bottom ?? 0
  const toolbarEl = toolbarRef.value
  const toolbarWidth = Math.max(420, Math.min(900, toolbarEl?.offsetWidth || 680))
  const margin = 10
  const canvasCenterX = canvasRect ? (canvasRect.left + canvasRect.right) / 2 : rect.left + rect.width / 2
  const minCenter = margin + toolbarWidth / 2
  const maxCenter = window.innerWidth - margin - toolbarWidth / 2
  const centerX = Math.max(minCenter, Math.min(canvasCenterX, maxCenter))

  // 紧贴画布上沿外侧：用实测高度留白，避免阴影/圆角视觉上压住画布
  /** 首帧 offsetHeight 可能为 0，取合理下限 */
  const toolbarH = Math.max(44, toolbarEl?.offsetHeight || 48)
  const aboveCanvasGap = 45
  const topSafeGap = 4
  let top = rect.top > 74 ? rect.top - toolbarH - topSafeGap : topNavBottom + topSafeGap
  if (canvasRect) {
    const aboveCanvas = canvasRect.top - toolbarH - aboveCanvasGap
    top = Math.max(topNavBottom + topSafeGap, aboveCanvas)
  }
  top = Math.max(top, topNavBottom + topSafeGap)
  toolbarStyle.value = {
    left: `${centerX}px`,
    top: `${top}px`,
    transform: 'translateX(-50%)',
  }
  visible.value = true
}

function tickPosition() {
  updateToolbarPosition()
  if (visible.value) {
    rafId = window.requestAnimationFrame(tickPosition)
  }
}

function startFollow() {
  if (rafId) window.cancelAnimationFrame(rafId)
  rafId = window.requestAnimationFrame(tickPosition)
}

function stopFollow() {
  if (rafId) {
    window.cancelAnimationFrame(rafId)
    rafId = 0
  }
}

function onViewportChange() {
  nextTick(() => updateToolbarPosition())
}

function onEditorShow() {
  controlStore.setLeftPanelMode('setting')
}

watch(
  () => [activeType.value, activeUuid.value] as const,
  () => {
    editorVisible.value = false
    if (isSupported.value) {
      controlStore.setLeftPanelMode('setting')
      nextTick(() => {
        updateToolbarPosition()
        startFollow()
        forceStore.setPaddingLayoutTick()
      })
    } else {
      stopFollow()
      visible.value = false
    }
  },
  { immediate: true },
)

onMounted(() => {
  window.addEventListener('resize', onViewportChange)
  window.addEventListener('scroll', onViewportChange, true)
})

onBeforeUnmount(() => {
  stopFollow()
  window.removeEventListener('resize', onViewportChange)
  window.removeEventListener('scroll', onViewportChange, true)
})
</script>

<style lang="less" scoped>
.top-edit-toolbar {
  position: fixed;
  z-index: 88;
  min-height: 34px;
  max-width: min(84vw, 820px);
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 9px;
  box-shadow: 0 5px 14px rgba(15, 23, 42, 0.1);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  overflow-x: auto;
  overflow-y: hidden;
}

.toolbar-title {
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
  white-space: nowrap;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.toolbar-actions-main {
  white-space: nowrap;
  flex-wrap: nowrap;
}

.toolbar-btn {
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #1e293b;
  border-radius: 7px;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 7px;
  cursor: pointer;
}

.toolbar-btn:hover {
  background: #f8fafc;
}

.toolbar-btn-pill {
  height: 26px;
  line-height: 16px;
  min-width: 32px;
}

.toolbar-btn-primary {
  background: #eff6ff;
  border-color: #bfdbfe;
  color: #1d4ed8;
}

.toolbar-btn-danger:hover {
  background: #fef2f2;
  border-color: #fecaca;
  color: #b91c1c;
}

.toolbar-divider {
  width: 1px;
  height: 18px;
  background: #e2e8f0;
  margin: 0 2px;
}

.toolbar-icon-btn {
  width: 26px;
  height: 26px;
  border: 1px solid #e2e8f0;
  border-radius: 7px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #ffffff;
  color: #0f172a;
  cursor: pointer;
  font-size: 12px;
}

.toolbar-color-btn {
  width: 22px;
  height: 22px;
  border-radius: 5px;
  border: 1px solid #e2e8f0;
  background: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  span {
    width: 12px;
    height: 12px;
    border-radius: 3px;
    display: block;
  }
}

.toolbar-color-btn:hover {
  border-color: #cbd5e1;
}

.toolbar-icon-btn:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
}

.toolbar-icon-btn-active {
  background: #eff6ff;
  border-color: #bfdbfe;
  color: #1d4ed8;
}


:deep(.top-edit-toolbar-editor) {
  padding: 0 !important;
}

.editor-popover-wrap {
  max-height: 62vh;
  overflow: auto;
  padding: 8px 8px 10px;
}
</style>
