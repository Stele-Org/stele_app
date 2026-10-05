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
