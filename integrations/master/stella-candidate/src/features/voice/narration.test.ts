import { expect, it } from 'vitest'
import phrases from '../../../voice/vasilisa/phrases.json'
import { vkQuestions } from '../../content/vkVideo'
import { maxMissionLabels, maxPrompts } from '../../content/max'
import type { ScreenState } from '../prototype/Prototype'
import { narrationId, parseVoiceManifest } from './narration'

it('maps every meaningful state to an existing recording and preserves exact current question copy', () => {
  const samples: ScreenState[] = [
    { type: 'home' }, { type: 'vk-onboarding' }, { type: 'max-onboarding' },
    { type: 'max-audience' }, { type: 'max-goal', audience: 'business' },
    ...[0, 1, 2].map(index => ({ type: 'vk-question' as const, index, answers: [] })),
    { type: 'vk-digitize', answers: [], rankedThemes: [], discoveryAnswerId: 'hero' },
    { type: 'vk-gender', answers: [], rankedThemes: [] },
    { type: 'vk-camera', themes: [] }, { type: 'vk-scanning', themes: [] },
    { type: 'vk-particles', themes: [] }, { type: 'vk-final', themes: [] },
    { type: 'vk-discovery-activation', themes: [], metadata: [] },
    ...(['digital-id', 'communication', 'blogger', 'business-promotion'] as const).map(mission => ({ type: 'max-result' as const, mission })),
  ]
  const copy = new Map(phrases.phrases.map(phrase => [phrase.id, phrase.text]))
  expect(new Set(samples.map(sample => narrationId(sample)))).toEqual(new Set(copy.keys()))
  expect(copy.size).toBe(phrases.phrases.length)
  vkQuestions.forEach((question, index) => {
    expect(copy.get(narrationId({ type: 'vk-question', index, answers: [] })!)).toContain(question.prompt)
  })
  expect(copy.get('max-audience')).toContain(maxPrompts.audience)
  expect(copy.get('max-goal')).toContain(maxPrompts.goal)
  Object.entries(maxMissionLabels).forEach(([mission, label]) => {
    expect(copy.get(`max-result-${mission}`)).toContain(label.replaceAll('\n', ' '))
  })
})

it('suppresses brand splash and answer reveals instead of reading the old question again', () => {
  const next = { type: 'home' } as const
  expect(narrationId({ type: 'vk-onboarding' }, true)).toBeNull()
  expect(narrationId({ type: 'max-answer-reveal', label: '', metadata: [], next })).toBeNull()
  expect(narrationId({ type: 'vk-answer-reveal', questionIndex: 0, optionIndex: 0, label: '', metadata: [], next })).toBeNull()
  expect(narrationId({ type: 'vk-photo-reveal', answerId: 'accept', metadata: [], next })).toBeNull()
  expect(narrationId({ type: 'vk-question', index: 99, answers: [] })).toBeNull()
})

it('accepts only the expected voice manifest and local generated audio filenames', () => {
  expect(parseVoiceManifest({ version: 1, voice: 'other', ready: true, assets: {} })).toBeNull()
  expect(parseVoiceManifest({ version: 1, voice: 'Василиса', ready: true, assets: {
    home: 'home.wav', remote: 'https://example.org/other.wav', traversal: '../other.wav', wrong: 'page.html',
  } })?.assets).toEqual({ home: 'home.wav' })
  expect(parseVoiceManifest({ version: 1, voice: 'Василиса', ready: false, assets: {} })?.ready).toBe(false)
})
