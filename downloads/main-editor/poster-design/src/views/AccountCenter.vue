<template>
  <div class="account-page">
    <div class="account-shell">
      <header class="topbar">
        <div>
          <h1>个人中心</h1>
          <p>管理账号信息、配额与功能权限</p>
        </div>
        <div class="topbar-actions">
          <el-button plain @click="router.push('/home?tempid=303')">返回编辑器</el-button>
          <el-button v-if="userStore.online" @click="logout">退出登录</el-button>
          <el-button v-else type="primary" @click="router.push('/login')">去登录</el-button>
        </div>
      </header>

      <section v-if="!userStore.online" class="empty-card">
        <h2>当前未登录</h2>
        <p>登录后可查看账号信息、会员权益、配额和功能权限。</p>
        <el-button type="primary" @click="router.push('/login')">去登录</el-button>
      </section>

      <main v-else class="layout">
        <aside class="side-panel">
          <div class="profile">
            <div class="avatar">
              <img v-if="displayUser.avatar" :src="displayUser.avatar" :alt="displayUser.name || 'avatar'">
              <span v-else>{{ userInitial }}</span>
            </div>
            <h2>{{ displayUser.name || '未设置昵称' }}</h2>
            <p>{{ emailText }}</p>
            <p class="muted">ID: {{ accountIdText }}</p>
          </div>

          <div class="status-stack">
            <div class="status-item">
              <span>账号类型</span>
              <strong>{{ vipBadgeText }}</strong>
            </div>
            <div class="status-item">
              <span>会员等级</span>
              <strong>{{ center?.vip_status.vip_level ?? userStore.permissions.vip_level ?? 0 }}</strong>
            </div>
            <div class="status-item">
              <span>会话状态</span>
              <strong>{{ center?.account_overview.session_status || '正常' }}</strong>
            </div>
          </div>

          <nav class="menu">
            <button class="menu-item active" type="button">账号信息</button>
            <button class="menu-item" type="button" @click="notifyPreparing">订单记录</button>
            <button class="menu-item" type="button" @click="notifyPreparing">积分记录</button>
          </nav>
        </aside>

        <section class="content">
          <div v-if="message" class="notice">{{ message }}</div>

          <section class="card metrics">
            <article class="metric">
              <span>每日次数</span>
              <strong>{{ center?.quota_card.daily_limit_count ?? userStore.permissions.daily_limit_count }}</strong>
              <em>今日可用</em>
            </article>
            <article class="metric">
              <span>最大文件</span>
              <strong>{{ prettyFileSize(center?.quota_card.max_file_size ?? userStore.permissions.max_file_size) }}</strong>
              <em>单次上传</em>
            </article>
            <article class="metric">
              <span>会话到期</span>
              <strong>{{ center?.account_overview.expired_at || '以系统为准' }}</strong>
              <em>登录安全</em>
            </article>
          </section>

          <section class="card">
            <h3>基础信息</h3>
            <div class="rows">
              <div class="row">
                <label>账号来源</label>
                <div>{{ displayUser.provider || '统一登录' }}</div>
              </div>
              <div class="row">
                <label>登录邮箱</label>
                <div>{{ emailText }}</div>
              </div>
              <div class="row">
                <label>会员到期</label>
                <div>{{ center?.vip_status.vip_expire_time || '未设置' }}</div>
              </div>
            </div>
          </section>

          <section class="card">
            <h3>功能权限</h3>
            <div class="chips">
              <span class="chip">{{ featureText('AI 工具', center?.feature_permission_card.allow_ai_tools ?? userStore.permissions.allow_ai_tools) }}</span>
              <span class="chip">{{ featureText('批量功能', center?.feature_permission_card.allow_batch ?? userStore.permissions.allow_batch) }}</span>
              <span class="chip">{{ featureText('无水印导出', center?.feature_permission_card.allow_no_watermark ?? userStore.permissions.allow_no_watermark) }}</span>
              <span class="chip">{{ featureText('模板管理', center?.feature_permission_card.allow_template_manage ?? userStore.permissions.allow_template_manage) }}</span>
            </div>
          </section>

          <section class="card">
            <h3>常用入口</h3>
            <div class="quick-actions">
              <el-button
                v-for="action in center?.quick_actions || defaultQuickActions"
                :key="action.path"
                plain
                @click="openPath(action.path)"
              >
                {{ action.label }}
              </el-button>
            </div>
          </section>

          <section class="card">
            <h3>最近记录</h3>
            <ul v-if="center?.recent_records?.length" class="record-list">
              <li v-for="(item, index) in center.recent_records.slice(0, 5)" :key="index">{{ normalizeRecordText(item) }}</li>
            </ul>
            <p v-else class="muted">暂无记录</p>
          </section>
        </section>
      </main>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import * as accountApi from '@/api/account.ts'
import useUserStore from '@/store/base/user.ts'
import useNotification from '@/common/methods/notification'
import type { AccountCenterResult } from '@/api/account'

const router = useRouter()
const userStore = useUserStore()
const center = ref<AccountCenterResult | null>(null)
const message = ref('')

const defaultQuickActions = [
  { label: '进入编辑器', path: '/home?tempid=303' },
  { label: 'AI 生成海报', path: '/ai-poster' },
  { label: '模板页', path: '/welcome' },
]

const displayUser = computed(() => ({
  id: center.value?.account_overview.user.id || userStore.user.id || null,
  name: center.value?.account_overview.user.name || userStore.user.name || '',
  avatar: center.value?.account_overview.user.avatar || userStore.user.avatar || '',
  email: center.value?.account_overview.user.email || userStore.user.email || '',
  provider: center.value?.account_overview.user.provider || userStore.user.provider || '',
}))

