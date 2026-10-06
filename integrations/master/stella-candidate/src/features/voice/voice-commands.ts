import { maxAudienceOptions, maxGoalOptions } from '../../content/max'
import { vkQuestions } from '../../content/vkVideo'
import type { ScreenState } from '../prototype/Prototype'

/** What the visitor may say on a screen, and the button of that screen it presses. */
export interface VoiceCommand {
  /** CSS selector of the button. */
  target: string
  /** Beginnings of the words that name the button: lower case, «е» for «ё». */
  stems: string[]
  /** Whole words, for names too short to be a beginning: «вк» must not answer to «включи». */
  words?: string[]
}

// «Скажи, например, „поехали“»: any word that means «начинаем».
const start: VoiceCommand[] = [
  { target: '.onboarding-start', stems: ['поехал', 'нач', 'старт', 'погнал', 'вперед'], words: ['давай', 'давайте', 'готов', 'готова'] },
]

/** The words of each answer that no other answer of the same question has. */
const answers: Record<string, string[]> = {
  series: ['сериал', 'обсужда'],
  standup: ['стендап', 'смешн', 'юмор', 'комеди'],
  interview: ['интервью'],
  science: ['документал', 'научпоп', 'научн', 'наук'],
  drive: ['драйв'],
  heroes: ['захватыва'],
  learn: ['познавател'],
  rest: ['расслабл'],
  familiar: ['похож', 'любл'],
  new: ['нов', 'интерес'],
  hero: ['геро'],
  popular: ['увлеч', 'популярн', 'тренд'],
  business: ['бизнес'],
  personal: ['личн'],
  access: ['идентифик', 'упрост'],
  connection: ['связ'],
  visibility: ['узнаваем', 'повыс'],
}
// An answer may also be named by its place: «первый», «вторая», «третье».
const places = ['перв', 'втор', 'трет', 'четверт']

const options = (list: readonly { id: string }[]): VoiceCommand[] => list.map(({ id }, place) => ({
  target: `[data-option-id="${id}"]`, stems: [...answers[id] ?? [], ...places.slice(place, place + 1)],
}))

/**
 * The commands of a screen whose line asks the visitor for an answer; no commands, no microphone.
 * The photo step is absent on purpose: its «Начать» accepts the terms of personal data, and that takes a tap.
 * The start screen is absent too: the product is chosen by a tap, with the greeting or without it.
 */
export function voiceCommands(screen: ScreenState): VoiceCommand[] {
  switch (screen.type) {
    case 'vk-onboarding':
    case 'max-onboarding': return start
    case 'vk-question': return options(vkQuestions[screen.index]?.options ?? [])
    case 'max-audience': return options(maxAudienceOptions)
    case 'max-goal': return options(maxGoalOptions)
    default: return []
  }
}

const wordsOf = (speech: string) => speech.toLowerCase().replaceAll('ё', 'е').split(/[^a-zа-я0-9]+/).filter(Boolean)

/**
 * The button named by what was heard. `heard` holds the recogniser's readings of one phrase, the likeliest first.
 * A phrase that names two buttons names none: the visitor is asked nothing twice, they simply say it again or tap.
 */
export function matchVoiceCommand(heard: string[], commands: VoiceCommand[]): string | null {
  for (const speech of heard) {
    const words = wordsOf(speech)
    const named = commands.filter(command => words.some(word =>
      command.words?.includes(word) || command.stems.some(stem => word.startsWith(stem))))
    if (named.length === 1) return named[0].target
    if (named.length > 1) return null
  }
  return null
}
