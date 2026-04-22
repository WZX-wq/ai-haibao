<template>
  <div class="top-title">
    <el-input v-model="state.title" placeholder="未命名设计" class="input-wrap" />
  </div>
  <div class="top-icon-wrap">
    <template v-if="showTemplateEditActions && tempEditing">
      <el-button plain type="primary" @click="saveTemp">保存模板</el-button>
      <el-button @click="userStore.managerEdit(false)">取消</el-button>
      <div class="divide__line">|</div>
    </template>
    <el-button v-else-if="showTemplateEditActions" @click="jump2Edit">修改模板</el-button>
    <el-button class="save-work-btn" type="primary" @click="save">保存</el-button>
    <watermark-option />
    <slot />
    <button
      class="account-entry"
      :class="{ 'account-entry--guest': !userStore.online }"
      type="button"
      :title="accountEntryLabel"
      :aria-label="accountEntryLabel"
      @click="goAccount"
    >
      <template v-if="userStore.online">
        <span class="account-entry__avatar">
          <img v-if="userAvatar" :src="userAvatar" alt="头像">
          <span v-else>{{ userInitial }}</span>
        </span>
      </template>
      <span v-else class="account-entry__login-text">登录</span>
    </button>
  </div>
  <SaveImage ref="canvasImage" />
</template>

<script lang="ts" setup>
import api from '@/api'
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import _dl from '@/common/methods/download'
import { fetchImageBlobFromUrl, DOWNLOAD_XHR_READY } from '@/common/methods/download/download'
import { pngBlobToJpegBlob, savePngBlobAsPdf } from '@/common/methods/download/exportPoster'
import useNotification from '@/common/methods/notification'
import SaveImage from '@/components/business/save-download/CreateCover.vue'
import { useFontStore } from '@/common/methods/fonts'
import _config from '@/config'
import downloadBlob from '@/common/methods/download/downloadBlob'
import { useControlStore, useCanvasStore, useUserStore, useWidgetStore } from '@/store/index'
import { deepNormalizeLoopbackMediaUrls } from '@/utils/publicMediaUrl'
import eventBus from '@/utils/plugins/eventBus'
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

const canEditTemplate = computed(() => {
  const editFlag = String(route.query.edit || '').trim()
  const tempType = Number(route.query.tempType || 0)
  return editFlag === '1' || tempType === 1
})
const showTemplateEditActions = computed(() => canEditTemplate.value)

let currentDownloadPreviewUrl = ''
let activeDownloadXhr: XMLHttpRequest | null = null
/** 瀵煎嚭娴佺▼鍙栨秷鏃朵腑姝€屼繚瀛樹綔鍝併€嶈姹?*/
let activeDownloadSaveAbort: AbortController | null = null
/** 鍙栨秷鎴栨柊寮€瀵煎嚭鏃堕€掑锛岀敤浜庝涪寮冨崱浣忕殑 createPoster / 鏃ф祦绋嬪 loading 鐨勫啓鍏?*/
let exportGeneration = 0
const CLIENT_EXPORT_TIMEOUT_MS = 180000

function isRequestCanceledError(e: unknown) {
  const err = e as Record<string, unknown> | undefined
  if (!err || typeof err !== 'object') return false
  return err.code === 'ERR_CANCELED' || err.name === 'CanceledError' || err.message === 'canceled'
}

/** 涓瀵煎嚭锛氶噴鏀?loading銆佹墦鏂繚瀛樹笌涓嬭浇 XHR銆佹竻绌鸿繘搴︽潯锛堝彇娑堟寜閽笌 v-model 鍚屾閮戒細璧板埌锛?*/
function abortActiveDownload() {
  exportGeneration++
  state.loading = false
  activeDownloadSaveAbort?.abort()
  activeDownloadSaveAbort = null
  if (activeDownloadXhr) {
    try {
      activeDownloadXhr.abort()
    } catch {
      /* ignore */
    }
    activeDownloadXhr = null
  }
  emitDownloadChange({ downloadPercent: 0, downloadText: '', downloadMsg: '', downloadImage: '' })
}

watch(
  () => props.modelValue,
  (cont) => {
    if (cont !== false) return
    if (!state.loading && !activeDownloadXhr && !activeDownloadSaveAbort) return
    abortActiveDownload()
  },
  { flush: 'sync' },
)

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
  const data = deepNormalizeLoopbackMediaUrls(JSON.parse(content))
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

