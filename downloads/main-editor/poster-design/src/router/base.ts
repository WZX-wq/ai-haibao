import { RouteRecordRaw } from 'vue-router'

export default [
  {
    path: '/',
    name: 'main',
    redirect: { path: '/home', query: { section: 'welcome' } },
  },
  {
    path: '/welcome',
    name: 'Welcome',
    redirect: { path: '/home', query: { section: 'welcome' } },
  },
  {
    path: '/home',
    name: 'Home',
    component: () => import(/* webpackChunkName: 'base' */ '@/views/Index.vue'),
  },
  {
    path: '/create',
    redirect: { name: 'Home' },
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
