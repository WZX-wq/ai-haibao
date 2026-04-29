<template>
  <!-- 未登录：单栏居中 -->
  <div v-if="!userStore.online" class="ac-page ac-page--guest">
    <div class="ac-guest-body">
      <section class="ac-login-card">
        <div class="ac-login-card__icon">
          <el-icon :size="48"><User /></el-icon>
        </div>
        <h2>登录后解锁完整能力</h2>
        <p>登录后即可查看账号与鲲币信息。</p>
        <button type="button" class="ac-sidebar-upgrade" @click="go('/login')">
          <el-icon :size="14"><Right /></el-icon>
          立即登录
        </button>
      </section>
    </div>
  </div>

  <!-- 已登录：精简版个人中心 -->
  <div v-else class="ac-page">
    <div class="ac-main-wrap">
      <main class="ac-content">
        <div class="ac-dashboard">
          <aside class="ac-dashboard__sidebar">
            <div class="ac-sidebar-card ac-sidebar-card--profile">
              <div class="ac-sidebar-card__actions">
                <button type="button" class="ac-sidebar-icon-btn" @click="goBack" aria-label="返回上一页">
                  <el-icon :size="15"><Back /></el-icon>
                </button>
                <button type="button" class="ac-sidebar-icon-btn" @click="logout" aria-label="退出登录">
                  <el-icon :size="15"><SwitchButton /></el-icon>
                </button>
              </div>
              <div class="ac-sidebar-card__body">
                <div class="ac-sidebar-avatar-card" :title="displayUser.name || '用户'">
                  <img v-if="displayUser.avatar" :src="displayUser.avatar" alt="" />
                  <span v-else>{{ userInitial }}</span>
                </div>
                <div class="ac-sidebar-name">{{ displayUser.name || '用户' }}</div>
                <div class="ac-sidebar-id">{{ sidebarUserIdText }}</div>
                <div class="ac-sidebar-meta">{{ userJoinedText }}</div>
                <div class="ac-sidebar-status-row">
                  <span class="ac-sidebar-status-pill ac-sidebar-status-pill--online">
                    <span class="ac-sidebar-status-dot" />
                    {{ sessionStatusText }}
                  </span>
                  <span class="ac-sidebar-status-pill">{{ loginProviderText }}</span>
                </div>
              </div>
            </div>

            <nav class="ac-sidebar-card ac-sidebar-card--nav" aria-label="用户中心菜单">
              <button
                v-for="item in sidebarNavItems"
                :key="item.key"
                type="button"
                :class="['ac-sidebar-nav-item', item.active ? 'is-active' : '']"
                @click="handleSidebarNav(item)"
              >
                <span class="ac-sidebar-nav-item__bar" />
                <span class="ac-sidebar-nav-item__icon">
                  <el-icon :size="18"><component :is="item.icon" /></el-icon>
                </span>
                <span class="ac-sidebar-nav-item__label">{{ item.label }}</span>
              </button>
            </nav>

            <div class="ac-sidebar-card ac-sidebar-card--cta">
              <div class="ac-sidebar-cta__title">鲲币中心</div>
              <div class="ac-sidebar-cta__desc">余额不足时可随时充值，继续使用下载与生成功能。</div>
              <button type="button" class="ac-sidebar-cta__btn" @click="openRechargeCenter">
                立即充值
                <el-icon :size="14"><ArrowRight /></el-icon>
              </button>
            </div>
          </aside>

          <section class="ac-dashboard__main">
            <section class="ac-hero-card">
              <div class="ac-hero-card__header">
                <div>
                  <div class="ac-hero-card__title">
                    <el-icon :size="18"><Star /></el-icon>
                    账户总览
                  </div>
                  <div class="ac-hero-card__welcome">欢迎回来，{{ heroWelcomeText }}</div>
                </div>
                <div class="ac-hero-status">
                  <span class="ac-hero-status__label">账户状态</span>
                  <span class="ac-hero-status__pill">
                    <span class="ac-hero-status__dot" />
                    状态良好
                  </span>
                </div>
              </div>

              <div class="ac-hero-card__content">
                <div class="ac-hero-balance">
                  <div class="ac-hero-balance__ring">
                    <svg width="104" height="104" viewBox="0 0 92 92" aria-hidden="true">
                      <circle class="ac-balance-card__ring-bg" cx="46" cy="46" r="32" />
                      <circle
                        class="ac-balance-card__ring-fill"
                        cx="46"
                        cy="46"
                        r="32"
                        :stroke-dasharray="ringC"
                        :stroke-dashoffset="kunbiRingOffset"
                      />
                    </svg>
                    <div class="ac-hero-balance__ring-center">
                      <div class="ac-hero-balance__percent">{{ kunbiRingPercentText }}</div>
                      <div class="ac-hero-balance__progress">{{ kunbiRingProgressText }}</div>
                    </div>
                  </div>

                  <div class="ac-hero-balance__summary">
                    <div class="ac-hero-balance__value-row">
                      <div class="ac-hero-balance__value">{{ kunbiBalanceValueText }}</div>
                      <div class="ac-hero-balance__unit">鲲币</div>
                    </div>
                    <div class="ac-hero-balance__desc">可用于下载、生成等功能</div>
                    <div class="ac-hero-balance__hint">{{ kunbiBalanceHint }}</div>
                    <div class="ac-hero-balance__actions">
                      <button type="button" class="ac-hero-btn ac-hero-btn--solid" @click="openRechargeCenter">
                        立即充值
                      </button>
                      <button type="button" class="ac-hero-btn ac-hero-btn--ghost" @click="handleRechargeHistory">
                        查看记录
                      </button>
                    </div>
                  </div>
                </div>
                <div class="ac-hero-card__art" aria-hidden="true">
                  <div class="ac-hero-card__orb" />
                  <div class="ac-hero-card__halo" />
                  <div class="ac-hero-card__badge">
                    <div class="ac-hero-card__badge-ring" />
                    <div class="ac-hero-card__badge-check">✓</div>
                  </div>
                </div>
              </div>
            </section>

            <div class="ac-dashboard__middle">
              <section class="ac-panel-card">
                <div class="ac-panel-card__head">
                  <div class="ac-panel-card__title">
                    <el-icon :size="18"><UserFilled /></el-icon>
                    账号信息
                  </div>
                </div>
                <div class="ac-panel-card__body">
                  <div class="ac-account-grid">
                    <div v-for="metric in accountMetrics" :key="metric.label" class="ac-account-grid__item">
                      <div class="ac-account-grid__label">{{ metric.label }}</div>
                      <div class="ac-account-grid__value" :class="metric.tone === 'success' ? 'is-success' : ''">
                        <template v-if="metric.label === '状态'">
                          <span class="ac-account-grid__status-dot" />
                          {{ metric.value }}
                        </template>
                        <template v-else>
                          {{ metric.value }}
                        </template>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section class="ac-panel-card">
                <div class="ac-panel-card__head">
                  <div class="ac-panel-card__title">
                    <el-icon :size="18"><Promotion /></el-icon>
                    快捷操作
                  </div>
                </div>
                <div class="ac-panel-card__body">
                  <div class="ac-action-grid">
                    <button
                      v-for="action in dashboardQuickActions"
                      :key="action.label"
                      type="button"
                      class="ac-action-grid__item"
                      @click="handleDashboardQuickAction(action)"
                    >
                      <span class="ac-action-grid__icon">
                        <el-icon :size="20"><component :is="quickActionIcon(action)" /></el-icon>
                      </span>
                      <span class="ac-action-grid__content">
                        <span class="ac-action-grid__title">{{ action.label }}</span>
                        <span class="ac-action-grid__desc">{{ quickActionDesc(action) }}</span>
                      </span>
                    </button>
                  </div>
                </div>
              </section>
            </div>

            <section id="ac-section-recent" class="ac-panel-card ac-panel-card--records">
              <div class="ac-panel-card__head">
                <div class="ac-panel-card__title">
                  <el-icon :size="18"><Clock /></el-icon>
                  最近记录
                </div>
                <button type="button" class="ac-panel-card__link" @click="openAllRecentRecords">
                  查看全部
                  <el-icon :size="14"><ArrowRight /></el-icon>
                </button>
              </div>
              <div class="ac-panel-card__body">
                <div v-if="recentRecords.length" class="ac-record-list">
                  <div v-for="(item, index) in recentRecords" :key="index" class="ac-record-list__item">
                    <div class="ac-record-list__icon" :class="recordIconClass(item)">
                      <el-icon :size="18"><component :is="recordIcon(item)" /></el-icon>
                    </div>
                    <div class="ac-record-list__content">
                      <div class="ac-record-list__title-row">
                        <div class="ac-record-list__title">{{ normalizeRecordText(item) }}</div>
                        <div
                          v-if="formatRecordAmount(item)"
                          :class="['ac-record-list__amount', recordAmountClass(item)]"
                        >
                          {{ formatRecordAmount(item) }}
                        </div>
                      </div>
                      <div class="ac-record-list__time">{{ recordMetaText(item) }}</div>
                    </div>
                  </div>
                </div>
                <p v-else class="ac-empty">暂无记录</p>
              </div>
            </section>
          </section>
        </div>
      </main>
    </div>
  </div>
  <KunbiRechargeModal
    v-model="rechargeVisible"
    :balance="kunbiBalance"
    :packages="rechargePackages"
    :api-config="rechargeApiConfig"
    @pay="handleRechargePay"
    @history="handleRechargeHistory"
  />
  <KunbiHistoryDrawer
    v-model="historyVisible"
    v-model:active-tab="historyActiveTab"
    :loading="historyLoading"
    :recharge-items="rechargeHistory"
    :detail-items="kunbiDetailHistory"
  />
  <teleport to="body">
    <div v-if="wechatPayVisible" class="ac-pay-overlay" @click="closeWechatPayDialog">
      <div class="ac-pay-dialog" @click.stop>
        <button type="button" class="ac-pay-dialog__close" @click="closeWechatPayDialog">×</button>
        <div class="ac-pay-dialog__title">微信扫码支付</div>
        <div class="ac-pay-dialog__desc">请使用微信扫一扫完成支付，支付成功后会自动刷新鲲币余额。</div>
        <div class="ac-pay-dialog__qr-wrap">
          <img v-if="wechatPayQrCode" :src="wechatPayQrCode" alt="微信支付二维码" class="ac-pay-dialog__qr" />
        </div>
        <div class="ac-pay-dialog__meta">
          <span v-if="wechatPayAmountText">支付金额：{{ wechatPayAmountText }}</span>
          <span v-if="wechatPayKunbiText">到账鲲币：{{ wechatPayKunbiText }}</span>
        </div>
        <button type="button" class="ac-pay-dialog__btn" @click="closeWechatPayDialog">我知道了</button>
      </div>
    </div>
    <div v-if="alipayPayVisible" class="ac-pay-overlay" @click="closeAlipayPayDialog">
      <div class="ac-pay-dialog ac-pay-dialog--alipay" @click.stop>
        <button type="button" class="ac-pay-dialog__close" @click="closeAlipayPayDialog">×</button>
        <div class="ac-pay-dialog__title">支付宝支付</div>
        <div class="ac-pay-dialog__desc">请使用支付宝扫一扫完成支付，支付成功后会自动刷新鲲币余额。</div>
        <div class="ac-pay-dialog__qr-wrap ac-pay-dialog__qr-wrap--alipay">
          <div v-if="alipayPayLoading" class="ac-pay-iframe__loading">正在加载支付宝二维码...</div>
          <img v-else-if="alipayPayQrCode" :src="alipayPayQrCode" alt="支付宝支付二维码" class="ac-pay-dialog__qr" />
        </div>
        <div class="ac-pay-dialog__meta">
          <span v-if="alipayPayAmountText">支付金额：{{ alipayPayAmountText }}</span>
          <span v-if="alipayPayKunbiText">到账鲲币：{{ alipayPayKunbiText }}</span>
        </div>
        <button type="button" class="ac-pay-dialog__btn ac-pay-dialog__btn--blue" @click="closeAlipayPayDialog">
          我知道了
        </button>
      </div>
    </div>
  </teleport>
