import type { LumiCellsConfigInput } from 'lumicells/schema'

// The deep blue of the lit cells and the lighter blue of the single bright ones (user reference, 06.10.2026).
export const FIELD_BLUE = '#0020FF'
export const BRIGHT_DOT_BLUE = '#0040FF'

// Same pinned engine/DOM bindings; quiet field replaces the visible sphere for the new references.
export const ringHomeConfig: LumiCellsConfigInput = {
  extends: 'reference',
  transition: 0,
  scene: { center: [0, 0], zoom: 1 },
  grid: { sizing: 'count', count: 50, gap: 0.5, roundness: 0.3, softness: 0 },
  // The flow is the whole picture: large lit areas with wide soft edges that drift slowly, so the blue of the
  // field shades from full to almost none and the shading moves across the screen.
  modes: { sphere: { weight: 0 }, rain: { weight: 0 }, flow: { weight: 0.85, scale: 0.6, speed: 0.1, threshold: 0.55, softness: 0.5 } },
  animation: {
    brightness: 0.95, floor: 0.06, gamma: 1.2, flicker: { amount: 0.03 },
    // Single cells light up for a moment: the bright dots of another shade.
    sparkle: { amount: 0.8, rate: 0.004, duration: 1.6 },
    sparsity: { amount: 0.12 },
  },
  color: {
    palette: [FIELD_BLUE, FIELD_BLUE, '#00BFFF', FIELD_BLUE],
    mapping: 'spatial',
    // The brightest cells stay saturated blue instead of turning pastel.
    hot: { amount: 0 },
    accent: { color: '#01FFFF' },
  },
  background: {
    // Black backdrop for every screen (user reference, 06.10.2026): the colour comes from the cells alone,
    // so the native light spots under the cell pass are off.
    color: '#000000',
    vignette: 0.85,
    spotA: { color: '#01FFFF', position: [-0.15, 0.45], radius: 1.15, strength: 0 },
    spotB: { color: '#00BFFF', position: [0, 0.4], radius: 1.7, strength: 0 },
  },
  glow: { halo: { strength: 0.04 }, bloom: { strength: 0.12 }, haze: { strength: 0 } },
  interaction: { pointer: false, click: false }, // The buttons emit one declarative pulse each.
  lift: { enabled: false, amount: 0 },
  render: { quality: 'high', maxDpr: 1, maxPixels: 3, reducedMotion: 'respect' },
}
