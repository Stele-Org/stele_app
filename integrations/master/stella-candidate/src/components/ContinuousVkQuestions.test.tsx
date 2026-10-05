// @vitest-environment jsdom
import { act, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ContinuousQuestions } from './ContinuousQuestions'
import { questionPresentation } from '../features/prototype/question-presentation'
import { vkQuestions } from '../content/vkVideo'
import { tagPresentation } from '../features/prototype/tag-reveal'
import type { TagReveal } from '../features/prototype/tag-reveal'
import { CameraSessionContext } from './camera-session-context'

// Real React DOM + installed AnimatePresence/useAnimate. Only native tag flight is
// isolated: its WAAPI/pausing lifecycle is covered in native-flight.test.ts.
const flight = vi.hoisted(() => ({ exit: undefined as ((reveal: TagReveal) => void) | undefined }))
vi.mock('./AnswerFlight', () => ({ AnswerFlight: ({ onFinalExit }: { onFinalExit: (reveal: TagReveal) => void }) => { flight.exit = onFinalExit; return null } }))
const floats = vi.hoisted(() => [] as { element: HTMLElement; playState: string; playbackRate: number; pause: () => void; play: () => void; cancel: () => void; finished: Promise<void> }[])
vi.mock('../vendor/lumicells-scene/flight', async importOriginal => ({
  ...await importOriginal<typeof import('../vendor/lumicells-scene/flight')>(),
  startFloat: (element: HTMLElement) => {
    const animation = { element, playState: 'running', playbackRate: 1,
      pause() { this.playState = 'paused' }, play() { this.playState = 'running' }, cancel() { this.playState = 'idle' },
      finished: new Promise<void>(() => {}) }
    floats.push(animation)
    return animation
  },
}))
let host: HTMLDivElement
let root: Root
const select = vi.fn(), back = vi.fn(), complete = vi.fn()
const option = vkQuestions[0].options[0]
const reveal = tagPresentation({ type: 'vk-answer-reveal', questionIndex: 0, optionIndex: 0,
  label: option.label, metadata: option.metadata, next: { type: 'vk-question', index: 1, answers: [option.id] } })!
