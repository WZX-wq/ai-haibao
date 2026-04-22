/**
 * 响应式工具 - 移动端适配
 * 提供断点检测、设备类型判断等功能
 */

export enum Breakpoint {
    MOBILE_SMALL = 600,
    MOBILE = 640,
    TABLET = 768,
    DESKTOP_SMALL = 1024,
    DESKTOP = 1280,
    LARGE_DESKTOP = 1536,
}

export enum DeviceType {
    MOBILE = 'mobile',
    TABLET = 'tablet',
    DESKTOP = 'desktop',
}

/**
 * 获取当前设备类型
 */
export function getDeviceType(width: number = window.innerWidth): DeviceType {
    if (width < Breakpoint.TABLET) {
        return DeviceType.MOBILE
    } else if (width < Breakpoint.DESKTOP_SMALL) {
        return DeviceType.TABLET
    }
    return DeviceType.DESKTOP
}

/**
 * 检测是否为移动设备
 */
export function isMobile(): boolean {
    return getDeviceType() === DeviceType.MOBILE
}

/**
 * 检测是否为平板设备
 */
export function isTablet(): boolean {
    return getDeviceType() === DeviceType.TABLET
}

/**
 * 检测是否为桌面设备
 */
export function isDesktop(): boolean {
    return getDeviceType() === DeviceType.DESKTOP
}

/**
 * 检测是否为触摸设备
 */
export function isTouchDevice(): boolean {
    return (
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        (navigator as any).msMaxTouchPoints > 0
    )
}

/**
 * 获取安全的触摸目标尺寸（最小 44x44px）
 */
export function getTouchTargetSize(size: number): number {
    const MIN_TOUCH_TARGET = 44
    return Math.max(size, MIN_TOUCH_TARGET)
}

/**
 * 防止触摸事件触发浏览器默认行为
 */
export function preventTouchDefault(event: TouchEvent) {
    if (event.cancelable) {
        event.preventDefault()
    }
}

/**
 * 获取触摸点坐标
 */
export function getTouchPosition(event: TouchEvent): { x: number; y: number } {
    const touch = event.touches[0] || event.changedTouches[0]
    return {
        x: touch.clientX,
        y: touch.clientY,
    }
}

/**
 * 计算两个触摸点之间的距离
 */
export function getTouchDistance(touch1: Touch, touch2: Touch): number {
    const dx = touch1.clientX - touch2.clientX
    const dy = touch1.clientY - touch2.clientY
    return Math.sqrt(dx * dx + dy * dy)
}

/**
 * 计算两个触摸点之间的角度
 */
export function getTouchAngle(touch1: Touch, touch2: Touch): number {
    const dx = touch1.clientX - touch2.clientX
    const dy = touch1.clientY - touch2.clientY
    return Math.atan2(dy, dx) * (180 / Math.PI)
}

/**
 * 检测是否为横屏模式
 */
export function isLandscape(): boolean {
    return window.innerWidth > window.innerHeight
}

/**
 * 检测是否为竖屏模式
 */
export function isPortrait(): boolean {
    return window.innerWidth <= window.innerHeight
}
