import { describe, expect, it } from 'vitest'
import { answerCardPosition } from './answer-card-layout'

describe('shared question/reveal card geometry', () => {
  it.each(['vk-video', 'max'] as const)('keeps the %s right column aligned across both rows without clipping', product => {
    const upper = answerCardPosition({ slot: 1, product, layout: 'grid', choiceCount: 4 })
    const lower = answerCardPosition({ slot: 3, product, layout: 'grid', choiceCount: 4 })
    expect(upper.left).toBe(558.5)
    expect(lower.left).toBe(upper.left)
    expect(lower.top - (upper.top + upper.height)).toBe(40)
    expect(upper.left + upper.width).toBeLessThan(1080)
    expect(lower.top + lower.height).toBeLessThan(1280)
  })

  it('centers the third MAX choice while preserving the two upper positions', () => {
    const centered = answerCardPosition({ slot: 2, product: 'max', layout: 'grid', choiceCount: 3 })
    expect(centered.left + centered.width / 2).toBe(540)
    expect(centered.top).toBe(869)
    for (const slot of [0, 1]) {
      expect(answerCardPosition({ slot, product: 'max', layout: 'grid', choiceCount: 3 }))
        .toEqual(answerCardPosition({ slot, product: 'max', layout: 'grid', choiceCount: 4 }))
    }
  })

  it('preserves the authored VK/MAX widths without moving their matching anchors', () => {
    const vk = answerCardPosition({ slot: 0, product: 'vk-video', layout: 'grid', choiceCount: 4 })
    const max = answerCardPosition({ slot: 0, product: 'max', layout: 'grid', choiceCount: 2 })
    expect(vk).toEqual({ left: 45.27, top: 549, width: 468, height: 280 })
    expect(max).toEqual({ ...vk, width: 465 })
  })

  it('centers both photo choices and keeps a 40px gap between their different sizes', () => {
    const accept = answerCardPosition({ slot: 0, product: 'vk-video', layout: 'photo', choiceCount: 2 })
    const skip = answerCardPosition({ slot: 1, product: 'vk-video', layout: 'photo', choiceCount: 2 })
    expect(accept.left + accept.width / 2).toBe(540)
    expect(skip.left + skip.width / 2).toBeCloseTo(540)
    expect(accept).toMatchObject({ top: 750, width: 415, height: 140 })
    expect(skip).toMatchObject({ top: 930, width: 358.32, height: 120 })
    expect(skip.top - (accept.top + accept.height)).toBe(40)
  })

  it('keeps gender choices centered as a pair with a 40px horizontal gap', () => {
    const male = answerCardPosition({ slot: 0, product: 'vk-video', layout: 'gender', choiceCount: 2 })
    const female = answerCardPosition({ slot: 1, product: 'vk-video', layout: 'gender', choiceCount: 2 })
    expect(female.top).toBe(male.top)
    expect(female.left - (male.left + male.width)).toBe(40)
    expect((male.left + female.left + female.width) / 2).toBe(540)
    expect(male).toMatchObject({ top: 620, width: 380, height: 240 })
  })
})
