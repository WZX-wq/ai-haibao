<!--
 * @Author: ShawnPhang
 * @Date: 2021-08-27 15:16:07
 * @Description: 模板列表
 * @LastEditors: ShawnPhang <https://m.palxp.cn>
 * @Date: 2024-03-06 21:16:00
-->
<template>
  <div class="wrap">
    <search-header v-model="state.searchKeyword" @change="cateChange" />

    <el-divider v-show="state.title" style="margin-top: 1.7rem" content-position="left">
      <span style="font-weight: bold">{{ state.title }}</span>
    </el-divider>

    <el-button class="upload-psd" plain type="primary" @click="openPSD">导入 PSD 创建模板</el-button>

    <ul ref="listRef" v-infinite-scroll="load" class="infinite-list" :infinite-scroll-distance="150">
      <img-water-fall :list-data="state.list" :active-temp-id="activeTempId" @select="selectItem" />
      <div v-show="state.loading" class="loading"><i class="el-icon-loading"></i> 正在加载中...</div>
      <div v-show="state.loadDone" class="loading">已经到底了</div>
    </ul>
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import api from '@/api'
import _config from '@/config'
import { deepNormalizeLoopbackMediaUrls, normalizeLoopbackMediaUrl } from '@/utils/publicMediaUrl'
import { LocationQueryValue, useRoute, useRouter } from 'vue-router'
import searchHeader from './components/searchHeader.vue'
import useConfirm from '@/common/methods/confirm'
import useNotification from '@/common/methods/notification'
import imgWaterFall from './components/imgWaterFall.vue'
import { IGetTempListData } from '@/api/home'
import { useControlStore, useCanvasStore, useUserStore, useHistoryStore, useWidgetStore, useForceStore } from '@/store'
import { storeToRefs } from 'pinia'

type TState = {
  loading: boolean
  loadDone: boolean
  list: IGetTempListData[]
  title: string
  searchKeyword: string
}

type TPageOptions = {
  page: number
  pageSize: number
  cate: number | string
  state?: string
}

const listRef = ref<HTMLElement | null>(null)
const route = useRoute()
const router = useRouter()

const controlStore = useControlStore()
const userStore = useUserStore()
const pageStore = useCanvasStore()
const widgetStore = useWidgetStore()
const forceStore = useForceStore()

const state = reactive<TState>({
  loading: false,
  loadDone: false,
  list: [],
  title: '示例模板',
  searchKeyword: '',
})

const { dHistoryParams } = storeToRefs(useHistoryStore())
let listLoadNotified = false
let detailLoadNotified = false

const pageOptions: TPageOptions = { page: 0, pageSize: 20, cate: 0 }
const { cate, edit } = route.query
if (cate !== undefined && cate !== null && String(cate) !== '') {
  pageOptions.cate = (Array.isArray(cate) ? cate[0] : cate) as LocationQueryValue as number | string
}
edit && userStore.managerEdit(true)

const activeTempId = computed<number | null>(() => {
  if (route.query.id) return null
  const t = route.query.tempid
  if (t === undefined || t === null || t === '') return null
  const v = Array.isArray(t) ? t[0] : t
  const n = Number(v)
  return Number.isFinite(n) ? n : null
})

function buildScreenshotThumb(
  tempId: number,
  opts?: { force?: number; bust?: boolean; width?: number; height?: number },
) {
  const base = String(_config.SCREEN_URL || _config.API_URL || '').replace(/\/$/, '')
  if (!base) return ''
  const force = opts?.force ?? 0
  const bust = opts?.bust ? `&_cv=${Date.now()}` : ''
  const w = Math.max(1, Math.round(Number(opts?.width) || 1242))
  const h = Math.max(1, Math.round(Number(opts?.height) || 1660))
  return `${base}/api/screenshots?tempid=${tempId}&width=${w}&height=${h}&type=file&index=0&force=${force}${bust}`
}

function buildPinnedListItem(
  tid: number,
  detail: Record<string, unknown>,
  thumbOpts?: { force?: number; bust?: boolean },
): IGetTempListData {
  const w = Number(detail.width) || 1242
  const h = Number(detail.height) || 1660
  const coverRaw = normalizeLoopbackMediaUrl(String(detail.cover || detail.thumb || '').trim())
  const cover = coverRaw || buildScreenshotThumb(tid, { ...thumbOpts, width: w, height: h })
  return {
    id: tid,
    title: String(detail.title || '当前模板'),
    width: w,
    height: h,
    state: Number(detail.state) || 1,
    cover: cover || '/template-cover-1.png',
    thumb: cover || undefined,
    url: cover || '/template-cover-1.png',
    isDelect: false,
    fail: false,
    top: 0,
    left: 0,
  }
}

