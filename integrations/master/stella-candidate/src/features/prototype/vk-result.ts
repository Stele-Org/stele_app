import { vkGenres, type VkGenre } from '../../content/vkGenres'
import { discoveryRules, vkCopy, vkPhotoOptions, vkQuestions } from '../../content/vkVideo'
import type { VkTheme } from '../../types/prototype'
import { calculateGenreScores, calculateThemeScores, rankGenres } from './logic'
import { tagBatches } from './tag-reveal'
import { planGenreVideos, planVideos } from './video-plan'

/** The photo of the visitor as the result knows it. `accepted`: a photo was taken and approved, `captureId` names it
 * in the photo storage. `unavailable`: the visitor agreed to a photo, but none was taken. `skipped`: the visitor
 * declined. `not-requested`: the scenario did not offer a photo. */
export type VkResultPhoto = { status: 'accepted'; captureId: string } | { status: 'unavailable' | 'skipped' | 'not-requested' }

/**
 * What the wall of VK Видео and the page behind the QR code are to show for one visitor (user request, 07.10.2026):
 * the themes with the number of videos for each, the genres of the covers for the hero, the tags, the answers,
 * the choice of Discovery and the photo.
 * The fields stand in the order the user asked to read them in: themes (and genres) first, then tags, then answers.
 * The format is described for its readers in `ResultStorage/README.md` in the project root.
 */
export interface VkResult {
  /** All themes, the best first, with the number of videos for each (`video-plan.ts`); themes with equal points
   * stand in the order drawn for this visitor. */
  themes: Array<{ theme: VkTheme; videos: number; score: number; rank: number; selected: boolean }>
  /** Only for «Хочу стать героем VK Видео»: all genres of the covers, the best first, with the number of videos
   * with such a cover; `theme` is the video theme the genre stands for. Empty for the other answers. */
  genres: Array<{ genre: VkGenre; videos: number; score: number; rank: number; selected: boolean; title: string; recipeId: string; theme: VkTheme }>
  /** Every tag of the answers once, in the order the visitor met them. */
  tags: string[]
  answers: Array<{ questionId: string; question: string; answerId: string; answer: string; tags: string[] }>
  /** Videos in all: by the themes above, from the whole catalogue by popularity (outside the themes), and with
   * covers of the visitor by the genres above. */
  videos: { themes: number; popular: number; genres: number; total: number }
  selectedThemes: VkTheme[]
  selectedGenres: VkGenre[]
  /** The answer to the third question, its rule in the client's words and the themes it gave one more video to. */
  discovery: { answerId: string; rule: string; extraThemes: VkTheme[] }
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
const sum = (items: Array<{ videos: number }>) => items.reduce((total, item) => total + item.videos, 0)

/** `random` settles genres with equal points for the hero; the result is built once for a visitor, so it is drawn once. */
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
  const scores = new Map(calculateThemeScores(answers).map(({ theme, score }) => [theme, score]))
  const plan = planVideos(rankedThemes, scores, discoveryAnswerId)
  const themes = rankedThemes.map((theme, index) =>
    ({ theme, videos: plan.videos.get(theme) ?? 0, score: scores.get(theme) ?? 0, rank: index + 1, selected: index < 3 }))
  // The genres of the covers concern the hero alone: for the other answers there are no covers to plan.
  const rankedGenres = discoveryAnswerId === 'hero' ? rankGenres(answers, random) : []
  const genreScores = new Map(calculateGenreScores(answers).map(({ genre, score }) => [genre, score]))
  const covers = planGenreVideos(rankedGenres)
  const genres = rankedGenres.map((genre, index) => {
    const { title, recipeId, theme } = vkGenres.find(({ id }) => id === genre)!
    return { genre, videos: covers.get(genre) ?? 0, score: genreScores.get(genre) ?? 0, rank: index + 1, selected: index < 3, title, recipeId, theme }
  })
  // The order of the keys is the order of the file.
  return {
    themes,
    genres,
    tags: [...new Set(given.flatMap(answer => answer.tags))],
    answers: given,
    videos: { themes: sum(themes), popular: plan.popular, genres: sum(genres), total: sum(themes) + plan.popular + sum(genres) },
    selectedThemes: rankedThemes.slice(0, 3),
    selectedGenres: rankedGenres.slice(0, 3),
    discovery: { answerId: discoveryAnswerId, rule: discoveryRules[discoveryAnswerId], extraThemes: plan.extraThemes },
    photo,
    schemaVersion: 1, type: 'stella-vk-result', product: 'vk-video', sessionId, createdAt,
  }
}
