import { vkCopy, vkPhotoOptions, vkQuestions } from '../../content/vkVideo'
import type { QuestionPresentation } from '../prototype/question-presentation'
import type { TagReveal } from '../prototype/tag-reveal'

// The second question: all four answers carry the wording approved on 06.10.2026.
const acceptedLabels = new Map<string, string>(vkQuestions[1].options.map(option => [option.id, option.label]))

// A heading whose words the server sends unchanged takes the approved line breaks of the local one (non-breaking spaces).
const acceptedPrompts = new Map<string, string>(vkQuestions.map(question => [question.id, question.prompt]))
const plain = (text: string) => text.replace(/\s+/g, ' ')
function acceptedPrompt(questionId: string, serverPrompt: string): string {
  const prompt = acceptedPrompts.get(questionId)
  return prompt !== undefined && plain(prompt) === plain(serverPrompt) ? prompt : serverPrompt
}

/** Approved screen wording for an existing answer ID; the server contract remains untouched. */
export function acceptedVkAnswerLabel(answerId: string | undefined, serverLabel: string): string {
  return (answerId !== undefined && acceptedLabels.get(answerId)) || serverLabel
}

/** The photo step: the heading and the button approved on 06.10.2026, without the description line. */
function acceptedPhotoStep(question: QuestionPresentation): QuestionPresentation {
  const accept = vkPhotoOptions[0]
  const options = question.options.map(option => option.id === accept.id && option.label !== accept.label ? { ...option, label: accept.label } : option)
  if (question.prompt === vkCopy.digitizeQuestion && question.description === undefined
    && options.every((option, index) => option === question.options[index])) return question
  return { ...question, prompt: vkCopy.digitizeQuestion, description: undefined, options }
}

export function acceptedVkQuestion(question: QuestionPresentation | null): QuestionPresentation | null {
  if (!question || question.product !== 'vk-video') return question
  if (question.layout === 'photo') return acceptedPhotoStep(question)
  const prompt = acceptedPrompt(question.id, question.prompt)
  if (prompt === question.prompt && !question.options.some(option => acceptedVkAnswerLabel(option.id, option.label) !== option.label)) return question
  return { ...question, prompt, options: question.options.map(option => {
    const label = acceptedVkAnswerLabel(option.id, option.label)
    return label === option.label ? option : { ...option, label }
  }) }
}

export function acceptedVkReveal(reveal: TagReveal | null): TagReveal | null {
  if (!reveal || reveal.product !== 'vk-video') return reveal
  const label = acceptedVkAnswerLabel(reveal.answerCard?.artworkId, reveal.label)
  return label === reveal.label ? reveal : { ...reveal, label }
}
