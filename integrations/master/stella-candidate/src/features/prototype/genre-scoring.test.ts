import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { vkGenrePoints, vkGenres, type VkGenre } from '../../content/vkGenres'
import { vkQuestions, vkThemes } from '../../content/vkVideo'
import type { VkTheme } from '../../types/prototype'
import { calculateGenreScores, rankGenres } from './logic'

const points = (answers: string[]) => Object.fromEntries(calculateGenreScores(answers).filter(item => item.score > 0).map(item => [item.genre, item.score]))

describe('genres of the covers for the hero', () => {
  it('keeps the table «Тематика для видео - Тематика для обложек» supplied by the user', () => {
    const byTheme = new Map<VkTheme, VkGenre[]>()
    for (const { id, theme } of vkGenres) byTheme.set(theme, [...(byTheme.get(theme) ?? []), id])
    expect(Object.fromEntries(byTheme)).toEqual({
      'Наука': ['SCI-FI'], 'Культура и образование': ['HISTORY'], 'Медиа и шоу': ['COMEDY'], 'Музыка': ['MUSICLE'],
      'Игры и авто': ['BOEVIK'], 'Спорт': ['DRAMA', 'HORROR'], 'Новости и бизнес': ['DETECTIVE'], 'Кино': ['ADVENTURE', 'FANTASY'],
    })
    // Every video theme has its genres, and there are ten genres in all.
    expect(new Set(byTheme.keys())).toEqual(new Set(vkThemes))
    expect(vkGenres).toHaveLength(10)
  })

  it('names the genres as the cover recipes of the poster kit do', () => {
    const kit = JSON.parse(readFileSync(new URL('../../../../../../artifacts/stella-polza-kit/prompts/recipes.json', import.meta.url), 'utf8')) as
      { recipes: Array<{ id: string; title: string }> }
    expect(vkGenres.map(({ recipeId, title }) => ({ id: recipeId, title }))).toEqual(kit.recipes.map(({ id, title }) => ({ id, title })))
    expect(vkGenres.every(({ id, recipeId }) => recipeId.endsWith(`_${id}`))).toBe(true)
  })

  it('keeps the table of points supplied by the user: answers of the first two questions only', () => {
    expect(vkGenrePoints).toEqual({
      series: { plusTwo: ['FANTASY'], plusOne: ['HORROR'] },
      standup: { plusTwo: ['COMEDY'], plusOne: ['BOEVIK', 'MUSICLE'] },
      interview: { plusTwo: ['HISTORY'], plusOne: ['DRAMA'] },
      science: { plusTwo: ['SCI-FI'], plusOne: ['ADVENTURE', 'DETECTIVE'] },
      drive: { plusTwo: ['BOEVIK', 'ADVENTURE'], plusOne: [] },
      heroes: { plusTwo: ['DRAMA', 'HORROR'], plusOne: [] },
      learn: { plusTwo: ['DETECTIVE'], plusOne: ['HISTORY', 'SCI-FI'] },
      rest: { plusTwo: ['MUSICLE'], plusOne: ['FANTASY', 'COMEDY'] },
    })
    expect(Object.keys(vkGenrePoints)).toEqual([...vkQuestions[0].options, ...vkQuestions[1].options].map(option => option.id))
  })

  it('adds the points of the two answers for all 16 combinations', () => {
    const expected = [
      [
        { FANTASY: 2, BOEVIK: 2, ADVENTURE: 2, HORROR: 1 },
        { HORROR: 3, FANTASY: 2, DRAMA: 2 },
        { FANTASY: 2, DETECTIVE: 2, HORROR: 1, HISTORY: 1, 'SCI-FI': 1 },
        { FANTASY: 3, MUSICLE: 2, HORROR: 1, COMEDY: 1 },
      ],
      [
        { BOEVIK: 3, COMEDY: 2, ADVENTURE: 2, MUSICLE: 1 },
        { COMEDY: 2, DRAMA: 2, HORROR: 2, BOEVIK: 1, MUSICLE: 1 },
        { COMEDY: 2, DETECTIVE: 2, BOEVIK: 1, MUSICLE: 1, HISTORY: 1, 'SCI-FI': 1 },
        { COMEDY: 3, MUSICLE: 3, BOEVIK: 1, FANTASY: 1 },
      ],
      [
        { HISTORY: 2, BOEVIK: 2, ADVENTURE: 2, DRAMA: 1 },
        { DRAMA: 3, HISTORY: 2, HORROR: 2 },
        { HISTORY: 3, DETECTIVE: 2, DRAMA: 1, 'SCI-FI': 1 },
        { HISTORY: 2, MUSICLE: 2, DRAMA: 1, FANTASY: 1, COMEDY: 1 },
      ],
      [
        { ADVENTURE: 3, 'SCI-FI': 2, BOEVIK: 2, DETECTIVE: 1 },
        { 'SCI-FI': 2, DRAMA: 2, HORROR: 2, ADVENTURE: 1, DETECTIVE: 1 },
        { 'SCI-FI': 3, DETECTIVE: 3, ADVENTURE: 1, HISTORY: 1 },
        { 'SCI-FI': 2, MUSICLE: 2, ADVENTURE: 1, DETECTIVE: 1, FANTASY: 1, COMEDY: 1 },
      ],
    ]
    for (const [firstIndex, first] of vkQuestions[0].options.entries()) for (const [secondIndex, second] of vkQuestions[1].options.entries()) {
      expect(points([first.id, second.id]), `${first.id} + ${second.id}`).toEqual(expected[firstIndex][secondIndex])
      expect(calculateGenreScores([first.id, second.id])).toHaveLength(10)
    }
  })

  it('ranks all ten genres, the best first, and draws the order of equal ones', () => {
    // 3 / 2 / 2: the first is settled, the other two are drawn.
    const low = rankGenres(['series', 'heroes'], () => 0), high = rankGenres(['series', 'heroes'], () => 0.999)
    for (const ranked of [low, high]) {
      expect(ranked).toHaveLength(10)
      expect(new Set(ranked)).toEqual(new Set(vkGenres.map(genre => genre.id)))
      expect(ranked[0]).toBe('HORROR')
      expect(new Set(ranked.slice(1, 3))).toEqual(new Set<VkGenre>(['FANTASY', 'DRAMA']))
    }
    expect(low.slice(1, 3)).not.toEqual(high.slice(1, 3))
    // 2 / 2 / 1 / 1 / 1 / 1: the third genre is one of the four with a point.
    const thirds = new Set([0, 0.3, 0.6, 0.999].map(value => rankGenres(['standup', 'learn'], () => value)[2]))
    expect([...thirds].every(genre => ['BOEVIK', 'MUSICLE', 'HISTORY', 'SCI-FI'].includes(genre))).toBe(true)
  })

  it('ranks by points for every combination, and at least three genres always have points', () => {
    for (const first of vkQuestions[0].options) for (const second of vkQuestions[1].options) for (const random of [() => 0, () => 0.5, () => 0.999]) {
      const answers = [first.id, second.id]
      const ranked = rankGenres(answers, random)
      const scores = new Map(calculateGenreScores(answers).map(item => [item.genre, item.score]))
      expect(ranked.slice(0, 3).every(genre => scores.get(genre)! > 0)).toBe(true)
      expect(ranked.map(genre => scores.get(genre))).toEqual([...ranked.map(genre => scores.get(genre)!)].sort((a, b) => b - a))
    }
  })

  it('rejects incomplete or unknown answer sequences', () => {
    expect(() => calculateGenreScores(['series'])).toThrow()
    expect(() => calculateGenreScores(['series', 'unknown'])).toThrow()
  })
})
