import { describe, expect, it } from 'vitest'
import { vkQuestions, vkThemes } from '../../content/vkVideo'
import { calculateThemeScores, rankThemes } from './logic'
import { buildVkResult, type VkResultChoices } from './vk-result'

const sessionId = '4f0c2c1e-6a51-4b8e-9d3f-2b7a9c1e5d10'
const at = '2026-10-07T10:15:00.000Z'
const choices = (answers: string[], discoveryAnswerId: string, random = () => 0): VkResultChoices =>
  ({ sessionId, answers, discoveryAnswerId, rankedThemes: rankThemes(answers, random) })

describe('the result of a VK Видео test', () => {
  it('describes the answers, their tags, the themes, the choice of Discovery and the photo', () => {
    expect(buildVkResult(choices(['series', 'drive'], 'new'), { status: 'not-requested' }, at)).toEqual({
      schemaVersion: 1, type: 'stella-vk-result', sessionId, createdAt: at, product: 'vk-video',
      answers: [
        { questionId: 'evening', question: 'У вас внезапно освободился вечер. Что включаем?', answerId: 'series',
          answer: 'Новый сериал, который все обсуждают', tags: ['обсуждения', 'сериал', 'премьера', 'популярное'] },
        { questionId: 'ideal-content', question: 'Каким должен быть идеальный контент на вечер?', answerId: 'drive',
          answer: 'Драйвовый', tags: ['драйв', 'азарт', 'игры', 'авто'] },
        { questionId: 'discovery', question: 'Рекомендации Discovery решили немного вас удивить. Что показывать?', answerId: 'new',
          answer: 'Новое, но по теме моих интересов', tags: ['новинки', 'лайки', 'интересы', 'темы'] },
      ],
      tags: ['обсуждения', 'сериал', 'премьера', 'популярное', 'драйв', 'азарт', 'игры', 'авто', 'новинки', 'лайки', 'интересы', 'темы'],
      themes: expect.any(Array),
      selectedThemes: ['Кино', 'Игры и авто', 'Музыка'],
      discovery: { answerId: 'new', rule: 'Дополнительное видео из тематики 3 или 4' },
      photo: { status: 'not-requested' },
    })
  })

  it('lists all eight themes in the order drawn for the visitor, with their points, and marks the first three', () => {
    const drawn = choices(['series', 'heroes'], 'familiar', () => 0.999)
    const { themes, selectedThemes } = buildVkResult(drawn, { status: 'not-requested' }, at)
    expect(themes.map(item => item.theme)).toEqual(drawn.rankedThemes)
    expect(themes.map(item => item.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(new Set(themes.map(item => item.theme))).toEqual(new Set(vkThemes))
    expect(themes.map(item => item.score)).toEqual([2, 2, 1, 1, 0, 0, 0, 0])
    expect(themes.filter(item => item.selected).map(item => item.theme)).toEqual(selectedThemes)
    expect(selectedThemes).toEqual(drawn.rankedThemes.slice(0, 3))
    // The ties are not drawn again: another draw of the same answers gives its own order, and the result keeps it.
    const other = choices(['series', 'heroes'], 'familiar', () => 0)
    expect(buildVkResult(other, { status: 'not-requested' }, at).themes.map(item => item.theme)).toEqual(other.rankedThemes)
  })

  it('gives every combination of answers the points of the scoring and never a tag twice', () => {
    for (const first of vkQuestions[0].options) for (const second of vkQuestions[1].options) for (const third of vkQuestions[2].options) {
      const result = buildVkResult(choices([first.id, second.id], third.id), { status: 'not-requested' }, at)
      const scores = new Map(calculateThemeScores([first.id, second.id]).map(item => [item.theme, item.score]))
      expect(result.themes.every(item => item.score === scores.get(item.theme))).toBe(true)
      expect(result.themes.map(item => item.score)).toEqual([...result.themes.map(item => item.score)].sort((a, b) => b - a))
      expect(new Set(result.tags).size).toBe(result.tags.length)
      expect(result.answers.map(answer => answer.answerId)).toEqual([first.id, second.id, third.id])
    }
  })

  it('names a tag once where the client\'s table repeats it', () => {
    const result = buildVkResult(choices(['interview', 'learn'], 'popular'), { status: 'not-requested' }, at)
    expect(result.answers[1].tags).toEqual(['культура', 'обучение', 'факты'])
    expect(result.tags.filter(tag => tag === 'культура')).toHaveLength(1)
  })

  it.each([
    [{ status: 'accepted', captureId: 'photo-0001' } as const, 'accept', 'Начать', ['ракурс', 'освещение', 'композиция', 'обработка']],
    [{ status: 'unavailable' } as const, 'accept', 'Начать', ['ракурс', 'освещение', 'композиция', 'обработка']],
    [{ status: 'skipped' } as const, 'skip', 'Пропустить', []],
  ])('adds the photo step of the hero as a fourth answer: %o', (photo, answerId, answer, tags) => {
    const result = buildVkResult(choices(['science', 'rest'], 'hero'), photo, at)
    expect(result.photo).toEqual(photo)
    expect(result.answers).toHaveLength(4)
    expect(result.answers[3]).toEqual({ questionId: 'photo', question: 'Ты – главный герой VK Видео', answerId, answer, tags })
    expect(result.tags.slice(12)).toEqual(tags)
    expect(result.discovery.answerId).toBe('hero')
  })

  it('refuses answers the test does not have', () => {
    expect(() => buildVkResult(choices(['series', 'drive'], 'unknown'), { status: 'not-requested' }, at)).toThrow()
  })
})
