<!--
 * @Author: ShawnPhang
 * @Date: 2021-08-27 15:16:07
 * @Description: text and combo component list
 * @LastEditors: ShawnPhang <https://m.palxp.cn>
 * @LastEditTime: 2026-04-07 00:00:00
-->
<template>
  <div class="wrap">
    <classHeader v-show="!state.currentCategory" :types="state.types" @select="selectTypes">
      <template v-slot="{ index }">
        <div class="list-wrap">
          <div
            v-for="(item, i) in state.showList[index]"
            :key="i + 'sl'"
            draggable="false"
            @mousedown="dragStart($event, item)"
            @mousemove="mousemove"
            @mouseup="mouseup"
            @click.stop="selectItem(item)"
            @dragstart="dragStart($event, item)"
          >
            <div
              v-if="isTextCategory(index)"
              class="text-preview-card text-preview-card--thumb"
            >
              <div class="text-preview-card__sample" :style="getPreviewStyle(item)">
                {{ getPreviewText(item) }}
              </div>
            </div>
            <div
              v-else-if="isCompCategory(index)"
              class="comp-preview-card comp-preview-card--thumb"
            >
              <div class="comp-preview-card__title">{{ getCompPreviewName(item) }}</div>
              <div class="comp-preview-card__headline" :style="getCompPreviewStyle(item)">
                {{ getCompPreviewText(item) }}
              </div>
            </div>
            <el-image
              v-else
              class="list__img-thumb"
              :src="item.cover"
              fit="contain"
            />
          </div>
        </div>
      </template>
    </classHeader>

    <ul
      v-if="state.currentCategory"
      v-infinite-scroll="load"
      class="infinite-list"
      :infinite-scroll-distance="150"
    >
      <classHeader :is-back="true" @back="back">{{ state.currentCategory.name }}</classHeader>
      <el-space fill wrap :fillRatio="30" direction="horizontal" class="list">
        <div
          v-for="(item, i) in state.list"
          :key="i + 'i'"
          class="list__item"
          draggable="false"
          @mousedown="dragStart($event, item)"
          @mousemove="mousemove"
          @mouseup="mouseup"
          @click.stop="selectItem(item)"
          @dragstart="dragStart($event, item)"
        >
          <div
            v-if="isCurrentTextCategory"
            class="text-preview-card text-preview-card--large"
          >
            <div
              class="text-preview-card__sample text-preview-card__sample--large"
              :style="getPreviewStyle(item)"
            >
              {{ getPreviewText(item) }}
            </div>
            <div
              v-if="item.title || item.name"
              class="text-preview-card__name"
            >
              {{ decodeTextIfNeeded(item.title || item.name || '') }}
            </div>
          </div>
          <div
            v-else-if="isCurrentCompCategory"
            class="comp-preview-card comp-preview-card--large"
          >
            <div class="comp-preview-card__title comp-preview-card__title--large">
              {{ getCompPreviewName(item) }}
            </div>
            <div class="comp-preview-card__headline comp-preview-card__headline--large" :style="getCompPreviewStyle(item)">
              {{ getCompPreviewText(item) }}
            </div>
            <div
              v-if="item.previewSecondaryText && item.previewSecondaryText !== item.previewText"
              class="comp-preview-card__subline"
            >
              {{ item.previewSecondaryText }}
            </div>
          </div>
          <el-image
            v-else
            class="list__img"
            :src="item.cover"
            fit="contain"
          />
        </div>
      </el-space>
      <div v-show="state.loading" class="loading"><i class="el-icon-loading"></i> {{ loadingText }}</div>
      <div v-show="state.loadDone" class="loading">{{ loadDoneText }}</div>
    </ul>
  </div>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, reactive, watch } from 'vue'
import api from '@/api'
import getComponentsData from '@/common/methods/DesignFeatures/setComponents'
import DragHelper from '@/common/hooks/dragHelper'
import setItem2Data from '@/common/methods/DesignFeatures/setImage'
import { TGetCompListResult, TGetTempDetail, TTempDetail } from '@/api/home'
import { useControlStore, useCanvasStore, useWidgetStore } from '@/store'
import { decodeTextIfNeeded } from '@/utils/decodeText'

