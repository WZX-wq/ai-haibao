/*
 * @Author: ShawnPhang
 * @Date: 2021-08-19 18:30:38
 * @Description: Vite闁板秶鐤嗛弬鍥︽
 * @LastEditors: ShawnPhang <site: book.palxp.com>
 * @LastEditTime: 2023-08-01 10:46:59
 */
import fs from 'fs'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import viteCompression from 'vite-plugin-compression'
import ElementPlus from 'unplugin-element-plus/vite'

const resolve = (...data: string[]) => path.resolve(__dirname, ...data)

/**
 * Chrome 在开发态对 304 + 磁盘缓存偶发 net::ERR_CACHE_READ_FAILURE，
 * 导致动态 import('.vue') 失败。去掉条件请求头，让 Vite 始终返回 200 完整模块。
 */
function devDisableConditionalRequests(): Plugin {
  return {
    name: 'dev-disable-conditional-requests',
    apply: 'serve',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        delete req.headers['if-none-match']
        delete req.headers['if-modified-since']
        next()
      })
    },
  }
}

function manualChunks(id: string) {
  if (!id.includes('node_modules')) {
    return
  }
  // Vue 与 Element Plus 同进 framework，避免单独 element-plus chunk 与 Vue 之间循环依赖导致
  // 「Cannot access 'x' before initialization」（TDZ）。
  if (
    id.includes('vue') ||
    id.includes('pinia') ||
    id.includes('vue-router') ||
    id.includes('vue-i18n') ||
    id.includes('element-plus') ||
    id.includes('@element-plus')
  ) {
    return 'framework'
  }
  // 勿将 moveable/selecto/@scena 等单独打成 editor-core：生产环境易出现 chunk 顺序/循环依赖，
  // 运行时表现为 Object.setPrototypeOf(..., undefined)。
  if (
    id.includes('html2canvas') ||
    id.includes('jspdf') ||
    id.includes('fontfaceobserver') ||
    id.includes('qr-code-styling') ||
    id.includes('images')
  ) {
    return 'export-tools'
  }
  return 'vendor'
}

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const devHostname = String(env.VITE_DEV_HOSTNAME || '').trim()
  const localDomainMode = command === 'serve' && !!devHostname
  const devPort = Number(env.VITE_DEV_PORT || (localDomainMode ? 443 : 5173))
  const backendTarget = String(env.VITE_DEV_BACKEND_TARGET || 'http://127.0.0.1:7001').trim()
  const pfxPath = String(env.VITE_DEV_HTTPS_PFX_PATH || '').trim()
  const pfxPassphrase = String(env.VITE_DEV_HTTPS_PFX_PASSPHRASE || '').trim()
  const resolvedPfxPath = pfxPath ? resolve(pfxPath) : ''
  const httpsOptions =
    localDomainMode && resolvedPfxPath && fs.existsSync(resolvedPfxPath)
      ? {
          pfx: fs.readFileSync(resolvedPfxPath),
          passphrase: pfxPassphrase || undefined,
        }
      : undefined

  const proxy = localDomainMode
    ? {
        '/auth': { target: backendTarget, changeOrigin: true, secure: false },
        '/kunbi': { target: backendTarget, changeOrigin: true, secure: false },
        '/design': { target: backendTarget, changeOrigin: true, secure: false },
        '/usage': { target: backendTarget, changeOrigin: true, secure: false },
        '/admin': { target: backendTarget, changeOrigin: true, secure: false },
        '/ai': { target: backendTarget, changeOrigin: true, secure: false },
        '/api': { target: backendTarget, changeOrigin: true, secure: false },
        '/static': { target: backendTarget, changeOrigin: true, secure: false },
        '/store': { target: backendTarget, changeOrigin: true, secure: false },
      }
    : undefined

  return {
    plugins: [
      devDisableConditionalRequests(),
      vue(),
      viteCompression({
        verbose: true,
        disable: false,
        threshold: 10240,
        algorithm: 'gzip',
        ext: '.gz',
      }),
      ElementPlus({}),
    ],
    build: {
      minify: 'terser',
      chunkSizeWarningLimit: 900,
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
      },
      rollupOptions: {
        output: {
          manualChunks,
        },
        onwarn(warning, warn) {
          if (warning.code === 'INVALID_ANNOTATION') {
            return
          }
          warn(warning)
        },
      },
    },
    resolve: {
      alias: [
        { find: '@', replacement: resolve('src') },
        { find: '~data', replacement: resolve('src/assets/data') },
        { find: /^@palxp\/color-picker\/comps/, replacement: resolve('packages/color-picker/comps') },
        { find: /^@palxp\/color-picker$/, replacement: resolve('packages/color-picker/index.ts') },
        { find: /^@palxp\/image-extraction$/, replacement: resolve('packages/image-extraction/index.ts') },
      ],
    },
    css: {
      preprocessorOptions: {
        less: {
          modifyVars: {
            color: `true; @import "./src/assets/styles/color.less";`,
          },
        },
      },
    },
    define: {
      'process.env': process.env,
    },
    server: {
      host: '0.0.0.0',
      port: Number.isFinite(devPort) && devPort > 0 ? devPort : 5173,
      https: httpsOptions,
      hmr: localDomainMode
        ? {
            overlay: false,
            host: devHostname,
            protocol: 'wss',
            clientPort: Number.isFinite(devPort) && devPort > 0 ? devPort : 443,
          }
        : { overlay: false },
      proxy,
      allowedHosts: localDomainMode ? [devHostname] : undefined,
      ...(command === 'serve'
        ? { headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } }
        : {}),
    },
  }
})
