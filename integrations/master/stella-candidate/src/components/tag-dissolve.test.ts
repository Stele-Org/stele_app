// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'
import type { BubbleEntry } from '../vendor/lumicells-scene/bubbles'
import { TagDissolve, encodeText, tagCode, tagDissolveTimeline, tagThreads, threadCrossings, threadsUnderTags, type Thread } from './tag-dissolve'
import { clearTagPositions, dissolveTagBox } from '../features/prototype/tag-layout'
import { tagBatches } from '../features/prototype/tag-reveal'
import { answerCardPosition } from '../features/prototype/answer-card-layout'
import { vkPhotoOptions, vkQuestions } from '../content/vkVideo'

type ClockOptions = { duration: number; ease: string; onUpdate: (time: number) => void; onComplete: () => void }
const clock = vi.hoisted(() => ({ tracks: [] as Array<{
  options: ClockOptions; pause: ReturnType<typeof vi.fn>; play: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>
}> }))
vi.mock('motion', () => ({ animate: (_from: number, _to: number, options: ClockOptions) => {
  const track = { options, pause: vi.fn(), play: vi.fn(), stop: vi.fn() }
  clock.tracks.push(track)
  return track
} }))

beforeEach(() => { clock.tracks.length = 0 })

const words = ['обсуждения', 'сериал', 'премьера', 'популярное']
const places = [[.74, .46], [.26, .65], [.74, .81], [.26, .99]]

function scene(reduced = false, retiring: HTMLElement | null = null) {
  const root = document.createElement('div')
  const flights: string[] = []
  const entries: BubbleEntry[] = words.map((word, i) => {
    const el = document.createElement('span'), label = document.createElement('span')
    label.className = 'lc-scene-label'
    label.textContent = word
    el.append(label)
    root.append(el)
    return {
      el, resetHover: vi.fn(),
      item: { id: String(i), kind: 'topic', fx: places[i][0], fy: places[i][1], h: 26, order: i },
      info: () => ({ id: String(i), label: word, kind: 'topic', color: '#0481f5', selected: i === 0 }),
    }
  })
  const drawn: string[] = []
  const context = new Proxy({}, {
    get: (_target, key) => key === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => { drawn.push(String(key)) },
    set: () => true,
  })
  const canvas = { getContext: () => context, getBoundingClientRect: () => ({ width: 1080 }), width: 0, height: 0 } as unknown as HTMLCanvasElement
  const closing = vi.fn(), done = vi.fn()
  const motion = new TagDissolve(root, () => entries,
    () => ({ onFlight: (_el, info, phase) => { flights.push(`${root.dataset.phase}:${info.label}:${phase}`) } }),
    { canvas, card: { x: 45, y: 549, w: 468, h: 280 }, seed: 7, reduced, onClosing: closing, retiring })
  void motion.revealOnce(350, done)
  const track = clock.tracks.at(-1)!
  const at = (time: number) => { drawn.length = 0; track.options.onUpdate(time); return drawn.filter(call => call === 'arc').length }
  return { root, entries, flights, closing, done, motion, track, at }
}

it('keeps the accepted D2 timings for four tags', () => {
  const timeline = tagDissolveTimeline(4)
  expect(timeline.enter(0)).toBeCloseTo(0.5)
  expect(timeline.enter(3)).toBeCloseTo(0.95)
  expect(timeline.encode(0)).toBeCloseTo(3.95)
  expect(timeline.dissolve(0)).toBeCloseTo(4.95)
  expect(timeline.dissolve(3)).toBeCloseTo(5.31)
  expect(timeline.duration).toBeCloseTo(11.06)
  // Dots fly to the heap from 6.95 s; the last one is gone past the corner at 10.46 s.
  expect(timeline.gather).toBeCloseTo(6.95)
  expect(timeline.gone).toBeCloseTo(10.46)
  // The answer card has faded 0.75 s before that.
  expect(timeline.cardGone).toBeCloseTo(9.71)
})

it('speeds the cloud up over its last second: two authored seconds pass in one', () => {
  const timeline = tagDissolveTimeline(4)
  expect(timeline.rush).toBeCloseTo(9.46)
  // Before the rush the dots keep the authored clock.
  expect(timeline.cloud(6.95)).toBe(6.95)
  expect(timeline.cloud(timeline.rush)).toBe(timeline.rush)
  // Constant acceleration: a quarter of the extra second by the middle, all of it at the end.
  expect(timeline.cloud(9.96)).toBeCloseTo(10.21)
  expect(timeline.cloud(timeline.gone)).toBeCloseTo(11.46)
  // The clock runs at the authored rate where the rush begins and three times as fast where it ends.
  const rate = (at: number) => (timeline.cloud(at + 1e-4) - timeline.cloud(at)) / 1e-4
  expect(rate(timeline.rush)).toBeCloseTo(1, 2)
  expect(rate(timeline.gone - 1e-4)).toBeCloseTo(3, 2)
})