/** API 与 JSON 可能混用 number / string id，Set.has 会认为 307 !== "307" 导致重复项，Vue key 复用错乱（缩略图与高亮对不上） */
function normalizeTemplateId(id: unknown): number | null {
  const n = Number(id)
  return Number.isFinite(n) ? n : null
}

function normalizeAndDedupeTemplateList(list: IGetTempListData[]): IGetTempListData[] {
  const seen = new Set<number>()
  const out: IGetTempListData[] = []
  for (const raw of list) {
    const id = normalizeTemplateId(raw.id)
    if (id == null) continue
    if (seen.has(id)) continue
    seen.add(id)
    out.push({ ...raw, id })
  }
  return out
}

/** 用当前详情 + 截图接口刷新左侧该 id 卡片，避免列表缓存图与画布不一致 */
async function upsertListRowFromDetail(tid: number, refreshThumb = false) {
  try {
    const detail = (await api.home.getTempDetail({ id: tid })) as Record<string, unknown>
    const row = buildPinnedListItem(tid, detail, refreshThumb ? { force: 1, bust: true } : undefined)
    const idx = state.list.findIndex((x) => normalizeTemplateId(x.id) === tid)
    if (idx >= 0) {
      state.list.splice(idx, 1, row)
    }
  } catch {
    /* ignore */
  }
}

/** 只在左侧列表容器内滚动，禁止 scrollIntoView（会连带滚动 window/外层，造成整页上移与底部留白） */
function scrollTemplateCardIntoView(tid: number) {
  const root = listRef.value
  if (!root) return
  const el = root.querySelector(`[data-template-id="${tid}"]`) as HTMLElement | null
  if (!el) return

  const rootRect = root.getBoundingClientRect()
  const elRect = el.getBoundingClientRect()
  const elMid = elRect.top + elRect.height / 2
  const rootMid = rootRect.top + rootRect.height / 2
  const delta = elMid - rootMid
  if (Math.abs(delta) < 2) return

  const maxScroll = Math.max(0, root.scrollHeight - root.clientHeight)
  const nextTop = Math.max(0, Math.min(root.scrollTop + delta, maxScroll))
  root.scrollTo({ top: nextTop, behavior: 'smooth' })
}

function waitLoadingEnd(maxMs = 12000): Promise<void> {
  return new Promise((resolve) => {
    if (!state.loading) {
      resolve()
      return
    }
    const t0 = Date.now()
    const iv = setInterval(() => {
      if (!state.loading || Date.now() - t0 > maxMs) {
        clearInterval(iv)
        resolve()
      }
    }, 40)
  })
}

async function syncSidebarToActiveTempId() {
  const tid = activeTempId.value
  if (tid == null) return

  const listHas = () => state.list.some((x) => normalizeTemplateId(x.id) === tid)

  if (listHas()) {
    await upsertListRowFromDetail(tid, true)
    await nextTick()
    scrollTemplateCardIntoView(tid)
    return
  }

  let steps = 0
  while (steps < 30 && !listHas()) {
    if (state.loadDone && !state.loading) break
    await waitLoadingEnd()
    if (listHas()) break
    if (state.loadDone) break
    await load(false)
    await waitLoadingEnd()
    steps++
  }

  if (!listHas()) {
    try {
      const detail = (await api.home.getTempDetail({ id: tid })) as Record<string, unknown>
      const row = buildPinnedListItem(tid, detail, { force: 1, bust: true })
      state.list = normalizeAndDedupeTemplateList([row, ...state.list.filter((x) => normalizeTemplateId(x.id) !== tid)])
    } catch {
      /* ignore */
    }
  } else {
    await upsertListRowFromDetail(tid, true)
  }

  state.list = normalizeAndDedupeTemplateList(state.list)
  await nextTick()
  scrollTemplateCardIntoView(tid)
}

let syncDebounce: ReturnType<typeof setTimeout> | null = null
function scheduleSyncSidebar() {
  if (syncDebounce) clearTimeout(syncDebounce)
  syncDebounce = setTimeout(() => {
    syncDebounce = null
    void syncSidebarToActiveTempId()
  }, 100)
}

watch(activeTempId, () => {
  scheduleSyncSidebar()
})

watch(
  () => String(route.query.cate ?? ''),
  () => {
    if (activeTempId.value == null) return
    scheduleSyncSidebar()
  },
)

onMounted(() => {
  if (activeTempId.value != null) {
    scheduleSyncSidebar()
  }
})

