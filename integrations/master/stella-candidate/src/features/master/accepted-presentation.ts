import { vkQuestions } from '../../content/vkVideo'
import type { QuestionPresentation } from '../prototype/question-presentation'
import type { TagReveal } from '../prototype/tag-reveal'

// The second question: all four answers carry the wording approved on 06.10.2026.
const acceptedLabels = new Map<string, string>(vkQuestions[1].options.map(option => [option.id, option.label]))

/** Approved screen wording for an existing answer ID; the server contract remains untouched. */
export function acceptedVkAnswerLabel(answerId: string | undefined, serverLabel: string): string {
  return (answerId !== undefined && acceptedLabels.get(answerId)) || serverLabel
}

export function acceptedVkQuestion(question: QuestionPresentation | null): QuestionPresentation | null {
  if (!question || question.product !== 'vk-video') return question
  if (!question.options.some(option => acceptedVkAnswerLabel(option.id, option.label) !== option.label)) return question
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