it('fades the answer card and its field shadow while the dots gather, and ends 0.75 s before the last dot leaves', () => {
  const card = document.createElement('button')
  card.setAttribute('data-lc-strength', '1')
  const { at, track, done } = scene(false, card)
  at(6.9)
  expect(card.style.opacity).toBe('')
  expect(card.getAttribute('data-lc-strength')).toBe('1')
  // Half-way through the 2.8225 s the fade takes on the clock of the dots.
  at(6.95 + 2.8225 / 2)
  expect(Number(card.style.opacity)).toBeCloseTo(0.5, 2)
  expect(card.getAttribute('data-lc-strength')).toBe('0.5')
  // Nearly gone when the cloud starts its rush, and gone a quarter of a second into it.
  at(9.46)
  expect(Number(card.style.opacity)).toBeCloseTo(0.025, 2)
  expect(Number(card.style.opacity)).toBeGreaterThan(0)
  at(9.71)
  expect(Number(card.style.opacity)).toBe(0)
  expect(card.getAttribute('data-lc-strength')).toBe('0')
  at(10.46)
  expect(Number(card.style.opacity)).toBe(0)
  // A finished scene leaves the card faded for its exit.
  track.options.onComplete()
  expect(done).toHaveBeenCalledOnce()
  expect(Number(card.style.opacity)).toBe(0)
})

it('fades the shadow from what the card casts when its fade begins: a card tapped early is still arriving', () => {
  const card = document.createElement('button')
  card.setAttribute('data-lc-strength', '0.4')
  const { at } = scene(false, card)
  at(1)
  card.setAttribute('data-lc-strength', '1')
  at(6.95 + 2.8225 / 2)
  expect(card.getAttribute('data-lc-strength')).toBe('0.5')
})

it('gives the answer card back when the scene is interrupted, and leaves earlier batches alone', () => {
  const card = document.createElement('button')
  card.setAttribute('data-lc-strength', '1')
  const interrupted = scene(false, card)
  interrupted.at(9)
  expect(Number(card.style.opacity)).toBeLessThan(1)
  interrupted.motion.dispose()
  expect(card.style.opacity).toBe('')
  expect(card.getAttribute('data-lc-strength')).toBe('1')
  const earlier = scene()
  earlier.at(9)
  expect(card.style.opacity).toBe('')
})

it('routes the threads of every real batch so that none crosses another or runs under a tag of another', () => {
  const cards = [
    ...[0, 1, 2, 3].map(slot => ({ ...answerCardPosition({ slot, product: 'vk-video', layout: 'grid', choiceCount: 4 }), photo: false })),
    { ...answerCardPosition({ slot: 0, product: 'vk-video', layout: 'photo', choiceCount: 2 }), photo: true },
  ]
  const batches = [...vkQuestions.flatMap(question => question.options), ...vkPhotoOptions].flatMap(option => tagBatches(option.metadata))
  // The look before the fix: neighbours bend opposite ways by 140px whatever happens.
  const authored = (threads: Thread[]) => threads.map(({ origin, rest }, index) => {
    const nx = -(rest.y - origin.y), ny = rest.x - origin.x, length = Math.hypot(nx, ny) || 1, reach = index % 2 ? 140 : -140
    return { origin, rest, bend: { x: (origin.x + rest.x) / 2 + nx / length * reach, y: (origin.y + rest.y) / 2 + ny / length * reach } }
  })
  let crossedBefore = 0, kept = 0, layouts = 0
  for (const card of cards) for (const tags of batches) for (let seed = 0; seed < 60; seed++) {
    const sizes = tags.map((tag, i) => dissolveTagBox(tag, i === 0))
    const rests = clearTagPositions(card, sizes, seed, 0).map(({ fx, fy }) => ({ x: fx * 1080, y: fy * 1080 + 100 }))
    const threads = tagThreads({ x: card.left, y: card.top, w: card.width, h: card.height }, rests, sizes)
    expect(threads).toHaveLength(tags.length)
    expect(threadCrossings(threads)).toBe(0)
    expect(threadsUnderTags(threads, sizes)).toBe(0)
    // Every thread keeps the authored depth of its curve: none had to flatten.
    for (const { origin, bend, rest } of threads) expect(Math.hypot(bend.x - (origin.x + rest.x) / 2, bend.y - (origin.y + rest.y) / 2)).toBeCloseTo(140)
    const before = authored(threads)
    layouts++
    if (threadCrossings(before)) crossedBefore++
    // A layout that was clear already is left exactly as authored.
    if (!threadCrossings(before) && !threadsUnderTags(before, sizes)) { kept++; expect(threads).toEqual(before) }
  }
  // The defect was real: about a fifth of the layouts crossed; most of the rest stay untouched.
  expect(crossedBefore / layouts).toBeGreaterThan(0.15)
  expect(kept / layouts).toBeGreaterThan(0.5)
})

