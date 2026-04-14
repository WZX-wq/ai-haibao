<template>
  <div class="login-redirect-page">
    <!-- 已配置 OAuth 且非 manual / 无路由错误时：不展示说明卡片，直接拉配置并跳转鲲穹 -->
    <div v-if="silentShell" class="login-silent-shell">
      <p class="login-silent-shell__text">{{ silentStatusText }}</p>
    </div>

    <div v-else class="login-redirect-card">
      <p class="login-redirect-card__eyebrow">登录</p>
      <h1 class="login-redirect-card__title">{{ titleText }}</h1>
      <p class="login-redirect-card__desc">{{ descText }}</p>

      <div v-if="bootstrapLoading" class="login-redirect-card__hint">正在检查登录配置…</div>

      <div v-if="!oauthReady && !bootstrapLoading && !bootstrapFailed" class="login-redirect-card__info">
        服务端未检测到完整鲲穹 OAuth 配置（见 deploy 环境变量 OAUTH_*）。可先进入编辑器；配置完成并重建 API 容器后，登录将跳转鲲穹统一登录。
      </div>

      <div v-if="errorMessage" class="login-redirect-card__alert">
        {{ errorMessage }}
      </div>

      <div class="login-redirect-card__actions">
        <el-button
          v-if="oauthReady"
          type="primary"
          size="large"
          :loading="loading"
          :disabled="bootstrapLoading"
          @click="startLogin"
        >
          {{ primaryCtaText }}
        </el-button>
        <el-button v-else-if="bootstrapLoading" size="large" disabled loading>请稍候…</el-button>
        <el-button
          v-else
          type="primary"
          size="large"
          @click="router.push('/home')"
        >
          进入编辑器
        </el-button>
        <el-button v-if="bootstrapFailed" size="large" plain :loading="bootstrapLoading" @click="loadBootstrap">
          重试
        </el-button>
        <el-button size="large" plain :disabled="bootstrapLoading" @click="router.push('/welcome')">
          {{ backHomeText }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as accountApi from '@/api/account'
import { LocalStorageKey } from '@/config'

const router = useRouter()
const route = useRoute()

function queryString(v: unknown): string {
  if (v === undefined || v === null) return ''
  if (Array.isArray(v)) return String(v[0] ?? '')
  return String(v)
}

/** 用户显式要求停留本页（不自动跳转） */
const holdManual = computed(
  () => route.query.manual === '1' || route.query.noredirect === '1',
)

const loading = ref(false)
const errorMessage = ref('')
const redirected = ref(false)

const bootstrapLoading = ref(true)
const oauthReady = ref(false)
const bootstrapFailed = ref(false)

const hasRouteError = computed(() => Boolean(queryString(route.query.message).trim()))
/** 无 manual、无 ?message= 时走「静默」：仅一行提示并立刻跳转鲲穹，不展示大卡片 */
const silentEligible = computed(() => !holdManual.value && !hasRouteError.value)
const silentShell = computed(() => {
  if (!silentEligible.value) return false
  if (bootstrapFailed.value) return false
  if (!bootstrapLoading.value && !oauthReady.value) return false
  if (errorMessage.value) return false
  return true
})
const silentStatusText = computed(() => {
  if (bootstrapLoading.value) return '正在跳转登录…'
  if (loading.value) return '正在跳转登录…'
  if (oauthReady.value) return '正在跳转登录…'
  return '请稍候…'
})

const titleText = computed(() => {
  if (bootstrapLoading.value) return '请稍候'
  if (bootstrapFailed.value) return '无法连接服务'
  if (errorMessage.value) return '登录失败'
  if (!oauthReady.value) return '未配置鲲穹登录'
  if (loading.value) return '正在跳转鲲穹登录'
  return '鲲穹统一登录'
})

const descText = computed(() => {
  if (bootstrapLoading.value) return '正在确认是否已配置鲲穹 OAuth。'
  if (bootstrapFailed.value) return '拉取登录配置失败，请检查网络或稍后重试。'
  if (errorMessage.value) return '请重试跳转，或返回首页继续使用编辑器。'
  if (!oauthReady.value) {
    return '未配置完整 OAUTH_* 时无法跳转鲲穹；编辑器仍可本地使用。'
  }
  if (loading.value) {
    return '正在打开鲲穹统一登录。企业租户可能会经由飞书等完成授权，属于正常流程。'
  }
  if (holdManual.value) {
    return '已启用鲲穹：点击下方「打开鲲穹登录」跳转统一登录（企业可能经飞书授权）。去掉地址栏里的 manual=1 可恢复打开本页即自动跳转。'
  }
  return '已启用鲲穹：将自动跳转统一登录；若未跳转可点下方按钮。不想自动跳转时可在地址后加 manual=1 再打开本页。'
})

const primaryCtaText = computed(() => (errorMessage.value ? '重新跳转鲲穹登录' : '打开鲲穹登录'))

const backHomeText = '返回首页'

function toFriendlyLoginError(raw: unknown) {
  const text = String(raw || '').toLowerCase()
  if (!text) return '登录暂时不可用，请稍后重试'
  if (text.includes('oauth') || text.includes('callback') || text.includes('state')) return '登录校验未通过，请重新点击登录'
  if (text.includes('network') || text.includes('timeout') || text.includes('err_connection_refused')) return '网络异常，请检查网络后重试'
  return '登录暂时不可用，请稍后重试'
}

async function loadBootstrap() {
  bootstrapLoading.value = true
  bootstrapFailed.value = false
  try {
    const boot = await accountApi.getBootstrap()
    oauthReady.value = !!boot.oauth_ready
  } catch {
    oauthReady.value = false
    bootstrapFailed.value = true
  } finally {
    bootstrapLoading.value = false
  }
}

async function startLogin() {
  if (!oauthReady.value) {
    errorMessage.value = '当前未配置 OAuth，无法跳转第三方登录。'
    return
  }
  if (loading.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    const redirectUri = `${window.location.origin}/oauth/callback`
    const result = (await accountApi.getLoginUrl({ redirectUri })) as Record<string, unknown>
    const loginUrl = String(result.login_url ?? '')
    if (Number(result.code) === 400 || !loginUrl) {
      throw new Error(String(result.msg || '登录跳转地址生成失败'))
    }
    const st = String(result.state ?? '')
    localStorage.setItem(LocalStorageKey.authStateKey, st)
    sessionStorage.setItem(LocalStorageKey.authStateKey, st)
    redirected.value = true
    window.location.replace(loginUrl)
  } catch (error: any) {
    errorMessage.value = toFriendlyLoginError(error?.message)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  const msgFromRoute = queryString(route.query.message).trim()
  if (msgFromRoute) {
    errorMessage.value = msgFromRoute
  }
  await loadBootstrap()

  /** 已配置鲲穹 OAuth 时默认自动跳转；OAuth 回调带错误、或 ?manual=1 / ?noredirect=1 时停留本页 */
  const manualOnly = route.query.manual === '1' || route.query.noredirect === '1'
  const hasErrorMessage = Boolean(queryString(route.query.message).trim())
  if (oauthReady.value && !redirected.value && !manualOnly && !hasErrorMessage) {
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

.login-silent-shell {
  text-align: center;
}

.login-silent-shell__text {
  margin: 0;
  font-size: 15px;
  color: #64748b;
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

.login-redirect-card__hint {
  margin-top: 16px;
  font-size: 14px;
  color: #64748b;
}

.login-redirect-card__info {
  margin-top: 18px;
  padding: 14px 16px;
  border-radius: 14px;
  background: #eff6ff;
  color: #1e40af;
  line-height: 1.6;
  font-size: 14px;
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
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 24px;
}

@media (max-width: 640px) {
  .login-redirect-page {
    padding: 16px;
    align-items: stretch;
  }

  .login-redirect-card {
    margin: auto 0;
    padding: 22px 16px;
    border-radius: 18px;
  }

  .login-redirect-card__title {
    font-size: 26px;
  }

  .login-redirect-card__desc,
  .login-redirect-card__info,
  .login-redirect-card__alert {
    font-size: 13px;
    line-height: 1.6;
  }

  .login-redirect-card__actions {
    flex-direction: column;
  }

  .login-redirect-card__actions :deep(.el-button) {
    width: 100%;
    margin-left: 0;
  }
}
</style>
