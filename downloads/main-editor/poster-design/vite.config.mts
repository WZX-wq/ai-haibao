/*
 * @Author: ShawnPhang
 * @Date: 2021-08-19 18:30:38
 * @Description: Vite闁板秶鐤嗛弬鍥︽
 * @LastEditors: ShawnPhang <site: book.palxp.com>
 * @LastEditTime: 2023-08-01 10:46:59
 */
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import viteCompression from 'vite-plugin-compression'
import ElementPlus from 'unplugin-element-plus/vite'

const resolve = (...data: string[]) => path.resolve(__dirname, ...data)

function manualChunks(id: string) {
  if (!id.includes('node_modules')) {
    return
  }
  if (id.includes('vue') || id.includes('pinia') || id.includes('vue-router') || id.includes('vue-i18n')) {
    return 'framework'
  }
  if (id.includes('element-plus') || id.includes('@element-plus')) {
    return 'element-plus'
  }
  if (
    id.includes('moveable') ||
    id.includes('selecto') ||
    id.includes('@scena') ||
    id.includes('@daybrush') ||
    id.includes('cropperjs') ||
    id.includes('psd.js')
  ) {
    return 'editor-core'
  }
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
export default defineConfig({
  plugins: [
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
      // Keep the more specific workspace subpath alias first so Vite
      // doesn't rewrite `@palxp/color-picker/comps/*` through index.ts.
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
    hmr: { overlay: false },
    host: '127.0.0.1',
  },
})

