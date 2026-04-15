<template>
  <div class="kunqiong-homepage">
    <header class="navbar">
      <div class="navbar-inner">
        <div class="navbar-left">
          <div class="logo">
            <span class="logo-text">鲲穹设计</span>
          </div>
        </div>
        <div class="navbar-right">
          <el-button v-if="!userStore.online" class="login-btn" @click="go('/login')">登录</el-button>
          <button v-else type="button" class="avatar-btn" @click="go('/account')">
            <img v-if="userAvatar" :src="userAvatar" alt="avatar" class="avatar-img" />
            <span v-else class="avatar-fallback">{{ userInitial }}</span>
          </button>
        </div>
      </div>
    </header>

    <section class="hero-section">
      <div class="hero-inner">
        <h1 class="hero-title">一句话，生成海报</h1>
        <p class="hero-subtitle">
          从创意灵感到成品海报，鲲穹设计让AI生成、在线编辑、高清导出一气呵成。支持电商促销、活动宣传、社交媒体、招聘求职等数十种场景，输入描述即可获得专业级海报。
        </p>
        <el-button class="hero-cta-btn" size="large" @click="goToEditorHome">免费开始</el-button>
        <div class="hero-media">
          <div class="hero-media-wrapper">
            <img :src="heroBanner" alt="Hero Banner" class="hero-media-img" />
          </div>
        </div>
      </div>
    </section>

    <section class="template-section">
      <div class="section-inner">
        <h2 class="section-title">AI搭配海量模板，海报设计从未如此简单</h2>
        <div class="tab-bar">
          <div
            v-for="(tab, index) in tabs"
            :key="index"
            class="tab-item"
            :class="{ active: activeTab === tab }"
            @click="activeTab = tab"
          >
            {{ tab }}
          </div>
        </div>

        <transition name="template-switch" mode="out-in">
          <div class="template-cards" :key="activeTab">
          <div
            v-for="(card, index) in templateCards"
            :key="index"
            class="template-card"
            :class="'card-' + card.theme"
          >
            <div class="card-bg">
              <img :src="card.image" :alt="card.title" />
            </div>
            <div class="card-overlay"></div>
            <div class="card-content">
              <span v-if="card.badge" class="card-badge" :class="'badge-' + card.badgeType">{{ card.badge }}</span>
              <h3 class="card-title">{{ card.title }}</h3>
            </div>
            <div class="card-brand-bar">
              <span class="brand-name">鲲穹设计</span>
              <span class="brand-desc">AI智能海报工具</span>
            </div>
          </div>
          </div>
        </transition>
      </div>
    </section>

    <section class="ai-section">
      <div class="section-inner">
        <h2 class="section-title">描述你想要的海报，AI帮你一键生成</h2>
        <p class="section-desc">
          输入主题描述，AI 自动生成多版式海报初稿。支持 25 种设计风格，一键切换！无需设计经验，也能轻松做出专业海报，让 AI 成为你的专属设计师。
        </p>

        <div class="ai-search-area">
          <div class="ai-search-box">
            <el-icon class="search-icon"><Search /></el-icon>
            <input
              v-model="aiPrompt"
              type="text"
              class="ai-search-input"
              placeholder="描述你的海报主题，例如：春季健身房招新海报"
              @keyup.enter="generatePosterFromHome"
            />
            <el-icon v-if="aiPrompt" class="clear-icon" @click="aiPrompt = ''"><CircleClose /></el-icon>
          </div>
          <el-button class="ai-generate-btn" round @click="generatePosterFromHome">
            <el-icon style="margin-right: 6px;"><MagicStick /></el-icon>
            生成海报
          </el-button>
        </div>

        <div class="ai-preview-area">
          <div class="ai-preview-main">
            <transition name="ai-image-fade" mode="out-in">
              <img :key="currentAiImage" :src="currentAiImage" alt="AI Generated" class="ai-preview-img" />
            </transition>
          </div>
          <div class="ai-style-chips">
            <div
              v-for="(style, index) in aiStyles"
              :key="index"
              class="style-chip"
              :class="{ active: activeStyle === index }"
              @click="activeStyle = index"
            >
              <div class="style-thumb">
                <img v-if="style.image" :src="style.image" :alt="style.label" />
                <div v-else class="style-placeholder">
                  <el-icon :size="16"><Plus /></el-icon>
                </div>
              </div>
              <span class="style-label">{{ style.label }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="enterprise-section">
      <div class="section-inner">
        <h2 class="section-title">企业级AI海报解决方案</h2>
        <p class="section-desc enterprise-desc">
          专为企业打造的AI海报创作平台，助力你的团队高效生成、管理与发布统一品牌风格的海报内容。
          <a href="javascript:void(0)" class="purple-link" @click="go('/home')">点击这里</a>
          定制你的企业解决方案
        </p>

        <div class="enterprise-cards">
          <div class="enterprise-card" v-for="(card, index) in enterpriseCards" :key="index">
            <div class="enterprise-card-img">
              <img :src="card.image" :alt="card.title" />
            </div>
            <div class="enterprise-card-content">
              <span class="enterprise-badge">高级版👑</span>
              <h3 class="enterprise-card-title">{{ card.title }}</h3>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import useUserStore from '@/store/base/user'
import { Menu, Search, CircleClose, MagicStick, Plus } from '@element-plus/icons-vue'
import aiPosterDoodleExact from '@/assets/homepage/ai-poster-doodle.jpg'
import aiPosterPhotoExact from '@/assets/homepage/ai-poster-photo.jpg'
import aiPosterSurrealExact from '@/assets/homepage/ai-poster-surreal.jpg'
import aiPosterWatercolorExact from '@/assets/homepage/ai-poster-watercolor.jpg'

const router = useRouter()
const userStore = useUserStore()
const userAvatar = computed(() => (userStore.user.avatar || '').trim())
const userInitial = computed(() => (userStore.user.name || '我').slice(0, 1))

const rawImageModules = import.meta.glob('../assets/homepage/*.jpg', { eager: true }) as Record<string, { default: string }>
const imageModules: Record<string, string> = Object.fromEntries(
  Object.entries(rawImageModules).map(([key, mod]) => [key, mod.default]),
)
const getImageByPrefix = (prefix: string) => {
  const key = Object.keys(imageModules).find((k) => k.includes(`${prefix}-`))
  return key ? imageModules[key] : ''
}

const heroBanner = getImageByPrefix('hero-banner')
const ecom1 = getImageByPrefix('ecom-1')
const ecom2 = getImageByPrefix('ecom-2')
const ecom3 = getImageByPrefix('ecom-3')
const ecom4 = getImageByPrefix('ecom-4')
const recruit1 = getImageByPrefix('recruit-1')
const recruit2 = getImageByPrefix('recruit-2')
const recruit3 = getImageByPrefix('recruit-3')
const recruit4 = getImageByPrefix('recruit-4')
const event1 = getImageByPrefix('event-1')
const event2 = getImageByPrefix('event-2')
const event3 = getImageByPrefix('event-3')
const event4 = getImageByPrefix('event-4')
const course1 = getImageByPrefix('course-1')
const course2 = getImageByPrefix('course-2')
const course3 = getImageByPrefix('course-3')
const course4 = getImageByPrefix('course-4')
const holiday1 = getImageByPrefix('holiday-1')
const holiday2 = getImageByPrefix('holiday-2')
const holiday3 = getImageByPrefix('holiday-3')
const holiday4 = getImageByPrefix('holiday-4')
const fitness1 = getImageByPrefix('fitness-1')
const fitness2 = getImageByPrefix('fitness-2')
const fitness3 = getImageByPrefix('fitness-3')
const fitness4 = getImageByPrefix('fitness-4')
const food1 = getImageByPrefix('food-1')
const food2 = getImageByPrefix('food-2')
const food3 = getImageByPrefix('food-3')
const food4 = getImageByPrefix('food-4')
const aiPosterPhoto = aiPosterPhotoExact
const aiPosterWatercolor = aiPosterWatercolorExact
const aiPosterDoodle = aiPosterDoodleExact
const aiPosterSurreal = aiPosterSurrealExact
const enterprise1 = getImageByPrefix('enterprise-1')
const enterprise2 = getImageByPrefix('enterprise-2')
const enterprise3 = getImageByPrefix('enterprise-3')

const activeTab = ref('电商')
const tabs = ['电商', '招聘', '活动', '课程', '节日', '健身', '餐饮']
const categoryCards = {
  电商: [
    { image: ecom1, title: '限时秒杀，全场低至3折', badge: '热门', badgeType: 'hot', theme: 'ecommerce' },
    { image: ecom2, title: '双十一狂欢购物节', badge: null, badgeType: null, theme: 'ecommerce' },
    { image: ecom3, title: '新品首发限量抢购', badge: '新上线', badgeType: 'new', theme: 'ecommerce' },
    { image: ecom4, title: '清仓特卖最后三天', badge: null, badgeType: null, theme: 'ecommerce' },
  ],
  招聘: [
    { image: recruit1, title: '高薪诚聘技术精英', badge: '热门', badgeType: 'hot', theme: 'recruit' },
    { image: recruit2, title: '寻找创意设计达人', badge: null, badgeType: null, theme: 'recruit' },
    { image: recruit3, title: '校园招聘应届生专场', badge: null, badgeType: null, theme: 'recruit' },
    { image: recruit4, title: '销售精英高提成招募', badge: null, badgeType: null, theme: 'recruit' },
  ],
  活动: [
    { image: event1, title: '夏日音乐节盛大开幕', badge: '热门', badgeType: 'hot', theme: 'event' },
    { image: event2, title: '周末创意市集招募', badge: null, badgeType: null, theme: 'event' },
    { image: event3, title: '年会盛典邀您参加', badge: null, badgeType: null, theme: 'event' },
    { image: event4, title: '城市运动嘉年华', badge: '新上线', badgeType: 'new', theme: 'event' },
  ],
  课程: [
    { image: course1, title: '编程训练营零基础入学', badge: '推荐', badgeType: 'new', theme: 'course' },
    { image: course2, title: '摄影大师课限时免费', badge: null, badgeType: null, theme: 'course' },
    { image: course3, title: '外语速成班报名中', badge: null, badgeType: null, theme: 'course' },
    { image: course4, title: 'MBA研修班招生开启', badge: null, badgeType: null, theme: 'course' },
  ],
  节日: [
    { image: holiday1, title: '新年快乐龙年大吉', badge: '热门', badgeType: 'hot', theme: 'holiday' },
    { image: holiday2, title: '中秋团圆佳节祝福', badge: null, badgeType: null, theme: 'holiday' },
    { image: holiday3, title: '圣诞狂欢派对邀请', badge: null, badgeType: null, theme: 'holiday' },
    { image: holiday4, title: '浪漫情人节特辑', badge: '新上线', badgeType: 'new', theme: 'holiday' },
  ],
  健身: [
    { image: fitness1, title: '燃脂训练营火热报名', badge: '热门', badgeType: 'hot', theme: 'fitness' },
    { image: fitness2, title: '瑜伽冥想放松身心', badge: null, badgeType: null, theme: 'fitness' },
    { image: fitness3, title: '城市马拉松挑战赛', badge: null, badgeType: null, theme: 'fitness' },
    { image: fitness4, title: '私教一对一专属定制', badge: null, badgeType: null, theme: 'fitness' },
  ],
  餐饮: [
    { image: food1, title: '招牌美食限时特惠', badge: '热门', badgeType: 'hot', theme: 'food' },
    { image: food2, title: '精品咖啡新品上市', badge: null, badgeType: null, theme: 'food' },
    { image: food3, title: '奶茶上新第二杯半价', badge: '新上线', badgeType: 'new', theme: 'food' },
    { image: food4, title: '烘焙甜品下午茶时光', badge: null, badgeType: null, theme: 'food' },
  ],
}
const templateCards = computed(() => categoryCards[activeTab.value as keyof typeof categoryCards] || [])
const aiPrompt = ref('')
const activeStyle = ref(0)
const aiStyles = [
  { label: '照片', image: aiPosterPhoto },
  { label: '水彩', image: aiPosterWatercolor },
  { label: '涂鸦', image: aiPosterDoodle },
  { label: '超现实', image: aiPosterSurreal },
]
const currentAiImage = computed(() => aiStyles[activeStyle.value]?.image || aiPosterPhoto)
const enterpriseCards = [
  { image: enterprise1, title: '一个平台搞定所有海报需求，轻松应对各类场景。' },
  { image: enterprise2, title: '统一品牌视觉，确保每张海报都专业一致。' },
  { image: enterprise3, title: '企业级安全保障，设计数据隐私无忧。' },
]

function go(path: string) {
  router.push(path)
}

/** 仅进入编辑器，不触发 AI 自动生成海报 */
function goToEditorHome() {
  router.push({ path: '/home' })
}

/** 带主题进入编辑器并触发一键生成（需非空描述） */
function openAiInEditorWithGenerate(theme: string) {
  const q = String(theme || '').trim()
  if (!q) return
  router.push({
    path: '/home',
    query: { aiTheme: q, aiPrompt: q, aiAutoGenerate: '1' },
  })
}

function generatePosterFromHome() {
  const q = String(aiPrompt.value || '').trim()
  if (!q) {
    ElMessage.warning('请先输入海报主题或描述')
    return
  }
  openAiInEditorWithGenerate(q)
}

function openAiWithTheme(theme: string) {
  openAiInEditorWithGenerate(theme)
}

let templateRotateTimer: number | undefined
let aiRotateTimer: number | undefined

onMounted(() => {
  templateRotateTimer = window.setInterval(() => {
    const currentIndex = tabs.indexOf(activeTab.value)
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % tabs.length : 0
    activeTab.value = tabs[nextIndex]
  }, 3600)

  aiRotateTimer = window.setInterval(() => {
    activeStyle.value = (activeStyle.value + 1) % aiStyles.length
  }, 3200)
})

onBeforeUnmount(() => {
  if (templateRotateTimer) window.clearInterval(templateRotateTimer)
  if (aiRotateTimer) window.clearInterval(aiRotateTimer)
})
</script>

<style scoped>
.kunqiong-homepage{font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei','Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;color:#1a1a1a;overflow-x:hidden}
.navbar{position:fixed;top:0;left:0;right:0;z-index:1000;background:#fff;height:64px;border-bottom:1px solid rgba(0,0,0,.06)}
.navbar-inner{max-width:none;width:100%;margin:0;padding:0 24px 0 18px;height:64px;display:flex;align-items:center;justify-content:space-between}
.navbar-left{display:flex;align-items:center;gap:12px}.hamburger-icon{cursor:pointer;color:#333}
.logo{display:flex;align-items:center;gap:4px;cursor:pointer}
.logo-text{font-size:32px;font-weight:700;line-height:1;letter-spacing:.5px;font-family:'Segoe Script','Brush Script MT','STKaiti','KaiTi','PingFang SC',cursive;background:linear-gradient(90deg,#00bcd4 0%,#7b2ff7 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.login-btn{background:linear-gradient(135deg,#7B2FF7,#A855F7)!important;color:#fff!important;border:none!important;border-radius:8px;padding:8px 24px;font-size:14px;font-weight:500;height:36px;cursor:pointer;transition:opacity .2s}.login-btn:hover{opacity:.9}
.avatar-btn{width:40px;height:40px;border:none;border-radius:50%;padding:0;overflow:hidden;cursor:pointer;display:flex;align-items:center;justify-content:center;background:#fff;box-shadow:0 2px 10px rgba(15,23,42,.14)}
.avatar-img{width:100%;height:100%;object-fit:cover;display:block}
.avatar-fallback{font-size:15px;font-weight:700;color:#475569}
.hero-section{padding-top:64px;background:linear-gradient(180deg,#3B82F6 0%,#8B5CF6 35%,#A855F7 70%,#EC4899 100%);min-height:100vh;display:flex;align-items:center;justify-content:center}
.hero-inner{max-width:960px;margin:0 auto;padding:80px 40px 60px;text-align:center;display:flex;flex-direction:column;align-items:center}
.hero-title{font-size:52px;font-weight:700;color:#fff;margin-bottom:20px;line-height:1.2;letter-spacing:-.5px}
.hero-subtitle{font-size:16px;color:rgba(255,255,255,.9);max-width:720px;line-height:1.7;margin-bottom:32px}
.hero-cta-btn{background:#fff!important;color:#1a1a1a!important;border:none!important;border-radius:12px;padding:14px 32px;font-size:16px;font-weight:600;height:auto;cursor:pointer;margin-bottom:48px;transition:transform .2s,box-shadow .2s}
.hero-cta-btn:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.15)}
.hero-media{width:100%;max-width:860px}.hero-media-wrapper{position:relative;border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.25)}.hero-media-img{width:100%;display:block;object-fit:cover;aspect-ratio:16/9}
.section-inner{max-width:1280px;margin:0 auto;padding:0 40px}.section-title{font-size:36px;font-weight:700;color:#1a1a1a;text-align:center;margin-bottom:16px;line-height:1.3}.section-desc{font-size:16px;color:#666;text-align:center;max-width:640px;margin:0 auto 40px;line-height:1.7}
.template-section{background:#fff;padding:80px 0}.tab-bar{display:flex;justify-content:center;margin-bottom:40px;flex-wrap:wrap;gap:8px}.tab-item{padding:10px 24px;font-size:14px;color:#555;cursor:pointer;border:1px solid #E8E8E8;border-radius:28px;transition:all .25s;user-select:none;white-space:nowrap}.tab-item.active{background:linear-gradient(135deg,#00C4CC,#7B2FF7);color:#fff;border-color:transparent}
.template-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:20px}.template-card{position:relative;border-radius:16px;overflow:hidden;cursor:pointer;transition:transform .3s,box-shadow .3s;min-height:380px;display:flex;flex-direction:column}.template-card:hover{transform:translateY(-6px);box-shadow:0 16px 48px rgba(0,0,0,.15)}
.card-bg,.card-overlay{position:absolute;inset:0}.card-bg{z-index:0}.card-bg img{width:100%;height:100%;object-fit:cover;display:block}.card-overlay{z-index:1}.card-ecommerce .card-overlay{background:linear-gradient(180deg,rgba(220,38,38,.15) 0%,rgba(220,38,38,.75) 100%)}.card-recruit .card-overlay{background:linear-gradient(180deg,rgba(37,99,235,.1) 0%,rgba(37,99,235,.7) 100%)}.card-event .card-overlay{background:linear-gradient(180deg,rgba(22,163,74,.1) 0%,rgba(22,163,74,.7) 100%)}.card-course .card-overlay{background:linear-gradient(180deg,rgba(123,47,247,.1) 0%,rgba(123,47,247,.75) 100%)}.card-holiday .card-overlay{background:linear-gradient(180deg,rgba(234,88,12,.1) 0%,rgba(234,88,12,.7) 100%)}.card-fitness .card-overlay{background:linear-gradient(180deg,rgba(15,23,42,.1) 0%,rgba(15,23,42,.75) 100%)}.card-food .card-overlay{background:linear-gradient(180deg,rgba(217,119,6,.1) 0%,rgba(217,119,6,.7) 100%)}
.card-content{position:relative;z-index:2;padding:28px 24px;flex:1;display:flex;flex-direction:column;justify-content:flex-end;color:#fff}.card-badge{display:inline-block;padding:4px 12px;border-radius:6px;font-size:12px;font-weight:600;margin-bottom:12px;width:fit-content;background:rgba(255,255,255,.25);backdrop-filter:blur(4px)}.card-title{font-size:20px;font-weight:700;line-height:1.4;margin-bottom:16px;text-shadow:0 1px 4px rgba(0,0,0,.2)}.card-btn{background:rgba(255,255,255,.95)!important;color:#1a1a1a!important;border:none!important;font-size:14px;font-weight:600;padding:10px 24px;height:auto;width:fit-content}.card-brand-bar{position:relative;z-index:2;display:flex;justify-content:space-between;align-items:center;padding:10px 24px;background:rgba(0,0,0,.15);backdrop-filter:blur(8px);font-size:12px;color:rgba(255,255,255,.85)}.brand-name{color:#00C4CC;font-weight:600}.brand-desc{color:rgba(255,255,255,.6)}
.ai-section{background:#F5F5F7;padding:80px 0}.ai-search-area{display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:48px;max-width:640px;margin-left:auto;margin-right:auto}.ai-search-box{flex:1;display:flex;align-items:center;background:#fff;border:2px solid #E8E8E8;border-radius:50px;padding:0 20px;height:48px}.search-icon{color:#999;margin-right:10px}.ai-search-input{flex:1;border:none;outline:none;font-size:14px;color:#333;background:transparent;height:100%}.clear-icon{color:#ccc;cursor:pointer}.ai-generate-btn{background:#7B2FF7!important;border-color:#7B2FF7!important;color:#fff!important;font-size:14px;font-weight:600;padding:12px 28px;height:48px;border-radius:50px!important;white-space:nowrap}
.ai-preview-area{max-width:640px;margin:0 auto}.ai-preview-main{border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.1);margin-bottom:24px}.ai-preview-img{width:100%;display:block;aspect-ratio:4/3;object-fit:cover}.ai-style-chips{display:flex;justify-content:center;gap:16px;flex-wrap:wrap}.style-chip{display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer}.style-thumb{width:64px;height:64px;border-radius:12px;overflow:hidden;border:2px solid transparent}.style-chip.active .style-thumb{border-color:#7B2FF7}.style-thumb img{width:100%;height:100%;object-fit:cover;display:block}.style-placeholder{width:100%;height:100%;background:#E8E8E8;display:flex;align-items:center;justify-content:center;color:#999}.style-label{font-size:13px;color:#555;font-weight:500}.style-chip.active .style-label{color:#7B2FF7;font-weight:600}
.enterprise-section{background:#fff;padding:80px 0}.enterprise-desc{max-width:700px}.purple-link{color:#7B2FF7;text-decoration:none;font-weight:500;cursor:pointer}.enterprise-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}.enterprise-card{background:#E8F5E9;border-radius:16px;overflow:hidden}.enterprise-card-img{width:100%;aspect-ratio:16/10;overflow:hidden}.enterprise-card-img img{width:100%;height:100%;object-fit:cover}.enterprise-card-content{padding:24px}.enterprise-badge{display:inline-block;font-size:12px;font-weight:600;color:#7B2FF7;margin-bottom:12px}.enterprise-card-title{font-size:16px;font-weight:600;color:#1a1a1a;line-height:1.6;margin-bottom:16px}.enterprise-btn{background:#fff!important;color:#1a1a1a!important;border:1px solid #E0E0E0!important}
.template-switch-enter-active,.template-switch-leave-active{transition:opacity .35s ease}
.template-switch-enter-from,.template-switch-leave-to{opacity:0}
.ai-image-fade-enter-active,.ai-image-fade-leave-active{transition:opacity .55s ease,transform .55s ease}
.ai-image-fade-enter-from,.ai-image-fade-leave-to{opacity:0;transform:scale(1.015)}
@media (max-width:1024px){.template-cards{grid-template-columns:repeat(2,1fr)}.enterprise-cards{grid-template-columns:repeat(2,1fr)}.hero-title{font-size:42px}.section-title{font-size:30px}}
@media (max-width:768px){.navbar-inner{padding-left:12px;padding-right:16px}.section-inner,.hero-inner{padding-left:20px;padding-right:20px}.hero-title{font-size:36px}.template-cards,.enterprise-cards{grid-template-columns:1fr}.ai-search-area{flex-direction:column}.ai-search-box,.ai-generate-btn{width:100%}}
@media (max-width:768px){
  .navbar{height:56px}
  .navbar-inner{height:56px;padding-left:12px;padding-right:12px}
  .logo-text{font-size:24px}
  .login-btn{height:32px;padding:6px 14px;font-size:13px}
  .avatar-btn{width:34px;height:34px}
  .hero-section{padding-top:56px;min-height:auto}
  .hero-inner{padding-top:42px;padding-bottom:36px}
  .hero-title{font-size:30px;line-height:1.25;margin-bottom:12px}
  .hero-subtitle{font-size:14px;line-height:1.6;margin-bottom:20px}
  .hero-cta-btn{margin-bottom:24px;padding:11px 20px;border-radius:10px}
  .hero-media-wrapper{border-radius:12px;box-shadow:0 12px 30px rgba(0,0,0,.2)}
  .section-inner{padding-left:14px;padding-right:14px}
  .template-section,.ai-section,.enterprise-section{padding:46px 0}
  .section-title{font-size:24px;margin-bottom:10px}
  .section-desc{font-size:14px;line-height:1.6;margin-bottom:24px}
  .tab-bar{justify-content:flex-start;flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:4px;margin-bottom:18px}
  .tab-bar::-webkit-scrollbar{display:none}
  .tab-item{flex:0 0 auto;padding:8px 16px}
  .template-cards{gap:12px}
  .template-card{min-height:300px;border-radius:12px}
  .card-content{padding:18px 16px}
  .card-title{font-size:17px;margin-bottom:10px}
  .card-brand-bar{padding:8px 14px;font-size:11px}
  .ai-search-area{gap:10px;margin-bottom:26px}
  .ai-search-box{height:44px;padding:0 14px}
  .ai-generate-btn{height:44px;padding:10px 18px;font-size:13px}
  .ai-preview-main{margin-bottom:14px;border-radius:14px}
  .ai-style-chips{justify-content:flex-start;overflow-x:auto;flex-wrap:nowrap;padding:2px 2px 6px}
  .style-chip{flex:0 0 auto}
  .style-thumb{width:54px;height:54px}
  .enterprise-cards{gap:12px}
  .enterprise-card{border-radius:12px}
  .enterprise-card-content{padding:14px}
  .enterprise-card-title{font-size:14px;line-height:1.5;margin-bottom:0}
}
@media (max-width:480px){
  .hero-title{font-size:26px}
  .hero-subtitle{font-size:13px}
  .section-title{font-size:22px}
  .template-card{min-height:270px}
  .style-thumb{width:48px;height:48px}
  .style-label{font-size:12px}
}
</style>
