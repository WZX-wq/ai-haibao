<template>
  <div id="w-image-style">
    <el-collapse v-model="state.activeNames">
      <el-collapse-item title="位置尺寸" name="1">
        <div class="line-layout">
          <number-input v-model="state.innerElement.left" label="X" @finish="(value) => finish('left', value)" />
          <number-input v-model="state.innerElement.top" label="Y" @finish="(value) => finish('top', value)" />
          <number-input v-model="state.innerElement.width" style="margin-top: 0.5rem" label="宽" @finish="(value) => finish('width', value)" />
          <number-input v-model="state.innerElement.height" style="margin-top: 0.5rem" label="高" @finish="(value) => finish('height', value)" />
        </div>
      </el-collapse-item>
      <el-collapse-item title="二维码样式" name="2">
        <div style="flex-wrap: nowrap" class="line-layout">
          <el-select v-model="state.innerElement.dotColorType">
            <el-option v-for="ctype in localization.dotColorTypes" :key="ctype.key" :label="ctype.value" :value="ctype.key" />
          </el-select>
          <el-select v-model="state.innerElement.dotType" class="selector">
            <el-option v-for="dtype in localization.dotTypes" :key="dtype.key" :label="dtype.value" :value="dtype.key" />
          </el-select>
        </div>
        <div style="flex-wrap: nowrap; margin-top: 1rem" class="line-layout">
          <color-select v-model="state.innerElement.dotColor" label="主色" @finish="(value) => finish('dotColor', value)" />
          <color-select v-show="state.innerElement.dotColorType !== 'single'" v-model="state.innerElement.dotColor2" label="渐变尾色" @finish="(value) => finish('dotColor2', value)" />
        </div>
        <number-slider v-show="state.innerElement.dotColorType !== 'single'" v-model="state.innerElement.dotRotation" style="margin-top: 8px" label="渐变角度" :step="1" :minValue="0" :maxValue="360" @finish="(value) => finish('dotRotation', value)" />
      </el-collapse-item>
      <el-collapse-item title="内容设置" name="3">
        <text-input-area v-model="state.innerElement.value" :max="120" label="" @finish="(value) => finish('value', value)" />
        <br />
        <div class="slide-wrap logo__layout">
          <img v-show="state.innerElement.url" :src="state.innerElement.url" class="logo" />
          <uploader class="options__upload" @done="uploadImgDone">
            <el-button size="small" plain>{{ state.innerElement.url ? '替换 Logo' : '上传 Logo' }}</el-button>
          </uploader>
          <el-button v-show="state.innerElement.url" size="small" link @click="finish('url', '')">删除</el-button>
        </div>
        <br />
        <div class="slide-wrap">
          <number-slider v-model="state.innerElement.opacity" label="透明度" :step="0.01" :maxValue="1" @finish="(value) => finish('opacity', value)" />
        </div>
      </el-collapse-item>
      <br />
      <icon-item-select class="style-item" label="" :data="layerIconList" @finish="layerAction" />
      <icon-item-select :data="alignIconList" @finish="alignAction" />
      <br />
    </el-collapse>
  </div>
</template>

<script lang="ts" setup>
import {
  nextTick, reactive, watch,
} from 'vue'
import { ElSelect, ElOption } from 'element-plus'
import numberInput from '../../settings/numberInput.vue'
import iconItemSelect, { TIconItemSelectData } from '../../settings/iconItemSelect.vue'
import numberSlider from '../../settings/numberSlider.vue'
import textInputArea from '../../settings/textInputArea.vue'
import colorSelect from '../../settings/colorSelect.vue'
import api from '@/api'
import localization, { QrCodeLocalizationData } from '@/assets/data/QrCodeLocalization.ts'
import uploader, { TUploadDoneData } from '@/components/common/Uploader/index.vue'
import layerIconList from '@/assets/data/LayerIconList'
import alignIconList from '@/assets/data/AlignListData'
import { wQrcodeSetting, TWQrcodeSetting } from './wQrcodeSetting'
import { storeToRefs } from 'pinia'
import { useControlStore, useForceStore, useWidgetStore } from '@/store'
import { TUpdateWidgetPayload } from '@/store/design/widget/actions/widget'
import { TUpdateAlignData } from '@/store/design/widget/actions/align'

