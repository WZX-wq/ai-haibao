<!--
 * @Author: ShawnPhang
 * @Date: 2022-02-13 22:18:35
 * @Description: 我的
 * @LastEditors: ShawnPhang <https://m.palxp.cn>
 * @LastEditTime: 2024-08-12 09:32:00
-->
<template>
  <div class="wrap">
    <el-tabs v-model="state.tabActiveName" :stretch="true" class="tabs" @tab-change="tabChange">
      <el-tab-pane label="资源管理" name="pics"> </el-tab-pane>
      <el-tab-pane label="我的作品" name="design"> </el-tab-pane>
    </el-tabs>
    <div v-show="state.tabActiveName === 'pics'">
      <uploader v-model="state.percent" class="upload" @done="uploadDone">
        <el-button class="upload-btn" plain><i class="iconfont icon-upload" /> 上传图片</el-button>
      </uploader>
      <el-button disabled class="upload-btn upload-psd" plain type="primary" @click="openPSD">导入 PSD</el-button>
      <div style="margin: 1rem; height: 100vh">
        <photo-list ref="imgListRef" :edit="state.editOptions.photo" :isDone="state.isDone" :listData="state.imgList" @load="load" @drag="dragStart" @select="selectImg" />
      </div>
    </div>
    <div v-show="state.tabActiveName === 'design'" class="wrap">
      <ul ref="listRef" v-infinite-scroll="loadDesign" class="infinite-list" :infinite-scroll-distance="150" style="overflow: auto">
        <img-water-fall :edit="state.editOptions.works" :listData="state.designList" @select="selectDesign" />
        <div v-show="state.isDone" class="loading">全部加载完毕</div>
      </ul>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { reactive, nextTick, ref, onMounted, watch } from 'vue'
import { ElTabPane, ElTabs, TabPaneName } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import html2canvas from 'html2canvas'

import uploader from '@/components/common/Uploader'
import api from '@/api'
import wImageSetting from '../../widgets/wImage/wImageSetting'
import setImageData, { TItem2DataParam } from '@/common/methods/DesignFeatures/setImage'
import useConfirm from '@/common/methods/confirm'
import photoList from './components/photoList.vue'
import imgWaterFall from './components/imgWaterFall.vue'
import { IGetTempListData } from '@/api/home'
import useNotification from '@/common/methods/notification'
import eventBus from '@/utils/plugins/eventBus'
import { normalizeLoopbackMediaUrl } from '@/utils/publicMediaUrl'
import _config from '@/config'
import { storeToRefs } from 'pinia'
import { useControlStore, useCanvasStore, useWidgetStore } from '@/store'
import useUserStore from '@/store/base/user'

type TProps = {
  active?: number
}

type TState = {
  prePath: string
  percent: { num: number }
  imgList: IGetTempListData[]
  designList: IGetTempListData[]
  isDone: boolean
  editOptions: Record<string, any>
  tabActiveName: string
}

const props = defineProps<TProps>()
void props

const route = useRoute()
const router = useRouter()

const controlStore = useControlStore()
const widgetStore = useWidgetStore()
const userStore = useUserStore()

const { dPage } = storeToRefs(useCanvasStore())
const listRef = ref<HTMLElement | null>(null)
const imgListRef = ref<typeof photoList | null>(null)

const state = reactive<TState>({
  prePath: 'user',
  percent: { num: 0 },
  imgList: [],
  designList: [],
  isDone: false,
  editOptions: [],
  tabActiveName: '',
})

let loading = false
let page = 0
let listPage = 0
let photoLoadNotified = false
let designLoadNotified = false
const designPreviewHydratingIds = new Set<string>()
const designThumbCaptureIds = new Set<string>()
const DESIGN_THUMB_CACHE_PREFIX = 'xp_design_thumb:v2:'

function withVersionParam(url: string, version?: string | number) {
  const src = String(url || '').trim()
  if (!src) return src
  if (version === undefined || version === null || String(version).trim() === '') {
    return src
  }
  return `${src}${src.includes('?') ? '&' : '?'}v=${encodeURIComponent(String(version))}`
}

