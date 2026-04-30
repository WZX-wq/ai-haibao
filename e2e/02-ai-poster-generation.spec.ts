import { test, expect, type Page } from '@playwright/test'

const scenarios = [
  { name: '电商促销', industry: '电商', purpose: '促销', style: '轻奢质感', sizeKey: 'ecommerce', theme: '618 防晒套装', body: '到手价199元｜第二件半价｜赠旅行装｜敏感肌也能用｜今日下单次日发货', cta: '马上抢购', family: 'premium-offer', scene: 'commerce', pattern: 'price-first' },
  { name: '招聘招募', industry: '招聘', purpose: '招募', style: '高级简约', sizeKey: 'flyer', theme: '门店运营招聘', body: '底薪+提成+餐补｜晋升路径清晰｜当天反馈｜门店运营岗位｜优先面试', cta: '投递简历', family: 'list-recruitment', scene: 'recruitment', pattern: 'list-info' },
  { name: '节日活动', industry: '节日', purpose: '促销', style: '新中式雅致', sizeKey: 'moments', theme: '端午礼盒', body: '端午限定礼盒｜满299减40｜企业团购可定制｜节前最后一周｜门店自提同城配送', cta: '立即下单', family: 'festive-frame', scene: 'festival', pattern: 'immersive-hero' },
  { name: '课程报名', industry: '课程', purpose: '报名', style: '高级简约', sizeKey: 'xiaohongshu', theme: 'AI 商业实战班', body: '8周项目制训练｜直播答疑｜作业点评｜前50名赠模板｜适合运营与创作者', cta: '立即报名', family: 'clean-course', scene: 'course', pattern: 'list-info' },
  { name: '餐饮新品', industry: '餐饮', purpose: '门店导流', style: '高级简约', sizeKey: 'flyer', theme: '春季咖啡特调', body: '限定风味｜会员积分双倍｜第二杯半价｜今日开始供应｜门店同步上新', cta: '到店尝鲜', family: 'hero-center', scene: 'food', pattern: 'info-cards' },
  { name: '小红书封面', industry: '社媒', purpose: '品牌宣传', style: '年轻潮流', sizeKey: 'xiaohongshu', theme: '护肤体验笔记', body: '先说结论：成膜快不搓泥｜通勤不闷｜后续上妆稳｜适合春夏通勤党', cta: '看完整测评', family: 'xiaohongshu-note', scene: 'social', pattern: 'immersive-hero' },
]