</template>

<script lang="ts" setup>
import type { Component } from 'vue'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  ArrowRight,
  Back,
  Clock,
  Document,
  EditPen,
  House,
  Lock,
  MagicStick,
  PictureFilled,
  Promotion,
  Right,
  Star,
  SwitchButton,
  User,
  UserFilled,
} from '@element-plus/icons-vue'
import * as accountApi from '@/api/account'
import {
  checkRechargeOrderStatus,
  createRechargeOrder,
  getKunbiDetailRecord,
  getKunbiRechargeInfo,
  getKunbiRechargeRecord,
  type CreateRechargeOrderParams,
  type KunbiApiConfig,
  type KunbiDetailRecordItem,
  type KunbiRechargePackage,
  type KunbiRechargeRecordItem,
} from '@/api/kunbi'
import useUserStore from '@/store/base/user'
import useNotification from '@/common/methods/notification'
import type { AccountCenterResult, AccountPermissions } from '@/api/account'
import KunbiHistoryDrawer from '@/components/business/kunbi-recharge/KunbiHistoryDrawer.vue'
import KunbiRechargeModal from '@/components/business/kunbi-recharge/KunbiRechargeModal.vue'

type QuickAction = { label: string; path: string }
type AccountMetricItem = { label: string; value: string; tag?: string; tone?: 'primary' | 'success' | 'violet' | 'slate' }
type SidebarNavItem = { key: string; label: string; icon: Component; active?: boolean; action: 'route' | 'recharge' | 'history'; path?: string; tab?: 'recharge' | 'detail' }
const ACCOUNT_BACK_FALLBACK_KEY = 'xp_account_back_fallback_after_login'

const router = useRouter()
const userStore = useUserStore()
const center = ref<AccountCenterResult | null>(null)
const rechargeVisible = ref(false)
const historyVisible = ref(false)
const historyActiveTab = ref<'recharge' | 'detail'>('recharge')
const historyLoading = ref(false)
const kunbiBalance = ref(0)
const rechargePackages = ref<KunbiRechargePackage[]>([])
const rechargeHistory = ref<KunbiRechargeRecordItem[]>([])
const kunbiDetailHistory = ref<KunbiDetailRecordItem[]>([])
const wechatPayVisible = ref(false)
const wechatPayQrCode = ref('')
const wechatPayAmountText = ref('')
const wechatPayKunbiText = ref('')
const alipayPayVisible = ref(false)
const alipayPayQrCode = ref('')
const alipayPayLoading = ref(false)
const alipayPayAmountText = ref('')
const alipayPayKunbiText = ref('')
let rechargeStatusTimer: number | null = null
let rechargePollCount = 0
const rechargeApiConfig: KunbiApiConfig = {
  baseUrl: '',
  kunbiIcon: '/images/kunbi.png',
}

const ringR = 32
const ringC = 2 * Math.PI * ringR

const defaultQuickActions: QuickAction[] = [
  { label: 'AI 生成海报', path: '/home' },
  { label: '模板库', path: '/home?tempid=303' },
  { label: '我的作品', path: '/home?tempid=303' },
  { label: '进入编辑器', path: '/home?tempid=303' },
  { label: '自由绘制', path: '/home' },
  { label: '导入 PSD', path: '/psd' },
]

const displayUser = computed(() => ({
  id: center.value?.account_overview?.user?.id || userStore.user.id || null,
  name: center.value?.account_overview?.user?.name || userStore.user.name || '',
  avatar: center.value?.account_overview?.user?.avatar || userStore.user.avatar || '',
  email: center.value?.account_overview?.user?.email || userStore.user.email || '',
}))
const loginProviderText = computed(() => center.value?.account_overview?.user?.provider || 'kunqiong-login')
const sidebarUserIdText = computed(() => displayUser.value.id || '未设置 ID')
const heroWelcomeText = computed(() => displayUser.value.name || displayUser.value.id || '欢迎回来')

const effectivePermissions = computed<AccountPermissions>(() => {
  if (center.value?.feature_permission_card) {
    return {
      is_vip: center.value.vip_status?.is_vip ?? userStore.permissions.is_vip,
      vip_level: center.value.vip_status?.vip_level ?? userStore.permissions.vip_level,
      vip_expire_time: center.value.vip_status?.vip_expire_time ?? userStore.permissions.vip_expire_time,
      daily_limit_count: center.value.quota_card?.daily_limit_count ?? userStore.permissions.daily_limit_count,
      max_file_size: center.value.quota_card?.max_file_size ?? userStore.permissions.max_file_size,
      allow_batch: center.value.feature_permission_card.allow_batch,
      allow_no_watermark: center.value.feature_permission_card.allow_no_watermark,
      allow_ai_tools: center.value.feature_permission_card.allow_ai_tools,
      allow_template_manage: center.value.feature_permission_card.allow_template_manage,
    }
  }
  return {
    is_vip: userStore.permissions.is_vip,
    vip_level: userStore.permissions.vip_level,
    vip_expire_time: userStore.permissions.vip_expire_time,
    daily_limit_count: userStore.permissions.daily_limit_count,
    max_file_size: userStore.permissions.max_file_size,
    allow_batch: userStore.permissions.allow_batch,
    allow_no_watermark: userStore.permissions.allow_no_watermark,
    allow_ai_tools: userStore.permissions.allow_ai_tools,
    allow_template_manage: userStore.permissions.allow_template_manage,
  }
})

const userInitial = computed(() => (displayUser.value.name || '用').slice(0, 1))
const userJoinedText = computed(() => {
  const centerUser = center.value?.account_overview?.user as Record<string, any> | undefined
  const raw =
    centerUser?.created_at ||
    centerUser?.create_time ||
    (userStore.user as Record<string, any>)?.created_at ||
    (userStore.user as Record<string, any>)?.create_time
  const text = String(raw ?? '').trim()
  if (!text) return '已开通账号'
  const matched = text.match(/\d{4}[/-]\d{1,2}[/-]\d{1,2}/)
  return matched ? `${matched[0].replace(/\//g, '.')}` : text
})
const vipBadgeText = computed(() => (effectivePermissions.value.is_vip ? '会员' : '免费版'))
const isVipUser = computed(() => !!effectivePermissions.value.is_vip)
const vipLevelText = computed(() => String(effectivePermissions.value.vip_level ?? 0))
const sessionStatusText = computed(
  () => mapSessionStatusToZh(center.value?.account_overview?.session_status) || '在线',
)
const quotaSubTag = computed(() => {
  if (isVipUser.value) return ''
  const limit = dailyLimit.value
  if (limit <= 0) return '不限次'
  return `每日 ${limit} 次`
})
const accountMetrics = computed<AccountMetricItem[]>(() => [
  {
    label: '用户标识',
    value: displayUser.value.id || '未获取',
    tone: 'primary',
  },
  {
    label: '昵称',
    value: displayUser.value.name || '未填写',
    tone: 'violet',
  },
  {
    label: '状态',
    value: sessionStatusText.value,
    tag: '在线',
    tone: 'success',
  },
  {
    label: '登录方式',
    value: center.value?.account_overview?.user?.provider || '账号登录',
    tone: 'slate',
  },
])

function getAdaptiveRingMax(value: number) {
  if (value <= 0) return 100
  const exp = Math.floor(Math.log10(value))
  const base = 10 ** exp
  const ratio = value / base
  if (ratio <= 1) return base
  if (ratio <= 2) return 2 * base
  if (ratio <= 5) return 5 * base
  return 10 * base
}

function formatIntegerText(value: number) {
  return Math.round(value).toLocaleString('zh-CN')
}

const kunbiRingMax = computed(() => getAdaptiveRingMax(kunbiBalance.value))
const kunbiRingMaxText = computed(() => formatIntegerText(kunbiRingMax.value))
const kunbiRingCurrentText = computed(() => formatIntegerText(kunbiBalance.value))
const kunbiRingProgressText = computed(() => `${kunbiRingCurrentText.value} / ${kunbiRingMaxText.value}`)
const kunbiRingPercent = computed(() => {
  if (kunbiBalance.value <= 0) return 0
  const max = kunbiRingMax.value
  if (max <= 0) return 0
  return Math.min(100, Math.round((kunbiBalance.value / max) * 100))
})
const kunbiRingPercentText = computed(() => `${kunbiRingPercent.value}%`)
const kunbiRingStatusText = computed(() => (kunbiBalance.value <= 0 ? '待充值' : kunbiRingPercentText.value))
const kunbiRingSubText = computed(() =>
  kunbiBalance.value <= 0 ? '立即开通' : kunbiRingProgressText.value,
)
const kunbiBalanceDesc = computed(() =>
  kunbiBalance.value <= 0 ? '充值后即可使用下载、生成等功能' : '可用于下载、生成等功能',
)
const kunbiBalanceValueText = computed(() => formatIntegerText(kunbiBalance.value))
const kunbiScaleText = computed(() =>
  kunbiBalance.value <= 0 ? '可随时充值' : '按需使用',
)
const kunbiBalanceHint = computed(() =>
  kunbiBalance.value <= 0
    ? '余额不足时可随时补充'
    : '余额不足时可随时充值',
)

const kunbiRingOffset = computed(() => {
  if (kunbiBalance.value <= 0) return ringC * 0.88
  const max = kunbiRingMax.value
  const rawPercent = max > 0 ? kunbiBalance.value / max : 0
  const visiblePercent = Math.max(0.08, Math.min(1, rawPercent))
  return ringC - visiblePercent * ringC
})

const downloadsUsed = computed(() => {
  if (userStore.downloadsTodayUsed != null) return userStore.downloadsTodayUsed
  return center.value?.quota_card?.downloads_today_used ?? 0
})

const dailyLimit = computed(() => Number(effectivePermissions.value.daily_limit_count ?? 0))

const downloadPercent = computed(() => {
  const limit = dailyLimit.value
  const used = downloadsUsed.value
  if (limit <= 0) return null
  return Math.min(100, Math.round((used / limit) * 100))
})

const downloadRingOffset = computed(() => {
  const p = downloadPercent.value
  if (p === null) return ringC * 0.4
  return ringC - (p / 100) * ringC
})

const quotaRingCenter = computed(() => {
  const limit = dailyLimit.value
  const used = downloadsUsed.value
  if (limit <= 0) return String(used)
  return `${used}/${limit}`
})

const downloadsUsedText = computed(() => {
  const limit = dailyLimit.value
  const used = downloadsUsed.value
  if (limit <= 0) return `${used}（不限次）`
  return `${used} / ${limit}`
})

const vipExpireCardTitle = computed(() => (effectivePermissions.value.is_vip ? '会员有效期' : '会员状态'))

const vipExpireRaw = computed(() => effectivePermissions.value.vip_expire_time)

const vipDaysLeft = computed(() => {
  const raw = vipExpireRaw.value
  if (raw == null || !String(raw).trim()) return null
  const d = new Date(String(raw).trim())
  if (Number.isNaN(d.getTime())) return null
  return Math.ceil((d.getTime() - Date.now()) / 86400000)
})

