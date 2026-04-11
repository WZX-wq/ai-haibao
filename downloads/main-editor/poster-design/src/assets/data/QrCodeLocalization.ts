export type QrCodeLocalizationData = {
  dotColorTypes: {
    key: string
    value: string
  }[]
  dotTypes: {
    key: string
    value: string
  }[]
}

export default {
  dotColorTypes: [
    {
      key: 'single',
      value: '单色',
    },
    {
      key: 'gradient',
      value: '渐变色',
    },
  ],
  dotTypes: [
    {
      key: 'dots',
      value: '圆点',
    },
    {
      key: 'rounded',
      value: '圆润',
    },
    {
      key: 'classy',
      value: '经典',
    },
    {
      key: 'classy-rounded',
      value: '圆角经典',
    },
    {
      key: 'square',
      value: '方形',
    },
    {
      key: 'extra-rounded',
      value: '特别圆润',
    },
  ],
} as QrCodeLocalizationData
