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
  pressed.mockReset().mockReturnValue(true)
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('webkitSpeechRecognition', Session)
  vi.useFakeTimers()
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount()); host.remove()
  vi.useRealTimers(); vi.unstubAllGlobals()
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

it('does not ask for the microphone again after a refusal, and tries again after a passing failure', () => {
  show(true)
  sessions[0].fail('network')
  expect(listening()).toBe('false')
  pass(1000)
  expect(sessions).toHaveLength(1)
  show(false); show(true)
  expect(sessions).toHaveLength(2)
  sessions[1].fail('not-allowed')
  show(false); show(true)
  expect(sessions).toHaveLength(2)
  expect(listening()).toBe('false')
})

it('leaves the screen to touch where the browser recognises no speech or will not start', () => {
  vi.stubGlobal('webkitSpeechRecognition', undefined)
  show(true)
  expect(listening()).toBe('false')
  vi.stubGlobal('SpeechRecognition', class extends Session { start = vi.fn(() => { throw new DOMException('busy', 'InvalidStateError') }) })
  show(false); show(true)
  expect(sessions).toHaveLength(1)
  expect(listening()).toBe('false')
  pass(1000)
  expect(sessions).toHaveLength(1)
})
