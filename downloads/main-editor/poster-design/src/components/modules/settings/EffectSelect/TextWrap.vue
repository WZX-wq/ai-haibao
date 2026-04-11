<template>
  <el-card class="box-card" shadow="hover" :body-style="{ padding: '20px' }">
    <template #header>
      <div class="card-header">
        <div
          :style="{
            position: 'relative',
            width: '27px',
            fontSize: '27px',
            color: data.color,
            fontWeight: data.fontWeight,
            fontStyle: data.fontStyle,
            textDecoration: data.textDecoration,
            opacity: data.opacity,
            backgroundColor: data.backgroundColor,
          }"
        >
          <div
            v-for="(ef, efi) in modelValue"
            :key="efi + 'effect'"
            :style="{
              color: ef.filling && ef.filling.enable && ef.filling.type === 0 ? ef.filling.color : 'transparent',
              WebkitTextStroke: ef.stroke && ef.stroke.enable ? `${ef.stroke.width / coefficient}px ${ef.stroke.color}` : '',
              textShadow: ef.shadow && ef.shadow.enable ? `${ef.shadow.offsetX / coefficient}px ${ef.shadow.offsetY / coefficient}px ${ef.shadow.blur / coefficient}px ${ef.shadow.color}` : undefined,
              backgroundImage: ef.filling && ef.filling.enable ? (ef.filling.type === 0 ? undefined : getGradientOrImg(ef)) : undefined,
              WebkitBackgroundClip: ef.filling && ef.filling.enable ? (ef.filling.type === 0 ? undefined : 'text') : undefined,
            }"
            class="demo"
          >
            A
          </div>
          A
        </div>
        <span class="title">文字特效</span>
        <el-popover :visible="state.visiable" placement="left" :width="320" trigger="click">
          <div class="select__box">
            <div class="select__box__select-item reset" @click="selectEffect()">
              无
            </div>
            <div v-for="preset in state.list" :key="preset.id" class="select__box__select-item" @click="selectEffect(preset.id)">
              <img :src="preset.cover" :alt="preset.title" />
              <span>{{ preset.title }}</span>
            </div>
          </div>
          <template #reference>
            <el-button class="button" link @click="openSet">{{ state.visiable ? '取消' : '选择' }}</el-button>
          </template>
        </el-popover>
      </div>
    </template>

    <div v-show="state.layers.length > 0" class="text item">
      <span style="width: 65px">强度</span>
      <el-slider v-model="state.strength" show-input :max="100" input-size="small" :show-input-controls="false" @input="strengthChange" />
    </div>

    <el-collapse-item>
      <template #title>
        <b>高级编辑</b>
      </template>
      <div class="line"></div>
      <div style="display: flex; justify-content: space-between">
        <el-button class="add-layer" size="small" type="primary" link @click="addLayer">
          + 新建特效层
        </el-button>
        <el-button v-show="state.layers.length > 0" class="add-layer" size="small" type="primary" link @click="state.unfold = !state.unfold">
          {{ state.unfold ? '收起' : '展开' }}全部
        </el-button>
      </div>
      <div class="line"></div>
      <draggable v-model="state.layers" handle=".sd-yidong" item-key="uuid" v-bind="dragOptions">
        <template #item="{ element, index }">
          <div class="feature__grab-wrap">
            <div class="layer__title">
              <i class="icon sd-yidong" />
              <span style="font-size: 12px"><b>特效层</b> {{ index + 1 }}</span>
              <i class="icon sd-delete" @click="removeLayer(index)" />
            </div>
            <div v-if="element.filling && [0, 2, '0', '2'].includes(element.filling.type)" v-show="state.unfold" class="feature__item">
              <el-checkbox v-model="element.filling.enable" label="填充" class="feature__header" />
              <color-select v-model="element.filling.color" width="28px" :modes="['纯色', '渐变']" label="" @change="colorChange($event, element.filling)" />
            </div>
            <div v-if="element.stroke" v-show="state.unfold" class="feature__item">
              <el-checkbox v-model="element.stroke.enable" label="描边" class="feature__header" />
              <el-input-number v-model="element.stroke.width" style="width: 65px; margin-right: 0.5rem" :min="0" size="small" controls-position="right" />
              <color-select v-model="element.stroke.color" width="28px" label="" />
            </div>
            <div v-if="element.offset" v-show="state.unfold" class="feature__item">
              <el-checkbox v-model="element.offset.enable" label="偏移" class="feature__header" />
              <numberInput v-model="element.offset.x" style="width: 49.5px; margin-right: 2px" prepend="x" type="simple" />
              <numberInput v-model="element.offset.y" style="width: 49.5px" prepend="y" type="simple" />
            </div>
            <div v-if="element.shadow" v-show="state.unfold" class="feature__item">
              <el-checkbox v-model="element.shadow.enable" label="阴影" class="feature__header" />
              <numberInput v-model="element.shadow.blur" prepend="blur" :minValue="0" style="width: 30px; margin-right: 2px" type="simple" />
              <numberInput v-model="element.shadow.offsetX" prepend="x" style="width: 30px; margin-right: 2px" type="simple" />
              <numberInput v-model="element.shadow.offsetY" prepend="y" style="width: 30px; margin-right: 0.5rem" type="simple" />
              <color-select v-model="element.shadow.color" width="28px" label="" />
            </div>
          </div>
        </template>
      </draggable>
    </el-collapse-item>
  </el-card>
