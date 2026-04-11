import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { Response } from 'express'
import multiparty from 'multiparty'
import axiosClient from 'axios'
import axios from '../utils/http'
import { filePath } from '../configs'
import { checkCreateFolder, copyFile, randomCode, send } from '../utils/tools'
import { getTemplateCandidatesByIndustry, getTemplateSuggestionByIndustry } from './templateCatalog'

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

const FILE_URL = 'http://127.0.0.1:7001/static/'
const BAILIAN_CHAT_TIMEOUT = 20000
const BAILIAN_IMAGE_TIMEOUT = 18000
const BAILIAN_TASK_POLL_INTERVAL = 2000
const BAILIAN_TASK_MAX_POLLS = 6
const BAILIAN_RETRY_TIMES = 2
const DEFAULT_BAILIAN_IMAGE_COOLDOWN_MS = 12000
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
function getProviderModel(stage: 'copy' | 'image' | 'background' | 'imageEdit' | 'cutout') { const defs = { copy: 'qwen-plus-latest', image: 'qwen-image-2.0-pro', background: 'wanx-background-generation-v2', imageEdit: 'qwen-image-edit-plus', cutout: 'image-instance-segmentation' }; const envs = { copy: 'AI_COPY_MODEL', image: 'AI_IMAGE_MODEL', background: 'AI_BACKGROUND_MODEL', imageEdit: 'AI_IMAGE_EDIT_MODEL', cutout: 'AI_CUTOUT_MODEL' } as const; return getEnv(envs[stage], defs[stage]) }
function getProviderMeta(stage: 'copy' | 'image' | 'background' | 'imageEdit' | 'cutout', overrides: Partial<AiProviderMeta>): AiProviderMeta { return { provider: overrides.provider || 'aliyun-bailian', model: overrides.model || getProviderModel(stage), isMockFallback: Boolean(overrides.isMockFallback), message: overrides.message || '' } }
function buildStrictProviderError(stage: string, error: unknown) { return `真实 AI ${stage}失败，且当前已关闭兜底回退：${(error as Error)?.message || String(error || 'unknown error')}` }
function ensureBailianReady(stage: 'copy' | 'image' | 'background' | 'imageEdit') { const apiKey = getBailianApiKey(); const model = getProviderModel(stage); if (!apiKey || !model) throw new Error(`${stage} provider config missing`); return { apiKey, model } }
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) }
function normalizeInput(body: any): PosterGenerateInput { return { theme: String(body.theme || '').trim(), purpose: String(body.purpose || '').trim(), sizeKey: String(body.sizeKey || 'xiaohongshu').trim(), style: String(body.style || '').trim(), industry: String(body.industry || DEFAULT_INDUSTRY).trim(), content: String(body.content || '').trim(), qrUrl: String(body.qrUrl || '').trim(), sourceImageUrl: String(body.sourceImageUrl || '').trim(), baseImageUrl: String(body.baseImageUrl || '').trim() } }
function buildTitle(theme: string, purpose: string, industry: string) { const safeTheme = (theme || industry || 'AI 海报').trim(); if (safeTheme.includes('招聘')) return `${safeTheme} 火热招募`; if (safeTheme.includes('上新')) return `${safeTheme} 限时发布`; if (safeTheme.includes('课程')) return `${safeTheme} 开始报名`; return `${safeTheme} ${(purpose || '推广').trim()}` }
function buildSlogan(theme: string, industry: string, style: string) { return `${theme || industry || '品牌主张'} · ${style || '高级简约'} · ${industry || DEFAULT_INDUSTRY}` }
function buildBody(input: PosterGenerateInput) { return input.content || `${input.theme || input.industry}，适合${input.purpose || '推广'}场景，可继续替换文字、背景和主图。` }
function buildCta(purpose: string) { if (purpose.includes('报名')) return '立即报名'; if (purpose.includes('招聘') || purpose.includes('招募')) return '马上投递'; if (purpose.includes('促销')) return '立即抢购'; if (purpose.includes('引流')) return '扫码咨询'; return '立即了解' }
function buildCopyPrompt(input: PosterGenerateInput) { return [`主题：${input.theme || '未填写'}`, `用途：${input.purpose || '未填写'}`, `行业：${input.industry || DEFAULT_INDUSTRY}`, `风格：${input.style || '高级简约'}`, `尺寸：${input.sizeKey || 'xiaohongshu'}`, `补充信息：${input.content || '无'}`].join('\n') }
function buildPalettePrompt(input: PosterGenerateInput) { return [`主题：${input.theme || '未填写'}`, `用途：${input.purpose || '未填写'}`, `行业：${input.industry || DEFAULT_INDUSTRY}`, `风格：${input.style || '高级简约'}`].join('\n') }
function buildImagePrompt(input: PosterGenerateInput, mode: 'background' | 'hero') { const shared = [`主题：${input.theme || input.industry || 'AI 海报'}`, `用途：${input.purpose || '推广'}`, `行业：${input.industry || DEFAULT_INDUSTRY}`, `风格：${input.style || '高级简约'}`, `补充文案：${input.content || '无'}`].join('；'); return mode === 'background' ? `请生成商业海报背景图。${shared}` : `请生成海报主视觉图片。${shared}` }
function cleanJsonText(content: string) { return content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim() }
function normalizeImageResult(imageUrl: string, prompt: string): PosterImageResult { return { imageUrl, prompt } }
function shouldRetryBailianError(error: any) { const status = Number(error?.response?.status || 0); const message = String(error?.message || ''); return status === 429 || status >= 500 || error?.code === 'ECONNRESET' || error?.code === 'ETIMEDOUT' || /timeout/i.test(message) || /socket hang up/i.test(message) }
async function withBailianRetry<T>(task: () => Promise<T>) { let lastError: unknown; for (let i = 0; i <= BAILIAN_RETRY_TIMES; i += 1) { try { return await task() } catch (error) { lastError = error; if (i >= BAILIAN_RETRY_TIMES || !shouldRetryBailianError(error)) throw error; await new Promise((r) => setTimeout(r, (i + 1) * 2000)) } } throw lastError }
function getBailianImageCooldownMs() { const value = Number(getEnv('AI_BAILIAN_IMAGE_COOLDOWN_MS', String(DEFAULT_BAILIAN_IMAGE_COOLDOWN_MS))); return Number.isFinite(value) && value >= 0 ? value : DEFAULT_BAILIAN_IMAGE_COOLDOWN_MS }
async function queueBailianImageRequest<T>(task: () => Promise<T>) { const run = async () => { const wait = getBailianImageCooldownMs() - (Date.now() - lastBailianImageRequestAt); if (lastBailianImageRequestAt > 0 && wait > 0) await new Promise((r) => setTimeout(r, wait)); lastBailianImageRequestAt = Date.now(); return task() }; const result = bailianImageQueue.then(run, run); bailianImageQueue = result.catch(() => undefined); return result }
function ensureAbsoluteUrl(url: string) { if (/^https?:\/\//i.test(url)) return url; if (url.startsWith('/')) return `${getBailianOrigin()}${url}`; return url }
function getImageExtension(contentType: string, fallback = 'png') { if (contentType.includes('jpeg')) return 'jpg'; if (contentType.includes('webp')) return 'webp'; if (contentType.includes('gif')) return 'gif'; return fallback }
async function saveRemoteImageToLocal(url: string, folder: string) { const finalUrl = ensureAbsoluteUrl(url); const targetFolder = path.join(filePath, folder); checkCreateFolder(targetFolder); const response = await axiosClient.get(finalUrl, { responseType: 'arraybuffer', timeout: 120000 }); const extension = getImageExtension(String(response.headers['content-type'] || '')); const fileName = `${randomCode(14)}.${extension}`; fs.writeFileSync(path.join(targetFolder, fileName), Buffer.from(response.data)); return `${FILE_URL}${folder}/${fileName}` }
async function saveRemoteImageToLocalAsset(url: string, folder: string) { const assetUrl = await saveRemoteImageToLocal(url, folder); const fileName = path.basename(assetUrl); return { fileName, assetPath: path.join(filePath, folder, fileName), assetUrl } }
function extractTaskImageUrl(response: any) { const output = response?.output || {}; const results = output.results || output.result || []; const candidates: string[] = []; const push = (value: any) => value && candidates.push(String(value)); if (Array.isArray(results)) results.forEach((item) => { push(item?.url); push(item?.image_url); push(item?.image?.url) }); else { push(results?.url); push(results?.image_url); push(results?.image?.url) } (output.choices || []).forEach((choice: any) => (choice?.message?.content || []).forEach((item: any) => { push(item?.image); push(item?.url) })); push(output?.image_url); push(output?.url); push(output?.result_url); const usable = candidates.find(Boolean); if (!usable) throw new Error('missing generated image url'); return usable }
async function pollBailianTask(taskId: string) { for (let i = 0; i < BAILIAN_TASK_MAX_POLLS; i += 1) { const data: any = await axiosClient.get(`${getApiBaseUrl()}/tasks/${taskId}`, { headers: { Authorization: `Bearer ${getBailianApiKey()}` }, timeout: BAILIAN_IMAGE_TIMEOUT }); const status = String(data?.output?.task_status || '').toUpperCase(); if (status === 'SUCCEEDED') return data; if (status === 'FAILED' || status === 'CANCELED') throw new Error(String(data?.output?.message || data?.message || data?.code || 'task failed')); await new Promise((r) => setTimeout(r, BAILIAN_TASK_POLL_INTERVAL)) } throw new Error('task timeout') }
async function requestBailianChat(messages: Array<{ role: string; content: string }>, model: string) { const data: any = await withBailianRetry(() => axios.post(`${getCompatibleBaseUrl()}/chat/completions`, { model, messages, temperature: 0.8, response_format: { type: 'json_object' } }, { headers: { Authorization: `Bearer ${getBailianApiKey()}`, 'Content-Type': 'application/json' }, timeout: BAILIAN_CHAT_TIMEOUT })); const content = data?.choices?.[0]?.message?.content || ''; if (!content) throw new Error('empty model response'); return JSON.parse(cleanJsonText(content)) }
async function requestBailianTextToImage(prompt: string, model: string, size: SizePreset) { return queueBailianImageRequest(() => withBailianRetry(() => axios.post(`${getApiBaseUrl()}/services/aigc/multimodal-generation/generation`, { model, input: { messages: [{ role: 'user', content: [{ text: prompt }] }] }, parameters: { size: `${Math.min(size.width, 2048)}*${Math.min(size.height, 2048)}`, n: 1, prompt_extend: true, watermark: false } }, { headers: { Authorization: `Bearer ${getBailianApiKey()}`, 'Content-Type': 'application/json' }, timeout: BAILIAN_IMAGE_TIMEOUT }))) }
async function requestBailianImageEdit(prompt: string, model: string, imageUrl: string, size: SizePreset) { return queueBailianImageRequest(() => withBailianRetry(() => axios.post(`${getApiBaseUrl()}/services/aigc/multimodal-generation/generation`, { model, input: { messages: [{ role: 'user', content: [{ image: imageUrl }, { text: prompt }] }] }, parameters: { size: `${Math.min(size.width, 2048)}*${Math.min(size.height, 2048)}`, n: 1, prompt_extend: true, watermark: false } }, { headers: { Authorization: `Bearer ${getBailianApiKey()}`, 'Content-Type': 'application/json' }, timeout: BAILIAN_IMAGE_TIMEOUT }))) }
async function requestBailianBackground(prompt: string, model: string, baseImageUrl: string) { const data: any = await queueBailianImageRequest(() => withBailianRetry(() => axios.post(`${getApiBaseUrl()}/services/aigc/background-generation/generation/`, { model, input: { base_image_url: baseImageUrl, ref_prompt: prompt } }, { headers: { Authorization: `Bearer ${getBailianApiKey()}`, 'Content-Type': 'application/json', 'X-DashScope-Async': 'enable' }, timeout: BAILIAN_IMAGE_TIMEOUT }))); const taskId = String(data?.output?.task_id || '').trim(); if (!taskId) throw new Error('missing background task id'); return pollBailianTask(taskId) }
async function generateCopyInternal(input: PosterGenerateInput): Promise<ProviderResult<CopyResult>> { try { const parsed = await requestBailianChat([{ role: 'system', content: '你是中文海报文案助手。只输出 JSON。' }, { role: 'user', content: buildCopyPrompt(input) }], ensureBailianReady('copy').model); return { result: { title: String(parsed.title || buildTitle(input.theme, input.purpose, input.industry)).trim(), slogan: String(parsed.slogan || buildSlogan(input.theme, input.industry, input.style)).trim(), body: String(parsed.body || buildBody(input)).trim(), cta: String(parsed.cta || buildCta(input.purpose)).trim() }, meta: getProviderMeta('copy', { provider: 'aliyun-bailian', model: ensureBailianReady('copy').model, message: '已使用阿里百炼真实文案模型生成推荐文案。' }) } } catch (error) { if (!allowPosterFallback()) throw new Error(buildStrictProviderError('文案生成', error)); return { result: { title: buildTitle(input.theme, input.purpose, input.industry), slogan: buildSlogan(input.theme, input.industry, input.style), body: buildBody(input), cta: buildCta(input.purpose) }, meta: getProviderMeta('copy', { provider: 'mock', model: 'mock-copy', isMockFallback: true, message: `阿里百炼文案生成失败，已回退到本地规则：${(error as Error).message}` }) } } }
async function generatePaletteInternal(input: PosterGenerateInput): Promise<ProviderResult<PosterPalette>> { const preset = clone(paletteByIndustry[input.industry] || paletteByIndustry[DEFAULT_INDUSTRY]); try { const parsed = await requestBailianChat([{ role: 'system', content: '你是中文海报配色助手。只输出 JSON。' }, { role: 'user', content: buildPalettePrompt(input) }], ensureBailianReady('copy').model); const swatches = Array.isArray(parsed.swatches) ? parsed.swatches.map(String).filter(Boolean) : preset.swatches; return { result: { background: String(parsed.background || preset.background), surface: String(parsed.surface || preset.surface), primary: String(parsed.primary || preset.primary), secondary: String(parsed.secondary || preset.secondary), text: String(parsed.text || preset.text), muted: String(parsed.muted || preset.muted), swatches: swatches.length ? swatches : preset.swatches }, meta: getProviderMeta('copy', { provider: 'aliyun-bailian', model: ensureBailianReady('copy').model, message: '已使用阿里百炼真实模型生成推荐配色。' }) } } catch (error) { if (!allowPosterFallback()) throw new Error(buildStrictProviderError('配色生成', error)); return { result: preset, meta: getProviderMeta('copy', { provider: 'mock', model: 'mock-palette', isMockFallback: true, message: `阿里百炼配色推荐失败，已回退到行业预设：${(error as Error).message}` }) } } }
function makeBackgroundSvg(input: PosterGenerateInput, palette: PosterPalette) { const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1600"><rect width="1200" height="1600" fill="${palette.background}"/><circle cx="980" cy="220" r="180" fill="${palette.primary}" opacity="0.12"/><rect x="140" y="360" width="920" height="640" rx="56" fill="#ffffff" opacity="0.58"/><text x="140" y="236" font-size="92" font-weight="700" fill="${palette.text}" font-family="Arial">${input.theme || input.industry || 'AI 海报'}</text></svg>`; return `data:image/svg+xml,${encodeURIComponent(svg)}` }
function makeHeroSvg(input: PosterGenerateInput, palette: PosterPalette) { const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 760"><rect width="1000" height="760" rx="48" fill="#ffffff"/><rect x="40" y="40" width="920" height="680" rx="36" fill="${palette.secondary}" opacity="0.48"/><text x="500" y="338" text-anchor="middle" font-size="94" font-weight="700" fill="${palette.primary}" font-family="Arial">${input.theme || input.industry || 'AI 海报'}</text><text x="500" y="416" text-anchor="middle" font-size="34" fill="${palette.text}" font-family="Arial">${input.purpose || '推广'}</text></svg>`; return `data:image/svg+xml,${encodeURIComponent(svg)}` }
async function mockImageProvider(input: PosterGenerateInput, palette: PosterPalette, mode: 'background' | 'hero', stage: 'image' | 'background' | 'imageEdit'): Promise<ProviderResult<PosterImageResult>> { const imageUrl = mode === 'background' ? makeBackgroundSvg(input, palette) : makeHeroSvg(input, palette); return { result: normalizeImageResult(imageUrl, buildImagePrompt(input, mode)), meta: getProviderMeta(stage, { provider: 'mock', model: stage === 'background' ? 'mock-background' : stage === 'imageEdit' ? 'mock-image-edit' : 'mock-image', isMockFallback: true, message: '当前未使用真实图像模型，已回退到本地演示图。' }) } }
async function bailianHeroProvider(input: PosterGenerateInput, size: SizePreset): Promise<ProviderResult<PosterImageResult>> { const ready = ensureBailianReady('image'); const prompt = buildImagePrompt(input, 'hero'); const taskResult = await requestBailianTextToImage(prompt, ready.model, size); return { result: normalizeImageResult(await saveRemoteImageToLocal(extractTaskImageUrl(taskResult), 'ai'), prompt), meta: getProviderMeta('image', { provider: 'aliyun-bailian', model: ready.model, message: '已使用阿里百炼真实主视觉模型生成图片。' }) } }
async function bailianBackgroundProvider(input: PosterGenerateInput, size: SizePreset): Promise<ProviderResult<PosterImageResult>> { const prompt = buildImagePrompt(input, 'background'); if (!String(input.baseImageUrl || '').trim()) { const rerouted = await bailianHeroProvider(input, size); return { result: rerouted.result, meta: getProviderMeta('background', { provider: rerouted.meta.provider, model: rerouted.meta.model, message: `未提供可换背景的前景图，已自动切换到真实文生图路径。实际模型：${rerouted.meta.model}` }) } } const taskResult = await requestBailianBackground(prompt, getProviderModel('background'), String(input.baseImageUrl)); return { result: normalizeImageResult(await saveRemoteImageToLocal(extractTaskImageUrl(taskResult), 'ai'), prompt), meta: getProviderMeta('background', { provider: 'aliyun-bailian', model: getProviderModel('background'), message: '已使用阿里百炼真实背景模型完成换背景。' }) } }
async function bailianImageEditProvider(input: PosterGenerateInput, size: SizePreset): Promise<ProviderResult<PosterImageResult>> { const prompt = buildImagePrompt(input, 'hero'); if (!String(input.sourceImageUrl || '').trim()) { const rerouted = await bailianHeroProvider(input, size); return { result: rerouted.result, meta: getProviderMeta('imageEdit', { provider: rerouted.meta.provider, model: rerouted.meta.model, message: `未提供待编辑图片，已自动切换到真实文生图换图。实际模型：${rerouted.meta.model}` }) } } const ready = ensureBailianReady('imageEdit'); const taskResult = await requestBailianImageEdit(prompt, ready.model, String(input.sourceImageUrl), size); return { result: normalizeImageResult(await saveRemoteImageToLocal(extractTaskImageUrl(taskResult), 'ai'), prompt), meta: getProviderMeta('imageEdit', { provider: 'aliyun-bailian', model: ready.model, message: '已使用阿里百炼真实换图模型生成新主图。' }) } }
async function generateHeroImageInternal(input: PosterGenerateInput, palette: PosterPalette, size: SizePreset) { try { return await bailianHeroProvider(input, size) } catch (error) { if (!allowPosterFallback()) throw new Error(buildStrictProviderError('主图生成', error)); return mockImageProvider(input, palette, 'hero', 'image') } }
async function generateBackgroundInternal(input: PosterGenerateInput, palette: PosterPalette, size: SizePreset) { try { return await bailianBackgroundProvider(input, size) } catch (error) { const status = Number((error as any)?.response?.status || 0); if (status === 400) { const rerouted = await bailianHeroProvider(input, size); return { result: rerouted.result, meta: getProviderMeta('background', { provider: rerouted.meta.provider, model: rerouted.meta.model, message: `背景模型无法直接处理当前素材，已自动切换到真实文生图路径：${(error as Error).message}` }) } } if (!allowPosterFallback()) throw new Error(buildStrictProviderError('背景生成', error)); return mockImageProvider(input, palette, 'background', 'background') } }
async function replaceImageInternal(input: PosterGenerateInput, palette: PosterPalette, size: SizePreset) { try { return await bailianImageEditProvider(input, size) } catch (error) { const status = Number((error as any)?.response?.status || 0); if (status === 400) { const rerouted = await bailianHeroProvider(input, size); return { result: rerouted.result, meta: getProviderMeta('imageEdit', { provider: rerouted.meta.provider, model: rerouted.meta.model, message: `换图模型无法直接处理当前素材，已自动切换到真实文生图路径：${(error as Error).message}` }) } } if (!allowPosterFallback()) throw new Error(buildStrictProviderError('换图', error)); return mockImageProvider(input, palette, 'hero', 'imageEdit') } }
function getPythonExecutable() { return getEnv('AI_CUTOUT_PYTHON', 'python') }
function getRembgModelName() { return getEnv('AI_CUTOUT_REMBG_MODEL', 'u2net') }
function runCutoutWorker(args: string[]) { return new Promise<any>((resolve, reject) => { const scriptPath = path.join(process.cwd(), 'scripts', 'cutout_worker.py'); const child = spawn(getPythonExecutable(), [scriptPath, ...args], { cwd: process.cwd(), windowsHide: true }); let stdout = ''; let stderr = ''; child.stdout.on('data', (chunk) => { stdout += String(chunk) }); child.stderr.on('data', (chunk) => { stderr += String(chunk) }); child.on('error', reject); child.on('close', (code) => { if (code !== 0) return reject(new Error(stderr || stdout || `cutout worker exited with code ${code}`)); try { resolve(stdout ? JSON.parse(stdout) : {}) } catch { reject(new Error(`invalid cutout worker response: ${stdout || stderr}`)) } }) }) }
async function inspectLocalImage(imagePath: string) { return runCutoutWorker(['inspect', imagePath]) }
async function mergeMaskToTransparent(rawPath: string, maskPath: string, outputPath: string) { return runCutoutWorker(['merge-mask', rawPath, maskPath, outputPath]) }
async function runRembgCutout(inputPath: string, outputPath: string) { return runCutoutWorker(['rembg', inputPath, outputPath, getRembgModelName()]) }
async function uploadLocalFileToPublicUrl(filePathname: string, fileName: string) { const FormDataCtor = (global as any).FormData; const BlobCtor = (global as any).Blob; const form: any = new FormDataCtor(); form.append('file', new BlobCtor([fs.readFileSync(filePathname)]), fileName); const response = await axiosClient.post('https://tmpfiles.org/api/v1/upload', form, { timeout: 120000, maxBodyLength: Infinity, maxContentLength: Infinity }); const tempUrl = response?.data?.data?.url || ''; if (!tempUrl) throw new Error('temporary public upload failed'); return String(tempUrl).replace('http://', 'https://').replace('tmpfiles.org/', 'tmpfiles.org/dl/') }
async function requestBailianCutout(model: string, imageUrl: string) { const response: any = await axiosClient({ method: 'post', url: `${getApiBaseUrl()}/services/aigc/image2image/image-synthesis`, data: { model, input: { image_url: imageUrl }, parameters: { return_form: 'transparent' } }, headers: { Authorization: `Bearer ${getBailianApiKey()}`, 'Content-Type': 'application/json', 'X-DashScope-Async': 'enable', 'X-DashScope-OssResourceResolve': 'enable' }, timeout: 120000 }); const taskId = String(response.data?.output?.task_id || '').trim(); if (!taskId) throw new Error('missing cutout task id'); return pollBailianTask(taskId) }
function extractCutoutUrl(response: any) { const output = response?.output || {}; const results = Array.isArray(output.results) ? output.results[0] : output.results || output.result || {}; return results?.transparent_image_url || results?.output_image_url || results?.output_image_url_list?.[0] || results?.image_url || results?.url || output?.transparent_image_url || output?.output_image_url || output?.image_url || output?.url || '' }
async function bailianCutoutProvider(rawUrl: string, localPath: string, fileName: string) { const taskResult = await requestBailianCutout(getProviderModel('cutout'), await uploadLocalFileToPublicUrl(localPath, fileName)); const remoteUrl = extractCutoutUrl(taskResult); if (!remoteUrl) throw new Error('cutout result missing image url'); const remoteAsset = await saveRemoteImageToLocalAsset(remoteUrl, 'cutout'); const imageInfo = await inspectLocalImage(remoteAsset.assetPath); let resultUrl = remoteAsset.assetUrl; if (String(imageInfo.mode || '').toUpperCase() === 'L') { const mergedFileName = `${path.basename(fileName, path.extname(fileName))}_aliyun_cutout.png`; const mergedPath = path.join(filePath, 'cutout', mergedFileName); await mergeMaskToTransparent(localPath, remoteAsset.assetPath, mergedPath); resultUrl = `${FILE_URL}cutout/${mergedFileName}` } return { result: { rawUrl, resultUrl }, meta: getProviderMeta('cutout', { provider: 'aliyun-human-cutout', model: getProviderModel('cutout'), message: 'Aliyun human cutout completed and returned a transparent PNG.' }) } as ProviderResult<{ rawUrl: string; resultUrl: string }> }
async function rembgCutoutProvider(rawUrl: string, localPath: string, fileName: string) { const outputFileName = `${path.basename(fileName, path.extname(fileName))}_rembg.png`; const outputPath = path.join(filePath, 'cutout', outputFileName); await runRembgCutout(localPath, outputPath); return { result: { rawUrl, resultUrl: `${FILE_URL}cutout/${outputFileName}` }, meta: getProviderMeta('cutout', { provider: 'rembg', model: getRembgModelName(), message: 'Universal cutout completed with local rembg model.' }) } as ProviderResult<{ rawUrl: string; resultUrl: string }> }
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
  const heroStrategy: 'product' | 'person' | 'scene' | 'editorial' = /招聘/.test(input.industry) ? 'person' : /活动|节日/.test(input.industry) ? 'scene' : /课程/.test(input.industry) ? 'editorial' : 'product'
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
    `行业：${input.industry || DEFAULT_INDUSTRY}`,
    `用途：${input.purpose || '推广'}`,
    `风格：${input.style || '高级简约'}`,
    `尺寸：${input.sizeKey || 'xiaohongshu'}`,
    `补充信息：${input.content || '无'}`,
    `是否有二维码：${String(Boolean(input.qrUrl))}`,
    `候选骨架（优先从中选择）：${(candidates || []).map((c: any) => c?.layoutFamily).filter(Boolean).join(', ') || '无'}`,
    `可用骨架列表：${allow.join(', ')}`,
    '输出字段：layoutFamily(必填)、density(light|balanced|dense)、heroStrategy(product|person|scene|editorial)、ctaStrength(soft|balanced|strong)、qrStrategy(none|corner|cta)。',
  ].join('\n')

  try {
    const parsed: any = await requestBailianChat([{ role: 'system', content: '只输出 JSON。' }, { role: 'user', content: prompt }], ensureBailianReady('copy').model)
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
async function generatePosterDraftInternal(input: PosterGenerateInput): Promise<PosterGenerateResult> { const size = sizeMap[input.sizeKey] || sizeMap.xiaohongshu; const [paletteResult, copyResult] = await Promise.all([generatePaletteInternal(input), generateCopyInternal(input)]); const [backgroundResult, heroResult] = await Promise.all([generateBackgroundInternal(input, paletteResult.result, size), generateHeroImageInternal(input, paletteResult.result, size)]); const recommendation = getTemplateSuggestionByIndustry(input.industry); const templateCandidates = getTemplateCandidatesByIndustry(input.industry, 3); const designPlan = deriveDesignPlan(input, templateCandidates); return { title: copyResult.result.title, slogan: copyResult.result.slogan, body: copyResult.result.body, cta: copyResult.result.cta, palette: paletteResult.result, background: backgroundResult.result, hero: heroResult.result, recommendedTemplate: recommendation.listItem, recommendedTemplates: templateCandidates, templateCandidates, designPlan, size, providerMeta: { copy: copyResult.meta, palette: paletteResult.meta, background: backgroundResult.meta, image: heroResult.meta } } }
export async function generatePosterDraft(req: any, res: Response) { try { send.success(res, await generatePosterDraftInternal(normalizeInput(req.body || {}))) } catch (error) { console.error(error); send.error(res, (error as Error).message || 'generate poster failed') } }
export async function generateCopy(req: any, res: Response) { try { const result = await generateCopyInternal(normalizeInput(req.body || {})); send.success(res, { title: result.result.title, slogan: result.result.slogan, body: result.result.body, cta: result.result.cta, providerMeta: result.meta }) } catch (error) { console.error(error); send.error(res, (error as Error).message || 'generate copy failed') } }
export async function generatePalette(req: any, res: Response) { try { const result = await generatePaletteInternal(normalizeInput(req.body || {})); send.success(res, { palette: result.result, providerMeta: result.meta }) } catch (error) { console.error(error); send.error(res, (error as Error).message || 'generate palette failed') } }
export async function generateBackgroundImage(req: any, res: Response) { try { const input = normalizeInput(req.body || {}); const size = sizeMap[input.sizeKey] || sizeMap.xiaohongshu; const result = await generateBackgroundInternal(input, (await generatePaletteInternal(input)).result, size); send.success(res, { background: result.result, providerMeta: result.meta }) } catch (error) { console.error(error); send.error(res, (error as Error).message || 'generate background failed') } }
export async function replacePosterImage(req: any, res: Response) { try { const input = normalizeInput(req.body || {}); const size = sizeMap[input.sizeKey] || sizeMap.xiaohongshu; const result = await replaceImageInternal(input, (await generatePaletteInternal(input)).result, size); send.success(res, { hero: result.result, providerMeta: result.meta }) } catch (error) { console.error(error); send.error(res, (error as Error).message || 'replace image failed') } }
export async function relayoutPoster(req: any, res: Response) {
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
export async function cutoutImage(req: any, res: Response) { const form = new multiparty.Form(); form.parse(req, async (err: Error | null, _fields: any, files: any) => { if (err) return send.error(res, 'cutout upload failed'); const file = files?.file?.[0]; if (!file) return send.error(res, 'file not found'); const folder = 'cutout'; const folderPath = `${filePath}${folder}/`; const suffix = (file.originalFilename || 'cutout.png').split('.').pop() || 'png'; const fileName = `${randomCode(12)}.${suffix}`; const targetPath = `${folderPath}${fileName}`; checkCreateFolder(folderPath); try { await copyFile(file.path, targetPath); const rawUrl = `${FILE_URL}${folder}/${fileName}`; let cutout: ProviderResult<{ rawUrl: string; resultUrl: string }> | null = null; const failures: string[] = []; for (const provider of getCutoutProviderChain()) { try { if (provider === 'rembg') cutout = await rembgCutoutProvider(rawUrl, targetPath, fileName); else if (provider === 'aliyun-human-cutout') cutout = await bailianCutoutProvider(rawUrl, targetPath, fileName); else if (provider === 'mock') cutout = await mockCutoutProvider(rawUrl); if (cutout) break } catch (error) { failures.push(`${provider}: ${sanitizeCutoutFailure(error)}`) } } if (!cutout) cutout = await mockCutoutProvider(rawUrl); if (cutout.meta.isMockFallback && failures.length) cutout.meta.message = `真实抠图暂时不可用，已切换为演示模式：${failures.join('；')}`; send.success(res, { rawUrl: cutout.result.rawUrl, resultUrl: cutout.result.resultUrl, providerMeta: cutout.meta }) } catch (error) { console.error(error); send.error(res, 'cutout failed') } }) }
export default { generatePosterDraft, generateCopy, generatePalette, generateBackgroundImage, replacePosterImage, relayoutPoster, cutoutImage }
