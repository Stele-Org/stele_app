// @vitest-environment jsdom
import { act, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { ScreenState } from '../prototype/Prototype'
import { useScreenNarration } from './use-screen-narration'

const audio = vi.hoisted(() => {
  class Sound {
    source: string
    loaded = false
    handlers = new Map<string, Array<() => void>>()
    play = vi.fn((id?: number) => id ?? 7)
    pause = vi.fn()
    stop = vi.fn()
    unload = vi.fn()
    state = () => this.loaded ? 'loaded' : 'loading'
    on(event: string, callback: () => void) {
      this.handlers.set(event, [...(this.handlers.get(event) ?? []), callback])
      return this
    }
    off() { this.handlers.clear() }
    emit(event: string) {
      if (event === 'load') this.loaded = true
      this.handlers.get(event)?.forEach(callback => callback())
    }
    constructor(options: { src: string[] }) { this.source = options.src[0]; sounds.push(this) }
  }
  const sounds: Sound[] = []
  return { Sound, sounds }
})
vi.mock('howler', () => ({ Howl: audio.Sound }))

let root: Root, host: HTMLDivElement
let visible = true
const manifest = { version: 1, voice: 'Василиса', ready: true, assets: { home: 'home.wav', 'max-audience': 'max-audience.wav', 'vk-onboarding': 'vk-onboarding.wav' } }

function Harness({ screen = { type: 'vk-onboarding' }, playing = true, termsOpen = false, brandSplash = false }: {
  screen?: ScreenState; playing?: boolean; termsOpen?: boolean; brandSplash?: boolean
}) {
  useScreenNarration({ screen, playing, termsOpen, brandSplash })
  return <div data-screen={screen.type} />
}

beforeEach(() => {
  audio.sounds.length = 0
  visible = true
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubEnv('BASE_URL', '/stella/')
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => !visible)
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => manifest })))
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

it('ignores stale load/unlock after switching screens and retries only the current blocked clip', async () => {
  await act(async () => root.render(<Harness />))
  const old = audio.sounds[0]
  const delayedLoad = old.handlers.get('load')![0]
  await act(async () => root.render(<Harness screen={{ type: 'max-audience' }} />))
  const current = audio.sounds[1]
  expect(old.stop).toHaveBeenCalledOnce()
  expect(old.unload).toHaveBeenCalledOnce()
  old.loaded = true
  delayedLoad()
  old.emit('unlock')
  expect(old.play).not.toHaveBeenCalled()
  act(() => current.emit('load'))
  expect(current.play).toHaveBeenCalledOnce()
  act(() => current.emit('playerror'))
  act(() => window.dispatchEvent(new Event('pointerup')))
  expect(current.play).toHaveBeenLastCalledWith(7)
  expect(current.play).toHaveBeenCalledTimes(2)
  expect(old.play).not.toHaveBeenCalled()
})

it('pauses the same clip for host, terms and hidden state, and never restarts a completed clip on gestures', async () => {
  await act(async () => root.render(<Harness />))
  const sound = audio.sounds[0]
  act(() => { sound.emit('load'); sound.emit('play') })
  await act(async () => root.render(<Harness playing={false} />))
  expect(sound.pause).toHaveBeenCalledWith(7)
  act(() => window.dispatchEvent(new Event('pointerup')))
  expect(sound.play).toHaveBeenCalledOnce()
  await act(async () => root.render(<Harness />))
  expect(sound.play).toHaveBeenLastCalledWith(7)
  act(() => sound.emit('play'))
  await act(async () => root.render(<Harness termsOpen />))
  expect(sound.pause).toHaveBeenCalledTimes(2)
  await act(async () => root.render(<Harness />))
  act(() => sound.emit('play'))
  act(() => { visible = false; document.dispatchEvent(new Event('visibilitychange')) })
  expect(sound.pause).toHaveBeenCalledTimes(3)
  act(() => { visible = true; document.dispatchEvent(new Event('visibilitychange')); sound.emit('play'); sound.emit('end') })
  const count = sound.play.mock.calls.length
  act(() => window.dispatchEvent(new Event('pointerup')))
  await act(async () => root.render(<Harness />))
  expect(sound.play).toHaveBeenCalledTimes(count)
  expect(audio.sounds).toHaveLength(1)
})

it('does not speak during splash/reveal and starts onboarding only when it becomes visible', async () => {
  await act(async () => root.render(<Harness screen={{ type: 'vk-onboarding' }} brandSplash />))
  expect(audio.sounds).toHaveLength(0)
  await act(async () => root.render(<Harness screen={{ type: 'vk-onboarding' }} />))
  expect(audio.sounds).toHaveLength(1)
  expect(audio.sounds[0].source).toBe('/stella/voice/vasilisa/vk-onboarding.wav')
  await act(async () => root.render(<Harness screen={{ type: 'vk-photo-reveal', answerId: 'skip', metadata: [], next: { type: 'home' } }} />))
  expect(audio.sounds[0].unload).toHaveBeenCalledOnce()
  act(() => window.dispatchEvent(new Event('pointerup')))
  expect(audio.sounds[0].play).not.toHaveBeenCalled()
})

it('stays silent with an unready manifest even when assets are listed', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ ...manifest, ready: false }) })))
  await act(async () => root.render(<Harness />))
  act(() => window.dispatchEvent(new Event('pointerup')))
  expect(audio.sounds).toHaveLength(0)
})

it('StrictMode discards the first async manifest response and unloads the only active sound on dispose', async () => {
  await act(async () => root.render(<StrictMode><Harness /></StrictMode>))
  expect(audio.sounds).toHaveLength(1)
  const sound = audio.sounds[0]
  act(() => { sound.emit('load'); sound.emit('play') })
  await act(async () => root.render(null))
  expect(sound.unload).toHaveBeenCalledOnce()
  act(() => window.dispatchEvent(new Event('pointerup')))
  expect(sound.play).toHaveBeenCalledOnce()
})

it('keeps the retained home greeting silent on opening and return', async () => {
  await act(async () => root.render(<Harness screen={{type:'home'}} />))
  expect(audio.sounds).toHaveLength(0)
  await act(async () => root.render(<Harness />))
  await act(async () => root.render(<Harness screen={{type:'home'}} />))
  expect(audio.sounds).toHaveLength(1)
  expect(audio.sounds[0].source.endsWith('/home.wav')).toBe(false)
})
