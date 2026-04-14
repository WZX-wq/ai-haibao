/*
 * @Author: ShawnPhang
 * @Date: 2022-02-01 13:41:59
 * @Description: 配置文件
 * @LastEditors: ShawnPhang <https://m.palxp.cn>
 * @LastEditTime: 2024-08-12 05:13:19
 */
const isDev = process.env.NODE_ENV === 'development'

// 服务器常用修改项
const serviceComfig = {
    port: 7001, // 端口号
    website: 'http://127.0.0.1:5173/', // 编辑器项目的地址
    filePath: '/cache/' // 生成图片保存的目录
}

/** 截图用绘制页基址：Docker 内可用 http://web，公网用 https://你的域名 */
function editorDrawBaseUrl() {
  const fromEnv =
    process.env.PUPPETEER_PAGE_BASE_URL ||
    process.env.FRONTEND_PUBLIC_BASE_URL ||
    process.env.APP_BASE_URL ||
    ''
  if (fromEnv) {
    return String(fromEnv).replace(/\/$/, '')
  }
  return String(serviceComfig.website || '').replace(/\/$/, '')
}

/**
 * 端口号
 */
export const servicePort = serviceComfig.port

/**
 * 前端绘制页地址
 */
export const drawLink = isDev ? 'http://127.0.0.1:5173/draw' : `${editorDrawBaseUrl()}/draw`

/**
 * 图片缓存目录位置，根据实际情况调整
 */
export const filePath = isDev
  ? process.cwd() + `/static/`
  : String(process.env.FILE_STORAGE_PATH || serviceComfig.filePath).replace(/\/?$/, '/') 

/**
 * 配置服务器端的 Chrome/Chromium；Docker 内通常设 PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
 */
export const executablePath = isDev
  ? null
  : process.env.PUPPETEER_EXECUTABLE_PATH || '/opt/google/chrome-unstable/chrome'

/**
 * 截图并发数上限
 */
export const maxNum = 2

/**
 * 截图队列的阈值，超出时请求将会被熔断
 */
export const upperLimit = 20

/**
 * 多久释放浏览器驻留内存，单位：秒（多标签页版生效）
 */
export const releaseTime = 300
