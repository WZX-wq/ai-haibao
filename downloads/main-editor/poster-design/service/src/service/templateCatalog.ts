type TemplateCategory = {
  id: number
  name: string
  type: number
  pid: null
}

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import axiosClient from 'axios'
import { getClientSiteRootUrl, getClientStaticBaseUrl } from '../utils/clientPublicUrl'

type TemplateListItem = {
  id: number
  cover: string
  thumb?: string
  title: string
  width: number
  height: number
  state: number
  cate: number
}

type TemplateDetail = {
  id: string
  data: string
  title: string
  width: number
  height: number
}

type TemplateSeed = {
  id: number
  cate: number
  title: string
  subtitle: string
  body: string
  cta: string
  width: number
  height: number
  background: string
  primary: string
  accent: string
  text: string
  tag: string
  fullTitle: string
  layout?: 'hero' | 'split' | 'cards' | 'price' | 'collage' | 'editorial'
  /** 主图；缺省时按分类从图库轮换 */
  heroImageUrl?: string
  /** 画布渐变，CSS linear-gradient；缺省由主题色生成 */
  pageGradient?: string
}
type SmartTemplateContext = {
  theme?: string
  purpose?: string
  style?: string
  sizeKey?: string
  content?: string
  industry?: string
  presetKey?: string
}

function normalizeSeedLayoutToEngine(layout?: TemplateSeed['layout']) {
  const raw = String(layout || '').trim()
  const map: Record<string, string> = {
    hero: 'hero-left',
    split: 'split-editorial',
    cards: 'grid-product',
    price: 'premium-offer',
    collage: 'festive-frame',
    editorial: 'magazine-cover',
  }
  return map[raw] || 'hero-left'
}

/** Unsplash 可外链图，按行业轮换，接近成熟模板库的“主视觉”层次 */
const DEFAULT_HERO_BY_CATE: Record<number, string[]> = {
  1: [
    'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1472851294608-062f824d9cc0?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1607082348824-0a96f2a48b28?auto=format&fit=crop&w=1400&q=80',
  ],
  2: [
    'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&w=1400&q=80',
  ],
  3: [
    'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1400&q=80',
  ],
  4: [
    'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1400&q=80',
  ],
  5: [
    'https://images.unsplash.com/photo-1512389142860-9c449e58a543?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1482517967863-00e15c9b44be?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1513885535751-8b9238bd345a?auto=format&fit=crop&w=1400&q=80',
  ],
  6: [
    'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1400&q=80',
  ],
  7: [
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1400&q=80',
  ],
  8: [
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?auto=format&fit=crop&w=1400&q=80',
  ],
}

function resolveHeroImageUrl(seed: TemplateSeed): string {
  if (seed.heroImageUrl) return seed.heroImageUrl
  const pool = DEFAULT_HERO_BY_CATE[seed.cate] || DEFAULT_HERO_BY_CATE[1]
  return pool[seed.id % pool.length]
}

function resolvePageGradient(seed: TemplateSeed): string {
  if (seed.pageGradient) return seed.pageGradient
  return `linear-gradient(168deg, ${seed.background} 0%, #ffffff 40%, ${seed.accent}55 78%, ${seed.primary}25 100%)`
}

function allowRemoteTemplateHeroes() {
  // 预构建部署默认不依赖本地缓存目录，避免 /static/template-hero/*.jpg 在新环境中 404。
  return String(process.env.TEMPLATE_HERO_REMOTE || 'direct') // cache | direct | false
}

const HERO_CACHE_DIR = path.join(process.cwd(), 'static', 'template-hero')
const heroDownloadQueue = new Map<string, Promise<string>>()

function ensureHeroCacheDir() {
  if (!fs.existsSync(HERO_CACHE_DIR)) fs.mkdirSync(HERO_CACHE_DIR, { recursive: true })
}

function hashUrl(url: string) {
  return crypto.createHash('sha1').update(url).digest('hex').slice(0, 16)
}

function guessExt(url: string, contentType?: string) {
  const ct = String(contentType || '').toLowerCase()
  if (ct.includes('jpeg')) return 'jpg'
  if (ct.includes('png')) return 'png'
  if (ct.includes('webp')) return 'webp'
  const m = url.match(/\.(jpg|jpeg|png|webp)(\?.*)?$/i)
  if (m?.[1]) return m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase()
  return 'jpg'
}

function getHeroCachePath(remoteUrl: string) {
  const key = hashUrl(remoteUrl)
  // 先用 .jpg 占位；下载完成会写成真实 ext（同 key 不同 ext）
  return { key, base: path.join(HERO_CACHE_DIR, key) }
}

function getCachedHeroUrlIfExists(remoteUrl: string) {
  const { base, key } = getHeroCachePath(remoteUrl)
  const exts = ['jpg', 'png', 'webp']
  for (const ext of exts) {
    const p = `${base}.${ext}`
    if (fs.existsSync(p)) return `${getClientStaticBaseUrl()}template-hero/${key}.${ext}`
  }
  return ''
}

async function downloadHeroToCache(remoteUrl: string) {
  if (heroDownloadQueue.has(remoteUrl)) return heroDownloadQueue.get(remoteUrl)!
  ensureHeroCacheDir()
  const task = (async () => {
    const exists = getCachedHeroUrlIfExists(remoteUrl)
    if (exists) return exists
    const res = await axiosClient.get(remoteUrl, { responseType: 'arraybuffer', timeout: 120000 })
    const ext = guessExt(remoteUrl, res.headers?.['content-type'])
    const { base, key } = getHeroCachePath(remoteUrl)
    const target = `${base}.${ext}`
    fs.writeFileSync(target, Buffer.from(res.data))
    return `${getClientStaticBaseUrl()}template-hero/${key}.${ext}`
  })().finally(() => {
    heroDownloadQueue.delete(remoteUrl)
  })
  heroDownloadQueue.set(remoteUrl, task)
  return task
}

function resolveHeroAssetUrl(seed: TemplateSeed): { url: string; isRemote: boolean } {
  const heroUrl = resolveHeroImageUrl(seed)
  const isRemoteUrl = /^https?:\/\//i.test(heroUrl)
  const mode = allowRemoteTemplateHeroes()
  if (!isRemoteUrl || mode === 'false') return { url: '', isRemote: false }
  if (mode === 'direct') return { url: heroUrl, isRemote: true }
  // cache: 优先返回本地缓存；没有就后台下载，先用占位图
  const cached = getCachedHeroUrlIfExists(heroUrl)
  if (cached) return { url: cached, isRemote: true }
  void downloadHeroToCache(heroUrl).catch(() => undefined)
  return { url: '', isRemote: false }
}

