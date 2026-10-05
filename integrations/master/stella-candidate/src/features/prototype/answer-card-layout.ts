import type { Product } from '../../types/prototype'

export interface AnswerCardLayout {
  slot: number
  product: Product
  layout: 'grid' | 'photo' | 'gender'
  choiceCount: number
}

/** Shared question/reveal geometry in the authored 1080 × 1920 canvas. */
export function answerCardPosition({ slot, product, layout, choiceCount }: AnswerCardLayout) {
  if (layout === 'photo') return slot === 0
    ? { left: 332.5, top: 750, width: 415, height: 140 }
    : { left: 360.84, top: 930, width: 358.32, height: 120 }
  if (layout === 'gender') return { left: slot === 0 ? 140 : 560, top: 620, width: 380, height: 240 }
  return {
    left: choiceCount === 3 && slot === 2 ? 307.5 : slot % 2 ? 558.5 : 45.27,
    top: slot < 2 ? 549 : 869,
    width: product === 'max' ? 465 : 468,
    height: 280,
  }
}
