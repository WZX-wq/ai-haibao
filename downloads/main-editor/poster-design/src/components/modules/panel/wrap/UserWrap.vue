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
import { reactive, nextTick, ref, onMounted } from 'vue'
import { ElTabPane, ElTabs, TabPaneName } from 'element-plus'
import { useRouter } from 'vue-router'

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

      const normalizedList = list.map((x) => ({
        ...x,
        cover: `${x.cover}?r=${Math.random()}`,
      }))
      const merged = mergeUniqueItems(state.designList, normalizedList)
      state.designList = merged.list
      if (merged.appendedCount <= 0) {
        state.isDone = true
      }
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
  load(true)
  nextTick(() => {
    state.tabActiveName = 'pics'
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

const selectDesign = async (item: IGetTempListData) => {
  const { id } = item
  /** 与模板入口统一用 tempid，避免仅带 id 时保存/导出分支不一致；大整数用字符串避免精度问题 */
  router.push({ path: '/home', query: { tempid: String(id) } })
}

const openPSD = () => {
  window.open(router.resolve('/psd').href, '_blank')
}

eventBus.on('refreshUserImages', () => {
  state.imgList = []
  load(true)
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