function buildDesignScreenshotThumb(
  id: string | number,
  opts?: { force?: number; bust?: boolean; width?: number; height?: number },
) {
  const base = String(_config.SCREEN_URL || _config.API_URL || '').replace(/\/$/, '')
  if (!base) return ''
  const width = Math.max(1, Math.round(Number(opts?.width) || 1242))
  const height = Math.max(1, Math.round(Number(opts?.height) || 1660))
  const force = opts?.force ?? 0
  const bust = opts?.bust ? `&_cv=${Date.now()}` : ''
  return `${base}/api/screenshots?id=${encodeURIComponent(String(id))}&width=${width}&height=${height}&type=file&index=0&force=${force}${bust}`
}

function getDesignThumbCacheKey(id: string | number) {
  return `${DESIGN_THUMB_CACHE_PREFIX}${String(id)}`
}

function readCachedDesignThumb(id: string | number) {
  try {
    return localStorage.getItem(getDesignThumbCacheKey(id)) || ''
  } catch {
    return ''
  }
}

function writeCachedDesignThumb(id: string | number, value: string) {
  if (!value) return
  try {
    localStorage.setItem(getDesignThumbCacheKey(id), value)
  } catch {
    /* ignore quota/storage errors */
  }
}

function clearCachedDesignThumb(id: string | number) {
  try {
    localStorage.removeItem(getDesignThumbCacheKey(id))
  } catch {
    /* ignore quota/storage errors */
  }
}

function isScreenshotPreview(value?: string) {
  const src = String(value || '').trim()
  return src.includes('/api/screenshots?') || src.includes('-screenshot-vp-')
}

function normalizeDesignPreview(
  item: IGetTempListData & Record<string, any>,
  opts?: { preferFreshScreenshot?: boolean },
) {
  const version = item.updated_at || item.updated_time || item.coverUpdatedAt || item.modified_at
  const rawPreview = String(item.thumb || item.cover || item.url || '').trim()
  const cachedPreview = readCachedDesignThumb(item.id)
  const useFreshScreenshot = opts?.preferFreshScreenshot === true || !rawPreview
  const fallbackPreview = buildDesignScreenshotThumb(item.id, {
    width: item.width,
    height: item.height,
    force: useFreshScreenshot ? 1 : 0,
    bust: useFreshScreenshot,
  })
  const basePreview =
    cachedPreview
      ? cachedPreview
      : useFreshScreenshot || isScreenshotPreview(rawPreview)
        ? fallbackPreview || rawPreview
        : rawPreview || fallbackPreview
  const preview = normalizeLoopbackMediaUrl(withVersionParam(basePreview, version))
  return {
    ...item,
    thumb: preview,
    cover: preview,
    url: preview || normalizeLoopbackMediaUrl(String(item.url || '').trim()) || fallbackPreview,
  }
}

function shouldHydrateDesignPreview(item: IGetTempListData & Record<string, any>) {
  const rawPreview = String(item.thumb || item.cover || item.url || '').trim()
  const width = Number(item.width) || 0
  const height = Number(item.height) || 0
  return !rawPreview || width <= 0 || height <= 0
}

async function hydrateDesignPreviewRows(items: Array<IGetTempListData & Record<string, any>>) {
  const candidates = items.filter((item) => {
    const key = String(item.id || '').trim()
    if (!key || !shouldHydrateDesignPreview(item)) return false
    if (designPreviewHydratingIds.has(key)) return false
    designPreviewHydratingIds.add(key)
    return true
  })

  if (candidates.length <= 0) return

  const results = await Promise.allSettled(
    candidates.map(async (item) => {
      const detail = (await api.home.getWorks({ id: item.id })) as Record<string, any>
      return {
        id: item.id,
        detail,
      }
    }),
  )

  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i]
    const key = String(candidate.id || '').trim()
    designPreviewHydratingIds.delete(key)

    const result = results[i]
    if (result.status !== 'fulfilled') continue

    const detail = result.value.detail || {}
    const idx = state.designList.findIndex((x) => String(x.id) === String(candidate.id))
    if (idx < 0) continue

    const merged = normalizeDesignPreview({
      ...state.designList[idx],
      width: Number(state.designList[idx].width) || Number(detail.width) || state.designList[idx].width,
      height: Number(state.designList[idx].height) || Number(detail.height) || state.designList[idx].height,
      cover: String(state.designList[idx].cover || detail.cover || '').trim(),
      thumb: String((state.designList[idx] as Record<string, any>).thumb || detail.thumb || detail.cover || '').trim(),
      url: String(state.designList[idx].url || detail.cover || detail.url || '').trim(),
      updated_time: (state.designList[idx] as Record<string, any>).updated_time || detail.updated_time,
      updated_at: (state.designList[idx] as Record<string, any>).updated_at || detail.updated_at,
      modified_at: (state.designList[idx] as Record<string, any>).modified_at || detail.modified_at,
    } as IGetTempListData & Record<string, any>, {
      preferFreshScreenshot: true,
    })

    state.designList.splice(idx, 1, merged)
  }
}

