<template>
  <div class="workspace-welcome">
    <div class="welcome-scroll">
      <section class="hero">
        <div class="hero-glow hero-glow--left"></div>
        <div class="hero-glow hero-glow--right"></div>
        <h1 class="hero__title">鲲穹海报，一句话，生成海报。</h1>
        <p class="hero__subtitle">写一段描述，AI自动生成精美海报</p>

        <div class="hero-input">
          <textarea
            ref="heroInputRef"
            v-model="promptText"
            class="hero-input__field"
            placeholder="描述你的海报主题，例如：夏季健身房招新海报"
            @keydown.enter.exact.prevent="generateFromPrompt"
          />
          <button class="hero-input__button ai-entry-button" type="button" @click="generateFromPrompt">
            <span class="ai-entry-button__content">
              <span class="ai-entry-button__title">生成海报</span>
              <span class="ai-entry-button__meta">10鲲币</span>
            </span>
          </button>
        </div>
      </section>

      <section class="category-strip">
        <button
          v-for="category in categories"
          :key="category.key"
          type="button"
          :class="['category-card', { 'is-active': activeCategory === category.key }]"
          @click="activateCategory(category.key)"
        >
          <img :src="resolveImageUrl(category.cover)" :alt="category.name" loading="eager" decoding="async" />
          <span>{{ category.name }}</span>
        </button>
      </section>

      <section
        class="template-tabs"
        @mouseenter="pauseTemplateLoop"
        @mouseleave="resumeTemplateLoop"
      >
        <Transition name="template-cycle" mode="out-in">
          <div :key="activeCategory" class="tab-panel is-active">
            <div class="poster-grid poster-grid--five">
            <article
              v-for="(card, cardIndex) in activeCategoryMeta.cards"
              :key="card.title"
              class="poster-card"
              @click="navigateToAi(card, activeCategoryMeta)"
            >
              <div
                class="poster-card__media"
                :class="{ 'poster-card__media--blended': card.imageBlendBackground }"
              >
                <img
                  v-if="card.imageBlendBackground"
                  :src="resolveImageUrl(card.image)"
                  :alt="`${card.title} 背景`"
                  class="poster-card__bg"
                  loading="eager"
                  :fetchpriority="cardIndex === 0 ? 'high' : 'auto'"
                  decoding="async"
                  :style="getPosterBackgroundStyle(card)"
                />
                <img
                  :src="resolveImageUrl(card.image)"
                  :alt="card.title"
                  class="poster-card__foreground"
                  loading="eager"
                  :fetchpriority="cardIndex === 0 ? 'high' : 'auto'"
                  decoding="async"
                  :style="getPosterImageStyle(card)"
                />
                <span class="poster-card__tag">{{ card.tag }}</span>
              </div>
              <div class="poster-card__info">
                <h3>{{ card.title }}</h3>
                <p>{{ card.desc }}</p>
              </div>
            </article>
            </div>
          </div>
        </Transition>
      </section>

      <section class="showcase-block showcase-block--enterprise">
        <div class="block-title">
          <span class="block-title__line"></span>
          <h2>企业级AI设计</h2>
          <span class="block-title__line"></span>
        </div>
        <div class="showcase-panel">
          <div class="showcase-panel__intro">
            <h3>AI赋能，企业设计。</h3>
            <p>让企业设计更智能、更高效、更统一。</p>
          </div>
          <div ref="enterpriseGalleryRef" class="showcase-gallery">
            <article
              v-for="item in enterpriseGallery"
              :key="item.image"
              :class="['gallery-card', { 'gallery-card--wide': item.wide }]"
            >
              <img :src="resolveImageUrl(item.image)" :alt="item.alt" loading="eager" decoding="async" />
              <div v-if="item.title || item.desc" class="gallery-card__overlay">
                <span v-if="item.badge" class="gallery-card__badge">{{ item.badge }}</span>
                <h4 v-if="item.title">{{ item.title }}</h4>
                <p v-if="item.desc">{{ item.desc }}</p>
              </div>
              <div
                v-if="item.thumbs?.length"
                :class="['gallery-card__thumbs', { 'gallery-card__thumbs--dual': item.thumbs.length > 1 }]"
              >
                <img :src="resolveImageUrl(item.thumbs[0])" :alt="`${item.alt} 缩略图`" loading="eager" decoding="async" />
                <template v-if="item.thumbs.length > 1">
                  <span>+</span>
                  <img :src="resolveImageUrl(item.thumbs[1])" :alt="`${item.alt} 缩略图 2`" loading="eager" decoding="async" />
                </template>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section class="showcase-block showcase-block--social">
        <div class="block-title">
          <span class="block-title__line"></span>
          <h2>自媒体爆款设计</h2>
          <span class="block-title__line"></span>
        </div>
        <div class="showcase-panel">
          <div class="showcase-panel__intro">
            <h3>爆款内容，轻松创作。</h3>
            <p>让自媒体设计更吸睛、更传播、更涨粉。</p>
          </div>
          <div ref="socialGalleryRef" class="showcase-gallery">
            <article
              v-for="item in socialGallery"
              :key="item.image"
              class="gallery-card"
            >
              <img :src="resolveImageUrl(item.image)" :alt="item.alt" loading="eager" decoding="async" />
              <div v-if="item.title || item.desc" class="gallery-card__overlay">
                <span v-if="item.badge" class="gallery-card__badge">{{ item.badge }}</span>
                <h4 v-if="item.title">{{ item.title }}</h4>
                <p v-if="item.desc">{{ item.desc }}</p>
              </div>
              <div
                v-if="item.thumbs?.length"
                :class="['gallery-card__thumbs', { 'gallery-card__thumbs--dual': item.thumbs.length > 1 }]"
              >
                <img :src="resolveImageUrl(item.thumbs[0])" :alt="`${item.alt} 缩略图`" loading="eager" decoding="async" />
                <template v-if="item.thumbs.length > 1">
                  <span>+</span>
                  <img :src="resolveImageUrl(item.thumbs[1])" :alt="`${item.alt} 缩略图 2`" loading="eager" decoding="async" />
                </template>
              </div>
            </article>
          </div>
        </div>
      </section>

      <footer class="footer">
        <div class="footer__links">
          <a href="https://www.kunqiongai.com/" target="_blank" rel="noopener noreferrer">关于我们</a>
          <a href="https://www.kunqiongai.com/agreement/" target="_blank" rel="noopener noreferrer">使用条款</a>
          <a href="https://www.kunqiongai.com/privacy/" target="_blank" rel="noopener noreferrer">隐私政策</a>
          <a href="https://www.kunqiongai.com/feedback/" target="_blank" rel="noopener noreferrer">联系我们</a>
        </div>
        <p class="footer__copy">© 2026 鲲穹AI工具. 保留所有权利.</p>
      </footer>
    </div>

    <div class="floating-entry">
      <div class="floating-entry__inner">
        <textarea
          ref="floatingInputRef"
          v-model="promptText"
          class="floating-entry__field"
          placeholder="描述你的海报主题，例如：夏季健身房招新海报"
          @keydown.enter.exact.prevent="generateFromStickyPrompt"
        />
        <button class="floating-entry__button ai-entry-button ai-entry-button--compact" type="button" @click="generateFromStickyPrompt">
          <span class="ai-entry-button__content">
            <span class="ai-entry-button__title">生成海报</span>
            <span class="ai-entry-button__meta">10鲲币</span>
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

