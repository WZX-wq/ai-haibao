import type { Ref } from 'vue'
import api from '@/api'
import { getImage } from '@/common/methods/getImgDetail'
import type { TCommonUploadCb, AiProviderMeta, CutoutProviderMode } from '@/api/ai'
import type { TImageCutoutState } from './types'

type CutoutBusinessError = {
  code?: number
  msg?: string
  message?: string
}

function formatProviderTip(mode: CutoutProviderMode, meta?: AiProviderMeta) {
  if (!meta) return ''
  const prefix = '本地模型'
  return `${prefix} / ${meta.provider} / ${meta.model}${meta.message ? `: ${meta.message}` : ''}`
}

function getCutoutErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== 'object') return ''
  const candidate = payload as CutoutBusinessError
  if (candidate.code && candidate.code !== 200) {
    return String(candidate.msg || candidate.message || '抠图失败').trim()
  }
  return ''
}

function getSafeResultUrl(payload: unknown) {
  if (!payload || typeof payload !== 'object') return ''
  return String((payload as { resultUrl?: string }).resultUrl || '').trim()
}

export const selectImageFile = async (
  state: TImageCutoutState,
  raw: Ref<HTMLElement | null>,
  file: File,
  successCb?: (resultUrl: string, fileName: string, providerTip: string) => void,
  uploadCb?: TCommonUploadCb,
) => {
  if (!raw.value) return

  const objectUrl = URL.createObjectURL(file)
  state.rawImage = objectUrl
  raw.value.addEventListener(
    'load',
    () => {
      state.offsetWidth = raw.value ? raw.value.offsetWidth : 0
    },
    { once: true },
  )

  state.providerTip = ''
  state.progressText = '\u4e0a\u4f20\u4e2d'
  state.progress = 0

  const mode = state.providerMode || 'local'
  const result = await api.ai.cutoutImage(file, mode, (up: number, dp: number) => {
    uploadCb?.(up, dp)

    if (dp) {
      state.progressText = dp === 100 ? '' : '\u6b63\u5728\u5bfc\u5165\u7ed3\u679c'
      state.progress = dp
      return
    }

    if (up < 100) {
      state.progressText = '\u4e0a\u4f20\u4e2d'
      state.progress = up
      return
    }

    state.progressText = '本地模型正在识别主体并抠图'
    state.progress = 0
  })

  const businessError = getCutoutErrorMessage(result)
  if (businessError) {
    throw new Error(businessError)
  }

  const resultUrl = getSafeResultUrl(result)
  if (!resultUrl) {
    throw new Error('抠图结果未返回图片，请重试')
  }

  state.progressText = ''
  state.progress = 0
  state.providerTip = formatProviderTip(mode, (result as { providerMeta?: AiProviderMeta }).providerMeta)
  successCb?.(resultUrl, file.name, state.providerTip)
}

export async function uploadCutPhotoToCloud(cutImage: string) {
  try {
    const response = await fetch(cutImage)
    const buffer = await response.arrayBuffer()
    const file = new File([buffer], `cut_image_${Date.now()}.png`, { type: 'image/png' })
    const uploadRes = await api.ai.upload(file, undefined, 'user')
    const { width, height } = await getImage(file)
    await api.material.addMyPhoto({ width, height, url: uploadRes.url })
    return uploadRes.url
  } catch (error) {
    console.error(`upload cut file error: ${error}`)
    return ''
  }
}


