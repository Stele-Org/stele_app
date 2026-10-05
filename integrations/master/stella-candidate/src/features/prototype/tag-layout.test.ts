import { describe, expect, it } from 'vitest'
import { clearTagPositions, dissolveTagBox, tagPositions, type AnswerCardRect, type TagBox } from './tag-layout'
import { tagBatches, type TagReveal } from './tag-reveal'
import { answerCardPosition } from './answer-card-layout'
import { vkPhotoOptions, vkQuestions } from '../../content/vkVideo'
import { maxAudienceOptions, maxGoalOptions } from '../../content/max'

const cards: TagReveal['answerCard'][] = [undefined,
  ...[0, 1, 2, 3].map(index => ({ index, tone: 'blue' as const })),
  { index: 0, tone: 'red', photo: true },
  { index: 2, tone: 'violet', centered: true },
]

describe('bounded random layout passed to native LumiCells flight', () => {
  it('keeps a stable layout for a paused/re-rendered batch and varies answers and batches', () => {
    const layout = tagPositions(cards[1], 123, 0)
    expect(tagPositions(cards[1], 123, 0)).toEqual(layout)
    expect(tagPositions(cards[1], 124, 0)).not.toEqual(layout)
    expect(tagPositions(cards[1], 123, 1)).not.toEqual(layout)
  })

  it.each(cards)('reserves readable, separate landing boxes around card %j', card => {
    // Geometry contract only: real text, shadows and moving paths need user review.
    for (let seed = 0; seed < 100; seed++) {
      for (let batch = 0; batch < 3; batch++) {
        const positions = tagPositions(card, seed, batch)
        const boxes = positions.map(({ fx, fy }) => ({ x: fx * 1080, y: fy * 1080 + 100 }))
        expect(Math.max(...boxes.map(p => p.x)) - Math.min(...boxes.map(p => p.x))).toBeGreaterThan(400)
        for (const [i, box] of boxes.entries()) {
          expect(box.x - 220).toBeGreaterThanOrEqual(10)
          expect(box.x + 220).toBeLessThanOrEqual(1070)
          expect(box.y - 50).toBeGreaterThanOrEqual(520)
          expect(box.y + 50).toBeLessThanOrEqual(1270)
          for (const other of boxes.slice(i + 1)) {
            expect(Math.abs(box.x - other.x) >= 440 || Math.abs(box.y - other.y) >= 100).toBe(true)
          }
          if (card) {
            const rect = card.photo ? { x: 332.5, y: 750, w: 415, h: 140 }
              : card.centered ? { x: 307.5, y: 869, w: 465, h: 280 }
              : { x: card.index % 2 ? 558.5 : 45.27, y: card.index < 2 ? 549 : 869, w: 468, h: 280 }
            expect(box.x + 220 <= rect.x || box.x - 220 >= rect.x + rect.w
              || box.y + 50 <= rect.y || box.y - 50 >= rect.y + rect.h).toBe(true)
          }
        }
      }
    }
  })
})

describe('tags of the particle scene keep clear of the answer card', () => {
  const grid: AnswerCardRect[] = [0, 1, 2, 3].map(slot => answerCardPosition({ slot, product: 'vk-video', layout: 'grid', choiceCount: 4 }))
  const photo: AnswerCardRect = { ...answerCardPosition({ slot: 0, product: 'vk-video', layout: 'photo', choiceCount: 2 }), photo: true }
  // MAX: two answers in the top row for the first question, a lone third answer in the middle of the bottom row for the second.
  const max: AnswerCardRect[] = [0, 1].map(slot => answerCardPosition({ slot, product: 'max', layout: 'grid', choiceCount: 4 }))
    .concat(answerCardPosition({ slot: 2, product: 'max', layout: 'grid', choiceCount: 3 }))
  const real = [...vkQuestions.flatMap(question => question.options), ...vkPhotoOptions, ...maxAudienceOptions, ...maxGoalOptions].flatMap(option => tagBatches(option.metadata))
  // Not in the content today: two tags too wide for the column beside the card, and a short batch.
  const synthetic = [['наука', 'документальное кино', 'образовательные шоу', 'люди'], ['шоу'], ['новости', 'главный герой']]
  const batches = [...real, ...synthetic].map(tags => tags.map((tag, i) => dissolveTagBox(tag, i === 0)))
  /** Free space between two boxes along the axis that separates them. */
  const apart = (a: { l: number; r: number; t: number; b: number }, b: { l: number; r: number; t: number; b: number }) =>
    Math.max(b.l - a.r, a.l - b.r, b.t - a.b, a.t - b.b)

  it('bounds every real tag from above: measured with the app fonts, the widest are 379 and 429 px', () => {
    expect(dissolveTagBox('рекомендации', true)).toMatchObject({ h: 92 })
    expect(dissolveTagBox('рекомендации', true).w).toBeGreaterThanOrEqual(379)
    expect(dissolveTagBox('документальное кино', false).w).toBeGreaterThanOrEqual(429)
    expect(dissolveTagBox('шоу', false)).toMatchObject({ h: 80 })
    // Max Sans: the widest MAX tag measures 403 px.
    expect(dissolveTagBox('поддержка клиентов', false).w).toBeGreaterThanOrEqual(403)
  })

  it.each([...grid, photo, ...max])('lands every tag at least one and a half of its height away from card %j', card => {
    const rect = { l: card.left, r: card.left + card.width, t: card.top, b: card.top + card.height }
    for (const boxes of batches) for (let seed = 0; seed < 60; seed++) {
      const layout = clearTagPositions(card, boxes, seed, 0)
      expect(clearTagPositions(card, boxes, seed, 0)).toEqual(layout)
      const placed = layout.map(({ fx, fy }, i) => {
        const x = fx * 1080, y = fy * 1080 + 100, box: TagBox = boxes[i]
        return { l: x - box.w / 2, r: x + box.w / 2, t: y - box.h / 2, b: y + box.h / 2, h: box.h }
      })
      for (const [i, tag] of placed.entries()) {
        // On the screen, under the heading and inside the content area. The photo answer hides its heading;
        // the lone MAX answer in the middle has a one-line heading, and its tags stand in two rows right under it.
        expect(tag.l).toBeGreaterThanOrEqual(10)
        expect(tag.r).toBeLessThanOrEqual(1070)
        expect(tag.t).toBeGreaterThanOrEqual(card.photo ? 380 : Math.abs(card.left + card.width / 2 - 540) < 60 ? 430 : 535)
        expect(tag.b).toBeLessThanOrEqual(1270)
        // The requirement itself, with room for the sway of the tag and the float of the card.
        expect(apart(tag, rect)).toBeGreaterThanOrEqual(tag.h * 1.5 + 16)
        for (const other of placed.slice(i + 1)) expect(apart(tag, other)).toBeGreaterThanOrEqual(18)
      }
    }
  })

  it('puts nothing under an answer of the bottom row and varies the places between answers', () => {
    const boxes = batches[0]
    for (let seed = 0; seed < 60; seed++) for (const { fy } of clearTagPositions(grid[2], boxes, seed, 0)) expect(fy * 1080 + 100).toBeLessThan(1149)
    expect(clearTagPositions(grid[2], boxes, 1, 0)).not.toEqual(clearTagPositions(grid[2], boxes, 2, 0))
    expect(clearTagPositions(grid[2], boxes, 1, 0)).not.toEqual(clearTagPositions(grid[2], boxes, 1, 1))
  })
})
