<template>
  <div
    :id="`${params.uuid}`"
    ref="widget"
    v-loading="state.loading"
    :class="['w-text', { editing: state.editable, 'layer-lock': params.lock }, params.uuid]"
    :style="{
      position: 'absolute',
      left: params.left - parent.left + 'px',
      top: params.top - parent.top + 'px',
      width: params.width + 'px',
      minWidth: params.fontSize + 'px',
      minHeight: params.fontSize * params.lineHeight + 'px',
      height: params.height + 'px',
      lineHeight: params.fontSize * params.lineHeight + 'px',
      letterSpacing: (params.fontSize * params.letterSpacing) / 100 + 'px',
      fontSize: params.fontSize + 'px',
      color: params.color,
      textAlign: params.textAlign,
      textAlignLast: params.textAlignLast,
      fontWeight: params.fontWeight,
      fontStyle: params.fontStyle,
      textDecoration: params.textDecoration,
      opacity: params.opacity,
      backgroundColor: params.backgroundColor,
      writingMode: params.writingMode,
      fontFamily: resolvedFontFamily,
    }"
    @dblclick="(e) => dblclickText(e)"
  >
    <template
      v-if="Array.isArray(params.textEffects) && params.textEffects.length > 0 && !state.editable"
    >
      <div
        v-for="(ef, efi) in params.textEffects"
        :key="efi + 'effect'"
        :style="{
          fontFamily: resolvedFontFamily,
          color: ef.filling && ef.filling.enable && ef.filling.type === 0 ? ef.filling.color : 'transparent',
          WebkitTextStroke: ef.stroke && ef.stroke.enable ? `${ef.stroke.width}px ${ef.stroke.color}` : undefined,
          textShadow: ef.shadow && ef.shadow.enable ? `${ef.shadow.offsetX}px ${ef.shadow.offsetY}px ${ef.shadow.blur}px ${ef.shadow.color}` : undefined,
          backgroundImage: ef.filling && ef.filling.enable ? (ef.filling.type === 0 ? undefined : getGradientOrImg(ef)) : undefined,
          WebkitBackgroundClip: ef.filling && ef.filling.enable ? (ef.filling.type === 0 ? undefined : 'text') : undefined,
          transform: ef.offset && ef.offset.enable ? `translate(${ef.offset.x}px, ${ef.offset.y}px)` : undefined,
        }"
        class="edit-text effect-text"
        spellcheck="false"
        v-html="params.text"
      ></div>
    </template>
    <div
      ref="editWrap"
      v-show="state.editable || !params.textEffects?.length"
      :style="{ fontFamily: resolvedFontFamily }"
      class="edit-text"
      spellcheck="false"
      :contenteditable="state.editable ? 'plaintext-only' : false"
      @input="writingText($event)"
      @blur="writeDone($event)"
      v-html="params.text"
    ></div>
  </div>
</template>

<script lang="ts" setup>
// 文本组件
// const NAME = 'w-text'

