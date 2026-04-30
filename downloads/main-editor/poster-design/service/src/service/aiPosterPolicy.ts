export type HeroScoreBreakdown = {
  whitespace: number
  subjectPosition: number
  clarity: number
  toneMatch: number
}

export type ScoredHeroCandidate = {
  imageUrl: string
  prompt: string
  score: number
  scoreBreakdown: HeroScoreBreakdown
  selected: boolean
  sourceType?: 'text-to-image' | 'reference-edit' | 'repair-edit'
  analysisSummary?: string
}

export type HeroSelectionDecision = {
  recommendedIndex: number
  selectedIndex: number
  selectionMode: 'auto' | 'manual'
  candidates: ScoredHeroCandidate[]
  summary: {
    topScore: number
    lowConfidence: boolean
    spread: number
  }
}

export type PosterCopyDeckLike = {
  heroHeadline: string
  supportLine: string
  offerLine: string
  urgencyLine: string
  actionReason: string
  cta: string
  ctaAlternatives: string[]
  badge: string
  proofPoints: string[]
  factCards: any[]
  priceBlock: any
  audienceLine: string
  trustLine: string
}

export type PosterTitleStrategy = 'benefit' | 'scene' | 'action'

export type PosterTitleCandidate = {
  strategy: PosterTitleStrategy
  text: string
  clarityScore: number
  antiClicheScore: number
  totalScore: number
  commercialIntentScore?: number
}

const WEAK_COPY_PATTERNS = [
  /品质升级/,
  /体验非凡/,
  /诚意呈现/,
  /精彩来袭/,
  /火热进行中/,
  /不容错过/,
  /焕新开启/,
  /精致之选/,
  /品质之选/,
  /诚邀品鉴/,
  /惊喜放送/,
  /限时开启/,
  /重磅来袭/,
  /臻选好物/,
  /诚意上新/,
  /匠心打造/,
  /高端甄选/,
  /尽享美好/,
  /焕新体验/,
  /品质生活/,
  /立即解锁/,
  /马上拥有/,
]

const INDUSTRY_WEAK_COPY_REPLACEMENTS: Record<string, Array<{ pattern: RegExp; replacement: string }>> = {
  餐饮: [
    { pattern: /体验非凡|品质升级|诚意呈现|精彩来袭|火热进行中|不容错过|焕新开启|精致之选/g, replacement: '到店现做' },
  ],
  招聘: [
    { pattern: /体验非凡|品质升级|诚意呈现|精彩来袭|火热进行中|不容错过|焕新开启|精致之选/g, replacement: '岗位直招' },
  ],
  课程: [
    { pattern: /体验非凡|品质升级|诚意呈现|精彩来袭|火热进行中|不容错过|焕新开启|精致之选/g, replacement: '现在开学' },
  ],
  电商: [
    { pattern: /体验非凡|品质升级|诚意呈现|精彩来袭|火热进行中|不容错过|焕新开启|精致之选/g, replacement: '到手有优惠' },
  ],
}

const INDUSTRY_CTA_POOL: Record<string, string[]> = {
  '餐饮': ['到店尝鲜', '立即下单', '限时抢购'],
  '招聘': ['立即投递', '投个简历', '马上咨询'],
  '课程': ['立即报名', '领取试听', '咨询课程'],
  '电商': ['马上下单', '领取优惠', '立即选购'],
}

const INDUSTRY_TITLE_SIGNAL_PATTERNS: Record<string, RegExp> = {
  餐饮: /低脂|高蛋白|现做|招牌|爆汁|新品|人气|第二份|第二件|半价|尝鲜|到店|套餐|咖啡|茶饮|甜品|轻食/,
  招聘: /双休|五险|社保|包吃住|提成|晋升|补贴|底薪|岗位|直招|应届|兼职|全职|带教|排班/,
  课程: /试听|小班|实战|陪跑|训练营|提分|开班|入门|进阶|就业|作品集|辅导|直播|打卡/,
  电商: /到手|现货|包邮|满减|直降|第二件|赠品|官方|爆款|新品|折扣|加赠|预售|立减/,
}