type TemplateCard = {
  image: string
  title: string
  desc: string
  tag: string
  imageFit?: 'cover' | 'contain'
  imagePosition?: string
  imageBlendBackground?: boolean
  prompt?: string
  theme?: string
  purpose?: string
  industry?: string
  style?: string
  sizeKey?: string
  qrUrl?: string
  content?: string
}

type ResolvedTemplateCard = TemplateCard & {
  prompt: string
  theme: string
  purpose: string
  industry: string
  style: string
  sizeKey: string
  qrUrl: string
  content: string
}

type CategoryItem = {
  key: string
  name: string
  cover: string
  prompt: string
  preset: string
  purpose: string
  industry: string
  style: string
  sizeKey: string
  qrUrl?: string
  cards: TemplateCard[]
}

type ResolvedCategoryItem = Omit<CategoryItem, 'cards' | 'qrUrl'> & {
  qrUrl: string
  cards: ResolvedTemplateCard[]
}

type GalleryItem = {
  image: string
  alt: string
  wide?: boolean
  badge?: string
  title?: string
  desc?: string
  thumbs?: string[]
}

const router = useRouter()
const promptText = ref('')
const activeCategory = ref('ecommerce')
const enterpriseGalleryRef = ref<HTMLElement | null>(null)
const socialGalleryRef = ref<HTMLElement | null>(null)
const heroInputRef = ref<HTMLTextAreaElement | null>(null)
const floatingInputRef = ref<HTMLTextAreaElement | null>(null)
let templateCategoryAutoplayTimer: number | null = null

const ecomFirstExact = 'ecom-1'
const ecomSecondExact = 'ecom-3'
const ecomThirdExact = 'ecom-2'
const ecomFourthExact = 'ecom-4'
const foodCoffeeExact = 'food-2'
const foodSecondFixed = 'food-bbq'
const foodFifthFixed = 'festival-christmas'

const BLANK_IMAGE =
  'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2216%22 viewBox=%220 0 24 16%22%3E%3Crect width=%2224%22 height=%2216%22 rx=%222%22 fill=%22%23e2e8f0%22/%3E%3C/svg%3E'

type ImageModuleLoader = () => Promise<{ default: string }>

const imageModules = import.meta.glob('../../assets/homepage/**/*.{jpg,jpeg,png,svg,webp,avif}') as Record<string, ImageModuleLoader>
const imageModuleEntries = Object.entries(imageModules)
const imageUrlCache = ref<Record<string, string>>({})
const pendingImageLoads = new Set<string>()

function getImageFormatPriority(filePath: string) {
  const normalized = filePath.toLowerCase()
  if (normalized.endsWith('.avif')) return 0
  if (normalized.endsWith('.webp')) return 1
  if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) return 2
  if (normalized.endsWith('.png')) return 3
  if (normalized.endsWith('.svg')) return 4
  return 9
}

function findImageModuleKey(prefix: string) {
  const matches = imageModuleEntries
    .filter(([item]) =>
      item.endsWith(`/${prefix}.avif`) ||
      item.endsWith(`/${prefix}.webp`) ||
      item.endsWith(`/${prefix}.jpg`) ||
      item.endsWith(`/${prefix}.jpeg`) ||
      item.endsWith(`/${prefix}.png`) ||
      item.endsWith(`/${prefix}.svg`) ||
      item.includes(`${prefix}-`)
    )
    .sort((a, b) => getImageFormatPriority(a[0]) - getImageFormatPriority(b[0]))
  return matches[0]?.[0]
}

function getImage(prefix: string) {
  return prefix
}

function resolveImageUrl(value?: string) {
  const src = String(value || '').trim()
  if (!src) return BLANK_IMAGE
  if (/^(https?:)?\/\//.test(src) || src.startsWith('data:') || src.startsWith('blob:') || src.startsWith('/')) {
    return src
  }

  const cached = imageUrlCache.value[src]
  if (cached) {
    return cached
  }

  const moduleKey = findImageModuleKey(src)
  if (!moduleKey) {
    return BLANK_IMAGE
  }

  if (!pendingImageLoads.has(src)) {
    pendingImageLoads.add(src)
    imageModules[moduleKey]()
      .then((mod) => {
        imageUrlCache.value = {
          ...imageUrlCache.value,
          [src]: mod.default,
        }
      })
      .finally(() => {
        pendingImageLoads.delete(src)
      })
  }

  return BLANK_IMAGE
}

