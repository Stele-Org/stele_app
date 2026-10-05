import { describe, expect, it } from 'vitest'
import { readDiscoveryPreview } from './discovery-preview'

describe('local Discovery preview entry', () => {
  it.each([
    ['scan', 'vk-scanning', true],
    ['generation', 'vk-particles', true],
    ['sequence', 'vk-scanning', false],
  ] as const)('opens %s with its authored stage and completion policy', (mode, type, hold) => {
    expect(readDiscoveryPreview(`?discovery=${mode}`, true)).toEqual({ screen: { type, themes: [] }, hold })
  })

  it('cannot replace production entry, even with a recognized query', () => {
    expect(readDiscoveryPreview('?discovery=scan', false)).toBeNull()
    expect(readDiscoveryPreview('?discovery=generation', false)).toBeNull()
    expect(readDiscoveryPreview('?discovery=sequence', false)).toBeNull()
  })

  it('opens a held tag scene for one VK answer', () => {
    expect(readDiscoveryPreview('?reveal=series', true)).toEqual({ hold: true, screen: {
      type: 'vk-answer-reveal', questionIndex: 0, optionIndex: 0, label: 'Новый сериал, который все обсуждают',
      metadata: ['обсуждения', 'сериал', 'премьера', 'популярное'], next: { type: 'vk-question', index: 0, answers: [] },
    } })
    expect(readDiscoveryPreview('?reveal=hero', true)?.screen).toMatchObject({ type: 'vk-answer-reveal', questionIndex: 2 })
    expect(readDiscoveryPreview('?reveal=series', false)).toBeNull()
    expect(readDiscoveryPreview('?reveal=unknown', true)).toBeNull()
  })

  it('preserves normal entry for missing, unrelated or unsupported queries', () => {
    expect(readDiscoveryPreview('', true)).toBeNull()
    expect(readDiscoveryPreview('?screen=scan', true)).toBeNull()
    expect(readDiscoveryPreview('?discovery=unknown', true)).toBeNull()
  })
})
