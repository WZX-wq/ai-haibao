<template>
  <div v-if="percent" class="mask">
    <div class="content">
      <div class="text">{{ text }}</div>
      <el-progress class="progress-bar" :text-inside="true" :percentage="percent" />
      <div class="text btn" @click="cancel">{{ cancelText }}</div>
      <div class="text info">{{ msg }}</div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { watch } from 'vue'
import { ElProgress } from 'element-plus'

type TProps = {
  percent: number
  text?: string
  cancelText?: string
  msg?: string
}

type TEmits = {
  (event: 'done'): void
  (event: 'cancel'): void
}

const props = withDefaults(defineProps<TProps>(), {
  percent: 0,
  text: '',
  cancelText: '',
  msg: ''
})

const emit = defineEmits<TEmits>()

watch(
  () => props.percent,
  (num) => {
    if (num >= 100) {
      setTimeout(() => {
        emit('done')
      }, 1000)
    }
  },
)

const cancel = () => {
  emit('cancel')
}

defineExpose({
  cancel
})

</script>

<style lang="less" scoped>
:deep(.el-progress-bar__innerText) {
  opacity: 0;
}
.mask {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  padding: 24px 16px;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  position: fixed;
  z-index: 99999;
  top: 0;
  left: 0;
  background: rgba(15, 23, 42, 0.45);
}
.content {
  background: #ffffff;
  border-radius: 14px;
  padding: 1.1rem 1.25rem 1.25rem;
  width: min(400px, calc(100vw - 32px));
  max-width: 100%;
  box-shadow: 0 24px 48px rgba(15, 23, 42, 0.2);
}
.progress-bar {
  width: 100%;
}
.text {
  margin: 0.35rem 0 0.65rem;
  font-size: 15px;
  font-weight: 600;
  width: 100%;
  text-align: center;
  color: #1e293b;
  line-height: 1.45;
}
.btn {
  font-weight: 400;
  font-size: 16px;
  cursor: pointer;
  color: #3771e5;
}
.info {
  font-weight: 400;
  font-size: 16px;
  color: #777777;
}
</style>