const userInitial = computed(() => (displayUser.value.name || '我').slice(0, 1))
const emailText = computed(() => displayUser.value.email || '未绑定邮箱')
const accountIdText = computed(() => (displayUser.value.id ? String(displayUser.value.id) : '未分配'))
const vipBadgeText = computed(() => (center.value?.vip_status.is_vip || userStore.permissions.is_vip ? 'VIP 用户' : '免费用户'))

function featureText(label: string, enabled: boolean) {
  return `${label}：${enabled ? '已开通' : '未开通'}`
}

function prettyFileSize(value: number) {
  if (!value) return '0 B'
  if (value >= 1024 * 1024 * 1024) return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(0)} MB`
  if (value >= 1024) return `${(value / 1024).toFixed(0)} KB`
  return `${value} B`
}

function normalizeRecordText(record: any) {
  if (typeof record === 'string') return record
  if (record?.title) return String(record.title)
  if (record?.name) return String(record.name)
  if (record?.id) return `记录 #${record.id}`
  return '已更新一条记录'
}

function openPath(path: string) {
  if (/^https?:\/\//.test(path)) {
    window.location.assign(path)
    return
  }
  router.push(path)
}

function notifyPreparing() {
  useNotification('功能准备中', '该模块正在完善中，后续会开放。', { type: 'info' })
}

async function load() {
  if (!userStore.online) return
  try {
    const result = await accountApi.getAccountCenter()
    if ((result as any).code === 400) {
      message.value = '个人中心暂时无法打开，请稍后再试。'
      return
    }
    center.value = result
  } catch {
    message.value = ''
  }
}

async function logout() {
  try {
    await accountApi.logout()
    userStore.clearAuthSession()
    center.value = null
    message.value = ''
    useNotification('已退出登录', '你的账号已安全退出。', { type: 'success' })
  } catch {
    useNotification('退出失败', '暂时无法退出，请稍后再试。', { type: 'warning' })
  }
}

onMounted(load)
</script>

<style scoped lang="less">
.account-page {
  --bg: #f4f6fb;
  --card: #ffffff;
  --line: #e7ecf4;
  --ink: #0f172a;
  --muted: #64748b;
  --primary: #2563eb;
  min-height: 100vh;
  padding: 24px;
  background: radial-gradient(circle at top right, rgba(37, 99, 235, 0.08), transparent 38%), var(--bg);
}

.account-shell {
  max-width: 1180px;
  margin: 0 auto;
}

.topbar {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: flex-start;
  margin-bottom: 14px;
}

.topbar h1 {
  margin: 0;
  font-size: 30px;
  color: var(--ink);
}

.topbar p {
  margin: 6px 0 0;
  color: var(--muted);
}

.topbar-actions {
  display: flex;
  gap: 8px;
}

.empty-card {
  background: var(--card);
  border-radius: 16px;
  padding: 28px;
  border: 1px solid var(--line);
}

.layout {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 14px;
}

.side-panel {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 16px;
  height: fit-content;
  position: sticky;
  top: 20px;
}

.profile {
  text-align: center;
}

.avatar {
  width: 78px;
  height: 78px;
  margin: 0 auto;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #dbeafe, #bfdbfe);
  color: #1e293b;
  font-size: 30px;
  font-weight: 700;
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.profile h2 {
  margin: 10px 0 0;
  color: var(--ink);
}

.profile p {
  margin: 4px 0 0;
  color: var(--muted);
}

.status-stack {
  margin-top: 14px;
  display: grid;
  gap: 8px;
}

.status-item {
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 10px 12px;
  background: #fafcff;
}

.status-item span {
  display: block;
  color: var(--muted);
  font-size: 12px;
}

.status-item strong {
  display: block;
  margin-top: 4px;
  color: var(--ink);
}

.menu {
  margin-top: 14px;
  display: grid;
  gap: 6px;
}

.menu-item {
  border: 1px solid var(--line);
  background: #fff;
  border-radius: 10px;
  padding: 10px 12px;
  text-align: left;
  color: #334155;
  cursor: pointer;
}

.menu-item.active {
  border-color: rgba(37, 99, 235, 0.35);
  background: #eff6ff;
  color: var(--primary);
  font-weight: 600;
}

.content {
  display: grid;
  gap: 12px;
}

.notice {
  padding: 10px 12px;
  border-radius: 10px;
  background: #fff7ed;
  color: #c2410c;
}

.card {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 16px;
}

.card h3 {
  margin: 0 0 12px;
  color: var(--ink);
}

.metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.metric {
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 12px;
  background: #fafcff;
}

.metric span {
  display: block;
  color: var(--muted);
  font-size: 12px;
}

.metric strong {
  display: block;
  margin-top: 4px;
  color: var(--ink);
  font-size: 22px;
}

.metric em {
  display: block;
  margin-top: 2px;
  color: #94a3b8;
  font-style: normal;
  font-size: 12px;
}

.rows {
  display: grid;
  gap: 8px;
}

.row {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--line);
}

.row:last-child {
  border-bottom: 0;
}

.row label {
  color: var(--muted);
}

.row div {
  color: var(--ink);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 12px;
  color: #334155;
  background: #f1f5f9;
}

.quick-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.record-list {
  margin: 0;
  padding-left: 16px;
  color: #475569;
  line-height: 1.8;
}

.muted {
  color: #94a3b8;
}

@media (max-width: 980px) {
  .layout {
    grid-template-columns: 1fr;
  }

  .side-panel {
    position: static;
  }

  .metrics {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .account-page {
    padding: 14px;
  }

  .topbar {
    flex-direction: column;
  }

  .topbar-actions {
    flex-wrap: wrap;
  }
}
</style>
