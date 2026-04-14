<template>
  <div ref="qrCodeDom" class="qrcode__wrap"></div>
</template>

<script lang="ts" setup>
import { onMounted, ref, watch, nextTick } from 'vue'
import QRCodeStyling, { Options } from 'qr-code-styling'
import { debounce } from 'throttle-debounce'
import { generateOption } from './method'
import type { TQrcodeProps } from './types'

const props = withDefaults(defineProps<TQrcodeProps>(), {
  width: 300,
  height: 300,
  dotsOptions: () => ({
    color: '#41b583',
    type: 'rounded',
  }),
})

let options: Options = {}
watch(
  () => ({
    width: props.width,
    height: props.height,
    value: props.value,
    image: props.image,
    dotsOptions: props.dotsOptions,
  }),
  () => {
    render()
  },
  { deep: true },
)

const render = debounce(300, false, async () => {
  options = generateOption(props)
  if (props.value) {
    try {
      qrCode.update(options)
      await nextTick()
      if (!qrCodeDom.value?.firstChild) return
      ;(qrCodeDom.value.firstChild as HTMLElement).setAttribute('style', 'width: 100%;')
    } catch (error) {
      console.error('qrcode render failed', error)
    }
  }
})

const qrCode = new QRCodeStyling(options)
const qrCodeDom = ref<HTMLElement>()

onMounted(() => {
  if (qrCodeDom.value) {
    qrCode.append(qrCodeDom.value)
  }
  render()
})
</script>
