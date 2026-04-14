import { nextTick } from 'vue'
import { NavigationGuardNext, RouteLocationNormalized, Router } from 'vue-router'
import config from '@/config'

const routeTitles: Record<string, string> = {
  Welcome: '欢迎页',
  Home: '编辑器',
  AccountCenter: '个人中心',
  Login: '登录',
  OAuthCallback: '登录回调',
  Draw: '画板预览',
  Html: '导出预览',
  Psd: 'PSD 导入',
}

function resolveTitle(route: RouteLocationNormalized) {
  const routeName = route.name ? String(route.name) : ''
  const pageTitle = routeTitles[routeName]
  return pageTitle ? `${pageTitle} - ${config.APP_NAME}` : config.APP_NAME
}

export default (router: Router) => {
  router.beforeEach((to: RouteLocationNormalized, _from: RouteLocationNormalized, next: NavigationGuardNext) => {
    if (/\/http/.test(to.path) || /\/https/.test(to.path)) {
      const url = to.path.split('http')[1]
      window.location.href = `http${url}`
    } else {
      next()
    }
  })

  router.afterEach((to) => {
    document.title = resolveTitle(to)
    window.scrollTo(0, 0)

    nextTick(() => {
      const isEditor = to.name === 'Home'
      if (isEditor) {
        document.body.style.overflow = 'hidden'
        document.documentElement.style.overflow = ''
      } else {
        document.body.style.overflow = 'auto'
        document.documentElement.style.overflowY = 'auto'
      }
    })
  })
}
