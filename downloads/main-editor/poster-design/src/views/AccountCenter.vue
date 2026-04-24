<template>
  <!-- 未登录：单栏居中 -->
  <div v-if="!userStore.online" class="ac-page ac-page--guest">
    <div class="ac-guest-body">
      <section class="ac-login-card">
        <div class="ac-login-card__icon">
          <el-icon :size="48"><User /></el-icon>
        </div>
        <h2>登录后解锁完整能力</h2>
        <p>登录后将展示会员、额度与最近记录。</p>
        <button type="button" class="ac-sidebar-upgrade" @click="go('/login')">
          <el-icon :size="14"><Right /></el-icon>
          立即登录
        </button>
      </section>
    </div>
  </div>

  <!-- 已登录：侧栏 + 主区（对齐 account-center-optimized.html） -->
  <div v-else class="ac-page">
    <aside class="ac-sidebar" aria-label="账户导航">
      <router-link to="/welcome" class="ac-sidebar-logo">鲲穹海报</router-link>
      <div class="ac-sidebar-avatar" :title="displayUser.name || '用户'">
        <img v-if="displayUser.avatar" :src="displayUser.avatar" alt="" />
        <span v-else>{{ userInitial }}</span>
      </div>
      <div class="ac-sidebar-username">{{ displayUser.name || '用户' }}</div>
      <button type="button" class="ac-sidebar-upgrade" @click="openRechargeCenter">
        <el-icon :size="14"><Star /></el-icon>
        充值鲲币
      </button>
      <div class="ac-sidebar-kunbi">
        <span class="ac-sidebar-kunbi__label">鲲币余额</span>
        <span class="ac-sidebar-kunbi__value">{{ kunbiBalance }}</span>
      </div>
    </aside>

    <div class="ac-main-wrap">
      <div class="ac-page-header">
        <div class="ac-page-header__left">
          <h1>账户与权益</h1>
          <p>额度、权限与最近操作一览</p>
        </div>
        <div class="ac-page-header__right">
          <div class="ac-pills">
            <span class="ac-pill ac-pill--blue">鲲币 {{ kunbiBalance }}</span>
            <span class="ac-pill ac-pill--gray">等级 {{ vipLevelText }}</span>
            <span class="ac-pill ac-pill--green">{{ sessionStatusText }}</span>
          </div>
          <div class="ac-header-btns">
            <button type="button" class="ac-btn ac-btn--primary" @click="go('/home?tempid=303')">
              <el-icon :size="15"><EditPen /></el-icon>
              进入编辑器
            </button>
            <button type="button" class="ac-btn ac-btn--outline" @click="logout">
              <el-icon :size="15"><SwitchButton /></el-icon>
              退出
            </button>
          </div>
        </div>
      </div>

      <main class="ac-content">
        <div id="ac-section-stats" class="ac-stats-row">
          <!-- 今日额度（会员不展示配额数字） -->
          <div class="ac-stat-card ac-stat-card--quota">
            <div class="ac-stat-card__tags">
              <span class="ac-stat-tag ac-stat-tag--orange">{{ vipBadgeText }}</span>
              <span v-if="!isVipUser" class="ac-stat-tag ac-stat-tag--green">{{ quotaSubTag }}</span>
            </div>
            <div class="ac-stat-card__head">
              <span class="ac-stat-card__title">{{ isVipUser ? '会员权益' : '今日额度' }}</span>
            </div>
            <div class="ac-stat-card__body">
              <template v-if="!isVipUser">
                <div class="ac-ring-wrap">
                  <svg width="80" height="80" viewBox="0 0 80 80" aria-hidden="true">
                    <circle class="ac-ring-bg" cx="40" cy="40" :r="ringR" />
                    <circle
                      class="ac-ring-fill ac-ring-fill--orange"
                      cx="40"
                      cy="40"
                      :r="ringR"
                      :stroke-dasharray="String(ringC)"
                      :stroke-dashoffset="String(downloadRingOffset)"
                    />
                  </svg>
                  <div class="ac-ring-text">
                    <span class="ac-ring-num">{{ quotaRingCenter }}</span>
                    <span class="ac-ring-label">已使用</span>
                  </div>
                </div>
                <div class="ac-stat-info">
                  <div class="ac-stat-big">{{ downloadsUsedText }}</div>
                  <div class="ac-stat-desc">今日已用额度</div>
                </div>
              </template>
              <template v-else>
                <div class="ac-stat-info">
                  <div class="ac-stat-big">无限制</div>
                  <div class="ac-stat-desc">会员账号不显示配额</div>
                </div>
              </template>
            </div>
            <button type="button" class="ac-stat-card__btn" @click="go('/home?tempid=303')">使用</button>
          </div>

          <!-- AI额度限制 -->
          <div class="ac-stat-card ac-stat-card--upload">
            <div class="ac-stat-card__tags">
              <span class="ac-stat-tag ac-stat-tag--orange">{{ vipBadgeText }}</span>
              <span v-if="!isVipUser" class="ac-stat-tag ac-stat-tag--green">{{ quotaSubTag }}</span>
            </div>
            <div class="ac-stat-card__head">
              <span class="ac-stat-card__title">AI额度限制</span>
              <div class="ac-stat-card__ico">
                <el-icon :size="18"><MagicStick /></el-icon>
              </div>
            </div>
            <div class="ac-stat-card__body">
              <template v-if="!isVipUser">
                <div class="ac-ring-wrap">
                  <svg width="80" height="80" viewBox="0 0 80 80" aria-hidden="true">
                    <circle class="ac-ring-bg" cx="40" cy="40" :r="ringR" />
                    <circle
                      class="ac-ring-fill ac-ring-fill--light"
                      cx="40"
                      cy="40"
                      :r="ringR"
                      :stroke-dasharray="String(ringC)"
                      :stroke-dashoffset="String(downloadRingOffset)"
                    />
                  </svg>
                  <div class="ac-ring-text">
                    <span class="ac-ring-num">{{ quotaRingCenter }}</span>
                    <span class="ac-ring-label">已使用</span>
                  </div>
                </div>
                <div class="ac-stat-info">
                  <div class="ac-stat-big">{{ downloadsUsedText }}</div>
                  <div class="ac-stat-desc">今日 AI 额度</div>
                </div>
              </template>
              <template v-else>
                <div class="ac-stat-info">
                  <div class="ac-stat-big">无限制</div>
                  <div class="ac-stat-desc">会员账号不显示配额</div>
                </div>
              </template>
            </div>
            <button type="button" class="ac-stat-card__btn" @click="go('/home')">去使用</button>
          </div>

          <!-- 会员有效期 -->
          <div class="ac-stat-card ac-stat-card--expiry">
            <div class="ac-stat-card__head">
              <span class="ac-stat-card__title">{{ vipExpireCardTitle }}</span>
              <span v-if="effectivePermissions.is_vip && vipDaysLeft != null" class="ac-stat-tag ac-stat-tag--glass">
                {{ vipDaysLeftTag }}
              </span>
            </div>
            <div class="ac-stat-card__body">
              <div class="ac-ring-wrap">
                <svg width="80" height="80" viewBox="0 0 80 80" aria-hidden="true">
                  <circle class="ac-ring-bg" cx="40" cy="40" :r="ringR" />
                  <circle
                    class="ac-ring-fill ac-ring-fill--light"
                    cx="40"
                    cy="40"
                    :r="ringR"
                    :stroke-dasharray="String(ringC)"
                    :stroke-dashoffset="String(expiryRingOffset)"
                  />
                </svg>
                <div class="ac-ring-text">
                  <span class="ac-ring-num ac-ring-num--sm">{{ expiryRingLabel }}</span>
                </div>
              </div>
              <div class="ac-expiry-block">
                <div class="ac-expiry-label">会员到期时间</div>
                <div class="ac-expiry-days">
                  {{ vipDaysLeftDisplay }}<span v-if="vipDaysLeftUnit" class="ac-expiry-unit">{{ vipDaysLeftUnit }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div id="ac-section-info" class="ac-info-row">
          <div class="ac-info-card">
            <div class="ac-info-card__head">
              <div class="ac-info-card__title">
                <el-icon :size="18"><UserFilled /></el-icon>
                基本信息
              </div>
              <button type="button" class="ac-info-link" @click="toastInfo('账号绑定以统一登录中心为准')">
                管理
                <el-icon :size="14"><ArrowRight /></el-icon>
              </button>
            </div>
            <div class="ac-info-card__body">
              <div class="ac-info-item">
                <div class="ac-info-item__left">
                  <div class="ac-info-item__ico">
                    <el-icon :size="16"><Document /></el-icon>
                  </div>
                  <span class="ac-info-item__label">模板管理</span>
                </div>
                <div class="ac-info-item__right">
                  <span class="ac-info-item__val">{{ templateManageSummary }}</span>
                </div>
              </div>
              <div class="ac-progress-wrap">
                <div class="ac-progress-bar">
                  <div
                    class="ac-progress-fill"
                    :class="effectivePermissions.allow_template_manage ? 'ac-progress-fill--green' : 'ac-progress-fill--gray'"
                    :style="{ width: `${templateProgressPct}%` }"
                  />
                </div>
              </div>
            </div>
          </div>

          <div class="ac-info-card ac-info-card--wide">
            <div class="ac-info-card__head">
              <div class="ac-info-card__title">
                <el-icon :size="18"><Lock /></el-icon>
                功能权限
              </div>
              <button type="button" class="ac-info-link" @click="scrollToId('ac-section-quick')">
                常用入口
                <el-icon :size="14"><ArrowRight /></el-icon>
              </button>
            </div>
            <div class="ac-info-card__body">
              <div class="ac-perm-list">
                <div v-for="row in permissionRows" :key="row.key" class="ac-perm-item">
                  <div class="ac-perm-item__left">
                    <div :class="['ac-perm-dot', row.on ? 'is-on' : 'is-off']" />
                    <div>
                      <div class="ac-perm-name">{{ row.label }}</div>
                      <div :class="['ac-perm-status', { 'is-on': row.on }]">{{ row.desc }}</div>
                    </div>
                  </div>
                  <label
                    class="ac-toggle"
                    :title="row.on ? '由后台配置' : '由后台配置'"
                    @click.prevent="toastInfo('权限由管理员在后台配置，此处仅展示状态')"
                  >
                    <input type="checkbox" :checked="row.on" disabled />
                    <span class="ac-toggle-slider" />
                  </label>
                </div>
              </div>
              <div id="ac-section-quick" class="ac-quick-entries">
                <button
                  v-for="action in quickActions.slice(0, 3)"
                  :key="action.path"
                  type="button"
                  :class="['ac-quick-entry', quickToneClass(action.path)]"
                  @click="openPath(action.path)"
                >
                  <el-icon :size="20"><component :is="quickActionIcon(action.path)" /></el-icon>
                  {{ action.label }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div id="ac-section-recent" class="ac-info-card ac-recent-card">
          <div class="ac-info-card__head">
            <div class="ac-info-card__title">
              <el-icon :size="18"><Clock /></el-icon>
              最近记录
            </div>
          </div>
          <div class="ac-info-card__body">
            <ul v-if="recentRecords.length" class="ac-activity">
              <li v-for="(item, index) in recentRecords" :key="index" class="ac-activity__item">
                <span :class="['ac-activity__dot', activityDotClass(item)]" />
                <div class="ac-activity__content">
                  <div class="ac-activity__title">{{ normalizeRecordText(item) }}</div>
                  <div class="ac-activity__meta">最近同步</div>
                </div>
              </li>
            </ul>
            <p v-else class="ac-empty">当前没有最近记录</p>
          </div>
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

const recentRecords = computed(() => center.value?.recent_records?.slice(0, 5) || [])

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

function quickActionIcon(path: string): Component {
  const p = String(path || '')
  if (p.includes('ai-poster')) return MagicStick
  if (p.includes('psd')) return PictureFilled
  if (p.includes('tempid')) return EditPen
  if (p === '/home' || p.startsWith('/home')) return House
  return Promotion
}

function quickToneClass(path: string): string {
  const p = String(path || '')
  if (p.includes('ai-poster')) return ''
  if (p.includes('tempid') || p.includes('home')) return 'ac-quick-entry--green'
  return ''
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
  if (typeof record === 'string') return record
  if (record?.title) return String(record.title)
  if (record?.name) return String(record.name)
  if (record?.id) return `记录 #${record.id}`
  return '已同步一条新记录'
}

function resolvePath(path: string) {
  const raw = String(path || '')
  if (!raw) return '/home'
  if (raw === '/ai-poster') return '/home'
  if (raw.startsWith('/ai-poster?')) return `/home${raw.slice('/ai-poster'.length)}`
  return raw
}

function go(path: string) {
  router.push(resolvePath(path))
}

function openPath(path: string) {
  const target = resolvePath(path)
  if (/^https?:\/\//.test(target)) {
    window.location.assign(target)
    return
  }
  router.push(target)
}

function toastInfo(msg: string) {
  ElMessage({
    message: msg,
    type: 'info',
    customClass: 'ac-top-message',
    offset: 24,
    grouping: true,
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
    rechargeHistory.value = Array.isArray(rechargeData?.list) ? rechargeData.list : []
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
        await Promise.all([loadRechargeInfo(), loadCenter(), loadRechargeHistory()])
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
      grouping: true,
    })
    await startRechargePolling(data.order_sn)
  } catch (error: any) {
    ElMessage({
      message: error?.message || '创建充值订单失败',
      type: 'error',
      customClass: 'ac-top-message',
      offset: 24,
      grouping: true,
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
  await Promise.all([loadCenter(), loadRechargeInfo()])
})

onBeforeUnmount(stopRechargePolling)
</script>

<style scoped lang="less">
/* 设计变量对齐 Desktop 参考稿 account-center-optimized.html */
.ac-page {
  --ac-primary: #5b5fc7;
  --ac-primary-light: #8b8fe8;
  --ac-primary-50: #f0f0fb;
  --ac-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --ac-gradient-btn: linear-gradient(90deg, #c084fc, #6366f1);
  --ac-success: #52c41a;
  --ac-success-light: #f6ffed;
  --ac-bg: #f0f2f5;
  --ac-card: #ffffff;
  --ac-text: #1f2937;
  --ac-text-2: #6b7280;
  --ac-text-3: #9ca3af;
  --ac-border: #e5e7eb;
  --ac-border-light: #f3f4f6;
  --ac-shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.06);
  --ac-shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08);
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
  background: linear-gradient(135deg, rgba(29, 78, 216, 0.1), rgba(15, 118, 110, 0.12));
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
  color: #0f766e;
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

/* ========== 页头 ========== */
.ac-page-header {
  padding: 24px 28px 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
}

.ac-page-header__left h1 {
  font-size: 24px;
  font-weight: 700;
  color: var(--ac-text);
  margin: 0 0 4px;
}

.ac-page-header__left p {
  font-size: 13px;
  color: var(--ac-text-3);
  margin: 0;
}

.ac-page-header__right {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
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
  gap: 8px;
  flex-wrap: wrap;
}

.ac-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 18px;
  border-radius: var(--ac-radius-sm);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  font-family: inherit;
  white-space: nowrap;
}

.ac-btn--primary {
  background: var(--ac-primary);
  color: #fff;

  &:hover {
    background: #4a4eb5;
    box-shadow: var(--ac-shadow-md);
  }
}

.ac-btn--outline {
  background: #fff;
  color: var(--ac-text-2);
  border: 1px solid var(--ac-border);

  &:hover {
    border-color: var(--ac-text-3);
    color: var(--ac-text);
  }
}

/* ========== 主内容 ========== */
.ac-content {
  padding: 20px 28px 40px;
  flex: 1;
}

.ac-stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

.ac-stat-card {
  border-radius: var(--ac-radius);
  padding: 20px;
  position: relative;
  overflow: hidden;
  color: #fff;
  min-height: 180px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  text-align: left;
}

.ac-stat-card__tags {
  position: absolute;
  top: 16px;
  right: 16px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
  max-width: 55%;
}

.ac-stat-tag {
  padding: 3px 10px;
  border-radius: 10px;
  font-size: 11px;
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
  font-size: 14px;
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
  gap: 20px;
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
  width: 80px;
  height: 80px;
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
  font-size: 20px;
  font-weight: 700;
  line-height: 1;
}

.ac-ring-num--sm {
  font-size: 13px;
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
  font-size: 36px;
  font-weight: 700;
  line-height: 1;
}

.ac-stat-desc {
  font-size: 12px;
  opacity: 0.75;
}

.ac-stat-card__btn {
  align-self: flex-start;
  padding: 6px 16px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 14px;
  font-size: 12px;
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
  background: var(--ac-card);
  border-radius: var(--ac-radius);
  border: 1px solid var(--ac-border-light);
  box-shadow: var(--ac-shadow-sm);
  overflow: hidden;
}

.ac-info-card--wide {
  min-width: 0;
}

.ac-recent-card {
  margin-top: 16px;
}

.ac-info-card__head {
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--ac-border-light);
}

.ac-info-card__title {
  font-size: 15px;
  font-weight: 600;
  color: var(--ac-text);
  display: flex;
  align-items: center;
  gap: 8px;
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
  padding: 16px 20px 20px;
}

.ac-info-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
}