const vipDaysLeftDisplay = computed(() => {
  if (!effectivePermissions.value.is_vip) return '—'
  const n = vipDaysLeft.value
  if (n === null) return '—'
  if (n <= 0) return '已到期'
  return String(n)
})

const vipDaysLeftUnit = computed(() => {
  if (!effectivePermissions.value.is_vip) return ''
  const n = vipDaysLeft.value
  if (n === null || n <= 0) return ''
  return ' 天'
})

const vipDaysLeftTag = computed(() => {
  const n = vipDaysLeft.value
  if (n == null) return '会员'
  if (n <= 0) return '已到期'
  return `剩余${n}天`
})

const expiryRingLabel = computed(() => (effectivePermissions.value.is_vip ? '倒计时' : '未开通'))

const expiryRingOffset = computed(() => {
  if (!effectivePermissions.value.is_vip) return ringC * 0.75
  const n = vipDaysLeft.value
  if (n == null) return ringC * 0.5
  if (n <= 0) return 0
  const pct = Math.min(100, Math.max(5, (n / 30) * 100))
  return ringC - (pct / 100) * ringC
})

const templateManageSummary = computed(() =>
  effectivePermissions.value.allow_template_manage ? '已授权管理模板' : '未开通模板管理',
)

const templateProgressPct = computed(() => (effectivePermissions.value.allow_template_manage ? 100 : 28))

const quickActions = computed<QuickAction[]>(() => {
  const list = center.value?.quick_actions?.filter((item) => item?.label && item?.path) || []
  return list.length ? list : defaultQuickActions
})
const dashboardQuickActions = computed<QuickAction[]>(() => {
  const preferred = ['进入编辑器', 'AI 生成海报', '模板库', '账户充值']
  const list = [...quickActions.value]
  const ensured = preferred.map((label) => {
    if (label === '账户充值') return { label, path: '__recharge__' }
    return list.find((item) => String(item.label).trim() === label) || defaultQuickActions.find((item) => item.label === label) || { label, path: '/home' }
  })
  return ensured
})

const sidebarNavItems = computed<SidebarNavItem[]>(() => [
  { key: 'account', label: '账户总览', icon: Star, active: true, action: 'route', path: '/account' },
  { key: 'mine', label: '我的作品', icon: Document, action: 'route', path: '/home?section=mine' },
  { key: 'template', label: '模板库', icon: EditPen, action: 'route', path: '/home?section=template' },
  { key: 'ai', label: 'AI 生成海报', icon: MagicStick, action: 'route', path: '/home?section=ai-poster' },
  { key: 'recharge', label: '账户充值', icon: Promotion, action: 'recharge' },
  { key: 'history', label: '充值记录', icon: Clock, action: 'history', tab: 'detail' },
])

const recentRecords = computed(() => center.value?.recent_records?.slice(0, 3) || [])
const recentExpenseDetails = computed(() => (kunbiDetailHistory.value || []).filter((item) => Number(item?.type) === 1))

const permissionRows = computed(() => {
  const p = effectivePermissions.value
  const limit = dailyLimit.value
  const aiDesc = p.allow_ai_tools
    ? p.is_vip
      ? '已开启 · 会员无限制'
      : limit > 0
      ? `已开启 · 每日 ${limit} 次`
      : '已开启'
    : '未开启'
  return [
    {
      key: 'ai',
      label: 'AI 工具',
      desc: aiDesc,
      on: !!p.allow_ai_tools,
    },
    {
      key: 'wm',
      label: '无水印导出',
      desc: p.allow_no_watermark ? '已开启' : '需升级会员',
      on: !!p.allow_no_watermark,
    },
  ]
})

function normalizeQuickActionPath(action: QuickAction): string {
  const label = String(action?.label || '').trim()
  const raw = String(action?.path || '').trim()

  if (label === '进入编辑器') return '/home?tempid=303'
  if (label === 'AI 生成海报') return '/home?section=ai-poster'
  if (label === '模板库') return '/home?section=template'
  if (label === '我的作品') return '/home?section=mine'
  if (label === '自由绘制') return '/draw'
  if (label === '导入 PSD') return '/psd'

  return resolvePath(raw)
}

function quickActionIcon(action: QuickAction): Component {
  const p = normalizeQuickActionPath(action)
  if (p.includes('ai-poster')) return MagicStick
  if (p.includes('psd')) return PictureFilled
  if (p.includes('section=template') || p.includes('tempid')) return EditPen
  if (p.includes('section=mine')) return Document
  if (p === '/home' || p.startsWith('/home')) return House
  return Promotion
}

function quickToneClass(action: QuickAction): string {
  const p = normalizeQuickActionPath(action)
  if (p.includes('ai-poster')) return ''
  if (p.includes('section=template') || p.includes('section=mine') || p.includes('tempid') || p.includes('home')) return 'ac-quick-entry--green'
  return ''
}

function quickActionDesc(action: QuickAction) {
  const label = String(action?.label || '').trim()
  if (label === '进入编辑器') return '开始创作'
  if (label === 'AI 生成海报') return '智能生成'
  if (label === '模板库') return '海量模板'
  if (label === '账户充值') return '快速充值'
  if (label === '我的作品') return '查看作品'
  return '立即前往'
}

