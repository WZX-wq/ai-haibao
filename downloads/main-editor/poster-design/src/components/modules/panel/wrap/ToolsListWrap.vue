<template>
  <div class="wrap">
    <div class="header">{{ ui.componentHeader }}</div>
    <div class="item" @click="addQrcode">
      <i class="icon sd-w-qrcode" />
      <div class="text">
        <span>{{ ui.qrcodeTitle }}</span>
        <span class="desc">{{ ui.qrcodeDesc }}</span>
      </div>
    </div>

    <div class="header">{{ ui.otherHeader }}</div>
    <div class="item" @click="openImageCutout">
      <i class="icon sd-AI_zhineng" />
      <div class="text">
        <span>{{ ui.cutoutTitle }}</span>
        <span class="desc">{{ ui.cutoutDesc }}</span>
      </div>
    </div>
    <imageCutout ref="imageCutoutRef" />
  </div>
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import imageCutout from '@/components/business/image-cutout'
import { wQrcodeSetting } from '../../widgets/wQrcode/wQrcodeSetting'
import { useControlStore, useCanvasStore, useWidgetStore } from '@/store'

const ui = {
  componentHeader: '\u7ec4\u4ef6',
  qrcodeTitle: '\u4e8c\u7ef4\u7801',
  qrcodeDesc: '\u5728\u6d77\u62a5\u4e2d\u63d2\u5165\u53ef\u81ea\u5b9a\u4e49\u6837\u5f0f\u7684\u4e8c\u7ef4\u7801\u3002',
  otherHeader: '\u5176\u5b83',
  cutoutTitle: '\u667a\u80fd\u62a0\u56fe',
  cutoutDesc:
    '\u652f\u6301\u4eba\u7269\u3001\u5546\u54c1\u3001\u5ba0\u7269\u548c\u5e38\u89c1\u9759\u7269\u62a0\u56fe\uff0c\u4e0a\u4f20\u540e\u53ef\u4e00\u952e\u53bb\u80cc\u666f\uff0c\u7ee7\u7eed\u7f16\u8f91\u6216\u52a0\u5165\u8d44\u6e90\u5e93\u3002',
} as const

const controlStore = useControlStore()
const route = useRoute()
const imageCutoutRef = ref<typeof imageCutout | null>(null)
const widgetStore = useWidgetStore()
const { dPage } = storeToRefs(useCanvasStore())

onMounted(() => {
  setTimeout(() => {
    const { koutu } = route.query
    if (koutu) {
      openImageCutout()
    }
  }, 300)
})

function addQrcode() {
  controlStore.setShowMoveable(false)

  const setting = JSON.parse(JSON.stringify(wQrcodeSetting))
  const { width: pageWidth, height: pageHeight } = dPage.value
  setting.left = pageWidth / 2 - setting.width / 2
  setting.top = pageHeight / 2 - setting.height / 2

  widgetStore.addWidget(setting)
}

function openImageCutout() {
  imageCutoutRef.value?.open()
}

</script>

<style lang="less" scoped>
.wrap {
  width: 100%;
  height: 100%;
}

.header {
  display: flex;
  align-items: center;
  height: 56px;
  padding: 17px 1rem;
  font-size: 16px;
  font-weight: bold;
  color: #333333;
  user-select: none;
}

.item {
  position: relative;
  display: flex;
  align-items: center;
  min-height: 72px;
  margin: 0 1rem 16px;
  border-radius: 10px;
  background-color: #f6f7f9;
  font-size: 15px;
  color: #33383e;
  cursor: pointer;
  user-select: none;
  opacity: 0.9;
  transition: all 0.18s ease;
}

.item:hover {
  opacity: 1;
  background: #fff6ee;
}

.icon {
  margin: 0 1rem;
  font-size: 32px;
}

.text {
  display: flex;
  flex-direction: column;
  padding: 12px 12px 12px 0;
}

.desc {
  padding-top: 0.5rem;
  color: #7f8792;
  font-size: 12px;
  line-height: 1.5;
}
</style>
