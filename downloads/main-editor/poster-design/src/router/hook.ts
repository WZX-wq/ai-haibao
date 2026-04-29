import { nextTick } from 'vue'
import { NavigationGuardNext, RouteLocationNormalized, Router } from 'vue-router'
import config from '@/config'

const routeTitles: Record<string, string> = {
  Welcome: '首页',
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
      return
    }

    if (to.name === 'Home') {
      const query = { ...to.query } as Record<string, any>
      const section = String(query.section || 'welcome')
      const hasPosterParams = Boolean(query.id || query.tempid || query.tempType)

      if (section === 'welcome' && hasPosterParams) {
        next({
          path: '/home',
          query: {
            section: 'welcome',
          },
          replace: true,
        })
        return
      }

      if (query.tempid && !query.id && section !== 'template') {
        next({
          path: '/home',
          query: {
            ...query,
            section: 'template',
          },
          replace: true,
        })
        return
      }

      if (query.id && section === 'template') {
        next({
          path: '/home',
          query: {
            ...query,
            section: 'mine',
          },
          replace: true,
        })
        return
      }
    }

    next()
  })

  router.afterEach((to) => {
    document.title = resolveTitle(to)
    window.scrollTo(0, 0)

    nextTick(() => {
      const isEditor = to.name === 'Home'
      document.documentElement.classList.toggle('is-editor-route', isEditor)
      document.body.classList.toggle('is-editor-route', isEditor)
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
