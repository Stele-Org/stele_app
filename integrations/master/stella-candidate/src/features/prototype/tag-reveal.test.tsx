import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AnswerFlight } from '../../components/AnswerFlight'
import { maxAudienceOptions, maxGoalOptions } from '../../content/max'
import { vkQuestions, vkPhotoOptions, vkGenderOptions } from '../../content/vkVideo'
import { tagBatches, tagPresentation } from './tag-reveal'
import { timedTransition } from './timed-transition'
import type { ScreenState } from './Prototype'

const next: ScreenState = { type: 'home' }
const vkCases = vkQuestions.flatMap((question, questionIndex) => question.options.map((option, optionIndex) => ({
  type: 'vk-answer-reveal' as const, questionIndex, optionIndex, label: option.label, metadata: option.metadata, next,
})))
const maxCases = [...maxAudienceOptions, ...maxGoalOptions].map(option => ({
  type: 'max-answer-reveal' as const, label: option.label, metadata: option.metadata, next,
}))

describe('one author motion path for every Stella metadata stage', () => {
  it.each([...vkCases, ...maxCases])('routes $type / $label with all its tags and no competing timer', screen => {
    const view = tagPresentation(screen)!
    expect(view.source).toBe(screen)
    expect(view.next).toBe(next)
    expect(view.product).toBe(screen.type === 'max-answer-reveal' ? 'max' : 'vk-video')
    expect(view.batches.flat()).toEqual([...new Set(screen.metadata)])
    expect(view.batches.every(group => group.length > 0 && group.length <= 4)).toBe(true)
    expect(view.answerCard).toBeDefined()
    expect(view.answerCard!.index).toBeGreaterThanOrEqual(0)
    expect(view.prompt).toBeTruthy()
    if (screen.type === 'vk-answer-reveal') {
      expect(view.answerCard!.index).toBe(screen.optionIndex)
      expect(view.answerCard!.artworkId).toBe(vkQuestions[screen.questionIndex].options[screen.optionIndex].id)
    }
    expect(timedTransition(screen)).toBeNull()
  })

  // The scenario itself shows no tags after the photo answer (Prototype.selectPhoto, all-transitions.test.tsx).
  it('can reveal photo tags when a screen carries them, keeps empty photo/gender choices empty', () => {
    for (const option of vkPhotoOptions) {
      const screen: ScreenState = { type: 'vk-photo-reveal', answerId: option.id, metadata: option.metadata, next }
      if (option.id === 'accept') {
        expect(tagPresentation(screen)?.batches.flat()).toEqual(option.metadata)
        expect(tagPresentation(screen)?.answerCard).toMatchObject({ photo: true, tone: 'red' })
        expect(timedTransition(screen)).toBeNull()
      } else {
        expect(tagPresentation(screen)).toBeNull()
        expect(timedTransition(screen)).toEqual({ duration: 650, next })
      }
    }
    expect(vkGenderOptions.every(option => option.metadata.length === 0)).toBe(true)
    expect(tagPresentation({ type: 'vk-gender', answers: [], rankedThemes: [] })).toBeNull()
  })

  it('never turns the neutral Discovery sequence into activation copy or tag flights', () => {
    const metadata = vkQuestions.flatMap(question => question.options[0].metadata)
    expect(tagPresentation({ type: 'vk-discovery-activation', metadata, themes: ['Кино', 'Музыка'] })).toBeNull()
    expect(tagPresentation({ type: 'vk-discovery-activation', metadata: [], themes: ['Кино'] })).toBeNull()
    expect(tagBatches(['', ' ', 'культура', 'культура'])).toEqual([['культура']])
  })

  it.each([vkCases[0], vkCases[4], maxCases[0]])('renders the correct brand and native scene for $type', screen => {
    const reveal = tagPresentation(screen)!
    const html = renderToStaticMarkup(<AnswerFlight reveal={reveal} playing onComplete={() => {}} />)
    expect(html).toContain('data-motion="lumicells-native-flight"')
    expect(html).toContain(`answer-flight--${reveal.product}`)
    expect(html).toContain(reveal.product === 'max' ? 'alt="MAX"' : 'alt="VK Видео"')
    expect(html.match(/class="lc-scene-bubble lc-scene-pill\b/g)).toHaveLength(reveal.batches[0].length)
    expect(html).toContain('aria-label="Выбранный ответ"')
    expect(html).toContain('answer-flight__answer')
    expect(html.indexOf('answer-flight__answer')).toBeLessThan(html.indexOf('class="lc-scene answer-flight__visuals"'))
    if (screen === vkCases[0]) expect(html).toContain('class="reference-card-artwork"')
    expect(html).not.toContain('<button')
  })

  it('embeds native tags without duplicating the persistent logo, heading or answer', () => {
    const view = tagPresentation(vkCases[0])!
    const html = renderToStaticMarkup(<AnswerFlight embedded reveal={view} playing onComplete={() => {}} />)
    expect(html).not.toContain('product-mark')
    expect(html).not.toContain('<h1')
    expect(html).not.toContain('answer-flight__answer')
    expect(html.match(/class="lc-scene-bubble lc-scene-pill\b/g)).toHaveLength(view.batches[0].length)
  })
})
