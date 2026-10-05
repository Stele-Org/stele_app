import { seeded } from '../../vendor/lumicells-scene/flight'
import type { TagReveal } from './tag-reveal'

// Layout parameters for the author's motion, in the 1080 × 1280 content area.
// Each region reserves up to 440 × 100px for a landed tag, away from the answer.
export function tagPositions(card: TagReveal['answerCard'], seed: number, batch: number) {
  const random = seeded(seed + batch * 7919)
  const side = card?.index && card.index % 2 ? 800 : 280
  const opposite = 1080 - side
  const regions = !card
    ? [[280, 660, 35, 30], [800, 810, 35, 30], [280, 1000, 35, 30], [800, 1170, 35, 25]]
    : card.photo
      ? [[280, 610, 35, 25], [800, 650, 35, 25], [280, 1030, 35, 30], [800, 1170, 35, 25]]
      : card.centered
        ? [[280, 610, 25, 20], [800, 610, 25, 20], [280, 785, 25, 20], [800, 785, 25, 20]]
      : card.index < 2
        ? [[opposite, 600, 25, 20], [opposite, 805, 25, 25], [side, 980, 35, 35], [opposite, 1170, 35, 25]]
        : [[side, 625, 35, 30], [opposite, 735, 25, 30], [opposite, 970, 25, 30], [side, 1210, 35, 8]]
  const offset = Math.floor(random() * regions.length)
  const direction = random() < .5 ? 1 : -1
  return regions.map((_, i) => {
    const [x, y, dx, dy] = regions[(offset + direction * i + regions.length) % regions.length]
    return {
      fx: (x + (random() * 2 - 1) * dx) / 1080,
      // Author stage is a centered 1080px square, starting 100px below content top.
      fy: (y + (random() * 2 - 1) * dy - 100) / 1080,
    }
  })
}

/** A landed VK Видео tag, canvas px. */
export interface TagBox { w: number; h: number }
/** The answer card on the 1080px-wide canvas; the photo answer sits in the middle and hides its heading. */
export interface AnswerCardRect { left: number; top: number; width: number; height: number; photo?: boolean }

/** A landed tag keeps one and a half of its own height clear of the answer card (user requirement, 05.10.2026).
 * The margin on top covers the sway of the tag and the float of the card. */
const CLEAR_HEIGHTS = 1.5
const SWAY = 16
const SCREEN_LEFT = 10, SCREEN_RIGHT = 1070, MIDDLE = 540
/** The longest code a tag turns into: '#', nine letters, ':' and two hex digits (tagCode in tag-dissolve.ts). */
const CODE_LENGTH = 13

/** Upper bound of a landed tag of the particle scene (tag-dissolve.css): the readable word or its code, whichever is wider. */
export function dissolveTagBox(label: string, primary: boolean): TagBox {
  const font = primary ? 38 : 32, padding = primary ? 48 : 40
  // Advance per character: VK Sans Display and Max Sans stay under .64em, the monospace code under .56em.
  const text = Math.max([...label].length * .64, CODE_LENGTH * .56) * font
  return { w: Math.ceil(text + padding * 2 + 4), h: primary ? 92 : 80 }
}

/** A band runs the full width above or below the card and takes a tag of any width in its half of the screen;
 * a column slot lies beside the card and takes what fits between the clearance and the screen edge. */
interface Slot { y: number; dy: number; band: boolean; left: boolean }

/**
 * Landing places for the tags of VK Видео: none closer to the answer card than one and a half of its own height.
 * Centres are returned as fractions of the 1080px tag stage, like `tagPositions`.
 */
export function clearTagPositions(card: AnswerCardRect, boxes: TagBox[], seed: number, batch: number) {
  const random = seeded(seed + batch * 7919)
  const cardRight = card.left + card.width, cardOnLeft = card.left + card.width / 2 < MIDDLE
  const clear = (box: TagBox) => box.h * CLEAR_HEIGHTS + SWAY
  const band = (y: number, dy: number, cardSide: boolean): Slot => ({ y, dy, band: true, left: cardSide === cardOnLeft })
  const column = (y: number, dy: number): Slot => ({ y, dy, band: false, left: !cardOnLeft })
  const slots = card.photo
    // The photo answer: two tags above it, two below.
    ? [band(490, 40, true), band(480, 40, false), band(1120, 25, true), band(1190, 25, false)]
    : Math.abs(card.left + card.width / 2 - MIDDLE) < 60
      // A lone answer in the middle of the bottom row (MAX): no room beside or under it, two rows of tags above.
      ? [band(495, 12, true), band(495, 12, false), band(645, 15, true), band(645, 15, false)]
      : card.top < 700
        // An answer of the top row: two tags beside it, two in the band below.
        ? [column(610, 25), column(815, 30), band(1045, 15, true), band(1195, 20, false)]
        // An answer of the bottom row: nothing fits under it, so two tags go above and two beside.
        : [band(620, 30, true), band(630, 25, false), column(845, 30), column(1060, 30)]
  const columnWidth = (box: TagBox) => cardOnLeft ? SCREEN_RIGHT - cardRight - clear(box) : card.left - clear(box) - SCREEN_LEFT
  const shuffle = <T>(items: T[]) => {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1)), held = items[i]
      items[i] = items[j]
      items[j] = held
    }
    return items
  }
  const bands = shuffle(slots.filter(slot => slot.band)), columns = shuffle(slots.filter(slot => !slot.band))
  const placed: Slot[] = []
  // Tags too wide for the column take the bands, the widest first; the rest land at random.
  const widestFirst = boxes.map((_, i) => i).sort((a, b) => boxes[b].w - boxes[a].w)
  for (const i of widestFirst) if (boxes[i].w > columnWidth(boxes[i])) placed[i] = bands.shift() ?? columns.shift() ?? slots[i % slots.length]
  const free = shuffle([...bands, ...columns])
  for (const i of widestFirst) placed[i] ??= free.shift() ?? slots[i % slots.length]
  return boxes.map((box, i) => {
    const slot = placed[i], half = box.w / 2
    let x: number
    if (slot.band) {
      // Each band tag keeps to its half of the screen; one wider than the half only has to stay on the screen.
      const fits = box.w <= MIDDLE - 10 - SCREEN_LEFT
      const from = (slot.left || !fits ? SCREEN_LEFT : MIDDLE + 10) + half, to = Math.max(from, (slot.left && fits ? MIDDLE - 10 : SCREEN_RIGHT) - half)
      x = Math.min(to, Math.max(from, (slot.left ? 280 : 800) + (random() * 2 - 1) * 35))
    } else {
      const room = Math.max(0, Math.min(60, columnWidth(box) - box.w)) * random()
      // A tag wider than the column stays on the screen and gives up part of its clearance.
      x = cardOnLeft ? Math.min(cardRight + clear(box) + half + room, SCREEN_RIGHT - half) : Math.max(card.left - clear(box) - half - room, SCREEN_LEFT + half)
    }
    return { fx: x / 1080, fy: (slot.y + (random() * 2 - 1) * slot.dy - 100) / 1080 }
  })
}
