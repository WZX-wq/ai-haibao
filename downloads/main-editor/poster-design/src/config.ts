import { version } from '../package.json'
import { sanitizeLoopbackApiBase } from '@/utils/publicMediaUrl'

const host = typeof window !== 'undefined' ? window.location.hostname : ''
const viteDev = typeof import.meta !== 'undefined' && Boolean((import.meta as any).env?.DEV)
const nonLoopbackDevHost = viteDev && !!host && host !== '127.0.0.1' && host !== 'localhost' && host !== '0.0.0.0'
/**
 * 用于 UI 行为（如是否监听 beforeunload），与「是否直连本机 7001 接口」分离。
 * 生产包用 127.0.0.1:8080 访问 Docker 时若把 API 指到 127.0.0.1:7001，而宿主机未映射 7001，侧栏素材/文字/图库接口会全部失败。
 */
const isDev = viteDev || host === '127.0.0.1' || host === 'localhost' || host === '0.0.0.0'
const devDefaultApi = 'http://127.0.0.1:7001'
const rawEnvApiUrl = typeof import.meta !== 'undefined' ? ((import.meta as any).env?.VITE_API_URL as string | undefined) : undefined
const rawEnvScreenUrl = typeof import.meta !== 'undefined' ? ((import.meta as any).env?.VITE_SCREEN_URL as string | undefined) : undefined
const rawEnvImgUrl = typeof import.meta !== 'undefined' ? ((import.meta as any).env?.VITE_IMG_URL as string | undefined) : undefined
/** 部署到公网后仍带 127.0.0.1 的构建变量会导致浏览器私网访问拦截，运行期丢弃 */
const envApiUrl = sanitizeLoopbackApiBase(rawEnvApiUrl)
const envScreenUrl = sanitizeLoopbackApiBase(rawEnvScreenUrl)
const envImgUrl = sanitizeLoopbackApiBase(rawEnvImgUrl)
/** 仅 Vite 开发态走本机 7001；生产构建一律同源（空字符串 + 相对路径），避免 Docker 仅暴露 8080 时误连 7001 */
const screenBaseUrl = envScreenUrl || (viteDev ? devDefaultApi : '')

/** 与 Vite `base`（import.meta.env.BASE_URL）一致。生产勿用 `./`，否则从 /oauth/callback 等直达页进入时 history 基路径错误，路由无法匹配。 */
const routerBase =
  typeof import.meta !== 'undefined'
    ? String((import.meta as any).env?.BASE_URL ?? '/')
    : '/'
const BASE_URL = routerBase === './' ? '/' : routerBase

export default {
  isDev,
  BASE_URL,
  VERSION: version,
  APP_NAME: '鲲穹海报',
  /** 画布默认水印文案（与品牌名分离） */
  WATERMARK_DEFAULT_TEXT: '鲲穹海报',
  COPYRIGHT: 'ShawnPhang - Design.palxp.cn',
  API_URL: envApiUrl !== undefined ? envApiUrl : nonLoopbackDevHost ? '' : viteDev ? devDefaultApi : '',
  SCREEN_URL: envScreenUrl !== undefined ? envScreenUrl : nonLoopbackDevHost ? '' : screenBaseUrl,
  IMG_URL:
    envImgUrl !== undefined
      ? envImgUrl
      : nonLoopbackDevHost
        ? '/static/'
        : screenBaseUrl
          ? `${screenBaseUrl.replace(/\/$/, '')}/static/`
          : '/static/',
  ICONFONT_URL: 'https://at.alicdn.com/t/font_2717063_ypy8vprc3b.css?display=swap',
  ICONFONT_EXTRA: 'https://at.alicdn.com/t/c/font_3228074_xojoer6zhp.css',
  QINIUYUN_PLUGIN: 'https://lf26-cdn-tos.bytecdntp.com/cdn/expire-1-M/qiniu-js/2.5.5/qiniu.min.js',
  supportSubFont: false,
}

export const LocalStorageKey = {
  tokenKey: 'xp_token',
  authStateKey: 'xp_oauth_state',
  authUserKey: 'xp_auth_user',
  authPermissionsKey: 'xp_auth_permissions',
}