const INDUSTRY_TITLE_TEMPLATES: Record<string, {
  benefit: string[]
  scene: string[]
  action: string[]
}> = {
  餐饮: {
    benefit: ['{core}先尝鲜', '{core}现在开吃', '{core}更上头', '{core}到店更值'],
    scene: ['{theme}{core}', '{theme}这一口上新', '{theme}人气开吃', '{theme}到店尝鲜'],
    action: ['{core}马上开吃', '{core}到店尝鲜', '{core}现在下单', '{core}先来一份'],
  },
  招聘: {
    benefit: ['{core}更值得投', '{core}机会别错过', '{core}待遇更稳', '{core}上手更快'],
    scene: ['{theme}正在招人', '{theme}岗位补位', '{theme}高薪直招', '{theme}现在缺人'],
    action: ['{core}立即投递', '{core}现在来投', '{core}马上咨询', '{core}先投简历'],
  },
  课程: {
    benefit: ['{core}学完能上手', '{core}现在提效', '{core}更快入门', '{core}更值报名'],
    scene: ['{theme}这一期开班', '{theme}现在报名', '{theme}限额开班', '{theme}试听开放'],
    action: ['{core}立即报名', '{core}领取试听', '{core}现在开学', '{core}先锁名额'],
  },
  电商: {
    benefit: ['{core}现在更值', '{core}到手更省', '{core}趁现在入手', '{core}这波划算'],
    scene: ['{theme}现在有优惠', '{theme}爆款在售', '{theme}现货直发', '{theme}到手更省'],
    action: ['{core}马上下单', '{core}立即选购', '{core}领取优惠', '{core}先抢现货'],
  },
}

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

