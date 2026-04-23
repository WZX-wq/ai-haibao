import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import multiparty from 'multiparty'
import axiosClient from 'axios'
import axios from '../utils/http'
import { filePath } from '../configs'
import { checkCreateFolder, copyFile, randomCode, send } from '../utils/tools'
import { getTemplateCandidatesByIndustry, getTemplateSuggestionByIndustry } from './templateCatalog'
import { getClientStaticBaseUrl } from '../utils/clientPublicUrl'

type PosterGenerateInput = {
  theme: string
  purpose: string
  sizeKey: string
  style: string
  industry: string
  content: string
  qrUrl: string
  sourceImageUrl?: string
  baseImageUrl?: string
  /** 为 false 时不调用文生图主图，仅背景+版式（默认 true） */
  generateHeroImage?: boolean
}

type PosterPalette = {
  background: string
  surface: string
  primary: string
  secondary: string
  text: string
  muted: string
  swatches: string[]
}

type AiProviderMeta = { provider: string; model: string; isMockFallback: boolean; message: string }
type CopyResult = { title: string; slogan: string; body: string; cta: string }
type PosterImageResult = { imageUrl: string; prompt: string }
type SizePreset = { key: string; name: string; width: number; height: number }
type ProviderResult<T> = { result: T; meta: AiProviderMeta }
type PosterGenerateResult = CopyResult & {
  palette: PosterPalette
  background: PosterImageResult
  hero: PosterImageResult
  recommendedTemplate: any
  recommendedTemplates?: any[]
  templateCandidates?: any[]
  designPlan?: {
    industry: string
    tone: string
    layoutFamily: string
    density: 'light' | 'balanced' | 'dense'
    heroStrategy: 'product' | 'person' | 'scene' | 'editorial'
    ctaStrength: 'soft' | 'balanced' | 'strong'
    qrStrategy: 'none' | 'corner' | 'cta'
    templateCandidates: any[]
  }
  size: SizePreset
  providerMeta: Record<string, AiProviderMeta>
}

type RelayoutResult = {
  designPlan: PosterGenerateResult['designPlan']
  providerMeta: AiProviderMeta
}

const BAILIAN_CHAT_TIMEOUT = 20000
const BAILIAN_IMAGE_TIMEOUT = 18000
const BAILIAN_TASK_POLL_INTERVAL = 2000
const BAILIAN_TASK_MAX_POLLS = 6
const BAILIAN_RETRY_TIMES = 2
const DEFAULT_BAILIAN_IMAGE_COOLDOWN_MS = 2000
let bailianImageQueue: Promise<unknown> = Promise.resolve()
let lastBailianImageRequestAt = 0

const sizeMap: Record<string, SizePreset> = {
  a4: { key: 'a4', name: 'A4 竖版', width: 2480, height: 3508 },
  'wechat-cover': { key: 'wechat-cover', name: '公众号封面', width: 900, height: 383 },
  xiaohongshu: { key: 'xiaohongshu', name: '小红书封面', width: 1242, height: 1660 },
  moments: { key: 'moments', name: '朋友圈海报', width: 1242, height: 2208 },
  ecommerce: { key: 'ecommerce', name: '电商主图', width: 800, height: 800 },
  flyer: { key: 'flyer', name: '宣传单页', width: 1125, height: 2001 },
}
const DEFAULT_INDUSTRY = '活动'
const paletteByIndustry: Record<string, PosterPalette> = {
  电商: { background: '#FFF4E6', surface: '#FFFFFF', primary: '#FF8157', secondary: '#FFD1BE', text: '#1F2937', muted: '#8C4A34', swatches: ['#FFF4E6', '#FFD1BE', '#FF8157', '#1F2937'] },
  招聘: { background: '#F5FAFF', surface: '#FFFFFF', primary: '#246BFD', secondary: '#D7E8FF', text: '#102A43', muted: '#486581', swatches: ['#F5FAFF', '#D7E8FF', '#246BFD', '#102A43'] },
  活动: { background: '#FFF1F2', surface: '#FFFFFF', primary: '#E11D48', secondary: '#FFD6E0', text: '#3F1020', muted: '#9F1239', swatches: ['#FFF1F2', '#FFD6E0', '#FB7185', '#3F1020'] },
  课程: { background: '#FAF5FF', surface: '#FFFFFF', primary: '#6D28D9', secondary: '#E9D5FF', text: '#2E1065', muted: '#5B21B6', swatches: ['#FAF5FF', '#E9D5FF', '#C084FC', '#2E1065'] },
  节日: { background: '#FFF7ED', surface: '#FFFFFF', primary: '#EA580C', secondary: '#FED7AA', text: '#431407', muted: '#9A3412', swatches: ['#FFF7ED', '#FED7AA', '#FB923C', '#431407'] },
  健身: { background: '#F0FDF4', surface: '#FFFFFF', primary: '#16A34A', secondary: '#BBF7D0', text: '#052E16', muted: '#166534', swatches: ['#F0FDF4', '#BBF7D0', '#4ADE80', '#052E16'] },
  餐饮: { background: '#FFFBEB', surface: '#FFFFFF', primary: '#D97706', secondary: '#FDE68A', text: '#422006', muted: '#92400E', swatches: ['#FFFBEB', '#FDE68A', '#F59E0B', '#422006'] },
}

