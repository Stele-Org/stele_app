import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createStellaSound, type SoundContext } from './stella-sound'
import type { ScreenState } from '../prototype/Prototype'
import manifest from '../../../public/sound/stella/manifest.json'

const audio = vi.hoisted(() => {
  type Operation = { file: string; method: 'play' | 'pause' | 'stop' | 'unload'; id?: number }
  const operations: Operation[] = []
  const sounds: Sound[] = []
  let nextId = 1
  class Sound {
    handlers = new Map<string, Array<(...args: unknown[]) => void>>()
    file: string
    play = vi.fn((id?: number) => {
      operations.push({ file: this.file, method: 'play', id })
      return id ?? nextId++
    })
    pause = vi.fn((id?: number) => { operations.push({ file: this.file, method: 'pause', id }); return this })
    stop = vi.fn((id?: number) => { operations.push({ file: this.file, method: 'stop', id }); return this })
    unload = vi.fn(() => { operations.push({ file: this.file, method: 'unload' }); return null })
    on(event: string, callback: (...args: unknown[]) => void) {
      this.handlers.set(event, [...(this.handlers.get(event) ?? []), callback])
      return this
    }
    emit(event: string, ...args: unknown[]) { this.handlers.get(event)?.forEach(callback => callback(...args)) }
    constructor(readonly options: { src: string[]; loop: boolean; volume: number; preload: boolean }) {
      this.file = options.src[0].split('/').at(-1)!
      sounds.push(this)
    }
  }
  return { operations, sounds, Sound }
})
vi.mock('howler', () => ({ Howl: audio.Sound }))

const assets = manifest.assets
const home: ScreenState = { type: 'home' }
const reveal = (): ScreenState => ({ type: 'vk-answer-reveal', questionIndex: 0, optionIndex: 0,
  label: 'Ответ', metadata: ['тег'], next: { type: 'vk-question', index: 1, answers: ['series'] } })
const scan = (): ScreenState => ({ type: 'vk-scanning', themes: ['Кино'] })
const particles = (): ScreenState => ({ type: 'vk-particles', themes: ['Кино'] })
let player: ReturnType<typeof createStellaSound>
const sound = (file: string) => audio.sounds.find(instance => instance.file === file)!
const plays = (file: string) => sound(file).play.mock.calls.length
const played = (files: string[]) => audio.operations.filter(operation => operation.method === 'play' && files.includes(operation.file)).map(operation => operation.file)
const context = (screen: ScreenState = home, changes: Partial<SoundContext> = {}) => player.setContext({ screen, playing: true, blocked: false, hidden: false, ...changes })

beforeEach(() => {
  audio.sounds.length = 0
  audio.operations.length = 0
  player = createStellaSound('/stella/sound/stella/')
})
afterEach(() => { player.dispose() })

it('waits for an accepted action to unlock ambience; only manual actions play the click cue', () => {
  context()
  player.retryUnlock()
  expect(audio.operations).toEqual([])
  player.acceptedAction(false)
  expect(plays(assets.ambienceMain)).toBe(1)
  expect(plays(assets.buttonClick)).toBe(0)
  player.acceptedAction(true)
  expect(plays(assets.ambienceMain)).toBe(1)
  expect(plays(assets.buttonClick)).toBe(1)
  expect(sound(assets.ambienceMain).options.loop).toBe(true)
  expect(sound(assets.ambienceScan).options.loop).toBe(true)
  expect(sound(assets.buttonClick).options.loop).toBe(false)
  expect(sound(assets.buttonClick).options.src).toEqual(['/stella/sound/stella/' + assets.buttonClick])
})

it('cycles transition variants 1 through 5, ignores context-only rerenders and restarts at home', () => {
  context()
  player.acceptedAction(false)
  for (let index = 0; index < 6; index++) {
    const selected = reveal()
    context(selected)
    context(selected)
    context(selected, { playing: false })
    context(selected)
    context({ type: 'vk-question', index: 1, answers: ['series'] })
  }
  expect(played(assets.transitions)).toEqual([...assets.transitions, assets.transitions[0]])
  context({ type: 'home' })
  context(reveal())
  expect(played(assets.transitions)).toEqual([...assets.transitions, assets.transitions[0], assets.transitions[0]])
})

