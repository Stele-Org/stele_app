import { maxMissionLabels } from '../../content/max'
import { vkQuestions, vkThemes } from '../../content/vkVideo'
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

export function rankThemes(
  answerIds: string[],
  random: () => number = Math.random,
): VkTheme[] {
  const scores = calculateThemeScores(answerIds)
  const scoreLevels = [...new Set(scores.map(({ score }) => score))].sort(
    (left, right) => right - left,
  )
  const selected: VkTheme[] = []

  for (const score of scoreLevels) {
    const tiedThemes = scores
      .filter((item) => item.score === score)
      .map((item) => item.theme)
    selected.push(...(tiedThemes.length === 1 ? tiedThemes : shuffled(tiedThemes, random)))
  }

  return selected
}

export function selectTopThemes(
  answerIds: string[],
  random: () => number = Math.random,
): VkTheme[] {
  return rankThemes(answerIds, random).slice(0, 3)
}