type TState = {
  activeNames: string[]
  innerElement: TWQrcodeSetting
  tag: boolean
  ingoreKeys: string[]
  layerIconList: TIconItemSelectData[]
  alignIconList: TIconItemSelectData[]
  localization: QrCodeLocalizationData
}

const state = reactive<TState>({
  activeNames: ['2', '3', '4'],
  innerElement: JSON.parse(JSON.stringify(wQrcodeSetting)),
  tag: false,
  ingoreKeys: ['left', 'top', 'name', 'width', 'height', 'radiusTopLeft', 'radiusTopRight', 'radiusBottomLeft', 'radiusBottomRight'],
  layerIconList,
  alignIconList,
  localization,
})

const controlStore = useControlStore()
const widgetStore = useWidgetStore()
const forceStore = useForceStore()
const { dMoving } = storeToRefs(useControlStore())
const { dActiveElement } = storeToRefs(widgetStore)

let lastUuid: string | null = null

watch(
  () => dActiveElement.value,
  (newValue) => {
    change()
    if (!newValue) return
    if (Number(newValue.uuid) === -1) {
      state.innerElement.cropEdit = false
      widgetStore.updateWidgetData({
        uuid: lastUuid ?? '',
        key: 'cropEdit',
        value: false,
      })
    } else {
      lastUuid = String(newValue.uuid)
    }
  },
  { deep: true },
)

watch(
  () => state.innerElement,
  () => {
    changeValue()
  },
  { deep: true },
)

watch(
  () => state.innerElement.dotColorType,
  (mode, previousMode) => {
    if (mode === previousMode) return
    if (mode === 'gradient' && (!state.innerElement.dotColor2 || state.innerElement.dotColor2 === state.innerElement.dotColor)) {
      state.innerElement.dotColor2 = getRecommendedGradientTail(state.innerElement.dotColor)
    }
  },
)

change()

function change() {
  state.tag = true
  state.innerElement = JSON.parse(JSON.stringify(dActiveElement.value || wQrcodeSetting))
}

function changeValue() {
  if (state.tag) {
    state.tag = false
    return
  }
  if (dMoving.value) {
    return
  }
  for (const key in state.innerElement) {
    const itemKey = key as keyof TWQrcodeSetting
    if (state.ingoreKeys.indexOf(key) !== -1) {
      ;(dActiveElement.value as Record<string, any>)[itemKey] = state.innerElement[itemKey]
    } else if (key !== 'setting' && key !== 'record' && state.innerElement[itemKey] !== (dActiveElement.value as Record<string, any>)[itemKey]) {
      widgetStore.updateWidgetData({
        uuid: dActiveElement.value?.uuid || '',
        key: key as TUpdateWidgetPayload['key'],
        value: state.innerElement[itemKey] as TUpdateWidgetPayload['value'],
      })
    }
  }
}

function finish(key: string, value: number | number[] | string) {
  widgetStore.updateWidgetData({
    uuid: dActiveElement.value?.uuid || '',
    key: key as TUpdateWidgetPayload['key'],
    value,
  })
}

function layerAction(item: TIconItemSelectData) {
  widgetStore.updateLayerIndex({
    uuid: dActiveElement.value?.uuid || '',
    value: item.value as number,
  })
}

async function alignAction(item: TIconItemSelectData) {
  widgetStore.updateAlign({
    align: item.value as TUpdateAlignData['align'],
    uuid: dActiveElement.value?.uuid || '',
  })
  await nextTick()
  forceStore.setUpdateRect()
}

async function uploadImgDone(img: TUploadDoneData) {
  controlStore.setShowMoveable(false)
  await api.material.addMyPhoto(img)
  state.innerElement.url = img.url
  controlStore.setShowMoveable(true)
}

function getRecommendedGradientTail(color: string) {
  return '#67e8f9'
}
</script>

<style lang="less" scoped>
.slide-wrap {
  width: 100%;
  padding: 16px;
  background: #f3f5f7;
  border-radius: 6px;
}
#w-image-style {
  height: 100%;
  width: 100%;
}
.line-layout {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: space-between;
  width: 100%;
}
.style-item {
  margin-bottom: 10px;
}
.setting-list {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: space-between;
  width: 100%;
}
.options {
  &__upload {
    width: auto;
    display: inline-block;
  }
}

.selector {
  width: 340px;
  transform: scale(0.94);
}
.logo__layout {
  display: flex;
  justify-content: space-around;
  align-items: center;
}
.logo {
  height: 40px;
}
</style>