function preloadImages(values: Array<string | undefined | null>) {
  values.forEach((value) => {
    if (!value) return
    resolveImageUrl(String(value))
  })
}

const validSizeKeys = new Set(['a4', 'wechat-cover', 'xiaohongshu', 'moments', 'ecommerce', 'flyer'])

function resolveTemplateCard(category: CategoryItem, card: TemplateCard): ResolvedTemplateCard {
  return {
    ...card,
    prompt: String(card.prompt || category.prompt || card.title).trim(),
    theme: String(card.theme || card.title || category.name).trim(),
    purpose: String(card.purpose || category.purpose || '').trim(),
    industry: String(card.industry || category.industry || '').trim(),
    style: String(card.style || category.style || '').trim(),
    sizeKey: String(card.sizeKey || category.sizeKey || '').trim(),
    qrUrl: String(card.qrUrl || category.qrUrl || '').trim(),
    content: String(card.content || card.desc || category.prompt || card.title).trim(),
  }
}

function getPosterImageStyle(card: TemplateCard) {
  return {
    objectFit: card.imageFit || 'cover',
    objectPosition: card.imagePosition || 'center',
  }
}

function getPosterBackgroundStyle(card: TemplateCard) {
  return {
    objectPosition: card.imagePosition || 'center',
  }
}

function validateTemplateCategories(items: ResolvedCategoryItem[]) {
  const errors: string[] = []
  items.forEach((category) => {
    category.cards.forEach((card) => {
      const prefix = `${category.key}/${card.title}`
      if (!card.image) errors.push(`${prefix}: missing image`)
      if (!card.theme) errors.push(`${prefix}: missing theme`)
      if (!card.prompt) errors.push(`${prefix}: missing prompt`)
      if (!card.purpose) errors.push(`${prefix}: missing purpose`)
      if (!card.industry) errors.push(`${prefix}: missing industry`)
      if (!card.style) errors.push(`${prefix}: missing style`)
      if (!card.content) errors.push(`${prefix}: missing content`)
      if (!card.sizeKey) {
        errors.push(`${prefix}: missing sizeKey`)
      } else if (!validSizeKeys.has(card.sizeKey)) {
        errors.push(`${prefix}: invalid sizeKey "${card.sizeKey}"`)
      }
    })
  })
  if (errors.length > 0) {
    console.warn('[WorkspaceWelcome] Template preset validation failed:\n' + errors.join('\n'))
  }
}

