import type { VkGenre } from '../../content/vkGenres'
import type { VkTheme } from '../../types/prototype'

/**
 * How many videos each of the three selected themes brings before the surprise of Discovery.
 * The client's documents give the rules of the surprise (the third question) but not this number:
 * one video per selected theme is an assumption of this project (07.10.2026), kept in one place to be changed.
 */
export const BASE_VIDEOS_PER_THEME = 1
/** How many videos with a cover of the visitor each of the three selected genres brings to the hero: the same assumption. */
export const VIDEOS_PER_GENRE = 1

export interface VideoPlan {
  /** Videos for every theme of the ranking; a theme that is not selected and got nothing extra has 0. */
  videos: Map<VkTheme, number>
  /** The themes the surprise of Discovery gave one more video to. */
  extraThemes: VkTheme[]
  /** Videos taken from the whole catalogue by popularity, outside the themes. */
  popular: number
}

/**
 * The number of videos per theme for one visitor: the three selected themes, changed by the answer to the third
 * question as the client's table «Сюрприз Discovery» says.
 *
 * 3.1 `familiar` — «По одному видео из Топ 2 тематик»: one more video for each of the two best themes.
 * 3.2 `new` — «Дополнительное видео из тематики 3 или 4»: one more video for the fourth theme when the visitor's
 *   answers gave it points, otherwise for the third. A fourth theme without points was drawn at random among the
 *   themes the visitor did not choose, so it is not «по теме моих интересов».
 * 3.3 `hero` — covers with the visitor's image; the videos by themes stay, the covers are counted by genres
 *   (`planGenreVideos`).
 * 3.4 `popular` — «Самое популярное видео за последние 7 дней»: one video from the whole catalogue. Its theme is
 *   known only to the catalogue, so it is counted apart from the themes.
 */
export function planVideos(rankedThemes: VkTheme[], scores: ReadonlyMap<VkTheme, number>, discoveryAnswerId: string): VideoPlan {
  const videos = new Map(rankedThemes.map((theme, index) => [theme, index < 3 ? BASE_VIDEOS_PER_THEME : 0]))
  let extraThemes: VkTheme[] = []
  let popular = 0
  if (discoveryAnswerId === 'familiar') extraThemes = rankedThemes.slice(0, 2)
  else if (discoveryAnswerId === 'new') {
    const [, , third, fourth] = rankedThemes
    extraThemes = [fourth !== undefined && (scores.get(fourth) ?? 0) > 0 ? fourth : third]
  } else if (discoveryAnswerId === 'popular') popular = 1
  for (const theme of extraThemes) videos.set(theme, (videos.get(theme) ?? 0) + 1)
  return { videos, extraThemes, popular }
}

/**
 * 3.3 `hero` — «Формируется пул обложек … на которых размещен образ пользователя» (user request, 07.10.2026):
 * the three best genres of the ranking bring a video with a cover each. Like the themes, the genres are taken three
 * at a time and equal points are settled by the drawn order; the user's tables give the points of the genres but
 * not how many to take.
 */
export function planGenreVideos(rankedGenres: VkGenre[]): Map<VkGenre, number> {
  return new Map(rankedGenres.map((genre, index) => [genre, index < 3 ? VIDEOS_PER_GENRE : 0]))
}
