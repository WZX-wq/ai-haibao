/*
 * @Author: ShawnPhang
 * @Date: 2021-09-30 15:52:59
 * @Description: 下载远程图片
 * @LastEditors: ShawnPhang <https://m.palxp.cn>
 * @LastEditTime: 2024-08-12 17:01:59
 */

export type TDownloadProgressCb = (progress: number, xhr: XMLHttpRequest) => void

/** 与 HeaderOptions 中一致：progress=-1 时 xhr 已创建，供取消时 abort */
export const DOWNLOAD_XHR_READY = -1

export default (src: string, cb: TDownloadProgressCb, fileName?: string) => {
  return new Promise<void>((resolve, reject) => {
    fetchImageDataFromUrl(src, (progress: number, xhr: XMLHttpRequest) => {
      cb(progress, xhr)
    }).then((res: Blob | null) => {
      if (!res) {
        reject(new Error('DOWNLOAD_EMPTY'))
        return
      }
      const suffix = res.type ? res.type.split('/')[1] : 'png'
      const fallbackName = `${new Date().getTime()}.${suffix || 'png'}`
      const objectUrl = URL.createObjectURL(res)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = fileName || fallbackName
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(objectUrl), 4000)
      resolve()
    })
  })
}

function fetchImageDataFromUrl(url: string, cb: TDownloadProgressCb) {
  return new Promise<Blob | null>((resolve) => {
    const xhr = new XMLHttpRequest()
    xhr.open('GET', url)
    xhr.responseType = 'blob'

    const finish = (blob: Blob | null) => {
      resolve(blob)
    }

    xhr.onprogress = function (event: ProgressEvent) {
      let pct = 0
      if (event.lengthComputable && event.total > 0) {
        pct = (event.loaded / event.total) * 100
      } else if (event.loaded > 0) {
        pct = Math.min(95, Math.log10(event.loaded + 10) * 25)
      }
      if (!Number.isFinite(pct)) pct = 0
      cb(Math.min(99, Math.max(0, pct)), xhr)
    }

    xhr.onload = function () {
      if (xhr.status === 0) {
        finish(null)
        return
      }
      if (xhr.status < 400 && xhr.response) {
        finish(xhr.response as Blob)
      } else {
        finish(null)
      }
    }
    xhr.onerror = function () {
      finish(null)
    }
    xhr.onabort = function () {
      finish(null)
    }

    xhr.send()
    // 让调用方立刻拿到 xhr，便于取消时 abort（不必等第一次 onprogress）
    cb(DOWNLOAD_XHR_READY, xhr)
  })
}

/** 仅拉取远程图片 Blob，不触发浏览器下载（用于 PNG→JPG/PDF 再保存） */
export function fetchImageBlobFromUrl(src: string, cb: TDownloadProgressCb): Promise<Blob | null> {
  return fetchImageDataFromUrl(src, cb)
}
