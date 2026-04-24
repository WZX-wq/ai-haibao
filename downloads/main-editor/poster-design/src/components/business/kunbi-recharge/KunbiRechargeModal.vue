<template>
  <teleport to="body">
    <div v-if="visible" class="recharge-overlay" @click="handleClose">
      <div class="recharge-popup" @click.stop>
        <div class="recharge-modal">
          <div class="recharge-header">
            <h2>充值中心</h2>
            <div class="close-btn" @click="handleClose">×</div>
          </div>

          <div class="balance-bar">
            <span class="balance-label">鲲币余额</span>
            <div class="balance-value">
              <img :src="resolvedKunbiIcon" alt="鲲币" class="coin-icon" />
              <span>{{ balance }}</span>
            </div>
            <span class="recharge-history" @click="handleHistory">充值记录</span>
          </div>

          <div class="recharge-content">
            <div class="section-header">
              <h3>鲲币充值</h3>
              <span class="agreement-tip">充值即代表接受《充值规则协议》</span>
            </div>

            <div class="packages-grid">
              <div
                v-for="pkg in normalizedPackages"
                :key="pkg.packages_id"
                class="package-card"
                :class="{ selected: selectedPackageId === pkg.packages_id }"
                @click="selectPackage(pkg.packages_id)"
              >
                <img :src="resolvedKunbiIcon" alt="鲲币" class="pkg-coin-icon" />
                <div class="pkg-coin-count">{{ pkg.kunbi }} 鲲币</div>
                <div class="pkg-price">¥{{ pkg.money }}</div>
              </div>
            </div>

            <div class="custom-amount">
              <input
                v-model="customAmount"
                type="text"
                inputmode="numeric"
                pattern="[0-9]*"
                placeholder="请输入您的充值金额（1-1000元）"
                min="1"
                max="1000"
                @focus="clearSelectedPackage"
                @input="validateAmount"
              />
              <div class="amount-hint">单次充值限额：1-1000元</div>
            </div>

            <div class="payment-buttons">
              <button class="pay-btn alipay" @click="handlePay(2)">
                <span class="pay-icon">💙</span>
                支付宝支付
              </button>
              <button class="pay-btn wechat" @click="handlePay(1)">
                <span class="pay-icon">💚</span>
                微信支付
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { CreateRechargeOrderParams, KunbiApiConfig, KunbiRechargePackage } from '@/api/kunbi'

const defaultKunbiIcon = '/images/kunbi.png'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    balance: number
    packages: KunbiRechargePackage[]
    apiConfig?: KunbiApiConfig
  }>(),
  {
    modelValue: false,
    balance: 0,
    packages: () => [],
    apiConfig: () => ({}),
  },
)

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
  (event: 'pay', value: CreateRechargeOrderParams): void
  (event: 'history'): void
}>()

const selectedPackageId = ref<number | null>(null)
const customAmount = ref('')

const visible = computed(() => props.modelValue)
const resolvedKunbiIcon = computed(() => props.apiConfig?.kunbiIcon || defaultKunbiIcon)
const normalizedPackages = computed(() =>
  (props.packages || []).map((pkg) => ({
    ...pkg,
    packages_id: Number(pkg.packages_id ?? pkg.packges_id ?? 0),
  })),
)

watch(
  () => props.modelValue,
  (newVal, oldVal) => {
    if (newVal && !oldVal) {
      resetState()
    }
  },
  { immediate: true },
)

function showTopWarning(message: string) {
  ElMessage({
    message,
    type: 'warning',
    customClass: 'kunbi-top-message',
    offset: 24,
  })
}

function resetState() {
  selectedPackageId.value = null
  customAmount.value = ''
}

function handleClose() {
  emit('update:modelValue', false)
}

function selectPackage(packageId: number) {
  selectedPackageId.value = packageId
  customAmount.value = ''
}

function clearSelectedPackage() {
  selectedPackageId.value = null
}

