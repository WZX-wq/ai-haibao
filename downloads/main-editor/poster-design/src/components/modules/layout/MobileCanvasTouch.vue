<template>
  <div 
    v-if="isMobileOrTablet"
    ref="touchAreaRef"
    class="mobile-canvas-touch"
    @touchstart.prevent="handleTouchStart"
    @touchmove.prevent="handleTouchMove"
    @touchend.prevent="handleTouchEnd"
    @touchcancel.prevent="handleTouchCancel"
  >
    <slot></slot>
  </div>
  <div v-else>
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useResponsive } from '@/common/hooks/useResponsive'
import { getTouchDistance, getTouchAngle } from '@/utils/responsive'
import { useCanvasStore } from '@/store'
import { storeToRefs } from 'pinia'

const emit = defineEmits<{
  tap: [event: TouchEvent]
  longPress: [event: TouchEvent]
  pan: [deltaX: number, deltaY: number, event: TouchEvent]
  pinch: [scale: number, event: TouchEvent]
  rotate: [angle: number, event: TouchEvent]
}>()

const { isMobileOrTablet } = useResponsive()
const canvasStore = useCanvasStore()
const { dZoom } = storeToRefs(canvasStore)

const touchAreaRef = ref<HTMLElement | null>(null)
const isPressed = ref(false)
const isTwoFingerGesture = ref(false)
const longPressTimer = ref<number | null>(null)

let startPosition = { x: 0, y: 0 }
let lastPosition = { x: 0, y: 0 }
let initialDistance = 0
let initialAngle = 0
let lastScale = 1
let lastAngle = 0
let initialZoom = 100

const LONG_PRESS_DELAY = 500
const TAP_THRESHOLD = 10

function handleTouchStart(event: TouchEvent) {
  const touches = event.touches

  if (touches.length === 1) {
    // 单指触摸
    isPressed.value = true
    const touch = touches[0]
    startPosition = { x: touch.clientX, y: touch.clientY }
    lastPosition = { x: touch.clientX, y: touch.clientY }

    // 启动长按计时器
    longPressTimer.value = window.setTimeout(() => {
      if (isPressed.value) {
        emit('longPress', event)
      }
    }, LONG_PRESS_DELAY)
  } else if (touches.length === 2) {
    // 双指触摸
    isTwoFingerGesture.value = true
    clearLongPressTimer()

    // 记录初始距离和角度
    initialDistance = getTouchDistance(touches[0], touches[1])
    initialAngle = getTouchAngle(touches[0], touches[1])
    initialZoom = dZoom.value
    lastScale = 1
    lastAngle = 0
  }
}

function handleTouchMove(event: TouchEvent) {
  const touches = event.touches

  if (touches.length === 1 && isPressed.value && !isTwoFingerGesture.value) {
    // 单指拖动
    clearLongPressTimer()
    const touch = touches[0]
    const currentPosition = { x: touch.clientX, y: touch.clientY }
    const deltaX = currentPosition.x - lastPosition.x
    const deltaY = currentPosition.y - lastPosition.y

    if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
      emit('pan', deltaX, deltaY, event)
    }

    lastPosition = currentPosition
  } else if (touches.length === 2 && isTwoFingerGesture.value) {
    // 双指缩放和旋转
    const currentDistance = getTouchDistance(touches[0], touches[1])
    const currentAngle = getTouchAngle(touches[0], touches[1])

    // 缩放画布
    if (initialDistance > 0) {
      const scale = currentDistance / initialDistance
      if (Math.abs(scale - lastScale) > 0.01) {
        // 计算新的缩放比例
        const newZoom = Math.round(initialZoom * scale)
        const clampedZoom = Math.max(10, Math.min(400, newZoom))
        
        if (clampedZoom !== dZoom.value) {
          canvasStore.updateZoom(clampedZoom)
          emit('pinch', scale, event)
        }
        
        lastScale = scale
      }
    }

    // 旋转（可选，根据需要启用）
    const angleDelta = currentAngle - initialAngle
    if (Math.abs(angleDelta - lastAngle) > 2) {
      emit('rotate', angleDelta, event)
      lastAngle = angleDelta
    }
  }
}

function handleTouchEnd(event: TouchEvent) {
  clearLongPressTimer()

  if (isPressed.value && !isTwoFingerGesture.value) {
    const touch = event.changedTouches[0]
    const endPosition = { x: touch.clientX, y: touch.clientY }
    const distance = Math.sqrt(
      Math.pow(endPosition.x - startPosition.x, 2) + 
      Math.pow(endPosition.y - startPosition.y, 2)
    )

    // 如果移动距离很小，视为点击
    if (distance < TAP_THRESHOLD) {
      emit('tap', event)
    }
  }

  reset()
}

function handleTouchCancel(event: TouchEvent) {
  clearLongPressTimer()
  reset()
}

function clearLongPressTimer() {
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }
}

function reset() {
  isPressed.value = false
  isTwoFingerGesture.value = false
  initialDistance = 0
  initialAngle = 0
  lastScale = 1
  lastAngle = 0
}
</script>

<style lang="less" scoped>
.mobile-canvas-touch {
  width: 100%;
  height: 100%;
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
}
</style>