type TCompPreviewItem = TGetCompListResult & {
  previewText?: string
  previewName?: string
  previewSecondaryText?: string
  previewColor?: string
  previewStrokeColor?: string
}

type TState = {
  loading: boolean
  loadDone: boolean
  list: TCompPreviewItem[]
  searchValue: string
  currentCategory: TCompPreviewItem | null
  types: { cate: string, name: string }[]
  showList: TCompPreviewItem[][]
}

type TTextPreviewResult = {
  previewText: string
  previewColor: string
  previewStrokeColor: string
}

type TGroupPreviewResult = {
  previewText: string
  previewName: string
  previewSecondaryText: string
  previewColor: string
  previewStrokeColor: string
}

const defaultPreviewText = '\u8f93\u5165\u6587\u5b57'
const defaultPreviewColor = '#1f2937'
const loadingText = '\u6b63\u5728\u52a0\u8f7d\u4e2d...'
const loadDoneText = '\u5df2\u7ecf\u5230\u5e95\u4e86'
const previewLimit = 6
const compTextFallbackById: Record<number, string> = {
  4: '\u597d\u7269\u63a8\u8350',
  5: '\u4eca\u65e5\u63a2\u5e97',
  6: '\u4eca\u65e5\u4e0a\u65b0',
}
const compTextFallbackByRaw: Record<string, string> = {
  '\u6fc2\u754c\u58bf\u93ba\u3128\u5d18': '\u597d\u7269\u63a8\u8350',
  '\u6d60\u5a43\u68e9\u93ba\u3220\u7c35': '\u4eca\u65e5\u63a2\u5e97',
  '\u6d60\u5a43\u68e9\u6d93\u5a43\u67ca': '\u4eca\u65e5\u4e0a\u65b0',
  'm60Z43he9m93Z43gca': '\u4eca\u65e5\u4e0a\u65b0',
}
const dragHelper = new DragHelper()
let isAlive = true
let isDrag = false
/** 拖拽结束后仍会触发 click，避免与 drop 插入重复一份组合 */
let suppressNextSelectClick = false
let startPoint = { x: 99999, y: 99999 }
let tempDetail: TTempDetail | null = null
const compsCache: Record<string | number, TTempDetail> = {}
const state = reactive<TState>({
  loading: false,
  loadDone: false,
  list: [],
  searchValue: '',
  currentCategory: null,
  types: [],
  showList: [],
})

const controlStore = useControlStore()
const widgetStore = useWidgetStore()
const dPage = useCanvasStore().dPage
const pageOptions = { type: 1, page: 0, pageSize: 20 }
const isCurrentTextCategory = computed(() => state.currentCategory?.cate === 'text')
const isCurrentCompCategory = computed(() => state.currentCategory?.cate === 'comp')

watch(
  () => state.currentCategory?.cate,
  (cate) => {
    if (typeof cate === 'string' && cate) {
      try {
        sessionStorage.setItem('xp_comp_cate', cate)
      } catch {
        /* ignore */
      }
    }
  },
)

onBeforeUnmount(() => {
  isAlive = false
})

onMounted(async () => {
  try {
    if (state.types.length <= 0) {
      state.types = [
        { cate: 'text', name: '\u7279\u6548\u6587\u5b57' },
        { cate: 'comp', name: '\u7ec4\u5408\u6a21\u677f' },
      ]
      const nextShowList: TCompPreviewItem[][] = []
      for (const iterator of state.types) {
        try {
          const { list = [] } = await api.home.getCompList({
            type: 1,
            cate: iterator.cate,
          })
          nextShowList.push((await enrichPreviewList(list, iterator.cate)).slice(0, previewLimit))
        } catch (error) {
          console.error(`Failed to load component category: ${iterator.cate}`, error)
          nextShowList.push([])
        }
      }
      if (isAlive) {
        state.showList = nextShowList
      }
    }
  } catch (error) {
    console.error('Failed to initialize text/components panel', error)
    if (isAlive) {
      state.showList = []
    }
  }
})

