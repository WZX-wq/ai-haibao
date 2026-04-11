import { createApp } from 'vue'
import App from './App.vue'
import router from './router/index.ts'
import utils from './utils'
import 'normalize.css/normalize.css'
import '@/assets/styles/index.less'
import elementConfig from './utils/widgets/elementConfig'
import { createPinia } from 'pinia'
import I18n from '@/languages/index'

const rawGetContext = HTMLCanvasElement.prototype.getContext
HTMLCanvasElement.prototype.getContext = function (
  contextId: '2d' | 'bitmaprenderer' | 'webgl' | 'webgl2' | 'webgpu',
  options?: any,
) : any {
  if (contextId === '2d') {
    const nextOptions = typeof options === 'object' && options !== null
      ? { ...options, willReadFrequently: true }
      : { willReadFrequently: true }
    return rawGetContext.call(this, contextId, nextOptions)
  }
  return rawGetContext.call(this, contextId, options)
}

const pinia = createPinia()
const app = createApp(App)

elementConfig.components.forEach((component) => {
  if (component?.name) {
    app.component(component.name, component)
  }
})

elementConfig.plugins.forEach((plugin) => {
  app.use(plugin)
})

app
  // .use(store)
  .use(pinia)
  .use(router)
  .use(utils)
  .use(I18n)
  .mount('#app')
