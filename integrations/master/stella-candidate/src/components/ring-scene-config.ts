import type { LumiCellsConfigInput } from 'lumicells/schema'
import { ringHomeConfig } from './ring-home-config'
import type { Product } from '../types/prototype'

export type RingPhase = 'entry' | 'brand-entry' | 'intro' | 'question' | 'photo' | 'processing' | 'result' | 'terms'

export function ringSceneConfig(phase: RingPhase, product: Product | null = null): LumiCellsConfigInput {
  const processing = phase === 'processing'
  return {
    ...ringHomeConfig,
    transition: 380,
    ...(product ? {
      color: {
        ...ringHomeConfig.color,
        palette: product === 'max' ? ['#471AFF', '#6E1AFF', '#9500FF', '#6E1AFF'] : ['#0077FF', '#0077FF', '#0077FF', '#0077FF'],
        accent: { color: product === 'max' ? '#9500FF' : '#0077FF' },
      },
      background: {
        ...ringHomeConfig.background,
        color: product === 'max' ? '#0D001A' : '#000032',
        spotA: { ...ringHomeConfig.background?.spotA, color: product === 'max' ? '#6E1AFF' : '#0040FF', strength: 0.07 },
        spotB: { ...ringHomeConfig.background?.spotB, strength: 0 },
      },
    } : {}),
    animation: { ...ringHomeConfig.animation, energy: processing ? 1.22 : phase === 'result' ? 1.08 : phase === 'terms' ? 0.75 : 1 },
    lift: { ...ringHomeConfig.lift },
  }
}