const categories: CategoryItem[] = [
  {
    key: 'ecommerce',
    name: '电商',
    cover: ecomFirstExact,
    prompt: '设计一张电商促销海报，突出限时抢购、爆款优惠和下单氛围',
    preset: 'commerce',
    purpose: '促销',
    industry: '电商',
    style: '活力促销',
    sizeKey: 'ecommerce',
    cards: [
      { image: ecomFirstExact, title: '618狂欢节 全场5折起', desc: '限时抢购 超值开售', tag: '促销', prompt: '设计一张618促销海报，全场5折起，突出限时抢购氛围', theme: '618狂欢节 全场5折起', content: '大促节点、限时折扣、强烈购买转化、品牌主视觉统一', style: '活力促销', sizeKey: 'ecommerce' },
      { image: ecomSecondExact, title: '新品上市 抢先体验', desc: '时尚爆款 高阶质感', tag: '新品', theme: '新品上市 抢先体验', content: '突出新品首发、产品质感、卖点信息和购买引导', style: '轻奢质感', sizeKey: 'ecommerce', purpose: '上新' },
      { image: ecomThirdExact, title: '限时秒杀 低至9.9', desc: '低价开抢 限时疯抢', tag: '秒杀', theme: '限时秒杀 低至9.9', content: '突出限时秒杀、低价刺激、倒计时紧迫感和立即下单转化', style: '活力促销', sizeKey: 'ecommerce' },
      { image: ecomFourthExact, imageFit: 'contain', imagePosition: 'center top', imageBlendBackground: true, title: '满199减100', desc: '优惠叠加 畅快购物', tag: '满减', theme: '满199减100', content: '突出满减优惠、活动门槛、价格冲击力和促销转化氛围', style: '活力促销', sizeKey: 'ecommerce' },
      { image: getImage('ecom-member-poster'), title: 'VIP会员专享价', desc: '加入会员 尊享特权', tag: '会员', theme: 'VIP会员专享价', content: '强调会员特权、尊享权益、优惠力度和升级引导', style: '专业商务', sizeKey: 'ecommerce', purpose: '品牌宣传' },
    ],
  },
  {
    key: 'recruitment',
    name: '招聘',
    cover: getImage('recruit-1'),
    prompt: '设计一张招聘海报，突出高薪岗位、福利待遇和团队氛围',
    preset: 'recruitment',
    purpose: '招聘',
    industry: '招聘',
    style: '专业商务',
    sizeKey: 'moments',
    cards: [
      { image: getImage('recruit-1'), title: '高薪诚聘前端工程师', desc: '20K-35K 五险一金', tag: '技术', theme: '高薪诚聘前端工程师', content: '突出薪资范围、岗位亮点、成长空间和立即投递', style: '专业商务' },
      { image: getImage('recruit-2'), title: 'UI设计师招募中', desc: '创意团队 等你加入', tag: '设计', theme: 'UI设计师招募中', content: '突出设计团队氛围、审美要求、作品集投递与成长路径', style: '轻奢质感' },
      { image: getImage('recruit-3'), imageFit: 'contain', imagePosition: 'center top', imageBlendBackground: true, title: '运营经理热招', desc: '年薪30W+ 股权激励', tag: '运营', theme: '运营经理热招', content: '强调岗位职责、业务增长目标、薪资和激励政策', style: '专业商务' },
      { image: getImage('recruit-4'), title: '销售精英招募令', desc: '底薪+提成 上不封顶', tag: '销售', theme: '销售精英招募令', content: '强调高提成、晋升通道、冠军氛围和立即报名', style: '活力促销' },
      { image: getImage('recruit-intern-poster'), title: '实习生招聘计划', desc: '大厂实习 转正机会', tag: '实习', theme: '实习生招聘计划', content: '突出培养机制、实习周期、转正机会和投递方式', style: '年轻潮流' },
    ],
  },
  {
    key: 'event',
    name: '活动',
    cover: getImage('event-1'),
    prompt: '设计一张线下活动海报，突出时间地点、亮点和参与氛围',
    preset: 'campaign',
    purpose: '活动预告',
    industry: '活动',
    style: '高级简约',
    sizeKey: 'xiaohongshu',
    cards: [
      { image: getImage('event-1'), title: '夏日音乐节狂欢夜', desc: '明星阵容 热力开唱', tag: '音乐', theme: '夏日音乐节狂欢夜', content: '突出主视觉冲击、演出阵容、时间地点和购票入口', style: '年轻潮流' },
      { image: getImage('event-2'), title: '创意市集', desc: '周末赶市活动', tag: '市集', theme: '创意市集', content: '突出创意摊位、市集氛围、活动时间地点和现场逛展体验', style: '清新温暖' },
      { image: getImage('event-3'), title: '年终盛典派对', desc: '感恩回馈 惊喜不断', tag: '派对', theme: '年终盛典派对', content: '突出派对氛围、活动亮点、抽奖福利和到场引导', style: '高级简约' },
      { image: getImage('event-4'), title: '运动会嘉年华', desc: '热血开赛 全民参与', tag: '运动会', theme: '运动会嘉年华', content: '突出运动活力、嘉年华氛围、赛事信息和现场参与感', style: '年轻潮流' },
      { image: getImage('event-performance'), title: '话剧巡演开票', desc: '早鸟优惠 抢座开启', tag: '演出', theme: '话剧巡演开票', content: '突出演出时间、剧目亮点、开票信息和购票二维码', style: '高级简约', qrUrl: 'https://example.com/ticket' },
    ],
  },
  {
    key: 'course',
    name: '课程',
    cover: getImage('course-1'),
    prompt: '设计一张课程招生海报，突出课程卖点和报名引导',
    preset: 'course',
    purpose: '报名',
    industry: '课程',
    style: '清新温暖',
    sizeKey: 'wechat-cover',
    cards: [
      { image: getImage('course-python-poster'), title: 'Python训练营', desc: '零基础入门 七天见效', tag: '编程', theme: 'Python训练营', content: '突出课程收益、适合人群、开课时间和立即报名', style: '极简科技' },
      { image: getImage('course-writing-poster'), title: '新媒体写作课', desc: '打造爆款内容框架', tag: '写作', theme: '新媒体写作课', content: '突出课程大纲、内容框架、学员收获和报名入口', style: '清新温暖' },
      { image: getImage('course-3'), title: '外语速成班', desc: '语言教学学习课程', tag: '外语', theme: '外语速成班', content: '突出外语速成、课程亮点、学习收获和报名入口', style: '清新温暖' },
      { image: getImage('course-4'), imageFit: 'contain', imagePosition: 'center top', imageBlendBackground: true, title: 'MBA研修班', desc: '商务管理课程', tag: 'MBA', theme: 'MBA研修班', content: '突出商务管理、课程体系、核心能力提升和招生报名信息', style: '专业商务' },
      { image: getImage('course-english-poster'), title: '英语口语提升课', desc: '开口表达 更自信', tag: '英语', theme: '英语口语提升课', content: '突出口语场景训练、学习效果、报名时间和优惠信息', style: '清新温暖' },
    ],
  },
  {
    key: 'festival',
    name: '节日',
    cover: getImage('holiday-1'),
    prompt: '设计一张节日营销海报，突出节庆氛围和品牌传播感',
    preset: 'festival',
    purpose: '品牌宣传',
    industry: '节日',
    style: '国潮中式',
    sizeKey: 'moments',
    cards: [
      { image: getImage('holiday-1'), title: '新年焕新季', desc: '辞旧迎新 全场焕新', tag: '新年', theme: '新年焕新季', content: '设计一张新年营销海报，突出焕新氛围、节庆红金配色和品牌祝福感', style: '国潮中式', sizeKey: 'moments' },
      { image: getImage('holiday-4'), imageFit: 'contain', imagePosition: 'center top', imageBlendBackground: true, title: '情人节限定礼盒', desc: '心动礼遇 浪漫表达', tag: '情人节', theme: '情人节限定礼盒', content: '设计一张情人节礼盒海报，突出浪漫氛围、礼赠场景、品牌质感和转化引导', style: '法式优雅', sizeKey: 'xiaohongshu' },
      { image: getImage('holiday-2'), imageFit: 'contain', imagePosition: 'center top', imageBlendBackground: true, title: '中秋团圆好礼', desc: '月满人圆 传递心意', tag: '中秋', theme: '中秋团圆好礼', content: '设计一张中秋营销海报，突出团圆月色、中式雅致、礼盒表达和品牌传播感', style: '国潮中式', sizeKey: 'moments' },
      { image: getImage('holiday-nationalday-poster'), title: '欢度国庆 盛世华章', desc: '城市节庆 活动宣传', tag: '国庆', theme: '欢度国庆 盛世华章', content: '设计一张国庆主题海报，突出城市节庆氛围、红金主色和品牌活动传播', style: '国潮中式', sizeKey: 'moments' },
      { image: getImage('holiday-3'), title: '圣诞惊喜夜', desc: '暖心氛围 高级视觉', tag: '圣诞', theme: '圣诞惊喜夜', content: '设计一张圣诞营销海报，突出暖心氛围、节日灯光、高级视觉和品牌传播感', style: '轻奢质感', sizeKey: 'xiaohongshu' },
    ],
  },
  {
    key: 'fitness',
    name: '健身',
    cover: getImage('fitness-1'),
    prompt: '设计一张健身训练海报，突出课程强度、报名引导和运动氛围',
    preset: 'fitness',
    purpose: '报名',
    industry: '健身',
    style: '年轻潮流',
    sizeKey: 'xiaohongshu',
    cards: [
      { image: getImage('fitness-1'), title: '燃脂训练营', desc: '高强燃动 快速开练', tag: '减脂', theme: '燃脂训练营', content: '突出燃脂训练、训练强度、课程节奏和报名转化', style: '年轻潮流' },
      { image: getImage('fitness-2'), title: '瑜伽冥想课', desc: '沉浸放松 身心平衡', tag: '瑜伽', theme: '瑜伽冥想课', content: '突出放松疗愈、冥想氛围、课程安排和预约报名', style: '清新温暖' },
      { image: getImage('fitness-3'), title: '城市马拉松', desc: '热血开跑 挑战自我', tag: '跑步', theme: '城市马拉松', content: '突出跑步赛事、城市氛围、参与挑战和报名入口', style: '年轻潮流' },
      { image: getImage('fitness-4'), title: '一对一私教课程', desc: '定制方案 高效塑形', tag: '私教', theme: '一对一私教课程', content: '突出私教优势、塑形成果、体验课报名和信任感', style: '专业商务' },
      { image: getImage('fitness-dance-poster'), title: '街舞训练计划', desc: '释放热爱 舞动氛围', tag: '舞蹈', theme: '街舞训练计划', content: '突出节奏感、年轻潮流、课程时间和招募氛围', style: '潮酷街头' },
    ],
  },
  {
    key: 'catering',
    name: '餐饮',
    cover: getImage('food-1'),
    prompt: '设计一张餐饮上新海报，突出食欲感和到店转化',
    preset: 'food',
    purpose: '上新',
    industry: '餐饮',
    style: '活力促销',
    sizeKey: 'flyer',
    cards: [
      { image: getImage('food-1'), title: '招牌热菜推荐', desc: '烟火氛围 地道美味', tag: '中餐', theme: '招牌热菜推荐', content: '突出菜品卖相、门店烟火气、招牌卖点和到店引流', style: '活力促销' },
      { image: foodSecondFixed, title: '手作披萨美食季', desc: '现烤出炉 芝士拉满', tag: '披萨', theme: '手作披萨美食季', content: '突出披萨卖相、现烤口感、芝士层次和到店下单转化', style: '活力促销' },
      { image: foodCoffeeExact, title: '精品咖啡上新', desc: '今日特调 限时尝鲜', tag: '咖啡', theme: '精品咖啡上新', content: '突出新品特调、门店氛围、上新节奏和到店转化', style: '轻奢质感' },
      { image: getImage('food-4'), imageFit: 'contain', imagePosition: 'center top', imageBlendBackground: true, title: '甜品下午茶时光', desc: '绵密香甜 轻享治愈', tag: '甜品', theme: '甜品下午茶时光', content: '突出甜品质感、下午茶氛围、治愈感表达和到店消费转化', style: '轻奢质感' },
      { image: foodFifthFixed, title: '纸杯蛋糕上新', desc: '奶油轻盈 甜蜜加倍', tag: '蛋糕', theme: '纸杯蛋糕上新', content: '突出纸杯蛋糕卖相、奶油口感、上新节奏和甜品购买转化', style: '清新温暖' },
    ],
  },
]

