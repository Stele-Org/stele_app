import { vkQuestions } from '../../content/vkVideo'
import type { ScreenState } from './Prototype'

export interface DiscoveryPreview {
  screen: ScreenState
  hold: boolean
}

/** Development-only entry points reuse the real processing screens and renderer. */
export function readDiscoveryPreview(search: string, development: boolean): DiscoveryPreview | null {
  if (!development) return null
  const query = new URLSearchParams(search)
  // ?reveal=<answer id> repeats the tag scene of one VK answer, e.g. ?reveal=series.
  const answer = query.get('reveal')
  for (const [questionIndex, question] of vkQuestions.entries()) {
    const optionIndex = question.options.findIndex(option => option.id === answer)
    if (optionIndex < 0) continue
    const option = question.options[optionIndex]
    return { hold: true, screen: { type: 'vk-answer-reveal', questionIndex, optionIndex, label: option.label, metadata: option.metadata,
      next: { type: 'vk-question', index: questionIndex, answers: [] } } }
  }
  const mode = query.get('discovery')
  if (mode === 'scan' || mode === 'sequence') {
    return { screen: { type: 'vk-scanning', themes: [] }, hold: mode === 'scan' }
  }
  if (mode === 'generation') {
    return { screen: { type: 'vk-particles', themes: [] }, hold: true }
  }
  return null
}
