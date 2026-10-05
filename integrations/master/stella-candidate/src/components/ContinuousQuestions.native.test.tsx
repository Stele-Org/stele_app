// @vitest-environment jsdom
import { act, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ContinuousQuestions } from './ContinuousQuestions'
import { questionPresentation } from '../features/prototype/question-presentation'

// jsdom has no Web Animations, so the other tests drive every value from JavaScript. A browser fades opacity natively,
// and such an animation has no start time until its first frame. This file gives Motion that native path.
vi.mock('./AnswerFlight', () => ({ AnswerFlight: () => null }))

interface NativeCall { element: Element; property: string; cancelled: boolean }
const native: NativeCall[] = []
let host: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })))
  native.length = 0
  Object.defineProperty(Element.prototype, 'animate', {
    configurable: true,
    value(this: Element, keyframes: Record<string, unknown>) {
      const call: NativeCall = { element: this, property: Object.keys(keyframes)[0], cancelled: false }
      native.push(call)
      // Pending, as in a browser before the first frame: playing, but without a start time.
      return {
        startTime: null, currentTime: 0, playState: 'running', playbackRate: 1, onfinish: null,
        finished: new Promise<void>(() => {}), effect: { getComputedTiming: () => ({ duration: 0 }), updateTiming() {} },
        play() { this.playState = 'running' }, pause() { this.playState = 'paused' },
        cancel() { call.cancelled = true; this.playState = 'idle' }, finish() {}, commitStyles() {}, updatePlaybackRate() {},
      }
    },
  })
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
  delete (Element.prototype as { animate?: unknown }).animate
  vi.unstubAllGlobals()
})

it('keeps arriving cards and the heading transparent when StrictMode probes the effects before the first native frame', () => {
  act(() => root.render(<StrictMode><ContinuousQuestions question={questionPresentation({ type: 'vk-question', index: 0, answers: [] })!}
    reveal={null} playing onSelect={() => {}} onBack={() => {}} onComplete={() => {}} /></StrictMode>))
  const cards = [...host.querySelectorAll<HTMLElement>('.continuous-option')]
  const heading = host.querySelector<HTMLElement>('.continuous-heading-copy')!
  expect(cards).toHaveLength(4)
  // The fades did take the native path, and the probe run cancelled its copies.
  const fades = native.filter(call => call.property === 'opacity')
  expect(fades.filter(call => call.element === cards[0])).toHaveLength(2)
  expect(fades.find(call => call.element === cards[0])!.cancelled).toBe(true)
  // Stopping instead of cancelling would have committed the final opacity here: the cards would simply be there.
  for (const element of [...cards, heading]) expect(Number(element.style.opacity)).toBe(0)
})