function normalizeText(value: string) {
  return String(value || '')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function trimPosterNoise(value: string) {
  return String(value || '')
    .replace(/[，,。；;：:、|｜/]+$/g, '')
    .replace(/^[，,。；;：:、|｜/]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function explodeCopySegments(value: string) {
  return String(value || '')
    .split(/[|｜/、，,；;\n]+/)
    .map((item) => trimPosterNoise(item))
    .filter(Boolean)
}

function softClip(value: string, max: number) {
  const normalized = normalizeText(value)
  if (!normalized) return ''
  if (normalized.length <= max) return normalized
  return trimPosterNoise(normalized.slice(0, max))
}

function isWeakCopy(value: string) {
  const text = normalizeText(value)
  if (!text) return true
  return WEAK_COPY_PATTERNS.some((pattern) => pattern.test(text))
}

function inferIndustryBucket(industry: string) {
  const text = String(industry || '').trim()
  if (/餐饮|美食|咖啡|茶饮/.test(text)) return '餐饮'
  if (/招聘|招募|人力/.test(text)) return '招聘'
  if (/课程|教育|培训/.test(text)) return '课程'
  if (/电商|零售|商品|促销/.test(text)) return '电商'
  return text || '通用'
}

function replaceWeakCopyByIndustry(value: string, industry: string) {
  let next = normalizeText(value)
  if (!next) return ''
  const bucket = inferIndustryBucket(industry)
  const replacements = INDUSTRY_WEAK_COPY_REPLACEMENTS[bucket] || []
  replacements.forEach((item) => {
    next = next.replace(item.pattern, item.replacement)
  })
  return trimPosterNoise(next)
}

function sanitizeCopyLine(value: string, industry: string, max: number, fallback = '') {
  const replaced = replaceWeakCopyByIndustry(value, industry)
  const clipped = softClip(replaced, max)
  if (clipped && !isWeakCopy(clipped)) return clipped
  const fallbackValue = softClip(replaceWeakCopyByIndustry(fallback, industry), max)
  return isWeakCopy(fallbackValue) ? '' : fallbackValue
}

function dedupe(items: string[], maxCount: number, maxLen: number) {
  const result: string[] = []
  items.forEach((item) => {
    const clipped = softClip(item, maxLen)
    if (!clipped || isWeakCopy(clipped)) return
    if (result.some((existing) => existing === clipped || existing.indexOf(clipped) >= 0 || clipped.indexOf(existing) >= 0)) return
    result.push(clipped)
  })
  return result.slice(0, maxCount)
}

function cleanCandidateTitle(value: string) {
  return trimPosterNoise(value)
    .replace(/(先尝鲜|现在开吃|更上头|到店更值)\1+/g, '$1')
    .replace(/(更值得投|机会别错过|待遇更稳|上手更快)\1+/g, '$1')
    .replace(/(学完能上手|现在提效|更快入门|更值报名)\1+/g, '$1')
    .replace(/(现在更值|到手更省|趁现在入手|这波划算)\1+/g, '$1')
    .replace(/(.{2,8})\1+/g, '$1')
}

function hasCommercialSignal(text: string, industry: string) {
  const normalized = normalizeText(text)
  const industryPattern = INDUSTRY_TITLE_SIGNAL_PATTERNS[inferIndustryBucket(industry)]
  return /抢|买|下单|报名|投递|到店|尝鲜|试听|入职|开班|上新|直降|现货|包邮|满减|双休|提成|名额|限时|限量|到手/.test(normalized)
    || Boolean(industryPattern && industryPattern.test(normalized))
}

function scoreCommercialIntent(text: string, industry: string, options: { theme?: string; purpose?: string } = {}) {
  const normalized = normalizeText(text)
  if (!normalized) return 0
  const theme = trimPosterNoise(options.theme || '')
  const purpose = normalizeText(options.purpose || '')
  let score = 72
  if (hasCommercialSignal(normalized, industry)) score += 16
  if (/抢|买|下单|报名|投递|到店|尝鲜|试听|领取|咨询|锁名额|直降|到手|双休|包吃住|现货/.test(normalized)) score += 10
  if (theme && normalized === theme) score -= 24
  if (theme && normalized.startsWith(theme) && normalized.length <= theme.length + 1) score -= 16
  if (/品牌宣传|活动预告|种草|转化|引流|招生|招聘/.test(purpose) && !hasCommercialSignal(normalized, industry)) score -= 10
  if (/这件好物|这门课|这份岗位|这口新品|这次活动/.test(normalized)) score -= 8
  return clampScore(score)
}

function scoreProofPointValue(text: string, industry: string) {
  const normalized = normalizeText(text)
  if (!normalized) return 0
  let score = 35
  if (/省|直降|折|减|赠|返|券|到手|福利|包吃|包住|双休|试听|免费|立减|低至|补贴/.test(normalized)) score += 34
  if (/限时|限量|今日|本周|最后|先到先得|招满|倒计时/.test(normalized)) score += 22
  if (/适合|人群|岗位|对象|到店|进店|上课|入职|通勤|开班|试用/.test(normalized)) score += 10
  if (/现做|真材实料|老师|名师|官方|正品|包邮|社保|晋升|结果|提分|爆款/.test(normalized)) score += 18
  if (inferIndustryBucket(industry) === '招聘' && /薪|社保|双休|补贴|晋升/.test(normalized)) score += 12
  if (inferIndustryBucket(industry) === '课程' && /试听|小班|提分|实战|就业|证书/.test(normalized)) score += 12
  if (inferIndustryBucket(industry) === '餐饮' && /现做|招牌|爆汁|上新|第二份|人气/.test(normalized)) score += 12
  if (inferIndustryBucket(industry) === '电商' && /到手|包邮|现货|官方|赠品|满减/.test(normalized)) score += 12
  return score
}

export function rankProofPointsByBusinessValue(items: string[], options: { industry?: string } = {}) {
  const industry = String(options.industry || '').trim()
  return (items || [])
    .flatMap((item, index) => explodeCopySegments(replaceWeakCopyByIndustry(item, industry)).map((text) => ({ text, index })))
    .filter((item) => item.text && !isWeakCopy(item.text))
    .sort((left, right) => {
      const delta = scoreProofPointValue(right.text, industry) - scoreProofPointValue(left.text, industry)
      if (delta !== 0) return delta
      return left.index - right.index
    })
    .map((item) => item.text)
}

function deriveCoreMessage(deck: PosterCopyDeckLike, industry: string) {
  const ranked = rankProofPointsByBusinessValue([
    deck.offerLine,
    deck.actionReason,
    ...(deck.proofPoints || []),
    deck.urgencyLine,
  ], { industry })
  return ranked[0] || trimPosterNoise(deck.offerLine || deck.actionReason || deck.heroHeadline)
}

function scoreTitleCandidate(text: string) {
  const normalized = normalizeText(text)
  if (!normalized) return { clarityScore: 0, antiClicheScore: 0, totalScore: 0 }
  const length = normalized.length
  let clarityScore = 94
  if (length < 4) clarityScore -= 16
  if (length > 10) clarityScore -= Math.min(34, (length - 10) * 7)
  if (/[，,。；;：:]/.test(normalized)) clarityScore -= 6
  if (/这个|一种|一种更|体验|品质|诚意|精彩|重磅|焕新|开启|解锁|拥有|美好/.test(normalized)) clarityScore -= 20
  if (/买|下单|报名|投递|到店|试听|入职|开吃|领取|抢|尝鲜|开练|开课|开抢/.test(normalized)) clarityScore += 8
  if (/低脂|高蛋白|现做|双休|包吃住|提分|满减|直降|第二件|限量|限时|爆款|岗位|现货|报名/.test(normalized)) clarityScore += 8
  let antiClicheScore = 92
  WEAK_COPY_PATTERNS.forEach((pattern) => {
    if (pattern.test(normalized)) antiClicheScore -= 26
  })
  if (/限时|直降|现做|双休|试听|爆款|岗位|到手|小班|包吃住|尝鲜|现货|第二件|满减|低脂|高蛋白/.test(normalized)) antiClicheScore += 8
  if (/这|现在|立即|马上/.test(normalized) && !/买|下单|报名|投递|到店|试听|领取|抢|尝鲜|开练|开课/.test(normalized)) antiClicheScore -= 8
  if (/\d/.test(normalized)) clarityScore += 4
  if (/元|折|人|天|课|件|份|杯/.test(normalized)) antiClicheScore += 4
  const lengthBonus = length >= 4 && length <= 9 ? 16 : length <= 12 ? 10 : 0
  const totalScore = Math.max(0, Math.round(clarityScore * 0.52 + antiClicheScore * 0.48 + lengthBonus))
  return {
    clarityScore: Math.max(0, Math.min(100, Math.round(clarityScore))),
    antiClicheScore: Math.max(0, Math.min(100, Math.round(antiClicheScore))),
    totalScore: Math.max(0, Math.min(100, totalScore)),
  }
}

function buildSceneNoun(industry: string, theme: string) {
  const cleanTheme = trimPosterNoise(theme)
  const bucket = inferIndustryBucket(industry)
  if (bucket === '餐饮') return cleanTheme || '这口新品'
  if (bucket === '招聘') return cleanTheme || '这份岗位'
  if (bucket === '课程') return cleanTheme || '这门课'
  if (bucket === '电商') return cleanTheme || '这件好物'
  return cleanTheme || '这次活动'
}

function pickTitleCoreToken(text: string, max = 8) {
  const normalized = trimPosterNoise(text)
  if (!normalized) return ''
  const parts = normalized
    .split(/[，,。；;：:、|｜/ ]+/)
    .map((item) => trimPosterNoise(item))
    .filter(Boolean)
  const preferred = parts.find((item) => /低脂|高蛋白|现做|第二件|半价|满减|双休|提成|晋升|试听|陪跑|实战|现货|包邮|赠礼|尝鲜|招牌|新品|岗位|报名|开课|直降/.test(item))
    || parts.find((item) => item.length >= 3 && item.length <= max)
    || normalized
  return softClip(preferred, max)
}

function fillTitleTemplate(template: string, params: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, key) => trimPosterNoise(params[key] || ''))
}

function getIndustryTitleTemplates(industry: string) {
  return INDUSTRY_TITLE_TEMPLATES[inferIndustryBucket(industry)] || {
    benefit: ['{core}现在更值', '{core}值得看看'],
    scene: ['{theme}{core}', '{theme}现在了解'],
    action: ['{core}立即了解', '{core}现在行动'],
  }
}

function collectTitleSignalTerms(deck: PosterCopyDeckLike, industry: string, fallback = '') {
  const bucket = inferIndustryBucket(industry)
  const ranked = rankProofPointsByBusinessValue([
    deck.offerLine,
    deck.actionReason,
    deck.urgencyLine,
    deck.heroHeadline,
    ...(deck.proofPoints || []),
    String(deck.priceBlock?.note || ''),
    String(deck.priceBlock?.value || ''),
    String(deck.audienceLine || ''),
    String(deck.trustLine || ''),
    fallback,
  ], { industry })
  const signalPattern = INDUSTRY_TITLE_SIGNAL_PATTERNS[bucket] || /限时|优惠|报名|投递|到店|现货|上新|试听|下单/
  const tokens = ranked
    .map((item) => pickTitleCoreToken(item, 8))
    .filter(Boolean)
  const preferred = tokens.filter((item) => signalPattern.test(item))
  return dedupe(preferred.concat(tokens), 5, 8)
}

function buildBenefitTitle(coreMessage: string, industry: string, fallback: string) {
  const bucket = inferIndustryBucket(industry)
  const core = pickTitleCoreToken(coreMessage, 8) || pickTitleCoreToken(fallback, 8)
  if (bucket === '餐饮') return sanitizeCopyLine(`${core || '新品'}先尝鲜`, industry, 12, '到店尝鲜')
  if (bucket === '招聘') return sanitizeCopyLine(`${core || '岗位'}更值得投`, industry, 12, '高薪岗位快投')
  if (bucket === '课程') return sanitizeCopyLine(`${core || '这门课'}学完能上手`, industry, 12, '这门课更快上手')
  if (bucket === '电商') return sanitizeCopyLine(`${core || '这件好物'}现在更值`, industry, 12, '这件好物更值')
  return sanitizeCopyLine(core || fallback, industry, 12, fallback)
}

function buildSceneTitle(sceneNoun: string, coreMessage: string, industry: string) {
  const bucket = inferIndustryBucket(industry)
  const core = pickTitleCoreToken(coreMessage, 6)
  if (bucket === '餐饮') return sanitizeCopyLine(`${sceneNoun}${core ? ' ' + core : ''}`, industry, 12, sceneNoun)
  if (bucket === '招聘') return sanitizeCopyLine(`${sceneNoun}${core ? ' 正在补位' : ' 正在招人'}`, industry, 12, '岗位正在招人')
  if (bucket === '课程') return sanitizeCopyLine(`${sceneNoun}${core ? ' 这一期开班' : ' 这一期报名'}`, industry, 12, '这门课这一期报名')
  if (bucket === '电商') return sanitizeCopyLine(`${sceneNoun}${core ? ' 到手更省' : ' 现在有优惠'}`, industry, 12, '这件好物现在有优惠')
  return sanitizeCopyLine(`${sceneNoun}${core ? ' ' + core : ''}`, industry, 12, sceneNoun)
}

function buildActionTitle(actionVerb: string, coreMessage: string, industry: string) {
  const bucket = inferIndustryBucket(industry)
  const core = pickTitleCoreToken(coreMessage, 6)
  if (bucket === '餐饮') return sanitizeCopyLine(`${core || '新品'}${/尝鲜|到店/.test(actionVerb) ? actionVerb.replace(/^现在/, '') : '现在开吃'}`, industry, 12, '新品现在开吃')
  if (bucket === '招聘') return sanitizeCopyLine(`${core || '好岗位'}${/投递/.test(actionVerb) ? '立即投递' : '现在来投'}`, industry, 12, '好岗位立即投递')
  if (bucket === '课程') return sanitizeCopyLine(`${core || '这门课'}${/报名|试听/.test(actionVerb) ? actionVerb.replace(/^现在/, '') : '立即报名'}`, industry, 12, '这门课立即报名')
  if (bucket === '电商') return sanitizeCopyLine(`${core || '这件好物'}${/下单|选购|领取/.test(actionVerb) ? actionVerb.replace(/^现在/, '') : '马上下单'}`, industry, 12, '这件好物马上下单')
  return sanitizeCopyLine(`${actionVerb}${core ? ' ' + core : ''}`, industry, 12, actionVerb)
}

export function generateTitleCandidatesByStrategy(
  deck: PosterCopyDeckLike,
  options: { industry?: string; theme?: string; purpose?: string } = {},
): PosterTitleCandidate[] {
  const industry = String(options.industry || '').trim()
  const bucket = inferIndustryBucket(industry)
  const coreMessage = deriveCoreMessage(deck, industry)
  const theme = String(options.theme || '').trim()
  const sceneNoun = buildSceneNoun(industry, theme)
  const actionVerb = inferIndustryBucket(industry) === '招聘'
    ? '立即投递'
    : inferIndustryBucket(industry) === '课程'
      ? '立即报名'
      : inferIndustryBucket(industry) === '餐饮'
        ? '现在开吃'
      : inferIndustryBucket(industry) === '电商'
          ? '马上下单'
          : '现在了解'
  const tokens = collectTitleSignalTerms(deck, industry, theme)
  const templates = getIndustryTitleTemplates(industry)
  const themeLabel = softClip(sceneNoun || theme || (bucket === '通用' ? '这次活动' : ''), 8)
  const actionCore = pickTitleCoreToken(deck.actionReason || deck.offerLine || coreMessage, 8)
  const benefitSeeds = dedupe([
    coreMessage,
    deck.offerLine,
    deck.heroHeadline,
    ...tokens,
  ], 4, 8)
  const sceneSeeds = dedupe([
    themeLabel,
    sceneNoun,
    ...tokens,
  ], 4, 8)
  const actionSeeds = dedupe([
    actionCore,
    coreMessage,
    ...tokens,
  ], 4, 8)
  const candidates = [
    { strategy: 'benefit' as PosterTitleStrategy, text: buildBenefitTitle(coreMessage || deck.offerLine || deck.heroHeadline, industry, deck.heroHeadline || deck.offerLine || '核心卖点') },
    { strategy: 'scene' as PosterTitleStrategy, text: buildSceneTitle(sceneNoun, coreMessage || deck.offerLine || deck.supportLine, industry) },
    { strategy: 'action' as PosterTitleStrategy, text: buildActionTitle(actionVerb, coreMessage || deck.offerLine || deck.actionReason, industry) },
    { strategy: 'benefit' as PosterTitleStrategy, text: sanitizeCopyLine(deck.heroHeadline, industry, 12, coreMessage) },
    ...benefitSeeds.flatMap((seed) => templates.benefit.map((template) => ({
      strategy: 'benefit' as PosterTitleStrategy,
      text: sanitizeCopyLine(fillTitleTemplate(template, {
        core: pickTitleCoreToken(seed, 8) || pickTitleCoreToken(coreMessage, 8) || pickTitleCoreToken(deck.offerLine, 8),
        theme: themeLabel,
      }), industry, 12, seed),
    }))),
    ...sceneSeeds.flatMap((seed) => templates.scene.map((template) => ({
      strategy: 'scene' as PosterTitleStrategy,
      text: sanitizeCopyLine(fillTitleTemplate(template, {
        core: pickTitleCoreToken(seed, 6) || pickTitleCoreToken(coreMessage, 6),
        theme: themeLabel || pickTitleCoreToken(seed, 8),
      }), industry, 12, sceneNoun),
    }))),
    ...actionSeeds.flatMap((seed) => templates.action.map((template) => ({
      strategy: 'action' as PosterTitleStrategy,
      text: sanitizeCopyLine(fillTitleTemplate(template, {
        core: pickTitleCoreToken(seed, 8) || pickTitleCoreToken(coreMessage, 8),
        theme: themeLabel,
        action: actionVerb.replace(/^现在/, ''),
      }), industry, 12, actionVerb),
    }))),
  ]
  const unique = new Map<string, PosterTitleCandidate>()
  candidates.forEach((item) => {
    const text = cleanCandidateTitle(item.text)
    if (!text) return
    if (unique.has(text)) return
    const score = scoreTitleCandidate(text)
    const commercialIntentScore = scoreCommercialIntent(text, industry, options)
    unique.set(text, {
      strategy: item.strategy,
      text,
      clarityScore: score.clarityScore,
      antiClicheScore: score.antiClicheScore,
      totalScore: clampScore(score.totalScore * 0.74 + commercialIntentScore * 0.26),
      commercialIntentScore,
    })
  })
  return Array.from(unique.values())
    .sort((left, right) => {
      if (right.totalScore !== left.totalScore) return right.totalScore - left.totalScore
      if ((right.commercialIntentScore || 0) !== (left.commercialIntentScore || 0)) {
        return (right.commercialIntentScore || 0) - (left.commercialIntentScore || 0)
      }
      if (left.text.length !== right.text.length) return left.text.length - right.text.length
      if (right.clarityScore !== left.clarityScore) return right.clarityScore - left.clarityScore
      return right.antiClicheScore - left.antiClicheScore
    })
    .slice(0, 12)
}

export function pickBestTitleCandidate(candidates: PosterTitleCandidate[]) {
  const ranked = (candidates || []).slice().sort((left, right) => {
    if (right.totalScore !== left.totalScore) return right.totalScore - left.totalScore
    if ((right.commercialIntentScore || 0) !== (left.commercialIntentScore || 0)) {
      return (right.commercialIntentScore || 0) - (left.commercialIntentScore || 0)
    }
    const strategyPriority = { action: 3, benefit: 2, scene: 1 }
    if (strategyPriority[right.strategy] !== strategyPriority[left.strategy]) {
      return strategyPriority[right.strategy] - strategyPriority[left.strategy]
    }
    if (left.text.length !== right.text.length) return left.text.length - right.text.length
    if (right.clarityScore !== left.clarityScore) return right.clarityScore - left.clarityScore
    if (right.antiClicheScore !== left.antiClicheScore) return right.antiClicheScore - left.antiClicheScore
    return 0
  })
  return ranked[0] || null
}

function pickFallbackCta(industry: string, preferred: string[]) {
  const pool = getIndustryCtaPool(industry)
  const candidate = dedupe(pool.concat(preferred), 1, 6)[0]
  return candidate || '立即了解'
}

export function getIndustryCtaPool(industry: string) {
  const text = String(industry || '').trim()
  if (INDUSTRY_CTA_POOL[text]) return INDUSTRY_CTA_POOL[text].slice()
  if (/餐饮|美食|咖啡|茶饮/.test(text)) return INDUSTRY_CTA_POOL['餐饮'].slice()
  if (/招聘|招募|人力/.test(text)) return INDUSTRY_CTA_POOL['招聘'].slice()
  if (/课程|教育|培训/.test(text)) return INDUSTRY_CTA_POOL['课程'].slice()
  if (/电商|零售|商品|促销/.test(text)) return INDUSTRY_CTA_POOL['电商'].slice()
  return ['立即了解', '马上查看', '立即咨询']
}

export function sanitizePosterCopyDeck(deck: PosterCopyDeckLike, options: { industry?: string; theme?: string; purpose?: string } = {}): PosterCopyDeckLike {
  const industry = String(options.industry || '').trim()
  const ctaPool = getIndustryCtaPool(industry)
  const rankedProofPoints = rankProofPointsByBusinessValue(
    ([] as string[])
      .concat(deck.proofPoints || [])
      .concat(explodeCopySegments(deck.offerLine || ''))
      .concat(explodeCopySegments(deck.actionReason || ''))
      .concat(explodeCopySegments(deck.urgencyLine || '')),
    { industry },
  )
  const proofPoints = dedupe(rankedProofPoints, 3, 14)
  const ctaAlternatives = dedupe((deck.ctaAlternatives || []).concat(ctaPool), 4, 6)
  const nextCta = pickFallbackCta(industry, [deck.cta].concat(ctaAlternatives))
  const titleCandidates = generateTitleCandidatesByStrategy(deck, {
    industry,
    theme: options.theme,
    purpose: options.purpose,
  })
  const bestTitle = pickBestTitleCandidate(titleCandidates)
  const primaryMessage = proofPoints[0] || sanitizeCopyLine(deck.offerLine || deck.actionReason, industry, 14)
  const supportSeeds = dedupe([
    proofPoints[1],
    sanitizeCopyLine(deck.supportLine, industry, 18),
    proofPoints[2],
    sanitizeCopyLine(deck.audienceLine, industry, 18),
    sanitizeCopyLine(deck.trustLine, industry, 18),
    sanitizeCopyLine(deck.actionReason, industry, 18),
  ], 3, 18).filter((item) => item && item !== bestTitle?.text && item !== primaryMessage)
  const supportFallback = dedupe([
    ...supportSeeds,
    sanitizeCopyLine(primaryMessage, industry, 18),
  ], 1, 18)[0] || ''
  return {
    ...deck,
    heroHeadline: bestTitle?.text || sanitizeCopyLine(deck.heroHeadline, industry, 12, primaryMessage),
    supportLine: supportFallback,
    offerLine: sanitizeCopyLine(primaryMessage || deck.offerLine, industry, 14, ''),
    urgencyLine: sanitizeCopyLine(deck.urgencyLine, industry, 14, ''),
    actionReason: sanitizeCopyLine(deck.actionReason, industry, 14, primaryMessage),
    audienceLine: sanitizeCopyLine(deck.audienceLine, industry, 14, ''),
    trustLine: sanitizeCopyLine(deck.trustLine, industry, 14, ''),
    badge: sanitizeCopyLine(deck.badge, industry, 6, ''),
    cta: nextCta,
    ctaAlternatives: ctaAlternatives,
    proofPoints: proofPoints,
  }
}

export function scoreHeroCandidateBreakdown(breakdown: HeroScoreBreakdown) {
  const safe = {
    whitespace: clampScore(breakdown.whitespace),
    subjectPosition: clampScore(breakdown.subjectPosition),
    clarity: clampScore(breakdown.clarity),
    toneMatch: clampScore(breakdown.toneMatch),
  }
  return Math.round(
    safe.whitespace * 0.3 +
    safe.subjectPosition * 0.28 +
    safe.clarity * 0.22 +
    safe.toneMatch * 0.2,
  )
}

export function chooseBestHeroCandidate(
  candidates: ScoredHeroCandidate[],
  options: { mode: 'fast' | 'quality'; threshold?: number },
): HeroSelectionDecision {
  const threshold = Number.isFinite(options.threshold) ? Number(options.threshold) : 80
  const ranked = (candidates || [])
    .map((candidate, index) => ({
      ...candidate,
      score: clampScore(candidate.score || scoreHeroCandidateBreakdown(candidate.scoreBreakdown)),
      _index: index,
    }))
    .sort((left, right) => right.score - left.score)
  const recommended = ranked[0] || {
    imageUrl: '',
    prompt: '',
    score: 0,
    scoreBreakdown: { whitespace: 0, subjectPosition: 0, clarity: 0, toneMatch: 0 },
    selected: false,
    _index: 0,
  }
  const spread = Math.max(0, recommended.score - Number((ranked[1] && ranked[1].score) || 0))
  const lowConfidence = recommended.score < threshold
  const recommendedIndex = recommended._index
  const selectionMode = options.mode === 'fast' ? 'auto' : 'manual'
  const selectedIndex = recommendedIndex
  const normalizedCandidates = candidates.map((candidate, index) => ({
    ...candidate,
    score: clampScore(candidate.score || scoreHeroCandidateBreakdown(candidate.scoreBreakdown)),
    selected: index === selectedIndex,
  }))
  return {
    recommendedIndex,
    selectedIndex,
    selectionMode,
    candidates: normalizedCandidates,
    summary: {
      topScore: recommended.score,
      lowConfidence,
      spread,
    },
  }
}
