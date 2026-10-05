import { vkQuestions } from '../../content/vkVideo'
import type { QuestionPresentation } from '../prototype/question-presentation'
import type { TagReveal } from '../prototype/tag-reveal'

const driveLabel = vkQuestions[1].options.find(option => option.id === 'drive')!.label

/** Approved screen wording for an existing answer ID; the server contract remains untouched. */
export function acceptedVkAnswerLabel(answerId: string | undefined, serverLabel: string): string {
  return answerId === 'drive' ? driveLabel : serverLabel
}

export function acceptedVkQuestion(question: QuestionPresentation | null): QuestionPresentation | null {
  if (!question || question.product !== 'vk-video') return question
  if (!question.options.some(option => option.id === 'drive' && option.label !== driveLabel)) return question
  return { ...question, options: question.options.map(option => {
    const label = acceptedVkAnswerLabel(option.id, option.label)
    return label === option.label ? option : { ...option, label }
  }) }
}

export function acceptedVkReveal(reveal: TagReveal | null): TagReveal | null {
  if (!reveal || reveal.product !== 'vk-video') return reveal
  const label = acceptedVkAnswerLabel(reveal.answerCard?.artworkId, reveal.label)
  return label === reveal.label ? reveal : { ...reveal, label }
}