function activityDotClass(record: unknown): string {
  const t = normalizeRecordText(record)
  if (t.includes('下载')) return 'is-download'
  if (t.includes('导出')) return 'is-export'
  return 'is-edit'
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function mapSessionStatusToZh(status: string | null | undefined): string {
  if (status == null || !String(status).trim()) return ''
  const key = String(status).trim().toLowerCase()
  const map: Record<string, string> = {
    active: '在线',
    valid: '有效',
    expired: '已过期',
    invalid: '无效',
    revoked: '已撤销',
    pending: '待生效',
    inactive: '未激活',
  }
  return map[key] ?? String(status).trim()
}

function normalizeRecordText(record: any) {
  if (typeof record === 'string') return stripRecordTime(record)
  if (record?.title) return stripRecordTime(String(record.title))
  if (record?.name) return stripRecordTime(String(record.name))
  if (record?.id) return `记录 #${record.id}`
  return '新记录'
}

function stripRecordTime(text: string) {
  return String(text || '')
    .replace(/\s*[·•]\s*\d{4}[/-]\d{1,2}[/-]\d{1,2}\s+\d{1,2}:\d{2}(?::\d{2})?\s*$/u, '')
    .trim()
}

function extractRecordTime(record: any) {
  if (record?.create_time) return String(record.create_time).trim()
  if (record?.time) return String(record.time).trim()
  if (record?.date) return String(record.date).trim()
  if (typeof record === 'string') {
    const matched = record.match(/(\d{4}[/-]\d{1,2}[/-]\d{1,2}\s+\d{1,2}:\d{2}(?::\d{2})?)\s*$/u)
    return matched?.[1] || ''
  }
  const source = String(record?.title || record?.name || '').trim()
  const matched = source.match(/(\d{4}[/-]\d{1,2}[/-]\d{1,2}\s+\d{1,2}:\d{2}(?::\d{2})?)\s*$/u)
  return matched?.[1] || ''
}

function normalizeCoinNumber(value: unknown) {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  const num = Number(raw)
  if (!Number.isFinite(num)) return raw
  return Number.isInteger(num) ? String(num) : String(num)
}

function parseRecordAmount(record: any) {
  const candidates = [
    record?.consume_kunbi,
    record?.deduct_kunbi,
    record?.used_kunbi,
    record?.cost_kunbi,
    record?.change_kunbi,
    record?.amount,
    record?.kunbi,
  ]
  for (const value of candidates) {
    const raw = String(value ?? '').trim()
    if (raw) {
      const num = Number(raw)
      if (Number.isFinite(num)) return num
      const cleaned = Number(raw.replace(/[^\d.-]/g, ''))
      if (Number.isFinite(cleaned)) return cleaned
    }
  }
  return null
}

function guessRecordAmountFromDetail(record: any) {
  const title = normalizeRecordText(record)
  const time = extractRecordTime(record)
  if (!title || !time) return null
  const match = recentExpenseDetails.value.find((item) => {
    const detailTime = String(item?.create_time || '').trim()
    const detailDesc = String(item?.description || '').trim()
    return detailTime === time && (!detailDesc || detailDesc.includes(title) || title.includes(detailDesc))
  })
  if (!match) return null
  return parseRecordAmount(match)
}

function resolveRecordAmount(record: any) {
  const directAmount = parseRecordAmount(record)
  if (directAmount != null) return directAmount
  return guessRecordAmountFromDetail(record)
}

function formatRecordAmount(record: any) {
  const amount = resolveRecordAmount(record)
  if (amount == null || !Number.isFinite(amount) || amount === 0) return ''
  const action = amount < 0 ? '增加' : '扣减'
  return `${action} ${normalizeCoinNumber(Math.abs(amount))} 鲲币`
}

function recordAmountClass(record: any) {
  const amount = resolveRecordAmount(record)
  return amount != null && amount < 0 ? 'is-plus' : 'is-minus'
}

function recordMetaText(record: any) {
  const time = extractRecordTime(record)
  return time || '刚刚'
}

function recordIcon(record: any): Component {
  const t = normalizeRecordText(record)
  if (t.includes('下载') || t.includes('导出')) return ArrowRight
  if (t.includes('模板')) return EditPen
  if (t.includes('保存')) return Document
  return EditPen
}

function recordIconClass(record: any) {
  const t = normalizeRecordText(record)
  if (t.includes('下载') || t.includes('导出')) return 'is-download'
  if (t.includes('保存')) return 'is-save'
  return 'is-edit'
}

function resolvePath(path: string) {
  const raw = String(path || '')
  if (!raw) return '/home'
  if (raw === '/ai-poster') return '/home?section=ai-poster'
  if (raw.startsWith('/ai-poster?')) return `/home?section=ai-poster&${raw.slice('/ai-poster?'.length)}`
  if (raw === '/template') return '/home?section=template'
  if (raw === '/mine') return '/home?section=mine'
  return raw
}

function go(path: string) {
  router.push(resolvePath(path))
}

async function openHistoryDrawer(tab: 'recharge' | 'detail' = 'recharge') {
  historyActiveTab.value = tab
  historyVisible.value = true
  await loadRechargeHistory(true)
}

function goBack() {
  const shouldFallbackHome = sessionStorage.getItem(ACCOUNT_BACK_FALLBACK_KEY) === '1'
  if (shouldFallbackHome) {
    sessionStorage.removeItem(ACCOUNT_BACK_FALLBACK_KEY)
    router.push('/')
    return
  }
  if (window.history.length > 1) {
    router.back()
    return
  }
  router.push('/')
}

function openPath(path: string) {
  const target = resolvePath(path)
  if (/^https?:\/\//.test(target)) {
    window.location.assign(target)
    return
  }
  router.push(target)
}

function openQuickAction(action: QuickAction) {
  const target = normalizeQuickActionPath(action)
  if (/^https?:\/\//.test(target)) {
    window.location.assign(target)
    return
  }
  router.push(target)
}

function handleDashboardQuickAction(action: QuickAction) {
  if (String(action.label).trim() === '账户充值') {
    void openRechargeCenter()
    return
  }
  openQuickAction(action)
}

function handleSidebarNav(item: SidebarNavItem) {
  if (item.action === 'recharge') {
    void openRechargeCenter()
    return
  }
  if (item.action === 'history') {
    void openHistoryDrawer(item.tab || 'detail')
    return
  }
  if (item.path) {
    go(item.path)
  }
}

function openAllRecentRecords() {
  void openHistoryDrawer(recentExpenseDetails.value.length ? 'detail' : 'recharge')
}

function toastInfo(msg: string) {
  ElMessage({
    message: msg,
    type: 'info',
    customClass: 'ac-top-message',
    offset: 24,
  })
}

function stopRechargePolling() {
  if (rechargeStatusTimer != null) {
    window.clearInterval(rechargeStatusTimer)
    rechargeStatusTimer = null
  }
  rechargePollCount = 0
}

function openWechatPayDialog(payload: { qrCode: string; amount?: string; kunbi?: string }) {
  wechatPayQrCode.value = payload.qrCode
  wechatPayAmountText.value = payload.amount || ''
  wechatPayKunbiText.value = payload.kunbi || ''
  wechatPayVisible.value = true
}

function closeWechatPayDialog() {
  wechatPayVisible.value = false
}

function openAlipayPayDialog(payload: { qrCode: string; amount?: string; kunbi?: string }) {
  const qrCode = String(payload.qrCode || '').trim()
  if (!qrCode) return false
  alipayPayAmountText.value = payload.amount || ''
  alipayPayKunbiText.value = payload.kunbi || ''
  alipayPayQrCode.value = qrCode
  alipayPayLoading.value = false
  alipayPayVisible.value = true
  return true
}

function closeAlipayPayDialog() {
  alipayPayVisible.value = false
  alipayPayLoading.value = false
  alipayPayQrCode.value = ''
}

async function loadRechargeInfo(showError = false) {
  if (!userStore.online) return
  try {
    const data = await getKunbiRechargeInfo()
    kunbiBalance.value = Number(data?.kunbi_balance ?? 0)
    rechargePackages.value = Array.isArray(data?.recharge_packages) ? data.recharge_packages : []
  } catch (error: any) {
    if (showError) {
      ElMessage.error(error?.message || '获取充值信息失败')
    }
  }
}

async function refreshKunbiData(options: { showHistoryError?: boolean } = {}) {
  if (!userStore.online) return
  await Promise.all([
    loadRechargeInfo(),
    loadCenter(),
    loadRechargeHistory(!!options.showHistoryError),
  ])
}

async function openRechargeCenter() {
  if (!userStore.online) {
    go('/login')
    return
  }
  await loadRechargeInfo(true)
  rechargeVisible.value = true
}

async function loadRechargeHistory(showError = false) {
  if (!userStore.online) return
  historyLoading.value = true
  try {
    const [rechargeData, detailData] = await Promise.all([
      getKunbiRechargeRecord(1, 20),
      getKunbiDetailRecord(1, 30, 0),
    ])
    const rechargeList = Array.isArray(rechargeData?.list) ? rechargeData.list : []
    rechargeHistory.value = await Promise.all(
      rechargeList.map(async (item: any) => {
        let payStatus = item?.pay_status
        if ((payStatus === undefined || payStatus === null || payStatus === '') && item?.order_sn) {
          try {
            const statusData = await checkRechargeOrderStatus(String(item.order_sn))
            payStatus = statusData?.pay_status
          } catch {
            // 保持静默，列表仍展示订单本身信息
          }
        }

        return { ...item, pay_status: Number(payStatus ?? 0) }
      }),
    )
    kunbiDetailHistory.value = Array.isArray(detailData?.list) ? detailData.list : []
  } catch (error: any) {
    if (showError) {
      ElMessage.error(error?.message || '获取充值记录失败')
    }
  } finally {
    historyLoading.value = false
  }
}

async function handleRechargeHistory() {
  historyActiveTab.value = 'recharge'
  historyVisible.value = true
  await loadRechargeHistory(true)
}

async function startRechargePolling(orderSn: string) {
  stopRechargePolling()

  const poll = async () => {
    rechargePollCount += 1
    try {
      const status = await checkRechargeOrderStatus(orderSn)
      if (Number(status?.pay_status) === 1) {
        stopRechargePolling()
        rechargeVisible.value = false
        closeWechatPayDialog()
        closeAlipayPayDialog()
        await refreshKunbiData()
        ElMessage.success('支付成功，鲲币余额已刷新')
        return
      }
    } catch {
      // 轮询期间静默重试，避免打断支付流程
    }

    if (rechargePollCount >= 20) {
      stopRechargePolling()
    }
  }

  void poll()
  rechargeStatusTimer = window.setInterval(() => {
    void poll()
  }, 3000)
}

function openPayTarget(target: string) {
  const url = String(target || '').trim()
  if (!url) return false
  if (/^data:image\//i.test(url)) return false
  window.location.assign(url)
  return true
}

function tryHandleWechatPay(data: Record<string, any>) {
  const qrCode = String(data.qrcode_img_url || data.qr_code_img_url || data.qr_code || '').trim()
  if (!qrCode) return false
  if (!/^data:image\//i.test(qrCode) && !/^https?:\/\//i.test(qrCode)) return false
  openWechatPayDialog({
    qrCode,
    amount: data.pay_amount != null && String(data.pay_amount).trim() ? `¥${String(data.pay_amount).trim()}` : '',
    kunbi: data.buy_kunbi_count != null && String(data.buy_kunbi_count).trim() ? `${String(data.buy_kunbi_count).trim()} 鲲币` : '',
  })
  return true
}

function tryHandleAlipayPay(data: Record<string, any>) {
  const qrCode = String(data.alipay_qr_code || '').trim()
  if (!qrCode) return false
  openAlipayPayDialog({
    qrCode,
    amount: data.pay_amount != null && String(data.pay_amount).trim() ? `¥${String(data.pay_amount).trim()}` : '',
    kunbi: data.buy_kunbi_count != null && String(data.buy_kunbi_count).trim() ? `${String(data.buy_kunbi_count).trim()} 鲲币` : '',
  })
  return true
}

function tryHandlePayData(payData: unknown) {
  if (!payData) return false

  if (typeof payData === 'string') {
    const trimmed = payData.trim()
    if (!trimmed) return false
    if (trimmed.startsWith('<form') || trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) return false
    return openPayTarget(trimmed)
  }

  if (typeof payData !== 'object') return false
  const data = payData as Record<string, any>
  if (tryHandleAlipayPay(data)) {
    return true
  }
  if (tryHandleWechatPay(data)) {
    return true
  }

  const urlKeys = ['pay_url', 'url', 'redirect_url', 'h5_url', 'mweb_url', 'deep_link', 'qr_code']
  for (const key of urlKeys) {
    if (data[key] && openPayTarget(String(data[key]))) {
      return true
    }
  }

  for (const [key, value] of Object.entries(data)) {
    const text = String(value || '').trim()
    if (!text) continue
    if ((key.toLowerCase().includes('url') || key.toLowerCase().includes('link')) && openPayTarget(text)) {
      return true
    }
  }

  return false
}

async function handleRechargePay(params: CreateRechargeOrderParams) {
  try {
    const data = await createRechargeOrder(params)
    if (!data?.order_sn) {
      throw new Error('订单创建成功，但未返回订单号')
    }

    const opened =
      (params.pay_type === 2 &&
        data.alipay_qr_code &&
        openAlipayPayDialog({
          qrCode: String(data.alipay_qr_code),
          amount: data.pay_amount != null && String(data.pay_amount).trim() ? `¥${String(data.pay_amount).trim()}` : '',
          kunbi:
            data.buy_kunbi_count != null && String(data.buy_kunbi_count).trim()
              ? `${String(data.buy_kunbi_count).trim()} 鲲币`
              : '',
        })) ||
      (data.pay_url && openPayTarget(data.pay_url)) ||
      (data.pay_data && tryHandlePayData(data.pay_data)) ||
      tryHandlePayData(data)

    ElMessage({
      message:
        params.pay_type === 1
          ? opened
            ? '订单已创建，请扫码完成微信支付'
            : '订单已创建，请继续完成支付'
          : opened
            ? '订单已创建，请在弹层内完成支付宝支付'
            : '订单已创建，请继续完成支付',
      type: 'success',
      customClass: 'ac-top-message',
      offset: 24,
    })
    await startRechargePolling(data.order_sn)
  } catch (error: any) {
    ElMessage({
      message: error?.message || '创建充值订单失败',
      type: 'error',
      customClass: 'ac-top-message',
      offset: 24,
    })
  }
}

async function loadCenter() {
  if (!userStore.online) return
  try {
    center.value = await accountApi.getAccountCenter()
    const used = center.value?.quota_card?.downloads_today_used
    if (typeof used === 'number') {
      userStore.setDownloadsTodayUsed(used)
    }
  } catch {
    center.value = null
  }
}

async function logout() {
  try {
    await accountApi.logout()
    userStore.clearAuthSession()
    center.value = null
    useNotification('已退出登录', '你的账号已安全退出。', { type: 'success' })
    router.replace('/welcome')
  } catch {
    useNotification('退出登录失败', '请检查网络后重试。', { type: 'warning' })
  }
}

onMounted(async () => {
  await Promise.all([loadCenter(), loadRechargeInfo(), loadRechargeHistory()])
})

onBeforeUnmount(stopRechargePolling)
</script>

<style scoped lang="less">
/* 设计变量对齐 Desktop 参考稿 account-center-optimized.html */
.ac-page {
  --ac-primary: #6f9b94;
  --ac-primary-light: #b8d4cf;
  --ac-primary-strong: #4d726c;
  --ac-primary-50: #f4faf8;
  --ac-primary-100: #e7f2ef;
  --ac-primary-200: #cfe5df;
  --ac-gradient: linear-gradient(135deg, #90b9b1 0%, #7ea9a2 42%, #c7dfda 100%);
  --ac-gradient-btn: linear-gradient(90deg, #84b2aa, #6f9b94);
  --ac-success: #138f67;
  --ac-success-light: rgba(19, 143, 103, 0.12);
  --ac-warning: #c97a16;
  --ac-warning-light: rgba(249, 115, 22, 0.14);
  --ac-violet: #7f7ae6;
  --ac-violet-light: rgba(127, 122, 230, 0.14);
  --ac-bg: linear-gradient(180deg, #f5f8f7 0%, #fcfdfc 100%);
  --ac-card: #ffffff;
  --ac-text: #1f2a37;
  --ac-text-2: #667085;
  --ac-text-3: #98a2b3;
  --ac-border: #d9e5e2;
  --ac-border-light: #edf3f1;
  --ac-shadow-sm: 0 4px 14px rgba(25, 44, 52, 0.05);
  --ac-shadow-md: 0 14px 36px rgba(25, 44, 52, 0.08);
  --ac-radius: 12px;
  --ac-radius-sm: 8px;

  min-height: 100vh;
  display: flex;
  background: var(--ac-bg);
  color: var(--ac-text);
  font-family:
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    'PingFang SC',
    'Hiragino Sans GB',
    'Microsoft YaHei',
    sans-serif;
  -webkit-font-smoothing: antialiased;
}

.ac-page--guest {
  flex-direction: column;
}

.ac-guest-body {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
}

/* ========== 侧栏 ========== */
.ac-sidebar {
  width: 240px;
  min-height: 100vh;
  background: var(--ac-card);
  border-right: 1px solid var(--ac-border-light);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 20px 24px;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  align-self: flex-start;
  height: 100vh;
  overflow-y: auto;
}

.ac-sidebar-logo {
  font-size: 18px;
  font-weight: 700;
  color: var(--ac-primary);
  margin-bottom: 32px;
  align-self: flex-start;
  padding-left: 4px;
  text-decoration: none;
}

.ac-sidebar-avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: linear-gradient(135deg, #c7d2fe, #a5b4fc);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 700;
  color: var(--ac-primary);
  margin-bottom: 12px;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.ac-sidebar-username {
  font-size: 18px;
  font-weight: 600;
  color: var(--ac-text);
  margin-bottom: 16px;
  text-align: center;
  word-break: break-all;
}

.ac-sidebar-upgrade {
  width: 100%;
  padding: 10px 0;
  background: var(--ac-gradient-btn);
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  border-radius: 20px;
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
  transition: all 0.2s ease;

  &:hover {
    box-shadow: 0 4px 16px rgba(99, 102, 241, 0.4);
    transform: translateY(-1px);
  }
}

.ac-sidebar-kunbi {
  width: 100%;
  margin-top: 10px;
  padding: 12px 14px;
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(179, 122, 42, 0.12), rgba(216, 171, 104, 0.16));
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.ac-sidebar-kunbi__label {
  font-size: 12px;
  color: var(--ac-text-2);
}

.ac-sidebar-kunbi__value {
  font-size: 20px;
  font-weight: 700;
  color: var(--ac-primary-strong);
}

.ac-sidebar-nav {
  list-style: none;
  width: 100%;
  margin-top: 32px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;

  a {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    border-radius: var(--ac-radius-sm);
    font-size: 14px;
    color: var(--ac-text-2);
    text-decoration: none;
    transition: all 0.2s ease;
    cursor: pointer;

    &:hover {
      background: var(--ac-border-light);
      color: var(--ac-text);
    }

    &.is-active {
      background: var(--ac-primary-50);
      color: var(--ac-primary);
      font-weight: 500;
    }
  }
}

.ac-main-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.ac-pills {
  display: flex;
  gap: 8px;
}

.ac-pill {
  padding: 4px 12px;
  border-radius: 14px;
  font-size: 12px;
  font-weight: 500;
}

.ac-pill--gray {
  background: var(--ac-border-light);
  color: var(--ac-text-2);
}

.ac-pill--green {
  background: var(--ac-success-light);
  color: var(--ac-success);
}

.ac-pill--blue {
  background: rgba(37, 99, 235, 0.1);
  color: #1d4ed8;
}

.ac-header-btns {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.ac-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--ac-radius-sm);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  font-family: inherit;
  white-space: nowrap;
}

.ac-btn--primary {
  background: linear-gradient(180deg, #ffffff 0%, #edf7f4 100%);
  color: var(--ac-primary-strong);
  border: 1px solid rgba(196, 221, 215, 0.92);

  &:hover {
    background: linear-gradient(180deg, #ffffff 0%, #e4f1ed 100%);
    color: #3f625d;
    box-shadow: 0 12px 26px rgba(93, 132, 125, 0.16);
  }
}

.ac-btn--outline {
  background: #f8fbfa;
  color: #54756f;
  border: 1px solid rgba(212, 227, 223, 0.92);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);

  &:hover {
    border-color: rgba(111, 155, 148, 0.36);
    color: var(--ac-primary-strong);
    background: #f1f8f6;
  }
}

/* ========== 主内容 ========== */
.ac-content {
  padding: 14px 22px 22px;
  flex: 1;
}

.ac-dashboard {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}

.ac-dashboard__sidebar {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 16px 18px;
  border-radius: 30px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.99), rgba(248, 250, 255, 0.96)),
    radial-gradient(circle at top left, rgba(117, 132, 255, 0.08), transparent 34%);
  border: 1px solid rgba(227, 233, 246, 0.96);
  box-shadow:
    0 20px 44px rgba(90, 102, 153, 0.1),
    0 4px 12px rgba(15, 23, 42, 0.04);
  position: sticky;
  top: 18px;
}

.ac-dashboard__main {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-width: 0;
}

.ac-dashboard__middle {
  display: grid;
  grid-template-columns: minmax(0, 1.18fr) minmax(340px, 0.9fr);
  gap: 24px;
}

.ac-sidebar-card,
.ac-panel-card,
.ac-hero-card {
  background: rgba(255, 255, 255, 0.98);
  border: 1px solid rgba(231, 236, 247, 0.96);
  border-radius: 24px;
  box-shadow:
    0 18px 38px rgba(100, 109, 148, 0.08),
    0 3px 10px rgba(15, 23, 42, 0.03);
}

.ac-sidebar-card {
  position: relative;
  overflow: hidden;
  border-color: transparent;
  background: transparent;
  box-shadow: none;
}

.ac-sidebar-card--profile {
  padding: 4px 4px 14px;
}

.ac-sidebar-card__actions {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.ac-sidebar-icon-btn {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  border: 1px solid rgba(229, 234, 247, 0.98);
  background: linear-gradient(180deg, #ffffff, #f5f7ff);
  color: #7280d7;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, color 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    color: #5b64cf;
    box-shadow: 0 10px 22px rgba(103, 111, 201, 0.14);
  }
}

.ac-sidebar-card__body {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 10px 8px 0;
}

.ac-sidebar-avatar-card {
  margin-top: 10px;
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background: linear-gradient(135deg, #dbe7ff 0%, #b4cbff 52%, #93a9ff 100%);
  box-shadow:
    inset 0 0 0 8px rgba(255, 255, 255, 0.68),
    0 16px 34px rgba(115, 130, 236, 0.18);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 42px;
  font-weight: 800;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.ac-sidebar-name {
  margin-top: 16px;
  font-size: 22px;
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: -0.03em;
  color: #172445;
  max-width: 100%;
  word-break: break-word;
}

.ac-sidebar-id {
  margin-top: 6px;
  font-size: 13px;
  color: #818cab;
  word-break: break-all;
}

.ac-sidebar-meta {
  margin-top: 8px;
  font-size: 12px;
  color: #9aa5bd;
}

.ac-sidebar-status-row {
  width: 100%;
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid rgba(235, 239, 248, 0.98);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  flex-wrap: wrap;
}

.ac-sidebar-status-pill {
  min-height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  background: #f4f6fb;
  color: #667390;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 700;
}

.ac-sidebar-status-pill--online {
  background: rgba(36, 197, 94, 0.1);
  color: #0d9a66;
}

.ac-sidebar-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 0 5px rgba(16, 185, 129, 0.12);
}

.ac-sidebar-card--nav {
  padding: 10px 0 2px;
}

.ac-sidebar-nav-item {
  position: relative;
  width: 100%;
  min-height: 54px;
  border: 0;
  background: transparent;
  border-radius: 16px;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 0 16px;
  color: #32405f;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease;

  & + .ac-sidebar-nav-item {
    margin-top: 4px;
  }

  &:hover {
    background: linear-gradient(180deg, #f7f8ff, #f3f5ff);
    color: #5566d8;
  }

  &.is-active {
    background: linear-gradient(180deg, #f7f8ff, #eff3ff);
    color: #5968dc;
    font-weight: 700;
    box-shadow: inset 0 0 0 1px rgba(111, 126, 241, 0.1);

    .ac-sidebar-nav-item__bar {
      opacity: 1;
      transform: scaleY(1);
    }
  }
}

.ac-sidebar-nav-item__bar {
  position: absolute;
  left: 4px;
  top: 12px;
  bottom: 12px;
  width: 3px;
  border-radius: 999px;
  background: #6373ff;
  opacity: 0;
  transform: scaleY(0.4);
  transition: all 0.2s ease;
}

.ac-sidebar-nav-item__icon {
  width: 30px;
  height: 30px;
  border-radius: 12px;
  background: linear-gradient(180deg, #f4f6ff, #eef2ff);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: inherit;
}

.ac-sidebar-nav-item__label {
  min-width: 0;
  line-height: 1.2;
}

.ac-sidebar-card--cta {
  margin-top: auto;
  padding: 18px 18px 20px;
  min-height: 148px;
  border-radius: 24px;
  background:
    radial-gradient(circle at 82% 26%, rgba(255, 255, 255, 0.2), transparent 24%),
    radial-gradient(circle at 75% 78%, rgba(255, 255, 255, 0.16), transparent 28%),
    linear-gradient(145deg, #7d86ff 0%, #9897ff 54%, #b6b1ff 100%);
  color: #fff;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.26),
    0 20px 30px rgba(118, 118, 227, 0.2);
}

.ac-sidebar-cta__title {
  font-size: 21px;
  font-weight: 800;
  line-height: 1.1;
}

.ac-sidebar-cta__desc {
  margin-top: 10px;
  font-size: 13px;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.84);
}

.ac-sidebar-cta__btn {
  margin-top: 18px;
  min-height: 42px;
  padding: 0 18px;
  border-radius: 999px;
  border: 0;
  background: rgba(255, 255, 255, 0.96);
  color: #6171e5;
  font-size: 14px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-family: inherit;
}

.ac-hero-card {
  position: relative;
  overflow: hidden;
  padding: 26px 34px 28px;
  min-height: 330px;
  background:
    radial-gradient(circle at 78% 32%, rgba(255, 255, 255, 0.14), transparent 22%),
    radial-gradient(circle at 88% 50%, rgba(255, 255, 255, 0.12), transparent 28%),
    linear-gradient(135deg, #526df0 0%, #6578ee 36%, #8674eb 100%);
  border-color: rgba(118, 133, 238, 0.46);
  box-shadow:
    0 24px 44px rgba(91, 103, 205, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.12);
}

.ac-hero-card::before {
  content: '';
  position: absolute;
  right: -60px;
  bottom: -80px;
  width: 460px;
  height: 460px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.ac-hero-card::after {
  content: '';
  position: absolute;
  right: 42px;
  bottom: -44px;
  width: 300px;
  height: 180px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.16), transparent 68%);
}

.ac-hero-card__header,
.ac-hero-card__content {
  position: relative;
  z-index: 1;
}

.ac-hero-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
}

.ac-hero-card__title {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: rgba(255, 255, 255, 0.92);
}

.ac-hero-card__welcome {
  margin-top: 14px;
  font-size: 30px;
  font-weight: 800;
  line-height: 1.18;
  letter-spacing: -0.04em;
  color: #fff;
}

.ac-hero-status {
  display: flex;
  align-items: center;
  gap: 14px;
  padding-top: 6px;
}

.ac-hero-status__label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.78);
}

.ac-hero-status__pill {
  min-height: 38px;
  padding: 0 15px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  backdrop-filter: blur(10px);
}

.ac-hero-status__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #4ade80;
  box-shadow: 0 0 0 6px rgba(74, 222, 128, 0.12);
}

.ac-hero-card__content {
  margin-top: 30px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.ac-hero-balance {
  display: flex;
  align-items: center;
  gap: 28px;
  min-width: 0;
}

.ac-hero-balance__ring {
  position: relative;
  width: 126px;
  height: 126px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.ac-hero-balance__ring svg {
  transform: rotate(-90deg);
  width: 126px;
  height: 126px;
}

.ac-hero-balance__ring .ac-balance-card__ring-bg {
  stroke: rgba(255, 255, 255, 0.18);
  stroke-width: 5;
}

.ac-hero-balance__ring .ac-balance-card__ring-fill {
  stroke: #ffd24a;
  stroke-width: 5;
  filter: none;
}

.ac-hero-balance__ring-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.ac-hero-balance__percent {
  font-size: 24px;
  font-weight: 800;
  line-height: 1;
}

.ac-hero-balance__progress {
  margin-top: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.74);
}

.ac-hero-balance__summary {
  min-width: 0;
}

.ac-hero-balance__value-row {
  display: flex;
  align-items: flex-end;
  gap: 14px;
}

.ac-hero-balance__value {
  font-size: 58px;
  font-weight: 800;
  line-height: 0.95;
  color: #fff;
  letter-spacing: -0.05em;
}

.ac-hero-balance__unit {
  padding-bottom: 8px;
  font-size: 18px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.88);
}

.ac-hero-balance__desc {
  margin-top: 12px;
  font-size: 15px;
  color: rgba(255, 255, 255, 0.9);
}

.ac-hero-balance__hint {
  margin-top: 8px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.74);
}

.ac-hero-balance__actions {
  margin-top: 24px;
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.ac-hero-btn {
  min-width: 144px;
  min-height: 48px;
  padding: 0 22px;
  border-radius: 15px;
  border: 1px solid transparent;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.ac-hero-btn--solid {
  background: #fff;
  color: #4258d3;
  box-shadow: 0 18px 30px rgba(41, 55, 126, 0.16);
}

.ac-hero-btn--ghost {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.42);
  color: #fff;
  backdrop-filter: blur(10px);
}

.ac-hero-btn:hover {
  transform: translateY(-1px);
}

.ac-hero-card__art {
  position: relative;
  width: 292px;
  height: 196px;
  flex-shrink: 0;
}

.ac-hero-card__orb {
  position: absolute;
  top: 18px;
  left: 26px;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  filter: blur(0.4px);
}

.ac-hero-card__halo {
  position: absolute;
  right: 16px;
  bottom: 20px;
  width: 220px;
  height: 142px;
  border-radius: 100px 100px 24px 24px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03)),
    radial-gradient(circle at 50% 0, rgba(255, 255, 255, 0.12), transparent 72%);
}

.ac-hero-card__badge {
  position: absolute;
  right: 28px;
  bottom: 0;
  width: 128px;
  height: 128px;
  border-radius: 38% 38% 44% 44%;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(238, 240, 255, 0.8));
  box-shadow:
    inset 0 0 22px rgba(255, 255, 255, 0.6),
    0 18px 30px rgba(64, 72, 138, 0.14);
  transform: rotate(8deg);
}

.ac-hero-card__badge-ring {
  position: absolute;
  top: -18px;
  left: 22px;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: 6px solid rgba(255, 255, 255, 0.3);
}

.ac-hero-card__badge-check {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 56px;
  font-weight: 800;
  color: rgba(141, 151, 255, 0.72);
}

.ac-panel-card__head {
  padding: 22px 26px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid rgba(236, 239, 247, 0.98);
}

.ac-panel-card__title {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 18px;
  font-weight: 800;
  color: #111b3a;
}

.ac-panel-card__title .el-icon {
  color: #46536f;
}

.ac-panel-card__body {
  padding: 20px 26px 24px;
}

.ac-panel-card__link {
  border: 0;
  background: transparent;
  color: #5f71de;
  font-size: 16px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-family: inherit;
}

.ac-account-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.ac-account-grid__item {
  min-height: 106px;
  padding: 20px 22px;
  border-radius: 18px;
  border: 1px solid rgba(233, 237, 246, 0.98);
  background: linear-gradient(180deg, #ffffff, #fafcff);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.ac-account-grid__label {
  font-size: 13px;
  color: #858fab;
}

.ac-account-grid__value {
  margin-top: 18px;
  font-size: 17px;
  font-weight: 800;
  color: #162243;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  word-break: break-word;
}

.ac-account-grid__value.is-success {
  color: #0c9965;
}

.ac-account-grid__status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 0 6px rgba(16, 185, 129, 0.12);
}

.ac-action-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.ac-action-grid__item {
  min-height: 106px;
  padding: 20px 20px;
  border-radius: 18px;
  border: 1px solid rgba(233, 237, 246, 0.98);
  background: linear-gradient(180deg, #ffffff, #fafbff);
  display: flex;
  align-items: center;
  gap: 14px;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    border-color: rgba(122, 135, 233, 0.3);
    box-shadow: 0 14px 26px rgba(102, 114, 191, 0.08);
  }
}

.ac-action-grid__icon {
  width: 46px;
  height: 46px;
  border-radius: 15px;
  background: linear-gradient(180deg, #f2f3ff, #e8ecff);
  color: #6071e2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.ac-action-grid__content {
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-width: 0;
}

.ac-action-grid__title {
  font-size: 15px;
  font-weight: 800;
  color: #17213f;
}

.ac-action-grid__desc {
  font-size: 13px;
  color: #8a93ab;
}

.ac-record-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.ac-record-list__item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 20px;
  border-radius: 18px;
  border: 1px solid rgba(236, 239, 247, 0.98);
  background: linear-gradient(180deg, #ffffff, #fbfcff);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.66);
}

.ac-record-list__icon {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  &.is-download {
    background: rgba(16, 185, 129, 0.12);
    color: #0e9f6e;
  }

  &.is-save {
    background: rgba(96, 113, 226, 0.12);
    color: #6071e2;
  }

  &.is-edit {
    background: rgba(125, 146, 245, 0.12);
    color: #6a78e0;
  }
}

.ac-record-list__content {
  min-width: 0;
  flex: 1;
}

.ac-record-list__title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.ac-record-list__title {
  font-size: 15px;
  font-weight: 800;
  color: #121d3b;
  line-height: 1.35;
}

.ac-record-list__time {
  margin-top: 7px;
  font-size: 13px;
  color: #8e97b1;
}

.ac-record-list__amount {
  flex-shrink: 0;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;

  &.is-minus {
    color: #c77714;
    background: rgba(255, 237, 213, 0.95);
  }

  &.is-plus {
    color: #0f9a67;
    background: rgba(220, 252, 231, 0.95);
  }
}

.ac-account-layout {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr) 370px;
  grid-template-areas:
    'profile balance balance'
    'profile account actions'
    'profile recent recent';
  gap: 16px;
  align-items: start;
}

.ac-account-aside {
  display: contents;
}

.ac-account-main {
  display: contents;
}

.ac-profile-card {
  grid-area: profile;
  position: relative;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(245, 248, 255, 0.96)),
    linear-gradient(135deg, rgba(115, 103, 240, 0.06), rgba(92, 166, 255, 0.04));
  border-radius: 24px;
  border: 1px solid rgba(217, 225, 243, 0.9);
  box-shadow:
    0 18px 40px rgba(68, 90, 160, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.85);
}

.ac-profile-card__body {
  padding: 28px 20px 22px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  flex: 1;
}

.ac-profile-card__avatar {
  width: 104px;
  height: 104px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: linear-gradient(135deg, #dbe8ff, #a7c4ff 55%, #7d92f5);
  color: #fff;
  font-size: 42px;
  font-weight: 800;
  box-shadow:
    0 18px 36px rgba(125, 146, 245, 0.22),
    inset 0 0 0 6px rgba(255, 255, 255, 0.68);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.ac-profile-card__name {
  margin-top: 18px;
  font-size: 24px;
  line-height: 1.1;
  font-weight: 800;
  color: var(--ac-text);
  letter-spacing: -0.04em;
}

.ac-profile-card__sub {
  margin-top: 8px;
  font-size: 13px;
  color: #7c879d;
  word-break: break-all;
}

.ac-profile-card__meta {
  margin-top: 10px;
  font-size: 12px;
  color: #a0aac1;
}

.ac-profile-card__tags {
  margin-top: 18px;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  padding-top: 16px;
  border-top: 1px solid rgba(224, 231, 255, 0.88);
  width: 100%;
}

.ac-profile-card__back,
.ac-profile-card__logout {
  position: absolute;
  top: 16px;
  width: 42px;
  height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border-radius: 14px;
  border: 1px solid rgba(224, 231, 255, 0.98);
  background: linear-gradient(180deg, #ffffff, #f5f7ff);
  color: #6675d8;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s ease;
  z-index: 1;

  &:hover {
    border-color: rgba(125, 146, 245, 0.3);
    color: #5969d6;
    box-shadow: 0 10px 24px rgba(125, 146, 245, 0.16);
  }
}

.ac-profile-card__back {
  left: 16px;
}

.ac-profile-card__logout {
  right: 16px;
}

.ac-profile-card::after {
  content: '';
  position: absolute;
  inset: auto -36px -44px auto;
  width: 140px;
  height: 140px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(125, 146, 245, 0.12), transparent 68%);
  pointer-events: none;
}

.ac-side-actions-card .ac-info-card__body {
  padding: 22px 22px 24px;
}

.ac-side-actions-card {
  grid-area: actions;
  align-self: start;
  background: #ffffff;
}

.ac-side-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  padding-top: 16px;
  border-top: 1px solid rgba(233, 237, 246, 0.94);
}

.ac-side-action {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 72px;
  padding: 14px 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(229, 233, 242, 1);
  background: #ffffff;
  color: #58627b;
  cursor: pointer;
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.01em;
  box-shadow: none;
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease,
    background 0.2s ease;

  .el-icon {
    width: 24px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #727b91;
    background: transparent;
  }

  span {
    line-height: 1.25;
  }

  &:hover {
    transform: translateY(-1px);
    border-color: rgba(119, 136, 228, 0.34);
    color: #4d5fd0;
    background: #fbfcff;

    .el-icon {
      color: #5b69d6;
    }
  }
}

.ac-side-action--primary {
  background: #ffffff;
  border-color: rgba(229, 233, 242, 1);
  color: #58627b;
}

.ac-side-action--accent {
  background: #ffffff;
  border-color: rgba(229, 233, 242, 1);
  color: #58627b;
}

.ac-lower-grid {
  display: contents;
}

.ac-account-info-card .ac-info-card__body {
  padding: 22px 22px 24px;
}

.ac-account-info-card {
  grid-area: account;
  position: relative;
  overflow: hidden;
  align-self: start;
  background: #ffffff;
}

.ac-account-info-card::before,
.ac-history-card::before {
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: 1px;
  background: linear-gradient(90deg, rgba(111, 155, 148, 0), rgba(111, 155, 148, 0.24), rgba(111, 155, 148, 0));
  pointer-events: none;
}

.ac-account-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid rgba(233, 237, 246, 0.94);
}

.ac-account-metric {
  position: relative;
  min-width: 0;
  min-height: 94px;
  padding: 16px 16px 15px;
  border-radius: 12px;
  background: linear-gradient(180deg, #ffffff, #fbfcff);
  border: 1px solid rgba(229, 233, 242, 1);
  box-shadow: none;
  transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
}

.ac-account-metric:hover {
  transform: translateY(-1px);
  border-color: rgba(119, 136, 228, 0.28);
  background: #fcfdff;
}

.ac-account-metric__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.ac-account-metric__label {
  font-size: 12px;
  font-weight: 600;
  color: #8a93a9;
}

.ac-account-metric__tag {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 0 9px;
  border-radius: 999px;
  background: rgba(103, 122, 224, 0.1);
  color: #6677d6;
  font-size: 10px;
  font-weight: 700;
}

.ac-account-metric__value {
  margin-top: 16px;
  font-size: 18px;
  font-weight: 800;
  color: var(--ac-text);
  line-height: 1.3;
  word-break: break-word;
}

.ac-account-metric__value--success {
  color: var(--ac-success);
}

.ac-history-card .ac-info-card__body {
  padding-top: 12px;
}

.ac-history-card {
  grid-area: recent;
  width: 100%;
  position: relative;
}

.ac-profile-summary {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 10px;
  padding: 14px;
  border-radius: 20px;
  background:
    linear-gradient(135deg, rgba(239, 246, 255, 0.9), rgba(255, 255, 255, 0.98)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0.92));
  border: 1px solid rgba(191, 219, 254, 0.7);
}

.ac-profile-summary__avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: linear-gradient(135deg, #dbeafe, #c4b5fd 60%, #fbcfe8);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #3157d5;
  font-size: 24px;
  font-weight: 700;
  overflow: hidden;
  flex-shrink: 0;
  box-shadow:
    0 12px 26px rgba(99, 102, 241, 0.18),
    inset 0 0 0 4px rgba(255, 255, 255, 0.75);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.ac-profile-summary__meta {
  min-width: 0;
}

.ac-profile-summary__name {
  font-size: 26px;
  font-weight: 700;
  color: var(--ac-text);
  line-height: 1.2;
  letter-spacing: -0.03em;
}

.ac-profile-summary__sub {
  margin-top: 6px;
  font-size: 13px;
  color: var(--ac-text-3);
  word-break: break-all;
}

.ac-profile-summary__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.ac-soft-tag {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(111, 155, 148, 0.12);
  color: #52746e;
  font-size: 12px;
  font-weight: 600;
}

.ac-soft-tag--green {
  background: var(--ac-success-light);
  color: var(--ac-success);
}

.ac-info-card.ac-balance-card {
  grid-area: balance;
  position: relative;
  background:
    radial-gradient(circle at top right, rgba(255, 255, 255, 0.18), transparent 26%),
    linear-gradient(135deg, #6677f0 0%, #5b67d3 45%, #7b52c4 100%);
  border: 1px solid rgba(108, 122, 225, 0.46);
  overflow: hidden;
  box-shadow:
    0 22px 40px rgba(89, 98, 201, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.16);
}

.ac-info-card.ac-balance-card.is-empty {
  background:
    radial-gradient(circle at top right, rgba(255, 255, 255, 0.16), transparent 26%),
    linear-gradient(135deg, #7182f2 0%, #606dcf 45%, #7358bc 100%);
}

.ac-info-card.ac-balance-card.ac-balance-card--wide .ac-info-card__body {
  padding: 10px 22px 22px;
}

.ac-info-card.ac-balance-card::after {
  content: '';
  position: absolute;
  right: -26px;
  bottom: -26px;
  width: 140px;
  height: 140px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.16), transparent 68%);
  pointer-events: none;
}

.ac-balance-card__badge {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 13px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 12px;
  backdrop-filter: blur(8px);
}

.ac-balance-card__badge.is-empty {
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
}

.ac-info-card.ac-balance-card .ac-info-card__title {
  color: #fff;
  text-shadow: none;
}

.ac-info-card.ac-balance-card .ac-info-card__head {
  border-bottom-color: rgba(255, 255, 255, 0.12);
  background: transparent;
  position: relative;
  z-index: 1;
}

.ac-info-card.ac-balance-card .ac-info-card__body {
  position: relative;
  z-index: 1;
  background: transparent;
}

.ac-balance-card__hero {
  display: flex;
  align-items: center;
  gap: 28px;
  min-height: 148px;
}

.ac-balance-card__ring {
  position: relative;
  width: 108px;
  height: 108px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
}

.ac-balance-card__ring.is-empty {
  opacity: 0.92;
}

.ac-balance-card__ring svg {
  transform: rotate(-90deg);
}

.ac-balance-card__ring-bg {
  fill: none;
  stroke: rgba(255, 255, 255, 0.18);
  stroke-width: 6;
}

.ac-balance-card__ring-fill {
  fill: none;
  stroke: #ffd86e;
  stroke-width: 6;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.8s ease;
  filter: drop-shadow(0 0 8px rgba(255, 216, 110, 0.24));
}

.ac-balance-card__ring-fill.is-empty {
  stroke: rgba(255, 255, 255, 0.8);
  filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.14));
}

.ac-balance-card__ring-center {
  position: absolute;
  inset: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #fff;
  text-align: center;
}

.ac-balance-card__ring-label {
  font-size: 22px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.04em;
  text-shadow: none;
}

.ac-balance-card__ring-label.is-empty {
  font-size: 16px;
  letter-spacing: 0;
  padding: 0 6px;
}

.ac-balance-card__ring-sub {
  margin-top: 6px;
  font-size: 10px;
  line-height: 1.2;
  opacity: 0.9;
  color: rgba(255, 255, 255, 0.76);
}

.ac-balance-card__summary {
  min-width: 0;
  flex: 1;
  padding: 4px 0 0;
  border-radius: 0;
  background: transparent;
  border: none;
  box-shadow: none;
  align-self: center;
}

.ac-balance-card__summary.is-empty .ac-balance-card__value {
  color: #fff;
}

.ac-balance-card__summary-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 4px;
}

