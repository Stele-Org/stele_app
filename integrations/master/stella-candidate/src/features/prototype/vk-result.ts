import { vkGenres, type VkGenre } from '../../content/vkGenres'
import { discoveryRules, vkCopy, vkPhotoOptions, vkQuestions } from '../../content/vkVideo'
import type { VkTheme } from '../../types/prototype'
import { calculateGenreScores, calculateThemeScores, rankGenres } from './logic'
import { planCovers } from './cover-plan'
import { tagBatches } from './tag-reveal'

/** The photo of the visitor as the result knows it. `accepted`: a photo was taken and approved, `captureId` names it
 * in the photo storage. `unavailable`: the visitor agreed to a photo, but none was taken. `skipped`: the visitor
 * declined. `not-requested`: the scenario did not offer a photo. */
export type VkResultPhoto = { status: 'accepted'; captureId: string } | { status: 'unavailable' | 'skipped' | 'not-requested' }

/**
 * What the wall of VK Видео and the page behind the QR code are to show for one visitor (user request, 07.10.2026).
 * One form for every answer: the six covers stand first — by themes in `covers`, with the visitor's image by genres
 * in `aiCover` — then the tags, the answers, and how the themes and the genres scored.
 * The format is described for its readers in `ResultStorage/README.md` in the project root.
 */
export interface VkResult {
  /** The covers by themes: which themes, the best first, and how many covers for each (`cover-plan.ts`). */
  covers: Array<{ theme: VkTheme; count: number }>
  /** The AI covers with the visitor's image: which genres, the best first, and how many for each. `theme` is the
   * video theme the genre stands for. Empty unless the visitor chose «Хочу стать героем VK Видео» and approved a photo. */
  aiCover: Array<{ genre: VkGenre; count: number; title: string; recipeId: string; theme: VkTheme }>
  /** Covers in all, `covers` and `aiCover` together: always six. */
  coversTotal: number
  /** Every tag of the answers once, in the order the visitor met them. */
  tags: string[]
  answers: Array<{ questionId: string; question: string; answerId: string; answer: string; tags: string[] }>
  /** How the themes scored: all eight, the best first; themes with equal points stand in the order drawn for this visitor. */
  themes: Array<{ theme: VkTheme; covers: number; score: number; rank: number }>
  /** How the genres scored, all ten, the best first: only where there are AI covers, empty otherwise. */
  genres: Array<{ genre: VkGenre; covers: number; score: number; rank: number; title: string; recipeId: string; theme: VkTheme }>
  /** The answer to the third question and its rule in the client's words. */
  discovery: { answerId: string; rule: string }
  photo: VkResultPhoto
  schemaVersion: 1
  type: 'stella-vk-result'
  product: 'vk-video'
  sessionId: string
  createdAt: string
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

/** `random` settles genres with equal points for the AI covers; the result is built once for a visitor, so it is drawn once. */
export function buildVkResult({ sessionId, answers, discoveryAnswerId, rankedThemes }: VkResultChoices, photo: VkResultPhoto, createdAt: string,
  random: () => number = Math.random): VkResult {
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
  // An AI cover carries the visitor's image, so it takes both the answer of the hero and an approved photo.
  // A hero without a photo gets plain recommendations, six covers by themes, like every other visitor (user, 08.10.2026).
  const withAiCovers = discoveryAnswerId === 'hero' && photo.status === 'accepted'
  const rankedGenres = withAiCovers ? rankGenres(answers, random) : []
  const plan = planCovers(rankedThemes, rankedGenres, withAiCovers)
  const genre = (id: VkGenre) => { const { title, recipeId, theme } = vkGenres.find(item => item.id === id)!; return { title, recipeId, theme } }
  const themeScores = new Map(calculateThemeScores(answers).map(({ theme, score }) => [theme, score]))
  const genreScores = new Map(calculateGenreScores(answers).map(item => [item.genre, item.score]))
  const aiCover = plan.aiCover.map(item => ({ ...item, ...genre(item.genre) }))
  // The order of the keys is the order of the file.
  return {
    covers: plan.themes,
    aiCover,
    coversTotal: [...plan.themes, ...plan.aiCover].reduce((total, item) => total + item.count, 0),
    tags: [...new Set(given.flatMap(answer => answer.tags))],
    answers: given,
    themes: rankedThemes.map((theme, index) => ({
      theme, covers: plan.themes.find(item => item.theme === theme)?.count ?? 0, score: themeScores.get(theme) ?? 0, rank: index + 1,
    })),
    genres: rankedGenres.map((id, index) => ({
      genre: id, covers: plan.aiCover.find(item => item.genre === id)?.count ?? 0, score: genreScores.get(id) ?? 0, rank: index + 1, ...genre(id),
    })),
    discovery: { answerId: discoveryAnswerId, rule: discoveryRules[discoveryAnswerId] },
    photo,
    schemaVersion: 1, type: 'stella-vk-result', product: 'vk-video', sessionId, createdAt,
  }
}
