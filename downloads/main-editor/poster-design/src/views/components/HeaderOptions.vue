<template>
  <div class="top-title">
    <el-input v-model="state.title" placeholder="未命名设计" class="input-wrap" />
  </div>
  <div class="top-icon-wrap">
    <template v-if="tempEditing">
      <el-button plain type="primary" @click="saveTemp">保存模板</el-button>
      <el-button @click="userStore.managerEdit(false)">取消</el-button>
      <div class="divide__line">|</div>
    </template>
    <el-button v-else style="margin-right: 0.4rem" @click="jump2Edit">修改模板</el-button>
    <button class="account-entry" type="button" :title="accountEntryLabel" :aria-label="accountEntryLabel" @click="goAccount">
      <span class="account-entry__avatar" :class="{ 'account-entry__avatar--guest': !userStore.online }">
        <img v-if="userStore.online && userAvatar" :src="userAvatar" alt="avatar">
        <span v-else>{{ userStore.online ? userInitial : '' }}</span>
      </span>
    </button>
    <watermark-option style="margin-right: 0.5rem" />
    <slot />
  </div>
  <SaveImage ref="canvasImage" />
</template>

<script lang="ts" setup>
import api from '@/api'
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import _dl from '@/common/methods/download'
import useNotification from '@/common/methods/notification'
import SaveImage from '@/components/business/save-download/CreateCover.vue'
import { useFontStore } from '@/common/methods/fonts'
import _config from '@/config'
import downloadBlob from '@/common/methods/download/downloadBlob'
import { useControlStore, useCanvasStore, useUserStore, useWidgetStore } from '@/store/index'
import { storeToRefs } from 'pinia'
import watermarkOption from './Watermark.vue'

type TProps = {
  modelValue?: boolean
}

type TDownloadChange = {
  downloadPercent: number
  downloadText: string
  downloadMsg?: string
  downloadImage?: string
}

type TEmits = {
  (event: 'change', data: TDownloadChange): void
  (event: 'update:modelValue', data: boolean): void
}

type TState = {
  stateBollean: boolean
  wmBollean: boolean
  title: string
  loading: boolean
}

type TLocalDraft = {
  title: string
  type: number
  width: number
  height: number
  data: string
  savedAt: number
}

const props = defineProps<TProps>()
const emit = defineEmits<TEmits>()
const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const widgetStore = useWidgetStore()

const canvasImage = ref<typeof SaveImage | null>(null)
const pageStore = useCanvasStore()
const controlStore = useControlStore()

const { dPage } = storeToRefs(pageStore)
const { tempEditing } = storeToRefs(userStore)
const { dWidgets, dLayouts } = storeToRefs(widgetStore)

const state = reactive<TState>({
  stateBollean: false,
  wmBollean: false,
  title: '',
  loading: false,
})

const userAvatar = computed(() => userStore.user.avatar || '')
const userInitial = computed(() => (userStore.user.name || '我').slice(0, 1))
const accountEntryLabel = computed(() => (userStore.online ? '个人中心' : '登录'))

let currentDownloadPreviewUrl = ''

function updateDownloadPreview(url: string) {
  if (currentDownloadPreviewUrl && currentDownloadPreviewUrl.startsWith('blob:') && currentDownloadPreviewUrl !== url) {
    URL.revokeObjectURL(currentDownloadPreviewUrl)
  }
  currentDownloadPreviewUrl = url
}

function emitDownloadChange(payload: TDownloadChange) {
  if (payload.downloadImage !== undefined) {
    updateDownloadPreview(payload.downloadImage)
  }
  emit('change', payload)
}

function getLocalDraftKey() {
  const { id, tempid, tempType } = route.query
  return `xp_design_local_draft:${String(tempid || id || 'new')}:${String(tempType || 0)}`
}

function buildDraftPayload(type: number): TLocalDraft {
  return {
    title: state.title || (type === 1 ? '未命名组件' : '未命名模板'),
    type,
    width: dPage.value.width,
    height: dPage.value.height,
    data: type === 1 ? JSON.stringify(dWidgets.value) : JSON.stringify(dLayouts.value),
    savedAt: Date.now(),
  }
}