function makeTemplateCoverScreenshotUrl(seed: TemplateSeed) {
  // 让左侧模板缩略图与画布显示保持一致：直接截 draw 渲染结果
  const params = new URLSearchParams({
    tempid: String(seed.id),
    width: String(seed.width),
    height: String(seed.height),
    // 用 file（png）避免 Windows 下 cover(jpg) 压缩依赖崩溃
    type: 'file',
    index: '0',
  })
  const root = getClientSiteRootUrl()
  const path = `api/screenshots?${params.toString()}`
  return root.endsWith('/') ? `${root}${path}` : `${root}/${path}`
}

const categories: TemplateCategory[] = [
  {
    "id": 1,
    "name": "电商",
    "type": 1,
    "pid": null
  },
  {
    "id": 2,
    "name": "招聘",
    "type": 1,
    "pid": null
  },
  {
    "id": 3,
    "name": "活动",
    "type": 1,
    "pid": null
  },
  {
    "id": 4,
    "name": "课程",
    "type": 1,
    "pid": null
  },
  {
    "id": 5,
    "name": "节日",
    "type": 1,
    "pid": null
  },
  {
    "id": 6,
    "name": "健身",
    "type": 1,
    "pid": null
  },
  {
    "id": 7,
    "name": "餐饮",
    "type": 1,
    "pid": null
  },
  {
    "id": 8,
    "name": "小红书封面",
    "type": 1,
    "pid": null
  }
]

