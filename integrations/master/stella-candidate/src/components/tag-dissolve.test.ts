// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'
import type { BubbleEntry } from '../vendor/lumicells-scene/bubbles'
import { TagDissolve, encodeText, tagCode, tagDissolveTimeline } from './tag-dissolve'

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

function scene(reduced = false) {
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
    { canvas, card: { x: 45, y: 549, w: 468, h: 280 }, seed: 7, reduced, onClosing: closing })
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
  expect(timeline.duration).toBeCloseTo(12.06)
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
  expect(track.options.duration).toBeCloseTo(12.06)
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

  at(11.3)
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
