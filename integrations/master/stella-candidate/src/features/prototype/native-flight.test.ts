import { describe, expect, it, vi } from 'vitest'
import { Choreographer, type FlightRoute } from '../../vendor/lumicells-scene/choreography'
import type { BubbleEntry } from '../../vendor/lumicells-scene/bubbles'
import { answerCardPosition } from './answer-card-layout'

// Controlled WAAPI boundary: verifies integration lifecycle, not browser rendering/easing.
class AnimationBoundary {
  playState = 'running'
  finished: Promise<void>
  private resolve!: () => void
  private reject!: (reason: Error) => void
  constructor(readonly frames: Keyframe[], readonly options: KeyframeAnimationOptions) {
    this.finished = new Promise((resolve, reject) => { this.resolve = resolve; this.reject = reject })
  }
  pause() { this.playState = 'paused' }
  play() { this.playState = 'running' }
  cancel() {
    if (this.playState !== 'finished' && this.playState !== 'idle') this.reject(new Error('AbortError'))
    this.playState = 'idle'
  }
  finish() { if (this.playState === 'running') { this.playState = 'finished'; this.resolve() } }
}
class ElementBoundary {
  dataset: Record<string, string> = {}
  attributes = new Set<string>()
  animations: AnimationBoundary[] = []
  animate(frames: Keyframe[], options: KeyframeAnimationOptions) {
    const animation = new AnimationBoundary(frames, options)
    this.animations.push(animation)
    return animation as unknown as Animation
  }
  setAttribute(name: string) { this.attributes.add(name) }
  removeAttribute(name: string) { this.attributes.delete(name) }
}
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve() }
function fixture(reduced = false, flightDurationScale = 1, route?: FlightRoute) {
  const root = new ElementBoundary()
  const bubbles = Array.from({ length: 4 }, () => new ElementBoundary())
  const entries: BubbleEntry[] = bubbles.map((el, i) => ({
    el: el as unknown as HTMLElement, item: { id: String(i), kind: 'topic', fx: .3 + i * .1, fy: .7, h: 26, order: i },
    info: () => ({ id: String(i), label: 'tag', kind: 'topic', color: '#ee2848', selected: false }), resetHover: () => {},
  }))
  const onFlight = vi.fn()
  const choreo = new Choreographer(root as unknown as HTMLElement, () => entries, () => ({ onFlight }), () => reduced, flightDurationScale, route)
  const active = () => [root, ...bubbles].flatMap(el => el.animations).filter(a => a.playState !== 'idle' && a.playState !== 'finished')
  const finishFinite = async () => { for (const a of active()) if (a.options.iterations !== Infinity) a.finish(); await flush() }
  return { root, bubbles, entries, choreo, active, finishFinite, onFlight }
}

function selectedCardRoute(): FlightRoute {
  const card = answerCardPosition({ slot: 1, product: 'vk-video', layout: 'grid', choiceCount: 4 })
  // The 1080px square stage is centered inside the 1080 x 1280 composition.
  return { origin: { fx: (card.left + card.width / 2) / 1080, fy: (card.top + card.height / 2 - 100) / 1080 },
    destination: { fx: .94, fy: 1.16 } }
}

function absoluteEndpoint(frame: Keyframe, anchor: { fx: number; fy: number }) {
  const translation = String(frame.transform).match(/^translate\(([-\d.]+)cqmin, ([-\d.]+)cqmin\)/)
  if (!translation) throw new Error('Flight endpoint must be expressed in stage coordinates')
  return { fx: anchor.fx + Number(translation[1]) / 100, fy: anchor.fy + Number(translation[2]) / 100 }
}

