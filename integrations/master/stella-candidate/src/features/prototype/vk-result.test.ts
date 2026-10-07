import { describe, expect, it } from 'vitest'
import { vkQuestions, vkThemes } from '../../content/vkVideo'
import { calculateThemeScores, rankThemes } from './logic'
import { buildVkResult, type VkResultChoices } from './vk-result'

const sessionId = '4f0c2c1e-6a51-4b8e-9d3f-2b7a9c1e5d10'
const at = '2026-10-07T10:15:00.000Z'
const choices = (answers: string[], discoveryAnswerId: string, random = () => 0): VkResultChoices =>
  ({ sessionId, answers, discoveryAnswerId, rankedThemes: rankThemes(answers, random) })

describe('the result of a VK Видео test', () => {
  it('describes the themes with their videos, the tags, the answers, the choice of Discovery and the photo', () => {
    const result = buildVkResult(choices(['series', 'drive'], 'familiar'), { status: 'not-requested' }, at)
    expect(result).toEqual({
      themes: expect.any(Array),
      tags: ['обсуждения', 'сериал', 'премьера', 'популярное', 'драйв', 'азарт', 'игры', 'авто', 'рекомендации', 'для меня', 'персонализация', 'увлечения'],
      answers: [
        { questionId: 'evening', question: 'У вас внезапно освободился вечер. Что включаем?', answerId: 'series',
          answer: 'Новый сериал, который все обсуждают', tags: ['обсуждения', 'сериал', 'премьера', 'популярное'] },
        { questionId: 'ideal-content', question: 'Каким должен быть идеальный контент на вечер?', answerId: 'drive',
          answer: 'Драйвовый', tags: ['драйв', 'азарт', 'игры', 'авто'] },
        { questionId: 'discovery', question: 'Рекомендации Discovery решили немного вас удивить. Что показывать?', answerId: 'familiar',
          answer: 'Что-то похожее на то, что я уже люблю', tags: ['рекомендации', 'для меня', 'персонализация', 'увлечения'] },
      ],
      videos: { themes: 5, popular: 0, total: 5 },
      selectedThemes: ['Кино', 'Игры и авто', 'Музыка'],
      discovery: { answerId: 'familiar', rule: 'По одному видео из Топ 2 тематик для пользователя', extraThemes: ['Кино', 'Игры и авто'] },
      photo: { status: 'not-requested' },
      schemaVersion: 1, type: 'stella-vk-result', product: 'vk-video', sessionId, createdAt: at,
    })
    expect(result.themes.slice(0, 3)).toEqual([
      { theme: 'Кино', videos: 2, score: 3, rank: 1, selected: true },
      { theme: 'Игры и авто', videos: 2, score: 2, rank: 2, selected: true },
      { theme: 'Музыка', videos: 1, score: 1, rank: 3, selected: true },
    ])
    expect(result.themes.slice(3).every(item => item.videos === 0 && item.score === 0 && !item.selected)).toBe(true)
  })

  it('puts the themes first in the file, then the tags, then the answers', () => {
    const result = buildVkResult(choices(['series', 'drive'], 'new'), { status: 'not-requested' }, at)
    expect(Object.keys(result).slice(0, 3)).toEqual(['themes', 'tags', 'answers'])
    expect(Object.keys(JSON.parse(JSON.stringify(result)) as object).slice(0, 3)).toEqual(['themes', 'tags', 'answers'])
    expect(Object.keys(result.themes[0])).toEqual(['theme', 'videos', 'score', 'rank', 'selected'])
  })

  it('lists all eight themes in the order drawn for the visitor, with their points, and marks the first three', () => {
    const drawn = choices(['series', 'heroes'], 'hero', () => 0.999)
    const { themes, selectedThemes } = buildVkResult(drawn, { status: 'skipped' }, at)
    expect(themes.map(item => item.theme)).toEqual(drawn.rankedThemes)
    expect(themes.map(item => item.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(new Set(themes.map(item => item.theme))).toEqual(new Set(vkThemes))
    expect(themes.map(item => item.score)).toEqual([2, 2, 1, 1, 0, 0, 0, 0])
    expect(themes.map(item => item.videos)).toEqual([1, 1, 1, 0, 0, 0, 0, 0])
    expect(themes.filter(item => item.selected).map(item => item.theme)).toEqual(selectedThemes)
    expect(selectedThemes).toEqual(drawn.rankedThemes.slice(0, 3))
    // The ties are not drawn again: another draw of the same answers gives its own order, and the result keeps it.
    const other = choices(['series', 'heroes'], 'hero', () => 0)
    expect(buildVkResult(other, { status: 'skipped' }, at).themes.map(item => item.theme)).toEqual(other.rankedThemes)
  })

  it.each([
    // The third answer changes the number of videos as the client's table «Сюрприз Discovery» says (video-plan.ts).
    ['familiar', ['series', 'drive'], [2, 2, 1, 0], { themes: 5, popular: 0, total: 5 }, ['Кино', 'Игры и авто']],
    ['new', ['series', 'drive'], [1, 1, 2, 0], { themes: 4, popular: 0, total: 4 }, ['Музыка']],
    ['hero', ['series', 'drive'], [1, 1, 1, 0], { themes: 3, popular: 0, total: 3 }, []],
    ['popular', ['series', 'drive'], [1, 1, 1, 0], { themes: 3, popular: 1, total: 4 }, []],
  ] as const)('counts the videos for the third answer «%s»', (third, answers, firstFour, videos, extraThemes) => {
    const result = buildVkResult(choices([...answers], third), { status: third === 'hero' ? 'skipped' : 'not-requested' }, at)
    expect(result.themes.slice(0, 4).map(item => item.videos)).toEqual(firstFour)
    expect(result.videos).toEqual(videos)
    expect(result.discovery.extraThemes).toEqual(extraThemes)
  })

  it('gives «новое» its extra video in the fourth theme when that theme has a point', () => {
    const drawn = choices(['series', 'heroes'], 'new')
    const result = buildVkResult(drawn, { status: 'not-requested' }, at)
    expect(result.themes.slice(0, 5).map(item => [item.score, item.videos, item.selected])).toEqual(
      [[2, 1, true], [2, 1, true], [1, 1, true], [1, 1, false], [0, 0, false]])
    expect(result.discovery.extraThemes).toEqual([drawn.rankedThemes[3]])
    expect(result.videos).toEqual({ themes: 4, popular: 0, total: 4 })
  })

  it('gives every combination of answers the points of the scoring, a consistent count of videos and never a tag twice', () => {
    for (const first of vkQuestions[0].options) for (const second of vkQuestions[1].options) for (const third of vkQuestions[2].options) {
      const result = buildVkResult(choices([first.id, second.id], third.id), { status: 'not-requested' }, at)
      const scores = new Map(calculateThemeScores([first.id, second.id]).map(item => [item.theme, item.score]))
      expect(result.themes.every(item => item.score === scores.get(item.theme))).toBe(true)
      expect(result.themes.map(item => item.score)).toEqual([...result.themes.map(item => item.score)].sort((a, b) => b - a))
      expect(result.videos.themes).toBe(result.themes.reduce((sum, item) => sum + item.videos, 0))
      expect(result.videos.total).toBe(result.videos.themes + result.videos.popular)
      expect(result.themes.filter(item => item.videos > 0).every(item => item.score > 0)).toBe(true)
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
