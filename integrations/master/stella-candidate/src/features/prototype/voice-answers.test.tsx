// @vitest-environment jsdom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { Prototype, type ScreenState } from './Prototype'

// The real scenario and the real buttons and input gate of the start and onboarding screens. The voice is a stand-in
// that has finished the line of a screen as soon as the screen is there (the wait for the end of a line:
// use-screen-narration.test.tsx). The question cards are stand-ins that carry the `data-option-id` of the real ones
// and end the reveal of an answer on request. The recogniser is a session that hears what the test says.
const voice = vi.hoisted(() => ({ silent: false }))
vi.mock('../voice/use-screen-narration', () => ({
  useScreenNarration: ({ screen, brandSplash }: { screen: ScreenState; brandSplash: boolean }) => voice.silent || brandSplash ? null : screen.type,
}))
vi.mock('../sound/use-stella-sound', () => ({ useStellaSound: () => {} }))
vi.mock('../../components/RingScene', () => ({ RingScene: ({ children }: { children: ReactNode }) => <div>{children}</div> }))
vi.mock('../../components/BrandSplash', () => ({ BrandSplash: ({ onComplete }: { onComplete: () => void }) => <button data-splash-complete onClick={onComplete} /> }))
vi.mock('../../components/ContinuousQuestions', () => ({
  ContinuousQuestions: ({ question, reveal, onSelect, onComplete }: {
    question: { options: { id: string }[]; answering: boolean }; reveal: object | null; onSelect: (id: string) => void; onComplete: (reveal: object) => void
  }) => <>
    {!question.answering && question.options.map(({ id }) => <button key={id} data-option-id={id} onClick={() => onSelect(id)} />)}
    {reveal && <button data-reveal-complete onClick={() => onComplete(reveal)} />}
  </>,
}))
vi.mock('../../service', () => ({ markServiceReady: async () => {}, useServicePlaying: () => true }))

class Session {
  onstart: (() => void) | null = null
  onresult: ((event: unknown) => void) | null = null
  onerror: (() => void) | null = null
  onend: (() => void) | null = null
  start = vi.fn(() => { this.onstart?.() })
  abort = vi.fn()
  constructor() { sessions.push(this) }
}
let sessions: Session[]
let root: Root, host: HTMLDivElement
const state = () => host.querySelector('main')?.getAttribute('data-screen')
const indicator = () => host.querySelector('.microphone-indicator')
const pass = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })
/** The visitor says a phrase into the microphone that is open now; the press it causes takes its cue to act. */
async function say(phrase: string) {
  const open = sessions.at(-1)!
  expect(open.abort, phrase).not.toHaveBeenCalled()
  act(() => open.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: phrase }], { isFinal: true })] }))
  await pass(700)
}
/** The visitor taps a button; the press takes its cue to act. */
async function tap(selector: string) {
  act(() => host.querySelector<HTMLButtonElement>(selector)!.click())
  await pass(700)
}
const endSplash = () => act(() => host.querySelector<HTMLButtonElement>('[data-splash-complete]')!.click())
const endReveal = () => act(() => host.querySelector<HTMLButtonElement>('[data-reveal-complete]')!.click())
const show = (search: string) => { window.history.replaceState(null, '', search); act(() => root.render(<Prototype />)) }

beforeEach(() => {
  sessions = []
  voice.silent = false
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('BroadcastChannel', undefined)
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })))
  vi.stubGlobal('webkitSpeechRecognition', Session)
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount()); host.remove()
  vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals()
  window.history.replaceState(null, '', window.location.pathname)
})

it('with ?mic=1 answers the screens by voice: start and questions; the product and the consent to the photo take a tap', async () => {
  show('?mic=1&greeting=1')
  expect(state()).toBe('home')
  // The start screen never listens, greeted or not: the product is chosen by a tap.
  await pass(1000)
  expect(sessions).toHaveLength(0)
  expect(indicator()).toBeNull()

  await tap('.product-tag--vk-video')
  expect(state()).toBe('vk-onboarding')
  // The microphone stays off under the brand splash, which says nothing.
  expect(sessions).toHaveLength(0)
  endSplash()
  expect(sessions).toHaveLength(1)
  expect(indicator()).not.toBeNull()
  await say('даже не знаю')
  expect(state()).toBe('vk-onboarding')

  await say('Поехали!')
  expect(state()).toBe('vk-question')
  // The microphone went off with the answer and is opened again by the question.
  expect(sessions[0].abort).toHaveBeenCalledOnce()
  await say('стендап')
  expect(state()).toBe('vk-answer-reveal')
  // The reveal of the answer asks nothing.
  expect(indicator()).toBeNull()
  endReveal()
  expect(state()).toBe('vk-question')
  await say('что-нибудь познавательное')
  endReveal()
  await say('хочу стать героем')
  endReveal()
  expect(state()).toBe('vk-digitize')
  // «Начать» here accepts the terms of personal data: no microphone, the buttons wait for a tap.
  const opened = sessions.length
  await pass(1000)
  expect(sessions).toHaveLength(opened)
  expect(sessions.at(-1)!.abort).toHaveBeenCalledOnce()
  expect(indicator()).toBeNull()
})

it('keeps the microphone off until the voice has asked', async () => {
  voice.silent = true
  show('?mic=1')
  await tap('.product-tag--vk-video')
  endSplash()
  await pass(1000)
  expect(state()).toBe('vk-onboarding')
  expect(sessions).toHaveLength(0)
  expect(indicator()).toBeNull()
})

it('never opens the microphone without ?mic=1', async () => {
  show('')
  await pass(1000)
  expect(state()).toBe('home')
  expect(sessions).toHaveLength(0)
  expect(indicator()).toBeNull()
})
