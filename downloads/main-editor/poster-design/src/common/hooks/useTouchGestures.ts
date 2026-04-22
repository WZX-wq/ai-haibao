/**
 * 触摸手势 Hook
 * 处理移动端的触摸、缩放、旋转等手势操作
 */

import { ref, onMounted, onUnmounted } from 'vue'
import {
    getTouchPosition,
    getTouchDistance,
    getTouchAngle,
    preventTouchDefault,
} from '@/utils/responsive'

export interface TouchGestureOptions {
    onTap?: (event: TouchEvent) => void
    onLongPress?: (event: TouchEvent) => void
    onPinch?: (scale: number, event: TouchEvent) => void
    onRotate?: (angle: number, event: TouchEvent) => void
    onPan?: (deltaX: number, deltaY: number, event: TouchEvent) => void
    longPressDelay?: number
    preventDefaultTouch?: boolean
}

export function useTouchGestures(
    targetRef: any,
    options: TouchGestureOptions = {}
) {
    const {
        onTap,
        onLongPress,
        onPinch,
        onRotate,
        onPan,
        longPressDelay = 500,
        preventDefaultTouch = true,
    } = options

    const isPressed = ref(false)
    const isTwoFingerGesture = ref(false)
    let longPressTimer: number | null = null
    let startPosition = { x: 0, y: 0 }
    let lastPosition = { x: 0, y: 0 }
    let initialDistance = 0
    let initialAngle = 0
    let lastScale = 1
    let lastAngle = 0

    const handleTouchStart = (event: TouchEvent) => {
        if (preventDefaultTouch) {
            preventTouchDefault(event)
        }

        const touches = event.touches

        if (touches.length === 1) {
            // 单指触摸
            isPressed.value = true
            const pos = getTouchPosition(event)
            startPosition = pos
            lastPosition = pos

            // 启动长按计时器
            if (onLongPress) {
                longPressTimer = window.setTimeout(() => {
                    if (isPressed.value) {
                        onLongPress(event)
                    }
                }, longPressDelay)
            }
        } else if (touches.length === 2) {
            // 双指触摸
            isTwoFingerGesture.value = true
            clearLongPressTimer()

            // 记录初始距离和角度
            initialDistance = getTouchDistance(touches[0], touches[1])
            initialAngle = getTouchAngle(touches[0], touches[1])
            lastScale = 1
            lastAngle = 0
        }
    }

    const handleTouchMove = (event: TouchEvent) => {
        if (preventDefaultTouch) {
            preventTouchDefault(event)
        }

        const touches = event.touches

        if (touches.length === 1 && isPressed.value && !isTwoFingerGesture.value) {
            // 单指拖动
            clearLongPressTimer()
            const pos = getTouchPosition(event)
            const deltaX = pos.x - lastPosition.x
            const deltaY = pos.y - lastPosition.y

            if (onPan && (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2)) {
                onPan(deltaX, deltaY, event)
            }

            lastPosition = pos
        } else if (touches.length === 2 && isTwoFingerGesture.value) {
            // 双指缩放和旋转
            const currentDistance = getTouchDistance(touches[0], touches[1])
            const currentAngle = getTouchAngle(touches[0], touches[1])

            // 缩放
            if (onPinch && initialDistance > 0) {
                const scale = currentDistance / initialDistance
                if (Math.abs(scale - lastScale) > 0.01) {
                    onPinch(scale, event)
                    lastScale = scale
                }
            }

            // 旋转
            if (onRotate) {
                const angleDelta = currentAngle - initialAngle
                if (Math.abs(angleDelta - lastAngle) > 1) {
                    onRotate(angleDelta, event)
                    lastAngle = angleDelta
                }
            }
        }
    }

    const handleTouchEnd = (event: TouchEvent) => {
        if (preventDefaultTouch) {
            preventTouchDefault(event)
        }

        clearLongPressTimer()

        if (isPressed.value && !isTwoFingerGesture.value) {
            const pos = getTouchPosition(event)
            const distance = Math.sqrt(
                Math.pow(pos.x - startPosition.x, 2) + Math.pow(pos.y - startPosition.y, 2)
            )

            // 如果移动距离很小，视为点击
            if (distance < 10 && onTap) {
                onTap(event)
            }
        }

        isPressed.value = false
        isTwoFingerGesture.value = false
        initialDistance = 0
        initialAngle = 0
        lastScale = 1
        lastAngle = 0
    }

    const handleTouchCancel = (event: TouchEvent) => {
        clearLongPressTimer()
        isPressed.value = false
        isTwoFingerGesture.value = false
    }

    const clearLongPressTimer = () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer)
            longPressTimer = null
        }
    }

    onMounted(() => {
        const target = targetRef.value
        if (target) {
            target.addEventListener('touchstart', handleTouchStart, { passive: false })
            target.addEventListener('touchmove', handleTouchMove, { passive: false })
            target.addEventListener('touchend', handleTouchEnd, { passive: false })
            target.addEventListener('touchcancel', handleTouchCancel, { passive: false })
        }
    })

    onUnmounted(() => {
        const target = targetRef.value
        if (target) {
            target.removeEventListener('touchstart', handleTouchStart)
            target.removeEventListener('touchmove', handleTouchMove)
            target.removeEventListener('touchend', handleTouchEnd)
            target.removeEventListener('touchcancel', handleTouchCancel)
        }
        clearLongPressTimer()
    })

    return {
        isPressed,
        isTwoFingerGesture,
    }
}