const templateSeeds: TemplateSeed[] = [
  {
    "id": 101,
    "cate": 1,
    "title": "好物推荐",
    "subtitle": "爆款直降 / 今日主推",
    "body": "精选热卖单品，限时优惠，支持到店和线上下单。",
    "cta": "立即抢购",
    "width": 1242,
    "height": 1660,
    "background": "#fff4ea",
    "primary": "#ff7a59",
    "accent": "#ffb18e",
    "text": "#4a1f12",
    "tag": "E-COMMERCE",
    "fullTitle": "示例模板 - 好物推荐海报"
  },
  {
    "id": 102,
    "cate": 2,
    "title": "招聘进行中",
    "subtitle": "双休 / 五险一金 / 快速成长",
    "body": "岗位开放：运营、设计、销售，欢迎热爱表达和执行力强的你。",
    "cta": "马上投递",
    "width": 1242,
    "height": 2208,
    "background": "#eef5ff",
    "primary": "#246bfd",
    "accent": "#9fc2ff",
    "text": "#102a43",
    "tag": "HIRING NOW",
    "fullTitle": "示例模板 - 招聘进行中海报"
  },
  {
    "id": 103,
    "cate": 3,
    "title": "活动预告",
    "subtitle": "限时报名 / 名额有限",
    "body": "主题活动即将开启，锁定时间、地点与福利，提前预约更省心。",
    "cta": "立即报名",
    "width": 1242,
    "height": 1660,
    "background": "#fff1f5",
    "primary": "#e64980",
    "accent": "#ffc0d6",
    "text": "#4c1024",
    "tag": "EVENT",
    "fullTitle": "示例模板 - 活动预告海报"
  },
  {
    "id": 104,
    "cate": 4,
    "title": "课程报名",
    "subtitle": "系统学习 / 限时报名",
    "body": "适合零基础到进阶人群，突出课程亮点、讲师优势和学习成果。",
    "cta": "预约试听",
    "width": 900,
    "height": 383,
    "background": "#f7f3ff",
    "primary": "#7c3aed",
    "accent": "#d8b4fe",
    "text": "#2e1065",
    "tag": "COURSE",
    "fullTitle": "示例模板 - 课程报名封面"
  },
  {
    "id": 105,
    "cate": 5,
    "title": "节日上新",
    "subtitle": "氛围感海报 / 节日限定",
    "body": "营造节日情绪与品牌温度，适合促销、新品和节日祝福发布。",
    "cta": "查看详情",
    "width": 1242,
    "height": 2208,
    "background": "#fff7ed",
    "primary": "#ea580c",
    "accent": "#fdba74",
    "text": "#431407",
    "tag": "FESTIVAL",
    "fullTitle": "示例模板 - 节日上新海报"
  },
  {
    "id": 106,
    "cate": 6,
    "title": "燃脂训练营",
    "subtitle": "打卡挑战 / 教练带练",
    "body": "高频触达用户，突出训练成果、营养计划和转化报名入口。",
    "cta": "立即加入",
    "width": 1242,
    "height": 1660,
    "background": "#ecfdf3",
    "primary": "#16a34a",
    "accent": "#86efac",
    "text": "#052e16",
    "tag": "FITNESS",
    "fullTitle": "示例模板 - 燃脂训练营海报"
  },
  {
    "id": 107,
    "cate": 7,
    "title": "今日推荐",
    "subtitle": "人气单品 / 到店即享",
    "body": "突出菜品卖点、氛围和到店引导，适合上新、团购和门店活动。",
    "cta": "扫码下单",
    "width": 1125,
    "height": 2001,
    "background": "#fff8eb",
    "primary": "#d97706",
    "accent": "#fcd34d",
    "text": "#422006",
    "tag": "DINING",
    "fullTitle": "示例模板 - 今日推荐海报"
  },
  {
    "id": 201,
    "cate": 1,
    "title": "新品上市",
    "subtitle": "爆款首发 / 限时折扣",
    "body": "适合电商上新和活动预热，突出主图、价格锚点与购买行动。",
    "cta": "立即抢购",
    "width": 1242,
    "height": 1660,
    "background": "#fff5ec",
    "primary": "#f97316",
    "accent": "#fdba74",
    "text": "#4a2811",
    "tag": "E-COMMERCE",
    "fullTitle": "示例模板 - 新品上市海报",
    "layout": "price"
  },
  {
    "id": 202,
    "cate": 2,
    "title": "门店招聘",
    "subtitle": "高薪诚聘 / 晋升清晰",
    "body": "适合门店、零售和服务业招聘，突出岗位亮点、福利和联系方式。",
    "cta": "马上投递",
    "width": 1242,
    "height": 2208,
    "background": "#eef4ff",
    "primary": "#2563eb",
    "accent": "#93c5fd",
    "text": "#11284b",
    "tag": "HIRING NOW",
    "fullTitle": "示例模板 - 门店招聘海报"
  },
  {
    "id": 203,
    "cate": 3,
    "title": "活动邀请函",
    "subtitle": "现场签到 / 名额有限",
    "body": "适合品牌沙龙、发布会和线下路演，强化时间地点与报名动作。",
    "cta": "立即报名",
    "width": 1242,
    "height": 1660,
    "background": "#fff1f6",
    "primary": "#db2777",
    "accent": "#f9a8d4",
    "text": "#4a1431",
    "tag": "EVENT",
    "fullTitle": "示例模板 - 活动邀请函"
  },
  {
    "id": 204,
    "cate": 4,
    "title": "训练营招生",
    "subtitle": "系统学习 / 陪跑答疑",
    "body": "适合课程招生、训练营开营和知识付费转化，突出课程收益。",
    "cta": "预约试听",
    "width": 900,
    "height": 383,
    "background": "#f5f3ff",
    "primary": "#7c3aed",
    "accent": "#c4b5fd",
    "text": "#2f175f",
    "tag": "COURSE",
    "fullTitle": "示例模板 - 训练营招生封面",
    "layout": "split"
  },
  {
    "id": 205,
    "cate": 5,
    "title": "节日限定",
    "subtitle": "氛围上新 / 礼赠推荐",
    "body": "适合节日祝福、节庆促销和限定礼盒推荐，画面更有情绪感。",
    "cta": "查看详情",
    "width": 1242,
    "height": 2208,
    "background": "#fff7ed",
    "primary": "#ea580c",
    "accent": "#fdba74",
    "text": "#51210c",
    "tag": "FESTIVAL",
    "fullTitle": "示例模板 - 节日限定海报"
  },
  {
    "id": 206,
    "cate": 6,
    "title": "健身打卡",
    "subtitle": "燃脂塑形 / 限时组队",
    "body": "适合健身房活动、私教团课和打卡挑战，突出节奏与行动感。",
    "cta": "立即加入",
    "width": 1242,
    "height": 1660,
    "background": "#eefcf3",
    "primary": "#16a34a",
    "accent": "#86efac",
    "text": "#0d341d",
    "tag": "FITNESS",
    "fullTitle": "示例模板 - 健身打卡海报"
  },
  {
    "id": 207,
    "cate": 7,
    "title": "今日主推",
    "subtitle": "人气爆品 / 到店即享",
    "body": "适合餐饮上新、门店促销和套餐推荐，突出食欲与优惠信息。",
    "cta": "扫码点单",
    "width": 1125,
    "height": 2001,
    "background": "#fff9ec",
    "primary": "#d97706",
    "accent": "#fcd34d",
    "text": "#4a2508",
    "tag": "DINING",
    "fullTitle": "示例模板 - 今日主推海报"
  },
  {
    "id": 208,
    "cate": 3,
    "title": "品牌快闪",
    "subtitle": "限时体验 / 即刻到场",
    "body": "适合快闪店、品牌联名和城市活动，版式更偏视觉主画面。",
    "cta": "锁定席位",
    "width": 1242,
    "height": 1660,
    "background": "#f3f4ff",
    "primary": "#4f46e5",
    "accent": "#a5b4fc",
    "text": "#1f2554",
    "tag": "POP-UP",
    "fullTitle": "示例模板 - 品牌快闪海报",
    "layout": "collage"
  },
  {
    "id": 301,
    "cate": 1,
    "title": "限时秒杀",
    "subtitle": "爆款2件8折 / 今晚截止",
    "body": "价格锚点+核心卖点并排展示，适合电商、门店促销和直播预热。",
    "cta": "马上下单",
    "width": 1242,
    "height": 1660,
    "background": "#fff7ed",
    "primary": "#ea580c",
    "accent": "#fed7aa",
    "text": "#431407",
    "tag": "FLASH SALE",
    "fullTitle": "示例模板 - 限时秒杀价签版",
    "layout": "price"
  },
  {
    "id": 302,
    "cate": 2,
    "title": "急聘岗位",
    "subtitle": "三天内面试 / 入职有礼",
    "body": "强调岗位、福利、流程，信息层级明确，适配招聘海报和门店招募。",
    "cta": "立即沟通",
    "width": 1242,
    "height": 2208,
    "background": "#eef2ff",
    "primary": "#4338ca",
    "accent": "#c7d2fe",
    "text": "#1e1b4b",
    "tag": "HIRING FAST",
    "fullTitle": "示例模板 - 招聘信息卡片版",
    "layout": "cards"
  },
  {
    "id": 303,
    "cate": 3,
    "title": "周末市集",
    "subtitle": "摊主招募 / 限量席位",
    "body": "大图主视觉+左右分栏，适合活动招募、展会预告和品牌快闪。",
    "cta": "申请摊位",
    "width": 1242,
    "height": 1660,
    "background": "#f0f9ff",
    "primary": "#0284c7",
    "accent": "#bae6fd",
    "text": "#0c4a6e",
    "tag": "MARKET EVENT",
    "fullTitle": "示例模板 - 活动分栏信息版",
    "layout": "split"
  },
  {
    "id": 304,
    "cate": 4,
    "title": "公开课预告",
    "subtitle": "从0到1搭建增长系统",
    "body": "主标题+三卖点卡片+CTA，适合课程招生、直播讲座和知识付费封面。",
    "cta": "预约名额",
    "width": 900,
    "height": 383,
    "background": "#f5f3ff",
    "primary": "#6d28d9",
    "accent": "#ddd6fe",
    "text": "#2e1065",
    "tag": "MASTERCLASS",
    "fullTitle": "示例模板 - 课程卡片横版",
    "layout": "cards"
  },
  {
    "id": 305,
    "cate": 5,
    "title": "节庆礼盒",
    "subtitle": "限定包装 / 节日心意",
    "body": "拼贴氛围感布局，适合节日上新、礼盒推荐和节日祝福传播。",
    "cta": "立即选购",
    "width": 1242,
    "height": 2208,
    "background": "#fff1f2",
    "primary": "#be123c",
    "accent": "#fecdd3",
    "text": "#4c0519",
    "tag": "FESTIVE GIFT",
    "fullTitle": "示例模板 - 节日拼贴海报",
    "layout": "collage"
  },
  {
    "id": 306,
    "cate": 6,
    "title": "体脂管理营",
    "subtitle": "21天打卡 / 教练监督",
    "body": "对比型视觉+行动按钮，适合健身房招生、减脂计划和社群招募。",
    "cta": "加入打卡",
    "width": 1242,
    "height": 1660,
    "background": "#ecfeff",
    "primary": "#0e7490",
    "accent": "#a5f3fc",
    "text": "#083344",
    "tag": "FIT CHALLENGE",
    "fullTitle": "示例模板 - 健身转化价签版",
    "layout": "price"
  },
  {
    "id": 307,
    "cate": 7,
    "title": "新品双拼套餐",
    "subtitle": "主食+饮品 立减10元",
    "body": "菜品与文案分栏展示，适合餐饮上新、套餐推荐和门店活动。",
    "cta": "扫码下单",
    "width": 1125,
    "height": 2001,
    "background": "#fffbeb",
    "primary": "#b45309",
    "accent": "#fde68a",
    "text": "#451a03",
    "tag": "FOOD COMBO",
    "fullTitle": "示例模板 - 餐饮分栏促销版",
    "layout": "split"
  },
  {
    "id": 308,
    "cate": 8,
    "title": "小红书爆款封面",
    "subtitle": "3步做出高级感海报",
    "body": "信息卡+醒目标题，适合社媒封面、教程类内容和种草笔记。",
    "cta": "收藏学习",
    "width": 1242,
    "height": 1660,
    "background": "#eff6ff",
    "primary": "#2563eb",
    "accent": "#bfdbfe",
    "text": "#172554",
    "tag": "SOCIAL COVER",
    "fullTitle": "示例模板 - 小红书封面卡片版",
    "layout": "cards"
  },
  {
    "id": 401,
    "cate": 1,
    "title": "质感上新",
    "subtitle": "SPRING LOOKBOOK · 大片主视觉",
    "body": "上半区杂志标题区 + 下半区通栏实拍主图，层次接近成熟电商品牌详情首屏。",
    "cta": "进店逛逛",
    "width": 1242,
    "height": 1660,
    "background": "#faf7f2",
    "primary": "#c2410c",
    "accent": "#fdba74",
    "text": "#292524",
    "tag": "NEW IN",
    "fullTitle": "示例模板 - 电商杂志风通栏主图",
    "layout": "editorial",
    "heroImageUrl": "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1400&q=80"
  },
  {
    "id": 402,
    "cate": 2,
    "title": "我们招人",
    "subtitle": "TEAM / 与优秀的人共事",
    "body": "通栏办公场景主图 + 上方信息区，适合互联网与服务企业招聘主视觉。",
    "cta": "投递简历",
    "width": 1242,
    "height": 2208,
    "background": "#f4f6fb",
    "primary": "#1d4ed8",
    "accent": "#93c5fd",
    "text": "#0f172a",
    "tag": "JOIN US",
    "fullTitle": "示例模板 - 招聘场景通栏版",
    "layout": "editorial",
    "heroImageUrl": "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1400&q=80"
  },
  {
    "id": 403,
    "cate": 3,
    "title": "线下见",
    "subtitle": "POP-UP · 限时体验",
    "body": "活动类模板：人群/现场氛围图铺满下半屏，上半屏承载主题与报名入口。",
    "cta": "立即报名",
    "width": 1242,
    "height": 1660,
    "background": "#f0f9ff",
    "primary": "#0369a1",
    "accent": "#7dd3fc",
    "text": "#0c4a6e",
    "tag": "LIVE EVENT",
    "fullTitle": "示例模板 - 活动氛围通栏版",
    "layout": "editorial",
    "heroImageUrl": "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1400&q=80"
  },
  {
    "id": 404,
    "cate": 4,
    "title": "公开课",
    "subtitle": "MASTERCLASS · 小班直播",
    "body": "教育场景主图 + 清爽渐变背景，适合课程宣发与直播预告封面。",
    "cta": "预约听课",
    "width": 1242,
    "height": 1660,
    "background": "#f5f3ff",
    "primary": "#6d28d9",
    "accent": "#c4b5fd",
    "text": "#2e1065",
    "tag": "LIVE CLASS",
    "fullTitle": "示例模板 - 课程直播通栏版",
    "layout": "editorial",
    "heroImageUrl": "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1400&q=80"
  },
  {
    "id": 405,
    "cate": 5,
    "title": "节日礼遇",
    "subtitle": "GIFTING · 限定礼盒",
    "body": "节庆氛围摄影 + 柔和渐变，适合礼盒、祝福与季节限定推广。",
    "cta": "立即选购",
    "width": 1242,
    "height": 2208,
    "background": "#fff1f2",
    "primary": "#be123c",
    "accent": "#fda4af",
    "text": "#4c0519",
    "tag": "HOLIDAY",
    "fullTitle": "示例模板 - 节日礼遇通栏版",
    "layout": "editorial",
    "heroImageUrl": "https://images.unsplash.com/photo-1512389142860-9c449e58a543?auto=format&fit=crop&w=1400&q=80"
  },
  {
    "id": 406,
    "cate": 6,
    "title": "开练",
    "subtitle": "BOOTCAMP · 教练带练",
    "body": "健身房实景主图铺满下半区，强化动感与转化，适合团课与训练营招生。",
    "cta": "加入训练",
    "width": 1242,
    "height": 1660,
    "background": "#ecfdf5",
    "primary": "#047857",
    "accent": "#6ee7b7",
    "text": "#064e3b",
    "tag": "TRAINING",
    "fullTitle": "示例模板 - 健身实景通栏版",
    "layout": "editorial",
    "heroImageUrl": "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=1400&q=80"
  },
  {
    "id": 407,
    "cate": 7,
    "title": "本店招牌",
    "subtitle": "CHEF SPECIAL · 今日主推",
    "body": "美食特写通栏 + 上半区卖点文案，突出食欲与到店/外卖行动。",
    "cta": "扫码点单",
    "width": 1125,
    "height": 2001,
    "background": "#fffbeb",
    "primary": "#b45309",
    "accent": "#fcd34d",
    "text": "#451a03",
    "tag": "FRESH",
    "fullTitle": "示例模板 - 餐饮特写通栏版",
    "layout": "editorial",
    "heroImageUrl": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1400&q=80"
  },
  {
    "id": 408,
    "cate": 8,
    "title": "高级感封面",
    "subtitle": "3分钟学会排版",
    "body": "抽象视觉 + 杂志式标签行，适合小红书与短视频封面。",
    "cta": "收藏教程",
    "width": 1242,
    "height": 1660,
    "background": "#f8fafc",
    "primary": "#4f46e5",
    "accent": "#a5b4fc",
    "text": "#1e1b4b",
    "tag": "XHS COVER",
    "fullTitle": "示例模板 - 社媒抽象主视觉版",
    "layout": "editorial",
    "heroImageUrl": "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1400&q=80"
  }
]

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function makePreviewSvg(seed: TemplateSeed) {
  const gid = `pv_${seed.id}`
  const layout = seed.layout || 'hero'
  const imageY = layout === 'editorial' ? 148 : layout === 'split' ? 108 : 116
  const imageH = layout === 'editorial' ? 146 : layout === 'split' ? 160 : 122
  const imageR = layout === 'editorial' ? 0 : 12
  const titleSize = layout === 'editorial' ? 18 : 20
  const subtitleY = layout === 'editorial' ? 72 : 84
  const heroShape = `
    <defs>
      <clipPath id="cp_${gid}">
        <rect x="14" y="${imageY}" width="152" height="${imageH}" rx="${imageR}"/>
      </clipPath>
    </defs>
    <rect x="14" y="${imageY}" width="152" height="${imageH}" rx="${imageR}" fill="${seed.accent}" opacity="0.32"/>
    <g clip-path="url(#cp_${gid})">
      <rect x="14" y="${imageY}" width="152" height="${imageH}" fill="#ffffff" opacity="0.2"/>
      <circle cx="48" cy="${imageY + 38}" r="28" fill="#ffffff" opacity="0.36"/>
      <circle cx="138" cy="${imageY + 24}" r="22" fill="${seed.primary}" opacity="0.18"/>
      <ellipse cx="92" cy="${imageY + imageH - 8}" rx="88" ry="26" fill="${seed.primary}" opacity="0.22"/>
    </g>
  `
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 180 320">
    <defs>
      <linearGradient id="${gid}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${seed.background}"/>
        <stop offset="52%" stop-color="#ffffff"/>
        <stop offset="100%" stop-color="${seed.accent}" stop-opacity="0.55"/>
      </linearGradient>
    </defs>
    <rect width="180" height="320" rx="18" fill="url(#${gid})"/>
    ${heroShape}
    <rect x="26" y="248" width="128" height="26" rx="13" fill="${seed.primary}" opacity="0.1"/>
    <text x="24" y="42" font-size="9" fill="${seed.primary}" font-family="Arial" opacity="0.85">${escapeXml(seed.tag)}</text>
    <text x="24" y="66" font-size="${titleSize}" font-weight="700" fill="${seed.text}" font-family="Arial">${escapeXml(seed.title)}</text>
    <text x="24" y="${subtitleY}" font-size="9" fill="${seed.text}" font-family="Arial" opacity="0.8">${escapeXml(seed.subtitle)}</text>
    <text x="40" y="266" font-size="11" font-weight="700" fill="${seed.primary}" font-family="Arial">${escapeXml(seed.cta)}</text>
  </svg>
  `.trim()
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

function buildSvgDecor(
  uuid: string,
  left: number,
  top: number,
  width: number,
  height: number,
  svgMarkup: string,
  colors: string[],
  opacity = 1,
  rotate = 0,
) {
  return {
    name: '装饰图形',
    type: 'w-svg',
    uuid,
    width,
    height,
    left,
    top,
    transform: '',
    zoom: 1,
    radius: 0,
    opacity,
    parent: '-1',
    svgUrl: svgMarkup,
    colors,
    setting: [],
    rotate,
    record: {
      width: 0,
      height: 0,
      minWidth: 10,
      minHeight: 10,
    },
  }
}

function buildDecorLayers(seed: TemplateSeed): any[] {
  const w = seed.width
  const h = seed.height
  const layout = seed.layout || 'hero'
  if (layout === 'editorial') {
    return [
      buildSvgDecor(
        `decor_tr_${seed.id}`,
        Math.round(w * 0.56),
        -Math.round(h * 0.02),
        Math.round(w * 0.5),
        Math.round(h * 0.3),
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260"><ellipse cx="230" cy="50" rx="170" ry="125" fill="{{colors[0]}}" opacity="0.38"/><ellipse cx="310" cy="140" rx="95" ry="72" fill="{{colors[1]}}" opacity="0.22"/></svg>`,
        [seed.accent, seed.primary],
        0.92,
      ),
      buildSvgDecor(
        `decor_bl_${seed.id}`,
        -Math.round(w * 0.06),
        Math.round(h * 0.68),
        Math.round(w * 0.38),
        Math.round(h * 0.26),
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 220"><ellipse cx="90" cy="130" rx="120" ry="95" fill="{{colors[0]}}" opacity="0.26"/></svg>`,
        [seed.primary],
        0.88,
      ),
    ]
  }
  return [
    buildSvgDecor(
      `decor_tr_${seed.id}`,
      Math.round(w * 0.6),
      -Math.round(h * 0.04),
      Math.round(w * 0.44),
      Math.round(h * 0.26),
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 230"><ellipse cx="200" cy="48" rx="155" ry="108" fill="{{colors[0]}}" opacity="0.34"/><ellipse cx="288" cy="128" rx="78" ry="60" fill="{{colors[1]}}" opacity="0.2"/></svg>`,
      [seed.accent, seed.primary],
      0.9,
    ),
  ]
}

