<template>
  <div class="wrap">
    <div class="header">{{ ui.componentHeader }}</div>
    <div class="item" @click="addQrcode">
      <span class="item-icon item-icon--qrcode"><i class="icon sd-w-qrcode" /></span>
      <div class="text">
        <span>{{ ui.qrcodeTitle }}</span>
        <span class="desc">{{ ui.qrcodeDesc }}</span>
      </div>
    </div>

    <div class="header">{{ ui.otherHeader }}</div>
    <div class="cutout-actions">
      <button type="button" class="item cutout-item" @click="openImageCutout('local')">
        <span class="item-icon"><i class="icon sd-AI_zhineng" /></span>
        <div class="text">
          <div class="cutout-head">
            <span>{{ ui.cutoutLocalTitle }}</span>
            <span class="cutout-tag cutout-tag--free">{{ ui.cutoutLocalTag }}</span>
          </div>
          <span class="desc">{{ ui.cutoutLocalDesc }}</span>
        </div>
      </button>
    </div>
    <imageCutout ref="imageCutoutRef" />
  </div>
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import imageCutout from '@/components/business/image-cutout'
import type { CutoutProviderMode } from '@/api/ai'
import { wQrcodeSetting } from '../../widgets/wQrcode/wQrcodeSetting'
import { useControlStore, useCanvasStore, useWidgetStore } from '@/store'

const ui = {
  componentHeader: '\u7ec4\u4ef6',
  qrcodeTitle: '\u4e8c\u7ef4\u7801',
  qrcodeDesc: '\u5728\u6d77\u62a5\u4e2d\u63d2\u5165\u53ef\u81ea\u5b9a\u4e49\u6837\u5f0f\u7684\u4e8c\u7ef4\u7801\u3002',
  otherHeader: '\u5176\u5b83',
  cutoutLocalTitle: '\u672c\u5730\u9ad8\u8d28\u91cf\u62a0\u56fe',
  cutoutLocalTag: '\u514d\u8d39',
  cutoutLocalDesc:
    '\u4f7f\u7528\u672c\u5730\u9ad8\u8d28\u91cf\u6a21\u578b\u62a0\u56fe\uff0c\u4e0d\u6536\u8d39\uff0c\u9002\u5408\u5546\u54c1\u3001\u7269\u4f53\u548c\u5e38\u89c1\u4e3b\u4f53\u3002',
} as const

const controlStore = useControlStore()
const route = useRoute()
const imageCutoutRef = ref<typeof imageCutout | null>(null)
const widgetStore = useWidgetStore()
const { dPage } = storeToRefs(useCanvasStore())

onMounted(() => {
  setTimeout(() => {
    const { koutu } = route.query
    if (koutu !== undefined) {
      openImageCutout('local')
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

function openImageCutout(mode: CutoutProviderMode = 'local') {
  imageCutoutRef.value?.open(mode)
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
  border: none;
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

.cutout-actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
  margin: 0 1rem 16px;
}

.cutout-item {
  width: 100%;
  margin: 0;
  text-align: left;
  align-items: flex-start;
  min-height: 94px;
  padding: 14px;
  border: 1px solid #d9e7f7;
  background: linear-gradient(180deg, #fbfdff 0%, #f0f6ff 100%);
  box-shadow: 0 10px 24px rgba(63, 114, 194, 0.08);
}

.item:hover {
  opacity: 1;
  border-color: #96bdea;
  background: linear-gradient(180deg, #ffffff 0%, #eef6ff 100%);
}

.item-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  flex: 0 0 42px;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: linear-gradient(180deg, #eef6ff 0%, #dbeafc 100%);
  color: #2f6fbe;
}

.item-icon--qrcode {
  flex: 0 0 48px;
  width: 48px;
  height: 48px;
}

.icon {
  font-size: 24px;
}

.item-icon--qrcode .icon {
  font-size: 30px;
}

.text {
  display: flex;
  flex-direction: column;
  padding: 2px 0 0;
  min-width: 0;
}

.cutout-head {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-weight: 600;
  line-height: 1.35;
  color: #17365f;
}

.cutout-tag {
  flex: 0 0 auto;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
}

.cutout-tag--free {
  background: #e8f7ec;
  color: #167a3e;
}

.desc {
  padding-top: 0.5rem;
  color: #5d6f86;
  font-size: 12px;
  line-height: 1.5;
  white-space: normal;
  word-break: break-word;
}
</style>
