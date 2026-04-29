import type { CutoutProviderMode } from '@/api/ai'

export type TImageCutoutState = {
  show: boolean
  rawImage: string
  cutImage: string
  offsetWidth: number
  percent: number
  progress: number
  progressText: string
  toolModel: boolean
  loading: boolean
  providerTip: string
  providerLabel: string
  providerMode: CutoutProviderMode
}