const mouseup = (e: MouseEvent) => {
  e.preventDefault()
  if (isDrag) {
    suppressNextSelectClick = true
  }
  isDrag = false
  tempDetail = null
  startPoint = { x: 99999, y: 99999 }
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
    const res = await api.home.getCompList({
      ...pageOptions,
      cate: state.currentCategory?.id || state.currentCategory?.cate,
    })
    const nextList = await enrichPreviewList(res?.list || [], state.currentCategory?.cate)
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
    console.error('Failed to load component list', error)
    if (isAlive) {
      pageOptions.page = Math.max(0, requestedPage - 1)
      if (init) {
        state.list = []
      }
      state.loadDone = false
    }
  } finally {
    setTimeout(() => {
      if (isAlive) {
        state.loading = false
      }
    }, 100)
  }
}

type TActionParam = {
  name: string
  value: string
}

function action({ name }: TActionParam, item: TGetCompListResult, index: number) {
  switch (name) {
    case 'del':
      delComp(item, index)
      break
  }
}

function delComp({ id }: TGetCompListResult, index: number) {
  api.home.removeComp({ id })
  state.list.splice(index, 1)
}

const selectTypes = (item: TCompPreviewItem) => {
  state.currentCategory = item
  load(true)
}

const back = () => {
  state.currentCategory = null
}

function parseCompDetailData(detail: TTempDetail | null) {
  const payload = (detail as any)?.data ?? detail
  if (payload === null || typeof payload === 'undefined') {
    return null
  }

  if (typeof payload === 'string') {
    if (!payload.trim()) return null
    try {
      return JSON.parse(payload)
    } catch (error) {
      console.error('Failed to parse component detail data', error, detail)
      return null
    }
  }

  if (Array.isArray(payload) || typeof payload === 'object') {
    return payload
  }

  return null
}

function cleanupPreviewText(value?: string) {
  const text = decodeTextIfNeeded(value || '')
    .replace(/\s+/g, ' ')
    .trim()
  return text || defaultPreviewText
}

function cleanupPlainText(value?: string) {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
  return text || defaultPreviewText
}

function normalizeColor(value?: string) {
  if (!value) {
    return ''
  }

  const matchedColor = value.match(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})/)
  return matchedColor?.[0] || value
}

function extractTextPreview(detail: TTempDetail | null): TTextPreviewResult {
  const detailData = parseCompDetailData(detail)
  const textLayer = Array.isArray(detailData)
    ? detailData.find((item) => item?.type === 'w-text')
    : detailData?.type === 'w-text'
      ? detailData
      : null

  if (!textLayer) {
    return {
      previewText: defaultPreviewText,
      previewColor: defaultPreviewColor,
      previewStrokeColor: '',
    }
  }

  const textEffects = Array.isArray(textLayer.textEffects) ? textLayer.textEffects : []
  const fillingColor = textEffects.find((item) => item?.filling?.enable && item?.filling?.color)?.filling?.color
  const strokeColor = textEffects.find((item) => item?.stroke?.enable && item?.stroke?.color)?.stroke?.color

  return {
    previewText: cleanupPreviewText(textLayer.text || textLayer.name),
    previewColor: normalizeColor(fillingColor || textLayer.color) || defaultPreviewColor,
    previewStrokeColor: normalizeColor(strokeColor),
  }
}