.ac-balance-card__eyebrow,
.ac-balance-card__scale {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.ac-balance-card__eyebrow {
  color: #fff;
  background: rgba(255, 255, 255, 0.14);
}

.ac-balance-card__scale {
  color: rgba(255, 255, 255, 0.92);
  background: rgba(255, 216, 110, 0.22);
}

.ac-balance-card__value-line {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  margin-top: 8px;
}

.ac-balance-card__value {
  font-size: 58px;
  font-weight: 800;
  line-height: 1;
  color: #fff;
  letter-spacing: -0.05em;
  text-shadow: none;
}

.ac-balance-card__unit {
  padding-bottom: 10px;
  font-size: 14px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.86);
}

.ac-balance-card__desc {
  margin-top: 8px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.92);
  text-shadow: none;
}

.ac-balance-card__hint {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.72);
}

.ac-balance-card__summary.is-empty .ac-balance-card__hint {
  color: rgba(255, 255, 255, 0.72);
}

.ac-balance-card__actions {
  display: flex;
  gap: 10px;
  margin-top: 14px;
  flex-wrap: wrap;
}

.ac-info-card.ac-balance-card .ac-btn {
  min-width: 108px;
  min-height: 38px;
  border-radius: 12px;
  font-size: 13px;
}

.ac-info-card.ac-balance-card .ac-btn--outline {
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
  border-color: rgba(255, 255, 255, 0.22);

  &:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.34);
    color: #fff;
  }
}