const resolvedCategories = computed<ResolvedCategoryItem[]>(() => {
  const next = categories.map((category) => ({
    ...category,
    qrUrl: String(category.qrUrl || '').trim(),
    cards: category.cards.map((card) => resolveTemplateCard(category, card)),
  }))
  return next
})

const activeCategoryMeta = computed(() => resolvedCategories.value.find((item) => item.key === activeCategory.value) || resolvedCategories.value[0])

const enterpriseGallery: GalleryItem[] = [
  {
    image: getImage('enterprise-branding-mockup'),
    alt: '企业品牌设计物料',
    wide: true,
    badge: '品牌系统',
    title: '企业品牌物料',
    desc: '统一视觉延展，快速生成品牌应用场景',
  },
  {
    image: getImage('enterprise-team-discussion'),
    alt: '企业设计协作讨论',
    badge: '团队协作',
    title: '设计共创讨论',
    desc: '多人协作梳理方案，保持项目推进一致',
  },
  {
    image: getImage('enterprise-sticky-board'),
    alt: '品牌策略共创看板',
    badge: '策略规划',
    title: '项目策略看板',
    desc: '从需求拆解到执行节奏，信息更清晰',
  },
  {
    image: getImage('enterprise-presentation'),
    alt: '企业提案展示场景',
    wide: true,
    badge: '方案提报',
    title: '品牌方案提案',
    desc: '用于汇报、提审与对外展示的高完成度页面',
  },
  {
    image: getImage('enterprise-workshop'),
    alt: '企业工作坊研讨',
    badge: '工作坊',
    title: '跨团队设计研讨',
    desc: '在创意会议中快速统一方向和输出',
  },
  {
    image: getImage('enterprise-briefing'),
    alt: '品牌项目汇报',
    badge: '项目汇报',
    title: '阶段成果汇报',
    desc: '让设计成果更易讲清、更好落地',
  },
]

