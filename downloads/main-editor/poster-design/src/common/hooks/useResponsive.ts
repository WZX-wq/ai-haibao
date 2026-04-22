/**
 * 响应式 Hook
 * 提供响应式布局相关的状态和方法
 */

import { ref, onMounted, onUnmounted, computed } from 'vue'
import { getDeviceType, DeviceType, isTouchDevice, isLandscape } from '@/utils/responsive'

export function useResponsive() {
    const windowWidth = ref(window.innerWidth)
    const windowHeight = ref(window.innerHeight)
    const deviceType = ref<DeviceType>(getDeviceType())
    const isTouch = ref(isTouchDevice())
    const orientation = ref<'landscape' | 'portrait'>(isLandscape() ? 'landscape' : 'portrait')

    // 计算属性
    const isMobile = computed(() => deviceType.value === DeviceType.MOBILE)
    const isTablet = computed(() => deviceType.value === DeviceType.TABLET)
    const isDesktop = computed(() => deviceType.value === DeviceType.DESKTOP)
    const isMobileOrTablet = computed(() => isMobile.value || isTablet.value)

    // 更新函数
    const updateDimensions = () => {
        windowWidth.value = window.innerWidth
        windowHeight.value = window.innerHeight
        deviceType.value = getDeviceType(windowWidth.value)
        orientation.value = isLandscape() ? 'landscape' : 'portrait'
    }

    // 防抖处理
    let resizeTimer: number | null = null
    const handleResize = () => {
        if (resizeTimer) {
            clearTimeout(resizeTimer)
        }
        resizeTimer = window.setTimeout(() => {
            updateDimensions()
        }, 150)
    }

    // 生命周期
    onMounted(() => {
        window.addEventListener('resize', handleResize)
        window.addEventListener('orientationchange', handleResize)
    })

    onUnmounted(() => {
        window.removeEventListener('resize', handleResize)
        window.removeEventListener('orientationchange', handleResize)
        if (resizeTimer) {
            clearTimeout(resizeTimer)
        }
    })

    return {
        windowWidth,
        windowHeight,
        deviceType,
        isTouch,
        orientation,
        isMobile,
        isTablet,
        isDesktop,
        isMobileOrTablet,
    }
}