const wait = (ms = 850) => act(async () => { await new Promise(resolve => setTimeout(resolve, ms)) })
const button = (id: string) => host.querySelector<HTMLButtonElement>(`[data-option-id="${id}"]`)!
function show(index: number, revealing = false, playing = true) {
  act(() => root.render(<StrictMode><ContinuousQuestions question={questionPresentation(revealing ? reveal.source : { type: 'vk-question', index, answers: [] })!} reveal={revealing ? reveal : null}
    playing={playing} onSelect={select} onBack={back} onComplete={complete} /></StrictMode>))
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })))
  vi.clearAllMocks()
  floats.length = 0
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  expect(floats.every(animation => animation.playState === 'idle')).toBe(true)
  host.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('continuous first VK question with real Motion presence', () => {
  it.each([2, 0])('keeps camera attached until the hero card finishes exiting (selected index %i)', async selectedIndex => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    const stop = vi.fn()
    const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream
    const answer = vkQuestions[2].options[selectedIndex]
    const cameraReveal = tagPresentation({ type: 'vk-answer-reveal', questionIndex: 2, optionIndex: selectedIndex,
      label: answer.label, metadata: answer.metadata, next: { type: 'vk-digitize', answers: [], rankedThemes: [], discoveryAnswerId: answer.id } })!
    const renderCamera = (answering: boolean) => act(() => root.render(
      <StrictMode><CameraSessionContext.Provider value={{ stream, status: 'ready' }}>
        <ContinuousQuestions question={questionPresentation(answering ? cameraReveal.source : { type: 'vk-question', index: 2, answers: [] })!}
          reveal={answering ? cameraReveal : null} playing onSelect={select} onBack={back} onComplete={complete} />
      </CameraSessionContext.Provider></StrictMode>))
    renderCamera(false)
    await wait()
    const video = host.querySelector('video')!
    expect(video.srcObject).toBe(stream)
    pause.mockClear()
    renderCamera(true)
    expect(host.querySelector('video')).toBe(video)
    expect(video.srcObject).toBe(stream)
    if (selectedIndex === 2) {
      await wait(1200)
      expect(video.isConnected).toBe(true)
      expect(video.srcObject).toBe(stream)
      act(() => flight.exit!(cameraReveal))
    }
    await wait(100)
    expect(video.isConnected).toBe(true)
    expect(video.srcObject).toBe(stream)
    expect(pause).not.toHaveBeenCalled()
    await wait(1300)
    expect(video.isConnected).toBe(false)
    expect(video.srcObject).toBeNull()
    expect(pause).toHaveBeenCalledOnce()
    expect(stop).not.toHaveBeenCalled()
  }, 6000)

  it('keeps the answer until final tag exit, then brings four new cards and accepts one answer', async () => {
    show(0)
    await wait()
    const card = button(option.id)
    const drift = floats.find(animation => animation.element.contains(card) && animation.playState === 'running')!
    expect(drift.playbackRate).toBe(.75)
    const logo = host.querySelector('.product-mark')
    const heading = host.querySelector('h1')
    expect(card.disabled).toBe(false)
    act(() => { card.click(); card.click() })
    await wait(300)
    expect(select).toHaveBeenCalledTimes(1)
    show(0, true)
    expect(button(option.id)).toBe(card)
    expect(host.querySelector('h1')).toBe(heading)
    expect(card.dataset.retained).toBe('true')
    expect(host.querySelectorAll('[data-option-id]')).toHaveLength(4)
    await wait(1400)
    expect(host.querySelectorAll('[data-option-id]')).toHaveLength(1)
    expect(card.isConnected).toBe(true)
    act(() => flight.exit!(reveal))
    expect(card.isConnected).toBe(true)
    expect(card.closest('[inert]')).not.toBeNull()
    expect(card.getAttribute('data-lc-strength')).toBe('0')
    await wait(1000)
    expect(card.isConnected).toBe(false)
    expect(drift.playState).toBe('idle')
    expect(host.querySelectorAll('[data-option-id]')).toHaveLength(0)
    show(1)
    expect(host.querySelectorAll('[data-option-id]')).toHaveLength(4)
    await wait()
    expect(host.querySelector('.product-mark')).toBe(logo)
    const second = button(vkQuestions[1].options[0].id)
    expect(second).not.toBe(card)
    expect(second.disabled).toBe(false)
    expect(document.activeElement).toBe(host.querySelector('h1'))
    act(() => second.click())
    await wait(300)
    expect(select).toHaveBeenCalledTimes(2)
  }, 10000)

  it('pauses outgoing cards and float, then resumes and resets input on Back', async () => {
    show(0)
    await wait()
    const old = button(option.id)
    const oldCopy = old.querySelector('.continuous-card-copy')!
    show(1, false, false)
    await wait()
    expect(old.isConnected).toBe(true)
    expect(oldCopy.isConnected).toBe(true)
    expect(floats.filter(animation => animation.playState !== 'idle').every(animation => animation.playState === 'paused')).toBe(true)
    expect(button(vkQuestions[1].options[0].id).disabled).toBe(true)
    show(1, false, true)
    await wait(1200)
    expect(old.isConnected).toBe(false)
    expect(oldCopy.isConnected).toBe(false)
    expect(button(vkQuestions[1].options[0].id).disabled).toBe(false)
    act(() => host.querySelector<HTMLButtonElement>('[aria-label="Назад"]')!.click())
    expect(back).toHaveBeenCalledTimes(1)
    show(0)
    await wait()
    expect(button(option.id).disabled).toBe(false)
    act(() => button(option.id).click())
    await wait(300)
    expect(select).toHaveBeenCalledTimes(1)
  })

  it('cancels an accepted but uncommitted answer when the flow unmounts', async () => {
    show(0)
    await wait()
    act(() => button(option.id).click())
    act(() => root.render(null))
    await wait(300)
    expect(select).not.toHaveBeenCalled()
  })

  it('completes presence and unlocks input with reduced motion', async () => {
    vi.mocked(window.matchMedia).mockReturnValue({ matches: true, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} } as unknown as MediaQueryList)
    show(0)
    await wait(80)
    show(1)
    await wait(80)
    expect(host.querySelectorAll('.continuous-question')).toHaveLength(1)
    expect(button(vkQuestions[1].options[0].id).disabled).toBe(false)
    expect(floats).toHaveLength(0)
  })
})
