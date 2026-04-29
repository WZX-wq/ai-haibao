<template>
  <teleport to="body">
    <div v-if="modelValue" class="history-overlay" @click="emit('update:modelValue', false)">
      <div class="history-drawer" @click.stop>
        <div class="history-drawer__header">
          <div>
            <p class="history-drawer__eyebrow">鲲币中心</p>
            <h3>充值记录</h3>
          </div>
          <button type="button" class="history-drawer__close" @click="emit('update:modelValue', false)">×</button>
        </div>

        <div class="history-tabs">
          <button
            type="button"
            class="history-tabs__item"
            :class="{ 'is-active': activeTab === 'recharge' }"
            @click="emit('update:activeTab', 'recharge')"
          >
            充值订单
          </button>
          <button
            type="button"
            class="history-tabs__item"
            :class="{ 'is-active': activeTab === 'detail' }"
            @click="emit('update:activeTab', 'detail')"
          >
            鲲币明细
          </button>
        </div>

        <div class="history-list">
          <div v-if="loading" class="history-empty">加载中...</div>
          <div v-else-if="currentItems.length === 0" class="history-empty">暂无记录</div>
          <template v-else>
            <article v-for="item in currentItems" :key="item.id" class="history-card">
              <template v-if="activeTab === 'recharge'">
                <div class="history-card__top">
                  <div>
                    <h4>订单号 {{ item.order_sn }}</h4>
                    <p>{{ item.create_time || '--' }}</p>
                  </div>
                  <span class="history-card__status" :class="rechargeStatusClass(item.pay_status)">
                    {{ rechargeStatusText(item.pay_status) }}
                  </span>
                </div>
                <div class="history-card__meta">
                  <span>充值金额 ¥{{ item.recharge_money }}</span>
                  <span>到账 {{ item.kunbi }} 鲲币</span>
                  <span>{{ payTypeText(item.pay_type) }}</span>
                </div>
              </template>
              <template v-else>
                <div class="history-card__top">
                  <div>
                    <h4>{{ item.description || detailTypeText(item.type) }}</h4>
                    <p>{{ item.create_time || '--' }}</p>
                  </div>
                  <span class="history-card__amount" :class="detailAmountClass(item.type)">
                    {{ detailAmountText(item.type, item.amount) }}
                  </span>
                </div>
                <div class="history-card__meta">
                  <span>余额 {{ item.balance }}</span>
                  <span>{{ detailTypeText(item.type) }}</span>
                </div>
              </template>
            </article>
          </template>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { KunbiDetailRecordItem, KunbiRechargeRecordItem } from '@/api/kunbi'

const props = defineProps<{
  modelValue: boolean
  activeTab: 'recharge' | 'detail'
  loading: boolean
  rechargeItems: KunbiRechargeRecordItem[]
  detailItems: KunbiDetailRecordItem[]
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
  (event: 'update:activeTab', value: 'recharge' | 'detail'): void
}>()

const currentItems = computed(() =>
  props.activeTab === 'recharge' ? props.rechargeItems || [] : props.detailItems || [],
)

function payTypeText(payType: number) {
  return Number(payType) === 1 ? '微信支付' : Number(payType) === 2 ? '支付宝支付' : '其他支付'
}

function rechargeStatusText(status: number) {
  return Number(status) === 1 ? '已支付' : '待支付'
}

function rechargeStatusClass(status: number) {
  return Number(status) === 1 ? 'is-success' : 'is-pending'
}

function detailTypeText(type: number) {
  if (Number(type) === 1) return '支出'
  if (Number(type) === 2) return '收入'
  return '变动'
}

function detailAmountText(type: number, amount: number | string) {
  const value = String(amount ?? '0').trim()
  if (!value) return '0'
  if (value.startsWith('+') || value.startsWith('-')) return value
  return Number(type) === 1 ? `-${value}` : `+${value}`
}

function detailAmountClass(type: number) {
  return Number(type) === 1 ? 'is-minus' : 'is-plus'
}
</script>

<style scoped lang="less">
.history-overlay {
  position: fixed;
  inset: 0;
  z-index: 3001;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  justify-content: flex-end;
}

.history-drawer {
  width: min(100%, 480px);
  height: 100%;
  background: #fff;
  box-shadow: -18px 0 48px rgba(15, 23, 42, 0.18);
  padding: 24px 20px;
  display: flex;
  flex-direction: column;
}

.history-drawer__header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;

  h3 {
    margin: 4px 0 0;
    font-size: 28px;
    color: #111827;
  }
}

.history-drawer__eyebrow {
  margin: 0;
  font-size: 12px;
  letter-spacing: 0.12em;
  color: #2563eb;
}

.history-drawer__close {
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 999px;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 28px;
  cursor: pointer;
}

.history-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 16px;
}

.history-tabs__item {
  height: 42px;
  border: 1px solid #dbe3f3;
  border-radius: 14px;
  background: #f8fafc;
  color: #475569;
  font-weight: 700;
  cursor: pointer;

  &.is-active {
    border-color: #2563eb;
    background: #eff6ff;
    color: #1d4ed8;
  }
}

.history-list {
  flex: 1;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-card {
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  padding: 16px;
  background: #fff;
}

.history-card__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;

  h4 {
    margin: 0 0 6px;
    font-size: 15px;
    color: #111827;
  }

  p {
    margin: 0;
    font-size: 12px;
    color: #6b7280;
  }
}

.history-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;

  span {
    font-size: 12px;
    color: #475569;
  }
}

.history-card__status,
.history-card__amount {
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.history-card__status.is-success,
.history-card__amount.is-plus {
  background: #ecfdf5;
  color: #059669;
}

.history-card__status.is-pending {
  background: #fff7ed;
  color: #ea580c;
}

.history-card__amount.is-minus {
  background: #fef2f2;
  color: #dc2626;
}

.history-empty {
  padding: 48px 16px;
  text-align: center;
  color: #6b7280;
}

@media (max-width: 640px) {
  .history-drawer {
    width: 100%;
    padding: 20px 16px;
  }
}
</style>