function getEnv(name: string, fallback = '') { return String(process.env[name] || fallback || '').trim() }
function getBailianOrigin() { return getEnv('AI_BAILIAN_BASE_URL', 'https://dashscope.aliyuncs.com').replace(/\/$/, '').replace(/\/compatible-mode\/v1$/, '').replace(/\/api\/v1$/, '') }
function getCompatibleBaseUrl() { return `${getBailianOrigin()}/compatible-mode/v1` }
function getApiBaseUrl() { return `${getBailianOrigin()}/api/v1` }
function getBailianApiKey() { return getEnv('AI_BAILIAN_API_KEY') }
function allowPosterFallback() { return getEnv('AI_POSTER_ALLOW_FALLBACK', 'true') === 'true' }
/** 默认开启：百炼 prompt 延展，主图/背景更富氛围（可用 AI_POSTER_IMAGE_PROMPT_EXTEND=false 关闭） */
function imagePromptExtendEnabled() { return getEnv('AI_POSTER_IMAGE_PROMPT_EXTEND', 'true').toLowerCase() !== 'false' }
function getProviderModel(stage: 'copy' | 'image' | 'background' | 'imageEdit' | 'cutout') { const defs = { copy: 'qwen-plus-latest', image: 'qwen-image-2.0-pro', background: 'wanx-background-generation-v2', imageEdit: 'qwen-image-edit-plus', cutout: 'image-instance-segmentation' }; const envs = { copy: 'AI_COPY_MODEL', image: 'AI_IMAGE_MODEL', background: 'AI_BACKGROUND_MODEL', imageEdit: 'AI_IMAGE_EDIT_MODEL', cutout: 'AI_CUTOUT_MODEL' } as const; return getEnv(envs[stage], defs[stage]) }
function getProviderMeta(stage: 'copy' | 'image' | 'background' | 'imageEdit' | 'cutout', overrides: Partial<AiProviderMeta>): AiProviderMeta { return { provider: overrides.provider || 'aliyun-bailian', model: overrides.model || getProviderModel(stage), isMockFallback: Boolean(overrides.isMockFallback), message: overrides.message || '' } }
function buildStrictProviderError(stage: string, error: unknown) { return `真实 AI ${stage}失败，且当前已关闭兜底回退：${(error as Error)?.message || String(error || 'unknown error')}` }
function ensureBailianReady(stage: 'copy' | 'image' | 'background' | 'imageEdit') { const apiKey = getBailianApiKey(); const model = getProviderModel(stage); if (!apiKey || !model) throw new Error(`${stage} provider config missing`); return { apiKey, model } }
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) }
/** 缺省 true；兼容字符串 "false" 等，避免网关/表单把布尔量转成字符串后主图开关失效 */
function normalizeGenerateHeroImage(raw: unknown): boolean {
  if (raw === undefined || raw === null) return true
  if (raw === false || raw === 0) return false
  if (raw === true || raw === 1) return true
  if (typeof raw === 'string') {
    const s = raw.trim().toLowerCase()
    if (s === 'false' || s === '0' || s === 'no' || s === 'off') return false
    if (s === 'true' || s === '1' || s === 'yes' || s === 'on') return true
  }
  return true
}
function normalizeInput(body: any): PosterGenerateInput {
  return {
    theme: String(body.theme || '').trim(),
    purpose: String(body.purpose || '').trim(),
    sizeKey: String(body.sizeKey || 'xiaohongshu').trim(),
    style: String(body.style || '').trim(),
    industry: String(body.industry || DEFAULT_INDUSTRY).trim(),
    content: String(body.content || '').trim(),
    qrUrl: String(body.qrUrl || '').trim(),
    sourceImageUrl: String(body.sourceImageUrl || '').trim(),
    baseImageUrl: String(body.baseImageUrl || '').trim(),
    generateHeroImage: normalizeGenerateHeroImage(body.generateHeroImage),
  }
}
function buildTitle(theme: string, purpose: string, industry: string) { const safeTheme = (theme || industry || 'AI 海报').trim(); if (safeTheme.includes('招聘')) return `${safeTheme} 火热招募`; if (safeTheme.includes('上新')) return `${safeTheme} 限时发布`; if (safeTheme.includes('课程')) return `${safeTheme} 开始报名`; return `${safeTheme} ${(purpose || '推广').trim()}` }
function buildSlogan(theme: string, industry: string, style: string) {
  const t = (theme || industry || '本季主推').trim()
  const st = (style || '高级简约').trim()
  return `${t}，${st}气质，一眼记住`
}
function buildBody(input: PosterGenerateInput) { return input.content || `${input.theme || input.industry}，适合${input.purpose || '推广'}场景，可继续替换文字、背景和主图。` }
function buildCta(purpose: string) { if (purpose.includes('报名')) return '立即报名'; if (purpose.includes('招聘') || purpose.includes('招募')) return '马上投递'; if (purpose.includes('促销')) return '立即抢购'; if (purpose.includes('引流')) return '扫码咨询'; return '立即了解' }
function buildCopyPrompt(input: PosterGenerateInput) {
  return [
    '以下为创作参数（仅供你理解需求，禁止把字段名或「主题：/用途：/行业：」这类标签格式写进任何输出字段）。',
    `主题：${input.theme || '未填写'}`,
    `用途：${input.purpose || '未填写'}`,
    `行业：${input.industry || DEFAULT_INDUSTRY}`,
    `风格：${input.style || '高级简约'}`,
    `尺寸：${input.sizeKey || 'xiaohongshu'}`,
    `补充信息：${input.content || '无'}`,
    '请只输出 JSON，字段：title、slogan、body、cta。',
    '语气：口语化、有号召力，避免陈词滥调堆砌；与所选风格气质一致（促销可略急促，高级风则克制）。',
    'title：4～14 字，一条面向消费者的主标题；不要写成参数说明或清单。',
    'slogan：10～28 字，一行辅助卖点；禁止与 title 重复；禁止出现「用途」「行业」「风格」等字段字样。',
    'body：40～120 字，信息分层（时间/地点/利益点可择要出现），避免与 title 逐句重复。',
    'cta：2～8 字行动按钮文案，动词开头，与用途匹配（报名/抢购/了解等）。',
  ].join('\n')
}
function buildPalettePrompt(input: PosterGenerateInput) {
  return [
    `主题：${input.theme || '未填写'}`,
    `用途：${input.purpose || '未填写'}`,
    `行业：${input.industry || DEFAULT_INDUSTRY}`,
    `风格：${input.style || '高级简约'}`,
    '请输出 JSON：background、surface、primary、secondary、text、muted、swatches(数组 4～6 个十六进制色)。',
    '微调要求：主色与辅助色层次分明；背景与 surface 拉开明度差；text 与 background 对比足够印刷可读；swatches 含主色与中性色，整体与行业+风格情绪一致。',
  ].join('\n')
}
/** 文生图 prompt 中禁止使用「用途：引流」这类标签式短句，否则模型容易把字直接画进画面 */
function buildImageSceneNarration(input: PosterGenerateInput) {
  const theme = String(input.theme || input.industry || '商业海报').trim() || '商业海报'
  const purpose = String(input.purpose || '推广').trim()
  const industry = String(input.industry || DEFAULT_INDUSTRY).trim()
  const style = String(input.style || '高级简约').trim()
  const note = String(input.content || '').trim()
  const parts = [`画面围绕「${theme}」展开`, `行业气质接近${industry}`, `传播意图偏${purpose}`, `视觉风格接近${style}`]
  if (note) parts.push(`可参考的补充气氛（不要逐字写在图上）：${note.slice(0, 140)}`)
  return parts.join('，')
}
/** 行业向氛围锚点，强化「广告剧照」感而非白底素材（与 palette 行业键对齐，逐类微调） */
function buildImageIndustryMood(input: PosterGenerateInput) {
  const ind = String(input.industry || '')
  if (/餐饮|美食|咖啡|茶饮/.test(ind)) return '强调食物质感与食欲氛围：热气或冷凝水珠、餐具高光、暖色与景深虚化背景，像美食杂志内页或品牌 TVC 静帧。'
  if (/电商|零售/.test(ind)) return '强调商品级光影：柔和棚拍或生活场景中的体积光、材质高光与反射层次，像电商头图或礼盒广告。'
  if (/招聘|人力|HR/.test(ind)) return '强调专业可信与空间感：自然窗光、简洁建筑线条或团队协作剪影氛围，像科技公司招聘主视觉。'
  if (/健身|运动|瑜伽|训练/.test(ind)) return '强调力量与动感：肌肉线条与环境光对比、汗水与织物细节、广角张力，像运动品牌 campaign。'
  if (/课程|教育|培训/.test(ind)) return '强调专注与成长感：柔和侧光、书本/屏幕/教室元素虚化、清新空气感，像在线教育品牌主图。'
  if (/节日|庆典|年会/.test(ind)) return '强调节庆光色与层次：光斑、丝带或礼花氛围粒子、暖冷对比但不过曝，像节日限定海报底图。'
  if (/活动/.test(ind)) return '强调传播记忆点：人群能量或城市夜景纵深感、舞台灯或霓虹点缀、空气介质感，像品牌活动主视觉。'
  if (/门店|开业|店铺/.test(ind)) return '强调到店氛围：门面景深、橱窗反射与街景虚化、欢迎感暖光，像新店开业或门店引流主图。'
  return '强调品牌级氛围：有纵深的空间、环境反射与柔和体积光，像商业广告摄影底图。'
}
/** 用途向情绪微调（与表单「用途」选项对齐） */
function buildImagePurposeMood(input: PosterGenerateInput) {
  const p = String(input.purpose || '')
  if (/促销|抢购/.test(p)) return '情绪偏紧迫与让利感：暖色点缀、高光略硬一点但仍干净。'
  if (/报名|招募/.test(p)) return '情绪偏信任与行动：画面稳定、主体眼神或手势有「邀请感」。'
  if (/引流/.test(p)) return '情绪偏好奇与探索：留白略多、视线引导线朝向画面内侧，便于后期放二维码。'
  if (/上新/.test(p)) return '情绪偏新鲜与期待：清爽高光、新品「首发」气质，避免陈旧库存感。'
  return '情绪积极正向、商业可信，避免廉价素材感。'
}
/** 用户所选「风格」映射到光影与调色倾向（与预设风格文案对齐） */
function buildImageStyleMood(styleRaw: string) {
  const s = String(styleRaw || '')
  if (/活力促销|活力|促销/.test(s)) return '调色偏饱和有 punch，可用边缘光或轻微镜头眩光增强能量，整体仍要干净不脏。'
  if (/年轻潮流|潮流|年轻/.test(s)) return '略广角透视、对比清晰、点缀霓虹或金属高光，偏青年文化品牌片。'
  if (/高级简约|极简|简约/.test(s)) return '低饱和克制配色、大面积留白呼吸感、细腻灰阶过渡与柔光箱式主光，偏奢侈品或科技极简广告。'
  if (/专业商务|商务|专业/.test(s)) return '中性光比、横平竖直构图、稳重景深，偏企业年报或发布会视觉。'
  if (/清新温暖|温暖|清新/.test(s)) return '柔和晨光或黄金时刻色温、轻雾感空气透视、材质柔软，偏生活方式品牌情绪片。'
  if (/严肃|政务/.test(s)) return '低反差、构图端正、色彩克制，偏政务与公共传播视觉。'
  return '光影统一、材质可信、整体像精修商业摄影而非随手快照。'
}
/** 强氛围优先时的通用质感后缀（仍禁止画面内可读字） */
function buildImageCraftSuffix(_mode: 'background' | 'hero') {
  return '整体追求高完成度商业视觉：电影感布光、统一色彩科学、细腻材质与微妙环境体积雾；浅景深突出主体；可带极轻微胶片颗粒或 halation，但不要脏噪点；像 8K 广告静帧的质感与层次。'
}
function buildImagePrompt(input: PosterGenerateInput, mode: 'background' | 'hero') {
  const narration = buildImageSceneNarration(input)
  const industryMood = buildImageIndustryMood(input)
  const purposeMood = buildImagePurposeMood(input)
  const styleMood = buildImageStyleMood(input.style || '')
  const craft = buildImageCraftSuffix(mode)
  if (mode === 'background') {
    return [
      '请生成商业海报可用的「背景层」：强氛围、可识别的空间或材质情绪，但画面中尽量不要出现可读文字与 Logo；适合作为整页底层。',
      narration + '。',
      industryMood,
      purposeMood,
      styleMood,
      craft,
      '单幅连续场景或有机纹理，景深自然；不要画中画、不要嵌套小海报、不要相框里再套一张海报。',
    ].join('')
  }
  const personHint = /健身|运动|瑜伽|训练/.test(String(input.industry || '')) ? '以真实健身房或运动场景摄影为主，人物自然，构图留白。' : ''
  return [
    '请生成一张用于商业海报的「主视觉摄影或插画底图」（单张连贯画面），后续会在上层由设计师排版叠字；本图要承担强氛围与情绪感染力，完成度接近杂志主视觉或品牌 TVC 静帧，但绝不是已排好字的成品海报。',
    personHint,
    narration + '。',
    industryMood,
    purposeMood,
    styleMood,
    craft,
    '硬性要求：画面中不得出现任何可读文字、汉字、字母、数字、二维码、Logo、App 界面、网页截图、手机边框内的界面、KT 板、传单、优惠券、信息卡片；禁止拼贴画框中的迷你海报、禁止画中画、禁止递归嵌套另一张带标题的海报、禁止圆角悬浮贴纸式「小海报」、禁止带标题栏的 UI 面板；不要出现「用途」「行业」「主题」「风格」等标签字样。',
    '构图：单一主体或单一场景镜头，主体清晰、光影戏剧感与层次丰富，同时在上半区或画面边缘保留可叠字的安全留白。',
  ].join('')
}
function cleanJsonText(content: string) { return content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim() }
function normalizeImageResult(imageUrl: string, prompt: string): PosterImageResult { return { imageUrl, prompt } }
function shouldRetryBailianError(error: any) { const status = Number(error?.response?.status || 0); const message = String(error?.message || ''); return status === 429 || status >= 500 || error?.code === 'ECONNRESET' || error?.code === 'ETIMEDOUT' || /timeout/i.test(message) || /socket hang up/i.test(message) }
async function withBailianRetry<T>(task: () => Promise<T>) { let lastError: unknown; for (let i = 0; i <= BAILIAN_RETRY_TIMES; i += 1) { try { return await task() } catch (error) { lastError = error; if (i >= BAILIAN_RETRY_TIMES || !shouldRetryBailianError(error)) throw error; await new Promise((r) => setTimeout(r, (i + 1) * 2000)) } } throw lastError }
function getBailianImageCooldownMs() { const value = Number(getEnv('AI_BAILIAN_IMAGE_COOLDOWN_MS', String(DEFAULT_BAILIAN_IMAGE_COOLDOWN_MS))); return Number.isFinite(value) && value >= 0 ? value : DEFAULT_BAILIAN_IMAGE_COOLDOWN_MS }
async function queueBailianImageRequest<T>(task: () => Promise<T>) { const run = async () => { const wait = getBailianImageCooldownMs() - (Date.now() - lastBailianImageRequestAt); if (lastBailianImageRequestAt > 0 && wait > 0) await new Promise((r) => setTimeout(r, wait)); lastBailianImageRequestAt = Date.now(); return task() }; const result = bailianImageQueue.then(run, run); bailianImageQueue = result.catch(() => undefined); return result }
function ensureAbsoluteUrl(url: string) { if (/^https?:\/\//i.test(url)) return url; if (url.startsWith('/')) return `${getBailianOrigin()}${url}`; return url }
function getImageExtension(contentType: string, fallback = 'png') { if (contentType.includes('jpeg')) return 'jpg'; if (contentType.includes('webp')) return 'webp'; if (contentType.includes('gif')) return 'gif'; return fallback }
async function saveRemoteImageToLocal(url: string, folder: string) { const finalUrl = ensureAbsoluteUrl(url); const targetFolder = path.join(filePath, folder); checkCreateFolder(targetFolder); const response = await axiosClient.get(finalUrl, { responseType: 'arraybuffer', timeout: 120000 }); const extension = getImageExtension(String(response.headers['content-type'] || '')); const fileName = `${randomCode(14)}.${extension}`; fs.writeFileSync(path.join(targetFolder, fileName), Buffer.from(response.data)); return `${getClientStaticBaseUrl()}${folder}/${fileName}` }
async function saveRemoteImageToLocalAsset(url: string, folder: string) { const assetUrl = await saveRemoteImageToLocal(url, folder); const fileName = path.basename(assetUrl); return { fileName, assetPath: path.join(filePath, folder, fileName), assetUrl } }
function extractTaskImageUrl(response: any) { const output = response?.output || {}; const results = output.results || output.result || []; const candidates: string[] = []; const push = (value: any) => value && candidates.push(String(value)); if (Array.isArray(results)) results.forEach((item) => { push(item?.url); push(item?.image_url); push(item?.image?.url) }); else { push(results?.url); push(results?.image_url); push(results?.image?.url) } (output.choices || []).forEach((choice: any) => (choice?.message?.content || []).forEach((item: any) => { push(item?.image); push(item?.url) })); push(output?.image_url); push(output?.url); push(output?.result_url); const usable = candidates.find(Boolean); if (!usable) throw new Error('missing generated image url'); return usable }
async function pollBailianTask(taskId: string) { for (let i = 0; i < BAILIAN_TASK_MAX_POLLS; i += 1) { const data: any = await axiosClient.get(`${getApiBaseUrl()}/tasks/${taskId}`, { headers: { Authorization: `Bearer ${getBailianApiKey()}` }, timeout: BAILIAN_IMAGE_TIMEOUT }); const status = String(data?.output?.task_status || '').toUpperCase(); if (status === 'SUCCEEDED') return data; if (status === 'FAILED' || status === 'CANCELED') throw new Error(String(data?.output?.message || data?.message || data?.code || 'task failed')); await new Promise((r) => setTimeout(r, BAILIAN_TASK_POLL_INTERVAL)) } throw new Error('task timeout') }
async function requestBailianChat(messages: Array<{ role: string; content: string }>, model: string) { const data: any = await withBailianRetry(() => axios.post(`${getCompatibleBaseUrl()}/chat/completions`, { model, messages, temperature: 0.8, response_format: { type: 'json_object' } }, { headers: { Authorization: `Bearer ${getBailianApiKey()}`, 'Content-Type': 'application/json' }, timeout: BAILIAN_CHAT_TIMEOUT })); const content = data?.choices?.[0]?.message?.content || ''; if (!content) throw new Error('empty model response'); return JSON.parse(cleanJsonText(content)) }
async function requestBailianTextToImage(prompt: string, model: string, size: SizePreset, promptExtend = false) { return queueBailianImageRequest(() => withBailianRetry(() => axios.post(`${getApiBaseUrl()}/services/aigc/multimodal-generation/generation`, { model, input: { messages: [{ role: 'user', content: [{ text: prompt }] }] }, parameters: { size: `${Math.min(size.width, 2048)}*${Math.min(size.height, 2048)}`, n: 1, prompt_extend: promptExtend, watermark: false } }, { headers: { Authorization: `Bearer ${getBailianApiKey()}`, 'Content-Type': 'application/json' }, timeout: BAILIAN_IMAGE_TIMEOUT }))) }
async function requestBailianImageEdit(prompt: string, model: string, imageUrl: string, size: SizePreset) {
  return queueBailianImageRequest(() =>
    withBailianRetry(() =>
      axios.post(
        `${getApiBaseUrl()}/services/aigc/multimodal-generation/generation`,
        {
          model,
          input: { messages: [{ role: 'user', content: [{ image: imageUrl }, { text: prompt }] }] },
          parameters: { size: `${Math.min(size.width, 2048)}*${Math.min(size.height, 2048)}`, n: 1, prompt_extend: imagePromptExtendEnabled(), watermark: false },
        },
        { headers: { Authorization: `Bearer ${getBailianApiKey()}`, 'Content-Type': 'application/json' }, timeout: BAILIAN_IMAGE_TIMEOUT },
      ),
    ),
  )
}
async function requestBailianBackground(prompt: string, model: string, baseImageUrl: string) { const data: any = await queueBailianImageRequest(() => withBailianRetry(() => axios.post(`${getApiBaseUrl()}/services/aigc/background-generation/generation/`, { model, input: { base_image_url: baseImageUrl, ref_prompt: prompt } }, { headers: { Authorization: `Bearer ${getBailianApiKey()}`, 'Content-Type': 'application/json', 'X-DashScope-Async': 'enable' }, timeout: BAILIAN_IMAGE_TIMEOUT }))); const taskId = String(data?.output?.task_id || '').trim(); if (!taskId) throw new Error('missing background task id'); return pollBailianTask(taskId) }
function sanitizeCopyEcho(raw: string) {
  let s = String(raw || '').trim()
  s = s.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !/^(主题|用途|行业|风格|尺寸|补充信息)[：:]/.test(l)).join('\n')
  s = s.replace(/主视觉预览图[/／、\s]*氛围图/g, '')
  s = s.replace(/(?:^|[\s\u3000；;，,])(主题|用途|行业|风格|尺寸)[：:]\s*[^\s\n\u3000；;，,。]{1,32}/g, ' ')
  s = s.replace(/\s{2,}/g, ' ').trim()
  return s
}
function finalizeCopyField(value: string, fallback: string) {
  const cleaned = sanitizeCopyEcho(value)
  return cleaned || sanitizeCopyEcho(fallback) || fallback
}
async function generateCopyInternal(input: PosterGenerateInput): Promise<ProviderResult<CopyResult>> { try { const parsed = await requestBailianChat([{ role: 'system', content: '你是中文海报文案助手。只输出 JSON。slogan 必须是辅助性一行卖点，不得与 title 重复或同义复述。title/slogan/body 必须是给消费者看的句子，禁止出现「主题：」「用途：」「行业：」等字段名或参数清单。四个字段在语气与信息上相互补充，避免四句各说各话。' }, { role: 'user', content: buildCopyPrompt(input) }], ensureBailianReady('copy').model); const fbTitle = buildTitle(input.theme, input.purpose, input.industry); const fbSlogan = buildSlogan(input.theme, input.industry, input.style); const fbBody = buildBody(input); const fbCta = buildCta(input.purpose); return { result: { title: finalizeCopyField(String(parsed.title || '').trim(), fbTitle), slogan: finalizeCopyField(String(parsed.slogan || '').trim(), fbSlogan), body: finalizeCopyField(String(parsed.body || '').trim(), fbBody), cta: finalizeCopyField(String(parsed.cta || '').trim(), fbCta) }, meta: getProviderMeta('copy', { provider: 'aliyun-bailian', model: ensureBailianReady('copy').model, message: '已使用阿里百炼真实文案模型生成推荐文案。' }) } } catch (error) { if (!allowPosterFallback()) throw new Error(buildStrictProviderError('文案生成', error)); return { result: { title: buildTitle(input.theme, input.purpose, input.industry), slogan: buildSlogan(input.theme, input.industry, input.style), body: buildBody(input), cta: buildCta(input.purpose) }, meta: getProviderMeta('copy', { provider: 'mock', model: 'mock-copy', isMockFallback: true, message: `阿里百炼文案生成失败，已回退到本地规则：${(error as Error).message}` }) } } }
async function generatePaletteInternal(input: PosterGenerateInput): Promise<ProviderResult<PosterPalette>> { const preset = clone(paletteByIndustry[input.industry] || paletteByIndustry[DEFAULT_INDUSTRY]); try { const parsed = await requestBailianChat([{ role: 'system', content: '你是中文海报配色助手。只输出 JSON。色板需与行业情绪、所选风格一致；主色不宜过多（一至二个记忆色即可），中性色支撑文字阅读。' }, { role: 'user', content: buildPalettePrompt(input) }], ensureBailianReady('copy').model); const swatches = Array.isArray(parsed.swatches) ? parsed.swatches.map(String).filter(Boolean) : preset.swatches; return { result: { background: String(parsed.background || preset.background), surface: String(parsed.surface || preset.surface), primary: String(parsed.primary || preset.primary), secondary: String(parsed.secondary || preset.secondary), text: String(parsed.text || preset.text), muted: String(parsed.muted || preset.muted), swatches: swatches.length ? swatches : preset.swatches }, meta: getProviderMeta('copy', { provider: 'aliyun-bailian', model: ensureBailianReady('copy').model, message: '已使用阿里百炼真实模型生成推荐配色。' }) } } catch (error) { if (!allowPosterFallback()) throw new Error(buildStrictProviderError('配色生成', error)); return { result: preset, meta: getProviderMeta('copy', { provider: 'mock', model: 'mock-palette', isMockFallback: true, message: `阿里百炼配色推荐失败，已回退到行业预设：${(error as Error).message}` }) } } }
function makeBackgroundSvg(_input: PosterGenerateInput, palette: PosterPalette) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1600"><defs><radialGradient id="bg1" cx="22%" cy="18%" r="55%"><stop offset="0%" stop-color="${palette.secondary}" stop-opacity="0.45"/><stop offset="100%" stop-color="${palette.background}" stop-opacity="0"/></radialGradient><radialGradient id="bg2" cx="88%" cy="78%" r="50%"><stop offset="0%" stop-color="${palette.primary}" stop-opacity="0.2"/><stop offset="100%" stop-color="${palette.background}" stop-opacity="0"/></radialGradient></defs><rect width="1200" height="1600" fill="${palette.background}"/><rect width="1200" height="1600" fill="url(#bg1)"/><rect width="1200" height="1600" fill="url(#bg2)"/><ellipse cx="980" cy="220" r="200" fill="${palette.primary}" opacity="0.1"/><rect x="140" y="360" width="920" height="640" rx="56" fill="#ffffff" opacity="0.52"/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
function makeHeroSvg(_input: PosterGenerateInput, palette: PosterPalette) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 760"><defs><linearGradient id="hg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${palette.surface}" stop-opacity="0.98"/><stop offset="38%" stop-color="${palette.secondary}" stop-opacity="0.62"/><stop offset="100%" stop-color="${palette.primary}" stop-opacity="0.42"/></linearGradient><radialGradient id="h1" cx="72%" cy="28%" r="58%"><stop offset="0%" stop-color="${palette.primary}" stop-opacity="0.35"/><stop offset="100%" stop-color="${palette.primary}" stop-opacity="0"/></radialGradient></defs><rect width="1000" height="760" rx="44" fill="url(#hg)"/><rect width="1000" height="760" rx="44" fill="url(#h1)"/><ellipse cx="200" cy="520" rx="300" ry="220" fill="${palette.secondary}" opacity="0.28"/><rect x="0" y="0" width="1000" height="760" rx="44" fill="none" stroke="${palette.primary}" stroke-opacity="0.1" stroke-width="2"/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
async function mockImageProvider(input: PosterGenerateInput, palette: PosterPalette, mode: 'background' | 'hero', stage: 'image' | 'background' | 'imageEdit'): Promise<ProviderResult<PosterImageResult>> { const imageUrl = mode === 'background' ? makeBackgroundSvg(input, palette) : makeHeroSvg(input, palette); return { result: normalizeImageResult(imageUrl, buildImagePrompt(input, mode)), meta: getProviderMeta(stage, { provider: 'mock', model: stage === 'background' ? 'mock-background' : stage === 'imageEdit' ? 'mock-image-edit' : 'mock-image', isMockFallback: true, message: '当前未使用真实图像模型，已回退到本地演示图。' }) } }
async function bailianHeroProvider(input: PosterGenerateInput, size: SizePreset): Promise<ProviderResult<PosterImageResult>> {
  const ready = ensureBailianReady('image')
  const prompt = buildImagePrompt(input, 'hero')
  const extend = imagePromptExtendEnabled()
  const taskResult = await requestBailianTextToImage(prompt, ready.model, size, extend)
  const msg = extend ? '已使用阿里百炼主视觉模型生成图片（已开启 prompt 延展以增强氛围）。' : '已使用阿里百炼真实主视觉模型生成图片。'
  return { result: normalizeImageResult(await saveRemoteImageToLocal(extractTaskImageUrl(taskResult), 'ai'), prompt), meta: getProviderMeta('image', { provider: 'aliyun-bailian', model: ready.model, message: msg }) }
}
async function bailianBackgroundProvider(input: PosterGenerateInput, size: SizePreset): Promise<ProviderResult<PosterImageResult>> { const prompt = buildImagePrompt(input, 'background'); if (!String(input.baseImageUrl || '').trim()) { const rerouted = await bailianHeroProvider(input, size); return { result: rerouted.result, meta: getProviderMeta('background', { provider: rerouted.meta.provider, model: rerouted.meta.model, message: `未提供可换背景的前景图，已自动切换到真实文生图路径。实际模型：${rerouted.meta.model}` }) } } const taskResult = await requestBailianBackground(prompt, getProviderModel('background'), String(input.baseImageUrl)); return { result: normalizeImageResult(await saveRemoteImageToLocal(extractTaskImageUrl(taskResult), 'ai'), prompt), meta: getProviderMeta('background', { provider: 'aliyun-bailian', model: getProviderModel('background'), message: '已使用阿里百炼真实背景模型完成换背景。' }) } }
async function bailianImageEditProvider(input: PosterGenerateInput, size: SizePreset): Promise<ProviderResult<PosterImageResult>> { const prompt = buildImagePrompt(input, 'hero'); if (!String(input.sourceImageUrl || '').trim()) { const rerouted = await bailianHeroProvider(input, size); return { result: rerouted.result, meta: getProviderMeta('imageEdit', { provider: rerouted.meta.provider, model: rerouted.meta.model, message: `未提供待编辑图片，已自动切换到真实文生图换图。实际模型：${rerouted.meta.model}` }) } } const ready = ensureBailianReady('imageEdit'); const taskResult = await requestBailianImageEdit(prompt, ready.model, String(input.sourceImageUrl), size); return { result: normalizeImageResult(await saveRemoteImageToLocal(extractTaskImageUrl(taskResult), 'ai'), prompt), meta: getProviderMeta('imageEdit', { provider: 'aliyun-bailian', model: ready.model, message: '已使用阿里百炼真实换图模型生成新主图。' }) } }
async function generateHeroImageInternal(input: PosterGenerateInput, palette: PosterPalette, size: SizePreset) { try { return await bailianHeroProvider(input, size) } catch (error) { if (!allowPosterFallback()) throw new Error(buildStrictProviderError('主图生成', error)); return mockImageProvider(input, palette, 'hero', 'image') } }
async function generateBackgroundInternal(input: PosterGenerateInput, palette: PosterPalette, size: SizePreset) { try { return await bailianBackgroundProvider(input, size) } catch (error) { const status = Number((error as any)?.response?.status || 0); if (status === 400) { const rerouted = await bailianHeroProvider(input, size); return { result: rerouted.result, meta: getProviderMeta('background', { provider: rerouted.meta.provider, model: rerouted.meta.model, message: `背景模型无法直接处理当前素材，已自动切换到真实文生图路径：${(error as Error).message}` }) } } if (!allowPosterFallback()) throw new Error(buildStrictProviderError('背景生成', error)); return mockImageProvider(input, palette, 'background', 'background') } }
async function replaceImageInternal(input: PosterGenerateInput, palette: PosterPalette, size: SizePreset) { try { return await bailianImageEditProvider(input, size) } catch (error) { const status = Number((error as any)?.response?.status || 0); if (status === 400) { const rerouted = await bailianHeroProvider(input, size); return { result: rerouted.result, meta: getProviderMeta('imageEdit', { provider: rerouted.meta.provider, model: rerouted.meta.model, message: `换图模型无法直接处理当前素材，已自动切换到真实文生图路径：${(error as Error).message}` }) } } if (!allowPosterFallback()) throw new Error(buildStrictProviderError('换图', error)); return mockImageProvider(input, palette, 'hero', 'imageEdit') } }
function getPythonExecutable() { return getEnv('AI_CUTOUT_PYTHON', 'python3') }
function getRembgModelName() { return getEnv('AI_CUTOUT_REMBG_MODEL', 'u2net') }
function runCutoutWorker(args: string[]) { return new Promise<any>((resolve, reject) => { const scriptPath = path.join(process.cwd(), 'scripts', 'cutout_worker.py'); const child = spawn(getPythonExecutable(), [scriptPath, ...args], { cwd: process.cwd(), windowsHide: true }); let stdout = ''; let stderr = ''; child.stdout.on('data', (chunk) => { stdout += String(chunk) }); child.stderr.on('data', (chunk) => { stderr += String(chunk) }); child.on('error', reject); child.on('close', (code) => { if (code !== 0) return reject(new Error(stderr || stdout || `cutout worker exited with code ${code}`)); try { resolve(stdout ? JSON.parse(stdout) : {}) } catch { reject(new Error(`invalid cutout worker response: ${stdout || stderr}`)) } }) }) }
async function inspectLocalImage(imagePath: string) { return runCutoutWorker(['inspect', imagePath]) }
async function mergeMaskToTransparent(rawPath: string, maskPath: string, outputPath: string) { return runCutoutWorker(['merge-mask', rawPath, maskPath, outputPath]) }
async function runRembgCutout(inputPath: string, outputPath: string) { return runCutoutWorker(['rembg', inputPath, outputPath, getRembgModelName()]) }
async function uploadLocalFileToPublicUrl(filePathname: string, fileName: string) { const FormDataCtor = (global as any).FormData; const BlobCtor = (global as any).Blob; const form: any = new FormDataCtor(); form.append('file', new BlobCtor([fs.readFileSync(filePathname)]), fileName); const response = await axiosClient.post('https://tmpfiles.org/api/v1/upload', form, { timeout: 120000, maxBodyLength: Infinity, maxContentLength: Infinity }); const tempUrl = response?.data?.data?.url || ''; if (!tempUrl) throw new Error('temporary public upload failed'); return String(tempUrl).replace('http://', 'https://').replace('tmpfiles.org/', 'tmpfiles.org/dl/') }
async function requestBailianCutout(model: string, imageUrl: string) { const response: any = await axiosClient({ method: 'post', url: `${getApiBaseUrl()}/services/aigc/image2image/image-synthesis`, data: { model, input: { image_url: imageUrl }, parameters: { return_form: 'transparent' } }, headers: { Authorization: `Bearer ${getBailianApiKey()}`, 'Content-Type': 'application/json', 'X-DashScope-Async': 'enable', 'X-DashScope-OssResourceResolve': 'enable' }, timeout: 120000 }); const taskId = String(response.data?.output?.task_id || '').trim(); if (!taskId) throw new Error('missing cutout task id'); return pollBailianTask(taskId) }
function extractCutoutUrl(response: any) { const output = response?.output || {}; const results = Array.isArray(output.results) ? output.results[0] : output.results || output.result || {}; return results?.transparent_image_url || results?.output_image_url || results?.output_image_url_list?.[0] || results?.image_url || results?.url || output?.transparent_image_url || output?.output_image_url || output?.image_url || output?.url || '' }
async function bailianCutoutProvider(rawUrl: string, localPath: string, fileName: string) { const taskResult = await requestBailianCutout(getProviderModel('cutout'), await uploadLocalFileToPublicUrl(localPath, fileName)); const remoteUrl = extractCutoutUrl(taskResult); if (!remoteUrl) throw new Error('cutout result missing image url'); const remoteAsset = await saveRemoteImageToLocalAsset(remoteUrl, 'cutout'); const imageInfo = await inspectLocalImage(remoteAsset.assetPath); let resultUrl = remoteAsset.assetUrl; if (String(imageInfo.mode || '').toUpperCase() === 'L') { const mergedFileName = `${path.basename(fileName, path.extname(fileName))}_aliyun_cutout.png`; const mergedPath = path.join(filePath, 'cutout', mergedFileName); await mergeMaskToTransparent(localPath, remoteAsset.assetPath, mergedPath); resultUrl = `${getClientStaticBaseUrl()}cutout/${mergedFileName}` } return { result: { rawUrl, resultUrl }, meta: getProviderMeta('cutout', { provider: 'aliyun-human-cutout', model: getProviderModel('cutout'), message: 'Aliyun human cutout completed and returned a transparent PNG.' }) } as ProviderResult<{ rawUrl: string; resultUrl: string }> }
async function rembgCutoutProvider(rawUrl: string, localPath: string, fileName: string) { const outputFileName = `${path.basename(fileName, path.extname(fileName))}_rembg.png`; const outputPath = path.join(filePath, 'cutout', outputFileName); await runRembgCutout(localPath, outputPath); return { result: { rawUrl, resultUrl: `${getClientStaticBaseUrl()}cutout/${outputFileName}` }, meta: getProviderMeta('cutout', { provider: 'rembg', model: getRembgModelName(), message: 'Universal cutout completed with local rembg model.' }) } as ProviderResult<{ rawUrl: string; resultUrl: string }> }
async function mockCutoutProvider(rawUrl: string) { return { result: { rawUrl, resultUrl: rawUrl }, meta: getProviderMeta('cutout', { provider: 'mock', model: 'mock-cutout', isMockFallback: true, message: '智能抠图当前仍为演示模式，已保留原图用于后续编辑。' }) } as ProviderResult<{ rawUrl: string; resultUrl: string }> }
function getCutoutProviderChain() { return getEnv('AI_CUTOUT_PROVIDER', 'rembg,aliyun-human-cutout,mock').split(',').map((item) => item.trim()).filter(Boolean) }
function sanitizeCutoutFailure(error: unknown) {
  const message = String((error as Error)?.message || error || 'unknown error')
    .replace(/\s+/g, ' ')
    .trim()
  if (/cannot identify image file/i.test(message) || /UnidentifiedImageError/i.test(message)) {
    return '当前图片格式暂不支持抠图，请先替换为 PNG、JPG 或 WebP 位图后再试'
  }
  if (/status code 400/i.test(message)) {
    return '抠图服务暂时无法处理这张图片，请更换图片后重试'
  }
  return message.split('Traceback')[0].trim().slice(0, 180) || '抠图失败'
}
function deriveDesignPlan(input: PosterGenerateInput, candidates: any[]) {
  const purpose = String(input.purpose || '')
  const contentLen = String(input.content || '').length
  const hasQr = Boolean(String(input.qrUrl || '').trim())
  const density: 'light' | 'balanced' | 'dense' = contentLen > 48 ? 'dense' : contentLen > 16 ? 'balanced' : 'light'
  const ctaStrength: 'soft' | 'balanced' | 'strong' = /促销|报名|招募|抢购/.test(purpose) ? 'strong' : /引流|上新/.test(purpose) ? 'balanced' : 'soft'
  const qrStrategy: 'none' | 'corner' | 'cta' = hasQr ? (ctaStrength === 'strong' ? 'cta' : 'corner') : 'none'
  const layoutFamily = String(candidates?.[0]?.layoutFamily || 'hero-left')
  const heroStrategy: 'product' | 'person' | 'scene' | 'editorial' = /招聘/.test(input.industry)
    ? 'person'
    : /健身|运动|瑜伽|训练/.test(input.industry)
      ? 'person'
      : /活动|节日/.test(input.industry)
        ? 'scene'
        : /餐饮|美食|咖啡|茶饮/.test(input.industry)
          ? 'scene'
          : /课程/.test(input.industry)
            ? 'editorial'
            : 'product'
  return {
    industry: input.industry || DEFAULT_INDUSTRY,
    tone: input.style || '高级简约',
    layoutFamily,
    density,
    heroStrategy,
    ctaStrength,
    qrStrategy,
    templateCandidates: candidates,
  }
}

async function relayoutDesignPlanInternal(input: PosterGenerateInput, candidates: any[]) {
  const basePlan = deriveDesignPlan(input, candidates)
  const allow = [
    'hero-center',
    'hero-left',
    'split-editorial',
    'grid-product',
    'magazine-cover',
    'festive-frame',
    'list-recruitment',
    'xiaohongshu-note',
    'clean-course',
    'premium-offer',
  ]
  const prompt = [
    '你是中文海报版式优化器。只输出 JSON，不要解释。',
    `主题：${input.theme || '未填写'}`,
    `行业：${input.industry || DEFAULT_INDUSTRY}`,
    `用途：${input.purpose || '推广'}`,
    `风格：${input.style || '高级简约'}`,
    `尺寸：${input.sizeKey || 'xiaohongshu'}`,
    `补充信息：${input.content || '无'}`,
    `是否有二维码：${String(Boolean(input.qrUrl))}`,
    `候选骨架（优先从中选择）：${(candidates || []).map((c: any) => c?.layoutFamily).filter(Boolean).join(', ') || '无'}`,
    `可用骨架列表：${allow.join(', ')}`,
    '输出字段：layoutFamily(必填)、density(light|balanced|dense)、heroStrategy(product|person|scene|editorial)、ctaStrength(soft|balanced|strong)、qrStrategy(none|corner|cta)。',
    '微调原则：字多/补充长→density 偏 dense；以人为中心行业→heroStrategy 可考虑 person；强转化用途→ctaStrength 偏 strong；有二维码且 CTA 强→qrStrategy 可 cta。',
  ].join('\n')

  try {
    const parsed: any = await requestBailianChat([{ role: 'system', content: '只输出 JSON。字段值须在允许列表内，与主题与行业一致。' }, { role: 'user', content: prompt }], ensureBailianReady('copy').model)
    const layoutFamily = String(parsed.layoutFamily || basePlan.layoutFamily || 'hero-left').trim()
    const density = (['light', 'balanced', 'dense'].includes(parsed.density) ? parsed.density : basePlan.density) as any
    const heroStrategy = (['product', 'person', 'scene', 'editorial'].includes(parsed.heroStrategy) ? parsed.heroStrategy : basePlan.heroStrategy) as any
    const ctaStrength = (['soft', 'balanced', 'strong'].includes(parsed.ctaStrength) ? parsed.ctaStrength : basePlan.ctaStrength) as any
    const qrStrategy = (['none', 'corner', 'cta'].includes(parsed.qrStrategy) ? parsed.qrStrategy : basePlan.qrStrategy) as any

    return {
      plan: {
        ...basePlan,
        layoutFamily: allow.includes(layoutFamily) ? layoutFamily : basePlan.layoutFamily,
        density,
        heroStrategy,
        ctaStrength,
        qrStrategy,
        templateCandidates: candidates,
      },
      meta: getProviderMeta('copy', { provider: 'aliyun-bailian', model: ensureBailianReady('copy').model, message: '已使用阿里百炼模型完成一键重排版式规划。' }),
    }
  } catch (error) {
    if (!allowPosterFallback()) throw new Error(buildStrictProviderError('一键重排', error))
    return {
      plan: basePlan,
      meta: getProviderMeta('copy', {
        provider: 'mock',
        model: 'mock-relayout',
        isMockFallback: true,
        message: `一键重排调用失败，已回退到本地规则：${(error as Error).message}`,
      }),
    }
  }
}
async function generatePosterDraftInternal(input: PosterGenerateInput): Promise<PosterGenerateResult> {
  const size = sizeMap[input.sizeKey] || sizeMap.xiaohongshu
  const [paletteResult, copyResult] = await Promise.all([generatePaletteInternal(input), generateCopyInternal(input)])
  const backgroundResult = await generateBackgroundInternal(input, paletteResult.result, size)
  const wantHero = input.generateHeroImage !== false
  const canReuseBackgroundAsHero =
    wantHero &&
    !String(input.baseImageUrl || '').trim() &&
    String(backgroundResult?.result?.imageUrl || '').trim().length > 0
  const heroResult = canReuseBackgroundAsHero
    ? ({
        result: {
          imageUrl: String(backgroundResult.result.imageUrl || ''),
          prompt: String(backgroundResult.result.prompt || ''),
        },
        meta: getProviderMeta('image', {
          provider: backgroundResult.meta.provider,
          model: backgroundResult.meta.model,
          isMockFallback: backgroundResult.meta.isMockFallback,
          message: '已复用背景生成结果作为主图，以降低总耗时并避免网关超时。',
        }),
      } as ProviderResult<PosterImageResult>)
    : wantHero
      ? await generateHeroImageInternal(input, paletteResult.result, size)
      : ({
          result: { imageUrl: '', prompt: '' },
          meta: getProviderMeta('image', { provider: 'none', model: 'skipped', isMockFallback: false, message: '已跳过 AI 主图，仅生成背景与文案版式。' }),
        } as ProviderResult<PosterImageResult>)
  const recommendation = getTemplateSuggestionByIndustry(input.industry)
  const templateCandidates = getTemplateCandidatesByIndustry(input.industry, 3)
  const designPlan = deriveDesignPlan(input, templateCandidates)
  return {
    title: copyResult.result.title,
    slogan: copyResult.result.slogan,
    body: copyResult.result.body,
    cta: copyResult.result.cta,
    palette: paletteResult.result,
    background: backgroundResult.result,
    hero: heroResult.result,
    recommendedTemplate: recommendation.listItem,
    recommendedTemplates: templateCandidates,
    templateCandidates,
    designPlan,
    size,
    providerMeta: { copy: copyResult.meta, palette: paletteResult.meta, background: backgroundResult.meta, image: heroResult.meta },
  }
}
export async function generatePosterDraft(req: any, res: any) { try { send.success(res, await generatePosterDraftInternal(normalizeInput(req.body || {}))) } catch (error) { console.error(error); send.error(res, (error as Error).message || 'generate poster failed') } }
export async function generateCopy(req: any, res: any) { try { const result = await generateCopyInternal(normalizeInput(req.body || {})); send.success(res, { title: result.result.title, slogan: result.result.slogan, body: result.result.body, cta: result.result.cta, providerMeta: result.meta }) } catch (error) { console.error(error); send.error(res, (error as Error).message || 'generate copy failed') } }
export async function generatePalette(req: any, res: any) { try { const result = await generatePaletteInternal(normalizeInput(req.body || {})); send.success(res, { palette: result.result, providerMeta: result.meta }) } catch (error) { console.error(error); send.error(res, (error as Error).message || 'generate palette failed') } }
export async function generateBackgroundImage(req: any, res: any) { try { const input = normalizeInput(req.body || {}); const size = sizeMap[input.sizeKey] || sizeMap.xiaohongshu; const result = await generateBackgroundInternal(input, (await generatePaletteInternal(input)).result, size); send.success(res, { background: result.result, providerMeta: result.meta }) } catch (error) { console.error(error); send.error(res, (error as Error).message || 'generate background failed') } }
export async function replacePosterImage(req: any, res: any) { try { const input = normalizeInput(req.body || {}); const size = sizeMap[input.sizeKey] || sizeMap.xiaohongshu; const result = await replaceImageInternal(input, (await generatePaletteInternal(input)).result, size); send.success(res, { hero: result.result, providerMeta: result.meta }) } catch (error) { console.error(error); send.error(res, (error as Error).message || 'replace image failed') } }
export async function relayoutPoster(req: any, res: any) {
  try {
    const input = normalizeInput(req.body || {})
    const candidates = getTemplateCandidatesByIndustry(input.industry, 3)
    const { plan, meta } = await relayoutDesignPlanInternal(input, candidates)
    send.success(res, { designPlan: plan, providerMeta: meta } as RelayoutResult)
  } catch (error) {
    console.error(error)
    send.error(res, (error as Error).message || 'relayout failed')
  }
}
export async function cutoutImage(req: any, res: any) { const form = new multiparty.Form(); form.parse(req, async (err: Error | null, _fields: any, files: any) => { if (err) return send.error(res, 'cutout upload failed'); const file = files?.file?.[0]; if (!file) return send.error(res, 'file not found'); const folder = 'cutout'; const folderPath = `${filePath}${folder}/`; const suffix = (file.originalFilename || 'cutout.png').split('.').pop() || 'png'; const fileName = `${randomCode(12)}.${suffix}`; const targetPath = `${folderPath}${fileName}`; checkCreateFolder(folderPath); try { await copyFile(file.path, targetPath); const rawUrl = `${getClientStaticBaseUrl()}${folder}/${fileName}`; let cutout: ProviderResult<{ rawUrl: string; resultUrl: string }> | null = null; const failures: string[] = []; for (const provider of getCutoutProviderChain()) { try { if (provider === 'rembg') cutout = await rembgCutoutProvider(rawUrl, targetPath, fileName); else if (provider === 'aliyun-human-cutout') cutout = await bailianCutoutProvider(rawUrl, targetPath, fileName); else if (provider === 'mock') cutout = await mockCutoutProvider(rawUrl); if (cutout) break } catch (error) { failures.push(`${provider}: ${sanitizeCutoutFailure(error)}`) } } if (!cutout) cutout = await mockCutoutProvider(rawUrl); if (cutout.meta.isMockFallback && failures.length) cutout.meta.message = `真实抠图暂时不可用，已切换为演示模式：${failures.join('；')}`; send.success(res, { rawUrl: cutout.result.rawUrl, resultUrl: cutout.result.resultUrl, providerMeta: cutout.meta }) } catch (error) { console.error(error); send.error(res, 'cutout failed') } }) }
export default { generatePosterDraft, generateCopy, generatePalette, generateBackgroundImage, replacePosterImage, relayoutPoster, cutoutImage }
