import { StyleValue } from 'vue'

export type TWidgetClassifyData = {
  name: string
  icon: string
  iconType?: 'custom-home'
  show: boolean
  component: string
  style?: StyleValue
}

export default [
  {
    name: '\u9996\u9875',
    icon: 'icon-zujian01',
    iconType: 'custom-home',
    show: false,
    component: 'welcome-page',
  },
  {
    name: 'AI\u6d77\u62a5',
    icon: 'icon-zujian01',
    show: false,
    component: 'ai-poster-wrap',
  },
  {
    name: '\u6a21\u677f',
    icon: 'icon-moban',
    show: false,
    component: 'temp-list-wrap',
  },
  {
    name: '\u7d20\u6750',
    icon: 'icon-sucai',
    show: false,
    component: 'graph-list-wrap',
  },
  {
    name: '\u6587\u5b57',
    icon: 'icon-wenzi',
    show: false,
    style: { fontWeight: 600 },
    component: 'text-list-wrap',
  },
  {
    name: '\u7167\u7247',
    icon: 'icon-gallery',
    show: false,
    component: 'photo-list-wrap',
  },
  {
    name: '\u5de5\u5177\u7bb1',
    icon: 'icon-zujian01',
    show: false,
    component: 'tools-list-wrap',
  },
  {
    name: '\u6211\u7684',
    icon: 'icon-shangchuan',
    show: false,
    component: 'user-wrap',
  },
] as TWidgetClassifyData[]