.ac-info-item__left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ac-info-item__ico {
  width: 32px;
  height: 32px;
  border-radius: var(--ac-radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ac-border-light);
  color: var(--ac-text-3);
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
  display: flex;
  gap: 10px;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--ac-border-light);
  flex-wrap: wrap;
}

.ac-quick-entry {
  flex: 1;
  min-width: 96px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 14px 8px;
  border-radius: var(--ac-radius-sm);
  border: 1px solid var(--ac-border-light);
  background: #fff;
  font-size: 12px;
  color: var(--ac-text-2);
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--ac-primary);
    color: var(--ac-primary);
    transform: translateY(-1px);
    box-shadow: var(--ac-shadow-sm);
  }
}

.ac-quick-entry--green:hover {
  border-color: var(--ac-success);
  color: var(--ac-success);
}

/* 最近记录 */
.ac-activity {
  list-style: none;
  margin: 0;
  padding: 0;
}

.ac-activity__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--ac-border-light);

  &:last-child {
    border-bottom: none;
  }
}

.ac-activity__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--ac-text-3);

  &.is-download {
    background: #4a90e2;
  }

  &.is-export {
    background: #764ba2;
  }

  &.is-edit {
    background: var(--ac-success);
  }
}

.ac-activity__content {
  flex: 1;
  min-width: 0;
}

