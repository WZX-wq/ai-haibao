<!--
 * @Author: ShawnPhang <https://m.palxp.cn>
 * @Date: 2021-08-27 15:16:07
 * @Description: 图形素材列表
 * @LastEditors: Jeremy Yu <https://github.com/JeremyYu-cn>
 * @LastEditTime: 2024-09-25 00:39:00
-->
<template>
  <div class="wrap">
    <search-header v-model="state.searchKeyword" type="none" @change="searchChange" />
    <div style="height: 0.5rem" />
    <classHeader v-show="!state.currentCategory" :types="state.types" @select="selectTypes">
      <template v-slot="{ index }">
        <div class="list-wrap">
          <div v-for="(item, i) in state.showList[index]" :key="i + 'sl'" draggable="false" @mousedown="dragStart($event, item)" @mousemove="mousemove" @mouseup="mouseup" @click.stop="selectItem(item)" @dragstart="dragStart($event, item)">
            <el-image class="list__img-thumb" :src="item.thumb" fit="contain" />
          </div>
        </div>
      </template>
    </classHeader>

    <ul v-if="state.currentCategory" ref="listRef" class="infinite-list" style="overflow: auto" @scroll="handleListScroll">
      <classHeader :is-back="true" @back="back">{{ state.currentCategory.name }}</classHeader>
      <el-space fill wrap :fillRatio="30" direction="horizontal" class="list">
        <div v-for="(item, i) in state.list" :key="i + 'i'" class="list__item" draggable="false" @mousedown="dragStart($event, item)" @mousemove="mousemove" @mouseup="mouseup" @click.stop="selectItem(item)" @dragstart="dragStart($event, item)">
          <el-image class="list__img" :src="item.thumb" fit="contain" />
        </div>
      </el-space>
      <div v-show="state.loading" class="loading"><i class="el-icon-loading" /> 加载中...</div>
      <div v-show="state.loadDone" :style="state.list.length <= 0 ? 'padding-top: 4rem' : ''" class="loading">全部加载完毕</div>
    </ul>
  </div>
</template>

<script lang="ts" setup>
import { reactive, ref, nextTick, onMounted, onBeforeUnmount } from 'vue'
import api from '@/api'
import wImageSetting from '../../widgets/wImage/wImageSetting'
import { wSvgSetting } from '../../widgets/wSvg/wSvgSetting'
import setImageData from '@/common/methods/DesignFeatures/setImage'
import DragHelper from '@/common/hooks/dragHelper'
import { TGetListData } from '@/api/material'
import { useControlStore, useCanvasStore, useWidgetStore } from '@/store'
import { storeToRefs } from 'pinia'
import { normalizeLoopbackMediaUrl } from '@/utils/publicMediaUrl'

type TProps = {
  active?: boolean
}

type TState = {
  loading: boolean
  loadDone: boolean
  sub: []
  list: TGetListData[]
  currentType: Number
  currentCheck: number
  colors: string[]
  currentCategory: TCurrentCategory | null
  types: { cate: string, name: string }[]
  showList: TGetListData[][]
  searchKeyword: string
}

type TCurrentCategory = {
  name: string
  cate?: string | number
  id?: number
}

let isAlive = true
let isDrag = false
let fillViewportQueued = false
let startPoint = { x: 99999, y: 99999 }
const dragHelper = new DragHelper()

defineProps<TProps>()

const colors = ['#f8704b', '#5b89ff', '#2cc4cc', '#a8ba73', '#f8704b']
const previewLimit = 6
const controlStore = useControlStore()
const widgetStore = useWidgetStore()
const { dPage } = storeToRefs(useCanvasStore())
const listRef = ref<HTMLElement | null>(null)
const state = reactive<TState>({
  loading: false,
  loadDone: false,
  sub: [],
  list: [],
  currentType: 2,
  currentCheck: 0,
  colors,
  currentCategory: null,
  types: [],
  showList: [],
  searchKeyword: '',
})
const pageOptions = { page: 0, pageSize: 20 }

function normalizeMaterialMedia(item: TGetListData): TGetListData {
  const next = { ...item }
  next.thumb = normalizeLoopbackMediaUrl(next.thumb || '')
  next.url = normalizeLoopbackMediaUrl(next.url || '')
  next.thumbUrl = normalizeLoopbackMediaUrl(next.thumbUrl || '')
  next.imgUrl = normalizeLoopbackMediaUrl(next.imgUrl || '')
  return next
}

onBeforeUnmount(() => {
  isAlive = false
})

onMounted(async () => {
  try {
    if (state.types.length <= 0) {
      state.types = [
        { cate: 'png', name: '贴纸图片' },
        { cate: 'svg', name: 'SVG矢量元素' },
        { cate: 'mask', name: '图像蒙版' },
      ]
      const nextShowList: TGetListData[][] = []
      for (const iterator of state.types) {
        try {
          const { list = [] } = await api.material.getList({ cate: iterator.cate })
          nextShowList.push(list.map((item) => normalizeMaterialMedia(item)).slice(0, previewLimit))
        } catch (error) {
          console.error(`Failed to load material category: ${iterator.cate}`, error)
          nextShowList.push([])
        }
      }
      if (isAlive) {
        state.showList = nextShowList
      }
    }
  } catch (error) {
    console.error('Failed to initialize materials panel', error)
    if (isAlive) {
      state.showList = []
    }
  }
})

const mouseup = (e: MouseEvent) => {
  e.preventDefault()
  setTimeout(() => {
    isDrag = false
    startPoint = { x: 99999, y: 99999 }
  }, 10)
}

