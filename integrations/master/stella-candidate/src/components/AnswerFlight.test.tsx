// @vitest-environment jsdom
import { act, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, expect, it, vi } from 'vitest'
import { AnswerFlight } from './AnswerFlight'
import type { DemoSceneProps } from '../vendor/lumicells-scene/types'
import { COLOR_RED } from '../vendor/lumicells-scene/types'
import type { BubbleEntry } from '../vendor/lumicells-scene/bubbles'
import type { FlightRoute } from '../vendor/lumicells-scene/choreography'
import type { TagReveal } from '../features/prototype/tag-reveal'
import { referenceCards } from './ux-artwork'
import { answerCardPosition } from '../features/prototype/answer-card-layout'

// Adapter contract only; actual author WAAPI lifecycle has separate native-flight tests.
beforeEach(() => vi.stubGlobal('matchMedia', () => ({ matches: false })))
const runs = vi.hoisted(() => [] as { host: HTMLElement; entries: () => BubbleEntry[]; hooks: () => DemoSceneProps; done?: () => void; disposed: boolean; route?: FlightRoute; closing?: () => void }[])
vi.mock('../vendor/lumicells-scene/choreography', () => ({ Choreographer: class {
  run: (typeof runs)[number]
  constructor(host: HTMLElement, entries: () => BubbleEntry[], hooks: () => DemoSceneProps, ...options: unknown[]) {
    this.run = { host, entries, hooks, disposed: false, route: options[2] as FlightRoute }; runs.push(this.run)
  }
  revealOnce(_hold: number, done: () => void) { this.run.done = done }
  setPlaying() {}
  dispose() { this.run.disposed = true }
} }))
// VK Видео runs the Claude Design dot scene behind the same adapter contract.
vi.mock('./tag-dissolve', () => ({ TagDissolve: class {
  run: (typeof runs)[number]
  constructor(host: HTMLElement, entries: () => BubbleEntry[], hooks: () => DemoSceneProps, options: { card: { x: number; y: number; w: number; h: number }; onClosing?: () => void }) {
    const { card } = options
    this.run = { host, entries, hooks, disposed: false, closing: options.onClosing,
      route: { origin: { fx: (card.x + card.w / 2) / 1080, fy: (card.y - 100 + card.h / 2) / 1080 }, destination: { fx: 0, fy: 0 } } }
    runs.push(this.run)
  }
  revealOnce(_hold: number, done: () => void) { this.run.done = done }
  setPlaying() {}
  dispose() { this.run.disposed = true }
} }))

it.each([
  { product: 'vk-video', id: 'series', slot: 0, centered: false },
  { product: 'vk-video', id: 'heroes', slot: 1, centered: false },
  { product: 'vk-video', id: 'new', slot: 1, centered: false },
  { product: 'vk-video', id: 'popular', slot: 3, centered: false },
  { product: 'max', id: 'personal', slot: 1, centered: false },
  { product: 'max', id: 'visibility', slot: 2, centered: true },
] as const)('keeps the actual $id cover, $product card geometry and server metadata through decoding', ({ product, id, slot, centered }) => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const host = document.createElement('div'); document.body.append(host)
  const root = createRoot(host)
  const reveal: TagReveal = { source: { type: 'home' }, next: { type: 'home' }, product, label: 'Текст сервера',
    answerCard: { index: slot, tone: 'blue', artworkId: id, centered }, batches: [['Серверный тег']] }
  try {
    act(() => root.render(<AnswerFlight reveal={reveal} playing onComplete={() => {}} />))
    const card = host.querySelector<HTMLElement>('.answer-flight__answer')!
    const expected = answerCardPosition({ slot, product, layout: 'grid', choiceCount: centered ? 3 : 4 })
    expect(card.style.left).toBe(`${expected.left}px`)
    expect(card.style.top).toBe(`${expected.top}px`)
    expect(card.style.width).toBe(`${expected.width}px`)
    expect(card.style.height).toBe(`${expected.height}px`)
    expect(card.querySelector('img')?.getAttribute('src')).toBe(referenceCards[id])
    expect(card.querySelector('.answer-flight__label')?.textContent).toBe('Текст сервера')
    const origin = runs.at(-1)!.route!.origin
    expect(origin.fx).toBeCloseTo((expected.left + expected.width / 2) / 1080)
    expect(origin.fy).toBeCloseTo((expected.top - 100 + expected.height / 2) / 1080)
    expect(host.querySelector('.tag-dissolve__canvas') !== null).toBe(product === 'vk-video')
    expect(host.querySelector('.answer-flight')!.getAttribute('data-tag-look')).toBe(product === 'vk-video' ? 'gradient' : null)
    expect(runs.at(-1)!.entries()[0].info().label).toBe('Серверный тег')
    expect(host.querySelector('[role="status"]')?.textContent).toBe('Текст сервера. Серверный тег.')
  } finally { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals() }
})