async function captureDesignThumbFromCanvas(id: string | number) {
  const key = String(id || '').trim()
  if (!key || designThumbCaptureIds.has(key)) return
  const source = document.getElementById('page-design-canvas') as HTMLElement | null
  if (!source) return

  designThumbCaptureIds.add(key)
  try {
    await nextTick()
    const clone = source.cloneNode(true) as HTMLElement
    clone.setAttribute('id', `design-thumb-clone-${key}`)
    clone.style.position = 'fixed'
    clone.style.left = '-20000px'
    clone.style.top = '0'
    clone.style.width = `${source.offsetWidth || source.clientWidth || Number.parseFloat(source.style.width || '0') || 1242}px`
    clone.style.height = `${source.offsetHeight || source.clientHeight || Number.parseFloat(source.style.height || '0') || 1660}px`
    clone.style.transform = 'none'
    clone.style.transformOrigin = 'left top'
    clone.style.opacity = '1'
    clone.style.pointerEvents = 'none'
    document.body.appendChild(clone)

    const canvas = await html2canvas(clone, {
      useCORS: true,
      scale: 0.36,
      backgroundColor: '#ffffff',
    })
    clone.remove()

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    if (!dataUrl) return
    writeCachedDesignThumb(key, dataUrl)

    const idx = state.designList.findIndex((item) => String(item.id) === key)
    if (idx >= 0) {
      const next = normalizeDesignPreview({
        ...state.designList[idx],
        thumb: dataUrl,
        cover: dataUrl,
        url: dataUrl,
      } as IGetTempListData & Record<string, any>)
      state.designList.splice(idx, 1, next)
    }
  } catch {
    /* ignore capture failures */
  } finally {
    const clone = document.getElementById(`design-thumb-clone-${key}`)
    clone?.remove()
    designThumbCaptureIds.delete(key)
  }
}

function upsertDesignListItem(item: IGetTempListData & Record<string, any>) {
  const nextId = String(item.id || '').trim()
  if (!nextId) return
  const currentIndex = state.designList.findIndex((x) => String(x.id) === nextId)
  if (currentIndex >= 0) {
    state.designList.splice(currentIndex, 1, item)
    return
  }
  state.designList = [item, ...state.designList]
}

async function refreshSavedDesignPreview(payload?: { id?: string | number; coverUpdatedAt?: string | number }) {
  const designId = String(payload?.id || route.query.id || '').trim()
  if (!designId) {
    loadDesign(true)
    return
  }

  clearCachedDesignThumb(designId)
  const freshVersion = payload?.coverUpdatedAt || Date.now()

  const currentIndex = state.designList.findIndex((x) => String(x.id) === designId)
  if (currentIndex >= 0) {
    const currentItem = state.designList[currentIndex] as IGetTempListData & Record<string, any>
    const optimisticItem = normalizeDesignPreview(
      {
        ...currentItem,
        thumb: buildDesignScreenshotThumb(designId, {
          width: currentItem.width,
          height: currentItem.height,
          force: 1,
          bust: true,
        }),
        cover: buildDesignScreenshotThumb(designId, {
          width: currentItem.width,
          height: currentItem.height,
          force: 1,
          bust: true,
        }),
        coverUpdatedAt: freshVersion,
        updated_at: freshVersion,
        updated_time: freshVersion,
        modified_at: freshVersion,
      },
      { preferFreshScreenshot: true },
    )
    state.designList.splice(currentIndex, 1, optimisticItem)
  }

  try {
    const detail = (await api.home.getWorks({ id: designId })) as Record<string, any>
    const currentItem = state.designList.find((x) => String(x.id) === designId) as (IGetTempListData & Record<string, any>) | undefined
    const merged = normalizeDesignPreview(
      {
        ...(currentItem || {}),
        ...(detail || {}),
        id: detail.id ?? currentItem?.id ?? designId,
        width: Number(detail.width) || Number(currentItem?.width) || 1242,
        height: Number(detail.height) || Number(currentItem?.height) || 1660,
        cover: String(detail.cover || currentItem?.cover || '').trim(),
        thumb: String(detail.thumb || currentItem?.thumb || detail.cover || '').trim(),
        url: String(detail.url || currentItem?.url || detail.cover || '').trim(),
        coverUpdatedAt: freshVersion,
        updated_at: detail.updated_at || currentItem?.updated_at || freshVersion,
        updated_time: detail.updated_time || currentItem?.updated_time || freshVersion,
        modified_at: detail.modified_at || currentItem?.modified_at || freshVersion,
      } as IGetTempListData & Record<string, any>,
      { preferFreshScreenshot: true },
    )
    upsertDesignListItem(merged)
  } catch {
    loadDesign(true)
    return
  }

  await nextTick()
  window.setTimeout(() => {
    void captureDesignThumbFromCanvas(designId)
  }, 180)
}

