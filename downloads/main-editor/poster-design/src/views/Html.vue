<template>
  <div ref="pageDesignIndex" class="html-page">
    <div v-if="pageGroup.length" class="page-design-index-wrap" id="page-draw-html-wrap">
      <template v-for="x in pageGroup" :key="x.pageData.uuid">
        <design-board
          class="page-design-wrap fixed-canvas"
          pageDesignCanvasId="page-design-canvas"
          :padding="0"
          :renderDWdigets="x.dWidgets"
          :renderDPage="x.pageData"
          :zoom="x.zoom * 100"
        />
      </template>
    </div>
    <div v-else class="empty-state">
      <div class="empty-card">
        <div class="empty-badge">网页预览</div>
        <h1>当前没有可渲染的模板页面</h1>
        <p>请通过导出 HTML 或模板预览流程进入该页面，并带上 <code>tempid</code> 或 <code>id</code> 参数。</p>
        <button class="ghost-btn" @click="goHome">返回编辑器</button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import api from '@/api'
import Preload from '@/utils/plugins/preload'
import FontFaceObserver from 'fontfaceobserver'
import { fontMinWithDraw, font2style } from '@/utils/widgets/loadFontRule'
import designBoard from '@/components/modules/layout/designBoard/index.vue'
import { useRoute, useRouter } from 'vue-router'
import { TPageState } from '@/store/design/canvas/d'
import { TdWidgetData } from '@/store/design/widget'

const route = useRoute()
const router = useRouter()
const pageGroup = ref<{ pageData: TPageState; dWidgets: TdWidgetData[]; zoom: number }[]>([])

onMounted(() => {
  nextTick(() => {
    load()
    window.addEventListener('resize', handleResize, false)
  })
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize, false)
})

async function load() {
  let backgroundImage = ''
  let loadFlag = false
  const { id, tempid }: any = route.query
  if (id || tempid) {
    const postData = {
      id: id || tempid,
    }
    const { data } = await api.home[id ? 'getWorks' : 'getTempDetail'](postData)
    let contentGroup = JSON.parse(data)

    contentGroup = Array.isArray(contentGroup) ? contentGroup : [contentGroup]

    for (let i = 0; i < contentGroup.length; i++) {
      const { global, layers } = contentGroup[i]
      const content = { page: global, widgets: layers }
      const widgets = content.widgets
      const zoom = controlScale(content.page?.width)

      backgroundImage = content.page?.backgroundImage
      backgroundImage && delete content.page.backgroundImage

      pageGroup.value.push({
        pageData: content.page,
        dWidgets: widgets,
        zoom,
      })
      await nextTick()
      await nextTick()

      const imgsData: HTMLImageElement[] = []
      const svgsData: HTMLImageElement[] = []
      const fontLoaders: Promise<void>[] = []
      const fontContent: Record<string, string> = {}
      const fontData: string[] = []

      widgets.forEach((item: any) => {
        if (item.fontClass && item.fontClass.value) {
          const loader = new FontFaceObserver(item.fontClass.value)
          fontData.push(item.fontClass)
          fontLoaders.push(loader.load(null, 30000))
          fontContent[item.fontClass.value] = (fontContent[item.fontClass.value] || '') + item.text
        }

        try {
          if (item.svgUrl && item.type === 'w-svg') {
            const cNodes: any = (window as any).document.getElementById(item.uuid).childNodes
            svgsData.push(cNodes)
          } else if (item.imgUrl && !item.isNinePatch) {
            const cNodes: any = (window as any).document.getElementById(item.uuid).childNodes
            for (const el of cNodes) {
              if (el.className && el.className.includes('img__box')) {
                imgsData.push(el.firstChild)
              }
            }
          }
        } catch (error) {}
      })

      if (backgroundImage) {
        const preloadBg = new Preload([backgroundImage])
        await preloadBg.imgs()
      }

      try {
        fontMinWithDraw && (await font2style(fontContent, fontData))
        const preload = new Preload(imgsData)
        await preload.doms()
        const preload2 = new Preload(svgsData)
        await preload2.svgs()
      } catch (error) {
        console.log(error)
      }

      try {
        await Promise.all(fontLoaders)
      } catch (error) {}

      loadFlag = true
      setTimeout(() => {
        try {
          ;(window as any).loadFinishToInject('done')
        } catch (error) {}
      }, 100)
    }
  }

  setTimeout(() => {
    const finish = (window as any).loadFinishToInject
    !loadFlag && typeof finish === 'function' && finish('done')
  }, 60000)
}

function controlScale(width: number) {
  const winWidth = document.documentElement.clientWidth
  let curZoom = winWidth / width
  curZoom = curZoom > 1 ? 1 : curZoom
  return curZoom
}

function handleResize() {
  pageGroup.value = pageGroup.value.map((val) => {
    val.zoom = controlScale(val.pageData.width)
    return val
  })
}

function goHome() {
  router.push('/home')
}
</script>

<style lang="less" scoped>
@import url('@/assets/styles/design.less');

.html-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #f5f7fb 0%, #eef2ff 100%);
}

.empty-state {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.empty-card {
  width: min(560px, 100%);
  padding: 40px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 24px 80px rgba(30, 41, 59, 0.12);
  text-align: center;

  h1 {
    margin: 0 0 12px;
    font-size: 28px;
    color: #111827;
  }

  p {
    margin: 0 0 24px;
    line-height: 1.7;
    color: #4b5563;
  }

  code {
    padding: 2px 8px;
    border-radius: 999px;
    background: #eff6ff;
    color: #1d4ed8;
  }
}

.empty-badge {
  display: inline-flex;
  padding: 6px 12px;
  margin-bottom: 16px;
  border-radius: 999px;
  background: #dcfce7;
  color: #166534;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.ghost-btn {
  padding: 12px 20px;
  border: 1px solid #cbd5e1;
  border-radius: 999px;
  background: #fff;
  color: #0f172a;
  cursor: pointer;
}

#page-draw-html-wrap {
  width: 100vw;
  height: 100vh;
  overflow: scroll;
  offset: 0;
  scrollbar-width: none;

  #main {
    overflow: hidden;
  }
}

#page-draw-html-wrap::-webkit-scrollbar {
  display: none;
}
</style>

<style lang="less">
.layer-hover {
  outline: 0 !important;
}
</style>