const socialGallery: GalleryItem[] = [
  {
    image: getImage('social-poster-video-series'),
    alt: '流媒体封面',
    badge: '长视频',
    title: '剧集封面设计',
    desc: '适合做高辨识度栏目视觉和连载封面',
  },
  {
    image: getImage('social-poster-note-cover'),
    alt: '社媒封面',
    badge: '图文种草',
    title: '社媒封面主图',
    desc: '高饱和视觉更适合首页停留和点击',
  },
  {
    image: getImage('social-poster-account-matrix'),
    alt: '办公内容',
    badge: '内容运营',
    title: '团队分发协作',
    desc: '从选题到发布，适配账号矩阵运营流程',
  },
  {
    image: getImage('social-poster-campaign-banner'),
    alt: '平台封面',
    badge: '社交传播',
    title: '平台频道包装',
    desc: '适合做话题页、活动页和社交入口视觉',
  },
  {
    image: getImage('social-poster-live-preview'),
    alt: '视频封面',
    badge: '短视频',
    title: '视频封面模板',
    desc: '用于视频首屏、系列栏目和爆款内容包装',
  },
  {
    image: getImage('social-poster-multi-channel'),
    alt: '传播封面',
    badge: '多平台',
    title: '内容传播矩阵',
    desc: '统一平台调性，提升跨渠道分发效率',
  },
]

function preloadCategoryAssets(category: ResolvedCategoryItem | undefined) {
  if (!category) return
  preloadImages([
    category.cover,
    ...category.cards.map((card) => card.image),
  ])
}

function preloadGalleryAssets(items: GalleryItem[], limit = items.length) {
  preloadImages(
    items.slice(0, limit).flatMap((item) => [
      item.image,
      ...(item.thumbs || []),
    ]),
  )
}

function pauseTemplateLoop() {
  stopTemplateCategoryAutoplay()
}

function resumeTemplateLoop() {
  startTemplateCategoryAutoplay()
}

function stopTemplateCategoryAutoplay() {
  if (templateCategoryAutoplayTimer !== null) {
    window.clearInterval(templateCategoryAutoplayTimer)
    templateCategoryAutoplayTimer = null
  }
}

function stepTemplateCategory() {
  const currentIndex = resolvedCategories.value.findIndex((item) => item.key === activeCategory.value)
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % resolvedCategories.value.length : 0
  const nextCategory = resolvedCategories.value[nextIndex]
  if (nextCategory) {
    activeCategory.value = nextCategory.key
  }
}

function startTemplateCategoryAutoplay() {
  stopTemplateCategoryAutoplay()
  templateCategoryAutoplayTimer = window.setInterval(() => {
    stepTemplateCategory()
  }, 6500)
}

function activateCategory(key: string) {
  activeCategory.value = key
  startTemplateCategoryAutoplay()
}

function navigateToAi(card: TemplateCard, category?: CategoryItem) {
  const sourceCategory = category || activeCategoryMeta.value
  const theme = String(card.theme || card.title || '').trim()
  const prompt = String(card.prompt || sourceCategory.prompt || theme).trim()
  if (!prompt && !theme) {
    ElMessage.warning('请先输入海报主题')
    return
  }

  void router.replace({
    path: '/home',
    query: {
      section: 'ai-poster',
      aiTheme: theme || prompt,
      aiPrompt: prompt,
      aiAutoGenerate: '1',
      aiPurpose: String(card.purpose || sourceCategory.purpose || '').trim(),
      aiIndustry: String(card.industry || sourceCategory.industry || '').trim(),
      aiStyle: String(card.style || sourceCategory.style || '').trim(),
      aiSizeKey: String(card.sizeKey || sourceCategory.sizeKey || '').trim(),
      aiQrUrl: String(card.qrUrl || sourceCategory.qrUrl || '').trim(),
      aiContent: String(card.content || card.desc || '').trim(),
      ...(sourceCategory.preset ? { preset: sourceCategory.preset } : {}),
    },
  })
}

function generateFromPrompt() {
  navigateToAi({
    image: '',
    title: promptText.value || activeCategoryMeta.value.name,
    desc: '',
    tag: activeCategoryMeta.value.name,
    prompt: promptText.value || activeCategoryMeta.value.prompt,
    theme: promptText.value || activeCategoryMeta.value.name,
    purpose: activeCategoryMeta.value.purpose,
    industry: activeCategoryMeta.value.industry,
    style: activeCategoryMeta.value.style,
    sizeKey: activeCategoryMeta.value.sizeKey,
    qrUrl: activeCategoryMeta.value.qrUrl || '',
    content: promptText.value || activeCategoryMeta.value.prompt,
  }, activeCategoryMeta.value)
}

function generateFromStickyPrompt() {
  generateFromPrompt()
}

