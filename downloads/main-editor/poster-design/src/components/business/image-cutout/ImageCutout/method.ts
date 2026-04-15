import type { Ref } from 'vue'
import api from '@/api'
import { getImage } from '@/common/methods/getImgDetail'
import type { TCommonUploadCb, AiProviderMeta } from '@/api/ai'
import type { TImageCutoutState } from './types'

function formatProviderTip(meta?: AiProviderMeta) {
  if (!meta) return ''
  const mode = meta.isMockFallback ? '\u6f14\u793a\u6a21\u5f0f' : '\u771f\u5b9e AI \u62a0\u56fe'
  return `${mode} / ${meta.provider} / ${meta.model}${meta.message ? `: ${meta.message}` : ''}`
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

  const result = await api.ai.cutoutImage(file, (up: number, dp: number) => {
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

    state.progressText = 'AI \u6b63\u5728\u8bc6\u522b\u4e3b\u4f53\u5e76\u62a0\u56fe'
    state.progress = 0
  })

  state.progressText = ''
  state.progress = 0
  state.providerTip = formatProviderTip(result.providerMeta)
  successCb?.(result.resultUrl, file.name, state.providerTip)
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


