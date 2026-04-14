<!--
 * @Author: ShawnPhang
 * @Date: 2024-03-17 16:10:21
 * @Description:  
 * @LastEditors: ShawnPhang <https://m.palxp.cn>
 * @LastEditTime: 2024-08-11 18:42:09
-->
<template>
  <div v-if="percent" v-show="!hide" class="mask">
    <div class="content">
      <div class="tool">
        <div v-show="percent < 100" class="backstage" @click="close"><span style="margin-left: 0.4rem">后台下载</span></div>
        <iconClose v-show="percent >= 100" class="backstage" @click="cancel" width="20" />
      </div>
      <div class="text">{{ text }}</div>
      <el-progress v-show="percent < 100" class="progress-bar" :text-inside="true" :percentage="percent" />
      <div v-show="percent < 100" class="text btn" @click="cancel">{{ cancelText }}</div>
      <div class="text info">{{ msg }}</div>
      <div v-show="percent >= 100" class="success">
        <img :src="imageSrc || '/template-cover-1.png'" alt="" />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { watch, ref } from 'vue'
import { ElProgress } from 'element-plus'
import { Close as iconClose } from '@element-plus/icons-vue'
// import toolTip from '@/components/common/PopoverTip.vue'

type TProps = {
  percent: number
  text?: string
  cancelText?: string
  msg?: string
  imageSrc?: string
}

type TEmits = {
  (event: 'done'): void
  (event: 'cancel'): void
}

const props = withDefaults(defineProps<TProps>(), {
  percent: 0,
  text: '',
  cancelText: '',
  msg: '',
  imageSrc: '',
})

const hide = ref(false)

const emit = defineEmits<TEmits>()

watch(
  () => props.percent,
  (num) => {
    if (num >= 100) {
      // setTimeout(() => {
      //   emit('done')
      // }, 1000)
      hide.value = false
    }
  },
)

const cancel = () => {
  emit('cancel')
  hide.value = false
}

const close = () => {
  hide.value = true
}

defineExpose({
  cancel,
})
</script>

<style lang="less" scoped>
:deep(.el-progress-bar__innerText) {
  opacity: 0;
}
.mask {
  user-select: none;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  padding: 24px 16px;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  position: fixed;
  z-index: 9999;
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
.tool {
  text-align: right;
  .backstage {
    display: inline-flex;
    align-items: center;
    cursor: pointer;
    font-size: 14px;
  }
}
.success {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 0.5rem;
  max-height: min(42vh, 280px);
  img {
    max-width: 100%;
    max-height: min(42vh, 280px);
    width: auto;
    height: auto;
    object-fit: contain;
    border-radius: 8px;
    border: 1px solid rgba(148, 163, 184, 0.25);
  }
}
</style>