function buildTextLayer(
  name: string,
  text: string,
  options: {
    left: number
    top: number
    width: number
    fontSize: number
    color: string
    textAlign?: string
    lineHeight?: number
    letterSpacing?: number
    backgroundColor?: string
    fontWeight?: string
    height?: number
  },
) {
  const lineHeight = options.lineHeight || 1.35
  const estimatedHeight = options.height || Math.max(Math.round(options.fontSize * lineHeight * 2), options.fontSize + 24)
  return {
    name,
    type: 'w-text',
    uuid: `${name}_${Math.random().toString(16).slice(2, 10)}`,
    editable: false,
    left: options.left,
    top: options.top,
    transform: '',
    lineHeight,
    letterSpacing: options.letterSpacing || 0,
    fontSize: options.fontSize,
    zoom: 1,
    fontClass: {
      alias: '站酷快乐体',
      id: 543,
      value: 'zcool-kuaile-regular',
      url: `${getClientSiteRootUrl()}fonts/zcool-kuaile-regular.woff2`,
    },
    fontFamily: 'SourceHanSansSC-Regular',
    fontWeight: options.fontWeight || 'normal',
    fontStyle: 'normal',
    writingMode: 'horizontal-tb',
    textDecoration: 'none',
    color: options.color,
    textAlign: options.textAlign || 'left',
    textAlignLast: options.textAlign || 'left',
    text,
    opacity: 1,
    backgroundColor: options.backgroundColor || '',
    parent: '-1',
    record: {
      width: options.width,
      height: estimatedHeight,
      minWidth: options.fontSize,
      minHeight: options.fontSize,
      dir: 'horizontal',
    },
    width: options.width,
    height: estimatedHeight,
  }
}