function resizeTextarea(el: HTMLTextAreaElement | null, minHeight: number) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.max(minHeight, el.scrollHeight)}px`
}

watch(promptText, async () => {
  await nextTick()
  resizeTextarea(heroInputRef.value, 124)
  resizeTextarea(floatingInputRef.value, 98)
})

watch(
  () => activeCategoryMeta.value,
  (category) => {
    preloadCategoryAssets(category)
  },
  { immediate: true },
)

onMounted(() => {
  resizeTextarea(heroInputRef.value, 124)
  resizeTextarea(floatingInputRef.value, 98)
  preloadImages(categories.map((category) => category.cover))
  preloadGalleryAssets(enterpriseGallery, 2)
  preloadGalleryAssets(socialGallery, 2)
  startTemplateCategoryAutoplay()
  if (import.meta.env.DEV) {
    validateTemplateCategories(resolvedCategories.value)
  }
})

onBeforeUnmount(() => {
  stopTemplateCategoryAutoplay()
})
</script>

<style scoped lang="less">
.workspace-welcome {
  position: relative;
  min-height: 100%;
  background: linear-gradient(180deg, #eef7ff 0%, #f5f7ff 48%, #faf8ff 100%);
  overflow: hidden;
}

.welcome-scroll {
  height: 100%;
  overflow-y: auto;
  padding: 28px clamp(14px, 1.5vw, 22px) 210px;
}

.hero,
.template-tabs,
.showcase-block,
.footer {
  width: min(100%, 1480px);
  margin: 0 auto 42px;
}

.hero {
  position: relative;
  text-align: center;
  padding: 6px 0 26px;
}

.hero-glow {
  position: absolute;
  top: 46px;
  width: 320px;
  height: 220px;
  border-radius: 50%;
  filter: blur(24px);
  opacity: 0.8;
  pointer-events: none;
}

.hero-glow--left {
  left: 10%;
  background: radial-gradient(circle, rgba(110, 175, 255, 0.26) 0%, rgba(110, 175, 255, 0.08) 40%, transparent 74%);
}

.hero-glow--right {
  right: 10%;
  background: radial-gradient(circle, rgba(180, 141, 255, 0.26) 0%, rgba(180, 141, 255, 0.08) 40%, transparent 74%);
}

.hero__title {
  position: relative;
  z-index: 1;
  font-size: 52px;
  line-height: 1.16;
  font-weight: 800;
  letter-spacing: -0.04em;
  margin-bottom: 10px;
  color: #1f2a44;
}

.hero__subtitle {
  position: relative;
  z-index: 1;
  font-size: 20px;
  color: #6f7c97;
  margin-bottom: 26px;
}

.hero-input {
  position: relative;
  z-index: 1;
  max-width: 760px;
  margin: 0 auto;
}

.hero-input__field {
  width: 100%;
  min-height: 124px;
  resize: none;
  padding: 24px 24px 72px;
  border: 1px solid rgba(202, 213, 233, 0.72);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 10px 30px rgba(125, 144, 186, 0.12);
  color: #1f2a44;
  font-size: 16px;
  line-height: 1.7;
  outline: none;
}

.hero-input__field::placeholder,
.floating-entry__field::placeholder {
  color: #a0abc0;
}

.ai-entry-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 156px;
  min-height: 50px;
  padding: 10px 16px;
  border: 1px solid #2f58ad;
  border-radius: 16px;
  background: linear-gradient(135deg, #4d78cf 0%, #2e56aa 100%);
  color: #fff;
  cursor: pointer;
  box-shadow: 0 14px 30px rgba(54, 94, 175, 0.28);
  transition: 0.2s ease;
}

.ai-entry-button__content {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  text-align: center;
}

.ai-entry-button__title {
  display: block;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.15;
}

.ai-entry-button__meta {
  display: block;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.1;
  color: rgba(255, 255, 255, 0.86);
}

.hero-input__button {
  position: absolute;
  right: 18px;
  bottom: 16px;
}

.floating-entry__button {
  position: absolute;
  right: 16px;
  bottom: 14px;
}

.ai-entry-button--compact {
  min-width: 132px;
  min-height: 46px;
  padding: 8px 14px;
}

.hero-input__button:hover,
.floating-entry__button:hover {
  transform: translateY(-1px);
  filter: saturate(0.98);
}

.category-strip {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 14px;
  width: min(100%, 1320px);
  margin: 0 auto 30px;
}

.category-card {
  border: 1px solid rgba(210, 219, 236, 0.7);
  background: rgba(255, 255, 255, 0.74);
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 8px 22px rgba(84, 102, 145, 0.08);
  cursor: pointer;
  transition: 0.24s ease;
}

.category-card:hover {
  transform: translateY(-3px);
}

.category-card.is-active {
  border-color: rgba(146, 108, 255, 0.84);
  box-shadow: 0 12px 28px rgba(146, 108, 255, 0.16);
}

.category-card img {
  display: block;
  width: 100%;
  height: 104px;
  object-fit: cover;
  object-position: center;
  transform: scale(1.08);
  transform-origin: center;
}

.category-card span {
  display: block;
  padding: 12px 8px;
  background: rgba(255, 255, 255, 0.9);
  font-size: 15px;
  font-weight: 600;
  color: #394863;
}

.category-card.is-active span {
  color: #7e57ff;
  background: linear-gradient(180deg, #ffffff, #f6f1ff);
}

.template-tabs,
.showcase-block {
  width: min(100%, 1620px);
  margin: 0 auto 42px;
}

.tab-panel {
  display: block;
}

.template-cycle-enter-active,
.template-cycle-leave-active {
  transition:
    opacity 0.56s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.56s cubic-bezier(0.22, 1, 0.36, 1),
    filter 0.56s cubic-bezier(0.22, 1, 0.36, 1);
}

.template-cycle-enter-from {
  opacity: 0;
  transform: translate3d(20px, 0, 0) scale(0.988);
  filter: blur(6px);
}

.template-cycle-leave-to {
  opacity: 0;
  transform: translate3d(-20px, 0, 0) scale(0.988);
  filter: blur(6px);
}

.poster-grid {
  display: grid;
  gap: 30px;
}

.poster-grid--five {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.poster-card {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 22px;
  overflow: hidden;
  box-shadow: 0 8px 22px rgba(84, 102, 145, 0.08);
  transition: 0.24s ease;
  cursor: pointer;
}

.poster-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 18px 44px rgba(112, 108, 172, 0.12);
}

.poster-card__media {
  position: relative;
  aspect-ratio: 3 / 4;
  isolation: isolate;
}

.poster-card__media img {
  width: 100%;
  height: 100%;
}

.poster-card__foreground {
  object-fit: cover;
  object-position: center;
  position: relative;
  z-index: 1;
}

.poster-card__media--blended {
  background:
    radial-gradient(circle at top, rgba(255, 255, 255, 0.18), transparent 52%),
    linear-gradient(180deg, rgba(246, 248, 255, 0.92), rgba(236, 241, 252, 0.98));
}

.poster-card__bg {
  position: absolute;
  inset: 0;
  object-fit: cover;
  filter: blur(18px) saturate(1.08);
  transform: scale(1.16);
  opacity: 0.92;
}

.poster-card__media--blended::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.2));
  z-index: 0;
}

.poster-card__media--blended .poster-card__foreground {
  padding: 8px;
  object-fit: contain;
}

.poster-card__tag {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 2;
  padding: 6px 11px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.94);
  font-size: 12px;
  font-weight: 600;
  color: #687691;
}

.poster-card__info {
  padding: 14px 14px 15px;
}

.poster-card__info h3 {
  font-size: 18px;
  line-height: 1.35;
  margin-bottom: 6px;
  color: #1f2a44;
}

.poster-card__info p {
  font-size: 14px;
  color: #6f7c97;
}

.block-title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  margin-bottom: 20px;
}

.block-title h2 {
  font-size: 24px;
  font-weight: 500;
  color: #1f2a44;
}

.block-title__line {
  width: 120px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(164, 175, 198, 0.55), transparent);
}

.showcase-panel {
  display: flex;
  gap: 22px;
  padding: 22px 18px;
  background: rgba(255, 255, 255, 0.84);
  border: 1px solid rgba(221, 228, 243, 0.8);
  border-radius: 24px;
  box-shadow: 0 8px 22px rgba(84, 102, 145, 0.08);
}

.showcase-block--enterprise .showcase-panel {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(245, 248, 255, 0.92)),
    radial-gradient(circle at top left, rgba(88, 138, 255, 0.12), transparent 36%);
}

.showcase-block--social .showcase-panel {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(249, 246, 255, 0.92)),
    radial-gradient(circle at top right, rgba(255, 92, 140, 0.12), transparent 34%);
}

.showcase-panel__intro {
  width: 152px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
}

.showcase-panel__intro h3 {
  font-size: 28px;
  line-height: 1.3;
  margin-bottom: 10px;
  color: #1f2a44;
}

.showcase-panel__intro p {
  font-size: 15px;
  line-height: 1.8;
  color: #6f7c97;
}

.showcase-gallery {
  flex: 1;
  display: flex;
  gap: 18px;
  overflow-x: auto;
  padding-bottom: 6px;
  scrollbar-width: thin;
}

.gallery-card {
  position: relative;
  width: 206px;
  height: 336px;
  flex: 0 0 auto;
  border-radius: 22px;
  overflow: hidden;
  background: #ecf1fb;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.45);
}

.gallery-card--wide {
  width: 206px;
}

.gallery-card img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.gallery-card__overlay {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 18px 16px 16px;
  background: linear-gradient(180deg, rgba(10, 20, 46, 0) 0%, rgba(10, 20, 46, 0.78) 44%, rgba(10, 20, 46, 0.94) 100%);
  color: #fff;
}

.gallery-card__badge {
  display: inline-flex;
  align-items: center;
  padding: 5px 10px;
  margin-bottom: 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.22);
  backdrop-filter: blur(10px);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.92);
}

.gallery-card__overlay h4 {
  margin: 0 0 6px;
  font-size: 16px;
  line-height: 1.28;
  font-weight: 700;
}

.gallery-card__overlay p {
  margin: 0;
  font-size: 12px;
  line-height: 1.55;
  color: rgba(236, 241, 255, 0.82);
}

.gallery-card__thumbs {
  position: absolute;
  left: 10px;
  bottom: 10px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.gallery-card__thumbs img,
.gallery-card__thumbs span {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  border: 2px solid rgba(255, 255, 255, 0.98);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
}

.gallery-card__thumbs span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.92);
  color: #57667f;
  font-weight: 700;
}

.showcase-block--enterprise .gallery-card {
  background: linear-gradient(180deg, #dfe7f7, #edf2fb);
}

.showcase-block--enterprise .gallery-card img {
  transform: scale(1.06);
  transition: transform 0.35s ease;
}

.showcase-block--enterprise .gallery-card:hover img {
  transform: scale(1.1);
}

.showcase-block--enterprise .gallery-card__thumbs {
  display: none;
}

.showcase-block--social .gallery-card {
  background: linear-gradient(180deg, #efe9ff, #eff5ff);
}

.showcase-block--social .gallery-card img {
  transform: scale(1.05);
  transition: transform 0.35s ease;
}

.showcase-block--social .gallery-card:hover img {
  transform: scale(1.09);
}

.showcase-block--social .gallery-card__thumbs {
  display: none;
}

.showcase-block--social .gallery-card__overlay {
  background: linear-gradient(180deg, rgba(18, 17, 44, 0) 0%, rgba(22, 18, 52, 0.8) 48%, rgba(20, 16, 46, 0.96) 100%);
}

.showcase-block--social .gallery-card__badge {
  background: rgba(255, 255, 255, 0.18);
  border-color: rgba(255, 255, 255, 0.26);
}

.footer {
  text-align: center;
}

.footer__links {
  display: inline-flex;
  gap: 28px;
  margin-bottom: 10px;
}

.footer__links a {
  font-size: 14px;
  color: #73809a;
  text-decoration: none;
}

.footer__copy {
  font-size: 13px;
  color: #99a4ba;
}

.floating-entry {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 22px;
  z-index: 3;
  pointer-events: none;
}

.floating-entry__inner {
  max-width: 760px;
  margin: 0 auto;
  position: relative;
  pointer-events: auto;
}

.floating-entry__field {
  width: 100%;
  min-height: 98px;
  resize: none;
  border: 1px solid rgba(210, 220, 238, 0.8);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.96);
  padding: 20px 20px 58px;
  box-shadow: 0 14px 34px rgba(109, 123, 168, 0.12);
  outline: none;
}

@media (max-width: 1280px) {
  .poster-grid--five {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .category-strip {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 980px) {
  .showcase-panel {
    flex-direction: column;
  }

  .showcase-panel__intro {
    width: 100%;
  }
}

@media (max-width: 768px) {
  .welcome-scroll {
    padding: 22px 18px 96px;
  }

  .hero__title {
    font-size: 34px;
  }

  .hero__subtitle {
    font-size: 16px;
  }

  .category-strip,
  .poster-grid--five {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .footer__links {
    gap: 16px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .floating-entry {
    display: none;
  }
}

@media (max-width: 560px) {
  .welcome-scroll {
    padding-inline: 14px;
  }

  .category-strip,
  .poster-grid--five {
    grid-template-columns: 1fr;
  }

  .hero-input__field,
  .floating-entry__field {
    min-height: 112px;
  }
}
</style>