.ac-info-card.ac-balance-card .ac-btn--primary {
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.26);

  &:hover {
    background: rgba(255, 255, 255, 0.26);
    color: #fff;
    box-shadow: 0 12px 26px rgba(27, 34, 102, 0.16);
  }
}

.ac-stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-bottom: 14px;
}

.ac-stat-card {
  border-radius: var(--ac-radius);
  padding: 16px;
  position: relative;
  overflow: hidden;
  color: #fff;
  min-height: 148px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  text-align: left;
}

.ac-stat-card__tags {
  position: absolute;
  top: 14px;
  right: 14px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
  max-width: 55%;
}

.ac-stat-tag {
  padding: 3px 8px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 500;
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(4px);
}

.ac-stat-tag--orange {
  background: rgba(255, 149, 0, 0.9);
}

.ac-stat-tag--green {
  background: rgba(82, 196, 26, 0.9);
}

.ac-stat-tag--glass {
  background: rgba(255, 255, 255, 0.25);
}

.ac-stat-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ac-stat-card__title {
  font-size: 13px;
  font-weight: 500;
  opacity: 0.9;
}

.ac-stat-card__ico {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
}

.ac-stat-card__body {
  display: flex;
  align-items: center;
  gap: 14px;
}

.ac-stat-card__body--push {
  margin-top: auto;
}

