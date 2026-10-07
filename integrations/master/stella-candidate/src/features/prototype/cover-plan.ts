import type { VkGenre } from '../../content/vkGenres'
import type { VkTheme } from '../../types/prototype'

/**
 * The covers one visitor gets (user request, 07.10.2026): always six different ones.
 *
 * Without AI covers — two covers for each of the three themes with the most points.
 * With AI covers, which carry the visitor's image — one AI cover for each of the two genres with the most points,
 * and two covers for each of the two themes with the most points. AI covers take the answer «Хочу стать героем
 * VK Видео» and an approved photo (`vk-result.ts`): without a photo there is nothing to make them from.
 *
 * The rules of the client's table «Сюрприз Discovery» for the answers 3.1, 3.2 and 3.4 do not change these numbers:
 * this rule replaced the earlier count of videos that followed them.
 */
export const COVERS_TOTAL = 6
export const COVERS_PER_THEME = 2
export const AI_COVERS = 2

export interface CoverPlan {
  /** The themes that get covers, the best first, with the number of covers for each. */
  themes: Array<{ theme: VkTheme; count: number }>
  /** The genres that get an AI cover, the best first, with the number of covers for each; empty without AI covers. */
  aiCover: Array<{ genre: VkGenre; count: number }>
}

/** `rankedGenres` is needed only with AI covers; both rankings come already drawn, the best first. */
export function planCovers(rankedThemes: VkTheme[], rankedGenres: VkGenre[], withAiCovers: boolean): CoverPlan {
  const aiCover = withAiCovers ? rankedGenres.slice(0, AI_COVERS).map(genre => ({ genre, count: 1 })) : []
  const themes = rankedThemes.slice(0, (COVERS_TOTAL - aiCover.length) / COVERS_PER_THEME).map(theme => ({ theme, count: COVERS_PER_THEME }))
  return { themes, aiCover }
}
