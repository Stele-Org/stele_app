import { describe, expect, it } from 'vitest'
import { timedTransition } from './timed-transition'
import type { ScreenState } from './Prototype'

describe('October 3 supplied VK sequence', () => {
  it('shows metadata before the next question or photo choice', () => {
    const next: ScreenState = { type: 'vk-question', index: 1, answers: ['series'] }
    expect(timedTransition({ type: 'vk-answer-reveal', questionIndex: 1, optionIndex: 0, label: 'сериал', metadata: ['сериал'], next }))
      .toBeNull()
    expect(timedTransition({ type: 'vk-answer-reveal', questionIndex: 0, optionIndex: 0, label: 'сериал', metadata: ['сериал'], next })).toBeNull()
    const photo: ScreenState = { type: 'vk-camera', themes: ['Кино'] }
    expect(timedTransition({ type: 'vk-photo-reveal', answerId: 'accept', metadata: ['ракурс'], next: photo }))
      .toBeNull()
  })
  it('keeps the short skip cue and lets the visible Discovery animation own completion', () => {
    const next: ScreenState = { type: 'vk-discovery-activation', themes: ['Кино'], metadata: ['сериал'] }
    expect(timedTransition({ type: 'vk-photo-reveal', answerId: 'skip', metadata: [], next }))
      .toEqual({ duration: 650, next })
    expect(timedTransition(next)).toBeNull()
    expect(timedTransition({ ...next, metadata: [] })).toBeNull()
  })
  it('times only camera preparation; scan and generation wait for actual visual completion', () => {
    const camera = timedTransition({ type: 'vk-camera', themes: ['Кино', 'Спорт'] })!
    expect(camera.duration).toBe(1800)
    expect(camera.next).toEqual({ type: 'vk-scanning', themes: ['Кино', 'Спорт'] })
    expect(timedTransition(camera.next)).toBeNull()
    expect(timedTransition({ type: 'vk-particles', themes: ['Кино', 'Спорт'] })).toBeNull()
  })
  it('returns VK final to home in 20 seconds while keeping questions and MAX final untimed', () => {
    expect(timedTransition({ type: 'vk-final', themes: ['Кино'] })).toEqual({ duration: 20000, next: { type: 'home' } })
    expect(timedTransition({ type: 'home' })).toBeNull()
    expect(timedTransition({ type: 'vk-question', index: 0, answers: [] })).toBeNull()
    expect(timedTransition({ type: 'max-result', mission: 'business-promotion' })).toBeNull()
  })
})