.ac-activity__title {
  font-size: 13px;
  font-weight: 500;
  color: var(--ac-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ac-activity__meta {
  font-size: 12px;
  color: var(--ac-text-3);
  margin-top: 2px;
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
  .ac-stats-row {
    grid-template-columns: 1fr;
  }

  .ac-info-row {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .ac-page:not(.ac-page--guest) {
    flex-direction: column;
  }

  .ac-sidebar {
    width: 100%;
    height: auto;
    min-height: unset;
    position: relative;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: center;
    padding: 20px 16px;
    gap: 12px;
    top: auto;

    .ac-sidebar-logo {
      width: 100%;
      text-align: center;
      margin-bottom: 8px;
    }

    .ac-sidebar-nav {
      width: 100%;
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: center;
      margin-top: 12px;
    }

    .ac-sidebar-upgrade {
      width: auto;
      padding: 10px 24px;
    }
  }

  .ac-quick-entries {
    flex-direction: column;
  }

  .ac-quick-entry {
    flex-direction: row;
    justify-content: center;
  }
}

@media (max-width: 768px) {
  .ac-page {
    max-width: 100%;
    overflow-x: hidden;
  }

  .ac-main-wrap {
    max-width: 100%;
    overflow-x: hidden;
  }

  .ac-sidebar {
    padding: 14px 12px;
    gap: 10px;

    .ac-sidebar-logo {
      margin-bottom: 4px;
      font-size: 16px;
    }

    .ac-sidebar-avatar {
      width: 56px;
      height: 56px;
      font-size: 20px;
      margin-bottom: 4px;
    }

    .ac-sidebar-username {
      font-size: 15px;
      margin-bottom: 8px;
    }

    .ac-sidebar-upgrade {
      width: 100%;
      padding: 9px 14px;
      border-radius: 14px;
    }

    .ac-sidebar-kunbi {
      margin-top: 2px;
    }

    .ac-sidebar-nav {
      margin-top: 4px;
      gap: 8px;

      a {
        padding: 8px 12px;
      }
    }
  }

  .ac-page-header {
    padding: 14px 14px 0;
    gap: 10px;
  }

  .ac-page-header__left h1 {
    font-size: 20px;
  }

  .ac-page-header__left p {
    font-size: 12px;
  }

  .ac-page-header__right,
  .ac-pills,
  .ac-header-btns {
    width: 100%;
  }

  .ac-header-btns {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .ac-btn {
    width: 100%;
    padding: 9px 10px;
  }

  .ac-content {
    padding: 14px 14px 24px;
    overflow-x: hidden;
  }

  .ac-stats-row,
  .ac-info-row {
    gap: 12px;
  }

  .ac-stat-card {
    min-height: 160px;
    padding: 16px;
  }

  .ac-stat-card__tags {
    position: static;
    max-width: none;
    justify-content: flex-start;
    margin-bottom: 8px;
  }

  .ac-stat-card__title {
    font-size: 13px;
  }

  .ac-ring-wrap {
    transform: scale(0.92);
    transform-origin: left top;
  }

  .ac-stat-big {
    font-size: 30px;
  }

  .ac-stat-desc {
    font-size: 12px;
  }

  .ac-info-card__head {
    padding: 14px 14px;
    gap: 8px;
  }

  .ac-info-card__body {
    padding: 14px;
  }

  .ac-quick-entries {
    gap: 8px;
  }
}

@media (max-width: 480px) {
  .ac-sidebar {
    .ac-sidebar-upgrade {
      font-size: 13px;
    }
  }

  .ac-header-btns {
    grid-template-columns: 1fr;
  }

  .ac-pill {
    font-size: 11px;
    padding: 3px 10px;
  }

  .ac-stat-card {
    min-height: 148px;
    padding: 14px;
  }

  .ac-stat-card__btn {
    width: 100%;
    justify-content: center;
  }

  .ac-ring-wrap {
    transform: scale(0.86);
  }

  .ac-stat-big {
    font-size: 26px;
  }

  .ac-info-item__label {
    font-size: 13px;
  }

  .ac-info-item__val {
    font-size: 12px;
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
