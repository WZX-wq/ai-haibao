export type SensitiveHit = {
  field: string
  keyword: string
}

const KEYWORDS = [
  '台独', '港独', '藏独', '疆独', '法轮功', '法轮大法', '六四', '天安门事件',
  '颠覆国家政权', '分裂国家', '恐怖主义', '圣战', 'isis',
  '色情', '约炮', '援交', '裸聊', '成人视频', '成人直播', 'porn', '色情网', '情色',
  '毒品', '冰毒', '海洛因', '摇头丸', 'k粉', '大麻', '麻古',
  '赌博', '博彩', '赌场', '六合彩', '老虎机', '赌球', '时时彩', '快3',
  '买凶', '爆炸物', '枪支', '手枪', '步枪', '杀人', '自杀教学', '制毒',
  '刷单', '跑分', '洗钱', '套现', '代开发票', '伪基站', '钓鱼网站', '黑产',
]

const REGEX_RULES: Array<{ keyword: string; regex: RegExp }> = [
  { keyword: '台独', regex: /台\W*独/i },
  { keyword: '港独', regex: /港\W*独/i },
  { keyword: '藏独', regex: /藏\W*独/i },
  { keyword: '疆独', regex: /疆\W*独/i },
  { keyword: '法轮功', regex: /法\W*轮\W*功/i },
  { keyword: '六四', regex: /六\W*四/i },
  { keyword: '约炮', regex: /约\W*炮/i },
  { keyword: '裸聊', regex: /裸\W*聊/i },
  { keyword: 'porn', regex: /p\W*o\W*r\W*n/i },
  { keyword: '博彩', regex: /博\W*彩/i },
  { keyword: '赌博', regex: /赌\W*博/i },
  { keyword: '毒品', regex: /毒\W*品/i },
  { keyword: '刷单', regex: /刷\W*单/i },
  { keyword: '洗钱', regex: /洗\W*钱/i },
]

function normalizeText(input: string): string {
  return String(input || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s`~!@#$%^&*()_\-+=|\\{}[\]:;"'<>,.?/~！@#￥%……&*（）——+\-=\|、【】{}；：‘’“”《》？，。·]/g, '')
}

export function detectSensitiveWords(payload: Record<string, string>, maxHits = 3): SensitiveHit[] {
  const hits: SensitiveHit[] = []
  Object.entries(payload).forEach(([field, value]) => {
    if (hits.length >= maxHits) return
    const raw = String(value || '')
    const normalized = normalizeText(raw)
    if (!normalized) return

    for (const keyword of KEYWORDS) {
      if (normalized.includes(normalizeText(keyword))) {
        hits.push({ field, keyword })
        return
      }
    }
    for (const rule of REGEX_RULES) {
      if (rule.regex.test(raw)) {
        hits.push({ field, keyword: rule.keyword })
        return
      }
    }
  })
  return hits
}

