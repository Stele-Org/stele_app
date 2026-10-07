// @vitest-environment jsdom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { Prototype, type ScreenState } from './Prototype'
import { IDLE_RETURN_MS, LINE_WAIT_MS, useIdleReturn, waitsForVisitor } from './idle-return'
import { eventName, type StelaEvent } from './events'

// The real scenario with the real start and onboarding screens. The voice is a stand-in that has finished the line of
// a screen as soon as the screen is there, or never (`silent`). The question cards are stand-ins as in
// voice-answers.test.tsx: they carry the `data-option-id` of the real ones and end the reveal of an answer on request.
const voice = vi.hoisted(() => ({ silent: false, greet: [] as Array<[string, boolean | undefined]> }))
vi.mock('../voice/use-screen-narration', () => ({
  useScreenNarration: ({ screen, brandSplash, greet }: { screen: ScreenState; brandSplash: boolean; greet?: boolean }) => {
    // Whether the start screen may greet, as the scenario asked for it on its last render of that screen.
    voice.greet.push([screen.type, greet])
    return voice.silent || brandSplash ? null : screen.type
  },
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
const playback = vi.hoisted(() => ({ playing: true }))
vi.mock('../../service', () => ({ markServiceReady: async () => {}, useServicePlaying: () => playback.playing }))

let root: Root, host: HTMLDivElement
let events: StelaEvent[]
const receive = (event: Event) => events.push((event as CustomEvent<StelaEvent>).detail)
const state = () => host.querySelector('main')?.getAttribute('data-screen')
const pass = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })
/** The visitor taps a button; the press takes its cue to act. */
async function tap(selector: string) {
  act(() => host.querySelector<HTMLButtonElement>(selector)!.click())
  await pass(700)
}
const endSplash = () => act(() => host.querySelector<HTMLButtonElement>('[data-splash-complete]')!.click())
const endReveal = () => act(() => host.querySelector<HTMLButtonElement>('[data-reveal-complete]')!.click())
const touch = () => act(() => { window.dispatchEvent(new Event('pointerdown')) })
/** The start screen, the VK Видео logo and the end of the brand splash: the onboarding waits for «начать». */
async function enter() {
  act(() => root.render(<Prototype />))
  await tap('.product-tag--vk-video')
  endSplash()
  expect(state()).toBe('vk-onboarding')
}

beforeEach(() => {
  voice.silent = false; voice.greet = []; playback.playing = true; events = []
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('BroadcastChannel', undefined)
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })))
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
  window.addEventListener(eventName, receive)
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount()); host.remove()
  window.removeEventListener(eventName, receive)
  vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals()
})

it('names the screens that wait for a press', () => {
  const themes = ['Кино' as const]
  const waiting: ScreenState[] = [
    { type: 'vk-onboarding' }, { type: 'max-onboarding' }, { type: 'vk-question', index: 0, answers: [] }, { type: 'max-audience' },
    { type: 'max-goal', audience: 'personal' }, { type: 'vk-digitize', answers: [], rankedThemes: themes, discoveryAnswerId: 'hero' },
    { type: 'vk-photo-review', themes }, { type: 'max-result', mission: 'business-promotion' },
  ]
  const passing: ScreenState[] = [
    { type: 'home' }, { type: 'vk-camera', themes }, { type: 'vk-scanning', themes }, { type: 'vk-particles', themes },
    { type: 'vk-discovery-activation', themes, metadata: [] }, { type: 'vk-final', themes },
    { type: 'vk-photo-reveal', answerId: 'skip', metadata: [], next: { type: 'home' } },
    { type: 'vk-answer-reveal', questionIndex: 0, optionIndex: 0, label: 'сериал', metadata: ['сериал'], next: { type: 'home' } },
    { type: 'max-answer-reveal', label: 'личное', metadata: ['личное'], next: { type: 'home' } },
  ]
  expect(waiting.filter(waitsForVisitor)).toHaveLength(waiting.length)
  expect(passing.filter(waitsForVisitor)).toHaveLength(0)
})

it('returns to the start screen 30 seconds after the line of a waiting screen, and the next visitor gets a new session', async () => {
  await enter()
  const first = events.find(event => event.type === 'session-start')!.sessionId
  await pass(IDLE_RETURN_MS - 1)
  expect(state()).toBe('vk-onboarding')
  await pass(1)
  expect(state()).toBe('home')
  // The start screen itself waits for as long as it takes.
  await pass(10 * IDLE_RETURN_MS)
  expect(state()).toBe('home')
  await tap('.product-tag--vk-video')
  expect(events.filter(event => event.type === 'session-start').at(-1)!.sessionId).not.toBe(first)
})

it('keeps the start screen from greeting after a return for idleness, until somebody chooses a product', async () => {
  const greets = () => voice.greet.at(-1)
  act(() => root.render(<Prototype />))
  expect(greets()).toEqual(['home', true])
  await tap('.product-tag--vk-video'); endSplash()
  await pass(IDLE_RETURN_MS)
  expect(state()).toBe('home')
  expect(greets()).toEqual(['home', false])
  await pass(10 * IDLE_RETURN_MS)
  expect(greets()).toEqual(['home', false])
  // The next visitor is greeted as usual wherever the scenario brings them back to the start screen by itself.
  await tap('.product-tag--vk-video')
  expect(greets()).toEqual(['vk-onboarding', true])
})

