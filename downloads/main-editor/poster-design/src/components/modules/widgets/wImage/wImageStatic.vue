<!--
 * @Author: ShawnPhang
 * @Date: 2024-04-12 17:47:19
 * @Description: 静态组件
 * @LastEditors: ShawnPhang <https://m.palxp.cn>
 * @LastEditTime: 2024-04-16 16:25:35
-->
<template>
  <div
    ref="widgetRef"
    :style="{
      position: state.position,
      left: params.left - parent.left + 'px',
      top: params.top - parent.top + 'px',
      width: params.width + 'px',
      height: params.height + 'px',
      opacity: params.opacity,
    }"
  >
    <div :style="{ transform: params.flip ? `rotate${params.flip}(180deg)` : undefined, borderRadius: params.radius + 'px', '-webkit-mask-image': getMaskStyleValue(params.mask), 'mask-image': getMaskStyleValue(params.mask) }" :class="['img__box', { mask: params.mask }]">
      <div v-if="params.isNinePatch" ref="targetRef" class="target" :style="{ border: `${(params.height * params.sliceData.ratio) / 2}px solid transparent`, borderImage: `url('${safeImgUrl}') ${params.sliceData.left} round` }"></div>
      <img v-else ref="targetRef" class="target" style="transform-origin: center" :src="safeImgUrl" @error="handleImageError" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { CSSProperties, computed, reactive, ref, watch } from 'vue'
import setting from "./wImageSetting"
import { normalizeLoopbackMediaUrl } from '@/utils/publicMediaUrl'

type TProps = {
  params: typeof setting
  parent: {
    left: number
    top: number
  }
}

type TState = {
  position: 'absolute' | 'relative', // 'absolute'relative
  editBoxStyle: CSSProperties,
  cropWidgetXY: {
    x: number
    y: number
  }
  holdPosition: {
    left: number
    top: number
  }
}

const props = defineProps<TProps>()
const sourceImgUrl = computed(() => normalizeLoopbackMediaUrl(props.params.imgUrl))
const safeImgUrl = ref(sourceImgUrl.value)
const state = reactive<TState>({
  position: 'absolute', // 'absolute'relative
  editBoxStyle: {
    transformOrigin: 'center',
    transform: '',
  },
  cropWidgetXY: {
    x: 0,
    y: 0,
  },
  holdPosition: {
    left: 0,
    top: 0,
  }
})

const widgetRef = ref<HTMLElement | null>(null)
const targetRef = ref<HTMLImageElement | null>(null)

function getMaskStyleValue(mask?: string) {
  if (!mask) {
    return 'initial'
  }
  const n = normalizeLoopbackMediaUrl(mask)
  return `url(${n.replace(/'/g, '%27').replace(/\s+/g, '%20')})`
}

function isRetryableExternalUrl(url: string): boolean {
  return /^https?:\/\//i.test(url)
}

function appendRetryParam(url: string): string {
  try {
    const nextUrl = new URL(url, window.location.origin)
    nextUrl.searchParams.set('_img_retry', `${Date.now()}`)
    return nextUrl.toString()
  } catch {
    const connector = url.includes('?') ? '&' : '?'
    return `${url}${connector}_img_retry=${Date.now()}`
  }
}

let imageRetried = false

function handleImageError() {
  const currentUrl = sourceImgUrl.value
  if (!currentUrl || imageRetried || !isRetryableExternalUrl(currentUrl)) {
    return
  }
  imageRetried = true
  safeImgUrl.value = appendRetryParam(currentUrl)
}

watch(
  sourceImgUrl,
  (value) => {
    imageRetried = false
    safeImgUrl.value = value
  },
  { immediate: true }
)

</script>

<style lang="less" scoped>
.mask {
  -webkit-mask-size: 100% 100%;
  -webkit-mask-position: center;
  -webkit-mask-repeat: no-repeat;
  mask-size: 100% 100%;
  mask-position: center;
  mask-repeat: no-repeat;
}
.img__box {
  width: 100%;
  height: 100%;
  overflow: hidden;
  img {
    display: block;
  }
}
.target {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
