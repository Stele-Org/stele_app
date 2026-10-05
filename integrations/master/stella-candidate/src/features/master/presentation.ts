import type { Snapshot } from './slice-client.mjs'
import type { QuestionPresentation } from '../prototype/question-presentation'
import type { TagReveal } from '../prototype/tag-reveal'
import { tagBatches } from '../prototype/tag-reveal'

export function questionFromSnapshot(snapshot: Snapshot): QuestionPresentation | null {
  const state = snapshot.session?.state, view = snapshot.session?.view
  if (state?.protocol !== 'stella-vk-v1' || !view || !['question', 'photochoice'].includes(state.screen)) return null
  if (state.screen === 'question' && !view.questionId) return null
  return { id: state.screen === 'photochoice' ? 'photo' : view.questionId!, product: 'vk-video', prompt: view.title,
    description: view.description, layout: state.screen === 'photochoice' ? 'photo' : 'grid', answering: false,
    options: view.options.map(({ id, label }) => ({ id, label })) }
}
export function revealFromSnapshot(snapshot: Snapshot): TagReveal | null {
  const state = snapshot.session?.state
  if (state?.protocol !== 'stella-vk-v1' || state.screen !== 'answer-reveal') return null
  const answer = state.answers?.[state.questionIndex ?? -1]
  if (!answer || !answer.metadata.length) return null
  // source/next are required by standalone renderer types; master never executes either.
  const visualGroups = [['series', 'standup', 'interview', 'science'], ['drive', 'heroes', 'learn', 'rest'], ['familiar', 'new', 'hero', 'popular']]
  const slot = Math.max(0, visualGroups.find(group => group.includes(answer.answerId))?.indexOf(answer.answerId) ?? 0)
  const source = { type: 'vk-answer-reveal' as const, questionIndex: state.questionIndex!, optionIndex: slot, label: answer.label,
    metadata: answer.metadata, next: { type: 'home' as const } }
  return { source, next: source.next, product: 'vk-video', label: answer.label,
    batches: tagBatches(answer.metadata), answerCard: { index: slot, tone: 'blue', artworkId: answer.answerId } }
}

export function resultPath(snapshot: Snapshot): string | null {
  const plan = snapshot.session?.state?.contentPlan
  return plan?.status === 'accepted' && plan.packageId && plan.resultPath === '/vkshare/result/' + encodeURIComponent(plan.packageId) ? plan.resultPath : null
}
