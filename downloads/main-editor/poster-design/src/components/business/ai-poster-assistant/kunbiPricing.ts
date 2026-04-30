export type AiPosterKunbiActionKey =
  | 'generateQuality'
  | 'optimizeCopyPalette'
  | 'generateFast'
  | 'replaceText'
  | 'replaceBackground'
  | 'replaceHero'
  | 'relayout'
  | 'scoreHeroSafety'

export type AiPosterKunbiPriceItem = {
  toolsId: number
  cost: number
  label: string
}

export const AI_POSTER_KUNBI_PRICING: Record<AiPosterKunbiActionKey, AiPosterKunbiPriceItem> = {
  generateQuality: { toolsId: 2121, cost: 400, label: 'AI海报高质量生成' },
  optimizeCopyPalette: { toolsId: 2122, cost: 10, label: 'AI海报-文案与配色优化' },
  generateFast: { toolsId: 2123, cost: 150, label: 'AI海报快速生成' },
  replaceText: { toolsId: 2124, cost: 10, label: 'AI海报-文案生成' },
  replaceBackground: { toolsId: 2125, cost: 80, label: 'AI海报-海报背景生成' },
  replaceHero: { toolsId: 2126, cost: 80, label: 'AI海报-换图' },
  relayout: { toolsId: 2127, cost: 10, label: 'AI海报-海报排版' },
  scoreHeroSafety: { toolsId: 2128, cost: 10, label: 'AI海报-主图候选评分/安全区' },
}

export function getAiPosterKunbiPrice(actionKey: AiPosterKunbiActionKey) {
  return AI_POSTER_KUNBI_PRICING[actionKey]
}

export function formatAiPosterKunbiCost(actionKey: AiPosterKunbiActionKey) {
  return `${getAiPosterKunbiPrice(actionKey).cost}鲲币`
}
