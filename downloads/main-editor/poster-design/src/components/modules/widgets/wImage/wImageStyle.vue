<!--
 * @Author: ShawnPhang
 * @Date: 2021-08-09 11:41:53
 * @Description: 
 * @LastEditors: ShawnPhang <https://m.palxp.cn>
 * @LastEditTime: 2024-08-12 09:25:47
-->
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
      <el-collapse-item title="设置" name="2">
        <div class="options">
          <div class="action-button-grid">
            <button type="button" class="image-action-card" @click="openPicBox">
              <span class="image-action-card__icon">
                <el-icon><PictureFilled /></el-icon>
              </span>
              <span class="image-action-card__content">
                <span class="image-action-card__title">替换图片</span>
              </span>
            </button>
            <button
              type="button"
              class="image-action-card"
              :class="{ 'image-action-card--active': state.innerElement.cropEdit }"
              @click="imgCrop(!state.innerElement.cropEdit)"
            >
              <span class="image-action-card__icon">
                <el-icon><Crop /></el-icon>
              </span>
              <span class="image-action-card__content">
                <span class="image-action-card__title">{{ state.innerElement.cropEdit ? '完成裁剪' : '裁剪图片' }}</span>
              </span>
            </button>
            <button type="button" class="image-action-card" @click="openImageCutout('local')">
              <span class="image-action-card__icon">
                <el-icon><Scissor /></el-icon>
              </span>
              <span class="image-action-card__content">
                <span class="image-action-card__title">本地抠图</span>
              </span>
              <span class="image-action-card__cost image-action-card__cost--free">免费</span>
            </button>
            <button type="button" class="image-action-card" @click="openCropper">
              <span class="image-action-card__icon">
                <el-icon><MagicStick /></el-icon>
              </span>
              <span class="image-action-card__content">
                <span class="image-action-card__title">美化裁剪</span>
              </span>
            </button>
          </div>
        </div>
        <container-wrap @change="changeContainer" />
        <div class="slide-wrap">
          <number-slider v-model="state.innerElement.opacity" style="font-size: 14px" label="不透明" :step="0.05" :maxValue="1" @finish="(value) => finish('opacity', value)" />
          <number-slider v-model="state.innerElement.radius" style="font-size: 14px" label="圆角" :maxValue="Math.min(Number(state.innerElement.record?.width), Number(state.innerElement.record?.height))" @finish="(value) => finish('radius', value)" />
          <!-- <number-slider v-model="innerElement.letterSpacing" style="font-size: 14px" label="字距" labelWidth="40px" :step="0.05" :minValue="-50" :maxValue="innerElement.fontSize" @finish="(value) => finish('letterSpacing', value)" />
        <number-slider v-model="innerElement.lineHeight" style="font-size: 14px" label="行距" labelWidth="40px" :step="0.05" :minValue="0" :maxValue="2.5" @finish="(value) => finish('lineHeight', value)" /> -->
        </div>
      </el-collapse-item>
      <el-collapse-item v-if="state.innerElement.isNinePatch" title="点九图设置" name="3">
        <number-slider v-model="state.innerElement.sliceData.ratio" :step="0.01" label="比率" :maxValue="10" @finish="(value) => finishSliceData('ratio', value)" />
        <number-slider v-model="state.innerElement.sliceData.left" :step="0.5" label="大小" @finish="(value) => finishSliceData('left', value)" />
      </el-collapse-item>
      <br />
      <icon-item-select class="style-item" label="" :data="layerIconList" @finish="layerAction" />
      <icon-item-select :data="alignIconList" @finish="alignAction" />
      <br />
    </el-collapse>
    <CropImage ref="cropRef" @done="cropDone" />
    <inner-tool-bar v-show="state.innerElement.cropEdit" :style="toolBarStyle">
      <number-slider v-model="state.innerElement.zoom" class="inner-bar" label="缩放" labelWidth="40px" :step="0.01" :minValue="1" :maxValue="3" />
      <i style="padding: 0 8px; cursor: pointer" class="icon sd-queren" @click="imgCrop(false)" />
    </inner-tool-bar>
    <picBox ref="picBoxRef" @select="selectDone" />
    <imageCutout ref="imageCutoutRef" @done="cutImageDone" />
  </div>