function mergeUniqueItems<T extends { id: string | number }>(current: T[], incoming: T[]) {
  const seen = new Set(current.map((item) => item.id))
  const appended = incoming.filter((item) => {
    if (seen.has(item.id)) {
      return false
    }
    seen.add(item.id)
    return true
  })
  return {
    list: current.concat(appended),
    appendedCount: appended.length,
  }
}

const load = (init?: boolean) => {
  if (init) {
    state.imgList = []
    page = 0
    state.isDone = false
  }
  if (state.isDone || loading) {
    return
  }
  if (!userStore.online) {
    state.imgList = []
    state.isDone = true
    return
  }
  loading = true
  page += 1
  api.material
    .getMyPhoto({ page })
    .then(({ list = [] }) => {
      if (list.length <= 0) {
        state.isDone = true
      } else {
        const merged = mergeUniqueItems(state.imgList, list)
        state.imgList = merged.list
        if (merged.appendedCount <= 0) {
          state.isDone = true
        }
      }
    })
    .catch(() => {
      state.isDone = true
      if (!photoLoadNotified) {
        photoLoadNotified = true
        useNotification('图片暂时无法加载', '你的图片列表暂时打不开，请稍后再试。', { type: 'warning' })
      }
    })
    .finally(() => {
      setTimeout(() => {
        loading = false
        if (!imgListRef.value) return
        checkHeight(imgListRef.value.getRef(), load)
      }, 100)
    })
}

const loadDesign = (init: boolean = false) => {
  if (init) {
    state.designList = []
    listPage = 0
    state.isDone = false
  }
  if (state.isDone || loading) {
    return
  }
  loading = true
  listPage += 1
  api.home
    .getMyDesign({ page: listPage, pageSize: 10 })
    .then(({ list = [] }) => {
      if (list.length <= 0) {
        state.isDone = true
        return
      }

      const normalizedList = list.map((x) => normalizeDesignPreview(x as IGetTempListData & Record<string, any>))
      const merged = mergeUniqueItems(state.designList, normalizedList)
      state.designList = merged.list
      if (merged.appendedCount <= 0) {
        state.isDone = true
      }
      void hydrateDesignPreviewRows(normalizedList)
    })
    .catch(() => {
      state.isDone = true
      if (!designLoadNotified) {
        designLoadNotified = true
        useNotification('作品暂时无法加载', '你的作品列表暂时打不开，请稍后再试。', { type: 'warning' })
      }
    })
    .finally(() => {
      setTimeout(() => {
        loading = false
        if (!listRef.value) return
        checkHeight(listRef.value, loadDesign)
      }, 100)
    })
}

function checkHeight(el: HTMLElement, loadFn: Function) {
  if (el.offsetHeight && el.firstElementChild) {
    const isLess = el.offsetHeight > (el.firstElementChild as HTMLElement).offsetHeight
    isLess && loadFn()
  }
}

onMounted(() => {
  nextTick(() => {
    state.tabActiveName = route.query.userTab === 'design' ? 'design' : 'pics'
    if (state.tabActiveName === 'design') {
      loadDesign(true)
      return
    }
    load(true)
  })
})

const selectImg = async (index: number) => {
  const item = state.imgList[index]
  controlStore.setShowMoveable(false)

  const setting = JSON.parse(JSON.stringify(wImageSetting))
  const img = await setImageData(item)
  setting.width = img.width
  setting.height = img.height
  setting.imgUrl = item.url
  const { width: pW, height: pH } = dPage.value
  setting.left = pW / 2 - img.width / 2
  setting.top = pH / 2 - img.height / 2

  widgetStore.addWidget(setting)
}

