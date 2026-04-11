type TGradientStop = {
  offset: number
  color: string
}

type TTextEffectLayer = {
  filling: {
    enable: boolean
    type: number
    color: string
    gradient?: {
      angle: number
      stops: TGradientStop[]
    }
  }
  stroke: {
    enable: boolean
    width: number
    color: string
    type: string
  }
  shadow: {
    enable: boolean
    color: string
    offsetX: number
    offsetY: number
    blur: number
    opacity: number
  }
  offset: {
    enable: boolean
    x: number
    y: number
  }
}

export type TTextEffectPreset = {
  id: number
  title: string
  cover: string
  layers: TTextEffectLayer[]
}

const createSvgCover = (title: string, subtitle: string, background: string, accent: string, text = '促销标题') => {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 135">
    <rect width="240" height="135" rx="22" fill="${background}" />
    <circle cx="186" cy="44" r="24" fill="${accent}" opacity="0.14" />
    <rect x="18" y="18" width="204" height="99" rx="18" fill="#ffffff" opacity="0.55" />
    <text x="28" y="40" font-size="13" font-weight="700" fill="${accent}" font-family="Arial, sans-serif">${title}</text>
    <text x="28" y="82" font-size="34" font-weight="900" fill="${accent}" font-family="Arial, sans-serif">${text}</text>
    <text x="28" y="106" font-size="11" fill="#475569" font-family="Arial, sans-serif">${subtitle}</text>
  </svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const solid = (color: string) => ({ enable: true, type: 0, color })
const gradient = (angle: number, colors: string[]) => ({
  enable: true,
  type: 2,
  color: colors[0],
  gradient: {
    angle,
    stops: colors.map((color, index) => ({
      color,
      offset: colors.length === 1 ? 0 : index / (colors.length - 1),
    })),
  },
})
const emptyFill = () => ({ enable: false, type: 0, color: '#000000ff' })
const stroke = (width: number, color: string, enabled = true) => ({ enable: enabled, width, color, type: 'outer' })
const shadow = (color: string, blur: number, offsetX: number, offsetY: number, enabled = true) => ({
  enable: enabled,
  color,
  blur,
  offsetX,
  offsetY,
  opacity: 1,
})
const offset = (x: number, y: number, enabled = true) => ({ enable: enabled, x, y })

const layer = (options: Partial<TTextEffectLayer>): TTextEffectLayer => ({
  filling: emptyFill(),
  stroke: stroke(0, '#00000000', false),
  shadow: shadow('#00000000', 0, 0, 0, false),
  offset: offset(0, 0, false),
  ...options,
})

export const textEffectPresets: TTextEffectPreset[] = [
  {
    id: 101,
    title: '电商爆款描边',
    cover: createSvgCover('电商主标题', '高对比描边 / 爆款感', '#fff7ed', '#f97316', '爆款直降'),
    layers: [
      layer({ filling: solid('#fff7ed'), stroke: stroke(12, '#7c2d12'), offset: offset(5, 5) }),
      layer({ filling: solid('#f97316') }),
    ],
  },
  {
    id: 102,
    title: '电商立体价签',
    cover: createSvgCover('价格标签', '偏移立体 / 强引导', '#fff1f2', '#ef4444', '限时半价'),
    layers: [
      layer({ filling: solid('#7f1d1d'), offset: offset(7, 7) }),
      layer({ filling: solid('#fef2f2'), stroke: stroke(8, '#ef4444') }),
      layer({ filling: solid('#ef4444') }),
    ],
  },
  {
    id: 103,
    title: '撞色海报标题',
    cover: createSvgCover('活动海报', '撞色描边 / 适合主标题', '#eff6ff', '#2563eb', '报名开启'),
    layers: [
      layer({ filling: solid('#fde047'), offset: offset(-4, -4) }),
      layer({ filling: solid('#2563eb'), stroke: stroke(4, '#ffffff') }),
    ],
  },
  {
    id: 104,
    title: '渐变发光字',
    cover: createSvgCover('电商活动', '渐变填充 / 轻发光', '#faf5ff', '#8b5cf6', '今日上新'),
    layers: [
      layer({ filling: gradient(90, ['#f472b6', '#8b5cf6']), shadow: shadow('rgba(139,92,246,0.45)', 18, 0, 0) }),
    ],
  },
  {
    id: 105,
    title: '厚投影标题',
    cover: createSvgCover('招聘信息', '厚阴影 / 信息感强', '#f8fafc', '#0f172a', '热招岗位'),
    layers: [
      layer({ filling: solid('#94a3b8'), offset: offset(8, 8) }),
      layer({ filling: solid('#0f172a') }),
    ],
  },
  {
    id: 106,
    title: '商务科技蓝边',
    cover: createSvgCover('科技商务', '蓝描边 / 更专业', '#eff6ff', '#2563eb', '企业招募'),
    layers: [
      layer({ filling: solid('#ffffff'), stroke: stroke(8, '#2563eb'), shadow: shadow('rgba(37,99,235,0.18)', 10, 0, 4) }),
      layer({ filling: solid('#1d4ed8') }),
    ],
  },
  {
    id: 107,
    title: '暖色食欲标题',
    cover: createSvgCover('餐饮推荐', '暖渐变 / 食欲氛围', '#fffbeb', '#d97706', '招牌必点'),
    layers: [
      layer({ filling: gradient(0, ['#f97316', '#facc15']), shadow: shadow('rgba(251,146,60,0.32)', 16, 0, 6) }),
    ],
  },
  {
    id: 108,
    title: '节庆金边祝福',
    cover: createSvgCover('节日祝福', '金边描边 / 喜庆感', '#fff7ed', '#b45309', '节日快乐'),
    layers: [
      layer({ filling: solid('#7c2d12'), offset: offset(5, 5) }),
      layer({ filling: solid('#fef3c7'), stroke: stroke(6, '#b45309') }),
    ],
  },
  {
    id: 109,
    title: '复古招牌字',
    cover: createSvgCover('门店招牌', '复古阴影 / 招牌风格', '#fef2f2', '#9a3412', '深夜营业'),
    layers: [
      layer({ filling: solid('#7f1d1d'), shadow: shadow('rgba(127,29,29,0.35)', 0, 6, 6) }),
      layer({ filling: solid('#fed7aa'), stroke: stroke(5, '#9a3412') }),
    ],
  },
  {
    id: 110,
    title: '奶油描边封面字',
    cover: createSvgCover('小红书封面', '奶油描边 / 软糯氛围', '#fdf2f8', '#ec4899', '今日种草'),
    layers: [
      layer({ filling: solid('#ffffff'), stroke: stroke(10, '#f9a8d4') }),
      layer({ filling: solid('#db2777') }),
    ],
  },
  {
    id: 111,
    title: '胶片感标题',
    cover: createSvgCover('氛围封面', '胶片紫调 / 轻文艺', '#f5f3ff', '#7c3aed', '通勤穿搭'),
    layers: [
      layer({ filling: solid('#c4b5fd'), offset: offset(4, 4) }),
      layer({ filling: gradient(120, ['#7c3aed', '#a855f7', '#f472b6']) }),
    ],
  },
  {
    id: 112,
    title: '清单标签字',
    cover: createSvgCover('清单主标题', '标签块 + 投影', '#ecfeff', '#0891b2', '自用好物'),
    layers: [
      layer({ filling: solid('#083344'), offset: offset(6, 6) }),
      layer({ filling: solid('#ffffff'), stroke: stroke(7, '#67e8f9') }),
      layer({ filling: solid('#0891b2') }),
    ],
  },
]

export const textEffectPresetMap = textEffectPresets.reduce<Record<number, TTextEffectPreset>>((result, item) => {
  result[item.id] = item
  return result
}, {})