</template>

<script lang="ts" setup>
// 图片组件样式
// const NAME = 'w-image-style'
import { nextTick, reactive, ref, watch, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import { Crop, MagicStick, PictureFilled, Scissor } from '@element-plus/icons-vue'

import numberInput from '../../settings/numberInput.vue'
import iconItemSelect, { TIconItemSelectData } from '../../settings/iconItemSelect.vue'
import numberSlider from '../../settings/numberSlider.vue'
// import textInput from '../../settings/textInput.vue'
import CropImage from '@/components/business/cropper/CropImage/CropImage.vue'
import ContainerWrap from '../../settings/EffectSelect/ContainerWrap.vue'
// import uploader from '@/components/common/Uploader/index.vue'
import { getImage } from '@/common/methods/getImgDetail'
import api from '@/api'
import type { CutoutProviderMode } from '@/api/ai'
import layerIconList from '@/assets/data/LayerIconList'
import alignIconList from '@/assets/data/AlignListData'
import picBox from '@/components/business/picture-selector'
import imageCutout from '@/components/business/image-cutout'
// import { useSetupMapGetters } from '@/common/hooks/mapGetters'
import wImageSetting, { TImageSetting } from './wImageSetting'
import { TGetImageListResult } from '@/api/material'
import { storeToRefs } from 'pinia'
import { useCanvasStore, useControlStore, useForceStore, useWidgetStore } from '@/store'
import { TUpdateWidgetPayload } from '@/store/design/widget/actions/widget'
import { TupdateLayerIndexData } from '@/store/design/widget/actions/layer'
import { TUpdateAlignData } from '@/store/design/widget/actions/align'

type TState = {
  picBoxShow: boolean
  activeNames: string[]
  innerElement: TImageSetting
  tag: boolean
  ingoreKeys: string[]
  layerIconList: TIconItemSelectData[]
  alignIconList: TIconItemSelectData[]
  toolBarStyle: Record<string, any>
}

const state = reactive<TState>({
  picBoxShow: false,
  activeNames: ['2', '3', '4'],
  innerElement: JSON.parse(JSON.stringify(wImageSetting)),
  tag: false,
  ingoreKeys: ['left', 'top', 'name', 'width', 'height', 'radiusTopLeft', 'radiusTopRight', 'radiusBottomLeft', 'radiusBottomRight'],
  layerIconList: layerIconList.concat([
    {
      key: 'flip',
      icon: 'sd-zuoyoufanzhuan',
      extraIcon: true,
      tip: '水平翻转',
      value: 'Y',
    },
    {
      key: 'flip',
      icon: 'sd-shangxiafanzhuan',
      extraIcon: true,
      tip: '垂直翻转',
      value: 'X',
    },
  ]),
  alignIconList,
  toolBarStyle: {},
})

const picBoxRef = ref<typeof picBox | null>(null)
const imageCutoutRef = ref<typeof imageCutout | null>(null)
const cropRef = ref<InstanceType<typeof CropImage> | null>(null)

const widgetStore = useWidgetStore()
const forceStore = useForceStore()
const canvasStore = useCanvasStore()
// const {
//   dActiveElement, dWidgets
// } = useSetupMapGetters(['dActiveElement', 'dWidgets'])
const controlStore = useControlStore()
const { dMoving } = storeToRefs(controlStore)
const { dActiveElement, dWidgets } = storeToRefs(widgetStore)

let lastUuid: string | undefined = undefined
let tag: boolean
let toolBarStyle: { left: string; top: string } | null = null

onBeforeUnmount(() => {
  imgCrop(false)
  cropHandle()
})

watch(
  () => dActiveElement.value,
  (newValue, oldValue) => {
    change()
    if (!newValue) return
    // 失焦取消编辑模式
    if (newValue.uuid != lastUuid && typeof lastUuid !== 'undefined') {
      imgCrop(false)
    }
    lastUuid = newValue.uuid
  },
  { deep: true },
)

watch(
  () => state.innerElement,
  (newValue, oldValue) => {
    changeValue()
    cropHandle()
  },
  { deep: true },
)

function created() {
  change()
}

created()

// ...mapActions(['updateWidgetData', 'updateAlign', 'updateLayerIndex', 'addWidget']),

function change() {
  tag = true
  state.innerElement = JSON.parse(JSON.stringify({ ...state.innerElement, ...dActiveElement.value }))
}

function changeValue() {
  if (tag) {
    tag = false
    return
  }
  if (dMoving.value) {
    return
  }
  for (let key in state.innerElement) {
    if (state.ingoreKeys.indexOf(key) !== -1) {
      ;(dActiveElement.value as Record<string, any>)[key] = state.innerElement[key as keyof TImageSetting]
    } else if (key !== 'cropEdit' && key !== 'record' && state.innerElement[key as keyof TImageSetting] !== (dActiveElement.value as Record<string, any>)[key]) {
      widgetStore.updateWidgetData({
        uuid: dActiveElement.value?.uuid || '',
        key: key as TUpdateWidgetPayload['key'],
        value: state.innerElement[key as keyof TImageSetting] as TUpdateWidgetPayload['value'],
      })
      // store.dispatch('updateWidgetData', {
      //   uuid: dActiveElement.value.uuid,
      //   key: key,
      //   value: state.innerElement[(key as keyof TImageSetting)],
      // })
    }
  }
}

function finishSliceData(key: string, value: number | number[]) {
  if (!dActiveElement.value) return
  const data = dActiveElement.value.sliceData
  if (data) {
    data[key] = value
    widgetStore.updateWidgetData({
      uuid: dActiveElement.value.uuid,
      key: 'sliceData',
      value: data,
    })
  }
}

function finish(key: string = '', value: string | number | (string | number)[] | null = '') {
  widgetStore.updateWidgetData({
    uuid: dActiveElement.value?.uuid || '',
    key: key as TUpdateWidgetPayload['key'],
    value: value as TUpdateWidgetPayload['value']
  })
  refreshActiveWidget()
}

function layerAction(item: TIconItemSelectData) {
  if (item.key === 'zIndex') {
    widgetStore.updateLayerIndex({
      uuid: dActiveElement.value?.uuid || '',
      value: item.value as TupdateLayerIndexData['value'],
    })
    // store.dispatch("updateLayerIndex", {
    //   uuid: dActiveElement.value.uuid,
    //   value: item.value,
    // })
  } else {
    finish(item.key || '', item.value === dActiveElement.value?.flip ? null : item.value)
  }
}

async function alignAction(item: TIconItemSelectData) {
  widgetStore.updateAlign({
    align: item.value as TUpdateAlignData['align'],
    uuid: dActiveElement.value?.uuid || '',
  })
  // store.dispatch("updateAlign", {
  //   align: item.value,
  //   uuid: dActiveElement.value.uuid,
  // })
  await nextTick()
  forceStore.setUpdateRect()
  // store.commit('updateRect')
}

function openCropper() {
  if (!state.innerElement.imgUrl) {
    ElMessage.warning('请先选择一张图片，再进行美化')
    return
  }
  cropRef.value?.open(state.innerElement)
}

function cropDone({ newImg, width, height }: { newImg: string; width: number; height: number }) {
  applyImageChange({
    imgUrl: newImg,
    width: Number(width.toFixed(0)),
    height: Number(height.toFixed(0)),
  })
}

async function changeContainer(setting: any) {
  const nextMask = setting?.svgUrl || ''
  state.innerElement.mask = nextMask
  if (!dActiveElement.value?.uuid) {
    return
  }
  ;(dActiveElement.value as Record<string, any>).mask = nextMask
  widgetStore.updateWidgetData({
    uuid: dActiveElement.value.uuid,
    key: 'mask',
    value: nextMask,
  })
  refreshActiveWidget()
  syncMaskPreview(dActiveElement.value.uuid, nextMask)
  // const index = this.dWidgets.findIndex((x) => x.uuid == this.innerElement.uuid)
  // const img = await getImage(setting.svgUrl)
  // setting.width = this.innerElement.width
  // setting.height = img.height * (this.innerElement.width / img.width)
  // setting.left = this.innerElement.left
  // setting.top = this.innerElement.top
  // setting.imgUrl = this.innerElement.imgUrl
  // this.dWidgets.splice(index, 1)
  // this.addWidget(setting)
}

// async function uploadImgDone(img) {
//   this.$store.commit('setShowMoveable', false)
//   await api.material.addMyPhoto(img)
//   // this.innerElement.width = img.width
//   this.innerElement.height = img.height * (this.innerElement.width / img.width)
//   this.innerElement.imgUrl = img.url
//   this.$store.commit('setShowMoveable', true)
// }

async function selectDone(img: TGetImageListResult) {
  const loadImg = await getImage(img.url)
  applyImageChange({
    imgUrl: img.url,
    width: (loadImg.width * canvasStore.dZoom) / 100,
    height: (loadImg.height * canvasStore.dZoom) / 100,
  })
  // this.imgCrop(true)
}

function applyImageChange(payload: { imgUrl: string; width?: number; height?: number }) {
  state.innerElement.imgUrl = payload.imgUrl
  widgetStore.updateWidgetData({
    uuid: dActiveElement.value?.uuid || '',
    key: 'imgUrl',
    value: payload.imgUrl,
  })

  if (typeof payload.width === 'number') {
    state.innerElement.width = payload.width
    widgetStore.updateWidgetData({
      uuid: dActiveElement.value?.uuid || '',
      key: 'width',
      value: payload.width,
    })
  }

  if (typeof payload.height === 'number') {
    state.innerElement.height = payload.height
    widgetStore.updateWidgetData({
      uuid: dActiveElement.value?.uuid || '',
      key: 'height',
      value: payload.height,
    })
  }

  refreshActiveWidget()
}

function refreshActiveWidget() {
  nextTick(() => {
    widgetStore.updateDWidgets()
    canvasStore.reChangeCanvas()
  })
}

function syncMaskPreview(uuid: string, maskUrl: string) {
  nextTick(() => {
    const imageBox = document.getElementById(uuid)?.querySelector('.img__box') as HTMLElement | null
    if (!imageBox) {
      return
    }
    const maskValue = getMaskStyleValue(maskUrl)
    imageBox.style.setProperty('-webkit-mask-image', maskValue)
    imageBox.style.setProperty('mask-image', maskValue)
    imageBox.style.setProperty('-webkit-mask-repeat', 'no-repeat')
    imageBox.style.setProperty('mask-repeat', 'no-repeat')
    imageBox.style.setProperty('-webkit-mask-size', '100% 100%')
    imageBox.style.setProperty('mask-size', '100% 100%')
    imageBox.style.setProperty('-webkit-mask-position', 'center')
    imageBox.style.setProperty('mask-position', 'center')
  })
}

function getMaskStyleValue(maskUrl?: string) {
  if (!maskUrl) {
    return 'initial'
  }
  return `url(${maskUrl.replace(/'/g, '%27').replace(/\s+/g, '%20')})`
}

function imgCrop(val: boolean) {
  // TODO: 画布内图像裁剪
  const el = document.getElementById(state.innerElement.uuid || '')
  if (!el) return
  const { left, top } = el.getBoundingClientRect()
  toolBarStyle = { left: left + 'px', top: top + 'px' }
  state.innerElement.cropEdit = val
  controlStore.setShowRotatable(!val)
}

function cropHandle() {
  controlStore.setCropUuid(state.innerElement.cropEdit ? state.innerElement.uuid : '-1')
  // store.commit('setCropUuid', state.innerElement.cropEdit ? state.innerElement.uuid : -1)
}

// 图库选择器
function openPicBox() {
  if (picBoxRef.value) {
    picBoxRef.value.open()
  }
}

// 打开抠图
async function convertSvgBlobToPng(blob: Blob) {
  const objectUrl = URL.createObjectURL(blob)
  try {
    return await new Promise<Blob>((resolve, reject) => {
      const image = new Image()
      image.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = image.naturalWidth || 1024
        canvas.height = image.naturalHeight || 1024
        const context = canvas.getContext('2d')
        if (!context) {
          reject(new Error('无法初始化画布'))
          return
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((pngBlob) => {
          if (!pngBlob) {
            reject(new Error('SVG 转 PNG 失败'))
            return
          }
          resolve(pngBlob)
        }, 'image/png')
      }
      image.onerror = () => reject(new Error('SVG 解析失败'))
      image.src = objectUrl
    })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function buildCutoutFileName(blob: Blob) {
  const baseName = `image_${Math.random().toString(36).slice(2)}`
  const extension = blob.type.split('/')[1] || 'png'
  return `${baseName}.${extension}`
}

async function openImageCutout(mode: CutoutProviderMode = 'local') {
  if (!state.innerElement.imgUrl) {
    ElMessage.warning('当前图片为空，暂时无法抠图')
    return
  }

  fetch(state.innerElement.imgUrl || '')
    .then((response) => response.blob())
    .then(async (blob) => {
      const finalBlob = blob.type.includes('svg') ? await convertSvgBlobToPng(blob) : blob
      const file = new File([finalBlob], buildCutoutFileName(finalBlob), {
        type: finalBlob.type || blob.type || 'image/png',
      })
      if (imageCutoutRef.value) {
        imageCutoutRef.value.open(mode, file)
      }
    })
    .catch((error) => {
      console.error('获取图片失败:', error)
      ElMessage.error('当前图片暂时无法用于抠图，请先替换为普通图片后再试')
    })
}

// 完成抠图
async function cutImageDone(url: string) {
  setTimeout(() => {
    applyImageChange({ imgUrl: url })
  }, 300)
}
</script>

<style lang="less" scoped>
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
  margin-bottom: 0.6rem;
  .action-button-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    width: 100%;
  }
  &__upload {
    width: auto;
    margin-left: 10px;
    display: inline-block;
  }
}

.image-action-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 54px;
  padding: 10px 12px;
  border: 1px solid #d9e7f7;
  border-radius: 12px;
  background: linear-gradient(180deg, #fcfeff 0%, #eef5ff 100%);
  text-align: left;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.image-action-card:hover {
  border-color: #92bbe9;
  box-shadow: 0 8px 18px rgba(63, 114, 194, 0.1);
  transform: translateY(-1px);
}

.image-action-card--active {
  border-color: #5f97dc;
  background: linear-gradient(180deg, #f3f8ff 0%, #e4f0ff 100%);
  box-shadow: 0 8px 18px rgba(63, 114, 194, 0.14);
}

.image-action-card__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: rgba(67, 126, 209, 0.12);
  color: #2f6fbe;
  font-size: 15px;
  line-height: 1;
}

.image-action-card__icon :deep(.el-icon) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.image-action-card__content {
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: center;
  min-height: 20px;
}

.image-action-card__title {
  color: #17365f;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.image-action-card__meta {
  color: #5d6f86;
  font-size: 11px;
  line-height: 1.35;
  white-space: normal;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.image-action-card__cost {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  top: 7px;
  right: 7px;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(23, 125, 91, 0.12);
  color: #177d5b;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}

.image-action-card__cost--free {
  background: rgba(23, 125, 91, 0.12);
  color: #177d5b;
}

.slide-wrap {
  margin-top: 18px;
  width: 100%;
  padding: 16px;
  background: #f3f5f7;
  border-radius: 6px;
}

.inner-bar {
  margin: 0 10px;
  width: 240px;
}
</style>
