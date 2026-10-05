import { vkCopy, vkPhotoOptions, vkQuestions } from '../../content/vkVideo'
import { maxAudienceOptions, maxGoalOptions, maxPrompts } from '../../content/max'
import type { Product } from '../../types/prototype'
import type { ScreenState } from './Prototype'

export interface TagReveal {
  source: ScreenState
  product: Product
  label: string
  description?: string
  prompt?: string
  answerCard?: { index: number; tone: 'blue' | 'red' | 'violet' | 'cyan'; artworkId?: string; photo?: boolean; centered?: boolean }
  batches: string[][]
  next: ScreenState
}

/** All unique scenario tags, in reading groups matching the approved four-pill composition. */
export function tagBatches(metadata: string[]): string[][] {
  const tags = [...new Set(metadata.filter(tag => tag.trim()))]
  return Array.from({ length: Math.ceil(tags.length / 4) }, (_, i) => tags.slice(i * 4, i * 4 + 4))
}

/** Shared ownership: a populated reveal is completed by LumiCells, never a competing timer. */
export function tagPresentation(screen: ScreenState): TagReveal | null {
  if (!('metadata' in screen)) return null
  const batches = tagBatches(screen.metadata)
  if (batches.length === 0) return null
  switch (screen.type) {
    case 'vk-answer-reveal':
      return { source: screen, product: 'vk-video', label: screen.label, batches, next: screen.next,
        prompt: vkQuestions[screen.questionIndex].prompt,
        answerCard: { index: screen.optionIndex, tone: 'blue', artworkId: vkQuestions[screen.questionIndex].options[screen.optionIndex].id } }
    case 'max-answer-reveal':
    {
      const audience = maxAudienceOptions.some(option => option.label === screen.label)
      const options = audience ? maxAudienceOptions : maxGoalOptions
      const index = options.findIndex(option => option.label === screen.label)
      return { source: screen, product: 'max', label: screen.label, batches, next: screen.next,
        prompt: audience ? maxPrompts.audience : maxPrompts.goal,
        answerCard: { index, tone: index % 2 ? 'cyan' : 'violet', artworkId: options[index]?.id, centered: !audience && index === 2 } }
    }
    case 'vk-photo-reveal':
      return { source: screen, product: 'vk-video', label: vkPhotoOptions.find(option => option.id === screen.answerId)!.label, batches, next: screen.next,
        prompt: vkCopy.digitizeQuestion, answerCard: { index: 0, tone: 'red', photo: true } }
    default: return null
  }
}
