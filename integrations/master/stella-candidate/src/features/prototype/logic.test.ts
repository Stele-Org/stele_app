import { describe, expect, it } from 'vitest'
import { calculateThemeScores, getMaxMission, rankThemes, selectTopThemes } from './logic'
import { vkQuestions, vkThemes } from '../../content/vkVideo'

describe('MAX mission routing', () => {
  it('keeps the agreed two-question route', () => {
    expect(getMaxMission('personal', 'access')).toBe('digital-id')
    expect(getMaxMission('business', 'access')).toBe('business-promotion')
    expect(getMaxMission('personal', 'connection')).toBe('communication')
    expect(getMaxMission('business', 'connection')).toBe('business-promotion')
    expect(getMaxMission('personal', 'visibility')).toBe('blogger')
    expect(getMaxMission('business', 'visibility')).toBe('business-promotion')
  })
})

describe('VK theme scoring', () => {
  it('matches the documented 1.1 + 2.1 result', () => {
    const scores = calculateThemeScores(['series', 'drive'])
    expect(scores.filter(({ score }) => score > 0)).toEqual([
      { theme: 'Кино', score: 3 },
      { theme: 'Игры и авто', score: 2 },
      { theme: 'Музыка', score: 1 },
    ])
    expect(selectTopThemes(['series', 'drive'], () => 0)).toEqual(['Кино', 'Игры и авто', 'Музыка'])
  })

  it('matches the documented 1.3 + 2.3 result', () => {
    expect(calculateThemeScores(['interview', 'learn']).filter(({ score }) => score > 0)).toEqual([
      { theme: 'Наука', score: 1 },
      { theme: 'Культура и образование', score: 2 },
      { theme: 'Новости и бизнес', score: 3 },
    ])
  })

  it('chooses the third theme randomly when two one-point themes tie', () => {
    const answers = ['series', 'heroes']
    const first = selectTopThemes(answers, () => 0)
    const second = selectTopThemes(answers, () => 0.999)
    expect(new Set(first.slice(0, 2))).toEqual(new Set(['Кино', 'Спорт']))
    expect(new Set(second.slice(0, 2))).toEqual(new Set(['Кино', 'Спорт']))
    expect(new Set([first[2], second[2]])).toEqual(new Set(['Музыка', 'Культура и образование']))
    expect(rankThemes(answers, () => 0)).toHaveLength(8)
  })

  it('covers all 16 source combinations with exactly six points each', () => {
    const expected = [
      [
        { Кино: 3, 'Игры и авто': 2, Музыка: 1 },
        { Кино: 2, Спорт: 2, Музыка: 1, 'Культура и образование': 1 },
        { Кино: 2, 'Новости и бизнес': 2, Музыка: 1, Наука: 1 },
        { Музыка: 3, Кино: 2, 'Медиа и шоу': 1 },
      ],
      [
        { 'Игры и авто': 3, 'Медиа и шоу': 2, Кино: 1 },
        { 'Медиа и шоу': 2, Спорт: 2, 'Игры и авто': 1, 'Культура и образование': 1 },
        { 'Медиа и шоу': 2, 'Новости и бизнес': 2, 'Игры и авто': 1, Наука: 1 },
        { 'Медиа и шоу': 3, Музыка: 2, 'Игры и авто': 1 },
      ],
      [
        { 'Культура и образование': 2, 'Игры и авто': 2, 'Новости и бизнес': 1, Кино: 1 },
        { 'Культура и образование': 3, Спорт: 2, 'Новости и бизнес': 1 },
        { 'Новости и бизнес': 3, 'Культура и образование': 2, Наука: 1 },
        { 'Культура и образование': 2, Музыка: 2, 'Новости и бизнес': 1, 'Медиа и шоу': 1 },
      ],
      [
        { Наука: 2, 'Игры и авто': 2, Спорт: 1, Кино: 1 },
        { Спорт: 3, Наука: 2, 'Культура и образование': 1 },
        { Наука: 3, 'Новости и бизнес': 2, Спорт: 1 },
        { Наука: 2, Музыка: 2, Спорт: 1, 'Медиа и шоу': 1 },
      ],
    ]
    for (const [firstIndex, first] of vkQuestions[0].options.entries()) {
      for (const [secondIndex, second] of vkQuestions[1].options.entries()) {
        const answers = [first.id, second.id]
        const scores = calculateThemeScores(answers)
        expect(scores).toHaveLength(vkThemes.length)
        expect(scores.reduce((sum, item) => sum + item.score, 0)).toBe(6)
        expect(Object.fromEntries(scores.filter(item => item.score > 0).map(item => [item.theme, item.score]))).toEqual(expected[firstIndex][secondIndex])
        expect(new Set(selectTopThemes(answers))).toHaveProperty('size', 3)
      }
    }
  })

  it('rejects incomplete or unknown answer sequences', () => {
    expect(() => calculateThemeScores(['series'])).toThrow()
    expect(() => calculateThemeScores(['series', 'unknown'])).toThrow()
  })
})