function buildMockResult(scenario: (typeof scenarios)[number]) {
  const priceBlock = /元|减|半价/.test(scenario.body)
    ? { tag: '限时礼遇', value: '￥199', suffix: '起', note: '今日下单更划算' }
    : null
  const supportLineByScene: Record<string, string> = {
    commerce: '核心卖点/优惠窗口/入手理由',
    recruitment: '岗位清晰/薪酬激励/投递友好',
    festival: '限定礼遇/送礼分享/节庆心意',
    course: '零基础友好/实战提效/报名通道',
    food: '限定风味/到店理由/尝鲜窗口',
    social: '先看重点/适合谁看/为什么收藏',
  }
  const factCardsByScene: Record<string, Array<{ label: string; value: string; hint: string }>> = {
    commerce: [
      { label: '权益', value: '到手价199元', hint: '限时入手/加赠礼遇' },
      { label: '适合', value: '敏感肌也能用', hint: '通勤场景/日常刚需' },
      { label: '加码', value: '第二件半价', hint: '今日下单/次日发货' },
    ],
    recruitment: [
      { label: '岗位', value: '门店运营岗位', hint: '晋升清晰/带教上手' },
      { label: '薪酬', value: '底薪+提成+餐补', hint: '排班灵活/激励明确' },
      { label: '福利', value: '当天反馈', hint: '优先面试/投递友好' },
    ],
    festival: [
      { label: '礼遇', value: '满299减40', hint: '节日限定/送礼有理' },
      { label: '场景', value: '企业团购可定制', hint: '团圆分享/心意到位' },
      { label: '加码', value: '门店自提同城配送', hint: '节前下单/更快送达' },
    ],
    course: [
      { label: '适合谁', value: '适合运营与创作者', hint: '零基础友好/适合转型' },
      { label: '学什么', value: '直播答疑+作业点评', hint: '案例实战/结果导向' },
      { label: '报名', value: '前50名赠模板', hint: '立即锁位/席位有限' },
    ],
    food: [
      { label: '风味', value: '限定风味', hint: '现制出杯/口感在线' },
      { label: '适合', value: '春夏轻咖场景', hint: '午后提神/轻负担' },
      { label: '到店', value: '第二杯半价', hint: '今日上新/到店更值' },
    ],
    social: [
      { label: '结论', value: '成膜快不搓泥', hint: '先看重点/直接种草' },
      { label: '场景', value: '春夏通勤党', hint: '轻薄服帖/日常可用' },
      { label: '体验', value: '后续上妆稳', hint: '值得收藏/持续复看' },
    ],
  }
  return {
    title: scenario.theme,
    slogan: supportLineByScene[scenario.scene],
    body: scenario.body,
    cta: scenario.cta,
    badge: scenario.industry === '招聘' ? '岗位开放' : '重点推荐',
    offerLine: scenario.body.split('｜')[0],
    urgencyLine: scenario.body.split('｜')[3] || '现在行动更合适',
    proofPoints: scenario.body.split('｜').slice(0, 5),
    posterIntent: {
      scene: scenario.scene,
      goal: scenario.scene === 'recruitment' ? 'recruit' : scenario.scene === 'course' ? 'sign_up' : scenario.purpose === '品牌宣传' ? 'promote' : 'sell',
      audience: '适合当前目标人群快速判断',
      tone: `${scenario.style} / 成品优先`,
    },
    copyDeck: {
      heroHeadline: scenario.theme,
      supportLine: supportLineByScene[scenario.scene],
      offerLine: scenario.body.split('｜')[0],
      urgencyLine: scenario.body.split('｜')[3] || '现在行动更合适',
      actionReason: scenario.body.split('｜')[1] || '核心权益已整理',
      cta: scenario.cta,
      badge: scenario.industry === '招聘' ? '岗位开放' : '重点推荐',
      proofPoints: scenario.body.split('｜').slice(0, 5),
      factCards: factCardsByScene[scenario.scene],
      priceBlock,
      audienceLine: '适合目标用户快速判断',
      trustLine: '关键信息已整理成可编辑结构',
    },
    palette: {
      background: '#f7f4ef',
      surface: '#ffffff',
      primary: '#a53b20',
      secondary: '#e9c7b2',
      text: '#221814',
      muted: '#6f5b52',
      swatches: ['#f7f4ef', '#ffffff', '#a53b20', '#e9c7b2', '#221814'],
    },
    background: { imageUrl: '', prompt: '' },
    hero: { imageUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=80', prompt: '' },
    recommendedTemplates: [],
    templateCandidates: [],
    designPlan: {
      industry: scenario.industry,
      tone: `${scenario.style} / 成品优先`,
      layoutFamily: scenario.family,
      density: 'balanced',
      heroStrategy: scenario.industry === '招聘' ? 'person' : 'scene',
      ctaStrength: 'strong',
      qrStrategy: 'corner',
      textStrategy: 'panel',
      backgroundTone: 'mixed',
      contentPattern: scenario.pattern,
      emphasisOrder: ['heroHeadline', 'supportLine', 'factCards', 'cta'],
      templateCandidates: [],
      absoluteLayout: { version: 'v1', layers: [] },
    },
    qualityHints: ['已启用信息卡模式', '主视觉已全屏铺满并保持不透明'],
    qualityReport: { pass: true, score: 92, needsRefine: false, issues: [] },
    size: { key: 'xiaohongshu', name: '小红书封面', width: 1242, height: 1660 },
    providerMeta: {
      copy: { provider: 'aliyun-bailian', model: 'qwen-plus', isMockFallback: false, message: 'mock copy' },
      image: { provider: 'aliyun-bailian', model: 'wanx2.1-t2i-turbo', isMockFallback: false, message: 'mock image' },
      background: { provider: 'aliyun-bailian', model: 'wanx2.1-t2i-turbo', isMockFallback: false, message: 'mock background' },
      relayout: { provider: 'aliyun-bailian', model: 'qwen-vl-plus-latest', isMockFallback: false, message: 'mock relayout' },
      multimodalLayout: { provider: 'aliyun-bailian', model: 'qwen-vl-plus-latest', isMockFallback: false, message: 'mock multimodal layout' },
    },
  }
}

function expectMatureSupportLine(value: string) {
  expect(value.length).toBeGreaterThan(5)
  expect(value.length).toBeLessThanOrEqual(26)
  expect(value).not.toMatch(/一次说清|关键信息已整理|成片示例|为什么现在报名/)
  expect(value.split(/[｜|]/).length).toBeLessThanOrEqual(3)
}

function expectFactCardsMature(cards: Array<{ label: string; value: string; hint: string }>) {
  expect(cards.length).toBeGreaterThanOrEqual(3)
  for (const card of cards) {
    expect(card.label.length).toBeLessThanOrEqual(6)
    expect(card.value.length).toBeLessThanOrEqual(14)
    expect(card.hint.length).toBeLessThanOrEqual(12)
    expect(card.hint).not.toBe(card.value)
  }
}

async function gotoAiPoster(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('xp_token', 'playwright-mock-token')
    window.localStorage.setItem('username', 'Playwright User')
    window.localStorage.setItem('xp_auth_user', JSON.stringify({ id: 1, name: 'Playwright User', avatar: '', email: '', provider: 'playwright' }))
    window.localStorage.setItem(
      'xp_auth_permissions',
      JSON.stringify({
        is_vip: true,
        vip_level: 1,
        vip_expire_time: null,
        daily_limit_count: 999,
        daily_download_limit: 999,
        daily_ai_limit: 999,
        max_file_size: 52428800,
        allow_batch: true,
        allow_no_watermark: true,
        allow_ai_tools: true,
        allow_download: true,
        allow_template_manage: true,
      }),
    )
  })
  await page.goto('/home?section=ai-poster')
  await page.waitForLoadState('networkidle')
}