.ac-stat-card--quota {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.ac-stat-card--upload {
  background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
}

.ac-stat-card--expiry {
  background: linear-gradient(135deg, #ff6b6b 0%, #feca57 100%);
}

.ac-ring-wrap {
  position: relative;
  width: 72px;
  height: 72px;
  flex-shrink: 0;
}

.ac-ring-wrap svg {
  transform: rotate(-90deg);
}

.ac-ring-bg {
  fill: none;
  stroke: rgba(255, 255, 255, 0.2);
  stroke-width: 6;
}

.ac-ring-fill {
  fill: none;
  stroke-width: 6;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.8s ease;
}

.ac-ring-fill--orange {
  stroke: #ff9500;
}

.ac-ring-fill--light {
  stroke: rgba(255, 255, 255, 0.95);
}

.ac-ring-text {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.ac-ring-num {
  font-size: 18px;
  font-weight: 700;
  line-height: 1;
}

.ac-ring-num--sm {
  font-size: 12px;
  font-weight: 600;
}

.ac-ring-label {
  font-size: 10px;
  opacity: 0.75;
  margin-top: 2px;
}

.ac-stat-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ac-stat-big {
  font-size: 28px;
  font-weight: 700;
  line-height: 1;
}

.ac-stat-desc {
  font-size: 11px;
  opacity: 0.75;
}

.ac-stat-card__btn {
  align-self: flex-start;
  margin-top: 10px;
  padding: 5px 12px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 14px;
  font-size: 11px;
  font-weight: 500;
  color: #fff;
  border: none;
  cursor: pointer;
  backdrop-filter: blur(4px);
  font-family: inherit;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.35);
  }
}

.ac-expiry-block {
  display: flex;
  flex-direction: column;
}

.ac-expiry-label {
  font-size: 12px;
  opacity: 0.8;
  margin-bottom: 4px;
}

.ac-expiry-days {
  font-size: 36px;
  font-weight: 700;
  line-height: 1;
}

.ac-expiry-unit {
  font-size: 14px;
  font-weight: 400;
  opacity: 0.85;
}

/* ========== 信息行 ========== */
.ac-info-row {
  display: grid;
  grid-template-columns: 1fr 1.4fr;
  gap: 16px;
}

.ac-info-card {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(251, 252, 255, 0.96));
  border-radius: 22px;
  border: 1px solid rgba(228, 233, 245, 0.92);
  box-shadow:
    0 16px 34px rgba(65, 81, 138, 0.07),
    0 4px 12px rgba(15, 23, 42, 0.03);
  overflow: hidden;
}

.ac-info-card--wide {
  min-width: 0;
}

.ac-recent-card {
  margin-top: 0;
}

.ac-info-card__head {
  padding: 18px 22px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(232, 236, 246, 0.92);
  background: #ffffff;
}

.ac-info-card__title {
  font-size: 16px;
  font-weight: 800;
  color: var(--ac-text);
  display: flex;
  align-items: center;
  gap: 8px;
  letter-spacing: -0.01em;

  .el-icon {
    color: #3f4a60;
  }
}

.ac-info-link {
  font-size: 12px;
  color: var(--ac-primary);
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  transition: color 0.2s;

  &:hover {
    color: var(--ac-primary-light);
  }
}

.ac-info-card__body {
  padding: 16px 18px 18px;
}

.ac-info-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px dashed rgba(226, 232, 240, 0.9);
}

.ac-info-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.ac-info-item__left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ac-info-item__ico {
  width: 32px;
  height: 32px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, #f8fafc, #eef2ff);
  color: #5b6b93;
}

.ac-info-item__label {
  font-size: 13px;
  color: var(--ac-text-2);
}

.ac-info-item__right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ac-info-item__val {
  font-size: 13px;
  color: var(--ac-text-3);
}

.ac-progress-wrap {
  padding: 0 0 4px;
}

.ac-progress-bar {
  width: 100%;
  height: 6px;
  background: var(--ac-border-light);
  border-radius: 3px;
  overflow: hidden;
}

.ac-progress-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.8s ease;
}

.ac-progress-fill--green {
  background: var(--ac-success);
}

.ac-progress-fill--gray {
  background: var(--ac-border);
}

/* 权限列表 */
.ac-perm-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ac-perm-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-radius: var(--ac-radius-sm);
  transition: background 0.2s;

  &:hover {
    background: var(--ac-border-light);
  }
}

.ac-perm-item__left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ac-perm-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;

  &.is-on {
    background: var(--ac-success);
  }

  &.is-off {
    background: var(--ac-border);
  }
}

.ac-perm-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--ac-text);
}

.ac-perm-status {
  font-size: 11px;
  color: var(--ac-text-3);
  margin-top: 1px;

  &.is-on {
    color: var(--ac-success);
  }
}