it('turns a Russian tag into a short stable code', () => {
  expect(tagCode('сериал', 1)).toMatch(/^#serial:[0-9A-F]{2}$/)
  expect(tagCode('сериал', 1)).toBe(tagCode('сериал', 1))
  expect(tagCode('документальное кино', 2)).toMatch(/^#dokumenta:[0-9A-F]{2}$/)
  expect(tagCode('VK Видео', 0)).toMatch(/^#vk_video:[0-9A-F]{2}$/)
  expect(encodeText('сериал', '#serial:3F', 0)).toBe('сериал')
  expect(encodeText('сериал', '#serial:3F', 1)).toHaveLength(10)
  expect(encodeText('сериал', '#serial:3F', 1).startsWith('#serial')).toBe(true)
})

it('runs one linear clock for the whole batch and reports every flight exactly once', () => {
  const { root, entries, flights, closing, done, track, at } = scene()
  expect(track.options.duration).toBeCloseTo(11.06)
  expect(track.options.ease).toBe('linear')
  expect(root.dataset.phase).toBe('entering')

  at(0.2)
  expect(flights).toEqual([])
  expect(Number(entries[0].el.style.opacity)).toBe(0)

  at(0.6)
  expect(flights).toEqual(['entering:обсуждения:start'])
  expect(entries[0].el.hasAttribute('data-shown')).toBe(true)

  at(3.2)
  expect(flights.filter(flight => flight.endsWith(':end'))).toHaveLength(4)
  expect(root.dataset.phase).toBe('idle')
  // Landed tags are readable at once: no encoding before the authored pause ends.
  expect(entries.map(entry => entry.el.textContent)).toEqual(words)
  expect(Number(entries[0].el.style.opacity)).toBe(1)
  expect(entries[0].el.style.filter).toBe('none')
  expect(entries[0].el.hasAttribute('data-encoded')).toBe(false)

  at(4.9)
  expect(entries[0].el.hasAttribute('data-encoded')).toBe(true)
  expect(entries[0].el.textContent!.startsWith('#obsuzhde')).toBe(true)
  expect(root.dataset.phase).toBe('idle')

  at(5.0)
  expect(root.dataset.phase).toBe('leaving')
  expect(flights.at(-1)).toBe('leaving:обсуждения:start')

  at(6)
  expect(entries.every(entry => Number(entry.el.style.opacity) === 0)).toBe(true)
  expect(flights).toHaveLength(16)
  expect(new Set(flights).size).toBe(16)
  expect(closing).not.toHaveBeenCalled()

  at(10.2)
  expect(closing).not.toHaveBeenCalled()
  at(10.3)
  expect(closing).toHaveBeenCalledOnce()
  expect(done).not.toHaveBeenCalled()
  track.options.onComplete()
  expect(done).toHaveBeenCalledOnce()
  expect(closing).toHaveBeenCalledOnce()
  expect(root.dataset.phase).toBe('hidden')
})

it('scatters each tag into dots that all leave before the scene ends', () => {
  const { at, track } = scene()
  for (const time of [0.6, 3.2, 5, 5.4]) at(time)
  // Mid-scatter and mid-gather: the dots of four tags are on screen, the threads are gone.
  expect(at(7)).toBeGreaterThan(200)
  expect(at(9)).toBeGreaterThan(200)
  // The rush: dots are still leaving half-way through it and none is left once it ends.
  expect(at(9.96)).toBeGreaterThan(0)
  expect(at(10.47)).toBe(0)
  expect(at(track.options.duration)).toBe(0)
})

it('pauses, resumes and restores the tags on dispose', () => {
  const { root, entries, motion, track, at } = scene()
  for (const time of [0.6, 3.2, 4.9]) at(time)
  motion.setPlaying(false)
  expect(track.pause).toHaveBeenCalledOnce()
  motion.setPlaying(true)
  expect(track.play).toHaveBeenCalledOnce()
  motion.dispose()
  expect(track.stop).toHaveBeenCalledOnce()
  expect(entries.map(entry => entry.el.textContent)).toEqual(words)
  expect(entries[0].el.getAttribute('style') ?? '').not.toContain('transform')
  expect(entries[0].el.hasAttribute('data-shown')).toBe(false)
  expect(entries[0].el.hasAttribute('data-encoded')).toBe(false)
  expect(root.dataset.phase).toBeUndefined()
})

it('keeps reduced motion to a short readable fade without flights or dots', () => {
  const { entries, flights, closing, done, track, at } = scene(true)
  expect(track.options.duration).toBeCloseTo(2.4)
  expect(at(1)).toBe(0)
  expect(entries.map(entry => entry.el.textContent)).toEqual(words)
  expect(Number(entries[0].el.style.opacity)).toBe(1)
  expect(entries[0].el.style.transform).toBe('')
  expect(at(2.1)).toBe(0)
  expect(closing).toHaveBeenCalledOnce()
  track.options.onComplete()
  expect(flights).toHaveLength(16)
  expect(done).toHaveBeenCalledOnce()
})
