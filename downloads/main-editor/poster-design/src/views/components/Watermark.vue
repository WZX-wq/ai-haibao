<!--
 * @Author: ShawnPhang
 * @Date: 2024-04-08 16:50:04
 * @Description: 画布水印开关
 * @LastEditors: ShawnPhang <https://m.palxp.cn>
 * @LastEditTime: 2024-04-08 18:00:37
-->
<template>
  <el-tooltip disabled content="" placement="bottom">
    <span class="watermark-switch-wrap">
      <el-switch
        v-model="wmBollean"
        size="large"
        inline-prompt
        style="--el-switch-off-color: #9999999e"
        active-text="移除水印"
        inactive-text="水印"
        @change="wmChange"
      />
    </span>
  </el-tooltip>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useBaseStore } from '@/store'
import _config from '@/config'

const baseStore = useBaseStore()
const { watermark } = storeToRefs(baseStore)

const wmBollean = ref(false)

function watermarkIsEmpty(w: string | string[] | undefined): boolean {
  if (w == null) return true
  if (Array.isArray(w)) return w.length === 0 || w.every((x) => !String(x).trim())
  return String(w).trim() === ''
}

function syncSwitchFromStore() {
  wmBollean.value = watermarkIsEmpty(watermark.value)
}

function wmChange(isRemove: string | number | boolean) {
  baseStore.changeWatermark(isRemove ? '' : _config.WATERMARK_DEFAULT_TEXT)
}

onMounted(() => {
  syncSwitchFromStore()
})

watch(watermark, () => {
  syncSwitchFromStore()
})
</script>

<style scoped lang="less">
.watermark-switch-wrap {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
}
</style>