async function enrichPreviewList(list: TGetCompListResult[], cate?: string) {
  if (cate !== 'text' && cate !== 'comp') {
    return list as TCompPreviewItem[]
  }

  return Promise.all(
    list.map(async (item) => {
      try {
        const detail = await getCompDetail({ id: item.id, type: 1 })
        return {
          ...item,
          ...(cate === 'text' ? extractTextPreview(detail) : extractCompPreview(item, detail)),
        }
      } catch (error) {
        console.error(`Failed to enrich ${cate} preview: ${item.id}`, error)
        return {
          ...item,
          ...(cate === 'text'
            ? {
                previewText: cleanupPreviewText(item.title || item.name),
                previewColor: defaultPreviewColor,
                previewStrokeColor: '',
              }
            : {
                previewName: cleanupPreviewText(item.title || item.name),
                previewText: cleanupPreviewText(item.title || item.name),
                previewSecondaryText: '',
                previewColor: defaultPreviewColor,
                previewStrokeColor: '',
              }),
        }
      }
    }),
  )
}

function getPreviewText(item: TCompPreviewItem) {
  return cleanupPreviewText(item.previewText || item.title || item.name)
}

function getPreviewStyle(item: TCompPreviewItem) {
  const color = normalizeColor(item.previewColor) || defaultPreviewColor
  const strokeColor = normalizeColor(item.previewStrokeColor)

  return {
    color,
    WebkitTextStroke: strokeColor ? `1px ${strokeColor}` : '0 transparent',
    textShadow: strokeColor ? `0 2px 8px ${strokeColor}33` : 'none',
  }
}

function isTextCategory(index: number) {
  return state.types[index]?.cate === 'text'
}

function isCompCategory(index: number) {
  return state.types[index]?.cate === 'comp'
}

function normalizeCompText(value?: string) {
  const cleaned = cleanupPreviewText(value)
  return compTextFallbackByRaw[cleaned] || cleaned
}

function isReadablePreviewText(value?: string) {
  if (!value) {
    return false
  }

  if (/^[A-Za-z0-9]+$/.test(value) && value.length >= 8) {
    return false
  }

  if (/[\u4e00-\u9fa5]/.test(value)) {
    return true
  }

  if (/[A-Za-z]/.test(value) && /[\s-]/.test(value)) {
    return true
  }

  return false
}

function extractCompPreview(item: TGetCompListResult, detail: TTempDetail | null): TGroupPreviewResult {
  const detailData = parseCompDetailData(detail)
  const textLayers = Array.isArray(detailData)
    ? detailData
        .filter((layer) => layer?.type === 'w-text')
        .map((layer) => ({
          text: normalizeCompText(layer.text || layer.name),
          size: Number(layer.fontSize) || 0,
          top: Number(layer.top) || 0,
          color: normalizeColor(layer.color),
          strokeColor: normalizeColor(
            Array.isArray(layer.textEffects)
              ? layer.textEffects.find((entry) => entry?.stroke?.enable && entry?.stroke?.color)?.stroke?.color
              : '',
          ),
        }))
    : []

  const sortedLayers = [...textLayers].sort((a, b) => {
    if (b.size !== a.size) {
      return b.size - a.size
    }
    return a.top - b.top
  })

  const primary = sortedLayers[0]
  const secondary = sortedLayers.find((layer) => layer.text !== primary?.text)
  const previewName = cleanupPreviewText(decodeTextIfNeeded(item.title || item.name || primary?.text || '\u7ec4\u5408\u6a21\u677f'))
  const fallbackText = compTextFallbackById[Number(item.id)] || ''
  const previewText = fallbackText || (isReadablePreviewText(primary?.text) ? primary?.text || '' : '')
  const previewSecondaryText = isReadablePreviewText(secondary?.text) ? secondary?.text || '' : ''

  return {
    previewName,
    previewText: previewText || cleanupPreviewText(item.title || item.name || fallbackText),
    previewSecondaryText,
    previewColor: primary?.color || defaultPreviewColor,
    previewStrokeColor: primary?.strokeColor || '',
  }
}

function getCompPreviewName(item: TCompPreviewItem) {
  if (item.previewName) {
    return cleanupPlainText(item.previewName)
  }
  return cleanupPreviewText(item.title || item.name || '\u7ec4\u5408\u6a21\u677f')
}

function getCompPreviewText(item: TCompPreviewItem) {
  if (item.previewText) {
    return cleanupPlainText(item.previewText)
  }
  if (item.previewSecondaryText) {
    return cleanupPlainText(item.previewSecondaryText)
  }
  return cleanupPreviewText(item.title || item.name)
}

