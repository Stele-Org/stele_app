import { discoveryRules, vkCopy, vkPhotoOptions, vkQuestions } from '../../content/vkVideo'
import type { VkTheme } from '../../types/prototype'
import { calculateThemeScores } from './logic'
import { tagBatches } from './tag-reveal'

/** The photo of the visitor as the result knows it. `accepted`: a photo was taken and approved, `captureId` names it
 * in the photo storage. `unavailable`: the visitor agreed to a photo, but none was taken. `skipped`: the visitor
 * declined. `not-requested`: the scenario did not offer a photo. */
export type VkResultPhoto = { status: 'accepted'; captureId: string } | { status: 'unavailable' | 'skipped' | 'not-requested' }

/**
 * What the wall of VK Видео and the page behind the QR code are to show for one visitor (user request, 07.10.2026):
 * the answers with their tags, the themes with their points, the choice of Discovery and the photo.
 * The format is described for its readers in `ResultStorage/README.md` in the project root.
 */
export interface VkResult {
  schemaVersion: 1
  type: 'stella-vk-result'
  sessionId: string
  createdAt: string
  product: 'vk-video'
  answers: Array<{ questionId: string; question: string; answerId: string; answer: string; tags: string[] }>
  /** Every tag of the answers once, in the order the visitor met them. */
  tags: string[]
  /** All themes, the best first; themes with equal points stand in the order drawn for this visitor. */
  themes: Array<{ theme: VkTheme; score: number; rank: number; selected: boolean }>
  selectedThemes: VkTheme[]
  discovery: { answerId: string; rule: string }
  photo: VkResultPhoto
}

export interface VkResultChoices {
  sessionId: string
  /** The answers to the first two questions. */
  answers: string[]
  /** The answer to the third question. */
  discoveryAnswerId: string
  /** The ranking drawn for this visitor (`rankThemes`): the result repeats it instead of drawing ties again. */
  rankedThemes: VkTheme[]
}

/** Headings hold words together with non-breaking spaces and line breaks; a reader of the result gets plain text. */
const plain = (text: string) => text.replace(/\s+/g, ' ')
const tagsOf = (metadata: string[]) => tagBatches(metadata).flat()

export function buildVkResult({ sessionId, answers, discoveryAnswerId, rankedThemes }: VkResultChoices, photo: VkResultPhoto, createdAt: string): VkResult {
  const given = [...answers, discoveryAnswerId].map((answerId, index) => {
    const question = vkQuestions[index]
    const option = question?.options.find(({ id }) => id === answerId)
    if (!question || !option) throw new Error(`Unknown VK answer: ${answerId}`)
    return { questionId: question.id, question: plain(question.prompt), answerId, answer: option.label, tags: tagsOf(option.metadata) }
  })
  if (photo.status !== 'not-requested') {
    const option = vkPhotoOptions.find(({ id }) => id === (photo.status === 'skipped' ? 'skip' : 'accept'))!
    given.push({ questionId: 'photo', question: plain(vkCopy.digitizeQuestion), answerId: option.id, answer: option.label, tags: tagsOf(option.metadata) })
  }
  const scores = new Map(calculateThemeScores(answers).map(({ theme, score }) => [theme, score]))
  const selectedThemes = rankedThemes.slice(0, 3)
  return {
    schemaVersion: 1, type: 'stella-vk-result', sessionId, createdAt, product: 'vk-video',
    answers: given,
    tags: [...new Set(given.flatMap(answer => answer.tags))],
    themes: rankedThemes.map((theme, index) => ({ theme, score: scores.get(theme) ?? 0, rank: index + 1, selected: index < 3 })),
    selectedThemes,
    discovery: { answerId: discoveryAnswerId, rule: discoveryRules[discoveryAnswerId] },
    photo,
  }
}
