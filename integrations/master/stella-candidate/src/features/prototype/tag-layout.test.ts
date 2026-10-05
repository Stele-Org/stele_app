import { describe, expect, it } from 'vitest'
import { tagPositions } from './tag-layout'
import type { TagReveal } from './tag-reveal'

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