function getCompPreviewStyle(item: TCompPreviewItem) {
  return getPreviewStyle(item)
}

function offsetGroupToCanvas(group: any[], pageWidth: number, pageHeight: number) {
  const drawable = group.filter((element) =>
    element &&
    typeof element.left === 'number' &&
    typeof element.top === 'number' &&
    typeof element.width === 'number' &&
    typeof element.height === 'number',
  )

  if (!drawable.length) {
    return group
  }

  const minLeft = Math.min(...drawable.map((element) => element.left))
  const minTop = Math.min(...drawable.map((element) => element.top))
  const maxRight = Math.max(...drawable.map((element) => element.left + element.width))
  const maxBottom = Math.max(...drawable.map((element) => element.top + element.height))
  const groupWidth = maxRight - minLeft
  const groupHeight = maxBottom - minTop
  const offsetX = pageWidth / 2 - groupWidth / 2 - minLeft
  const offsetY = pageHeight / 2 - groupHeight / 2 - minTop

  group.forEach((element) => {
    if (typeof element.left === 'number') {
      element.left += offsetX
    }
    if (typeof element.top === 'number') {
      element.top += offsetY
    }
  })

  return group
}

const dragStart = async (e: MouseEvent, { id, width, height, cover }: TGetCompListResult) => {
  isDrag = false
  startPoint = { x: e.x, y: e.y }
  try {
    const img = await setItem2Data({ width, height, url: cover })
    dragHelper.start(e, img.canvasWidth)
    tempDetail = await getCompDetail({ id, type: 1 })
    const detailData = parseCompDetailData(tempDetail)
    if (!detailData) {
      return
    }
    if (Array.isArray(detailData)) {
      widgetStore.setSelectItem({ data: detailData, type: 'group' })
    } else {
      widgetStore.setSelectItem({ data: detailData, type: 'text' })
    }
  } catch (error) {
    console.error(`Failed to start dragging component: ${id}`, error)
  }
}

const selectItem = async (item: TGetCompListResult) => {
  if (suppressNextSelectClick) {
    suppressNextSelectClick = false
    return
  }
  if (isDrag) {
    return
  }

  controlStore.setShowMoveable(false)

  try {
    tempDetail = tempDetail || (await getCompDetail({ id: item.id, type: 1 }))
    const parsedDetail = parseCompDetailData(tempDetail)
    if (!parsedDetail) {
      console.warn(`Component detail has no usable data: ${item.id}`, tempDetail)
      return
    }

    const group: any = await getComponentsData(parsedDetail as any)
    if (!group || (Array.isArray(group) && group.length === 0)) {
      console.warn(`Component data resolved empty: ${item.id}`)
      return
    }

    let parent: Record<string, any> = { x: 0, y: 0 }
    const { width: pW, height: pH } = dPage

    if (Array.isArray(group)) {
      group.forEach((element) => {
        element.type === 'w-group' && (parent = element)
      })
    }

    if (Array.isArray(group)) {
      if (parent.isContainer) {
        group.forEach((element: any) => {
          if (typeof element.text === 'string') {
            element.text = decodeTextIfNeeded(element.text)
          }
          element.left += (pW - parent.width) / 2
          element.top += (pH - parent.height) / 2
        })
      } else {
        offsetGroupToCanvas(group, pW, pH)
      }
      widgetStore.addGroup(group)
    } else {
      if (typeof group.text === 'string') {
        group.text = decodeTextIfNeeded(group.text)
      }
      const textLength = typeof group.text === 'string' ? group.text.length : 0
      const baseWidth = typeof group.width === 'number' ? group.width : group.fontSize * Math.max(textLength, 1)
      const baseHeight = typeof group.height === 'number' ? group.height : group.fontSize
      group.left = pW / 2 - baseWidth / 2
      group.top = pH / 2 - baseHeight / 2
      widgetStore.addWidget(group)
    }
  } catch (error) {
    console.error(`Failed to insert component: ${item.id}`, error)
  }
}