function saveLocalDraft(payload: TLocalDraft) {
  localStorage.setItem(getLocalDraftKey(), JSON.stringify(payload))
}

function clearLocalDraft() {
  localStorage.removeItem(getLocalDraftKey())
}

function readLocalDraft(): TLocalDraft | null {
  const raw = localStorage.getItem(getLocalDraftKey())
  if (!raw) return null
  try {
    return JSON.parse(raw) as TLocalDraft
  } catch {
    localStorage.removeItem(getLocalDraftKey())
    return null
  }
}

function applyLoadedData(content: string, type: string | number | undefined, width?: number, height?: number) {
  const data = JSON.parse(content)
  controlStore.setShowMoveable(false)
  if (Number(type) === 1) {
    width && (dPage.value.width = width)
    height && (dPage.value.height = height)
    widgetStore.addGroup(data)
    return
  }
  if (Array.isArray(data)) {
    widgetStore.dLayouts = data
    widgetStore.setDWidgets(widgetStore.getWidgets())
  } else {
    widgetStore.dLayouts = [{ global: data.page, layers: data.widgets }]
    route.query.id ? widgetStore.setDWidgets(widgetStore.getWidgets()) : widgetStore.setTemplate(widgetStore.getWidgets())
  }
  pageStore.setDPage(pageStore.getDPage())
}

async function save() {
  await saveTemp()
}

async function saveTemp() {
  const { tempid, tempType: type } = route.query
  if (!tempid) return

  let res = null as any
  const numericType = Number(type || 0)

  try {
    if (numericType === 1) {
      if (dWidgets.value[0]?.type === 'w-group') {
        const group = dWidgets.value.shift()
        if (!group) return
        group.record.width = 0
        group.record.height = 0
        dWidgets.value.push(group)
      }

      if (!dWidgets.value.some((x: Record<string, any>) => x.type === 'w-group')) {
        useNotification('暂时无法保存', '这个组件还没有完成组合，请先组合完成后再保存。', { type: 'warning' })
        return
      }

      const payload = buildDraftPayload(numericType)
      res = await api.home.saveTemp({
        id: tempid,
        type,
        title: payload.title,
        data: payload.data,
        width: payload.width,
        height: payload.height,
      })
    } else {
      const payload = buildDraftPayload(numericType)
      res = await api.home.saveTemp({
        id: tempid,
        title: payload.title,
        data: payload.data,
        width: payload.width,
        height: payload.height,
      })
    }

    clearLocalDraft()
    if (res?.stat != 0) {
      useNotification('保存成功', '刚刚的修改已经保存好了。', { type: 'success' })
    }
    !tempid && router.push({ path: '/home', query: { tempid: res.id }, replace: true })
  } catch (error: any) {
    const message = String(error?.message || '')
    const isNetworkError = message.includes('Network Error') || message.includes('ERR_CONNECTION_REFUSED')
    if (isNetworkError) {
      saveLocalDraft(buildDraftPayload(numericType))
    }

    useNotification(
      '保存失败',
      isNetworkError
        ? '当前网络连接异常，内容已经自动保存在本机草稿里，请稍后再试。'
        : '当前暂时无法保存，请稍后再试。',
      { type: 'error' },
    )
  }
}

async function stateChange(e: string | number | boolean) {
  const { tempid, tempType: type } = route.query
  const { stat } = await api.home.saveTemp({ id: tempid, type, state: e ? 1 : 0 })
  if (stat != 0) {
    useNotification('保存成功', '模板状态已经更新。')
  }
}

