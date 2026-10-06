import type { LumiCellsConfigInput } from 'lumicells/schema'
import { BRIGHT_DOT_BLUE, FIELD_BLUE, ringHomeConfig } from './ring-home-config'
import type { Product } from '../types/prototype'

export type RingPhase = 'entry' | 'brand-entry' | 'intro' | 'question' | 'photo' | 'processing' | 'result' | 'terms'

// VK Видео colours a cell by its brightness: the field keeps one deep blue, and only a cell at full brightness,
// which is a sparkle, reaches the last stop and takes the lighter blue.
const vkColor: LumiCellsConfigInput['color'] = {
  ...ringHomeConfig.color,
  palette: [...Array<string>(7).fill(FIELD_BLUE), BRIGHT_DOT_BLUE],
  mapping: 'intensity', scale: 1, warp: 0, jitter: 0, intensityShift: 0,
  accent: { color: BRIGHT_DOT_BLUE },
}
const maxColor: LumiCellsConfigInput['color'] = {
  ...ringHomeConfig.color,
  palette: ['#471AFF', '#6E1AFF', '#9500FF', '#6E1AFF'],
  accent: { color: '#9500FF' },
}

export function ringSceneConfig(phase: RingPhase, product: Product | null = null): LumiCellsConfigInput {
  const processing = phase === 'processing'
  return {
    ...ringHomeConfig,
    transition: 380,
    // The backdrop stays the black of the start screen: a product tints the cells, not the background.
    ...(product ? { color: product === 'max' ? maxColor : vkColor } : {}),
    animation: { ...ringHomeConfig.animation, energy: processing ? 1.22 : phase === 'result' ? 1.08 : phase === 'terms' ? 0.75 : 1 },
    lift: { ...ringHomeConfig.lift },
  }
}
