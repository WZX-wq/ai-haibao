import assert from 'assert'
import {
  chooseBestHeroCandidate,
  sanitizePosterCopyDeck,
  getIndustryCtaPool,
  PosterCopyDeckLike,
  ScoredHeroCandidate,
} from '../aiPosterPolicy'

function makeDeck(overrides: Partial<PosterCopyDeckLike> = {}): PosterCopyDeckLike {
  return {
    heroHeadline: '春日轻食随手拍马上开吃',
    supportLine: '适合午休和下班顺路带走的轻盈套餐福利',
    offerLine: '第二份半价再送饮品',
    urgencyLine: '限时三天到店可用',
    actionReason: '现在下单更划算',
    cta: '马上下单抢福利',
    ctaAlternatives: ['立即下单', '限时抢购', '到店尝鲜'],
    badge: '新品上市',
    proofPoints: ['真材实料看得见', '第二份半价更划算', '午休也能轻松带走', '口味升级体验非凡'],
    factCards: [],
    priceBlock: null,
    audienceLine: '适合上班族和轻食控',
    trustLine: '门店现做更安心',
    ...overrides,
  }
}

function makeCandidate(name: string, score: number, overrides: Partial<ScoredHeroCandidate> = {}): ScoredHeroCandidate {
  const baseBreakdown = {
    whitespace: score,
    subjectPosition: score,
    clarity: score,
    toneMatch: score,
  }
  return {
    imageUrl: `${name}.png`,
    prompt: `${name} prompt`,
    score,
    selected: false,
    scoreBreakdown: Object.assign({}, baseBreakdown, overrides.scoreBreakdown || {}),
    ...overrides,
  }
}

function run() {
  const deck = sanitizePosterCopyDeck(makeDeck(), { industry: '餐饮' })
  assert.equal(deck.heroHeadline.length <= 12, true, 'title should be clipped to 12 chars')
  assert.equal(deck.supportLine.length <= 18, true, 'support line should be clipped to 18 chars')
  assert.equal(deck.cta.length <= 6, true, 'cta should be clipped to 6 chars')
  assert.equal(deck.proofPoints.length <= 3, true, 'proof points should be trimmed to 3')
  assert.equal(deck.proofPoints.some((item: string) => /体验非凡/.test(item)), false, 'weak copy should be removed')
  assert.equal(getIndustryCtaPool('餐饮').includes(deck.cta), true, 'food cta should come from industry pool')

  const autoChoice = chooseBestHeroCandidate(
    [
      makeCandidate('a', 78),
      makeCandidate('b', 86, { scoreBreakdown: { whitespace: 92 } as any }),
      makeCandidate('c', 82),
    ],
    { mode: 'fast', threshold: 80 },
  )
  assert.equal(autoChoice.recommendedIndex, 1, 'fast mode should recommend highest score')
  assert.equal(autoChoice.selectedIndex, 1, 'fast mode should auto select highest score')
  assert.equal(autoChoice.selectionMode, 'auto', 'fast mode should be auto')

  const manualChoice = chooseBestHeroCandidate(
    [
      makeCandidate('low', 62),
      makeCandidate('mid', 79),
      makeCandidate('best', 88),
    ],
    { mode: 'quality', threshold: 80 },
  )
  assert.equal(manualChoice.recommendedIndex, 2, 'quality mode should still recommend best candidate')
  assert.equal(manualChoice.selectedIndex, 2, 'quality mode should default to recommended candidate index')
  assert.equal(manualChoice.selectionMode, 'manual', 'quality mode should be manual')
  assert.equal(manualChoice.summary.lowConfidence, false, 'high score recommendation should not be low confidence')

  const lowConfidenceChoice = chooseBestHeroCandidate(
    [
      makeCandidate('low-a', 58),
      makeCandidate('low-b', 64),
      makeCandidate('low-c', 61),
    ],
    { mode: 'quality', threshold: 80 },
  )
  assert.equal(lowConfidenceChoice.summary.lowConfidence, true, 'sub-threshold recommendation should be low confidence')
}

run()