it('pairs alternating scan start/end cues and swaps main ambience to scan then back', () => {
  context()
  player.acceptedAction(false)
  const main = sound(assets.ambienceMain)
  const scanBed = sound(assets.ambienceScan)
  const firstMainId = main.play.mock.results[0].value
  context(scan())
  expect(main.stop).toHaveBeenCalledWith(firstMainId)
  expect(plays(assets.ambienceScan)).toBe(1)
  expect(played(assets.scanStart)).toEqual([assets.scanStart[0]])
  const firstScanId = scanBed.play.mock.results[0].value
  context(particles())
  expect(scanBed.stop).toHaveBeenCalledWith(firstScanId)
  expect(plays(assets.ambienceMain)).toBe(2)
  expect(played(assets.scanEnd)).toEqual([assets.scanEnd[0]])
  for (let index = 0; index < 2; index++) { context(scan()); context(particles()) }
  expect(played(assets.scanStart)).toEqual([assets.scanStart[0], assets.scanStart[1], assets.scanStart[0]])
  expect(played(assets.scanEnd)).toEqual([assets.scanEnd[0], assets.scanEnd[1], assets.scanEnd[0]])
})

it('ends the scan into the check of its photo: the end cue plays there and not again when Discovery follows', () => {
  context()
  player.acceptedAction(false)
  context(scan())
  context({ type: 'vk-photo-review', themes: ['Кино'] })
  expect(played(assets.scanEnd)).toEqual([assets.scanEnd[0]])
  expect(plays(assets.ambienceMain)).toBe(2)
  context(particles())
  expect(played(assets.scanEnd)).toEqual([assets.scanEnd[0]])
})

it.each(['hidden', 'blocked', 'playing'] as const)('pauses the bed on %s, stops cues and resumes the same bed without replaying stale effects', gate => {
  context()
  player.acceptedAction(true)
  const selected = reveal()
  context(selected)
  const main = sound(assets.ambienceMain)
  const id = main.play.mock.results[0].value
  const unavailable = gate === 'playing' ? { playing: false } : { [gate]: true }
  context(selected, unavailable)
  expect(main.pause).toHaveBeenCalledExactlyOnceWith(id)
  expect(sound(assets.buttonClick).stop).toHaveBeenCalledTimes(2)
  expect(sound(assets.transitions[0]).stop).toHaveBeenCalledTimes(2)
  context(selected, unavailable)
  player.acceptedAction(true)
  player.retryUnlock()
  expect(main.pause).toHaveBeenCalledTimes(1)
  expect(plays(assets.buttonClick)).toBe(1)
  expect(plays(assets.transitions[0])).toBe(1)
  context(selected)
  expect(main.play).toHaveBeenLastCalledWith(id)
  expect(plays(assets.ambienceMain)).toBe(2)
  expect(plays(assets.transitions[0])).toBe(1)
  expect(plays(assets.buttonClick)).toBe(1)
})

it('does not replay a transition that arrived while blocked after the gate reopens', () => {
  context()
  player.acceptedAction(false)
  const selected = reveal()
  context(selected, { blocked: true })
  expect(played(assets.transitions)).toEqual([])
  context(selected)
  expect(played(assets.transitions)).toEqual([])
  context(reveal())
  expect(played(assets.transitions)).toEqual([assets.transitions[1]])
})

it('keeps an accepted action silent until the host permits playback', () => {
  context(home, { playing: false })
  player.acceptedAction(true)
  expect(audio.operations).toEqual([])
  context(home)
  expect(plays(assets.ambienceMain)).toBe(1)
  expect(plays(assets.buttonClick)).toBe(0)
})

it('retries an autoplay-blocked bed on Howler unlock using the same playback ID and does not duplicate cues', () => {
  context()
  player.acceptedAction(true)
  const main = sound(assets.ambienceMain)
  const id = main.play.mock.results[0].value
  main.emit('playerror', id, 'Browser playback requires a user gesture')
  main.emit('unlock')
  expect(main.play).toHaveBeenLastCalledWith(id)
  expect(plays(assets.ambienceMain)).toBe(2)
  expect(plays(assets.buttonClick)).toBe(1)
  main.emit('unlock')
  expect(plays(assets.ambienceMain)).toBe(2)
  context(home, { hidden: true })
  main.emit('playerror', id, 'Blocked again')
  main.emit('unlock')
  expect(plays(assets.ambienceMain)).toBe(2)
  context(home)
  expect(main.play).toHaveBeenLastCalledWith(id)
  expect(plays(assets.ambienceMain)).toBe(3)
})

it('stops and unloads every asset on disposal and ignores later context, action and retry requests', () => {
  context()
  player.acceptedAction(true)
  context(scan())
  player.dispose()
  for (const instance of audio.sounds) {
    expect(instance.stop).toHaveBeenCalled()
    expect(instance.unload).toHaveBeenCalledOnce()
  }
  const operations = [...audio.operations]
  context(particles())
  player.acceptedAction(true)
  player.retryUnlock()
  sound(assets.ambienceScan).emit('unlock')
  player.dispose()
  expect(audio.operations).toEqual(operations)
})
