import { describe, expect, it } from 'vitest'
import { maxAudienceOptions, maxGoalOptions } from '../../content/max'
import { discoveryRules, vkGenderOptions, vkPhotoOptions, vkQuestions } from '../../content/vkVideo'
import { calculateThemeScores, rankThemes } from './logic'
import { createEventPublisher, type StelaEvent } from './events'

describe('answer event contract', () => {
  it('emits answer tags, except the explicitly removed photo-skip tag', () => {
    const events: StelaEvent[] = []
    const publisher = createEventPublisher('session-1', { send: event => events.push(event) })
    publisher.start('max')
    for (const option of maxAudienceOptions) publisher.answer('max', 'audience', option)
    for (const option of maxGoalOptions) publisher.answer('max', 'goal', option)
    for (const question of vkQuestions) {
      for (const option of question.options) publisher.answer('vk-video', question.id, option)
    }
    for (const option of vkPhotoOptions) publisher.answer('vk-video', 'photo', option)
    for (const option of vkGenderOptions) publisher.answer('vk-video', 'gender', option)

    const answers = events.filter(event => event.type === 'answer')
    expect(answers).toHaveLength(21)
    expect(answers.filter(event => !['skip', 'male', 'female'].includes(event.answerId)).every(event => event.metadata.length > 0)).toBe(true)
    expect(answers.map(event => event.sequence)).toEqual(Array.from({ length: 21 }, (_, index) => index + 2))
    expect(answers.find(event => event.answerId === 'learn')?.metadata).toEqual(['культура', 'обучение', 'культура', 'факты'])
    expect(answers.find(event => event.answerId === 'skip')?.metadata).toEqual([])
    expect(answers.find(event => event.answerId === 'male')?.metadata).toEqual([])
    expect(answers.find(event => event.answerId === 'female')?.metadata).toEqual([])
    expect(answers.find(event => event.answerId === 'business')?.metadata).toEqual(maxAudienceOptions[0].metadata)
  })

  it('passes the selected gender with a photo recommendation and no invented tags', () => {
    const events: StelaEvent[] = []
    const publisher = createEventPublisher('session-photo', { send: event => events.push(event) })
    publisher.answer('vk-video', 'photo', vkPhotoOptions[0])
    publisher.answer('vk-video', 'gender', vkGenderOptions[1])
    publisher.recommendation(calculateThemeScores(['series', 'drive']), rankThemes(['series', 'drive'], () => 0), 'hero', discoveryRules.hero, 'included', 'female')
    expect(events[1]).toMatchObject({ type: 'answer', questionId: 'gender', answerId: 'female', metadata: [] })
    expect(events[2]).toMatchObject({ type: 'vk-recommendation', photoMode: 'included', gender: 'female' })
  })

  it('sends score deltas and a separate recommendation snapshot', () => {
    const events: StelaEvent[] = []
    const publisher = createEventPublisher('session-2', { send: event => events.push(event) })
    publisher.start('vk-video')
    publisher.answer('vk-video', 'evening', vkQuestions[0].options[0], { Кино: 2, Музыка: 1 })
    publisher.answer('vk-video', 'ideal-content', vkQuestions[1].options[0], { 'Игры и авто': 2, Кино: 1 })
    const ranked = rankThemes(['series', 'drive'], () => 0)
    publisher.recommendation(calculateThemeScores(['series', 'drive']), ranked, 'familiar', discoveryRules.familiar, 'not-requested')
    const recommendation = events[3]
    expect(recommendation.type).toBe('vk-recommendation')
    if (recommendation.type !== 'vk-recommendation') return
    expect(recommendation.selectedThemes).toEqual(['Кино', 'Игры и авто', 'Музыка'])
    expect(recommendation.rankedThemes).toHaveLength(8)
    expect(recommendation.discoveryAnswerId).toBe('familiar')
    expect(recommendation.photoMode).toBe('not-requested')
  })

  it('can revoke a selected answer after Back without reusing its event identity', () => {
    const events: StelaEvent[] = []
    const publisher = createEventPublisher('session-3', { send: event => events.push(event) })
    publisher.answer('max', 'goal', maxGoalOptions[0])
    publisher.clear('max', 'goal')
    publisher.answer('max', 'goal', maxGoalOptions[1])
    expect(events.map(event => event.type)).toEqual(['answer', 'answer-cleared', 'answer'])
    expect(events.map(event => event.sequence)).toEqual([1, 2, 3])
  })
})
