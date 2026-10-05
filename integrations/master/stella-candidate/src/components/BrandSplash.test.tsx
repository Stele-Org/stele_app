import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BrandSplash } from './BrandSplash'
import { PRODUCT_ENTRY_MS } from '../features/prototype/product-entry'
import { ringSceneConfig, type RingPhase } from './ring-scene-config'

const phases: RingPhase[] = ['brand-entry', 'intro', 'question', 'photo', 'processing', 'result', 'terms']
describe('product entry presentation', () => {
  it.each(['max', 'vk-video'] as const)('shows only the original %s logo during the splash, with no answer hit-targets', product => {
    const html = renderToStaticMarkup(<BrandSplash product={product} playing onComplete={() => {}} />)
    expect(html).toContain('role="status"')
    expect(html).toContain(`animation-duration:${PRODUCT_ENTRY_MS}ms`)
    expect(html).not.toContain('<button')
    expect(html).not.toContain('onboarding-steps')
    expect(html).toContain(product === 'max' ? 'alt="MAX"' : 'alt="VK Видео"')
  })
  it.each(['max', 'vk-video'] as const)('keeps the %s tone through the scenario and preserves native mechanics', product => {
    const base = ringSceneConfig('entry')
    const selected = ringSceneConfig('brand-entry', product)
    expect(selected.color?.palette).not.toEqual(base.color?.palette)
    for (const phase of phases) {
      const config = ringSceneConfig(phase, product)
      expect(config.color?.palette).toEqual(selected.color?.palette)
      expect(config.background).toEqual(selected.background)
      expect(config.grid).toEqual(base.grid)
      expect(config.modes).toEqual(base.modes)
      expect(config.interaction).toEqual(base.interaction)
      expect(config.lift).toEqual(base.lift)
    }
  })
  it('separates the two products and restores the untouched neutral config on home', () => {
    const neutral = ringSceneConfig('entry')
    expect(ringSceneConfig('intro', 'max').color?.palette).not.toEqual(ringSceneConfig('intro', 'vk-video').color?.palette)
    expect(ringSceneConfig('entry')).toEqual(neutral)
  })
})
