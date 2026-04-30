import axios from 'axios'
import { send } from '../utils/tools'
import { getKunbiApiBaseUrl, getRemoteAccessToken } from './kunbi'

export type AiPosterKunbiAction =
  | 'generateQuality'
  | 'optimizeCopyPalette'
  | 'generateFast'
  | 'replaceText'
  | 'replaceBackground'
  | 'replaceHero'
  | 'relayout'
  | 'scoreHeroSafety'

type AiPosterKunbiPriceItem = {
  toolsId: number
  cost: number
  label: string
}

const AI_POSTER_KUNBI_PRICING: Record<AiPosterKunbiAction, AiPosterKunbiPriceItem> = {
  generateQuality: {
    toolsId: 2121,
    cost: 400,
    label: 'AI海报高质量生成',
  },
  optimizeCopyPalette: {
    toolsId: 2122,
    cost: 10,
    label: 'AI海报-文案与配色优化',
  },
  generateFast: {
    toolsId: 2123,
    cost: 150,
    label: 'AI海报快速生成',
  },
  replaceText: {
    toolsId: 2124,
    cost: 10,
    label: 'AI海报-文案生成',
  },
  replaceBackground: {
    toolsId: 2125,
    cost: 80,
    label: 'AI海报-海报背景生成',
  },
  replaceHero: {
    toolsId: 2126,
    cost: 80,
    label: 'AI海报-换图',
  },
  relayout: {
    toolsId: 2127,
    cost: 10,
    label: 'AI海报-海报排版',
  },
  scoreHeroSafety: {
    toolsId: 2128,
    cost: 10,
    label: 'AI海报-主图候选评分/安全区',
  },
}

type ConsumeKunbiParams = {
  req: any
  action?: AiPosterKunbiAction | null
  toolsId?: number | null
}

function maskToken(token: string, left = 8) {
  const raw = String(token || '').trim()
  if (!raw) return ''
  if (raw.length <= left) return raw
  return `${raw.slice(0, left)}...(${raw.length})`
}

function getAiAppsBillingBaseUrl() {
  const raw = String(process.env.KUNBI_API_BASE_URL || process.env.OPEN_PARTNER_BILLING_BASE_URL || getKunbiApiBaseUrl() || '').trim()
  return raw.replace(/\/$/, '')
}

function getAiAppsDeductPath() {
  const raw = String(process.env.KUNBI_CONSUME_API_PATH || '/aiapps/deduct_kunbi').trim()
  if (!raw) return ''
  return raw.startsWith('/') ? raw : `/${raw}`
}

function resolvePricingByToolsId(toolsId: number) {
  const entries = Object.entries(AI_POSTER_KUNBI_PRICING) as Array<[AiPosterKunbiAction, AiPosterKunbiPriceItem]>
  return entries.find(([, item]) => item.toolsId === toolsId) || null
}

function resolvePricing(action?: AiPosterKunbiAction | null, toolsId?: number | null) {
  if (action && AI_POSTER_KUNBI_PRICING[action]) {
    return {
      actionKey: action,
      pricing: AI_POSTER_KUNBI_PRICING[action],
    }
  }
  const normalizedToolsId = Number(toolsId || 0)
  if (normalizedToolsId > 0) {
    const matched = resolvePricingByToolsId(normalizedToolsId)
    if (matched) {
      return {
        actionKey: matched[0],
        pricing: matched[1],
      }
    }
  }
  return null
}

function getRemoteSuccessData(payload: any) {
  if (payload == null || typeof payload !== 'object') return payload
  const code = (payload as any).code
  const successCodes = [1, 200, '1', '200']
  if (!successCodes.includes(code)) return null
  if ('data' in payload) return (payload as any).data
  if ('result' in payload) return (payload as any).result
  return payload
}

export function getAiPosterKunbiPricing() {
  return AI_POSTER_KUNBI_PRICING
}

export async function consumeKunbiForAiAction({ req, action, toolsId }: ConsumeKunbiParams) {
  const resolved = resolvePricing(action, toolsId)
  if (!resolved) {
    throw new Error('未找到对应的鲲币扣费配置')
  }

  const remotePath = getAiAppsDeductPath()
  const baseUrl = getAiAppsBillingBaseUrl()
  if (!remotePath || !baseUrl) {
    console.warn(
      '[kunbi-consume] skipped',
      JSON.stringify({
        reason: 'unconfigured',
        actionKey: resolved.actionKey,
        toolsId: resolved.pricing.toolsId,
        remotePath,
        baseUrl,
      }),
    )
    return {
      skipped: true,
      reason: 'unconfigured',
      actionKey: resolved.actionKey,
      toolsId: resolved.pricing.toolsId,
      cost: resolved.pricing.cost,
      label: resolved.pricing.label,
    }
  }

  const { apiWebToken } = await getRemoteAccessToken(req)
  const payload = {
    tools_id: resolved.pricing.toolsId,
    num: 1,
    tokens_num: 0,
  }

  console.log(
    '[kunbi-consume] request',
    JSON.stringify({
      url: `${baseUrl}${remotePath}`,
      actionKey: resolved.actionKey,
      toolsId: resolved.pricing.toolsId,
      apiWebToken: maskToken(apiWebToken),
    }),
  )

  const response = await axios.post(`${baseUrl}${remotePath}`, payload, {
    headers: {
      token: apiWebToken,
      Authorization: `Bearer ${apiWebToken}`,
      'Content-Type': 'application/json',
    },
    timeout: 30000,
  })

  console.log(
    '[kunbi-consume] response',
    JSON.stringify({
      status: response.status,
      code: response.data?.code,
      msg: response.data?.msg || response.data?.message || '',
      actionKey: resolved.actionKey,
      toolsId: resolved.pricing.toolsId,
      data: response.data?.data ?? response.data?.result ?? null,
    }),
  )

  const successData = getRemoteSuccessData(response.data)
  if (successData === null) {
    const message = String(response.data?.msg || response.data?.message || '主站扣费失败')
    throw new Error(`主站扣费失败：${message}（action=${resolved.actionKey}, tools_id=${resolved.pricing.toolsId}）`)
  }

  return {
    skipped: false,
    reason: 'consumed',
    actionKey: resolved.actionKey,
    toolsId: resolved.pricing.toolsId,
    cost: resolved.pricing.cost,
    label: resolved.pricing.label,
    remoteResult: successData,
  }
}

export async function consumeAiToolKunbi(req: any, res: any) {
  try {
    const result = await consumeKunbiForAiAction({
      req,
      action: req.body?.actionKey,
      toolsId: req.body?.toolsId,
    })
    send.success(res, result)
  } catch (error) {
    console.error(error)
    send.error(res, (error as Error).message || 'consume kunbi failed')
  }
}

export default {
  getAiPosterKunbiPricing,
  consumeKunbiForAiAction,
  consumeAiToolKunbi,
}