type controlImgParam = {
  i: number
  item: Required<TItem2DataParam>
}

const deleteImg = async ({ i, item }: controlImgParam) => {
  controlStore.setShowMoveable(false)

  const isPass = await useConfirm('删除后将无法恢复，已引用的图片也会失效，是否继续？', '确认删除这张图片吗？', 'warning')
  if (!isPass) {
    return false
  }
  const arr = item.url.split('/')
  const key = arr.splice(3, arr.length - 1).join('/')
  try {
    await api.material.deleteMyPhoto({ id: item.id, key })
    if (!imgListRef.value) return
    imgListRef.value.delItem(i)
    useNotification('删除成功', '图片已经从列表中移除。', { type: 'success' })
  } catch {
    useNotification('删除失败', '这张图片暂时无法删除，请稍后再试。', { type: 'error' })
  }
}

const deleteWorks = async ({ i, item }: controlImgParam) => {
  const isPass = await useConfirm('删除后将无法恢复。', '确认删除这个作品吗？', 'warning')
  if (!isPass) {
    return
  }

  try {
    await api.material.deleteMyWorks({ id: item.id })
    state.designList.splice(i, 1)
    useNotification('删除成功', '这个作品已经从列表中移除。', { type: 'success' })
    router.push({ path: '/home', query: {}, replace: true })
    if (state.designList.length <= 0) {
      state.isDone = false
      loadDesign(true)
    }
  } catch {
    useNotification('删除失败', '这个作品暂时无法删除，请稍后再试。', { type: 'error' })
  }
}

state.editOptions = {
  photo: [
    {
      name: '删除',
      fn: deleteImg,
    },
  ],
  works: [
    {
      name: '删除',
      fn: deleteWorks,
    },
  ],
}

const dragStart = (index: number) => {
  const item = state.imgList[index]
  widgetStore.setSelectItem({ data: { value: item }, type: 'image' })
}

const uploadDone = async (res: any) => {
  const newList = [res, ...state.imgList]
  state.imgList = []
  setTimeout(() => {
    state.imgList = newList
  }, 300)
}

const tabChange = (tabName: TabPaneName) => {
  if (tabName === 'design') {
    loadDesign(true)
  }
}

watch(
  () => route.query.userTab,
  (tab) => {
    const nextTab = tab === 'design' ? 'design' : 'pics'
    if (state.tabActiveName === nextTab) return
    state.tabActiveName = nextTab
    if (nextTab === 'design') {
      loadDesign(true)
    }
  },
)

watch(
  () => [route.query.id, route.query.userTab, state.designList.length] as const,
  ([id, userTab]) => {
    const designId = String(id || '').trim()
    if (!designId || userTab !== 'design') return
    window.setTimeout(() => {
      void captureDesignThumbFromCanvas(designId)
    }, 220)
  },
  { flush: 'post' },
)

const selectDesign = async (item: IGetTempListData) => {
  const { id } = item
  router.push({
    path: '/home',
    query: {
      id: String(id),
      section: 'mine',
      userTab: 'design',
    },
  })
}

const openPSD = () => {
  window.open(router.resolve('/psd').href, '_blank')
}

eventBus.on('refreshUserImages', () => {
  state.imgList = []
  load(true)
})

eventBus.on('refreshUserDesigns', (payload) => {
  state.tabActiveName = 'design'
  void refreshSavedDesignPreview(payload)
})

defineExpose({
  selectDesign,
  loadDesign,
  load,
  uploadDone,
  selectImg,
  deleteImg,
  dragStart,
  tabChange,
  openPSD,
})
</script>

<style lang="less" scoped>
.infinite-list {
  height: 100%;
  padding-bottom: 150px;
}

.loading {
  padding-top: 1rem;
  text-align: center;
  font-size: 14px;
  color: #999;
}

.tabs {
  padding: 0.2rem 0;
}

.upload {
  width: auto;
  margin: 0 0 0 1rem;
  display: inline-block;

  &-btn {
    width: 170px;
    font-size: 14px;
  }

  &-psd {
    width: 114px;
    margin-left: 10px;
  }
}

.wrap {
  width: 100%;
  height: 100%;
}
</style>
