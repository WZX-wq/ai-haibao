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

    <ul ref="listRef" v-infinite-scroll="load" class="infinite-list" :infinite-scroll-distance="150" style="overflow: auto">
      <img-water-fall :listData="state.list" @select="selectItem" />
      <div v-show="state.loading" class="loading"><i class="el-icon-loading"></i> 正在加载中...</div>
      <div v-show="state.loadDone" class="loading">已经到底了</div>
    </ul>
  </div>
</template>

<script lang="ts" setup>
import { reactive, ref } from 'vue'
import api from '@/api'
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

const pageOptions: TPageOptions = { page: 0, pageSize: 20, cate: 1 }
const { cate, edit } = route.query
cate && (pageOptions.cate = (cate as LocationQueryValue) ?? 1)
edit && userStore.managerEdit(true)

function mergeUniqueTemplates(current: IGetTempListData[], incoming: IGetTempListData[]) {
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

const load = async (init: boolean = false, stat?: string) => {
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

  try {
    const res = await api.home.getTempList({ search: state.searchKeyword, ...pageOptions })
    const nextList = res.list || []
    if (nextList.length <= 0) {
      state.loadDone = true
    } else {
      const merged = mergeUniqueTemplates(state.list, nextList)
      state.list = merged.list
      if (merged.appendedCount <= 0) {
        state.loadDone = true
      }
    }
  } catch {
    if (init) {
      state.list = []
    }
    state.loadDone = true
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
  const init = pageOptions.cate != type.id
  pageOptions.cate = type.id
  load(init, pageOptions.state)
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
  setTempId(item.id)

  let result = null
  try {
    if (!item.data) {
      const res = await api.home.getTempDetail({ id: item.id })
      result = JSON.parse(res.data)
    } else {
      result = JSON.parse(item.data)
    }
  } catch {
    if (!detailLoadNotified) {
      detailLoadNotified = true
      useNotification('模板打开失败', '这个模板暂时无法打开，请稍后再试。', { type: 'error' })
    }
    return
  }

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
  const { id } = route.query
  router.push({ path: '/home', query: { tempid: tempId, id }, replace: true })
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
  width: 100%;
  height: 100%;
  padding-top: 0.35rem;
}

.infinite-list {
  height: 100%;
  margin-top: 1rem;
  padding-bottom: 150px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.infinite-list::-webkit-scrollbar {
  display: none;
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
