import type { ScreenState } from './Prototype'

export interface DiscoveryPreview {
  screen: ScreenState
  hold: boolean
}

/** Development-only entry points reuse the real processing screens and renderer. */
export function readDiscoveryPreview(search: string, development: boolean): DiscoveryPreview | null {
  if (!development) return null
  const mode = new URLSearchParams(search).get('discovery')
  if (mode === 'scan' || mode === 'sequence') {
    return { screen: { type: 'vk-scanning', themes: [] }, hold: mode === 'scan' }
  }
  if (mode === 'generation') {
    return { screen: { type: 'vk-particles', themes: [] }, hold: true }
  }
  return null
}
