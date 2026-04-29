<!--
 * @Author: ShawnPhang
 * @Date: 2024-04-03 19:15:21
 * @Description: 文件 
 * @LastEditors: ShawnPhang <https://m.palxp.cn>
 * @LastEditTime: 2024-04-10 07:16:00
-->
<template>
  <el-dropdown trigger="click" size="large" placement="bottom-start" @visible-change="handleDropdownVisibleChange">
    <span ref="triggerRef" class="el-dropdown-link" tabindex="0">
      <slot />
    </span>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item><div @click="$emit('select', 'newDesign')" class="item">创建设计</div></el-dropdown-item>
        <el-dropdown-item @click="openPSD">导入文件</el-dropdown-item>
        <el-dropdown-item @click="$emit('select', 'save')" divided>保存</el-dropdown-item>
        <el-dropdown-item @click="$emit('select', 'download')">导出文件</el-dropdown-item>
        <el-dropdown-item disabled>版本记录</el-dropdown-item>
        <el-dropdown-item disabled>批量套模板</el-dropdown-item>
        <el-dropdown-item @click="$emit('select', 'changeLineGuides')" divided>标尺与参考线</el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElDropdown, ElDropdownItem, ElDropdownMenu } from 'element-plus'

const router = useRouter()
const triggerRef = ref<HTMLElement | null>(null)

const openPSD = () => {
  window.open(router.resolve('/psd').href, '_blank')
}

const handleDropdownVisibleChange = (visible: boolean) => {
  if (visible || typeof document === 'undefined') return
  nextTick(() => {
    const active = document.activeElement as HTMLElement | null
    const triggerEl = triggerRef.value
    if (triggerEl && active && !triggerEl.contains(active)) {
      triggerEl.focus?.()
      return
    }
    if (!active) {
      triggerEl?.focus?.()
      return
    }
    const insideDropdown = active.closest('.el-dropdown-menu, .el-popper, .el-dropdown__popper')
    if (insideDropdown) {
      triggerEl?.focus?.()
    }
  })
}
</script>

<style lang="less" scoped>
.item {
  width: 224px;
}
</style>
