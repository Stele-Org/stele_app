import type { LumiCellsConfigInput } from 'lumicells/schema'
import { packCubesArt } from '../vendor/cubes-art.js'
import originalArt from '../vendor/cubes-art.json'

/** Logical pitch on the 1080px Stella canvas. */
export const whiteEntityPitch = 60
export const whiteEntityConfig: LumiCellsConfigInput = {
  extends: 'pulse', transition: 0,
  grid: { sizing: 'count', count: 18, gap: 0.2, roundness: 1, softness: 0, bevel: 0, emitter: 0 },
  animation: { speed: 1, brightness: 1, floor: 0, sparkle: { amount: 0 } },
  color: { palette: ['#FFFFFF', '#FFFFFF'], hot: { amount: 0 }, accent: { color: '#FFFFFF', amount: 0 } },
  background: { color: '#000000', vignette: 0, spotA: { strength: 0 }, spotB: { strength: 0 } },
  glow: { halo: { strength: 0 }, bloom: { strength: 0 }, haze: { strength: 0 } },
  interaction: { pointer: false, click: false },
  lift: { enabled: false, amount: 0 },
  render: { quality: 'high', maxDpr: 1, maxPixels: 3, reducedMotion: 'ignore' },
}

// Existing CUBES field: occupancy gives connected holes; per-cell variation spreads sizes.
// Distribution at moving edges still needs actual-GPU and visual acceptance.
export const whiteEntityArtDocument = {
  ...originalArt,
  mask: {
    ...originalArt.mask,
    broad: { ...originalArt.mask.broad, scale: 0.4, speed: 0.075 },
    medium: { ...originalArt.mask.medium, scale: 0.24, speed: 0.12 },
    small: { ...originalArt.mask.small, scale: 0.16 },
    fine: { ...originalArt.mask.fine, scale: 0.08 },
    detail: { ...originalArt.mask.detail, scale: 0.38, speed: 0.18 },
    mix: { bias: 0.48, broad: 0.7, medium: 0.5, small: 0.2, fine: 0.1, detail: 0, tile: 0 },
    transfer: { cap: 0.9, noiseLow: 0.42, noiseHigh: 0.5, rampLow: 0.45, rampHigh: 0.92, crestLow: 0.94, crestHigh: 0.99 },
    variation: { base: 0.5, detail: 0.06, tile: 0.96, min: 0, max: 1 },
    geometry: { ...originalArt.mask.geometry, sizeGain: 0.8 / 0.9, maxSize: 0.8, springSize: 0, liftBase: 0, liftSpring: 0 },
  },
}
export const whiteEntityArt = packCubesArt(whiteEntityArtDocument)