function mergeUniqueTemplates(current: IGetTempListData[], incoming: IGetTempListData[]) {
  const seen = new Set<number>()
  const normalizedCurrent: IGetTempListData[] = []
  for (const item of current) {
    const id = normalizeTemplateId(item.id)
    if (id == null) continue
    if (seen.has(id)) continue
    seen.add(id)
    normalizedCurrent.push({ ...item, id })
  }
  const appended: IGetTempListData[] = []
  for (const raw of incoming) {
    const id = normalizeTemplateId(raw.id)
    if (id == null) continue
    if (seen.has(id)) continue
    seen.add(id)
    appended.push({ ...raw, id })
  }
  return {
    list: normalizedCurrent.concat(appended),
    appendedCount: appended.length,
  }
}

const load = async (init: boolean = false, stat?: string, retryAttempt: number = 0) => {
  stat && (pageOptions.state = stat)

  if (init && listRef.value) {
    listRef.value.scrollTop = 0
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
    const res = await api.home.getTempList({ search: state.searchKeyword, ...pageOptions })
    const nextList = res.list || []
    if (nextList.length <= 0) {
      state.loadDone = true
    } else {
      const merged = mergeUniqueTemplates(state.list, nextList)
      state.list = normalizeAndDedupeTemplateList(merged.list)
      if (merged.appendedCount <= 0) {
        state.loadDone = true
      }
    }
  } catch {
    pageOptions.page = Math.max(0, requestedPage - 1)
    if (retryAttempt < 3) {
      setTimeout(() => {
        load(false, stat, retryAttempt + 1)
      }, 500 * (retryAttempt + 1))
      state.loading = false
      return
    }
    if (init) {
      state.list = []
    }
    state.loadDone = false
    if (!listLoadNotified) {
      listLoadNotified = true
      useNotification('模板暂时不可用', '模板内容暂时加载失败，请稍后刷新页面再试。', { type: 'warning' })
    }
  }

  setTimeout(() => {
    state.loading = false
    checkHeight()
  }, 100)
}

function cateChange(type: any) {
  state.title = type.name
  const nextId = type.id
  const init = pageOptions.cate != nextId
  const queryAligned = String(route.query.cate ?? '') === String(nextId)
  pageOptions.cate = nextId
  if (!queryAligned) {
    router.replace({
      path: '/home',
      query: {
        ...route.query,
        cate: String(nextId),
      },
    })
  }
  if (init || !queryAligned) {
    load(init, pageOptions.state)
  }
}

function checkHeight() {
  if (!listRef.value) return
  const firstElement = listRef.value.firstElementChild as HTMLElement | null
  const isLess = !!firstElement && listRef.value.offsetHeight > firstElement.offsetHeight
  isLess && load()
}

let hideReplacePrompt: any = localStorage.getItem('hide_replace_prompt')

function isRenderableTemplateData(result: any) {
  if (Array.isArray(result)) {
    return !!result[0]?.global && Array.isArray(result[0]?.layers)
  }
  return !!result?.page && Array.isArray(result?.widgets)
}

function parseTemplatePayload(payload: any) {
  if (payload === null || typeof payload === 'undefined') return null
  if (typeof payload === 'string') {
    if (!payload.trim()) return null
    return JSON.parse(payload)
  }
  if (Array.isArray(payload) || typeof payload === 'object') {
    return payload
  }
  return null
}

function buildTemplateSearchKeywords(item: IGetTempListData) {
  const fullTitle = String(item.title || '').trim()
  const normalized = fullTitle.replace(/^示例模板\s*-\s*/u, '').trim()
  return [fullTitle, normalized].filter((value, index, arr) => value && arr.indexOf(value) === index)
}

async function tryResolveLiveTemplateId(item: IGetTempListData) {
  const keywords = buildTemplateSearchKeywords(item)
  for (const keyword of keywords) {
    try {
      const res = await api.home.getTempList({
        search: keyword,
        page: 1,
        pageSize: 200,
        cate: 0,
      })
      const list = Array.isArray(res?.list) ? res.list : []
      const exact =
        list.find((candidate) => String(candidate.title || '').trim() === String(item.title || '').trim()) ||
        list.find((candidate) => String(candidate.title || '').includes(keyword))
      if (exact?.id != null) {
        return exact
      }
    } catch {
      /* ignore */
    }
  }
  return null
}