type TSaveTempOpts = {
  /** 瀵煎嚭鏃朵紶鍏ワ紝渚夸簬鐢ㄦ埛鐐广€屽彇娑堛€嶄腑姝繚瀛樿姹?*/
  signal?: AbortSignal
}

async function save(opts?: TSaveTempOpts) {
  const designId = String(route.query.id ?? '').trim()
  const signal = opts?.signal
  const axiosExtra = signal
    ? { signal, timeout: 120000 as number }
    : {}

  try {
    const payload = buildDraftPayload(0)
    const res = await api.home.saveWorks(
      {
        ...(designId ? { id: designId } : {}),
        title: payload.title,
        data: payload.data,
        width: payload.width,
        height: payload.height,
      },
      {},
      axiosExtra,
    )

    clearLocalDraft()
    if (res?.stat != 0) {
      useNotification('保存成功', '刚刚的修改已经保存好了。', { type: 'success' })
    }
    const resolvedDesignId = String(res?.id ?? designId ?? '').trim()
    if (resolvedDesignId) {
      const next = {
        ...route.query,
        id: resolvedDesignId,
        section: 'mine',
        userTab: 'design',
      } as Record<string, string | string[] | undefined>
      delete next.tempid
      delete next.tempType
      router.replace({ path: route.path, query: next, replace: true })
    }
    userStore.managerEdit(false)
    eventBus.emit('refreshUserDesigns', {
      id: resolvedDesignId,
    })
    controlStore.setLeftPanelMode('material')
    return resolvedDesignId
  } catch (error: any) {
    if (isRequestCanceledError(error) || signal?.aborted) {
      throw error
    }
    const message = String(error?.message || '')
    const isNetworkError = message.includes('Network Error') || message.includes('ERR_CONNECTION_REFUSED')
    if (isNetworkError) {
      saveLocalDraft(buildDraftPayload(0))
    }

    useNotification(
      '保存失败',
      isNetworkError
        ? '当前网络连接异常，内容已自动保存到本地草稿，请稍后再试。'
        : '当前暂时无法保存，请稍后重试。',
      { type: 'error' },
    )
  }

  return designId
}

async function saveTemp(opts?: TSaveTempOpts) {
  if (!canEditTemplate.value) {
    userStore.managerEdit(false)
    return
  }
  const rawId = route.query.tempid
  const designId = rawId != null && String(rawId).trim() !== '' ? String(rawId) : ''

  const { tempType: type } = route.query

  const signal = opts?.signal
  const axiosExtra = signal
    ? { signal, timeout: 120000 as number }
    : {}

  let res = null as any
  const numericType = Number(type || 0)
  const compCateForSave =
    numericType === 1
      ? String(
          route.query.comp_cate ||
            (typeof route.query.cate === 'string' ? route.query.cate : '') ||
            (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('xp_comp_cate') : '') ||
            'text',
        ).trim() || 'text'
      : ''
  const basePayload = designId ? { id: designId } : {}

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
      res = await api.home.saveTemp(
        {
          ...basePayload,
          type,
          title: payload.title,
          data: payload.data,
          width: payload.width,
          height: payload.height,
          comp_cate: compCateForSave,
        },
        {},
        axiosExtra,
      )
    } else {
      const payload = buildDraftPayload(numericType)
      res = await api.home.saveTemp(
        {
          ...basePayload,
          title: payload.title,
          data: payload.data,
          width: payload.width,
          height: payload.height,
        },
        {},
        axiosExtra,
      )
    }

    clearLocalDraft()
    if (res?.stat != 0) {
      useNotification('保存成功', '刚刚的修改已经保存好了。', { type: 'success' })
    }
    const resolvedDesignId = String(res?.id ?? designId ?? '').trim()
    if (resolvedDesignId) {
      const next = {
        ...route.query,
        tempid: resolvedDesignId,
      } as Record<string, string | string[] | undefined>
      delete next.id
      router.replace({ path: route.path, query: next, replace: true })
    }
    controlStore.setLeftPanelMode('material')
  } catch (error: any) {
    if (isRequestCanceledError(error) || signal?.aborted) {
      throw error
    }
    const message = String(error?.message || '')
    const isNetworkError = message.includes('Network Error') || message.includes('ERR_CONNECTION_REFUSED')
    if (isNetworkError) {
      saveLocalDraft(buildDraftPayload(numericType))
    }

    useNotification(
      '保存失败',
      isNetworkError
        ? '当前网络连接异常，内容已自动保存到本地草稿，请稍后再试。'
        : '当前暂时无法保存，请稍后重试。',
      { type: 'error' },
    )
  }
}

