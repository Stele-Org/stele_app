import { describe, expect, it } from 'vitest'
import { vkGenres } from '../../content/vkGenres'
import { vkQuestions, vkThemes } from '../../content/vkVideo'
import { calculateGenreScores, calculateThemeScores, rankThemes } from './logic'
import { buildVkResult, type VkResultChoices } from './vk-result'

const sessionId = '4f0c2c1e-6a51-4b8e-9d3f-2b7a9c1e5d10'
const at = '2026-10-07T10:15:00.000Z'
const choices = (answers: string[], discoveryAnswerId: string, random = () => 0): VkResultChoices =>
  ({ sessionId, answers, discoveryAnswerId, rankedThemes: rankThemes(answers, random) })

describe('the result of a VK Видео test', () => {
  it('describes the six covers, the tags, the answers, the scores, the choice of Discovery and the photo', () => {
    const result = buildVkResult(choices(['series', 'drive'], 'familiar'), { status: 'not-requested' }, at)
    expect(result).toEqual({
      covers: [{ theme: 'Кино', count: 2 }, { theme: 'Игры и авто', count: 2 }, { theme: 'Музыка', count: 2 }],
      aiCover: [],
      coversTotal: 6,
      tags: ['обсуждения', 'сериал', 'премьера', 'популярное', 'драйв', 'азарт', 'игры', 'авто', 'рекомендации', 'для меня', 'персонализация', 'увлечения'],
      answers: [
        { questionId: 'evening', question: 'У вас внезапно освободился вечер. Что включаем?', answerId: 'series',
          answer: 'Новый сериал, который все обсуждают', tags: ['обсуждения', 'сериал', 'премьера', 'популярное'] },
        { questionId: 'ideal-content', question: 'Каким должен быть идеальный контент на вечер?', answerId: 'drive',
          answer: 'Драйвовый', tags: ['драйв', 'азарт', 'игры', 'авто'] },
        { questionId: 'discovery', question: 'Рекомендации Discovery решили немного вас удивить. Что показывать?', answerId: 'familiar',
          answer: 'Что-то похожее на то, что я уже люблю', tags: ['рекомендации', 'для меня', 'персонализация', 'увлечения'] },
      ],
      themes: expect.any(Array),
      genres: [],
      discovery: { answerId: 'familiar', rule: 'По одному видео из Топ 2 тематик для пользователя' },
      photo: { status: 'not-requested' },
      schemaVersion: 1, type: 'stella-vk-result', product: 'vk-video', sessionId, createdAt: at,
    })
    expect(result.themes.slice(0, 3)).toEqual([
      { theme: 'Кино', covers: 2, score: 3, rank: 1 },
      { theme: 'Игры и авто', covers: 2, score: 2, rank: 2 },
      { theme: 'Музыка', covers: 2, score: 1, rank: 3 },
    ])
    expect(result.themes.slice(3).every(item => item.covers === 0 && item.score === 0)).toBe(true)
  })

  it('puts the covers by themes and the AI covers first in the file, then the tags, then the answers', () => {
    const result = buildVkResult(choices(['series', 'drive'], 'hero'), { status: 'accepted', captureId: 'photo-0001' }, at)
    const order = ['covers', 'aiCover', 'coversTotal', 'tags', 'answers', 'themes', 'genres', 'discovery', 'photo']
    expect(Object.keys(result).slice(0, order.length)).toEqual(order)
    expect(Object.keys(JSON.parse(JSON.stringify(result)) as object).slice(0, order.length)).toEqual(order)
    expect(Object.keys(result.covers[0])).toEqual(['theme', 'count'])
    expect(Object.keys(result.aiCover[0])).toEqual(['genre', 'count', 'title', 'recipeId', 'theme'])
  })

  it.each(['familiar', 'new', 'popular'])('gives «%s» two covers for each of the three best themes and no AI cover', third => {
    // The same six covers whatever the third answer is, unless it is the hero.
    const drawn = choices(['science', 'rest'], third, () => 0.999)
    const result = buildVkResult(drawn, { status: 'not-requested' }, at)
    expect(result.covers).toEqual(drawn.rankedThemes.slice(0, 3).map(theme => ({ theme, count: 2 })))
    expect(result.aiCover).toEqual([])
    expect(result.genres).toEqual([])
    expect(result.coversTotal).toBe(6)
    expect(result.themes.map(item => item.covers)).toEqual([2, 2, 2, 0, 0, 0, 0, 0])
  })

  it('gives the hero two AI covers by genres and two covers for each of the two best themes', () => {
    // series + heroes: genres HORROR 3, FANTASY 2, DRAMA 2; themes Кино 2, Спорт 2, then two with a point.
    const drawn = choices(['series', 'heroes'], 'hero')
    const result = buildVkResult(drawn, { status: 'accepted', captureId: 'photo-0001' }, at, () => 0)
    expect(result.aiCover).toHaveLength(2)
    expect(result.aiCover[0]).toEqual({ genre: 'HORROR', count: 1, title: 'Хоррор', recipeId: '09_HORROR', theme: 'Спорт' })
    expect(['FANTASY', 'DRAMA']).toContain(result.aiCover[1].genre)
    expect(result.aiCover[1].count).toBe(1)
    expect(result.covers).toEqual(drawn.rankedThemes.slice(0, 2).map(theme => ({ theme, count: 2 })))
    expect(new Set(result.covers.map(item => item.theme))).toEqual(new Set(['Кино', 'Спорт']))
    expect(result.coversTotal).toBe(6)
    // The scores behind it: every theme and every genre with its points and its covers.
    expect(result.themes.map(item => [item.score, item.covers])).toEqual([[2, 2], [2, 2], [1, 0], [1, 0], [0, 0], [0, 0], [0, 0], [0, 0]])
    expect(result.genres).toHaveLength(10)
    expect(result.genres.map(item => [item.score, item.covers])).toEqual([[3, 1], [2, 1], [2, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]])
    expect(result.genres.map(item => item.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(result.genres.slice(0, 2).map(item => item.genre)).toEqual(result.aiCover.map(item => item.genre))
    // Each genre names the video theme it stands for and the recipe of its cover.
    for (const item of result.genres) expect(vkGenres.find(genre => genre.id === item.genre)).toMatchObject({ title: item.title, recipeId: item.recipeId, theme: item.theme })
  })

  it.each([{ status: 'unavailable' } as const, { status: 'skipped' } as const])(
    'gives a hero without a photo plain recommendations, six covers by three themes and no AI cover: %o', photo => {
      const drawn = choices(['standup', 'rest'], 'hero')
      const result = buildVkResult(drawn, photo, at, () => 0)
      expect(result.aiCover).toEqual([])
      expect(result.genres).toEqual([])
      expect(result.covers).toEqual(drawn.rankedThemes.slice(0, 3).map(theme => ({ theme, count: 2 })))
      expect(result.coversTotal).toBe(6)
      expect(result.themes.map(item => item.covers)).toEqual([2, 2, 2, 0, 0, 0, 0, 0])
      // The same covers as for an answer that never offered a photo; the answer of the hero and the photo stay on record.
      const plain = buildVkResult({ ...drawn, discoveryAnswerId: 'familiar' }, { status: 'not-requested' }, at)
      expect(result.covers).toEqual(plain.covers)
      expect(result.discovery.answerId).toBe('hero')
      expect(result.photo).toEqual(photo)
    })

  it('gives the hero AI covers only with an approved photo', () => {
    const drawn = choices(['standup', 'rest'], 'hero')
    const result = buildVkResult(drawn, { status: 'accepted', captureId: 'photo-0001' }, at, () => 0)
    expect(result.aiCover.map(item => item.count)).toEqual([1, 1])
    expect(new Set(result.aiCover.map(item => item.genre))).toEqual(new Set(['COMEDY', 'MUSICLE']))
    expect(result.covers.map(item => item.count)).toEqual([2, 2])
    expect(result.coversTotal).toBe(6)
  })

  it('draws genres with equal points once, by the given draw', () => {
    // standup + learn: COMEDY 2, DETECTIVE 2, then four genres with a point.
    const pick = (value: number) => buildVkResult(choices(['standup', 'learn'], 'hero'), { status: 'accepted', captureId: 'photo-0001' }, at, () => value)
    const low = pick(0), high = pick(0.999)
    for (const result of [low, high]) {
      expect(new Set(result.aiCover.map(item => item.genre))).toEqual(new Set(['COMEDY', 'DETECTIVE']))
      expect(result.genres.map(item => item.score)).toEqual([2, 2, 1, 1, 1, 1, 0, 0, 0, 0])
    }
    expect(low.genres.map(item => item.genre)).not.toEqual(high.genres.map(item => item.genre))
  })

  it('lists all eight themes in the order drawn for the visitor, with their points', () => {
    const drawn = choices(['series', 'heroes'], 'new', () => 0.999)
    const { themes, covers } = buildVkResult(drawn, { status: 'not-requested' }, at)
    expect(themes.map(item => item.theme)).toEqual(drawn.rankedThemes)
    expect(themes.map(item => item.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(new Set(themes.map(item => item.theme))).toEqual(new Set(vkThemes))
    expect(themes.map(item => item.score)).toEqual([2, 2, 1, 1, 0, 0, 0, 0])
    expect(themes.filter(item => item.covers > 0).map(item => item.theme)).toEqual(covers.map(item => item.theme))
    // The ties are not drawn again: another draw of the same answers gives its own order, and the result keeps it.
    const other = choices(['series', 'heroes'], 'new', () => 0)
    expect(buildVkResult(other, { status: 'not-requested' }, at).themes.map(item => item.theme)).toEqual(other.rankedThemes)
  })

  it('gives every combination of answers six covers, the points of the scoring and never a tag twice', () => {
    for (const first of vkQuestions[0].options) for (const second of vkQuestions[1].options) for (const third of vkQuestions[2].options) {
      // The hero is taken here with an approved photo; without one the covers are those of the other answers.
      const hero = third.id === 'hero'
      const result = buildVkResult(choices([first.id, second.id], third.id), hero ? { status: 'accepted', captureId: 'photo-0001' } : { status: 'not-requested' }, at)
      expect(result.coversTotal).toBe(6)
      expect(result.covers.reduce((total, item) => total + item.count, 0) + result.aiCover.reduce((total, item) => total + item.count, 0)).toBe(6)
      expect([result.covers.length, result.aiCover.length]).toEqual(hero ? [2, 2] : [3, 0])
      expect(result.themes.reduce((total, item) => total + item.covers, 0)).toBe(hero ? 4 : 6)
      expect(result.genres.reduce((total, item) => total + item.covers, 0)).toBe(hero ? 2 : 0)
      const scores = new Map(calculateThemeScores([first.id, second.id]).map(item => [item.theme, item.score]))
      expect(result.themes.every(item => item.score === scores.get(item.theme))).toBe(true)
      expect(result.themes.map(item => item.score)).toEqual([...result.themes.map(item => item.score)].sort((a, b) => b - a))
      expect(result.themes.filter(item => item.covers > 0).every(item => item.score > 0)).toBe(true)
      const genreScores = new Map(calculateGenreScores([first.id, second.id]).map(item => [item.genre, item.score]))
      expect(result.genres.every(item => item.score === genreScores.get(item.genre))).toBe(true)
      expect(result.genres.filter(item => item.covers > 0).every(item => item.score > 0)).toBe(true)
      expect(new Set(result.tags).size).toBe(result.tags.length)
      expect(result.answers.map(answer => answer.answerId)).toEqual(hero ? [first.id, second.id, third.id, 'accept'] : [first.id, second.id, third.id])
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
    expect(result.discovery).toEqual({ answerId: 'hero', rule: 'Формируется пул обложек с учетом выбранных тематик, на которых размещен образ пользователя' })
  })

  it('refuses answers the test does not have', () => {
    expect(() => buildVkResult(choices(['series', 'drive'], 'unknown'), { status: 'not-requested' }, at)).toThrow()
  })
})
