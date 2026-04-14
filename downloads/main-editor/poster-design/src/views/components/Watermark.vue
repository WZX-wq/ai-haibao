<!--
 * @Author: ShawnPhang
 * @Date: 2024-04-08 16:50:04
 * @Description: 画布水印开关（无水印为会员权益）
 * @LastEditors: ShawnPhang <https://m.palxp.cn>
 * @LastEditTime: 2024-04-08 18:00:37
-->
<template>
  <el-tooltip
    :disabled="canRemoveWatermark"
    content="无水印导出为会员权益，升级会员并开通对应权限后可关闭水印。"
    placement="bottom"
  >
    <span class="watermark-switch-wrap">
      <el-switch
        v-model="wmBollean"
        :disabled="!canRemoveWatermark"
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
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useBaseStore } from '@/store'
import useUserStore from '@/store/base/user.ts'
import _config from '@/config'

const baseStore = useBaseStore()
const userStore = useUserStore()
const { watermark } = storeToRefs(baseStore)

const wmBollean = ref(false)

/** 同时满足会员身份与后端「允许无水印」权限才可关闭画布水印 */
const canRemoveWatermark = computed(
  () => userStore.permissions.is_vip && userStore.permissions.allow_no_watermark,
)

function watermarkIsEmpty(w: string | string[] | undefined): boolean {
  if (w == null) return true
  if (Array.isArray(w)) return w.length === 0 || w.every((x) => !String(x).trim())
  return String(w).trim() === ''
}

function syncSwitchFromStore() {
  wmBollean.value = watermarkIsEmpty(watermark.value)
}

function enforceWatermarkForPlan() {
  if (!canRemoveWatermark.value) {
    baseStore.changeWatermark(_config.WATERMARK_DEFAULT_TEXT)
    wmBollean.value = false
  }
}

function wmChange(isRemove: string | number | boolean) {
  if (!canRemoveWatermark.value) {
    enforceWatermarkForPlan()
    return
  }
  baseStore.changeWatermark(isRemove ? '' : _config.WATERMARK_DEFAULT_TEXT)
}

onMounted(() => {
  syncSwitchFromStore()
  enforceWatermarkForPlan()
})

watch(canRemoveWatermark, (allowed) => {
  if (!allowed) enforceWatermarkForPlan()
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
