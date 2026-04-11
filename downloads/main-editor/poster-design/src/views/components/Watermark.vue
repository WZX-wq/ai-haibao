<!--
 * @Author: ShawnPhang
 * @Date: 2024-04-08 16:50:04
 * @Description: 鐢诲竷鍔犳按鍗?
 * @LastEditors: ShawnPhang <https://m.palxp.cn>
 * @LastEditTime: 2024-04-08 18:00:37
-->
<template>
  <el-switch v-model="wmBollean" @change="wmChange" size="large" inline-prompt style="--el-switch-off-color: #9999999e" active-text="移除水印" inactive-text="鲲穹设计水印" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useBaseStore } from '@/store'
import _config from '@/config'

const baseStore = useBaseStore()
const wmBollean = ref(false)

function wmChange(isRemove: string | number | boolean) {
  baseStore.changeWatermark(isRemove ? '' : _config.APP_NAME)
}
</script>

