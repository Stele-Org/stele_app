import { describe, expect, it } from 'vitest'
import type { QuestionPresentation } from '../prototype/question-presentation'
import type { TagReveal } from '../prototype/tag-reveal'
import { acceptedVkAnswerLabel, acceptedVkQuestion, acceptedVkReveal } from './accepted-presentation'

describe('accepted VK display wording', () => {
  it('changes the labels of the second question only and preserves the server question and other options', () => {
    const metadata = ['азарт', 'игры']
    const drive = { id: 'drive', label: 'Чтобы смеяться', metadata, weight: 2 }
    const other = { id: 'series', label: 'Frozen server wording' }
    const question: QuestionPresentation = { id: 'ideal-content', product: 'vk-video', prompt: 'Frozen question',
      layout: 'grid', answering: false, options: [drive, other] }
    const result = acceptedVkQuestion(question)!
    expect(result.options[0]).toEqual({ ...drive, label: 'Драйвовый' })
    expect((result.options[0] as typeof drive).metadata).toBe(metadata)
    expect(result.options[1]).toBe(other)
    expect(result.id).toBe(question.id)
    expect(result.prompt).toBe(question.prompt)
    expect(drive.label).toBe('Чтобы смеяться')
    expect(question.options[0]).toBe(drive)
    expect(acceptedVkQuestion(result)).toBe(result)
  })

  it('gives all four answers of the second question the approved wording', () => {
    const question: QuestionPresentation = { id: 'ideal-content', product: 'vk-video', prompt: 'Frozen question',
      layout: 'grid', answering: false, options: ['drive', 'heroes', 'learn', 'rest'].map(id => ({ id, label: `Server ${id}` })) }
    expect(acceptedVkQuestion(question)!.options.map(option => option.label))
      .toEqual(['Драйвовый', 'Захватывающий', 'Познавательный', 'Расслабляющий'])
  })

  it('changes the visible reveal label while keeping raw source, metadata batches and transition identity', () => {
    const next = { type: 'home' as const }
    const source = { type: 'vk-answer-reveal' as const, questionIndex: 1, optionIndex: 0,
      label: 'Чтобы смеяться', metadata: ['азарт', 'драйв'], next }
    const reveal: TagReveal = { source, next, product: 'vk-video', label: source.label,
      batches: [source.metadata], answerCard: { index: 0, tone: 'blue', artworkId: 'drive' } }
    const result = acceptedVkReveal(reveal)!
    expect(result.label).toBe('Драйвовый')
    expect(result.source).toBe(source)
    expect(result.batches).toBe(reveal.batches)
    expect(result.next).toBe(next)
    expect(result.answerCard).toBe(reveal.answerCard)
    expect(reveal.label).toBe('Чтобы смеяться')
    expect(acceptedVkReveal({ ...reveal, answerCard: { index: 3, tone: 'blue', artworkId: 'rest' } })!.label).toBe('Расслабляющий')
  })

  it('gives the photo step its approved heading and button and drops the description', () => {
    const skip = { id: 'skip', label: 'Пропустить' }
    const question: QuestionPresentation = { id: 'photo', product: 'vk-video', prompt: 'Сделаем фото?', description: 'На его основе…',
      layout: 'photo', answering: false, options: [{ id: 'accept', label: 'Да, давайте' }, skip] }
    const result = acceptedVkQuestion(question)!
    expect(result.prompt.replace(/\s+/g, ' ')).toBe('Ты – главный герой VK Видео')
    expect(result.description).toBeUndefined()
    expect(result.options).toEqual([{ id: 'accept', label: 'Начать' }, skip])
    expect(result.options[1]).toBe(skip)
    expect(question.prompt).toBe('Сделаем фото?')
    expect(acceptedVkQuestion(result)).toBe(result)
  })

  it('does not replace unknown server wording, null values or MAX display objects', () => {
    expect(acceptedVkAnswerLabel('series', 'Frozen server wording')).toBe('Frozen server wording')
    expect(acceptedVkAnswerLabel(undefined, 'Чтобы смеяться')).toBe('Чтобы смеяться')
    expect(acceptedVkQuestion(null)).toBeNull()
    expect(acceptedVkReveal(null)).toBeNull()
    const question: QuestionPresentation = { id: 'max-goal', product: 'max', prompt: 'Goal',
      layout: 'grid', answering: false, options: [{ id: 'drive', label: 'MAX server wording' }] }
    expect(acceptedVkQuestion(question)).toBe(question)
  })
})