async function getRenderableTemplateDetail(item: IGetTempListData) {
  try {
    const detail = (await api.home.getTempDetail({ id: item.id })) as Record<string, unknown>
    return { detail, resolvedItem: item }
  } catch {
    const resolvedItem = await tryResolveLiveTemplateId(item)
    if (!resolvedItem) throw new Error('template not found')
    const detail = (await api.home.getTempDetail({ id: resolvedItem.id })) as Record<string, unknown>
    return { detail, resolvedItem }
  }
}

async function selectItem(item: IGetTempListData) {
  controlStore.setShowMoveable(false)
  if (!hideReplacePrompt && dHistoryParams.value.length > 0) {
    const doNotPrompt = await useConfirm(
      '添加到作品后，模板内容将替换当前页面内容。',
      '继续使用这个模板吗？',
      'warning',
      { confirmButtonText: '继续替换', cancelButtonText: '不再提示' },
    )
    if (!doNotPrompt) {
      localStorage.setItem('hide_replace_prompt', '1')
      hideReplacePrompt = true
    }
  }
  userStore.managerEdit(false)
  widgetStore.setDWidgets([])

  let result = null
  let activeItem = item
  try {
    if (!item.data) {
      const { detail, resolvedItem } = await getRenderableTemplateDetail(item)
      activeItem = resolvedItem
      result = parseTemplatePayload((detail as any)?.data ?? detail)
    } else {
      result = parseTemplatePayload(item.data)
    }
  } catch {
    if (!detailLoadNotified) {
      detailLoadNotified = true
      useNotification('模板打开失败', '这个模板暂时无法打开，请稍后再试。', { type: 'error' })
    }
    return
  }

  setTempId(activeItem.id)
  if (activeItem.id !== item.id) {
    const idx = state.list.findIndex((x) => normalizeTemplateId(x.id) === normalizeTemplateId(item.id))
    if (idx >= 0) {
      state.list.splice(idx, 1, { ...state.list[idx], ...activeItem, id: Number(activeItem.id) })
    }
  }

  result = deepNormalizeLoopbackMediaUrls(result)

  if (!isRenderableTemplateData(result)) {
    useNotification('模板暂不可用', '这个模板内容不完整，暂时无法使用。', { type: 'warning' })
    return
  }

  if (Array.isArray(result)) {
    const first = result[0]
    if (!first?.global || !Array.isArray(first?.layers)) {
      useNotification('模板暂不可用', '这个模板内容不完整，暂时无法使用。', { type: 'warning' })
      return
    }
    const { global, layers } = first
    pageStore.setDPage(global)
    widgetStore.setTemplate(layers)
  } else {
    const { page, widgets } = result
    pageStore.setDPage(page)
    widgetStore.setTemplate(widgets)
  }

  setTimeout(() => {
    forceStore.setZoomScreenChange()
  }, 300)

  widgetStore.selectWidget({
    uuid: '-1',
  })
}

function setTempId(tempId: number | string) {
  const { id, ...rest } = route.query
  void id
  router.push({
    path: '/home',
    query: {
      ...rest,
      tempid: String(tempId),
    },
    replace: true,
  })
}

const openPSD = () => {
  window.open(router.resolve('/psd').href, '_blank')
}

defineExpose({
  load,
  cateChange,
  listRef,
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

.infinite-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  margin-top: 1rem;
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

.loading {
  padding: 1rem 0 1.5rem;
  text-align: center;
  font-size: 14px;
  color: #64748b;
}

.upload-psd {
  margin: 0 1rem;
  width: calc(100% - 2rem);
  height: 42px;
  border-radius: 14px;
  border-color: rgba(240, 113, 54, 0.28);
  background: linear-gradient(180deg, rgba(255, 247, 237, 0.96), rgba(255, 255, 255, 0.98));
  box-shadow: 0 10px 24px rgba(240, 113, 54, 0.12);
  font-weight: 600;
  color: #d65a1f;
}

.upload-psd:hover,
.upload-psd:focus {
  color: #b94817;
  border-color: rgba(214, 90, 31, 0.45);
  background: linear-gradient(180deg, rgba(255, 236, 221, 0.98), rgba(255, 247, 240, 0.98));
  box-shadow: 0 14px 28px rgba(214, 90, 31, 0.16);
}

.upload-psd:active {
  color: #9f3f14;
  border-color: rgba(159, 63, 20, 0.5);
  background: linear-gradient(180deg, rgba(255, 229, 209, 0.98), rgba(255, 241, 231, 0.98));
}

.upload-psd:deep(span) {
  color: inherit;
}

.upload-psd:hover:deep(span),
.upload-psd:focus:deep(span),
.upload-psd:active:deep(span) {
  color: inherit;
}
</style>
