<template>
  <div class="login-redirect-page">
    <div class="login-redirect-card">
      <p class="login-redirect-card__eyebrow">OAuth2 Login</p>
      <h1 class="login-redirect-card__title">{{ titleText }}</h1>
      <p class="login-redirect-card__desc">{{ descText }}</p>

      <div v-if="errorMessage" class="login-redirect-card__alert">
        {{ errorMessage }}
      </div>

      <div class="login-redirect-card__actions">
        <el-button type="primary" size="large" :loading="loading" @click="startLogin">
          {{ retryText }}
        </el-button>
        <el-button size="large" plain @click="router.push('/welcome')">
          {{ backHomeText }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as accountApi from '@/api/account.ts'
import { LocalStorageKey } from '@/config.ts'

const router = useRouter()
const route = useRoute()
const loading = ref(false)
const errorMessage = ref('')
const redirected = ref(false)

const titleText = computed(() => errorMessage.value ? '\u767b\u5f55\u5931\u8d25' : '\u6b63\u5728\u8df3\u8f6c\u5230\u767b\u5f55\u9875')
const descText = computed(() => errorMessage.value
  ? '\u8bf7\u91cd\u65b0\u70b9\u51fb\u6309\u94ae\uff0c\u6216\u7a0d\u540e\u518d\u8bd5\u3002'
  : '\u8bf7\u7a0d\u5019\uff0c\u7cfb\u7edf\u6b63\u5728\u4e3a\u4f60\u6253\u5f00\u9cb2\u7a79 AI \u7edf\u4e00\u767b\u5f55\u9875\u3002')

const retryText = computed(() => errorMessage.value ? '\u91cd\u65b0\u8df3\u8f6c' : '\u7acb\u5373\u8df3\u8f6c')
const backHomeText = '\u8fd4\u56de\u9996\u9875'

async function startLogin() {
  if (loading.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    const redirectUri = `${window.location.origin}/oauth/callback`
    const result = await accountApi.getLoginUrl({ redirectUri })
    if ((result as any).code === 400 || !result.login_url) {
      throw new Error((result as any).msg || '\u767b\u5f55\u8df3\u8f6c\u5730\u5740\u751f\u6210\u5931\u8d25')
    }
    localStorage.setItem(LocalStorageKey.authStateKey, result.state || '')
    sessionStorage.setItem(LocalStorageKey.authStateKey, result.state || '')
    redirected.value = true
    window.location.href = result.login_url
  } catch (error: any) {
    errorMessage.value = String(error?.message || '\u767b\u5f55\u6682\u65f6\u4e0d\u53ef\u7528')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (typeof route.query.message === 'string' && route.query.message) {
    errorMessage.value = route.query.message
  }
  if (!redirected.value) {
    startLogin()
  }
})
</script>

<style scoped lang="less">
.login-redirect-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  background:
    radial-gradient(circle at top left, rgba(37, 99, 235, 0.14), transparent 30%),
    radial-gradient(circle at bottom right, rgba(249, 115, 22, 0.12), transparent 24%),
    #f8fafc;
}

.login-redirect-card {
  width: min(480px, 100%);
  padding: 36px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 24px 80px rgba(15, 23, 42, 0.12);
}

.login-redirect-card__eyebrow {
  margin: 0 0 10px;
  font-size: 12px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #2563eb;
}

.login-redirect-card__title {
  margin: 0;
  font-size: 34px;
  color: #0f172a;
}

.login-redirect-card__desc {
  margin: 14px 0 0;
  line-height: 1.7;
  color: #475569;
}

.login-redirect-card__alert {
  margin-top: 18px;
  padding: 14px 16px;
  border-radius: 14px;
  background: #fff7ed;
  color: #c2410c;
  line-height: 1.6;
}

.login-redirect-card__actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}
</style>
