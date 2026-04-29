<!--
 * @Author: ShawnPhang
 * @Date: 2023-10-08 14:15:17
 * @Description: 手动抠图 - 修补擦除
 * @LastEditors: ShawnPhang <https://m.palxp.cn>, Jeremy Yu <https://github.com/JeremyYu-cn>
 * @Date: 2024-03-04 09:50:00
-->
<template>
  <div>
    <el-dialog v-model="state.show" align-center width="90%" @close="state.showMatting = false">
      <template #header>
        <div class="tool-wrap">
          <button type="button" class="matting-apply" @click="done">
            <span class="matting-apply__icon"><i class="icon sd-queren" /></span>
            <span class="matting-apply__text">
              <strong>应用抠图</strong>
              <em>保留当前边缘细节并回填到编辑器</em>
            </span>
          </button>
          <div class="matting-toolbar">
            <div class="brush-mode-group">
              <button
                type="button"
                class="brush-mode"
                :class="{ 'is-active': !state.isErasing }"
                @click="setBrushMode(false)"
              >
                <i class="icon sd-xiubu" />
                <span>修补画笔</span>
              </button>
              <button
                type="button"
                class="brush-mode"
                :class="{ 'is-active': state.isErasing }"
                @click="setBrushMode(true)"
              >
                <i class="icon sd-cachu" />
                <span>擦除画笔</span>
              </button>
            </div>
            <div class="slider-group">
              <number-slider
                v-model="state.radius"
                class="slider-wrap"
                label="画笔尺寸"
                :showInput="false"
                labelWidth="90px"
                :maxValue="state.constants?.RADIUS_SLIDER_MAX"
                :minValue="state.constants?.RADIUS_SLIDER_MIN"
                :step="state.constants?.RADIUS_SLIDER_STEP"
              />
              <number-slider
                v-model="state.hardness"
                class="slider-wrap"
                label="画笔硬度"
                :showInput="false"
                labelWidth="90px"
                :maxValue="state.constants?.HARDNESS_SLIDER_MAX"
                :minValue="state.constants?.HARDNESS_SLIDER_MIN"
                :step="state.constants?.HARDNESS_SLIDER_STEP"
              />
            </div>
          </div>
        </div>
      </template>
      <matting v-if="state.showMatting" :hasHeader="false" @register="mattingStart" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { reactive, toRefs, nextTick, watch } from 'vue'
import matting, { MattingType } from '@palxp/image-extraction'
import numberSlider from '@/components/modules/settings/numberSlider.vue'

type TState = {
  show: boolean;
  showMatting: boolean;
  isErasing: boolean;
  radius: number;
  brushSize: string;
  hardness: number;
  hardnessText: string;
  constants: MattingType['constants'] | null;
}

type TParams = {
  raw: string
  result: string
}

type TCallback = ((base64: string) => void) | null

const props: TParams = {
  raw: '',
  result: ''
}

let callback: TCallback = null // 传回自动抠图的回调

const state = reactive<TState>({
  show: false,
  showMatting: false,
  isErasing: false,
  radius: 0, // 画笔尺寸
  brushSize: '', // 画笔尺寸：计算属性，显示值
  hardness: 0, // 画笔硬度
  hardnessText: '', // 画笔硬度：计算属性，显示值
  constants: null,
})

let mattingParam: MattingType | null

const mattingStart = (mattingOptions: MattingType) => {
  mattingOptions.initLoadImages(props.raw, props.result)
  state.isErasing = mattingOptions.isErasing
  state.radius = mattingOptions.radius as number;
  state.hardness = mattingOptions.hardness as number;
  state.constants = mattingOptions.constants
  mattingParam = mattingOptions
}

const open = async (raw: string, result: string, cb: TCallback) => {
  state.show = true
  props.raw = raw
  props.result = result
  await nextTick()
  setTimeout(() => {
    state.showMatting = true
  }, 300)
  callback = cb
}

defineExpose({
  open
})

watch(
  () => state.isErasing,
  (value) => {
    if (mattingParam) mattingParam.isErasing = value
  },
)

watch(
  () => state.radius,
  (value) => {
    if (mattingParam) mattingParam.radius = value
  },
)

watch(
  () => state.hardness,
  (value) => {
    if (mattingParam) mattingParam.hardness = value
  },
)

const setBrushMode = (isErasing: boolean) => {
  state.isErasing = isErasing
}

const done = () => {
  state.show = false
  callback && callback(mattingParam?.getResult())
}

</script>


<style lang="less" scoped>
:deep(.el-dialog__body) {
  padding: 0 !important;
}
:deep(.el-dialog__header) {
  padding: 18px 24px 14px;
}
.tool-wrap {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.matting-apply {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 210px;
  padding: 12px 14px;
  border: 1px solid #d9e7f7;
  border-radius: 12px;
  background: linear-gradient(180deg, #fbfdff 0%, #eef6ff 100%);
  text-align: left;
  cursor: pointer;
}

.matting-apply__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: linear-gradient(180deg, #e8f2ff 0%, #d7e6fb 100%);
  color: #2f6fbe;
  font-size: 18px;
}

.matting-apply__text {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.matting-apply__text strong {
  color: #17365f;
  font-size: 14px;
  line-height: 1.3;
}

.matting-apply__text em {
  color: #5d6f86;
  font-size: 12px;
  line-height: 1.4;
  font-style: normal;
}

.matting-toolbar {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.brush-mode-group {
  display: inline-flex;
  gap: 10px;
  flex-wrap: wrap;
}

.brush-mode {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border: 1px solid #d9e7f7;
  border-radius: 12px;
  background: #f7fbff;
  color: #4c607a;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.brush-mode.is-active {
  border-color: #5f97dc;
  background: linear-gradient(180deg, #fafdff 0%, #eaf3ff 100%);
  color: #17365f;
  box-shadow: 0 8px 18px rgba(63, 114, 194, 0.12);
}

.slider-group {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
}

.slider-wrap {
  width: 240px;
}

@media (max-width: 1200px) {
  .tool-wrap {
    flex-direction: column;
  }

  .matting-apply {
    width: 100%;
  }
}
</style>

