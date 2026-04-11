import type { PosterDesignPlan, PosterGenerateInput, PosterGenerateResult, PosterPalette } from '@/api/ai'
import type { TdWidgetData } from '@/store/design/widget'

export type SizePreset = { key: string; name: string; width: number; height: number }

export function getSizePresets(): SizePreset[]
export const layoutFamilies: readonly string[]
export function normalizeLayoutFamily(raw: string): string
export function buildPosterLayout(params: {
  input: PosterGenerateInput
  result: PosterGenerateResult & { designPlan?: PosterDesignPlan }
}): {
  page: Record<string, unknown>
  widgets: TdWidgetData[]
  meta?: { layoutFamily?: string; sizeProfile?: string }
}
export function replacePosterTexts(widgets: TdWidgetData[], input: PosterGenerateInput, result: PosterGenerateResult): TdWidgetData[]
export function applyPosterPalette(widgets: TdWidgetData[], palette: PosterPalette): TdWidgetData[]
export function replaceHeroImage(widgets: TdWidgetData[], imageUrl: string): TdWidgetData[]
export function getPosterGradient(palette: PosterPalette): string