</template>

<script lang="ts" setup>
import {
  reactive, watch, onMounted, nextTick, computed,
} from 'vue'
import colorSelect from '../colorSelect.vue'
import { ElInputNumber, ElCheckbox } from 'element-plus'
import numberInput from '../numberInput.vue'
import draggable from 'vuedraggable'
import getGradientOrImg from '../../widgets/wText/getGradientOrImg'
import { textEffectPresetMap, textEffectPresets } from '@/assets/data/TextEffectPresets'

type TProps = {
  modelValue?: Record<string, any>[]
  degree?: string | number
  data: Record<string, any>
}

type TEmits = {
  (event: 'update:modelValue', data: Record<string, any>[]): void
}

type TState = {
  strength: number
  visiable: boolean
  list: typeof textEffectPresets
  layers: Record<string, any>[]
  draging: boolean
  unfold: boolean
  syncingFromModel: boolean
}

const props = withDefaults(defineProps<TProps>(), {
  modelValue: () => ([]),
  data: () => ({}),
})

const emit = defineEmits<TEmits>()

const state = reactive<TState>({
  strength: 50,
  visiable: false,
  list: [],
  layers: [],
  draging: false,
  unfold: true,
  syncingFromModel: false,
})

const dragOptions = {
  animation: 300,
  ghostClass: 'ghost',
  chosenClass: 'choose',
}
const coefficient = computed(() => Math.round(160 / 27))
let rawData: Record<string, any>[] = []

onMounted(async () => {
  await nextTick()
  state.list = textEffectPresets
  if (!props.data.textEffects) {
    return
  }
  syncLayersFromModel(props.data.textEffects || [])
})

watch(
  () => props.modelValue,
  (value) => {
    const nextValue = JSON.parse(JSON.stringify(value || []))
    const currentValue = state.layers.map((item) => {
      const nextItem = { ...item }
      delete nextItem.uuid
      return nextItem
    }).reverse()
    if (JSON.stringify(nextValue) === JSON.stringify(currentValue)) {
      return
    }
    syncLayersFromModel(nextValue)
  },
  { deep: true },
)

watch(
  () => state.layers,
  (value) => {
    if (state.syncingFromModel) {
      return
    }
    const newEffect = value.map((item) => {
      const nextItem = { ...item }
      delete nextItem.uuid
      return nextItem
    })
    emit('update:modelValue', newEffect.reverse())
  },
  { deep: true },
)

const selectEffect = async (id?: number) => {
  state.visiable = false
  if (!id) {
    state.layers = []
    rawData = []
    return
  }
  const preset = textEffectPresetMap[id]
  if (!preset) return
  state.layers = JSON.parse(JSON.stringify(preset.layers)).map((item: Record<string, any>) => ({
    ...item,
    uuid: String(Math.random()),
  })).reverse()
  rawData = JSON.parse(JSON.stringify(state.layers))
}

const syncLayersFromModel = (value: Record<string, any>[]) => {
  state.syncingFromModel = true
  const clone = JSON.parse(JSON.stringify(value || []))
  state.layers = clone.map((item: Record<string, any>) => ({
    ...item,
    uuid: String(Math.random()),
  })).reverse()
  rawData = JSON.parse(JSON.stringify(state.layers))
  nextTick(() => {
    state.syncingFromModel = false
  })
}

const removeLayer = (index: number) => {
  state.layers.splice(index, 1)
  rawData = JSON.parse(JSON.stringify(state.layers))
}

