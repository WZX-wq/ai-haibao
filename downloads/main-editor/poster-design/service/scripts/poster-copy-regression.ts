import {
  generateTitleCandidatesByStrategy,
  pickBestTitleCandidate,
  sanitizePosterCopyDeck,
} from '../src/service/aiPosterPolicy'

type RegressionSample = {
  name: string
  industry: string
  theme: string
  purpose: string
  deck: {
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
}

const samples: RegressionSample[] = [
  {
    name: '餐饮-轻食上新',
    industry: '餐饮',
    theme: '轻食能量碗',
    purpose: '门店上新引流',
    deck: {
      heroHeadline: '新品轻食能量碗',
      supportLine: '低脂高蛋白，工作日午餐更轻松',
      offerLine: '第二份半价',
      urgencyLine: '本周上新限时尝鲜',
      actionReason: '到店现做，出餐更快',
      cta: '立即解锁',
      ctaAlternatives: ['现在开吃', '到店尝鲜'],
      badge: '上新',
      proofPoints: ['低脂高蛋白', '现点现做', '第二份半价'],
      factCards: [],
      priceBlock: { value: '29.9', note: '双人更划算' },
      audienceLine: '白领午餐 / 健身控',
      trustLine: '门店现做',
    },
  },
  {
    name: '招聘-咖啡店店员',
    industry: '招聘',
    theme: '咖啡店店员',
    purpose: '门店招聘转化',
    deck: {
      heroHeadline: '诚意呈现优质岗位',
      supportLine: '咖啡门店直招，排班灵活，带教上手',
      offerLine: '底薪+提成',
      urgencyLine: '门店扩招，尽快到岗',
      actionReason: '双休排班 / 带教培训 / 晋升通道',
      cta: '不容错过',
      ctaAlternatives: ['立即投递', '马上咨询'],
      badge: '直招',
      proofPoints: ['双休排班', '带教培训', '晋升通道'],
      factCards: [],
      priceBlock: null,
      audienceLine: '应届可投',
      trustLine: '门店直招',
    },
  },
  {
    name: '课程-AI 海报训练营',
    industry: '课程',
    theme: 'AI 海报训练营',
    purpose: '课程报名转化',
    deck: {
      heroHeadline: 'AI 海报训练营火热进行中',
      supportLine: '零基础也能做出商业海报，陪跑带练',
      offerLine: '限时试听名额',
      urgencyLine: '本期仅开 30 个名额',
      actionReason: '直播带练 / 作业点评 / 商业案例拆解',
      cta: '精彩来袭',
      ctaAlternatives: ['立即报名', '领取试听'],
      badge: '开班',
      proofPoints: ['零基础入门', '直播带练', '作业点评'],
      factCards: [],
      priceBlock: { value: '199', note: '试听后可抵扣' },
      audienceLine: '设计转行 / 新手运营',
      trustLine: '导师陪跑',
    },
  },
  {
    name: '电商-蓝牙耳机大促',
    industry: '电商',
    theme: '蓝牙耳机',
    purpose: '活动促销转化',
    deck: {
      heroHeadline: '品质升级蓝牙耳机',
      supportLine: '降噪续航都在线，通勤办公更省心',
      offerLine: '到手直降 80',
      urgencyLine: '现货包邮，今晚截止',
      actionReason: '爆款返场 / 官方现货 / 赠运费险',
      cta: '马上拥有',
      ctaAlternatives: ['马上下单', '领取优惠'],
      badge: '热卖',
      proofPoints: ['官方现货', '到手直降 80', '赠运费险'],
      factCards: [],
      priceBlock: { value: '219', note: '领券后到手' },
      audienceLine: '通勤党 / 学生党',
      trustLine: '官方正品',
    },
  },
  {
    name: '餐饮-咖啡早餐套餐',
    industry: '餐饮',
    theme: '工作日早餐套餐',
    purpose: '早餐时段引流',
    deck: {
      heroHeadline: '工作日早餐套餐',
      supportLine: '咖啡+贝果现做现出，通勤顺手带走',
      offerLine: '第二杯半价',
      urgencyLine: '早 7 点到 10 点限时供应',
      actionReason: '到店现做 / 出餐快 / 工作日专享',
      cta: '体验非凡',
      ctaAlternatives: ['到店尝鲜', '立即下单'],
      badge: '早餐',
      proofPoints: ['第二杯半价', '到店现做', '工作日专享'],
      factCards: [],
      priceBlock: { value: '19.9', note: '咖啡+贝果组合' },
      audienceLine: '通勤白领',
      trustLine: '门店现做',
    },
  },
  {
    name: '招聘-健身顾问',
    industry: '招聘',
    theme: '健身顾问',
    purpose: '门店招聘转化',
    deck: {
      heroHeadline: '健身顾问招募中',
      supportLine: '底薪提成清晰，带教上手，门店直招',
      offerLine: '高提成岗位',
      urgencyLine: '新店开业急招',
      actionReason: '带教培训 / 晋升通道 / 排班灵活',
      cta: '精彩来袭',
      ctaAlternatives: ['立即投递', '马上咨询'],
      badge: '急招',
      proofPoints: ['高提成岗位', '排班灵活', '带教培训'],
      factCards: [],
      priceBlock: null,
      audienceLine: '有销售经验优先',
      trustLine: '门店直招',
    },
  },
  {
    name: '课程-短视频剪辑课',
    industry: '课程',
    theme: '短视频剪辑课',
    purpose: '试听转化',
    deck: {
      heroHeadline: '短视频剪辑课限时开启',
      supportLine: '零基础可学，案例实操，直播答疑',
      offerLine: '试听课 0 元领',
      urgencyLine: '今晚 8 点直播试听',
      actionReason: '直播带练 / 案例拆解 / 课后答疑',
      cta: '焕新开启',
      ctaAlternatives: ['领取试听', '立即报名'],
      badge: '试听',
      proofPoints: ['试听课 0 元领', '案例实操', '直播答疑'],
      factCards: [],
      priceBlock: { value: '0', note: '试听席位限量' },
      audienceLine: '新手剪辑 / 创作者',
      trustLine: '老师带练',
    },
  },
  {
    name: '电商-护肤套装',
    industry: '电商',
    theme: '修护护肤套装',
    purpose: '新品促销转化',
    deck: {
      heroHeadline: '修护护肤套装品质升级',
      supportLine: '舒缓修护一步到位，敏感肌也能安心用',
      offerLine: '满 299 减 60',
      urgencyLine: '现货包邮，本周结束',
      actionReason: '官方现货 / 加赠面膜 / 运费险',
      cta: '马上拥有',
      ctaAlternatives: ['领取优惠', '马上下单'],
      badge: '新品',
      proofPoints: ['满 299 减 60', '官方现货', '加赠面膜'],
      factCards: [],
      priceBlock: { value: '299', note: '领券后更省' },
      audienceLine: '换季敏感肌',
      trustLine: '官方正品',
    },
  },
]

function evaluateDeck(name: string, deck: ReturnType<typeof sanitizePosterCopyDeck>) {
  const issues: string[] = []
  if (!deck.heroHeadline || deck.heroHeadline.length > 12) issues.push('标题长度异常')
  if (!deck.supportLine || deck.supportLine === deck.heroHeadline) issues.push('副标题分工不足')
  if (!deck.cta || deck.cta.length > 6) issues.push('CTA 不够利落')
  if (deck.proofPoints.length === 0 || deck.proofPoints.length > 3) issues.push('卖点数量异常')
  if (/体验非凡|品质升级|诚意呈现|精彩来袭|不容错过|马上拥有/.test([
    deck.heroHeadline,
    deck.supportLine,
    deck.cta,
    deck.offerLine,
  ].join(' '))) issues.push('弱文案残留')
  return {
    name,
    pass: issues.length === 0,
    issues,
  }
}

let passCount = 0
samples.forEach((sample) => {
  const sanitized = sanitizePosterCopyDeck(sample.deck, {
    industry: sample.industry,
    theme: sample.theme,
    purpose: sample.purpose,
  })
  const candidates = generateTitleCandidatesByStrategy(sanitized, {
    industry: sample.industry,
    theme: sample.theme,
    purpose: sample.purpose,
  })
  const best = pickBestTitleCandidate(candidates)
  const report = evaluateDeck(sample.name, sanitized)
  if (report.pass) passCount += 1
  console.log(`\n=== ${sample.name} ===`)
  console.log(`最佳标题: ${best?.text || '(空)'}`)
  console.log(`候选标题: ${candidates.map((item) => `${item.strategy}:${item.text}(${item.totalScore})`).join(' | ')}`)
  console.log(`副标题: ${sanitized.supportLine}`)
  console.log(`CTA: ${sanitized.cta}`)
  console.log(`卖点: ${sanitized.proofPoints.join(' / ')}`)
  console.log(`结果: ${report.pass ? 'PASS' : `FAIL -> ${report.issues.join('、')}`}`)
})

console.log(`\nSummary: ${passCount}/${samples.length} samples passed`)
