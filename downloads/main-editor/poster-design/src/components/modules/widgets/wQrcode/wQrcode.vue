<!--
 * @Author: ShawnPhang
 * @Date: 2022-03-13 15:59:52
 * @Description: 二维码
 * @LastEditors: ShawnPhang <site: book.palxp.com>
 * @LastEditTime: 2023-06-29 15:54:10
-->
<template>
  <div
    :id="`${params.uuid}`"
    ref="widgetRef"
    :class="['w-qrcode', { 'layer-lock': params.lock }]"
    :style="{
      position: 'absolute',
      left: params.left - parent.left + 'px',
      top: params.top - parent.top + 'px',
      width: params.width + 'px',
      height: params.height + 'px',
      opacity: params.opacity,
    }"
  >
    <QRCode
      ref="qrcode"
      v-bind="state.qrCodeOptions"
      :width="width"
      :height="width"
      class="target"
      :image="params.url"
      :value="params.value"
    />
  </div>
</template>

<script setup lang="ts">
// 图片组件
// const NAME = 'w-qrcode'


import QRCode from '@/components/business/qrcode'
import { TWQrcodeSetting } from './wQrcodeSetting.ts';
import {
  computed, nextTick, onMounted, onUpdated, reactive, ref, watch,
} from 'vue';
// import { useSetupMapGetters } from '@/common/hooks/mapGetters';
import { Options } from 'qr-code-styling';
import { useForceStore, useWidgetStore } from '@/store';
import { storeToRefs } from 'pinia';

type TProps = {
  params: TWQrcodeSetting & {
    rotate?: number
    lock?: boolean
  }
  parent: {
    top: number
    left: number
  }
}

type TState = {
  qrCodeOptions: Options
}


const forceStore = useForceStore()
const widgetStore = useWidgetStore()
const props = defineProps<TProps>()
const state = reactive<TState>({
  qrCodeOptions: {}
})
// const { dActiveElement } = useSetupMapGetters(['dActiveElement'])
const { dActiveElement } = storeToRefs(widgetStore)
const width = computed(() => Number(props.params.width))
const widgetRef = ref<HTMLElement | null>(null)

watch(
  () => props.params,
  () => {
    changeValues()
  },
  { immediate: true, deep: true, }
)

onUpdated(() => {
  updateRecord()
  forceStore.setUpdateRect()
  // store.commit('updateRect')
})

onMounted(async () => {
  updateRecord()
  await nextTick()
  if (widgetRef.value){
    props.params.rotate && (widgetRef.value.style.transform += `rotate(${props.params.rotate})`)
  }
})
// ...mapActions(['updateWidgetData']),
function updateRecord() {
  if (dActiveElement.value?.uuid === props.params.uuid) {
    let record = dActiveElement.value?.record
    if (!widgetRef.value) return
    record.width = widgetRef.value.offsetWidth
    record.height = widgetRef.value.offsetHeight
  }
  // this.updateZoom()
}

function normalizeQrColor(input: string | undefined, fallback = '#35495E') {
  const raw = String(input || '').trim()
  if (/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(raw)) return raw.slice(0, 7)
  const match = raw.match(/#[0-9a-fA-F]{6}/)
  return match?.[0] || fallback
}

function changeValues() {
  const isGradient = props.params.dotColorType !== 'single'
  const primary = normalizeQrColor(props.params.dotColor)
  const secondary = normalizeQrColor(props.params.dotColor2, primary)
  props.params.dotColor = primary
  props.params.dotColor2 = secondary
  state.qrCodeOptions = {
    qrOptions: { typeNumber: 0, mode: 'Byte', errorCorrectionLevel: 'H' },
    dotsOptions: {
      type: props.params.dotType,
      color: isGradient ? undefined : primary,
      gradient: isGradient ? {
        type: 'linear',
        rotation: props.params.dotRotation,
        colorStops: [
          { offset: 0, color: primary },
          { offset: 1, color: secondary },
        ],
      } : undefined,
    },
  }
}
</script>

<style lang="less" scoped>
// .w-qrcode {
//   overflow: hidden;
// }
</style>
<style lang="less">
// .QRCodeVue3 {
//   &_img {
//     width: 100%;
//   }
// }
</style>