const addLayer = () => {
  state.layers.unshift({
    filling: {
      enable: true,
      type: 0,
      color: '#ffffff',
    },
    stroke: {
      enable: true,
      width: 3,
      color: '#7c3aed',
      type: 'outer',
    },
    offset: {
      enable: false,
      x: 0,
      y: 0,
    },
    shadow: {
      enable: true,
      color: 'rgba(15, 23, 42, 0.18)',
      offsetX: 0,
      offsetY: 6,
      blur: 12,
      opacity: 1,
    },
    uuid: String(Math.random()),
  })
  rawData = JSON.parse(JSON.stringify(state.layers))
}

const colorChange = (event: Record<string, any>, item: Record<string, any>) => {
  const modeMap: Record<string, number> = {
    渐变: 2,
    纯色: 0,
  }
  item.gradient = {
    angle: event.angle,
    stops: event.stops,
  }
  setTimeout(() => {
    item.type = modeMap[event.mode] || 0
  }, 100)
}

const onDone = () => {
  state.draging = false
}

const strengthChange = (value: number) => {
  const effectScale = 1 + (value - 50) / 50
  state.layers.forEach((item: any, index) => {
    if (item.stroke) {
      item.stroke.width = rawData[index].stroke.width * effectScale
    }
    if (item.shadow) {
      item.shadow.blur = rawData[index].shadow.blur * effectScale
    }
  })
}

const openSet = async () => {
  state.visiable = !state.visiable
  state.list = textEffectPresets
}

const finish = () => undefined

defineExpose({
  selectEffect,
  finish,
  coefficient,
  removeLayer,
  addLayer,
  dragOptions,
  onDone,
  strengthChange,
  openSet,
  colorChange,
  getGradientOrImg,
})
</script>

<style lang="less" scoped>
:deep(.el-input-group__prepend) {
  padding: 0 8px;
}
:deep(.el-input-number__decrease) {
  width: 18px;
}
:deep(.el-input-number__increase) {
  width: 18px;
}
:deep(.el-input-number.is-controls-right .el-input__wrapper) {
  padding-right: 32px;
}
:deep(.el-input-group__prepend) {
  background: #ffffff;
}
:deep(.el-checkbox__input.is-checked + .el-checkbox__label) {
  color: #333333;
}
:deep(.el-collapse-item__header) {
  border-bottom: none;
}
:deep(.el-collapse-item__wrap) {
  border-bottom: none;
}

.feature {
  &__item {
    display: flex;
    align-items: center;
    margin-top: 6px;
  }
  &__header {
    font-size: 14px;
    flex: 1;
    padding: 12px 0 2px 0;
    color: #333333;
  }
  &__header:first-of-type {
    padding: 0 0 2px 0;
  }
  &__grab-wrap {
    position: relative;
    padding: 10px 0;
  }
  &__grab-wrap:first-of-type {
    padding-top: 0;
  }
  &__grab-wrap:last-of-type {
    padding-bottom: 0;
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.text {
  font-size: 14px;
}

.item {
  margin: 0 0 12px 0;
  display: flex;
  align-items: center;
}

.box-card {
  width: 100%;
}

.demo {
  font-size: 27px;
  color: #ffffff;
  outline: none;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.title {
  font-size: 14px;
  font-weight: 600;
  color: #33383e;
}

.select__box {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  &__select-item {
    cursor: pointer;
    position: relative;
    min-height: 84px;
    padding: 8px;
    border-radius: 12px;
    border: 1px solid rgba(148, 163, 184, 0.2);
    display: flex;
    flex-direction: column;
    gap: 6px;
    justify-content: center;
    background: #ffffff;
    img {
      width: 100%;
      height: 54px;
      object-fit: cover;
      border-radius: 8px;
    }
    span {
      font-size: 12px;
      color: #475569;
      line-height: 1.4;
    }
  }
  &__select-item:hover {
    background: rgba(59, 130, 246, 0.05);
    border-color: rgba(59, 130, 246, 0.22);
  }
  .reset {
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 600;
  }
}

.layer {
  &__title {
    display: flex;
    align-items: center;
    span {
      flex: 1;
    }
    .sd-yidong {
      cursor: grab !important;
      margin-right: 6px;
    }
    .icon {
      cursor: pointer;
    }
    .icon:hover {
      transform: scale(1.1);
      color: @active-text-color;
    }
  }
}

.add-layer {
  margin-bottom: 10px;
}

.choose {
  border: 1px dashed #999999 !important;
}

.flip-list-move {
  transition: transform 0.5s;
}

.no-move {
  transition: transform 0s;
}

.disable {
  opacity: 0.3;
}

.ghost {
  opacity: 0.3;
  background: @main-color;
}

.line {
  margin-top: 8px;
  height: 18px;
  border-top: 1px solid #e9e9e9;
}
</style>