function getCompDetail(params: TGetTempDetail): Promise<TTempDetail> {
  return new Promise((resolve, reject) => {
    if (compsCache[params.id]) {
      resolve(compsCache[params.id])
    } else {
      api.home.getTempDetail(params)
        .then((res: any) => {
          resolve(res)
          compsCache[params.id] = res
        })
        .catch((error: any) => {
          console.error(`Failed to load component detail: ${params.id}`, error)
          reject(error)
        })
    }
  })
}

defineExpose({
  load,
  action,
  back,
  selectTypes,
  mouseup,
  mousemove,
  dragStart,
  selectItem,
})
</script>

<style lang="less" scoped>
.wrap {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  padding-top: 0.35rem;
  box-sizing: border-box;
}

.search__wrap {
  padding: 1.4rem 1rem 0.8rem 1rem;
}

.infinite-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding-bottom: 120px;
  scrollbar-width: thin;
  scrollbar-color: rgba(100, 116, 139, 0.45) transparent;
}

.infinite-list::-webkit-scrollbar {
  width: 6px;
}

.infinite-list::-webkit-scrollbar-thumb {
  background: rgba(100, 116, 139, 0.4);
  border-radius: 6px;
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

.text-preview-card {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  cursor: grab;
  background:
    radial-gradient(circle at top left, rgba(255, 250, 240, 0.96), rgba(255, 255, 255, 0.98)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(246, 249, 252, 0.92));
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 18px;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.text-preview-card:hover {
  transform: translateY(-2px);
  border-color: rgba(240, 113, 54, 0.28);
  box-shadow: 0 18px 34px rgba(240, 113, 54, 0.14);
}

.text-preview-card--thumb {
  width: 98px;
  height: 98px;
  padding: 10px 8px;
  align-items: center;
  text-align: center;
}

.text-preview-card--large {
  width: 142px;
  min-height: 142px;
  padding: 14px 12px;
  align-items: flex-start;
}

.text-preview-card__sample {
  width: 100%;
  font-size: 22px;
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: 0.02em;
  text-align: center;
  white-space: normal;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.text-preview-card__sample--large {
  font-size: 28px;
  text-align: left;
}

.text-preview-card__name {
  width: 100%;
  font-size: 12px;
  line-height: 1.4;
  color: #64748b;
  white-space: normal;
  word-break: break-word;
}

.comp-preview-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 8px;
  cursor: grab;
  background:
    linear-gradient(180deg, rgba(255, 250, 240, 0.98), rgba(255, 255, 255, 0.98)),
    radial-gradient(circle at top right, rgba(255, 231, 214, 0.7), transparent 55%);
  border: 1px solid rgba(244, 164, 96, 0.26);
  border-radius: 18px;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.comp-preview-card:hover {
  transform: translateY(-2px);
  border-color: rgba(240, 113, 54, 0.35);
  box-shadow: 0 18px 34px rgba(240, 113, 54, 0.14);
}

.comp-preview-card--thumb {
  width: 98px;
  height: 98px;
  padding: 10px 9px;
}

.comp-preview-card--large {
  width: 142px;
  min-height: 142px;
  padding: 14px 12px;
}

.comp-preview-card__title {
  font-size: 11px;
  font-weight: 700;
  line-height: 1.3;
  color: #9a5b38;
  letter-spacing: 0.03em;
  white-space: normal;
  word-break: break-word;
}

.comp-preview-card__title--large {
  font-size: 12px;
}

.comp-preview-card__headline {
  flex: 1;
  display: flex;
  align-items: center;
  font-size: 20px;
  font-weight: 800;
  line-height: 1.12;
  text-align: center;
  white-space: normal;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.comp-preview-card__headline--large {
  align-items: flex-start;
  font-size: 24px;
  text-align: left;
}

.comp-preview-card__subline {
  font-size: 11px;
  line-height: 1.35;
  color: #7c695b;
  white-space: normal;
  word-break: break-word;
}
</style>
