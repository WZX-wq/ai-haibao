<template>
  <div ref="pageDesignIndex" class="draw-page">
    <template v-if="hasRenderableContent">
      <div class="page-design-index-wrap">
        <design-board class="page-design-wrap fixed-canvas" pageDesignCanvasId="page-design-canvas"></design-board>
      </div>
      <zoom-control />
    </template>
    <div v-else class="empty-state">
      <div class="empty-card">
        <div class="empty-badge">DRAW</div>
        <h1>预览链接已打开，但缺少海报数据</h1>
        <p>请从模板、我的作品或导出流程进入该页面，并携带 <code>tempid</code> 或 <code>id</code> 参数。</p>
        <div class="empty-actions">
          <button class="ghost-btn" @click="goHome">返回编辑器</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onMounted } from 'vue'
import api from '@/api'
import Preload from '@/utils/plugins/preload'
import FontFaceObserver from 'fontfaceobserver'
import { fontMinWithDraw, font2style } from '@/utils/widgets/loadFontRule'
import designBoard from '@/components/modules/layout/designBoard/index.vue'
import zoomControl from '@/components/modules/layout/zoomControl/index.vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useCanvasStore, useWidgetStore } from '@/store'

const route = useRoute()
const router = useRouter()
const pageStore = useCanvasStore()
const widgetStore = useWidgetStore()
const { dPage } = storeToRefs(pageStore)
const hasRenderableContent = computed(() => Boolean(route.query.id || route.query.tempid))

onMounted(() => {
  nextTick(() => {
    load()
  })
})

function goHome() {
  router.push('/home')
}

async function load() {
  let backgroundImage = ''
  let loadFlag = false
  const { id, tempid, tempType: type = 0, index = 0 }: any = route.query
  if (id || tempid) {
    const postData = {
      id: id || tempid,
      type: Number(type),
    }
    const { data, width, height } = await api.home[id ? 'getWorks' : 'getTempDetail'](postData)
    let content = JSON.parse(data)
    const isGroupTemplate = Number(type) === 1

    if (Array.isArray(content) && !isGroupTemplate) {
      const { global, layers } = content[index]
      content = { page: global, widgets: layers }
    }
    const widgets = isGroupTemplate ? content : content.widgets

    if (isGroupTemplate) {
      dPage.value.width = width
      dPage.value.height = height
      dPage.value.backgroundColor = '#ffffff00'
      widgetStore.addGroup(content)
    } else {
      pageStore.setDPage(content.page)
      backgroundImage = content.page?.backgroundImage
      backgroundImage && delete content.page.backgroundImage
      pageStore.setDPage(content.page)
      if (id) {
        widgetStore.setDWidgets(widgets)
      } else {
        widgetStore.setTemplate(widgets)
      }
    }

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
      pageStore.setDPage({ ...content.page, backgroundImage })
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

  setTimeout(() => {
    const finish = (window as any).loadFinishToInject
    !loadFlag && typeof finish === 'function' && finish('done')
  }, 60000)
}
</script>

<style lang="less" scoped>
@import url('@/assets/styles/design.less');

.draw-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #eef3f9 0%, #f8fafc 100%);
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
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 24px 80px rgba(31, 41, 55, 0.12);
  text-align: center;

  h1 {
    margin: 0 0 12px;
    font-size: 28px;
    color: #111827;
  }

  p {
    margin: 0;
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
  background: #dbeafe;
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.empty-actions {
  margin-top: 24px;
}

.ghost-btn {
  padding: 12px 20px;
  border: 1px solid #cbd5e1;
  border-radius: 999px;
  background: #fff;
  color: #0f172a;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: #94a3b8;
    transform: translateY(-1px);
  }
}

.fixed-canvas {
  :deep(#page-design-canvas) {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
  }
}
</style>

<style lang="less">
.layer-hover {
  outline: 0 !important;
}
</style>
