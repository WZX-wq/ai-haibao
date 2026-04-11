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
import * as accountApi from '@/api/account.ts'
import { LocalStorageKey } from '@/config.ts'
import useUserStore from '@/store/base/user.ts'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const errorMessage = ref('')

const titleText = computed(() => errorMessage.value ? '\u767b\u5f55\u5931\u8d25' : '\u6b63\u5728\u5b8c\u6210\u767b\u5f55')
const statusText = computed(() => errorMessage.value || '\u6b63\u5728\u4e0e\u672c\u5730\u670d\u52a1\u4ea4\u6362 token \u5e76\u521b\u5efa\u4f1a\u8bdd\uff0c\u8bf7\u7a0d\u5019\u3002')

async function finishLogin() {
  const code = String(route.query.code || '')
  const state = String(route.query.state || '')
  const storedState = localStorage.getItem(LocalStorageKey.authStateKey) || sessionStorage.getItem(LocalStorageKey.authStateKey) || ''

  if (!code || !state || storedState !== state) {
    throw new Error('\u56de\u8c03\u53c2\u6570\u65e0\u6548\u6216 state \u6821\u9a8c\u5931\u8d25\uff0c\u8bf7\u91cd\u65b0\u767b\u5f55')
  }

  const result = await accountApi.callbackLogin({
    code,
    state,
    redirectUri: `${window.location.origin}${route.path}`,
  })

  if ((result as any).code === 400 || !result.local_token) {
    throw new Error((result as any).msg || '\u767b\u5f55\u5931\u8d25')
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

  localStorage.removeItem(LocalStorageKey.authStateKey)
  sessionStorage.removeItem(LocalStorageKey.authStateKey)
  router.replace('/account')
}

onMounted(async () => {
  try {
    await finishLogin()
  } catch (error: any) {
    errorMessage.value = String(error?.message || '\u767b\u5f55\u5931\u8d25')
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
