import { describe, expect, it } from 'vitest'
import { vkQuestions } from '../../content/vkVideo'
import type { VkTheme } from '../../types/prototype'
import { calculateThemeScores, rankThemes } from './logic'
import { BASE_VIDEOS_PER_THEME, planVideos } from './video-plan'

const plan = (answers: string[], discoveryAnswerId: string, random = () => 0) => {
  const ranked = rankThemes(answers, random)
  const scores = new Map(calculateThemeScores(answers).map(({ theme, score }) => [theme, score]))
  const result = planVideos(ranked, scores, discoveryAnswerId)
  return { ranked, scores, ...result, counts: ranked.map(theme => result.videos.get(theme)) }
}

describe('videos per theme by the surprise of Discovery', () => {
  it('starts from one video for each of the three selected themes', () => {
    expect(BASE_VIDEOS_PER_THEME).toBe(1)
    // 3.3, the hero: covers with the visitor's image, the number of videos stays.
    const hero = plan(['series', 'drive'], 'hero')
    expect(hero.ranked.slice(0, 3)).toEqual(['Кино', 'Игры и авто', 'Музыка'])
    expect(hero.counts).toEqual([1, 1, 1, 0, 0, 0, 0, 0])
    expect(hero.extraThemes).toEqual([])
    expect(hero.popular).toBe(0)
  })

  it('3.1 «похожее»: one more video for each of the two best themes', () => {
    const familiar = plan(['series', 'drive'], 'familiar')
    expect(familiar.counts).toEqual([2, 2, 1, 0, 0, 0, 0, 0])
    expect(familiar.extraThemes).toEqual(['Кино', 'Игры и авто'])
    expect(familiar.popular).toBe(0)
    // Two themes with two points each are the two best whatever their drawn order.
    const tied = plan(['series', 'heroes'], 'familiar', () => 0.999)
    expect(new Set(tied.extraThemes)).toEqual(new Set<VkTheme>(['Кино', 'Спорт']))
    expect(tied.counts).toEqual([2, 2, 1, 0, 0, 0, 0, 0])
  })

  it('3.2 «новое»: one more video for the fourth theme when the answers gave it points', () => {
    // 2/2/1/1: the fourth is the theme with a point that lost the draw for the third place.
    for (const random of [() => 0, () => 0.999]) {
      const fresh = plan(['series', 'heroes'], 'new', random)
      expect(fresh.scores.get(fresh.ranked[3])).toBe(1)
      expect(fresh.extraThemes).toEqual([fresh.ranked[3]])
      expect(fresh.counts).toEqual([1, 1, 1, 1, 0, 0, 0, 0])
      expect(new Set(fresh.ranked.slice(2, 4))).toEqual(new Set<VkTheme>(['Музыка', 'Культура и образование']))
    }
  })

  it('3.2 «новое»: one more video for the third theme when the fourth has no points', () => {
    // 3/2/1: only three themes have points, the fourth is a random theme the visitor did not choose.
    const fresh = plan(['series', 'drive'], 'new')
    expect(fresh.scores.get(fresh.ranked[3])).toBe(0)
    expect(fresh.extraThemes).toEqual(['Музыка'])
    expect(fresh.counts).toEqual([1, 1, 2, 0, 0, 0, 0, 0])
  })

  it('3.4 «увлечены все»: one video from the whole catalogue, the themes keep theirs', () => {
    const popular = plan(['science', 'rest'], 'popular')
    expect(popular.counts).toEqual([1, 1, 1, 0, 0, 0, 0, 0])
    expect(popular.extraThemes).toEqual([])
    expect(popular.popular).toBe(1)
  })

  it('gives every combination of answers its number of videos and never a video to a theme without points', () => {
    const totals = { familiar: 5, new: 4, hero: 3, popular: 4 }
    for (const first of vkQuestions[0].options) for (const second of vkQuestions[1].options) for (const third of vkQuestions[2].options) {
      for (const random of [() => 0, () => 0.5, () => 0.999]) {
        const planned = plan([first.id, second.id], third.id, random)
        const byThemes = planned.counts.reduce<number>((sum, count) => sum + (count ?? 0), 0)
        expect(byThemes + planned.popular).toBe(totals[third.id as keyof typeof totals])
        for (const theme of planned.ranked) if (planned.videos.get(theme)) expect(planned.scores.get(theme)).toBeGreaterThan(0)
      }
    }
  })
})