function validateAmount() {
  if (!customAmount.value) return
  customAmount.value = customAmount.value.replace(/\D/g, '')
  if (!customAmount.value) return
  customAmount.value = String(parseInt(customAmount.value, 10))
  const amount = parseInt(customAmount.value, 10)
  if (amount > 1000) {
    showTopWarning('单次充值金额不能超过1000元')
    customAmount.value = '1000'
  }
}

function handlePay(payType: 1 | 2) {
  if (!selectedPackageId.value && !customAmount.value) {
    showTopWarning('请选择充值套餐或输入金额')
    return
  }

  if (selectedPackageId.value) {
    emit('pay', {
      packages_id: selectedPackageId.value,
      pay_type: payType,
    })
    return
  }

  const amount = parseInt(customAmount.value, 10)
  if (Number.isNaN(amount)) {
    showTopWarning('请输入有效的充值金额')
    return
  }
  if (amount <= 0) {
    showTopWarning('充值金额必须大于等于1元')
    return
  }
  if (amount > 1000) {
    showTopWarning('单次充值金额不能超过1000元')
    return
  }

  emit('pay', {
    recharge_money: String(amount),
    pay_type: payType,
  })
}

function handleHistory() {
  emit('update:modelValue', false)
  emit('history')
}
</script>

<style scoped lang="less">
.recharge-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
}

.recharge-popup {
  width: 90%;
  max-width: 500px;
  background: #fff;
  border-radius: 12px;
  max-height: 90vh;
  overflow: hidden;
  animation: popup-fade-in 0.3s ease;
}

@keyframes popup-fade-in {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.recharge-modal {
  padding: 20px;
  padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px));
  max-height: 80vh;
  overflow-y: auto;
}

.recharge-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.recharge-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.close-btn {
  font-size: 28px;
  color: #999;
  cursor: pointer;
  line-height: 1;
  padding: 5px;
  min-width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #f0f0f0;
  color: #333;
}

.balance-bar {
  background: linear-gradient(135deg, #d1c3fc, #9bc4fc);
  border-radius: 12px;
  padding: 15px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: white;
  margin-bottom: 20px;
  gap: 12px;
}

.balance-label {
  font-size: 14px;
  opacity: 0.9;
}

.balance-value {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 28px;
  font-weight: 600;
}

.coin-icon {
  width: 28px;
  height: 28px;
  object-fit: contain;
}

.recharge-history {
  font-size: 14px;
  cursor: pointer;
  text-decoration: underline;
  flex-shrink: 0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 15px;
}

.section-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.agreement-tip {
  font-size: 12px;
  color: #999;
}

.packages-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 15px;
}

.package-card {
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  padding: 12px 8px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
}

.package-card:hover {
  border-color: #667eea;
  background: #f5f3ff;
}

.package-card.selected {
  border-color: #667eea;
  background: #ede9fe;
}

.pkg-coin-icon {
  width: 32px;
  height: 32px;
  object-fit: contain;
  margin-bottom: 5px;
}

.pkg-coin-count {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin-bottom: 3px;
}

.pkg-price {
  font-size: 14px;
  color: #666;
}

.custom-amount input {
  width: 100%;
  padding: 12px 15px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  box-sizing: border-box;
}

.custom-amount input:focus {
  outline: none;
  border-color: #667eea;
}

.amount-hint {
  margin-top: 5px;
  font-size: 12px;
  color: #999;
}

.payment-buttons {
  display: flex;
  gap: 10px;
  margin-top: 18px;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.pay-btn {
  flex: 1;
  padding: 14px 20px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: white;
  transition: opacity 0.3s;
}

.pay-btn:hover {
  opacity: 0.9;
}

.pay-btn.alipay {
  background: #1677ff;
}

.pay-btn.wechat {
  background: #52c41a;
}

.pay-icon {
  font-size: 18px;
}

@media (max-width: 480px) {
  .packages-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .balance-bar {
    flex-wrap: wrap;
  }

  .payment-buttons {
    flex-direction: column;
  }
}

:global(.kunbi-top-message) {
  z-index: 6000 !important;
}
</style>
