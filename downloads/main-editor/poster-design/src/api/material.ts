/*
 * @Author: ShawnPhang <https://m.palxp.cn>
 * @Date: 2021-08-27 14:42:15
 * @Description: 媒体相关接口
 * @LastEditors: Jeremy Yu <https://github.com/JeremyYu-cn>
 * @LastEditTime: 2024-09-25 00:39:00
 */
import fetch from '@/utils/axios'
import _config from '@/config'
import { IGetTempListData } from './home'

// 获取素材分类：
export const getKinds = (params: Type.Object = {}) => fetch('design/cate', params)

type TGetListParam = {
  first_id?: number
  second_id?: string
  cate?: string | number
  pageSize?: number
}

export type TGetListData = {
  category: number
  created_time: string
  height: number
  id: number
  model: string
  original: string
  state: number
  thumb: string
  title: string
  type: string
  updated_time: string
  url: string
  width: number
  thumbUrl: string
  imgUrl: string
}

export type TGetListResult = TPageRequestResult<TGetListData[]>

// 获取素材列表：
export const getList = (params: TGetListParam) => fetch<TGetListResult>('design/material', params)

export type TGetFontParam = {
  pageSize?: number
}

/** 字体item数据 */
export type TGetFontItemData = {
  id: number
  alias: string
  oid: string
  value: string
  preview: string
  woff: string
  lang: string
}

// 获取字体
export const getFonts = (params: TGetFontParam = {}) => fetch<TPageRequestResult<TGetFontItemData[]>>('design/fonts', params)

type TGetFontSubParam = {
  font_id: string | number
  id: string | number
  content: string
}

type TGetFontSubExtra = {
  responseType?: string
}

export const getFontSub = (params: TGetFontSubParam, extra: TGetFontSubExtra = {}) => fetch<Blob | string>('design/font_sub', params, 'get', {}, extra)

type TGetImageListParams = {
  page?: number
  pageSize?: number
  cate?: number
}

export type TGetImageListResult = {
  created_time: string
  height: number
  width: number
  url: string
  user_id: number
  id: string
  thumb?: string
} & Partial<IGetTempListData>

// 图库列表
export const getImagesList = (params: TGetImageListParams) => fetch<TPageRequestResult<TGetImageListResult[]>>('design/imgs', params, 'get')

type TMyPhotoParams = {
  
  page: number
  pageSize?: number
}

/** 获取我的资源管理返回 */
export type TMyPhotoResult = {
  created_time: string
  height: number
  id: number
  url: string
  user_id: number
  width: number
} & IGetTempListData

// 我的上传列表
export const getMyPhoto = (params: TMyPhotoParams) => fetch<TPageRequestResult<TMyPhotoResult[]>>('design/user/image', params)

type TDeleteMyPhotoParams = {
  id: string | number
  key: string
}

export const deleteMyPhoto = (params: TDeleteMyPhotoParams) => fetch<void>('design/user/image/del', params, 'post')

type TDeleteMyWorksParams = {
  id: string | number
}

export const deleteMyWorks = (params: TDeleteMyWorksParams) => fetch<void>('design/poster/del', params, 'post')

type TAddMyPhotoParam = {
  width: number
  height: number
  url: string
}

// 添加图片
export const addMyPhoto = (params: TAddMyPhotoParam) => fetch<void>('design/user/add_image', params)

// 上传接口
export const upload = ({ file, folder = 'user' }: any, cb: Function) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('folder', folder)
  const extra = {
    responseType: 'json',
    onUploadProgress: (progress: any) => {
      cb(Math.floor((progress.loaded / progress.total) * 100), 0)
    },
    onDownloadProgress: (progress: any) => {
      cb(100, Math.floor((progress.loaded / progress.total) * 100))
    },
  }
  return fetch(`${_config.SCREEN_URL}/api/file/upload`, formData, 'post', {}, extra)
}

type TUploadBase64Params = {
  file: string
  folder?: string
  name?: string
}

type TUploadBase64Result = {
  key: string
  url: string
  preview_url: string
}

function dataUrlToFile(dataUrl: string, fileName: string) {
  const [header = '', content = ''] = String(dataUrl || '').split(',')
  if (!header || !content) {
    throw new Error('invalid data url')
  }
  const mimeMatch = header.match(/data:(.*?);base64/)
  const mime = mimeMatch?.[1] || 'image/png'
  const binary = atob(content)
  const length = binary.length
  const bytes = new Uint8Array(length)
  for (let index = 0; index < length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return new File([bytes], fileName, { type: mime })
}

export const uploadBase64 = async ({ file, folder = 'user', name }: TUploadBase64Params): Promise<TUploadBase64Result> => {
  const fileName = name || `crop_${Date.now()}.png`
  const uploadFile = dataUrlToFile(file, fileName)
  const result = await upload({ file: uploadFile, folder, name: fileName }, () => {})
  return {
    ...(result as { key: string; url: string }),
    preview_url: (result as { url: string }).url,
  }
}
