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

function Harness({ screen = { type: 'vk-onboarding' }, playing = true, brandSplash = false }: {
  screen?: ScreenState; playing?: boolean; brandSplash?: boolean
}) {
  const spoken = useScreenNarration({ screen, playing, brandSplash })
  return <div data-screen={screen.type} data-spoken={spoken ?? ''} />
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
  window.history.replaceState(null, '', '/')
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

it('pauses the same clip for host and hidden state, and never restarts a completed clip on gestures', async () => {
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
  act(() => { visible = false; document.dispatchEvent(new Event('visibilitychange')) })
  expect(sound.pause).toHaveBeenCalledTimes(2)
  act(() => { visible = true; document.dispatchEvent(new Event('visibilitychange')); sound.emit('play'); sound.emit('end') })
  const count = sound.play.mock.calls.length
  act(() => window.dispatchEvent(new Event('pointerup')))
  await act(async () => root.render(<Harness />))
  expect(sound.play).toHaveBeenCalledTimes(count)
  expect(audio.sounds).toHaveLength(1)
})

it('reports a line only once it has been spoken to its end, and anew on every return to its screen', async () => {
  const spoken = () => host.firstElementChild!.getAttribute('data-spoken')
  await act(async () => root.render(<Harness />))
  act(() => { audio.sounds[0].emit('load'); audio.sounds[0].emit('play') })
  expect(spoken()).toBe('')
  act(() => audio.sounds[0].emit('end'))
  expect(spoken()).toBe('vk-onboarding')
  // The scenario pause does not take back what has been said.
  await act(async () => root.render(<Harness playing={false} />))
  expect(spoken()).toBe('vk-onboarding')
  await act(async () => root.render(<Harness screen={{ type: 'max-audience' }} />))
  expect(spoken()).toBe('')
  // Back on the first screen its line is played again: it has to be heard out again.
  await act(async () => root.render(<Harness />))
  expect(audio.sounds).toHaveLength(3)
  expect(spoken()).toBe('')
  act(() => { audio.sounds[2].emit('load'); audio.sounds[2].emit('play'); audio.sounds[2].emit('end') })
  expect(spoken()).toBe('vk-onboarding')
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

it('keeps the start screen silent unless the page asks for the greeting', async () => {
  await act(async () => root.render(<Harness screen={{type:'home'}} />))
  expect(audio.sounds).toHaveLength(0)
  await act(async () => root.render(<Harness />))
  await act(async () => root.render(<Harness screen={{type:'home'}} />))
  expect(audio.sounds).toHaveLength(1)
  expect(audio.sounds[0].source.endsWith('/home.wav')).toBe(false)
})

it('with ?greeting=1 greets by itself on opening and on every return, and stays silent under the brand splash', async () => {
  window.history.replaceState(null, '', '?greeting=1')
  await act(async () => root.render(<Harness screen={{type:'home'}} />))
  expect(audio.sounds).toHaveLength(1)
  expect(audio.sounds[0].source).toBe('/stella/voice/vasilisa/home.wav')
  // The chosen product's logo covers the start screen: the greeting stops with it.
  await act(async () => root.render(<Harness screen={{type:'home'}} brandSplash />))
  expect(audio.sounds[0].unload).toHaveBeenCalledOnce()
  await act(async () => root.render(<Harness />))
  await act(async () => root.render(<Harness screen={{type:'home'}} />))
  expect(audio.sounds).toHaveLength(3)
  expect(audio.sounds[2].source).toBe('/stella/voice/vasilisa/home.wav')
  expect(audio.sounds[2]).not.toBe(audio.sounds[0])
  // It starts as soon as the recording has loaded, with no tap at all.
  act(() => { audio.sounds[2].emit('load') })
  expect(audio.sounds[2].play).toHaveBeenCalledOnce()
})

it('never starts a held-back greeting by a tap on a product logo, only by a tap elsewhere', async () => {
  window.history.replaceState(null, '', '?greeting=1')
  const logo = document.createElement('button')
  logo.className = 'product-tag'
  logo.append(document.createElement('img'))
  document.body.append(logo)
  const open = async () => {
    await act(async () => root.render(<Harness />))
    await act(async () => root.render(<Harness screen={{type:'home'}} />))
    const sound = audio.sounds.at(-1)!
    // The browser refuses to start sound before the first gesture on the page.
    act(() => { sound.emit('load'); sound.emit('playerror') })
    expect(sound.play).toHaveBeenCalledOnce()
    return sound
  }
  try {
    const chosen = await open()
    // The tap that chooses a product, on the logo image itself, together with Howler's unlock on that same tap.
    act(() => { chosen.emit('unlock'); logo.firstElementChild!.dispatchEvent(new Event('pointerup', { bubbles: true })) })
    expect(chosen.play).toHaveBeenCalledOnce()
    // The visitor has chosen: nothing later revives this greeting.
    act(() => { window.dispatchEvent(new Event('pointerup')); window.dispatchEvent(new Event('keydown')) })
    expect(chosen.play).toHaveBeenCalledOnce()

    const elsewhere = await open()
    act(() => window.dispatchEvent(new Event('pointerup')))
    expect(elsewhere.play).toHaveBeenCalledTimes(2)
  } finally { logo.remove() }
})
