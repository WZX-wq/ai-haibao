/*
 * @Author: ShawnPhang
 * @Date: 2022-01-08 09:43:37
 * @Description: 字体处理
 */

const nowVersion = '3'

export type TFontItemData = {
  id: number
  oid: string
  value: string
  preview: string
  alias: string
  url: string
  lang: string
}

const fontList: TFontItemData[] = []

const defaultFonts: TFontItemData[] = [
  { id: 1001, oid: 'builtin-1001', value: 'Noto Sans SC', preview: '', alias: '思源黑体', url: '', lang: 'zh' },
  { id: 1002, oid: 'builtin-1002', value: 'Noto Serif SC', preview: '', alias: '思源宋体', url: '', lang: 'zh' },
  { id: 1003, oid: 'builtin-1003', value: 'ZCOOL QingKe HuangYou', preview: '', alias: '站酷庆科黄油体', url: '', lang: 'zh' },
  { id: 1004, oid: 'builtin-1004', value: 'ZCOOL XiaoWei', preview: '', alias: '站酷小薇体', url: '', lang: 'zh' },
  { id: 1005, oid: 'builtin-1005', value: 'Ma Shan Zheng', preview: '', alias: '马善政毛笔体', url: '', lang: 'zh' },
  { id: 1006, oid: 'builtin-1006', value: 'Long Cang', preview: '', alias: '龙藏手写体', url: '', lang: 'zh' },
  { id: 1007, oid: 'builtin-1007', value: 'ZCOOL KuaiLe', preview: '', alias: '站酷快乐体', url: '', lang: 'zh' },
  { id: 1008, oid: 'builtin-1008', value: 'LXGW WenKai', preview: '', alias: '霞鹜文楷', url: '', lang: 'zh' },
  { id: 2001, oid: 'builtin-2001', value: 'Inter', preview: '', alias: 'Inter 几何无衬线', url: '', lang: 'en' },
  { id: 2002, oid: 'builtin-2002', value: 'Montserrat', preview: '', alias: 'Montserrat 品牌标题', url: '', lang: 'en' },
  { id: 2003, oid: 'builtin-2003', value: 'Roboto Condensed', preview: '', alias: 'Roboto Condensed 紧凑标题', url: '', lang: 'en' },
  { id: 2004, oid: 'builtin-2004', value: 'Oswald', preview: '', alias: 'Oswald 海报标题', url: '', lang: 'en' },
  { id: 2005, oid: 'builtin-2005', value: 'Playfair Display', preview: '', alias: 'Playfair Display 杂志衬线', url: '', lang: 'en' },
  { id: 2006, oid: 'builtin-2006', value: 'Bebas Neue', preview: '', alias: 'Bebas Neue 数字海报体', url: '', lang: 'en' },
]

export const useFontStore = {
  list: fontList,
  async init() {
    this.list = []
    if (localStorage.getItem('FONTS_VERSION') !== nowVersion) {
      localStorage.removeItem('FONTS')
    }

    const localFonts: TFontItemData[] = localStorage.getItem('FONTS')
      ? JSON.parse(localStorage.getItem('FONTS') || '[]')
      : []

    if (localFonts.length > 0) {
      this.list.push(...localFonts)
    }

    if (this.list.length === 0) {
      this.list.unshift(...defaultFonts)
      localStorage.setItem('FONTS', JSON.stringify(this.list))
      localStorage.setItem('FONTS_VERSION', nowVersion)
    }
  },
}