async function download() {
  if (state.loading === true) {
    useNotification('正在导出', '当前已有导出任务，请稍后再试。')
    return
  }

  state.loading = true
  emit('update:modelValue', true)
  emitDownloadChange({ downloadPercent: 1, downloadText: '正在准备导出，请稍候...', downloadImage: '' })

  const currentRecord = pageStore.dCurrentPage
  const backEndCapture = checkDownloadPoster(dLayouts.value[currentRecord])
  const fileName = `${state.title || '未命名作品'}.png`

  if (!backEndCapture) {
    const result = (await canvasImage.value?.createPoster()) as { blob?: Blob } | undefined
    const blob = result?.blob
    const previewUrl = blob ? URL.createObjectURL(blob) : ''
    if (blob) {
      downloadBlob(blob, fileName)
    }
    emitDownloadChange({ downloadPercent: 100, downloadText: '导出成功，文件已保存到本地。', downloadImage: previewUrl })
    state.loading = false
    return
  }

  await save()
  const { id, tempid } = route.query
  if (!id && !tempid) {
    emitDownloadChange({ downloadPercent: 0, downloadText: '请稍候...', downloadImage: '' })
    useNotification('暂时无法导出', '请先打开一个作品或模板后再导出。', { type: 'error' })
    state.loading = false
    return
  }

  try {
    const { width, height } = dPage.value
    const previewUrl = `${api.home.download({ id, tempid, width, height, index: pageStore.dCurrentPage })}&r=${Math.random()}`
    emit('update:modelValue', true)
    emitDownloadChange({ downloadPercent: 1, downloadText: '正在处理图片...', downloadImage: previewUrl })

    let timerCount = 0
    const animation = setInterval(() => {
      if (props.modelValue && timerCount < 75) {
        timerCount += randomNumber(1, 10)
        emitDownloadChange({ downloadPercent: 1 + timerCount, downloadText: '正在生成图片', downloadImage: previewUrl })
      } else {
        clearInterval(animation)
      }
    }, 800)

    await _dl.downloadImg(
      previewUrl,
      (progress: number, xhr: XMLHttpRequest) => {
        if (props.modelValue) {
          clearInterval(animation)
          if (progress >= timerCount) {
            emitDownloadChange({
              downloadPercent: Number(progress.toFixed(0)),
              downloadText: '图片生成中...',
              downloadImage: previewUrl,
            })
          }
        } else {
          xhr.abort()
          state.loading = false
        }
      },
      fileName,
    )

    emitDownloadChange({
      downloadPercent: 100,
      downloadText: '导出成功，文件已保存到本地。',
      downloadMsg: '',
      downloadImage: previewUrl,
    })
  } catch {
    useNotification('导出失败', '图片暂时无法导出，请稍后重试。', { type: 'error' })
  } finally {
    state.loading = false
  }
}

function randomNumber(min: number, max: number) {
  return Math.ceil(Math.random() * (max - min)) + min
}

async function load(cb: () => void) {
  const { id, tempid: tempId, tempType: type, w_h } = route.query
  if (route.name !== 'Draw') {
    await useFontStore.init()
  }
  const apiName = tempId && !id ? 'getTempDetail' : 'getWorks'
  if (w_h && !id && !tempId) {
    const wh: any = w_h.toString().split('*')
    wh[0] && (dPage.value.width = wh[0])
    wh[1] && (dPage.value.height = wh[1])
  }
  if (!id && !tempId) {
    initBoard()
    cb()
    return
  }

  try {
    const { data: content, title, state: templateState, width, height } = await api.home[apiName]({ id: id || tempId, type })
    if (!content) {
      initBoard()
      cb()
      return
    }
    state.stateBollean = !!templateState
    state.title = title
    applyLoadedData(content, type, width, height)
    cb()
  } catch (error: any) {
    const message = String(error?.message || '')
    const isNetworkError = message.includes('Network Error') || message.includes('ERR_CONNECTION_REFUSED')
    const localDraft = readLocalDraft()
    if (isNetworkError && localDraft?.data) {
      state.title = localDraft.title
      state.stateBollean = false
      applyLoadedData(localDraft.data, localDraft.type, localDraft.width, localDraft.height)
      useNotification('已恢复本地草稿', '刚刚已经帮你打开了本机保存的草稿内容。', { type: 'warning' })
      cb()
      return
    }
    useNotification('加载失败', '当前暂时无法加载内容，请稍后再试。', { type: 'error' })
    initBoard()
    cb()
  }
}

