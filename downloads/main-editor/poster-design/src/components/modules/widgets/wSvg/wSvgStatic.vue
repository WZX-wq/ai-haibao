<!--
  TODO: 重构
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
  ></div>
</template>

<script lang="ts" setup>
import { TWSvgSetting } from './wSvgSetting'
import { resolveSnapRootToSvgElement, shouldUseSnapLoad } from './snapSvgRoot'
import { CSSProperties, computed, nextTick, onBeforeMount, onMounted, onUpdated, reactive, ref, watch } from 'vue';

type TProps = {
  params: TWSvgSetting
  parent: {
    left: number
    top: number
  }
}

type TState = {
  position: CSSProperties['position'], // 'absolute'relative
}

const props = defineProps<TProps>()
const state = reactive<TState>({
  position: 'absolute', // 'absolute'relative
})

const widgetRef = ref<HTMLElement | null>(null)

let svgElements: Record<string, any>[] | null = null
onMounted(async () => {
  await nextTick()
  await loadSvg()
})

function applySvgDom(svg2: Record<string, any>) {
  const node = svg2?.node as Element | undefined
  if (!node || typeof node.removeAttribute !== 'function') return false

  const items = svg2.node.childNodes
  node.removeAttribute('width')
  node.removeAttribute('height')
  node.setAttribute('style', 'height: inherit;width: inherit;')
  svgElements = []
  const colorsObj = color2obj()

  deepElement(items)

  function deepElement(els: Record<string, any>) {
    if (els.item) {
      els.forEach((element: Record<string, any>) => {
        elementFactory(element)
        if (element.childNodes.length > 0) {
          element.childNodes.forEach((element: Record<string, any>) => {
            deepElement(element)
          })
        }
      })
    } else {
      elementFactory(els)
    }
  }

  function elementFactory(element: Record<string, any>) {
    const attrsColor: Record<string, any> = {}
    try {
      element.attributes.forEach((attr: Record<string, any>) => {
        if (colorsObj[attr.value]) {
          attr.value = colorsObj[attr.value]
          attrsColor[attr.name] = props.params.colors.findIndex((x) => x == attr.value)
        }
      })
    } catch (e) {}
    if (JSON.stringify(attrsColor) !== '{}' && svgElements) {
      svgElements.push({
        item: element,
        attrsColor,
      })
    }
  }

  if (widgetRef.value) {
    widgetRef.value.appendChild(svg2.node as Node)
  }
  return true
}

function loadSvg() {
  const Snap = (window as any).Snap
  const src = String(props.params.svgUrl || '').trim()
  if (!Snap || !src) {
    return Promise.resolve()
  }

  if (!shouldUseSnapLoad(src)) {
    return new Promise<void>((resolve) => {
      try {
        const parsed = Snap.parse(src)
        const svg2 = resolveSnapRootToSvgElement(parsed, Snap)
        applySvgDom(svg2 as Record<string, any>)
      } catch {
        /* ignore */
      }
      resolve()
    })
  }

  return new Promise<void>((resolve) => {
    try {
      Snap.load(src, function (svg: Record<string, any>) {
        try {
          const svg2 = resolveSnapRootToSvgElement(svg, Snap)
          applySvgDom(svg2 as Record<string, any>)
        } catch {
          /* ignore */
        }
        resolve()
      })
    } catch {
      resolve()
    }
  })
}

function color2obj() {
  const obj: Record<string, any> = {}
  for (let i = 0; i < props.params.colors.length; i++) {
    obj[`{{colors[${i}]}}`] = props.params.colors[i]
  }
  return obj
}

</script>
