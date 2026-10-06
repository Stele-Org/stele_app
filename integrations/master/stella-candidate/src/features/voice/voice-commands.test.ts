import { expect, it } from 'vitest'
import { maxAudienceOptions, maxGoalOptions } from '../../content/max'
import { vkQuestions } from '../../content/vkVideo'
import type { ScreenState } from '../prototype/Prototype'
import { readMicrophone } from './microphone'
import { matchVoiceCommand, voiceCommands } from './voice-commands'

const questions: [ScreenState, readonly { id: string; label: string }[]][] = [
  ...vkQuestions.map((question, index): [ScreenState, readonly { id: string; label: string }[]] =>
    [{ type: 'vk-question', index, answers: [] }, question.options]),
  [{ type: 'max-audience' }, maxAudienceOptions],
  [{ type: 'max-goal', audience: 'personal' }, maxGoalOptions],
]
const option = (id: string) => `[data-option-id="${id}"]`

it('turns the microphone on only by the address', () => {
  expect(readMicrophone('')).toBe('off')
  expect(readMicrophone('?mic=0')).toBe('off')
  expect(readMicrophone('?mic=yes')).toBe('off')
  expect(readMicrophone('?greeting=1&mic=1')).toBe('on')
  expect(readMicrophone('?mic=debug')).toBe('debug')
})

it('chooses an answer read aloud as it is written on its card, and by nothing another card says', () => {
  for (const [screen, options] of questions) {
    const commands = voiceCommands(screen)
    expect(commands.map(command => command.target)).toEqual(options.map(({ id }) => option(id)))
    for (const { id, label } of options) expect(matchVoiceCommand([label], commands), label).toBe(option(id))
  }
})

it('chooses an answer by a word of it or by its place', () => {
  const evening = voiceCommands({ type: 'vk-question', index: 0, answers: [] })
  expect(matchVoiceCommand(['давай стендап'], evening)).toBe(option('standup'))
  expect(matchVoiceCommand(['Что-нибудь смешное.'], evening)).toBe(option('standup'))
  expect(matchVoiceCommand(['документальный фильм'], evening)).toBe(option('science'))
  expect(matchVoiceCommand(['третий'], evening)).toBe(option('interview'))
  expect(matchVoiceCommand(['четвёртое'], evening)).toBe(option('science'))
  const goal = voiceCommands({ type: 'max-goal', audience: 'business' })
  expect(matchVoiceCommand(['вторая'], goal)).toBe(option('connection'))
  // Three answers: there is no fourth place.
  expect(matchVoiceCommand(['четвертый'], goal)).toBeNull()
})

it('chooses nothing when the phrase names no answer or names two', () => {
  const evening = voiceCommands({ type: 'vk-question', index: 0, answers: [] })
  expect(matchVoiceCommand(['даже не знаю'], evening)).toBeNull()
  expect(matchVoiceCommand(['сериал или стендап'], evening)).toBeNull()
  // «повторить» is not «второй».
  expect(matchVoiceCommand(['повторите вопрос'], evening)).toBeNull()
  expect(matchVoiceCommand([], evening)).toBeNull()
})

it('takes the likeliest reading that names an answer', () => {
  const evening = voiceCommands({ type: 'vk-question', index: 0, answers: [] })
  expect(matchVoiceCommand(['сэр и ал', 'сериал'], evening)).toBe(option('series'))
  // The likeliest reading names two answers: the less likely ones are not asked.
  expect(matchVoiceCommand(['сериал и интервью', 'сериал'], evening)).toBeNull()
})

it('starts a product by its name and the scenario by any word for «начинаем»', () => {
  const home = voiceCommands({ type: 'home' })
  expect(matchVoiceCommand(['ВК Видео'], home)).toBe('.product-tag--vk-video')
  expect(matchVoiceCommand(['VK видео'], home)).toBe('.product-tag--vk-video')
  expect(matchVoiceCommand(['Макс'], home)).toBe('.product-tag--max')
  expect(matchVoiceCommand(['MAX'], home)).toBe('.product-tag--max')
  // «вк» is a whole word: «включи» does not choose VK Видео.
  expect(matchVoiceCommand(['включи что-нибудь'], home)).toBeNull()
  expect(matchVoiceCommand(['макс или видео'], home)).toBeNull()
  for (const screen of [{ type: 'vk-onboarding' }, { type: 'max-onboarding' }] satisfies ScreenState[]) {
    for (const phrase of ['Поехали!', 'начинаем', 'давай начнём', 'вперёд', 'ну давай']) {
      expect(matchVoiceCommand([phrase], voiceCommands(screen)), phrase).toBe('.onboarding-start')
    }
    expect(matchVoiceCommand(['подождите'], voiceCommands(screen))).toBeNull()
  }
})

it('has no commands where the voice asks nothing, and none on the consent to personal data', () => {
  const silent: ScreenState[] = [
    { type: 'vk-digitize', answers: [], rankedThemes: [], discoveryAnswerId: 'hero' },
    { type: 'vk-camera', themes: [] }, { type: 'vk-scanning', themes: [] }, { type: 'vk-photo-review', themes: [] },
    { type: 'vk-particles', themes: [] }, { type: 'vk-final', themes: [] }, { type: 'max-result', mission: 'blogger' },
    { type: 'vk-answer-reveal', questionIndex: 0, optionIndex: 0, label: '', metadata: [], next: { type: 'home' } },
  ]
  for (const screen of silent) expect(voiceCommands(screen), screen.type).toEqual([])
})