async function stateChange(e: string | number | boolean) {
  const designId = String(route.query.tempid ?? route.query.id ?? '')
  if (!designId) return
  const { tempType: type } = route.query
  const { stat } = await api.home.saveTemp({ id: designId, type, state: e ? 1 : 0 })
  if (stat != 0) {
    useNotification('保存成功', '模板状态已经更新。')
  }
}

type TDownloadFormat = 'png' | 'jpg' | 'pdf'

/** 鍓嶇鎴栨湇鍔＄寰楀埌鐨?PNG Blob锛屾寜鎵€閫夋牸寮忚惤鐩?*/
async function persistExportBlob(sourcePng: Blob, fmt: TDownloadFormat, baseName: string): Promise<void> {
  if (fmt === 'png') {
    downloadBlob(sourcePng, `${baseName}.png`)
    return
  }
  if (fmt === 'jpg') {
    const jpg = await pngBlobToJpegBlob(sourcePng)
    downloadBlob(jpg, `${baseName}.jpg`)
    return
  }
  await savePngBlobAsPdf(sourcePng, baseName)
}

async function download(format: string = 'png') {
  if (state.loading === true) {
    const hasActiveTask = Boolean(activeDownloadXhr || activeDownloadSaveAbort || props.modelValue !== false)
    if (!hasActiveTask) {
      state.loading = false
    } else {
      useNotification('正在导出', '当前已有导出任务，请稍后重试。')
      return
    }
  }

  if (!userStore.online) {
    useNotification('请先登录', '下载作品需要先登录账号。', { type: 'warning' })
    return
  }

  try {
    const quotaRes: any = await api.account.consumeDownloadQuota()
    if (quotaRes && typeof quotaRes === 'object' && typeof quotaRes.code === 'number' && quotaRes.code !== 200) {
      useNotification('无法导出', String(quotaRes.msg || '今日下载次数已用完或权限不足'), { type: 'warning' })
      return
    }
    if (quotaRes && typeof quotaRes === 'object' && typeof quotaRes.used === 'number') {
      userStore.setDownloadsTodayUsed(quotaRes.used)
    }
  } catch {
    useNotification('无法导出', '无法校验下载额度，请检查网络后重试。', { type: 'error' })
    return
  }

  const myGen = ++exportGeneration
  state.loading = true
  emit('update:modelValue', true)
  emitDownloadChange({ downloadPercent: 1, downloadText: '正在准备导出，请稍候...', downloadImage: '' })

  const saveAbort = new AbortController()
  activeDownloadSaveAbort = saveAbort

  let downloadAnimation: ReturnType<typeof setInterval> | null = null
  const stopDownloadAnimation = () => {
    if (downloadAnimation != null) {
      clearInterval(downloadAnimation)
      downloadAnimation = null
    }
  }

  const currentRecord = pageStore.dCurrentPage
  const backEndCapture = checkDownloadPoster(dLayouts.value[currentRecord])
  const fmt: TDownloadFormat =
    format === 'jpg' || format === 'pdf' ? (format as TDownloadFormat) : 'png'
  const baseNameRaw = String(state.title || '未命名作品').trim() || '未命名作品'
  const baseName = baseNameRaw.replace(/[\\/:*?"<>|]/g, '_')

  try {
    if (!backEndCapture) {
      emitDownloadChange({ downloadPercent: 3, downloadText: '正在生成图片，请稍候...', downloadImage: '' })
      const posterPromise = canvasImage.value?.createPoster() as Promise<{ blob?: Blob } | undefined> | undefined
      const result = (await Promise.race([
        posterPromise ?? Promise.resolve({ blob: undefined }),
        new Promise<{ blob: undefined }>((resolve) => {
          setTimeout(() => resolve({ blob: undefined }), CLIENT_EXPORT_TIMEOUT_MS)
        }),
      ])) as { blob?: Blob } | undefined
      if (myGen !== exportGeneration || !props.modelValue) {
        emitDownloadChange({ downloadPercent: 0, downloadText: '', downloadMsg: '', downloadImage: '' })
        return
      }
      const blob = result?.blob
      if (!blob || blob.size < 32) {
        /** 妯℃澘甯稿惈澶栭摼涓诲浘锛宧tml2canvas 鏄撳洜璺ㄥ煙姹℃煋鐢诲竷瀵艰嚧 toBlob 澶辫触锛涙湁 tempid/id 涓旀埅鍥炬湇鍔″彲鐢ㄦ椂鏀硅蛋鏈嶅姟绔鍑?*/
        const canServerFallback =
          Boolean(_config.SCREEN_URL) && (Boolean(route.query.tempid) || Boolean(route.query.id))
        if (canServerFallback) {
          emitDownloadChange({
            downloadPercent: 6,
            downloadText: '前端导出未完成，正在切换为服务端生成...',
            downloadImage: '',
          })
          let savedId = ''
          try {
            savedId = (await save({ signal: saveAbort.signal })) || ''
          } catch (e: unknown) {
            if (isRequestCanceledError(e) || saveAbort.signal.aborted || !props.modelValue || myGen !== exportGeneration) {
              emitDownloadChange({ downloadPercent: 0, downloadText: '', downloadMsg: '', downloadImage: '' })
              return
            }
            useNotification(
              '导出失败',
              '服务端导出需要先保存到服务器，请确认本机 API(7001) 已启动且网络正常后再试。',
              { type: 'error' },
            )
            emitDownloadChange({ downloadPercent: 0, downloadText: '', downloadMsg: '', downloadImage: '' })
            return
          }
          if (!props.modelValue || saveAbort.signal.aborted || myGen !== exportGeneration) {
            emitDownloadChange({ downloadPercent: 0, downloadText: '', downloadMsg: '', downloadImage: '' })
            return
          }
          const id = String(route.query.id ?? savedId ?? '')
          const tempid = String(route.query.tempid ?? '')
          const previewUrl = `${api.home.download({
            id: id || undefined,
            tempid: tempid || undefined,
            width: dPage.value.width,
            height: dPage.value.height,
            index: pageStore.dCurrentPage,
          })}&r=${Math.random()}`
          emitDownloadChange({ downloadPercent: 10, downloadText: '正在服务端生成图片...', downloadImage: previewUrl })
          try {
            if (fmt === 'png') {
              await _dl.downloadImg(
                previewUrl,
                (progress: number, xhr: XMLHttpRequest) => {
                  if (progress === DOWNLOAD_XHR_READY) {
                    activeDownloadXhr = xhr
                    return
                  }
                  if (!props.modelValue || myGen !== exportGeneration) {
                    xhr.abort()
                    return
                  }
                  if (progress > 0) {
                    emitDownloadChange({
                      downloadPercent: Math.min(99, Math.max(8, Math.round(progress))),
                      downloadText: '服务端导出中...',
                      downloadImage: previewUrl,
                    })
                  }
                },
                `${baseName}.png`,
              )
            } else {
              const pngBlob = await fetchImageBlobFromUrl(previewUrl, (progress: number, xhr: XMLHttpRequest) => {
                if (progress === DOWNLOAD_XHR_READY) {
                  activeDownloadXhr = xhr
                  return
                }
                if (!props.modelValue || myGen !== exportGeneration) {
                  xhr.abort()
                  return
                }
                if (progress > 0) {
                  emitDownloadChange({
                    downloadPercent: Math.min(99, Math.max(8, Math.round(progress))),
                      downloadText: '服务端导出中...',
                    downloadImage: previewUrl,
                  })
                }
              })
              if (!pngBlob) throw new Error('DOWNLOAD_EMPTY')
              await persistExportBlob(pngBlob, fmt, baseName)
            }
            activeDownloadXhr = null
            emitDownloadChange({
              downloadPercent: 100,
              downloadText: '导出成功，文件已保存到本地。',
              downloadMsg: '',
              downloadImage: previewUrl,
            })
          } catch {
            activeDownloadXhr = null
            if (props.modelValue && myGen === exportGeneration) {
              useNotification(
                '导出失败',
                '服务端导出失败，请确认已运行 npm run serve:bg 或 serve，且 7001 截图服务可用后再试。',
                { type: 'error' },
              )
            }
            emitDownloadChange({ downloadPercent: 0, downloadText: '', downloadMsg: '', downloadImage: '' })
          }
          return
        }
        useNotification(
          '导出失败',
          !blob
            ? '生成图片超时或已取消，请稍后重试，或点击取消后重新导出。'
            : '未能生成图片，请确认画布内容已加载完整后重试。',
          { type: 'error' },
        )
        emitDownloadChange({ downloadPercent: 0, downloadText: '', downloadMsg: '', downloadImage: '' })
        return
      }
      const previewUrl = URL.createObjectURL(blob)
      try {
        await persistExportBlob(blob, fmt, baseName)
        emitDownloadChange({ downloadPercent: 100, downloadText: '导出成功，文件已保存到本地。', downloadImage: previewUrl })
        // 鎴愬姛鏃朵笉鑳界珛鍒?revoke锛歅rogressLoading 浠嶇敤 imageSrc 寮曠敤璇?blob锛屽惁鍒欐帶鍒跺彴 net::ERR_FILE_NOT_FOUND
      } catch {
        URL.revokeObjectURL(previewUrl)
        if (props.modelValue && myGen === exportGeneration) {
          useNotification('导出失败', '保存所选格式时出错，请重试。', { type: 'error' })
        }
        emitDownloadChange({ downloadPercent: 0, downloadText: '', downloadMsg: '', downloadImage: '' })
      }
      return
    }

    emitDownloadChange({ downloadPercent: 2, downloadText: '正在保存作品...', downloadImage: '' })
    let savedId = ''
    try {
      savedId = (await save({ signal: saveAbort.signal })) || ''
    } catch (e: unknown) {
      if (isRequestCanceledError(e) || saveAbort.signal.aborted || !props.modelValue || myGen !== exportGeneration) {
        emitDownloadChange({ downloadPercent: 0, downloadText: '', downloadMsg: '', downloadImage: '' })
        return
      }
      throw e
    }

    if (!props.modelValue || saveAbort.signal.aborted || myGen !== exportGeneration) {
      emitDownloadChange({ downloadPercent: 0, downloadText: '', downloadMsg: '', downloadImage: '' })
      return
    }

    const id = String(route.query.id ?? savedId ?? '')
    const tempid = String(route.query.tempid ?? '')
    if (!id && !tempid) {
      emitDownloadChange({ downloadPercent: 0, downloadText: '请稍候...', downloadImage: '' })
      useNotification('暂时无法导出', '请先打开一个作品或模板后再导出。', { type: 'error' })
      return
    }

    const { width, height } = dPage.value
    const previewUrl = `${api.home.download({ id, tempid, width, height, index: pageStore.dCurrentPage })}&r=${Math.random()}`
    emitDownloadChange({ downloadPercent: 4, downloadText: '正在处理图片...', downloadImage: previewUrl })

    let timerCount = 0
    let sawBytesProgress = false
    downloadAnimation = setInterval(() => {
      if (!props.modelValue || sawBytesProgress) {
        stopDownloadAnimation()
        return
      }
      if (timerCount < 75) {
        timerCount += randomNumber(1, 10)
        emitDownloadChange({ downloadPercent: 4 + timerCount, downloadText: '正在生成图片', downloadImage: previewUrl })
      } else {
        stopDownloadAnimation()
      }
    }, 800)

    try {
      if (fmt === 'png') {
        await _dl.downloadImg(
          previewUrl,
          (progress: number, xhr: XMLHttpRequest) => {
            if (progress === DOWNLOAD_XHR_READY) {
              activeDownloadXhr = xhr
              return
            }
            if (!props.modelValue || myGen !== exportGeneration) {
              xhr.abort()
              return
            }
            if (progress > 0) {
              sawBytesProgress = true
              stopDownloadAnimation()
              emitDownloadChange({
                downloadPercent: Math.min(99, Math.max(1, Math.round(progress))),
                downloadText: '图片生成中...',
                downloadImage: previewUrl,
              })
            }
          },
          `${baseName}.png`,
        )
      } else {
        const pngBlob = await fetchImageBlobFromUrl(previewUrl, (progress: number, xhr: XMLHttpRequest) => {
          if (progress === DOWNLOAD_XHR_READY) {
            activeDownloadXhr = xhr
            return
          }
          if (!props.modelValue || myGen !== exportGeneration) {
            xhr.abort()
            return
          }
          if (progress > 0) {
            sawBytesProgress = true
            stopDownloadAnimation()
            emitDownloadChange({
              downloadPercent: Math.min(99, Math.max(1, Math.round(progress))),
              downloadText: '图片生成中...',
              downloadImage: previewUrl,
            })
          }
        })
        if (!pngBlob) throw new Error('DOWNLOAD_EMPTY')
        await persistExportBlob(pngBlob, fmt, baseName)
      }
    } catch {
      if (props.modelValue && myGen === exportGeneration) {
        useNotification('导出失败', '图片暂时无法导出，请稍后重试。', { type: 'error' })
      }
      return
    }

    stopDownloadAnimation()
    activeDownloadXhr = null

    if (!props.modelValue || myGen !== exportGeneration) {
      emitDownloadChange({ downloadPercent: 0, downloadText: '', downloadMsg: '', downloadImage: '' })
      return
    }

    emitDownloadChange({
      downloadPercent: 100,
      downloadText: '导出成功，文件已保存到本地。',
      downloadMsg: '',
      downloadImage: previewUrl,
    })
  } catch {
    if (props.modelValue && myGen === exportGeneration) {
      useNotification('导出失败', '图片暂时无法导出，请稍后重试。', { type: 'error' })
    }
  } finally {
    activeDownloadSaveAbort = null
    stopDownloadAnimation()
    activeDownloadXhr = null
    if (myGen === exportGeneration) {
      state.loading = false
      emit('update:modelValue', false)
    }
  }
}

function randomNumber(min: number, max: number) {
  return Math.ceil(Math.random() * (max - min)) + min
}

async function load(cb: () => void) {
  const { id, tempid: tempId, tempType: type, w_h } = route.query
  if (!canEditTemplate.value && tempEditing.value) {
    userStore.managerEdit(false)
  }
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
    const detail = (await api.home[apiName]({ id: id || tempId, type })) as Record<string, unknown>
    const { data: content, title, state: templateState, width, height } = detail
    if (!content) {
      initBoard()
      cb()
      return
    }
    state.stateBollean = !!templateState
    state.title = String(title ?? '')
    applyLoadedData(content, type, width, height)
    const resolvedCate = detail.cate ?? detail.category
    const rawCate = route.query.cate
    const cateFromQuery =
      rawCate === undefined || rawCate === null
        ? ''
        : String(Array.isArray(rawCate) ? rawCate[0] ?? '' : rawCate)
    /** URL 宸插甫鍒嗙被锛堝惈銆屽叏閮ㄣ€峜ate=0锛夋椂锛屽皧閲嶇敤鎴峰綋鍓嶅垪琛紝涓嶈鐢ㄨ鎯呴噷鐨勫垎绫昏鐩?*/
    const userChoseCategory = cateFromQuery !== ''
    if (tempId && !id && resolvedCate != null && resolvedCate !== '' && !userChoseCategory) {
      const next = String(resolvedCate)
      if (String(route.query.cate ?? '') !== next) {
        await router.replace({ path: route.path, query: { ...route.query, cate: next } })
      }
    }
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
    useNotification('加载失败', '当前暂时无法加载内容，请稍后重试。', { type: 'error' })
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
  if (!canEditTemplate.value) return
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
    // Only fall back to backend capture for effects that html2canvas cannot reproduce reliably.
    if ((type === 'w-image' && mask) || (textEffects && textEffects.length > 0)) {
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
  abortActiveDownload,
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

  :deep(.save-work-btn.el-button),
  :deep(.save-work-btn.el-button:hover),
  :deep(.save-work-btn.el-button:focus) {
    min-width: 72px;
    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
    border-color: transparent;
    color: #fff;
    font-weight: 700;
    text-shadow: none;
  }

  :deep(.save-work-btn.el-button span) {
    color: #fff;
  }

  /* 涓庡彸渚с€岀櫥褰曘€嶈兌鍥婃寜閽悓閲忕骇锛氶珮搴︿笌瀛楀彿瀵归綈 */
  :deep(.header-download-btn.el-button) {
    min-height: 34px;
    height: 34px;
    padding: 0 14px;
    font-size: 13px;
    font-weight: 600;
    line-height: 1;
    border-radius: 999px;
  }

  :deep(.header-download-btn.el-button--primary) {
    box-shadow: 0 6px 14px rgba(37, 99, 235, 0.2);
  }

  :deep(.header-download-btn.el-button--primary:hover) {
    box-shadow: 0 8px 18px rgba(37, 99, 235, 0.24);
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
  margin-left: auto;
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

.account-entry--guest {
  width: auto;
  min-width: 58px;
  padding: 0 14px;
  font-size: 13px;
  font-weight: 600;
}

.account-entry__login-text {
  letter-spacing: 0.02em;
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

