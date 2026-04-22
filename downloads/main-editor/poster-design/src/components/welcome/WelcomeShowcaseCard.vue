<template>
  <article class="wall-card" role="link" tabindex="0" @click="openAi" @keyup.enter="openAi">
    <div ref="previewRef" class="wall-card__preview" aria-hidden="true">
      <design-board
        embed-preview
        class="wall-card__board"
        :page-design-canvas-id="canvasId"
        :padding="0"
        :render-d-page="renderPage"
        :render-d-wdigets="renderWidgets"
        :zoom="fitZoom"
      />
    </div>
    <strong>{{ item.title }}</strong>
    <p>{{ item.industry }} · {{ item.style }}</p>
    <span class="wall-card__hint">示意样张，点击后会带入相似主题继续生成</span>
  </article>
</template>

<script lang="ts" setup>
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import { customAlphabet } from 'nanoid/non-secure'
import designBoard from '@/components/modules/layout/designBoard/index.vue'
import { buildPosterLayout, getSizePresets } from '@/components/business/ai-poster-assistant/posterEngine'
import pageDefault from '@/store/design/canvas/page-default'
import type { TPageState } from '@/store/design/canvas/d'
import type { TdWidgetData } from '@/store/design/widget'
import type { PosterDesignPlan, PosterGenerateInput, PosterGenerateResult, PosterPalette } from '@/api/ai'

const nanoid = customAlphabet('1234567890abcdef', 10)

export type ShowcaseItem = {
  title: string
  industry: string
  style: string
  layout: string
  sizeKey: string
  theme: string
  slogan: string
  body: string
  cta: string
  heroUrl: string
  bgUrl?: string
  palette: PosterPalette
}

const props = defineProps<{
  item: ShowcaseItem
  editorReturn: string
}>()

const router = useRouter()
const canvasId = `welcome-showcase-${nanoid()}`
const previewRef = ref<HTMLElement | null>(null)
const previewBox = shallowRef({ w: 320, h: 176 })

function measurePreview() {
  const el = previewRef.value
  if (!el) return
  const w = el.clientWidth
  const h = el.clientHeight
  if (w > 0 && h > 0) previewBox.value = { w, h }
}

let ro: ResizeObserver | null = null
onMounted(() => {
  void nextTick(() => {
    measurePreview()
    ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => measurePreview()) : null
    if (ro && previewRef.value) ro.observe(previewRef.value)
  })
})

onUnmounted(() => {
  ro?.disconnect()
  ro = null
})

const cloneValue = <T,>(value: T): T => JSON.parse(JSON.stringify(value))

function createRenderablePage(page: Partial<TPageState>) {
  return { ...(cloneValue(pageDefault) as TPageState), name: '作品墙示例', ...page, backgroundTransform: {} }
}

const sizePreset = computed(() => {
  const list = getSizePresets()
  return list.find((s) => s.key === props.item.sizeKey) || list[2]
})

const mockResult = computed<PosterGenerateResult>(() => {
  const sp = sizePreset.value
  const plan: PosterDesignPlan = {
    industry: props.item.industry,
    tone: '专业',
    layoutFamily: props.item.layout,
    density: 'balanced',
    heroStrategy: 'scene',
    ctaStrength: 'strong',
    qrStrategy: 'corner',
    templateCandidates: [],
  }
  return {
    title: props.item.title,
    slogan: props.item.slogan,
    body: props.item.body,
    cta: props.item.cta,
    palette: props.item.palette,
    background: {
      imageUrl: props.item.bgUrl || '',
      prompt: '',
    },
    hero: {
      imageUrl: props.item.heroUrl,
      prompt: '',
    },
    designPlan: plan,
    size: { key: sp.key, name: sp.name, width: sp.width, height: sp.height },
    providerMeta: {
      local: { provider: 'local', model: '', isMockFallback: true, message: '' },
    },
  }
})

const mockInput = computed<PosterGenerateInput>(() => ({
  theme: props.item.theme,
  purpose: '引流',
  sizeKey: props.item.sizeKey,
  style: props.item.style,
  industry: props.item.industry,
  content: '',
  qrUrl: '',
}))

const layoutSnapshot = computed(() => buildPosterLayout({ input: mockInput.value, result: mockResult.value }))
const renderPage = computed(() => createRenderablePage(layoutSnapshot.value.page as Partial<TPageState>))
const renderWidgets = computed<TdWidgetData[]>(() => layoutSnapshot.value.widgets as TdWidgetData[])

const fitZoom = computed(() => {
  const { w: boxW, h: boxH } = previewBox.value
  const pw = Math.max(1, Number(renderPage.value.width) || 1242)
  const ph = Math.max(1, Number(renderPage.value.height) || 1660)
  const innerW = Math.max(1, boxW - 2)
  const innerH = Math.max(1, boxH - 2)
  const z = Math.min(innerW / pw, innerH / ph) * 100
  return Math.max(6, Math.min(85, Math.floor(z)))
})

function openAi() {
  router.push({
    path: '/home',
    query: {
      section: 'ai-poster',
      aiTheme: props.item.theme,
      aiPrompt: props.item.theme,
      aiAutoGenerate: '1',
      aiPurpose: '引流',
      aiIndustry: props.item.industry,
      aiStyle: props.item.style,
      aiSizeKey: props.item.sizeKey,
      aiQrUrl: '',
      aiContent: [props.item.slogan, props.item.body].filter(Boolean).join(' '),
      returnTo: props.editorReturn,
    },
  })
}
</script>

<style lang="less" scoped>
.wall-card {
  padding: 10px;
  border-radius: 14px;
  border: 1px solid rgba(226, 232, 240, 0.95);
  background: rgba(255, 255, 255, 0.9);
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;

  &:hover {
    transform: translateY(-2px);
    border-color: rgba(234, 88, 12, 0.28);
    box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
  }

  &:focus-visible {
    outline: 2px solid rgba(234, 88, 12, 0.5);
    outline-offset: 2px;
  }

  strong {
    display: block;
    margin-top: 8px;
    font-size: 14px;
  }

  p {
    margin: 4px 0 0;
    font-size: 12px;
    color: #64748b;
  }
}

.wall-card__preview {
  width: 100%;
  height: 176px;
  border-radius: 10px;
  overflow: hidden;
  background: linear-gradient(180deg, #f1f5f9 0%, #e8edf3 100%);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.5);
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.wall-card__board {
  flex: 0 0 auto;
  line-height: 0;
  max-width: 100%;
  max-height: 100%;
}

.wall-card__board :deep(.db-root--embed) {
  background: transparent !important;
}

.wall-card__board :deep(.db-scroll) {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-inline: 0 !important;
  background: transparent !important;
  background-image: none !important;
}

.wall-card__hint {
  display: block;
  margin-top: 6px;
  font-size: 11px;
  color: #94a3b8;
}
</style>
