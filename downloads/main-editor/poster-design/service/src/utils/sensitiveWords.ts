import fs from 'fs'
import path from 'path'

export type SensitiveLevel = 'block' | 'review'
export type SensitiveHit = {
  field: string
  keyword: string
  level: SensitiveLevel
  source: 'keyword' | 'regex'
}

type SensitiveRuleConfig = {
  keyword: string
  level?: SensitiveLevel
}

type SensitiveRegexConfig = {
  keyword: string
  regex: string
  flags?: string
  level?: SensitiveLevel
}

type SensitiveConfigFile = {
  keywords?: SensitiveRuleConfig[]
  regexRules?: SensitiveRegexConfig[]
  allowlistPaths?: string[]
}

const DEFAULT_KEYWORDS: SensitiveRuleConfig[] = [
  { keyword: '台独', level: 'block' }, { keyword: '港独', level: 'block' }, { keyword: '藏独', level: 'block' }, { keyword: '疆独', level: 'block' },
  { keyword: '法轮功', level: 'block' }, { keyword: '法轮大法', level: 'block' }, { keyword: '六四', level: 'block' }, { keyword: '天安门事件', level: 'block' },
  { keyword: '颠覆国家政权', level: 'block' }, { keyword: '分裂国家', level: 'block' }, { keyword: '恐怖主义', level: 'block' }, { keyword: '圣战', level: 'block' },
  { keyword: 'isis', level: 'block' }, { keyword: '色情', level: 'block' }, { keyword: '约炮', level: 'block' }, { keyword: '援交', level: 'block' },
  { keyword: '裸聊', level: 'block' }, { keyword: '成人视频', level: 'block' }, { keyword: 'adult', level: 'block' }, { keyword: 'porn', level: 'block' },
  { keyword: '毒品', level: 'block' }, { keyword: '冰毒', level: 'block' }, { keyword: '海洛因', level: 'block' }, { keyword: '摇头丸', level: 'block' },
  { keyword: '赌博', level: 'block' }, { keyword: '博彩', level: 'block' }, { keyword: '六合彩', level: 'block' }, { keyword: '时时彩', level: 'block' },
  { keyword: '枪支', level: 'block' }, { keyword: '爆炸物', level: 'block' }, { keyword: '制毒', level: 'block' }, { keyword: '洗钱', level: 'block' },
  { keyword: '刷单', level: 'review' }, { keyword: '跑分', level: 'review' }, { keyword: '套现', level: 'review' }, { keyword: '代开发票', level: 'review' },
]

const DEFAULT_REGEX_RULES: SensitiveRegexConfig[] = [
  { keyword: '台独', regex: '台\\W*独', flags: 'i', level: 'block' },
  { keyword: '港独', regex: '港\\W*独', flags: 'i', level: 'block' },
  { keyword: '藏独', regex: '藏\\W*独', flags: 'i', level: 'block' },
  { keyword: '疆独', regex: '疆\\W*独', flags: 'i', level: 'block' },
  { keyword: '法轮功', regex: '法\\W*轮\\W*功', flags: 'i', level: 'block' },
  { keyword: '六四', regex: '六\\W*四', flags: 'i', level: 'block' },
  { keyword: '约炮', regex: '约\\W*炮', flags: 'i', level: 'block' },
  { keyword: '裸聊', regex: '裸\\W*聊', flags: 'i', level: 'block' },
  { keyword: 'porn', regex: 'p\\W*o\\W*r\\W*n', flags: 'i', level: 'block' },
  { keyword: '博彩', regex: '博\\W*彩', flags: 'i', level: 'block' },
  { keyword: '赌博', regex: '赌\\W*博', flags: 'i', level: 'block' },
  { keyword: '毒品', regex: '毒\\W*品', flags: 'i', level: 'block' },
  { keyword: '刷单', regex: '刷\\W*单', flags: 'i', level: 'review' },
  { keyword: '洗钱', regex: '洗\\W*钱', flags: 'i', level: 'block' },
]

const DEFAULT_ALLOWLIST = ['sourceImageUrl', 'baseImageUrl', 'qrUrl']
const CONFIG_PATH = path.resolve(process.cwd(), 'config', 'sensitive-words.json')
const AUDIT_LOG_PATH = path.resolve(process.cwd(), 'static', 'logs', 'sensitive-audit.log')
const RELOAD_INTERVAL_MS = 10_000

