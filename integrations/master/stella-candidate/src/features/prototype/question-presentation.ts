import { maxAudienceOptions, maxGoalOptions, maxPrompts } from '../../content/max'
import { vkCopy, vkGenderOptions, vkPhotoOptions, vkQuestions } from '../../content/vkVideo'
import type { Product } from '../../types/prototype'
import type { ScreenState } from './Prototype'

export interface QuestionPresentation {
  id: string
  product: Product
  prompt: string
  description?: string
  layout: 'grid' | 'photo' | 'gender'
  options: { id: string; label: string }[]
  answering: boolean
  selectedIndex?: number
}

/** Presentation only; scenario transitions and scoring remain in Prototype. */
export function questionPresentation(screen: ScreenState): QuestionPresentation | null {
  if (screen.type === 'vk-question' || screen.type === 'vk-answer-reveal') {
    const question = vkQuestions[screen.type === 'vk-question' ? screen.index : screen.questionIndex]
    return { ...question, product: 'vk-video', layout: 'grid', answering: screen.type === 'vk-answer-reveal',
      selectedIndex: screen.type === 'vk-answer-reveal' ? screen.optionIndex : undefined }
  }
  if (screen.type === 'max-audience' || screen.type === 'max-goal' || screen.type === 'max-answer-reveal') {
    const audience = screen.type === 'max-audience' || (screen.type === 'max-answer-reveal' && screen.next.type === 'max-goal')
    const options = audience ? maxAudienceOptions : maxGoalOptions
    return { id: audience ? 'max-audience' : 'max-goal', product: 'max', layout: 'grid',
      prompt: audience ? maxPrompts.audience : maxPrompts.goal, options, answering: screen.type === 'max-answer-reveal',
      selectedIndex: screen.type === 'max-answer-reveal' ? options.findIndex(option => option.label === screen.label) : undefined }
  }
  if (screen.type === 'vk-digitize' || screen.type === 'vk-photo-reveal') {
    return { id: 'photo', product: 'vk-video', layout: 'photo', prompt: vkCopy.digitizeQuestion,
      options: vkPhotoOptions, answering: screen.type === 'vk-photo-reveal',
      selectedIndex: screen.type === 'vk-photo-reveal' ? vkPhotoOptions.findIndex(option => option.id === screen.answerId) : undefined }
  }
  if (screen.type === 'vk-gender') return { id: 'gender', product: 'vk-video', layout: 'gender', prompt: vkCopy.genderPrompt,
    options: vkGenderOptions, answering: false }
  return null
}