async function fillFirstVisibleInput(page: Page, value: string) {
  const input = page.locator('input, textarea').filter({ hasNot: page.locator('[disabled]') }).first()
  await expect(input).toBeVisible()
  await input.fill(value)
}

test.describe('AI 海报成片回归', () => {
  test('mock 协议能体现 scene / style / size 差异', () => {
    const commerce = buildMockResult(scenarios[0])
    const course = buildMockResult(scenarios[3])
    expect(commerce.posterIntent?.scene).toBe('commerce')
    expect(course.posterIntent?.scene).toBe('course')
    expect(commerce.designPlan?.layoutFamily).not.toBe(course.designPlan?.layoutFamily)
    expect(commerce.designPlan?.contentPattern).toBe('price-first')
    expect(course.designPlan?.contentPattern).toBe('list-info')
    expect(commerce.posterIntent?.tone).toContain('轻奢质感')
    expect(course.posterIntent?.tone).toContain('高级简约')
    expect(commerce.copyDeck?.supportLine).not.toBe(course.copyDeck?.supportLine)
  })

  test('AI 海报页面可访问', async ({ page }) => {
    await gotoAiPoster(page)
    await expect(page.locator('body')).toContainText(/AI|海报/i)
  })

  for (const scenario of scenarios) {
    test(`mock 生成 ${scenario.name} 成片`, async ({ page }) => {
      let requestSeen = false
      await page.route('**/ai/poster/generate', async (route) => {
        requestSeen = true
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ code: 200, result: buildMockResult(scenario) }),
        })
      })
      await gotoAiPoster(page)
      await fillFirstVisibleInput(page, scenario.theme)
      const generateBtn = page.getByTestId('poster-generate-quality')
      await expect(generateBtn).toBeVisible()
      await Promise.all([
        page.waitForResponse((response) => response.url().includes('/ai/poster/generate') && response.request().method() === 'POST'),
        generateBtn.click(),
      ])
      expect(requestSeen).toBeTruthy()
      const result = buildMockResult(scenario)
      expectMatureSupportLine(result.copyDeck.supportLine)
      expectFactCardsMature(result.copyDeck.factCards)
      expect(result.providerMeta.multimodalLayout.provider).toBe('aliyun-bailian')
      expect(result.providerMeta.multimodalLayout.model).toBe('qwen-vl-plus-latest')
      expect(result.designPlan.contentPattern).toBe(scenario.pattern)
      expect(result.posterIntent.scene).toBe(scenario.scene)
      const qaSummary = page.getByTestId('poster-qa-summary')
      const debugPanel = page.getByTestId('poster-debug-panel')
      await expect(page.locator('body')).toContainText(scenario.theme)
      await expect(page.locator('body')).toContainText(scenario.cta)
      await expect(qaSummary).toContainText(scenario.theme)
      await expect(qaSummary).toContainText(scenario.cta)
      await expect(qaSummary).toContainText(/\d+条|￥199/)
      await expect(debugPanel).toContainText(/全屏铺满并保持不透明|信息卡模式|价格块模式/)
      await expect(page.getByTestId('poster-design-summary')).toContainText(scenario.family)
      await expect(page.getByTestId('poster-design-summary')).toContainText(scenario.pattern)
      await page.screenshot({ path: `output/ai-poster-${scenario.name}.png`, fullPage: true })
    })
  }
})