describe('author LumiCells choreography integrated with Stella', () => {
  it('slows travel for the continuous slice without lengthening the short hold', async () => {
    const f = fixture(false, 1.25); const done = vi.fn()
    const task = f.choreo.revealOnce(350, done)
    await f.finishFinite()
    expect(f.bubbles[0].animations[1].options.duration).toBe(1150)
    await f.finishFinite()
    expect(f.root.animations.at(-1)?.options.duration).toBe(350)
    await f.finishFinite()
    expect(f.bubbles[0].animations.at(-1)?.options.duration).toBe(800)
    await f.finishFinite(); await task
    expect(done).toHaveBeenCalledTimes(1)
    f.choreo.dispose()
  })
  it('runs one entry, float/read, exit cycle and completes once after actual finishes', async () => {
    const f = fixture(); const done = vi.fn()
    const task = f.choreo.revealOnce(1200, done)
    await f.choreo.revealOnce(1200, done) // repeated request while busy is ignored
    await f.finishFinite() // binding delay
    expect(f.bubbles[0].animations[1].frames[0].transform).toContain('scale(0.18)')
    expect(f.bubbles[3].animations[1].options).toMatchObject({ duration: 920, delay: 144 })
    await f.finishFinite() // arrivals
    expect(f.choreo.state).toBe('idle')
    expect(f.bubbles.every(el => el.attributes.has('data-live'))).toBe(true)
    expect(f.active().filter(a => a.options.iterations === Infinity)).toHaveLength(4)
    expect(f.root.animations.at(-1)?.options.duration).toBe(1200)
    await f.finishFinite() // reading
    expect(f.choreo.state).toBe('leaving')
    expect(done).not.toHaveBeenCalled()
    expect(f.bubbles[0].animations.at(-1)?.frames[1].transform).toContain('scale(0.55)')
    await f.finishFinite() // departures
    await task
    expect(done).toHaveBeenCalledTimes(1)
    expect(f.active()).toHaveLength(0)
    expect(f.onFlight).toHaveBeenCalledTimes(16)
    f.choreo.dispose()
  })

  it.each(['binding', 'flight', 'reading', 'exit'])('pauses and resumes %s with its existing Animation objects', async phase => {
    const f = fixture(); const done = vi.fn(); const task = f.choreo.revealOnce(1200, done)
    for (let i = 0; i < ['binding', 'flight', 'reading', 'exit'].indexOf(phase); i++) await f.finishFinite()
    const active = f.active()
    f.choreo.setPlaying(false)
    expect(active.every(a => a.playState === 'paused')).toBe(true)
    await f.finishFinite()
    expect(done).not.toHaveBeenCalled()
    f.choreo.setPlaying(true)
    expect(active.every(a => a.playState === 'running')).toBe(true)
    f.choreo.dispose()
    await task
    expect(done).not.toHaveBeenCalled()
    expect(f.active()).toHaveLength(0)
  })

  it('keeps reduced-motion fades and cancels cleanly on a StrictMode-like remount', async () => {
    const f = fixture(true); const done = vi.fn(); const task = f.choreo.revealOnce(1200, done)
    await f.finishFinite()
    expect(f.bubbles.every(el => el.animations.length === 1)).toBe(true)
    expect(f.bubbles[0].animations[0].options.duration).toBe(420)
    f.choreo.dispose(); await task
    const g = fixture(true); const next = g.choreo.revealOnce(1200, done)
    for (let i = 0; i < 4; i++) await g.finishFinite()
    await next
    expect(done).toHaveBeenCalledTimes(1)
    expect(g.bubbles.every(el => el.animations.every(a => a.options.iterations !== Infinity))).toBe(true)
    g.choreo.dispose()
  })

  it('emits all tags from the selected right-hand card and merges them into one destination', async () => {
    const route = selectedCardRoute(), f = fixture(false, 1.25, route), done = vi.fn()
    const task = f.choreo.revealOnce(350, done)
    await f.finishFinite() // binding delay
    expect(route.origin.fx).toBeGreaterThan(.7)
    for (const [i, bubble] of f.bubbles.entries()) {
      const travel = bubble.animations.find(a => a.frames[0].transform !== undefined)!
      const source = absoluteEndpoint(travel.frames[0], f.entries[i].item)
      expect(source.fx).toBeCloseTo(route.origin.fx, 4)
      expect(source.fy).toBeCloseTo(route.origin.fy, 4)
      expect(source.fx).not.toBeCloseTo(.5, 2)
      expect(absoluteEndpoint(travel.frames.at(-1)!, f.entries[i].item)).toEqual({ fx: f.entries[i].item.fx, fy: f.entries[i].item.fy })
      expect(travel.options.duration).toBe(1150)
    }
    await f.finishFinite() // arrivals
    await f.finishFinite() // reading
    for (const [i, bubble] of f.bubbles.entries()) {
      const departure = bubble.animations.at(-1)!
      const destination = absoluteEndpoint(departure.frames.at(-1)!, f.entries[i].item)
      expect(destination.fx).toBeCloseTo(route.destination.fx, 4)
      expect(destination.fy).toBeCloseTo(route.destination.fy, 4)
      expect(departure.options.duration).toBe(800)
    }
    expect(done).not.toHaveBeenCalled()
    await f.finishFinite(); await task
    expect(done).toHaveBeenCalledTimes(1)
    expect(f.active()).toHaveLength(0)
    f.choreo.dispose()
  })

  it.each(['binding', 'flight', 'reading', 'exit'])('pauses and disposes custom-route %s without restarting or completing', async phase => {
    const f = fixture(false, 1, selectedCardRoute()), done = vi.fn()
    const task = f.choreo.revealOnce(350, done)
    for (let i = 0; i < ['binding', 'flight', 'reading', 'exit'].indexOf(phase); i++) await f.finishFinite()
    const active = f.active(), allocated = [f.root, ...f.bubbles].map(el => el.animations.length)
    expect(active.length).toBeGreaterThan(0)
    f.choreo.setPlaying(false)
    expect(active.every(a => a.playState === 'paused')).toBe(true)
    await f.finishFinite()
    expect(f.active()).toEqual(active)
    expect(done).not.toHaveBeenCalled()
    f.choreo.setPlaying(true)
    expect(f.active()).toEqual(active)
    expect([f.root, ...f.bubbles].map(el => el.animations.length)).toEqual(allocated)
    expect(active.every(a => a.playState === 'running')).toBe(true)
    f.choreo.dispose()
    await task; await flush()
    expect(done).not.toHaveBeenCalled()
    expect(f.active()).toHaveLength(0)
    expect(f.bubbles.every(el => !el.attributes.has('data-shown') && !el.attributes.has('data-live'))).toBe(true)
    expect(f.root.dataset.phase).toBeUndefined()
  })

  it('keeps the custom route to opacity-only transitions when reduced motion is enabled', async () => {
    const f = fixture(true, 1, selectedCardRoute()), done = vi.fn()
    const task = f.choreo.revealOnce(350, done)
    for (let i = 0; i < 4; i++) await f.finishFinite()
    await task
    expect(done).toHaveBeenCalledTimes(1)
    expect(f.bubbles.every(el => el.animations.every(a => a.frames.every(frame => frame.transform === undefined && frame.translate === undefined)))).toBe(true)
    expect(f.bubbles[0].animations.map(a => a.options.duration)).toEqual([420, 380])
    f.choreo.dispose()
  })
})
