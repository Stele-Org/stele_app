import { maxMissionLabels } from '../../content/max'
import { vkQuestions, vkThemes } from '../../content/vkVideo'
import { vkGenrePoints, vkGenres, type VkGenre } from '../../content/vkGenres'
import type {
  MaxAudience,
  MaxGoal,
  MaxMission,
  ThemeScore,
  VkTheme,
} from '../../types/prototype'

export function getMaxMission(
  audience: MaxAudience,
  goal: MaxGoal,
): MaxMission {
  if (audience === 'business') return 'business-promotion'
  if (goal === 'access') return 'digital-id'
  if (goal === 'connection') return 'communication'
  return 'blogger'
}

export function getMaxMissionLabel(
  audience: MaxAudience,
  goal: MaxGoal,
) {
  return maxMissionLabels[getMaxMission(audience, goal)]
}

function shuffled<T>(items: T[], random: () => number) {
  const result = [...items]

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[result[index], result[swapIndex]] = [
      result[swapIndex],
      result[index],
    ]
  }

  return result
}

export function calculateThemeScores(answerIds: string[]): ThemeScore[] {
  if (answerIds.length !== 2) throw new Error('VK theme scoring requires two answers')
  const scores = new Map<VkTheme, number>(
    vkThemes.map((theme) => [theme, 0]),
  )

  answerIds.forEach((answerId, questionIndex) => {
    const question = questionIndex === 0 ? vkQuestions[0] : vkQuestions[1]
    const option = question.options.find(
      ({ id }) => id === answerId,
    )
    if (!option) throw new Error(`Unknown VK answer: ${answerId}`)

    scores.set(option.plusTwo, (scores.get(option.plusTwo) ?? 0) + 2)
    scores.set(option.plusOne, (scores.get(option.plusOne) ?? 0) + 1)
  })

  return vkThemes.map((theme) => ({ theme, score: scores.get(theme) ?? 0 }))
}

/** The best first; items with equal points stand in a drawn order. */
function rankedByScore<T>(scores: Array<{ item: T; score: number }>, random: () => number): T[] {
  const scoreLevels = [...new Set(scores.map(({ score }) => score))].sort(
    (left, right) => right - left,
  )
  const selected: T[] = []

  for (const score of scoreLevels) {
    const tied = scores
      .filter((entry) => entry.score === score)
      .map((entry) => entry.item)
    selected.push(...(tied.length === 1 ? tied : shuffled(tied, random)))
  }

  return selected
}

export function rankThemes(
  answerIds: string[],
  random: () => number = Math.random,
): VkTheme[] {
  return rankedByScore(calculateThemeScores(answerIds).map(({ theme, score }) => ({ item: theme, score })), random)
}

/** Points of the cover genres for the first two answers (content/vkGenres.ts), in the order of the genre list. */
export function calculateGenreScores(answerIds: string[]): Array<{ genre: VkGenre; score: number }> {
  if (answerIds.length !== 2) throw new Error('VK genre scoring requires two answers')
  const scores = new Map<VkGenre, number>(vkGenres.map(({ id }) => [id, 0]))

  for (const answerId of answerIds) {
    const points = vkGenrePoints[answerId]
    if (!points) throw new Error(`Unknown VK answer: ${answerId}`)
    for (const genre of points.plusTwo) scores.set(genre, (scores.get(genre) ?? 0) + 2)
    for (const genre of points.plusOne) scores.set(genre, (scores.get(genre) ?? 0) + 1)
  }

  return vkGenres.map(({ id }) => ({ genre: id, score: scores.get(id) ?? 0 }))
}

export function rankGenres(
  answerIds: string[],
  random: () => number = Math.random,
): VkGenre[] {
  return rankedByScore(calculateGenreScores(answerIds).map(({ genre, score }) => ({ item: genre, score })), random)
}

export function selectTopThemes(
  answerIds: string[],
  random: () => number = Math.random,
): VkTheme[] {
  return rankThemes(answerIds, random).slice(0, 3)
}
