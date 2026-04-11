import { RouteRecordRaw } from 'vue-router'

export default [
  {
    path: '/',
    name: 'main',
    redirect: 'welcome',
  },
  {
    path: '/welcome',
    name: 'Welcome',
    component: () => import(/* webpackChunkName: 'welcome' */ '@/views/Welcome.vue'),
  },
  {
    path: '/home',
    name: 'Home',
    component: () => import(/* webpackChunkName: 'base' */ '@/views/Index.vue'),
  },
  {
    path: '/create',
    redirect: { name: 'AiPoster' },
  },
  {
    path: '/ai-poster',
    name: 'AiPoster',
    component: () => import(/* webpackChunkName: 'ai-poster' */ '@/views/AiPoster.vue'),
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import(/* webpackChunkName: 'auth' */ '@/views/Login.vue'),
  },
  {
    path: '/oauth/callback',
    name: 'OAuthCallback',
    component: () => import(/* webpackChunkName: 'auth' */ '@/views/OAuthCallback.vue'),
  },
  {
    path: '/account',
    name: 'AccountCenter',
    component: () => import(/* webpackChunkName: 'auth' */ '@/views/AccountCenter.vue'),
  },
  {
    path: '/draw',
    name: 'Draw',
    component: () => import(/* webpackChunkName: 'draw' */ '@/views/Draw.vue'),
  },
  {
    path: '/html',
    name: 'Html',
    component: () => import(/* webpackChunkName: 'html' */ '@/views/Html.vue'),
  },
  {
    path: '/psd',
    name: 'Psd',
    component: () => import(/* webpackChunkName: 'psd' */ '@/views/Psd.vue'),
  },
] as RouteRecordRaw[]
