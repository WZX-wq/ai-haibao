/*
 * @Author: ShawnPhang
 * @Date: 2022-03-25 13:43:07
 * @Description: 添加滚动监听
 * @LastEditors: ShawnPhang <site: book.palxp.com>, Jeremy Yu <https://github.com/JeremyYu-cn>
 * @LastEditTime: 2024-03-02 11:50:00
 */
import { useControlStore } from '@/store'
// import store from '@/store'

type TAddEventCb = (e: Event) => void
type TAddEventObj = {
  attachEvent?: HTMLElement["addEventListener"]
} & HTMLElement

export default function(el: HTMLElement | string, cb: Function, altLimit: boolean = true) {
  const box = typeof el === 'string' ? document.getElementById(el) : el
  const controlStore = useControlStore()
  if (!box) return () => {}
  const handler = (e: any) => {
    const ev = e || window.event
    const down = ev.wheelDelta ? ev.wheelDelta < 0 : ev.detail > 0
    // if (down) {
    //   console.log('鼠标滚轮向下---------')
    // } else {
    //   console.log('鼠标滚轮向上++++++++++')
    // }
    if ((altLimit && controlStore.dAltDown) || !altLimit) {
      ev.preventDefault()
      cb(down)
    }
    return false
  }
  addEvent(box, 'mousewheel', handler)
  return () => {
    removeEvent(box, 'mousewheel', handler)
  }
}

function addEvent(obj: TAddEventObj, xEvent: keyof HTMLElementEventMap, fn: TAddEventCb) {
  if (obj.attachEvent) {
    obj.attachEvent('on' + xEvent, fn)
  } else {
    obj.addEventListener(xEvent, fn, false)
  }
}

function removeEvent(obj: TAddEventObj, xEvent: keyof HTMLElementEventMap, fn: TAddEventCb) {
  if ((obj as any).detachEvent) {
    ;(obj as any).detachEvent('on' + xEvent, fn)
  } else {
    obj.removeEventListener(xEvent, fn, false)
  }
}