let cachedAt = 0
let cachedConfig: SensitiveConfigFile | null = null

function getConfig(): SensitiveConfigFile {
  const now = Date.now()
  if (cachedConfig && now - cachedAt < RELOAD_INTERVAL_MS) return cachedConfig
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8')
    cachedConfig = JSON.parse(raw) as SensitiveConfigFile
  } catch {
    cachedConfig = {}
  }
  cachedAt = now
  return cachedConfig
}

function normalizeText(input: string): string {
  return String(input || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s`~!@#$%^&*()_\-+=|\\{}[\]:;"'<>,.?/~！@#￥%……&*（）——+\-=\|、【】{}；：‘’“”《》？，。·]/g, '')
}

function toRuleLevel(level: unknown): SensitiveLevel {
  return level === 'review' ? 'review' : 'block'
}

function getAllowlistPaths() {
  const cfg = getConfig()
  return new Set<string>(Array.isArray(cfg.allowlistPaths) && cfg.allowlistPaths.length ? cfg.allowlistPaths : DEFAULT_ALLOWLIST)
}

function walkPayload(
  value: unknown,
  path: string,
  bucket: Array<{ field: string; text: string }>,
) {
  const allowlist = getAllowlistPaths()
  if (typeof value === 'string') {
    if (!allowlist.has(path)) {
      bucket.push({ field: path || 'root', text: value })
    }
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkPayload(item, `${path}[${index}]`, bucket))
    return
  }
  if (value && typeof value === 'object') {
    Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
      walkPayload(child, path ? `${path}.${key}` : key, bucket)
    })
  }
}

export function detectSensitiveHits(payload: unknown, maxHits = 5): SensitiveHit[] {
  const cfg = getConfig()
  const keywordRules = (Array.isArray(cfg.keywords) && cfg.keywords.length ? cfg.keywords : DEFAULT_KEYWORDS)
    .map((item) => ({ keyword: String(item.keyword || '').trim(), level: toRuleLevel(item.level) }))
    .filter((item) => item.keyword)
  const regexRules = (Array.isArray(cfg.regexRules) && cfg.regexRules.length ? cfg.regexRules : DEFAULT_REGEX_RULES)
    .map((item) => {
      const keyword = String(item.keyword || '').trim()
      const pattern = String(item.regex || '').trim()
      if (!keyword || !pattern) return null
      try {
        return { keyword, regex: new RegExp(pattern, item.flags || 'i'), level: toRuleLevel(item.level) }
      } catch {
        return null
      }
    })
    .filter(Boolean) as Array<{ keyword: string; regex: RegExp; level: SensitiveLevel }>

  const texts: Array<{ field: string; text: string }> = []
  walkPayload(payload, '', texts)
  const hits: SensitiveHit[] = []

  for (const item of texts) {
    if (hits.length >= maxHits) break
    const normalized = normalizeText(item.text)
    if (!normalized) continue

    for (const rule of keywordRules) {
      if (normalized.includes(normalizeText(rule.keyword))) {
        hits.push({ field: item.field, keyword: rule.keyword, level: rule.level, source: 'keyword' })
        break
      }
    }
    if (hits.length >= maxHits) break
    if (hits.some((hit) => hit.field === item.field)) continue

    for (const rule of regexRules) {
      if (rule.regex.test(item.text)) {
        hits.push({ field: item.field, keyword: rule.keyword, level: rule.level, source: 'regex' })
        break
      }
    }
  }

  return hits
}

export function summarizeHitPolicy(hits: SensitiveHit[]) {
  const blocked = hits.filter((item) => item.level === 'block')
  return {
    shouldBlock: blocked.length > 0,
    blocked,
    review: hits.filter((item) => item.level === 'review'),
  }
}

export function writeSensitiveAudit(entry: {
  route: string
  userId?: string | number | null
  ip?: string
  userAgent?: string
  hits: SensitiveHit[]
}) {
  try {
    const line = JSON.stringify({
      time: new Date().toISOString(),
      route: entry.route,
      userId: entry.userId ?? null,
      ip: entry.ip || '',
      ua: entry.userAgent || '',
      hits: entry.hits,
    })
    fs.mkdirSync(path.dirname(AUDIT_LOG_PATH), { recursive: true })
    fs.appendFileSync(AUDIT_LOG_PATH, `${line}\n`, 'utf-8')
  } catch {
    // swallow audit write errors to avoid impacting request chain
  }
}