function initBoard() {
  widgetStore.setDWidgets(widgetStore.getWidgets())
  pageStore.setDPage(pageStore.getDPage())
}

function draw() {
  return new Promise<string>((resolve) => {
    if (!canvasImage.value) {
      resolve('')
    } else {
      canvasImage.value.createCover(({ url, key }: { url?: string; key?: string }) => {
        resolve(url || (key ? _config.IMG_URL + key : ''))
      })
    }
  })
}

function jump2Edit() {
  userStore.managerEdit(true)
}

function goAccount() {
  router.push(userStore.online ? '/account' : '/login')
}

function checkDownloadPoster(board: any) {
  const layers = board?.layers || []
  let backEndCapture = false
  for (let i = 0; i < layers.length; i++) {
    const { type, mask, textEffects } = layers[i]
    if ((type === 'w-image' && mask) || type === 'w-svg' || type === 'w-qrcode' || (textEffects && textEffects.length > 0)) {
      backEndCapture = true
      break
    }
  }
  return backEndCapture
}

defineExpose({
  download,
  save,
  saveTemp,
  stateChange,
  load,
  draw,
})
</script>

<style lang="less" scoped>
.top-icon-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-right: 18px;
  height: 54px;

  :deep(.el-button) {
    border-radius: 12px;
    min-height: 38px;
    padding: 0 16px;
    border-color: rgba(148, 163, 184, 0.24);
    color: #334155;
    background: rgba(255, 255, 255, 0.72);
    box-shadow: none;
  }

  :deep(.el-button:hover) {
    color: #1d4ed8;
    border-color: rgba(59, 130, 246, 0.28);
    background: rgba(239, 246, 255, 0.9);
  }

  :deep(.el-button--primary) {
    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
    border-color: transparent;
    color: #fff;
    box-shadow: 0 12px 24px rgba(37, 99, 235, 0.22);
  }

  :deep(.el-button--primary:hover) {
    background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
    color: #fff;
  }
}

.top-title {
  color: @color-black;
  flex: 1;
  padding-left: 18px;

  .input-wrap {
    width: 20rem;

    :deep(input) {
      height: 40px;
      border-radius: 12px;
      border-color: rgba(148, 163, 184, 0.25);
      background: rgba(248, 250, 252, 0.95);
      color: #0f172a;
      font-weight: 600;
      padding-left: 14px;
    }
  }

  .input-wrap:hover {
    :deep(input) {
      border-color: rgba(59, 130, 246, 0.3);
    }
  }

  .input-wrap :deep(.el-input__wrapper) {
    box-shadow: none;
    background: transparent;
  }
}

.account-entry {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  width: 36px;
  min-height: 34px;
  min-width: 36px;
  padding: 0;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.86);
  color: #334155;
  cursor: pointer;
  transition: all 0.18s ease;
  white-space: nowrap;
  line-height: 1;
}

.account-entry:hover {
  color: #1d4ed8;
  border-color: rgba(59, 130, 246, 0.28);
  background: rgba(239, 246, 255, 0.9);
}

.account-entry__avatar {
  width: 22px;
  height: 22px;
  min-width: 22px;
  min-height: 22px;
  max-width: 22px;
  max-height: 22px;
  border-radius: 999px;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #dbeafe, #fed7aa);
  color: #0f172a;
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
}

.account-entry__avatar--guest {
  background: linear-gradient(135deg, #e2e8f0, #cbd5e1);
}

.account-entry__avatar img {
  width: 22px;
  height: 22px;
  min-width: 22px;
  min-height: 22px;
  max-width: 22px;
  max-height: 22px;
  object-fit: cover;
  display: block;
  flex: 0 0 22px;
}

.divide__line {
  margin: 0 0.15rem;
  color: rgba(148, 163, 184, 0.48);
  height: 20px;
}
</style>