it('starts the wait again with every action of the visitor', async () => {
  await enter()
  await pass(20000)
  touch()
  await pass(IDLE_RETURN_MS - 1)
  expect(state()).toBe('vk-onboarding')
  await pass(1)
  expect(state()).toBe('home')
})

it('waits on every question anew and never leaves the tags of an answer', async () => {
  await enter()
  await pass(20000)
  await tap('.onboarding-start')
  expect(state()).toBe('vk-question')
  await pass(20000)
  expect(state()).toBe('vk-question')
  await tap('[data-option-id="series"]')
  expect(state()).toBe('vk-answer-reveal')
  // The reveal has no buttons: it lasts as long as its scene does.
  await pass(4 * IDLE_RETURN_MS)
  expect(state()).toBe('vk-answer-reveal')
  endReveal()
  expect(state()).toBe('vk-question')
  await pass(IDLE_RETURN_MS)
  expect(state()).toBe('home')
  // Nothing of the abandoned visit is left: the scenario starts from its first question.
  await tap('.product-tag--vk-video'); endSplash(); await tap('.onboarding-start')
  expect(host.querySelectorAll('[data-option-id]')).toHaveLength(4)
  expect(host.querySelector('[data-option-id="series"]')).not.toBeNull()
})

it('does not count under the brand splash', async () => {
  act(() => root.render(<Prototype />))
  await tap('.product-tag--vk-video')
  await pass(10 * IDLE_RETURN_MS)
  expect(state()).toBe('vk-onboarding')
  expect(host.querySelector('[data-splash-complete]')).not.toBeNull()
})

it('a line that is never spoken is waited for 30 seconds, and the 30 seconds of the visitor follow', async () => {
  voice.silent = true
  await enter()
  await pass(LINE_WAIT_MS + IDLE_RETURN_MS - 1)
  expect(state()).toBe('vk-onboarding')
  await pass(1)
  expect(state()).toBe('home')
})

it('a pause of the scenario stops the count, and the wait is whole again afterwards', async () => {
  await enter()
  await pass(20000)
  playback.playing = false
  act(() => root.render(<Prototype />))
  await pass(10 * IDLE_RETURN_MS)
  expect(state()).toBe('vk-onboarding')
  playback.playing = true
  act(() => root.render(<Prototype />))
  await pass(IDLE_RETURN_MS - 1)
  expect(state()).toBe('vk-onboarding')
  await pass(1)
  expect(state()).toBe('home')
})

function Wait({ screen, spoken, onIdle }: { screen: ScreenState; spoken: boolean; onIdle: () => void }) {
  useIdleReturn({ screen, active: true, spoken, onIdle })
  return null
}

it('counts from the end of the line, and a screen without a line counts from its appearance', async () => {
  const idle = vi.fn()
  const screen: ScreenState = { type: 'vk-photo-review', themes: ['Кино'] }
  // The check of the photo has no line.
  act(() => root.render(<Wait screen={screen} spoken onIdle={idle} />))
  await pass(IDLE_RETURN_MS - 1); expect(idle).not.toHaveBeenCalled()
  await pass(1); expect(idle).toHaveBeenCalledOnce()

  idle.mockClear()
  const question: ScreenState = { type: 'vk-question', index: 0, answers: [] }
  act(() => root.render(<Wait screen={question} spoken={false} onIdle={idle} />))
  // The line takes eight seconds; the visitor touched the screen while it was spoken.
  await pass(5000); touch(); await pass(3000)
  act(() => root.render(<Wait screen={question} spoken onIdle={idle} />))
  await pass(IDLE_RETURN_MS - 1); expect(idle).not.toHaveBeenCalled()
  await pass(1); expect(idle).toHaveBeenCalledOnce()
})

it.each(['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'click'])('takes %s for an action', async action => {
  const idle = vi.fn()
  act(() => root.render(<Wait screen={{ type: 'vk-onboarding' }} spoken onIdle={idle} />))
  await pass(IDLE_RETURN_MS - 1)
  act(() => { host.dispatchEvent(new Event(action, { bubbles: true })) })
  await pass(IDLE_RETURN_MS - 1); expect(idle).not.toHaveBeenCalled()
  await pass(1); expect(idle).toHaveBeenCalledOnce()
})

it('takes a scroll of the consent text for an action, though a scroll does not bubble', async () => {
  const idle = vi.fn()
  act(() => root.render(<Wait screen={{ type: 'vk-onboarding' }} spoken onIdle={idle} />))
  await pass(IDLE_RETURN_MS - 1)
  act(() => { host.dispatchEvent(new Event('scroll')) })
  await pass(IDLE_RETURN_MS - 1); expect(idle).not.toHaveBeenCalled()
  await pass(1); expect(idle).toHaveBeenCalledOnce()
})