function buildImageLayer(seed: TemplateSeed, frame?: { width?: number; height?: number; left?: number; top?: number; radius?: number }) {
  const resolved = resolveHeroAssetUrl(seed)
  const isRemote = Boolean(resolved.url)
  const heroSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 860 620">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${seed.accent}" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="${seed.primary}" stop-opacity="0.2"/>
      </linearGradient>
    </defs>
    <rect width="860" height="620" rx="44" fill="url(#g)"/>
    <circle cx="680" cy="156" r="108" fill="${seed.primary}" opacity="0.14"/>
    <circle cx="178" cy="454" r="96" fill="${seed.accent}" opacity="0.12"/>
    <rect x="122" y="114" width="616" height="392" rx="36" fill="#ffffff" opacity="0.72"/>
    <text x="430" y="266" text-anchor="middle" font-size="72" font-weight="700" fill="${seed.primary}" font-family="Arial">${escapeXml(seed.title)}</text>
    <text x="430" y="334" text-anchor="middle" font-size="28" fill="${seed.text}" font-family="Arial">${escapeXml(seed.subtitle)}</text>
  </svg>
  `.trim()
  const imgUrl = isRemote ? resolved.url : `data:image/svg+xml,${encodeURIComponent(heroSvg)}`

  return {
    name: '图片',
    type: 'w-image',
    uuid: `hero_${seed.id}`,
    width: frame?.width ?? Math.round(seed.width * 0.78),
    height: frame?.height ?? Math.round(seed.height * 0.34),
    left: frame?.left ?? Math.round(seed.width * 0.11),
    top: frame?.top ?? Math.round(seed.height * 0.26),
    zoom: 1,
    transform: '',
    radius: frame?.radius ?? 24,
    opacity: 1,
    parent: '-1',
    imgUrl,
    mask: '',
    setting: [],
    record: {
      width: 0,
      height: 0,
      minWidth: 10,
      minHeight: 10,
      dir: 'all',
    },
    rotate: 0,
    lock: false,
    isNinePatch: false,
    flip: '',
    sliceData: {
      ratio: 0,
      left: 0,
    },
    imageTransform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
    filter: {
      contrast: 0,
      sharpness: 0,
      hueRotate: 0,
      saturate: 0,
      brightness: 0,
      gaussianBlur: 0,
      temperature: 0,
      tint: 0,
    },
  }
}

function buildTemplateData(seed: TemplateSeed) {
  const marginX = Math.round(seed.width * 0.09)
  const layout = seed.layout || 'hero'
  const isEditorial = layout === 'editorial'
  const titleFontSize = seed.width >= 1200 ? 138 : 88
  const qrSize = Math.round(Math.min(seed.width, seed.height) * 0.12)

  const titleWidth = isEditorial
    ? Math.round(seed.width * 0.84)
    : layout === 'split'
      ? Math.round(seed.width * 0.44)
      : Math.round(seed.width * 0.7)
  const bodyWidth = isEditorial
    ? Math.round(seed.width * 0.84)
    : layout === 'split'
      ? Math.round(seed.width * 0.4)
      : Math.round(seed.width * 0.68)
  const ctaWidth = isEditorial ? Math.round(seed.width * 0.36) : Math.round(seed.width * 0.26)

  const imageFrame =
    layout === 'editorial'
      ? {
          width: seed.width,
          height: Math.round(seed.height * 0.55),
          left: 0,
          top: Math.round(seed.height * 0.45),
          radius: 0,
        }
      : layout === 'split'
        ? {
            width: Math.round(seed.width * 0.46),
            height: Math.round(seed.height * 0.52),
            left: Math.round(seed.width * 0.5),
            top: Math.round(seed.height * 0.16),
            radius: 18,
          }
        : layout === 'collage'
          ? {
              width: Math.round(seed.width * 0.64),
              height: Math.round(seed.height * 0.3),
              left: Math.round(seed.width * 0.2),
              top: Math.round(seed.height * 0.22),
              radius: 12,
            }
          : {
              width: Math.round(seed.width * 0.78),
              height: Math.round(seed.height * 0.34),
              left: Math.round(seed.width * 0.11),
              top: Math.round(seed.height * 0.26),
              radius: 24,
            }

  const topSubtitle = isEditorial ? 0.078 : 0.12
  const topTitle = isEditorial ? 0.112 : 0.16
  const topBody = isEditorial ? 0.218 : layout === 'split' ? 0.5 : 0.66
  const topCta = isEditorial ? 0.382 : 0.83

  const layers: any[] = [...buildDecorLayers(seed)]

  if (isEditorial) {
    layers.push(
      buildTextLayer('hero_tag', seed.tag, {
        left: marginX,
        top: Math.round(seed.height * 0.048),
        width: Math.round(seed.width * 0.72),
        fontSize: seed.width >= 1200 ? 28 : 20,
        color: seed.primary,
        letterSpacing: 4,
        fontWeight: 'bold',
      }),
    )
  }

  layers.push(
    buildTextLayer('hero_subtitle', seed.subtitle, {
      left: marginX,
      top: Math.round(seed.height * topSubtitle),
      width: Math.round(seed.width * 0.68),
      fontSize: seed.width >= 1200 ? 34 : 24,
      color: seed.primary,
      letterSpacing: 2,
    }),
    buildTextLayer('hero_title', seed.title, {
      left: marginX,
      top: Math.round(seed.height * topTitle),
      width: titleWidth,
      fontSize: layout === 'cards' ? Math.round(titleFontSize * 0.78) : titleFontSize,
      color: seed.text,
      fontWeight: 'bold',
      lineHeight: 1.12,
    }),
    buildImageLayer(seed, imageFrame),
    buildTextLayer('hero_body', seed.body, {
      left: marginX,
      top: Math.round(seed.height * topBody),
      width: bodyWidth,
      fontSize: seed.width >= 1200 ? 36 : 24,
      color: seed.text,
      lineHeight: 1.6,
      backgroundColor: isEditorial ? '#ffffffcc' : '',
      height: isEditorial ? (seed.width >= 1200 ? 120 : 88) : undefined,
    }),
    buildTextLayer('hero_cta', seed.cta, {
      left: marginX,
      top: Math.round(seed.height * topCta),
      width: ctaWidth,
      fontSize: seed.width >= 1200 ? 32 : 22,
      color: '#ffffffff',
      backgroundColor: seed.primary,
      textAlign: 'center',
      fontWeight: 'bold',
      height: seed.width >= 1200 ? 78 : 56,
    }),
  )

  if (layout === 'cards') {
    const cardWidth = Math.round(seed.width * 0.24)
    const cardTop = Math.round(seed.height * 0.56)
    const cardGap = Math.round(seed.width * 0.02)
    const cardLeft = Math.round(seed.width * 0.1)
    for (let i = 0; i < 3; i++) {
      layers.push(buildTextLayer(`card_${i + 1}`, `卖点 ${i + 1}`, {
        left: cardLeft + i * (cardWidth + cardGap),
        top: cardTop,
        width: cardWidth,
        fontSize: seed.width >= 1200 ? 28 : 18,
        color: seed.primary,
        backgroundColor: `${seed.accent}cc`,
        textAlign: 'center',
        fontWeight: 'bold',
        height: seed.width >= 1200 ? 76 : 54,
      }))
    }
  }

  if (layout === 'price') {
    layers.push(
      buildTextLayer('price_tag', '限时优惠', {
        left: Math.round(seed.width * 0.62),
        top: Math.round(seed.height * 0.14),
        width: Math.round(seed.width * 0.24),
        fontSize: seed.width >= 1200 ? 28 : 20,
        color: '#ffffffff',
        backgroundColor: seed.primary,
        textAlign: 'center',
        fontWeight: 'bold',
        height: seed.width >= 1200 ? 62 : 48,
      }),
      buildTextLayer('price_num', '￥99', {
        left: Math.round(seed.width * 0.63),
        top: Math.round(seed.height * 0.2),
        width: Math.round(seed.width * 0.26),
        fontSize: seed.width >= 1200 ? 88 : 56,
        color: seed.primary,
        fontWeight: 'bold',
        lineHeight: 1.05,
      }),
    )
  }

  if (seed.height > 1000) {
    layers.push({
      name: '二维码',
      type: 'w-qrcode',
      uuid: `qr_${seed.id}`,
      width: qrSize,
      height: qrSize,
      left: seed.width - marginX - qrSize,
      top: seed.height - marginX - qrSize,
      zoom: 1,
      transform: '',
      radius: 0,
      opacity: 1,
      parent: '-1',
      url: '',
      dotType: 'classy',
      dotColorType: 'single',
      dotRotation: 270,
      dotColor: seed.text,
      dotColor2: seed.text,
      value: 'https://example.com',
      setting: [],
      record: {
        width: 0,
        height: 0,
        minWidth: 10,
        minHeight: 10,
        dir: 'all',
      },
    })
  }

  return JSON.stringify([
    {
      global: {
        name: '作品页面',
        type: 'page',
        uuid: '-1',
        left: 0,
        top: 0,
        width: seed.width,
        height: seed.height,
        backgroundColor: `${seed.background}ff`,
        backgroundGradient: resolvePageGradient(seed),
        backgroundImage: '',
        backgroundTransform: {},
        opacity: 1,
        tag: 0,
        setting: [],
        record: {},
      },
      layers,
    },
  ])
}

export function getTemplateCategories() {
  return categories.slice()
}

export function getTemplateSeeds() {
  return templateSeeds.slice()
}

export function getTemplateList() {
  return templateSeeds.map((seed) => ({
    id: seed.id,
    cover: makePreviewSvg(seed),
    // 列表卡片避免依赖截图接口；直接复用稳定的 SVG 预览，防止 /api/screenshots 500 导致整列封面报错
    thumb: makePreviewSvg(seed),
    title: seed.fullTitle,
    width: seed.width,
    height: seed.height,
    state: 1,
    cate: seed.cate,
  })) as TemplateListItem[]
}

// 启动时预热一批常用模板主图（异步，不阻塞服务）
try {
  if (allowRemoteTemplateHeroes() !== 'false') {
    const warm = templateSeeds.slice(0, 18).map((seed) => resolveHeroImageUrl(seed)).filter((u) => /^https?:\/\//i.test(u))
    warm.forEach((u) => void downloadHeroToCache(u).catch(() => undefined))
  }
} catch {
  // ignore
}

export function getTemplateDetail(id: number | string): TemplateDetail | null {
  const seed = templateSeeds.find((item) => item.id === Number(id))
  if (!seed) return null
  return {
    id: String(seed.id),
    title: seed.fullTitle,
    width: seed.width,
    height: seed.height,
    data: buildTemplateData(seed),
  }
}

export function getTemplateSuggestionByIndustry(industry: string) {
  const candidates = resolveTemplateIdsByIndustry(industry)
  const matchedId = candidates[Math.floor(Math.random() * candidates.length)] || 103
  const detail = getTemplateDetail(matchedId)
  const listItem = getTemplateList().find((item) => item.id === matchedId) || null
  return { detail, listItem }
}

const presetTemplateMapping: Record<string, number[]> = {
  campaign: [403, 208, 303, 203],
  recruitment: [402, 302, 202, 102],
  commerce: [401, 301, 201, 101],
  course: [404, 304, 204, 104],
  fitness: [406, 306, 206, 106],
  food: [407, 307, 207, 107],
  festival: [405, 305, 205, 105],
  xiaohongshu: [408, 308, 101, 201],
}

const industryTemplateMapping: Record<string, number[]> = {
  '电商': [401, 101, 201, 301],
  '招聘': [402, 102, 202, 302],
  '活动': [403, 103, 203, 208, 303],
  '课程': [404, 104, 204, 304],
  '节日': [405, 105, 205, 305],
  '健身': [406, 106, 206, 306],
  '餐饮': [407, 107, 207, 307],
  '小红书': [408, 308, 101, 201],
  '小红书封面': [408, 308, 101, 201],
}

const smartTemplateFallbackIds = [403, 401, 404, 405, 406, 407, 408, 301, 302, 304, 305, 307]

function resolveTemplateIdsByIndustry(industry: string) {
  return industryTemplateMapping[industry] || [103, 203, 303]
}

function resolveTemplateIdsByPreset(presetKey: string, industry: string) {
  const presetIds = presetTemplateMapping[String(presetKey || '').trim()]
  if (presetIds?.length) return presetIds
  return resolveTemplateIdsByIndustry(industry)
}

function makeTemplateCandidate(seed: TemplateSeed, industry: string, reason: string, score: number) {
  return {
    familyId: `seed-${seed.id}`,
    seedId: seed.id,
    title: seed.fullTitle,
    industry,
    layoutFamily: normalizeSeedLayoutToEngine(seed.layout),
    tone: seed.tag,
    score,
    reason,
    cover: makePreviewSvg(seed),
  }
}
function scoreTemplateSeed(seed: TemplateSeed, context: SmartTemplateContext = {}) {
  const joined = `${context.theme || ''} ${context.purpose || ''} ${context.style || ''} ${context.content || ''} ${context.industry || ''} ${context.presetKey || ''}`.trim()
  const layoutFamily = normalizeSeedLayoutToEngine(seed.layout)
  const reasons: string[] = []
  let score = 0.62
  const presetIds = resolveTemplateIdsByPreset(String(context.presetKey || ''), String(context.industry || ''))
  const industryIds = resolveTemplateIdsByIndustry(String(context.industry || ''))
  if (presetIds.includes(seed.id)) {
    score += 0.16
    reasons.push('贴近前端所选模板方向')
  }
  if (industryIds.includes(seed.id)) {
    score += 0.12
    reasons.push('行业气质匹配')
  }
  if ((context.sizeKey === 'wechat-cover' && seed.width > seed.height) || ((context.sizeKey === 'moments' || context.sizeKey === 'xiaohongshu' || context.sizeKey === 'flyer') && seed.height >= seed.width) || (context.sizeKey === 'ecommerce' && Math.abs(seed.width - seed.height) <= 260)) {
    score += 0.08
    reasons.push('尺寸比例更合适')
  }
  if (/促销|抢购|折扣|立减|优惠|套餐|券后|到手价|上新|新品/.test(joined) && ['premium-offer', 'grid-product', 'hero-center'].includes(layoutFamily)) {
    score += 0.12
    reasons.push('适合利益点和价格块')
  }
  if (/招聘|招募|岗位|面试|投递|入职/.test(joined) && ['list-recruitment', 'hero-left', 'magazine-cover'].includes(layoutFamily)) {
    score += 0.13
    reasons.push('适合招聘信息分层')
  }
  if (/课程|培训|试听|公开课|训练营|报名/.test(joined) && ['clean-course', 'split-editorial', 'hero-left'].includes(layoutFamily)) {
    score += 0.12
    reasons.push('适合课程说明与行动按钮')
  }
  if (/节日|活动|庆典|市集|展会|露营|音乐节|邀请函/.test(joined) && ['festive-frame', 'magazine-cover', 'hero-center'].includes(layoutFamily)) {
    score += 0.12
    reasons.push('适合氛围主视觉成片')
  }
  if (/小红书|封面|笔记|种草|攻略|合集/.test(joined) && ['xiaohongshu-note', 'magazine-cover', 'hero-center'].includes(layoutFamily)) {
    score += 0.14
    reasons.push('适合社媒封面表达')
  }
  if (/杂志|大片|轻奢|高级|法式|黑金|封面|campaign/i.test(joined) && ['magazine-cover', 'hero-center', 'split-editorial'].includes(layoutFamily)) {
    score += 0.1
    reasons.push('风格更接近成品主视觉')
  }
  if (/卡通|插画|涂鸦|年轻|活力|贴纸/.test(joined) && ['festive-frame', 'hero-center', 'xiaohongshu-note'].includes(layoutFamily)) {
    score += 0.08
    reasons.push('适合年轻化视觉')
  }
  if ((context.content || '').length > 56 && ['split-editorial', 'clean-course', 'list-recruitment', 'grid-product'].includes(layoutFamily)) {
    score += 0.1
    reasons.push('更能承接较多信息')
  }
  if ((context.content || '').length < 28 && ['magazine-cover', 'hero-center', 'festive-frame'].includes(layoutFamily)) {
    score += 0.06
    reasons.push('更适合精简强视觉表达')
  }
  return {
    score: Math.max(0.58, Math.min(0.98, Number(score.toFixed(3)))),
    reason: reasons.length ? reasons.slice(0, 3).join('，') : '兼顾前端选项与成片排版稳定性',
  }
}

function buildCandidatesByIds(ids: number[], industry: string, reasonFactory: (seed: TemplateSeed) => string) {
  return ids
    .map((id, index) => {
      const seed = templateSeeds.find((item) => item.id === id)
      if (!seed) return null
      return makeTemplateCandidate(seed, industry, reasonFactory(seed), Math.max(0.72, 0.94 - index * 0.04))
    })
    .filter(Boolean)
}

function pickDiversifiedTemplateIds(ids: number[], limit: number) {
  const uniqueIds = Array.from(new Set(ids.map((id) => Number(id)).filter(Boolean)))
  const byLayout = new Set<string>()
  const picked: number[] = []
  uniqueIds.forEach((id) => {
    if (picked.length >= limit) return
    const seed = templateSeeds.find((item) => item.id === id)
    if (!seed) return
    const layout = normalizeSeedLayoutToEngine(seed.layout)
    if (byLayout.has(layout)) return
    byLayout.add(layout)
    picked.push(id)
  })
  uniqueIds.forEach((id) => {
    if (picked.length >= limit) return
    if (!picked.includes(id)) picked.push(id)
  })
  return picked.slice(0, Math.max(1, limit))
}
function diversifyRankedCandidates(candidates: any[], limit: number) {
  const result: any[] = []
  const layoutSeen = new Set<string>()
  candidates.forEach((item) => {
    if (!item || result.length >= limit) return
    const family = String(item.layoutFamily || '').trim()
    if (!family || layoutSeen.has(family)) return
    layoutSeen.add(family)
    result.push(item)
  })
  candidates.forEach((item) => {
    if (!item || result.length >= limit) return
    if (!result.includes(item)) result.push(item)
  })
  return result.slice(0, Math.max(1, limit))
}

export function getTemplateSuggestionByPreset(presetKey: string, industry: string) {
  const candidates = resolveTemplateIdsByPreset(presetKey, industry)
  const matchedId = candidates[Math.floor(Math.random() * candidates.length)] || candidates[0] || 103
  const detail = getTemplateDetail(matchedId)
  const listItem = getTemplateList().find((item) => item.id === matchedId) || null
  return { detail, listItem }
}

export function getTemplateCandidatesByIndustry(industry: string, limit = 3) {
  const ids = resolveTemplateIdsByPreset('', industry).slice(0, Math.max(1, limit))
  return buildCandidatesByIds(ids, industry, () => `匹配${industry}常见场景`)
}

export function getTemplateCandidatesByPreset(presetKey: string, industry: string, limit = 4) {
  const ids = resolveTemplateIdsByPreset(presetKey, industry).slice(0, Math.max(1, limit))
  return buildCandidatesByIds(ids, industry, () => presetKey ? `匹配${presetKey}专属模板场景` : `匹配${industry}常见场景`)
}

export function getTemplateCandidatesSmart(presetKey: string, industry: string, limit = 6, context: SmartTemplateContext = {}) {
  const presetIds = resolveTemplateIdsByPreset(presetKey, industry)
  const industryIds = resolveTemplateIdsByIndustry(industry)
  const diversified = pickDiversifiedTemplateIds([...presetIds, ...industryIds, ...smartTemplateFallbackIds], Math.max(limit * 2, 8))
  const ranked = diversified
    .map((id) => {
      const seed = templateSeeds.find((item) => item.id === id)
      if (!seed) return null
      const scored = scoreTemplateSeed(seed, { ...context, industry, presetKey })
      return makeTemplateCandidate(seed, industry, scored.reason, scored.score)
    })
    .filter(Boolean)
    .sort((a: any, b: any) => Number(b.score || 0) - Number(a.score || 0))
  return diversifyRankedCandidates(ranked, limit)
}

export function getTemplateSuggestionSmart(presetKey: string, industry: string, context: SmartTemplateContext = {}) {
  const candidates = getTemplateCandidatesSmart(presetKey, industry, 6, context)
  const picked = candidates[0] || getTemplateCandidatesByIndustry(industry, 1)[0] || null
  const matchedId = Number((picked as any)?.seedId || 103)
  const detail = getTemplateDetail(matchedId)
  const listItem = getTemplateList().find((item) => item.id === matchedId) || null
  return { detail, listItem }
}
