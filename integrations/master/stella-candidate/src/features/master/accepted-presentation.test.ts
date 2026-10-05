import { describe, expect, it } from 'vitest'
import type { QuestionPresentation } from '../prototype/question-presentation'
import type { TagReveal } from '../prototype/tag-reveal'
import { acceptedVkAnswerLabel, acceptedVkQuestion, acceptedVkReveal } from './accepted-presentation'

describe('accepted VK display wording', () => {
  it('changes only the drive answer label and preserves the server question and other options', () => {
    const metadata = ['азарт', 'игры']
    const drive = { id: 'drive', label: 'Чтобы смеяться', metadata, weight: 2 }
    const other = { id: 'rest', label: 'Frozen server wording' }
    const question: QuestionPresentation = { id: 'ideal-content', product: 'vk-video', prompt: 'Frozen question',
      layout: 'grid', answering: false, options: [drive, other] }
    const result = acceptedVkQuestion(question)!
    expect(result.options[0]).toEqual({ ...drive, label: 'Чтобы был азарт и драйв' })
    expect((result.options[0] as typeof drive).metadata).toBe(metadata)
    expect(result.options[1]).toBe(other)
    expect(result.id).toBe(question.id)
    expect(result.prompt).toBe(question.prompt)
    expect(drive.label).toBe('Чтобы смеяться')
    expect(question.options[0]).toBe(drive)
    expect(acceptedVkQuestion(result)).toBe(result)
  })

  it('changes the visible reveal label while keeping raw source, metadata batches and transition identity', () => {
    const next = { type: 'home' as const }
    const source = { type: 'vk-answer-reveal' as const, questionIndex: 1, optionIndex: 0,
      label: 'Чтобы смеяться', metadata: ['азарт', 'драйв'], next }
    const reveal: TagReveal = { source, next, product: 'vk-video', label: source.label,
      batches: [source.metadata], answerCard: { index: 0, tone: 'blue', artworkId: 'drive' } }
    const result = acceptedVkReveal(reveal)!
    expect(result.label).toBe('Чтобы был азарт и драйв')
    expect(result.source).toBe(source)
    expect(result.batches).toBe(reveal.batches)
    expect(result.next).toBe(next)
    expect(result.answerCard).toBe(reveal.answerCard)
    expect(reveal.label).toBe('Чтобы смеяться')
  })

  it('does not replace unknown server wording, null values or MAX display objects', () => {
    expect(acceptedVkAnswerLabel('rest', 'Frozen server wording')).toBe('Frozen server wording')
    expect(acceptedVkAnswerLabel(undefined, 'Чтобы смеяться')).toBe('Чтобы смеяться')
    expect(acceptedVkQuestion(null)).toBeNull()
    expect(acceptedVkReveal(null)).toBeNull()
    const question: QuestionPresentation = { id: 'max-goal', product: 'max', prompt: 'Goal',
      layout: 'grid', answering: false, options: [{ id: 'drive', label: 'MAX server wording' }] }
    expect(acceptedVkQuestion(question)).toBe(question)
  })
})
