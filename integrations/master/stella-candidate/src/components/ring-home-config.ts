import type { LumiCellsConfigInput } from 'lumicells/schema'

// Same pinned engine/DOM bindings; quiet field replaces the visible sphere for the new references.
export const ringHomeConfig: LumiCellsConfigInput = {
  extends: 'reference',
  transition: 0,
  scene: { center: [0, 0], zoom: 1 },
  grid: { sizing: 'count', count: 50, gap: 0.5, roundness: 0.3, softness: 0 },
  modes: { sphere: { weight: 0 }, rain: { weight: 0 }, flow: { weight: 0.15, scale: 0.6, speed: 0.08, threshold: 0.4, softness: 0.5 } },
  animation: { brightness: 0.65, floor: 0.035, gamma: 1.2, flicker: { amount: 0.03 }, sparkle: { amount: 0 }, sparsity: { amount: 0.12 } },
  color: {
    palette: ['#0077FF', '#0077FF', '#00BFFF', '#0077FF'],
    mapping: 'spatial',
    accent: { color: '#01FFFF' },
  },
  background: {
    color: '#02032F',
    vignette: 0.85,
    // Native background under the cell pass; keep its light contribution subdued.
    spotA: { color: '#01FFFF', position: [-0.15, 0.45], radius: 1.15, strength: 0.045 },
    spotB: { color: '#00BFFF', position: [0, 0.4], radius: 1.7, strength: 0 },
  },
  glow: { halo: { strength: 0.04 }, bloom: { strength: 0.12 }, haze: { strength: 0 } },
  interaction: { pointer: false, click: false }, // The buttons emit one declarative pulse each.
  lift: { enabled: false, amount: 0 },
  render: { quality: 'high', maxDpr: 1, maxPixels: 3, reducedMotion: 'respect' },
}
