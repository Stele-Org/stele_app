// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { LISTEN_MS, useVoiceCommands } from './use-voice-commands'
import type { VoiceCommand } from './voice-commands'

// The browser's recogniser: a session per start, ended by the browser or aborted by the page.
class Session {
  lang = ''; continuous = false; interimResults = true; maxAlternatives = 1
  onstart: (() => void) | null = null
  onresult: ((event: unknown) => void) | null = null
  onerror: ((event: unknown) => void) | null = null
  onend: (() => void) | null = null
  start = vi.fn(() => { this.onstart?.() })
  abort = vi.fn()
  constructor() { sessions.push(this) }
  say(...readings: string[]) {
    act(() => this.onresult?.({ resultIndex: 0, results: [Object.assign(readings.map(transcript => ({ transcript })), { isFinal: true })] }))
  }
  fail(error: string) { act(() => this.onerror?.({ error })) }
  end() { act(() => this.onend?.()) }
}
let sessions: Session[]
let hidden: boolean
const cover = (value: boolean) => act(() => { hidden = value; document.dispatchEvent(new Event('visibilitychange')) })
let root: Root, host: HTMLDivElement
const start: VoiceCommand[] = [{ target: '.start', stems: ['поехал'] }]
const other: VoiceCommand[] = [{ target: '.other', stems: ['дальше'] }]
const pressed = vi.fn<(target: string) => boolean>()
const pass = (ms: number) => act(() => { vi.advanceTimersByTime(ms) })
const listening = () => host.firstElementChild!.getAttribute('data-listening')

function Harness({ active, commands = start }: { active: boolean; commands?: VoiceCommand[] }) {
  return <div data-listening={useVoiceCommands({ active, commands, onCommand: pressed })} />
}
const show = (active: boolean, commands?: VoiceCommand[]) => act(() => root.render(<Harness active={active} commands={commands} />))

beforeEach(() => {
  sessions = []
  hidden = false
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden)
  vi.spyOn(console, 'info').mockImplementation(() => {})
  pressed.mockReset().mockReturnValue(true)
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('webkitSpeechRecognition', Session)
  vi.useFakeTimers()
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount()); host.remove()
  vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals()
})

it('opens the microphone only when asked to and closes it when the screen stops waiting', () => {
  show(false)
  expect(sessions).toHaveLength(0)
  expect(listening()).toBe('false')
  show(true)
  expect(sessions).toHaveLength(1)
  expect(sessions[0]).toMatchObject({ lang: 'ru-RU', continuous: true, interimResults: false })
  expect(sessions[0].start).toHaveBeenCalledOnce()
  expect(listening()).toBe('true')
  show(false)
  expect(sessions[0].abort).toHaveBeenCalledOnce()
  expect(listening()).toBe('false')
  // An aborted session reports its end; nothing restarts.
  sessions[0].end(); pass(1000)
  expect(sessions).toHaveLength(1)
  // A screen with nothing to say needs no microphone.
  show(true, [])
  expect(sessions).toHaveLength(1)
})

it('gives the named button to the screen and goes off once it is pressed', () => {
  show(true)
  sessions[0].say('ну не знаю')
  expect(pressed).not.toHaveBeenCalled()
  expect(listening()).toBe('true')
  sessions[0].say('по ехали', 'поехали')
  expect(pressed).toHaveBeenCalledExactlyOnceWith('.start')
  expect(sessions[0].abort).toHaveBeenCalledOnce()
  expect(listening()).toBe('false')
  pass(LISTEN_MS)
  expect(sessions).toHaveLength(1)
})

it('keeps listening when the named button cannot be pressed yet', () => {
  pressed.mockReturnValueOnce(false)
  show(true)
  sessions[0].say('поехали')
  expect(listening()).toBe('true')
  expect(sessions[0].abort).not.toHaveBeenCalled()
  sessions[0].say('поехали')
  expect(pressed).toHaveBeenCalledTimes(2)
  expect(listening()).toBe('false')
})

it('listens on after the browser ends a silent session, and for the commands of the new screen after a change', () => {
  show(true)
  sessions[0].fail('no-speech'); sessions[0].end()
  expect(listening()).toBe('false')
  pass(250)
  expect(sessions).toHaveLength(2)
  expect(listening()).toBe('true')
  show(true, other)
  expect(sessions[1].abort).toHaveBeenCalledOnce()
  expect(sessions).toHaveLength(3)
  sessions[2].say('поехали')
  expect(pressed).not.toHaveBeenCalled()
  sessions[2].say('дальше')
  expect(pressed).toHaveBeenCalledExactlyOnceWith('.other')
})

it('goes off when nobody answers', () => {
  show(true)
  pass(LISTEN_MS - 1)
  expect(listening()).toBe('true')
  pass(1)
  expect(listening()).toBe('false')
  expect(sessions[0].abort).toHaveBeenCalledOnce()
})

it('listens on after a passing failure and gives up for good only after a refusal', () => {
  show(true)
  sessions[0].fail('network'); sessions[0].end()
  expect(listening()).toBe('false')
  expect(console.info).toHaveBeenLastCalledWith('[stella-mic]', 'failed', 'network')
  pass(999)
  expect(sessions).toHaveLength(1)
  pass(1)
  expect(sessions).toHaveLength(2)
  expect(listening()).toBe('true')
  // Another tab took the recogniser, or the microphone was busy for a moment.
  sessions[1].fail('aborted'); sessions[1].end(); pass(1000)
  sessions[2].fail('audio-capture'); sessions[2].end(); pass(1000)
  expect(sessions).toHaveLength(4)
  sessions[3].say('поехали')
  expect(pressed).toHaveBeenCalledExactlyOnceWith('.start')

  show(false); show(true)
  sessions[4].fail('not-allowed')
  expect(listening()).toBe('false')
  expect(console.info).toHaveBeenLastCalledWith('[stella-mic]', 'off', 'not-allowed')
  pass(LISTEN_MS)
  show(false); show(true)
  expect(sessions).toHaveLength(5)
})

it('does not listen while the page is not seen and listens again when it is back', () => {
  hidden = true
  show(true)
  expect(sessions).toHaveLength(0)
  cover(false)
  expect(sessions).toHaveLength(1)
  expect(listening()).toBe('true')
  cover(true)
  expect(sessions[0].abort).toHaveBeenCalledOnce()
  expect(listening()).toBe('false')
  pass(1000)
  expect(sessions).toHaveLength(1)
  cover(false)
  expect(sessions).toHaveLength(2)
  sessions[1].say('поехали')
  expect(pressed).toHaveBeenCalledExactlyOnceWith('.start')
  // Answered: the page coming back later opens nothing.
  cover(true); cover(false)
  expect(sessions).toHaveLength(2)
})

it('leaves the screen to touch where the browser recognises no speech, and tries on while it will not start', () => {
  vi.stubGlobal('webkitSpeechRecognition', undefined)
  show(true)
  expect(listening()).toBe('false')
  expect(console.info).toHaveBeenLastCalledWith('[stella-mic]', 'unavailable', 'the browser recognises no speech')
  vi.stubGlobal('SpeechRecognition', class extends Session { start = vi.fn(() => { throw new DOMException('busy', 'InvalidStateError') }) })
  show(false); show(true)
  expect(sessions).toHaveLength(1)
  expect(listening()).toBe('false')
  pass(1000)
  expect(sessions).toHaveLength(2)
  // Until the wait for an answer is over.
  pass(LISTEN_MS)
  const tried = sessions.length
  pass(5000)
  expect(sessions).toHaveLength(tried)
})
