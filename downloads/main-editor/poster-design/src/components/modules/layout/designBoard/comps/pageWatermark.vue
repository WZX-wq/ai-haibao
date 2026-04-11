<!--
 * @Author: ShawnPhang
 * @Date: 2024-04-08 19:19:17
 * @Description: 水印组件封装
 * @LastEditors: ShawnPhang <https://m.palxp.cn>
 * @LastEditTime: 2024-04-08 21:30:12
-->
<template>
  <slot v-if="isDrawPage || isWelcomeEmbed" />
  <el-watermark
    v-else
    :style="props.customStyle"
    :width="markWidth"
    :height="markHeight"
    :gap="[220, 168]"
    :rotate="-14"
    :content="watermark"
    :font="watermarkFont"
  >
    <slot />
  </el-watermark>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ElWatermark } from 'element-plus'
import { storeToRefs } from 'pinia'
import { useBaseStore } from '@/store'
import { useRoute } from 'vue-router'
const route = useRoute()

type TProps = {
  customStyle: any
}

const props = withDefaults(defineProps<TProps>(), {
  customStyle: {}
})

const isDrawPage = computed(() => route.name === 'Draw')
/** 欢迎页作品墙等多实例缩略：不套水印容器，避免额外边距与铺满裁切错位 */
const isWelcomeEmbed = computed(() => route.name === 'Welcome')
const baseStore = useBaseStore()
const { watermark } = storeToRefs(baseStore)
const watermarkFont = {
  color: 'rgba(92, 75, 122, 0.16)',
  fontSize: 17,
  fontWeight: 600,
  fontStyle: 'normal' as const,
  fontFamily: 'PingFang SC, PingFangSC-Semibold, Microsoft YaHei, Hiragino Sans GB, sans-serif',
  textAlign: 'center' as const,
  textBaseline: 'top' as const,
}
const watermarkText = computed(() => {
  if (Array.isArray(watermark.value)) return watermark.value.join(' ')
  return watermark.value || ''
})
const markWidth = computed(() => {
  const safeChars = Math.max(watermarkText.value.length, 4)
  return Math.max(176, Math.ceil(safeChars * 30))
})
const markHeight = computed(() => 82)
</script>
