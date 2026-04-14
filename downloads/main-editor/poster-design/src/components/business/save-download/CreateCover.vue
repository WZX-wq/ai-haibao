<!--
 * @Author: ShawnPhang
 * @Date: 2021-08-01 11:12:17
 * @Description: 前端出图 - 用于封面
 * @LastEditors: ShawnPhang <https://m.palxp.cn>
 * @Date: 2024-03-04 18:50:00
-->
<template>
  <div id="cover-wrap"></div>
</template>

<script lang="ts" setup>
import html2canvas from 'html2canvas'
import api from '@/api'
// import { useSetupMapGetters } from '@/common/hooks/mapGetters'
import { useCanvasStore, useWidgetStore } from '@/store'
import FontFaceObserver from 'fontfaceobserver'

const canvasStore = useCanvasStore()
const widgetStore = useWidgetStore()

/** 仅调整离屏克隆节点，避免改 Pinia dZoom 导致编辑区「先放大再缩回」 */
function normalizeCloneCanvasForExport(el: HTMLElement) {
  el.style.setProperty('transform', 'scale(1)')
  el.style.setProperty('transform-origin', 'left top')
}

// props: ['modelValue'],
// emits: ['update:modelValue'],

async function createCover(cb: any) {
  // 取消选中元素
  widgetStore.selectWidget({
    uuid: '-1',
  })
  // store.dispatch('selectWidget', {
  //   uuid: '-1',
  // })

  const opts = {
    useCORS: true, // 跨域图片
    scale: 0.2,
  }
  setTimeout(async () => {
    const clonePage = document.getElementById('page-design-canvas')?.cloneNode(true) as HTMLElement
    if (!clonePage) return
    clonePage.setAttribute('id', 'clone-page')
    normalizeCloneCanvasForExport(clonePage)
    document.body.appendChild(clonePage)
    html2canvas(clonePage, opts).then((canvas) => {
      canvas.toBlob(
        async (blobObj) => {
          if (blobObj) {
            const result = await api.material.upload({ file: blobObj, folder: 'cover/user' }, () => {})
            cb(result)
          }
        },
        'image/jpeg',
        0.15,
      )
      clonePage.remove()
    })
  }, 10)
}

async function createPoster() {
  try {
    await checkFonts()
  } catch {
    /* 字体检测失败时仍尝试导出，避免整段 Promise 拒绝导致下载流程中断 */
  }
  const fonts = document.fonts
  const page = canvasStore.getDPage()
  const pw = Math.max(1, Number(page?.width) || 1)
  const ph = Math.max(1, Number(page?.height) || 1)
  /** 避免超大画布 × scale 超出浏览器位图上限导致导出失败或卡死 */
  const MAX_EDGE = 8192
  const baseScale = 1
  let scale = baseScale
  if (Math.max(pw, ph) * scale > MAX_EDGE) {
    scale = MAX_EDGE / Math.max(pw, ph)
  }

  widgetStore.selectWidget({ uuid: '-1' })
  await new Promise((r) => setTimeout(r, 60))

  const opts = {
    backgroundColor: null, // 关闭背景以支持透明图片生成
    useCORS: true,
    scale,
    onclone: (doc: Document) => {
      fonts.forEach((font) => doc.fonts.add(font))
      const root = doc.getElementById('clone-page')
      if (root) normalizeCloneCanvasForExport(root)
    },
  }

  return new Promise((resolve) => {
    const clonePage = document.getElementById('page-design-canvas')?.cloneNode(true) as HTMLElement
    if (!clonePage) {
      resolve({ blob: undefined })
      return
    }
    clonePage.setAttribute('id', 'clone-page')
    normalizeCloneCanvasForExport(clonePage)
    document.body.appendChild(clonePage)
    html2canvas(clonePage, opts)
      .then((canvas) => {
        if (!canvas || canvas.width < 2 || canvas.height < 2) {
          try {
            clonePage.remove()
          } catch {
            /* ignore */
          }
          resolve({ blob: undefined })
          return
        }
        canvas.toBlob((blob) => {
          try {
            clonePage.remove()
          } catch {
            /* ignore */
          }
          resolve({ blob: blob ?? undefined })
        }, `image/png`)
      })
      .catch(() => {
        try {
          clonePage.remove()
        } catch {
          /* ignore */
        }
        resolve({ blob: undefined })
      })
  })
}

// 检查字体是否加载完成（去重 + 单字体超时，避免 Promise.all 被单个字体拖满 120s 或整体 reject）
async function checkFonts() {
  const widgets = widgetStore.getWidgets()
  const seen = new Set<string>()
  const fontLoaders: Promise<void>[] = []
  const FONT_WAIT_MS = 20000
  widgets.forEach((item: any) => {
    const name = item.fontClass?.value
    if (!name || seen.has(name)) return
    seen.add(name)
    const loader = new FontFaceObserver(name)
    fontLoaders.push(loader.load(null, FONT_WAIT_MS).catch(() => undefined as void))
  })
  await Promise.all(fontLoaders)
}

defineExpose({
  createCover,
  createPoster,
})
</script>

<style lang="less">
#clone-page {
  position: absolute;
  z-index: 99999;
  left: -99999px;
}
</style>