const mousemove = (e: MouseEvent) => {
  e.preventDefault()
  if (e.x - startPoint.x > 2 || e.y - startPoint.y > 2) {
    isDrag = true
  }
}

const load = async (init: boolean = false) => {
  if (init) {
    state.list = []
    pageOptions.page = 0
    state.loadDone = false
  }
  if (state.loadDone || state.loading) {
    return
  }

  state.loading = true
  pageOptions.page += 1
  const requestedPage = pageOptions.page

  try {
    const list = await api.material.getList({
      cate: state.currentCategory?.id || state.currentCategory?.cate,
      search: state.searchKeyword,
      ...pageOptions,
    })
    const nextList = (list?.list || []).map((item) => normalizeMaterialMedia(item))
    if (!isAlive) return
    if (init) {
      state.list = nextList
    } else {
      state.list = state.list.concat(nextList)
    }
    if (nextList.length < pageOptions.pageSize) {
      state.loadDone = true
    }
  } catch (error) {
    console.error('Failed to load material list', error)
    if (isAlive) {
      pageOptions.page = Math.max(0, requestedPage - 1)
      if (init) {
        state.list = []
      }
      state.loadDone = false
    }
  } finally {
    if (isAlive) {
      state.loading = false
      await ensureScrollableViewport()
    }
  }
}

const ensureScrollableViewport = async () => {
  if (fillViewportQueued || state.loading || state.loadDone || !state.currentCategory) {
    return
  }

  fillViewportQueued = true
  await nextTick()

  const container = listRef.value
  const shouldAutoFill = !!container
    && container.scrollHeight <= container.clientHeight + 8
    && state.list.length > 0
    && !state.loading
    && !state.loadDone

  fillViewportQueued = false

  if (shouldAutoFill) {
    await load()
  }
}

const handleListScroll = async (event: Event) => {
  const container = event.target as HTMLElement | null
  if (!container || state.loading || state.loadDone) {
    return
  }

  const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight
  if (distanceToBottom <= 150) {
    await load()
  }
}

const searchChange = (_: Event) => {
  state.currentCategory = { name: '搜索结果' }
  load(true)
}

const selectTypes = (item: TCurrentCategory) => {
  state.currentCategory = item
  load(true)
}

const back = () => {
  state.currentCategory = null
}

defineExpose({
  load,
  searchChange,
  selectTypes,
  back,
  mouseup,
  mousemove,
})

async function selectItem(item: TGetListData) {
  if (isDrag) {
    return
  }

  controlStore.setShowMoveable(false)

  const setting = item.type === 'svg' ? JSON.parse(JSON.stringify(wSvgSetting)) : JSON.parse(JSON.stringify(wImageSetting))
  const img = await setImageData(item)

  setting.width = img.width
  setting.height = img.height
  const { width: pW, height: pH } = dPage.value
  setting.left = pW / 2 - img.width / 2
  setting.top = pH / 2 - img.height / 2
  setting.imgUrl = item.url
  if (item.type === 'svg') {
    setting.svgUrl = item.url
    const models = JSON.parse(item.model)
    for (const key in models) {
      if (Object.hasOwnProperty.call(models, key)) {
        setting[key] = models[key]
      }
    }
  }
  if (item.type === 'mask') {
    setting.mask = item.url
  }
  widgetStore.addWidget(setting)
}

async function dragStart(e: MouseEvent, item: TGetListData) {
  startPoint = { x: e.x, y: e.y }
  const { width, height, thumb, url } = item
  const img = await setImageData({ width, height, url: thumb || url })
  dragHelper.start(e, img.canvasWidth)
  widgetStore.setSelectItem({ data: { value: item }, type: item.type })
}
</script>

<style lang="less" scoped>
.wrap {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  padding-top: 0.35rem;
  overflow: hidden;
}

.infinite-list {
  flex: 1;
  min-height: 0;
  height: 100%;
  padding-bottom: 150px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.infinite-list::-webkit-scrollbar {
  display: none;
}

.list {
  width: 100%;
  padding: 3.35rem 0.75rem 0 0.9rem;
  gap: 0 !important;

  &__item {
    overflow: hidden;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.92));
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 18px;
    margin-bottom: 10px;
    margin-right: 10px;
    box-shadow: 0 12px 26px rgba(15, 23, 42, 0.06);
    transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
  }

  &__item:hover {
    transform: translateY(-2px);
    border-color: rgba(240, 113, 54, 0.28);
    box-shadow: 0 18px 34px rgba(240, 113, 54, 0.14);
  }

  &__img {
    cursor: grab;
    width: 142px;
    height: 142px;
    padding: 10px;
    border-radius: 18px;
    background: radial-gradient(circle at top, rgba(255, 255, 255, 0.92), rgba(244, 248, 252, 0.8));
  }

  &__img-thumb {
    cursor: grab;
    width: 98px;
    height: 98px;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(246, 249, 252, 0.92));
    padding: 8px;
    border-radius: 18px;
    border: 1px solid rgba(148, 163, 184, 0.2);
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
    transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
  }

  &__img:hover,
  &__img-thumb:hover {
    background: linear-gradient(180deg, rgba(255, 251, 235, 0.96), rgba(255, 255, 255, 0.96));
    border-color: rgba(240, 113, 54, 0.28);
    box-shadow: 0 18px 34px rgba(240, 113, 54, 0.14);
  }
}

.loading {
  padding: 1rem 0 1.5rem;
  text-align: center;
  font-size: 14px;
  color: #64748b;
}

.list-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 1.8rem;
}
</style>