import { reactive, toRefs, computed, onUpdated, watch, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { buildWidgetFontFamily } from '@/utils/fontFamily'
import { fontMinWithDraw } from '@/utils/widgets/loadFontRule'
import getGradientOrImg from './getGradientOrImg'
import { wTextSetting } from './wTextSetting'
import { useForceStore, useHistoryStore, useWidgetStore } from '@/store'

export type TwTextParams = {
  rotate?: number
  lock?: boolean
  width?: number
  height?: number
} & typeof wTextSetting

type TProps = {
  params: TwTextParams
  parent: {
    left: number
    top: number
  }
}

const props = defineProps<TProps>()
const widgetStore = useWidgetStore()
const forceStore = useForceStore()
const historyStore = useHistoryStore()
const route = useRoute()
const state = reactive({
  loading: false,
  editable: false,
  loadFontDone: '',
})
const widget = ref<HTMLElement | null>(null)
const editWrap = ref<HTMLElement | null>(null)
const fontLoadCache = new Map<string, Promise<void>>()
const skippedFontCache = new Set<string>()
const failedFontCache = new Set<string>()

const dActiveElement = computed(() => widgetStore.dActiveElement)
const isDraw = computed(() => route.name === 'Draw')
const resolvedFontFamily = computed(() => buildWidgetFontFamily(props.params.fontClass?.value, props.params.fontFamily))

function buildFontLoadKey(font: any) {
  return `${String(font?.value || '')}::${String(font?.url || '')}`
}

function shouldSkipSlowRemoteFont(font: any) {
  const url = String(font?.url || '').trim()
  if (!/^https?:\/\//i.test(url)) return false
  const connection = (navigator as any)?.connection
  const effectiveType = String(connection?.effectiveType || '').toLowerCase()
  return Boolean(connection?.saveData) || effectiveType === 'slow-2g' || effectiveType === '2g'
}

async function ensureFontLoaded(font: any) {
  const loadKey = buildFontLoadKey(font)
  if (!font?.url || skippedFontCache.has(loadKey) || failedFontCache.has(loadKey)) return

  if (shouldSkipSlowRemoteFont(font)) {
    skippedFontCache.add(loadKey)
    return
  }

  const cachedTask = fontLoadCache.get(loadKey)
  if (cachedTask) {
    await cachedTask
    return
  }

  const task = (async () => {
    try {
      const loadFont = new window.FontFace(font.value, `url(${font.url})`, {
        display: 'swap',
      })
      await Promise.race([
        loadFont.load().then(() => {
          document.fonts.add(loadFont)
        }),
        new Promise((_, reject) => {
          window.setTimeout(() => reject(new Error('font-load-timeout')), 4000)
        }),
      ])
    } catch {
      failedFontCache.add(loadKey)
    } finally {
      fontLoadCache.delete(loadKey)
    }
  })()

  fontLoadCache.set(loadKey, task)
  await task
}

onUpdated(() => {
  updateRecord()
})

onMounted(() => {
  updateRecord()

  if (!widget.value) return
  props.params.transform && (widget.value.style.transform = props.params.transform)
  props.params.rotate && (widget.value.style.transform += `translate(0px, 0px) rotate(${props.params.rotate}) scale(1, 1)`)
  // store.commit('updateRect')
})

watch(
  () => props.params,
  async (nval) => {
    updateText()
    if (state.loading) {
      return
    }
    let font = nval.fontClass
    const loadKey = buildFontLoadKey(font)
    const isDone = loadKey === state.loadFontDone

    if (font.url && !isDone) {
      if (font.id && isDraw.value) {
        state.loading = false
      }
      if (fontMinWithDraw) {
        return
      }
      state.loading = !isDraw.value && !shouldSkipSlowRemoteFont(font)
      await ensureFontLoaded(font)
      state.loadFontDone = loadKey
      state.loading = false
    } else {
      state.loading = false
    }
  },
  { immediate: true, deep: true },
)

watch(
  () => state.editable,
  (value) => {
    widgetStore.updateWidgetData({
      uuid: String(props.params.uuid),
      key: 'editable',
      value,
    })
  },
)

function updateRecord() {
  if (!widget.value) return
  if (dActiveElement.value && dActiveElement.value.uuid === String(props.params.uuid)) {
    let record = dActiveElement.value.record
    record.width = widget.value.offsetWidth
    record.height = widget.value.offsetHeight
    record.minWidth = props.params.fontSize
    record.minHeight = props.params.fontSize * props.params.lineHeight
    writingText()
  }
}

function updateText(e?: Event) {
  const value = e && e.target ? (e.target as HTMLElement).innerHTML : props.params.text //.replace(/\n/g, '<br/>')
  if (value !== props.params.text) {
    widgetStore.updateWidgetData({
      uuid: String(props.params.uuid),
      key: 'text',
      value,
    })
  }
}

function writingText(e?: Event) {
  // updateText(e)
  // TODO: 修正文字选框高度
  const el = editWrap.value || widget.value
  if (!el) return
  widgetStore.updateWidgetData({
    uuid: String(props.params.uuid),
    key: 'height',
    value: el.offsetHeight,
  })
  forceStore.setUpdateRect()
  // store.commit('updateRect')
}

function writeDone(e: Event) {
  state.editable = false
  updateText(e)
}

function dblclickText(_: MouseEvent) {
  if (state.editable) return
  state.editable = true
  const el = editWrap.value || widget.value
  setTimeout(() => {
    if (!el) return
    el.focus()
    if (document.selection) {
      const range = document.body.createTextRange()
      range.moveToElementText(el)
      range.select()
    } else {
      const range = document.createRange()
      range.selectNodeContents(el)
      window.getSelection()?.removeAllRanges()
      window.getSelection()?.addRange(range)
    }
  }, 100)
}

defineExpose({
  getGradientOrImg,
  updateRecord,
  writingText,
  updateText,
  writeDone,
  dblclickText,
  widget,
  editWrap,
})
</script>

<style lang="less" scoped>
.w-text {
  // cursor: pointer;
  user-select: none;
}
.w-text.editing {
  cursor: text;
  user-select: text;
}
.edit-text {
  outline: none;
  word-break: break-word;
  white-space: pre-wrap;
  margin: 0;
}
.effect-text {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
</style>