it.each(['vk-video', 'max'] as const)('notifies only once at final %s batch exit, keeps completion later, and does not restart when callback changes', product => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const host = document.createElement('div'); document.body.append(host)
  const root = createRoot(host)
  const exit = vi.fn(), replacement = vi.fn(), complete = vi.fn()
  const reveal: TagReveal = { source: { type: 'vk-question', index: 0, answers: [] }, product, label: 'Ответ',
    batches: [['один', 'два'], ['три', 'четыре']], next: { type: 'vk-question', index: 1, answers: [] } }
  const render = (callback: typeof exit) => act(() => root.render(<StrictMode><AnswerFlight embedded playing reveal={reveal} onComplete={complete} onFinalExit={callback} /></StrictMode>))
  const fire = (phase: 'entering' | 'leaving') => act(() => {
    const run = runs.at(-1)!; run.host.dataset.phase = phase
    for (const entry of run.entries()) run.hooks().onFlight?.(entry.el, entry.info(), 'start')
  })
  // MAX retires the answer when its last tags start to leave; VK when the dot scene announces its end.
  const leave = () => { fire('leaving'); if (product === 'vk-video') act(() => runs.at(-1)!.closing!()) }
  try {
    render(exit)
    fire('entering'); leave()
    expect(exit).not.toHaveBeenCalled()
    act(() => runs.at(-1)!.done!())
    expect(complete).not.toHaveBeenCalled()
    fire('entering')
    expect(exit).not.toHaveBeenCalled()
    const current = runs.at(-1)
    render(replacement)
    expect(runs.at(-1)).toBe(current)
    leave(); leave()
    expect(exit).not.toHaveBeenCalled()
    expect(replacement).toHaveBeenCalledExactlyOnceWith(reveal)
    expect(complete).not.toHaveBeenCalled()
    act(() => runs.at(-1)!.done!())
    expect(complete).toHaveBeenCalledExactlyOnceWith(reveal)
  } finally {
    act(() => root.unmount()); host.remove(); vi.unstubAllGlobals()
  }
  expect(runs.every(run => run.disposed)).toBe(true)
})

it.each([
  { product: 'vk-video', tone: 'blue', expected: '#0077FF' },
  { product: 'vk-video', tone: 'red', expected: '#FF2B42' },
  { product: 'vk-video', tone: 'violet', expected: '#6E1AFF' },
  { product: 'vk-video', tone: 'cyan', expected: '#00BFFF' },
  { product: 'vk-video', tone: undefined, expected: '#0077FF' },
  { product: 'max', tone: undefined, expected: '#6E1AFF' },
] as const)('colors every $product tag echo from answer tone $tone, independently of decorative outlines', ({ product, tone, expected }) => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const ring = document.createElement('lumi-cells')
  const pulse = vi.fn()
  Object.defineProperty(ring, 'instance', { value: {
    pulse,
    bindElement: vi.fn(() => ({ update: vi.fn(), dispose: vi.fn() })),
  } })
  document.body.append(ring)
  const root = createRoot(ring)
  const reveal: TagReveal = {
    source: { type: 'vk-question', index: 0, answers: [] },
    product,
    label: 'Выбранный ответ',
    ...(tone ? { answerCard: { index: 0, tone } } : {}),
    batches: [['один', 'два', 'три', 'четыре']],
    next: { type: 'vk-question', index: 1, answers: [] },
  }
  try {
    act(() => root.render(<StrictMode><AnswerFlight embedded playing reveal={reveal} onComplete={() => {}} /></StrictMode>))
    const run = runs.at(-1)!
    const entries = run.entries()
    expect(entries).toHaveLength(4)
    if (product === 'vk-video') {
      expect(entries.slice(1).every(entry => entry.info().color === COLOR_RED)).toBe(true)
    }
    act(() => {
      run.host.dataset.phase = 'entering'
      for (const entry of entries) {
        run.hooks().onFlight?.(entry.el, entry.info(), 'start')
        run.hooks().onFlight?.(entry.el, entry.info(), 'end')
      }
    })
    expect(pulse).toHaveBeenCalledTimes(entries.length * 2)
    for (const [options] of pulse.mock.calls) {
      expect(options).toMatchObject({ color: expected, colorMix: 1, space: 'client' })
    }
    act(() => {
      run.host.dataset.phase = 'leaving'
      for (const entry of entries) {
        run.hooks().onFlight?.(entry.el, entry.info(), 'start')
        run.hooks().onFlight?.(entry.el, entry.info(), 'end')
      }
    })
    expect(pulse).toHaveBeenCalledTimes(entries.length * 2)
  } finally {
    act(() => root.unmount())
    ring.remove()
    vi.unstubAllGlobals()
  }
})
