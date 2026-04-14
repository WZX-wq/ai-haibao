<template>
  <div class="callback-page">
    <div class="callback-card">
      <div class="callback-spinner" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <h1>{{ titleText }}</h1>
      <p>{{ statusText }}</p>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as accountApi from '@/api/account'
import { LocalStorageKey } from '@/config'
import useUserStore from '@/store/base/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const errorMessage = ref('')

const titleText = computed(() => (errorMessage.value ? '登录失败' : '正在完成登录'))
const statusText = computed(() => errorMessage.value || '正在与服务器交换令牌并创建会话，请稍候。')

function queryString(v: unknown): string {
  if (v === undefined || v === null) return ''
  if (Array.isArray(v)) return String(v[0] ?? '')
  return String(v)
}

async function finishLogin() {
  const oauthErr = queryString(route.query.error).trim()
  if (oauthErr) {
    const desc = queryString(route.query.error_description || route.query.error_message).trim()
    let text = desc ? desc.replace(/\+/g, ' ') : oauthErr
    if (desc) {
      try {
        text = decodeURIComponent(text)
      } catch {
        /* 非标准编码时保留原文 */
      }
    }
    throw new Error(text || '授权未完成或被取消')
  }

  const code = queryString(route.query.code).trim()
  const state = queryString(route.query.state).trim()
  const storedState = localStorage.getItem(LocalStorageKey.authStateKey) || sessionStorage.getItem(LocalStorageKey.authStateKey) || ''

  if (!code || !state || storedState !== state) {
    throw new Error('回调参数无效或状态校验失败，请重新登录')
  }

  const result = await accountApi.callbackLogin({
    code,
    state,
    redirectUri: `${window.location.origin}${route.path}`,
  })

  if ((result as any).code === 400 || !result.local_token) {
    throw new Error((result as any).msg || '登录失败')
  }

  userStore.setAuthSession({
    token: result.local_token,
    user: {
      id: result.user.id,
      name: result.user.name,
      avatar: result.user.avatar,
      email: result.user.email,
      provider: result.user.provider,
    },
    permissions: result.permissions,
  })
  if (typeof result.downloads_today_used === 'number') {
    userStore.setDownloadsTodayUsed(result.downloads_today_used)
  }

  localStorage.removeItem(LocalStorageKey.authStateKey)
  sessionStorage.removeItem(LocalStorageKey.authStateKey)
  router.replace('/account')
}

onMounted(async () => {
  try {
    await finishLogin()
  } catch (error: any) {
    errorMessage.value = String(error?.message || '登录失败')
    setTimeout(() => {
      router.replace({ path: '/login', query: { message: errorMessage.value } })
    }, 1200)
  }
})
</script>

<style scoped lang="less">
.callback-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #eff6ff;
}

.callback-card {
  width: min(460px, 100%);
  padding: 36px;
  border-radius: 28px;
  text-align: center;
  background: #fff;
  box-shadow: 0 24px 80px rgba(37, 99, 235, 0.14);
}

.callback-spinner {
  position: relative;
  width: 120px;
  height: 120px;
  margin: 0 auto 18px;
}

.callback-spinner span {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 16px;
  height: 52px;
  margin-left: -8px;
  margin-top: -60px;
  border-radius: 999px;
  background: #2563eb;
  transform-origin: center 60px;
}

.callback-spinner span:nth-child(1) { transform: rotate(0deg); }
.callback-spinner span:nth-child(2) { transform: rotate(45deg); }
.callback-spinner span:nth-child(3) { transform: rotate(90deg); }
.callback-spinner span:nth-child(4) { transform: rotate(135deg); }
.callback-spinner span:nth-child(5) { transform: rotate(180deg); }
.callback-spinner span:nth-child(6) { transform: rotate(225deg); }
.callback-spinner span:nth-child(7) { transform: rotate(270deg); }
.callback-spinner span:nth-child(8) { transform: rotate(315deg); }

.callback-card h1 {
  margin: 16px 0 10px;
  color: #0f172a;
}

.callback-card p {
  margin: 0;
  color: #475569;
  line-height: 1.7;
}
</style>
