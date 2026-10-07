import { describe, expect, it } from 'vitest'
import { vkQuestions } from '../../content/vkVideo'
import { calculateGenreScores, calculateThemeScores, rankGenres, rankThemes } from './logic'
import { AI_COVERS, COVERS_PER_THEME, COVERS_TOTAL, planCovers } from './cover-plan'

describe('six covers for every visitor', () => {
  it('keeps the numbers the user named', () => {
    expect([COVERS_TOTAL, COVERS_PER_THEME, AI_COVERS]).toEqual([6, 2, 2])
  })

  it('without AI covers: two covers for each of the three best themes', () => {
    const plan = planCovers(rankThemes(['series', 'drive'], () => 0), [], false)
    expect(plan).toEqual({
      themes: [{ theme: 'Кино', count: 2 }, { theme: 'Игры и авто', count: 2 }, { theme: 'Музыка', count: 2 }],
      aiCover: [],
    })
    // The genres are not consulted without AI covers, even when they are given.
    expect(planCovers(rankThemes(['series', 'drive'], () => 0), rankGenres(['series', 'drive'], () => 0), false)).toEqual(plan)
  })

  it('with AI covers: one for each of the two best genres, and two covers for each of the two best themes', () => {
    // series + heroes: HORROR 3, then FANTASY and DRAMA with 2; themes Кино 2 and Спорт 2.
    const themes = rankThemes(['series', 'heroes'], () => 0), genres = rankGenres(['series', 'heroes'], () => 0)
    const plan = planCovers(themes, genres, true)
    expect(plan.aiCover).toEqual([{ genre: 'HORROR', count: 1 }, { genre: genres[1], count: 1 }])
    expect(['FANTASY', 'DRAMA']).toContain(plan.aiCover[1].genre)
    expect(plan.themes).toEqual([{ theme: themes[0], count: 2 }, { theme: themes[1], count: 2 }])
    expect(new Set(plan.themes.map(item => item.theme))).toEqual(new Set(['Кино', 'Спорт']))
  })

  it('always gives six covers, never the same theme or genre twice, never one without points', () => {
    for (const first of vkQuestions[0].options) for (const second of vkQuestions[1].options) for (const random of [() => 0, () => 0.5, () => 0.999]) {
      const answers = [first.id, second.id]
      const themes = rankThemes(answers, random), genres = rankGenres(answers, random)
      const themeScores = new Map(calculateThemeScores(answers).map(item => [item.theme, item.score]))
      const genreScores = new Map(calculateGenreScores(answers).map(item => [item.genre, item.score]))
      for (const withAiCovers of [false, true]) {
        const plan = planCovers(themes, genres, withAiCovers)
        expect([...plan.themes, ...plan.aiCover].reduce((total, item) => total + item.count, 0)).toBe(6)
        expect(plan.themes).toHaveLength(withAiCovers ? 2 : 3)
        expect(plan.aiCover).toHaveLength(withAiCovers ? 2 : 0)
        expect(new Set(plan.themes.map(item => item.theme)).size).toBe(plan.themes.length)
        expect(new Set(plan.aiCover.map(item => item.genre)).size).toBe(plan.aiCover.length)
        expect(plan.themes.every(item => themeScores.get(item.theme)! > 0)).toBe(true)
        expect(plan.aiCover.every(item => genreScores.get(item.genre)! > 0)).toBe(true)
      }
    }
  })
})