.ac-toggle {
  position: relative;
  width: 40px;
  height: 22px;
  flex-shrink: 0;
  cursor: pointer;

  input {
    opacity: 0;
    width: 0;
    height: 0;
    position: absolute;
  }
}

.ac-toggle-slider {
  position: absolute;
  inset: 0;
  background: #d1d5db;
  border-radius: 11px;
  transition: 0.2s;

  &::before {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 18px;
    height: 18px;
    background: #fff;
    border-radius: 50%;
    transition: 0.2s;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
  }
}

.ac-toggle input:checked + .ac-toggle-slider {
  background: var(--ac-success);
}

.ac-toggle input:checked + .ac-toggle-slider::before {
  transform: translateX(18px);
}

.ac-toggle input:disabled + .ac-toggle-slider {
  opacity: 0.55;
  cursor: not-allowed;
}

/* 快捷入口 */
.ac-quick-entries {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.ac-quick-entry {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 104px;
  padding: 16px 12px;
  border-radius: 18px;
  border: 1px solid rgba(226, 232, 240, 0.9);
  background:
    radial-gradient(circle at top, rgba(255, 255, 255, 0.9), transparent 55%),
    linear-gradient(180deg, #ffffff, #f8fbff);
  font-size: 13px;
  color: #475569;
  cursor: pointer;
  font-family: inherit;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, color 0.2s ease;

  &:hover {
    border-color: var(--ac-primary);
    color: var(--ac-primary);
    transform: translateY(-3px);
    box-shadow:
      0 16px 34px rgba(37, 99, 235, 0.12),
      inset 0 1px 0 rgba(255, 255, 255, 0.8);
  }
}

.ac-quick-entry--green:hover {
  border-color: var(--ac-success);
  color: var(--ac-success);
}

.ac-quick-entry__icon {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, #eef4ff, #f8fafc);
  color: inherit;
  box-shadow: inset 0 0 0 1px rgba(191, 219, 254, 0.65);
}

.ac-quick-entry__label {
  font-size: 13px;
  font-weight: 700;
  line-height: 1.3;
  text-align: center;
}

/* 最近记录 */
.ac-activity {
  list-style: none;
  margin: 0;
  padding: 0;
  position: relative;
}

.ac-activity__item {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 13px 14px;
  border: 1px solid rgba(232, 236, 246, 0.96);
  border-radius: 16px;
  background:
    radial-gradient(circle at top right, rgba(255, 255, 255, 0.88), transparent 40%),
    linear-gradient(180deg, #ffffff, #fafbff);
  box-shadow: 0 10px 22px rgba(65, 81, 138, 0.045);
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;

  &:last-child {
    border-bottom: none;
  }

  & + .ac-activity__item {
    margin-top: 10px;
  }

  &:hover {
    transform: translateY(-1px);
    border-color: rgba(125, 146, 245, 0.24);
    box-shadow: 0 14px 28px rgba(125, 146, 245, 0.1);
  }
}

.ac-activity__dot {
  position: relative;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  background: #9ab8b2;
  margin-top: 7px;
  box-shadow: 0 0 0 6px rgba(154, 184, 178, 0.14);

  &.is-download {
    background: #6f9b94;
    box-shadow: 0 0 0 6px rgba(111, 155, 148, 0.14);
  }

  &.is-export {
    background: var(--ac-violet);
    box-shadow: 0 0 0 6px var(--ac-violet-light);
  }

  &.is-edit {
    background: var(--ac-success);
    box-shadow: 0 0 0 6px var(--ac-success-light);
  }
}

.ac-activity__content {
  flex: 1;
  min-width: 0;
}

.ac-activity__row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.ac-activity__title {
  font-size: 13px;
  font-weight: 700;
  color: var(--ac-text);
  line-height: 1.35;
}

.ac-activity__amount {
  flex-shrink: 0;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;

  &.is-minus {
    color: var(--ac-warning);
    background: rgba(255, 237, 213, 0.96);
  }

  &.is-plus {
    color: var(--ac-success);
    background: rgba(220, 252, 231, 0.96);
  }
}

.ac-activity__meta {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 5px;
}

.ac-empty {
  text-align: center;
  padding: 20px;
  color: var(--ac-text-3);
  font-size: 13px;
  margin: 0;
}

/* 登录卡片 */
.ac-login-card {
  max-width: 420px;
  width: 100%;
  background: var(--ac-card);
  border-radius: var(--ac-radius);
  border: 1px solid var(--ac-border-light);
  box-shadow: var(--ac-shadow-md);
  padding: 36px 28px;
  text-align: center;
}

.ac-login-card__icon {
  width: 80px;
  height: 80px;
  margin: 0 auto 18px;
  border-radius: var(--ac-radius);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ac-primary);
  background: var(--ac-primary-50);
  border: 1px solid var(--ac-border-light);
}

.ac-login-card h2 {
  margin: 0;
  font-size: 22px;
}

.ac-login-card p {
  margin: 10px 0 22px;
  color: var(--ac-text-2);
  font-size: 15px;
  line-height: 1.6;
}

@media (max-width: 1100px) {
  .ac-dashboard {
    grid-template-columns: 1fr;
  }

  .ac-dashboard__middle {
    grid-template-columns: 1fr;
  }

  .ac-dashboard__sidebar {
    order: 2;
  }

  .ac-hero-card__content {
    flex-direction: column;
    align-items: flex-start;
  }

  .ac-hero-card__art {
    align-self: flex-end;
  }

  .ac-account-layout {
    grid-template-columns: 1fr;
    grid-template-areas:
      'profile'
      'balance'
      'account'
      'actions'
      'recent';
  }

  .ac-account-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .ac-hero-card {
    padding: 24px 24px 22px;
    min-height: unset;
  }

  .ac-hero-card__header {
    flex-direction: column;
    align-items: flex-start;
  }

  .ac-hero-status {
    padding-top: 0;
  }

  .ac-hero-balance {
    flex-direction: column;
    align-items: flex-start;
  }

  .ac-record-list__title-row {
    flex-direction: column;
  }

  .ac-record-list__amount {
    align-self: flex-start;
  }

  .ac-account-layout {
    gap: 14px;
  }

  .ac-balance-card__actions {
    flex-direction: column;
  }

  .ac-balance-card__hero {
    flex-direction: column;
    align-items: flex-start;
    min-height: unset;
    gap: 18px;
  }

  .ac-balance-card__summary {
    width: 100%;
    padding: 12px 14px;
  }

  .ac-activity__row {
    flex-direction: column;
    gap: 6px;
  }

  .ac-activity__amount {
    align-self: flex-start;
  }
}

@media (max-width: 768px) {
  .ac-dashboard {
    gap: 16px;
  }

  .ac-content {
    padding: 10px 14px 26px;
  }

  .ac-sidebar-card--profile {
    padding: 14px 12px 16px;
  }

  .ac-sidebar-card--nav {
    padding: 12px 10px;
  }

  .ac-sidebar-nav-item {
    min-height: 48px;
    font-size: 15px;
  }

  .ac-hero-card__title {
    font-size: 28px;
  }

  .ac-hero-balance__value {
    font-size: 48px;
  }

  .ac-hero-balance__unit {
    font-size: 20px;
  }

  .ac-action-grid,
  .ac-account-grid {
    grid-template-columns: 1fr;
  }

  .ac-panel-card__head,
  .ac-panel-card__body {
    padding-left: 16px;
    padding-right: 16px;
  }

  .ac-record-list__item {
    padding: 16px;
  }

  .ac-hero-card__art {
    width: 220px;
    height: 160px;
  }

  .ac-page {
    max-width: 100%;
    overflow-x: hidden;
  }

  .ac-main-wrap {
    max-width: 100%;
    overflow-x: hidden;
  }

  .ac-content {
    padding: 10px 16px 28px;
  }

  .ac-account-metrics {
    grid-template-columns: 1fr;
  }

  .ac-profile-card__body {
    padding: 18px 16px 16px;
  }

  .ac-profile-card__avatar {
    width: 88px;
    height: 88px;
    font-size: 34px;
  }

  .ac-profile-card__name {
    font-size: 22px;
  }

  .ac-profile-summary {
    align-items: flex-start;
  }

  .ac-content {
    padding: 8px 14px 24px;
    overflow-x: hidden;
  }

  .ac-info-card__head {
    padding: 14px 14px;
    gap: 8px;
  }

  .ac-info-card__body {
    padding: 14px;
  }

  .ac-balance-card__summary-top {
    flex-wrap: wrap;
  }

  .ac-balance-card__value {
    font-size: 44px;
  }

  .ac-balance-card__value-line {
    gap: 8px;
  }

  .ac-balance-card__ring {
    width: 96px;
    height: 96px;
  }

  .ac-side-actions {
    grid-template-columns: 1fr;
  }

  .ac-side-action {
    min-height: 84px;
    flex-direction: row;
    justify-content: flex-start;
  }
}

@media (max-width: 480px) {
  .ac-hero-status {
    width: 100%;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .ac-hero-balance__actions {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
  }

  .ac-hero-btn {
    width: 100%;
  }

  .ac-hero-card__art {
    display: none;
  }

  .ac-sidebar-status-row {
    flex-direction: column;
  }

  .ac-profile-summary__avatar {
    width: 56px;
    height: 56px;
    font-size: 20px;
  }

  .ac-profile-summary__name {
    font-size: 18px;
  }

  .ac-balance-card__value {
    font-size: 36px;
  }

  .ac-account-metrics {
    grid-template-columns: 1fr;
  }
}

:global(.ac-pay-overlay) {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.56);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 4200;
}

.ac-pay-dialog {
  position: relative;
  width: min(92vw, 380px);
  background: #fff;
  border-radius: 18px;
  padding: 28px 24px 22px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  text-align: center;
}

.ac-pay-dialog--alipay {
  width: min(92vw, 380px);
}

.ac-pay-dialog__close {
  position: absolute;
  top: 10px;
  right: 12px;
  border: 0;
  background: transparent;
  font-size: 28px;
  line-height: 1;
  color: #94a3b8;
  cursor: pointer;
}

.ac-pay-dialog__title {
  font-size: 24px;
  font-weight: 700;
  color: #0f172a;
}

.ac-pay-dialog__desc {
  margin-top: 10px;
  color: #64748b;
  font-size: 14px;
  line-height: 1.6;
}

.ac-pay-dialog__qr-wrap {
  margin: 20px auto 16px;
  width: 236px;
  height: 236px;
  padding: 14px;
  border-radius: 18px;
  background: linear-gradient(180deg, #f8fafc, #eef2ff);
  display: flex;
  align-items: center;
  justify-content: center;
}

.ac-pay-dialog__qr {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 12px;
  background: #fff;
}

.ac-pay-dialog__meta {
  display: flex;
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
  font-size: 14px;
  color: #334155;
}

.ac-pay-dialog__btn {
  margin-top: 18px;
  width: 100%;
  border: 0;
  border-radius: 12px;
  background: linear-gradient(135deg, #16a34a, #22c55e);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  padding: 12px 16px;
  cursor: pointer;
}

.ac-pay-dialog__btn--blue {
  background: linear-gradient(135deg, #1677ff, #4096ff);
}

.ac-pay-dialog__qr-wrap--alipay {
  position: relative;
  overflow: hidden;
  background: linear-gradient(180deg, #f8fafc, #eef2ff);
}

.ac-pay-iframe__loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(248, 250, 252, 0.96);
  color: #475569;
  font-size: 15px;
  z-index: 1;
}

:global(.ac-top-message) {
  z-index: 5000 !important;
}
</style>
