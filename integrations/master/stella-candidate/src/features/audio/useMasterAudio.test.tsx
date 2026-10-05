// @vitest-environment jsdom
import { act, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useMasterAudio, type MasterAudioOptions } from '../master/useMasterAudio'
import { masterNarration } from './production-audio'
import { acceptedSoundAction, emitAcceptedSoundAction } from '../sound/sfx-events'
import { setMasterAudioState } from './remote-audio-observer'
import { useMasterMaxAudio } from '../master/useMasterMaxAudio'

const mock = vi.hoisted(() => {
  class Sound {
    src: string
    loaded = true
    listeners = new Map<string, Set<() => void>>()
    play = vi.fn((id?: number) => id ?? 12)
    pause = vi.fn()
    stop = vi.fn()
    volume = vi.fn()
    state = () => this.loaded ? 'loaded' : 'loading'
    constructor(options: { src: string[] }) { this.src = options.src[0]; sounds.push(this) }
    on(event: string, callback: () => void) {
      if (!this.listeners.has(event)) this.listeners.set(event, new Set())
      this.listeners.get(event)!.add(callback)
      return this
    }
    off(event: string, callback: () => void) { this.listeners.get(event)?.delete(callback); return this }
    emit(event: string) { if (event === 'load') this.loaded = true; this.listeners.get(event)?.forEach(fn => fn()) }
  }
  const sounds: Sound[] = []
  return { Sound, sounds }
})
vi.mock('howler', () => ({ Howl: mock.Sound }))
vi.mock('./remote-audio-observer', () => ({ ensureMasterAudioObserver: vi.fn(), setMasterAudioState: vi.fn() }))

let root: Root, host: HTMLDivElement, hidden = false
const sound = (cue: string) => mock.sounds.find(s => s.src.endsWith(`/${cue}.wav`))!
function Harness(props: Partial<MasterAudioOptions>) {
  useMasterAudio({ screen: 'home', playing: true, sessionId: 's1', instanceKey: 'master1', ...props })
  return <div className="prototype-viewport"><button>Action</button><button disabled>Disabled</button></div>
}
const render = async (props: Partial<MasterAudioOptions>, strict = false) => act(async () => {
  root.render(strict ? <StrictMode><Harness {...props} /></StrictMode> : <Harness {...props} />)
})
beforeEach(() => {
  hidden = false
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden)
  vi.stubEnv('BASE_URL', '/stella/')
  for (const item of mock.sounds) { item.loaded = true; item.play.mockClear(); item.pause.mockClear(); item.stop.mockClear(); item.volume.mockClear() }
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs() })

const accepted = (manual = true) => act(() => window.dispatchEvent(new CustomEvent(acceptedSoundAction, { detail: { manual } })))
it('keeps mismatched photo, camera and final silent; particles use the complete verified Discovery clip', () => {
  expect(['photochoice','camera','final','photo-bridge'].map(s => masterNarration(s))).toEqual([null,null,null,null])
  expect(masterNarration('particles')).toBe('Screen7')
  expect(masterNarration('home')).toBeNull()
})
it('preloads a shared central bank once; home has no automatic audio before accepted input', async () => {
  await render({}); expect(mock.sounds).toHaveLength(21)
  expect(mock.sounds.every(s => s.play.mock.calls.length === 0)).toBe(true)
  await render({screen:'onboarding'}); expect(sound('Screen1').play).toHaveBeenCalledOnce()
  await render({screen:'question',questionIndex:0}); expect(mock.sounds).toHaveLength(21)
  expect(sound('Screen1').stop).toHaveBeenCalledWith(12)
})
it('does not replay voice or ordered effects on polling; accepted reveals cycle through all five and reset on home', async () => {
  await render({screen:'question',questionIndex:0}); accepted()
  await render({screen:'answer-reveal',questionIndex:0,revision:1})
  await render({screen:'answer-reveal',questionIndex:0,revision:2})
  expect(sound('ChangeScreen').play).toHaveBeenCalledOnce()
  for(let i=1;i<6;i++) {
    await render({screen:'question',questionIndex:i})
    await render({screen:'answer-reveal',questionIndex:i})
  }
  expect(sound('ChangeScreen').play).toHaveBeenCalledTimes(2)
  for(let i=2;i<=5;i++) expect(sound(`ChangeScreen${i}`).play).toHaveBeenCalledOnce()
  expect(sound('Tags').play).not.toHaveBeenCalled()
  await render({screen:'home'}); await render({screen:'photo-reveal'})
  expect(sound('ChangeScreen').play).toHaveBeenCalledTimes(3)
})
it('pauses and resumes the same narration id; finished narration never restarts', async () => {
  await render({screen:'particles'}); sound('Screen7').emit('play')
  await render({screen:'particles',playing:false}); expect(sound('Screen7').pause).toHaveBeenCalledWith(12)
  await render({screen:'particles',playing:true}); expect(sound('Screen7').play).toHaveBeenLastCalledWith(12)
  sound('Screen7').emit('end'); const count=sound('Screen7').play.mock.calls.length
  act(()=>window.dispatchEvent(new Event('pointerup')))
  expect(sound('Screen7').play).toHaveBeenCalledTimes(count)
})
it('stale load cannot start a narration already left, while current blocked audio can retry', async () => {
  await render({}); sound('Screen1').loaded=false
  await render({screen:'onboarding'})
  const stale=[...sound('Screen1').listeners.get('load')!].at(-1)!
  await render({screen:'particles'})
  sound('Screen1').loaded=true; stale(); sound('Screen1').emit('unlock')
  expect(sound('Screen1').play).not.toHaveBeenCalled()
  sound('Screen7').emit('playerror'); act(()=>sound('Screen7').emit('unlock'))
  expect(sound('Screen7').play).toHaveBeenLastCalledWith(12)
})
it('scan beds and paired start/end variants only run on actual scan; photo skip never scans', async () => {
  await render({screen:'photochoice'}); accepted()
  await render({screen:'particles'}); expect(sound('Scan').play).not.toHaveBeenCalled()
  expect(sound('ScanStart1').play).not.toHaveBeenCalled()
  await render({screen:'scanning'}); expect(sound('Scan').play).toHaveBeenCalledOnce()
  expect(sound('ScanStart1').play).toHaveBeenCalledOnce()
  await render({screen:'particles'}); expect(sound('Scan').stop).toHaveBeenCalledWith(12)
  expect(sound('ScanEnd1').play).toHaveBeenCalledOnce()
  await render({screen:'scanning'}); expect(sound('ScanStart2').play).toHaveBeenCalledOnce()
  await render({screen:'particles'}); expect(sound('ScanEnd2').play).toHaveBeenCalledOnce()
})
it('raw button clicks never sound; accepted actions do, and hidden/paused input cannot', async () => {
  await render({})
  act(()=>host.querySelector('button')!.click()); expect(sound('Click').play).not.toHaveBeenCalled()
  accepted(); expect(sound('Click').play).toHaveBeenCalledOnce()
  accepted(false); expect(sound('Click').play).toHaveBeenCalledOnce()
  hidden=true; act(()=>document.dispatchEvent(new Event('visibilitychange'))); accepted()
  expect(sound('Click').play).toHaveBeenCalledOnce()
  expect(sound('AmbienceMain').pause).toHaveBeenCalledWith(12)
})
it('StrictMode starts one current ready narration and switching sessions cuts it', async () => {
  await render({screen:'particles'},true); expect(sound('Screen7').play).toHaveBeenCalledOnce()
  await render({screen:'onboarding',sessionId:'s2'},true); expect(sound('Screen7').stop).toHaveBeenCalledWith(12)
  expect(sound('Screen1').play).toHaveBeenCalledOnce()
})
it('tap and main ambience survive server pending/phase changes; real pause stops effects', async () => {
  await render({screen:'question',questionIndex:0,effectsPlaying:true}); accepted()
  expect(sound('Click').play).toHaveBeenCalledOnce()
  sound('Click').stop.mockClear()
  await render({screen:'question',questionIndex:0,playing:false,effectsPlaying:true})
  await render({screen:'answer-reveal',questionIndex:0,playing:true,effectsPlaying:true})
  expect(sound('Click').stop).not.toHaveBeenCalled()
  expect(sound('AmbienceMain').play).toHaveBeenCalledOnce()
  await render({screen:'answer-reveal',questionIndex:0,playing:false,effectsPlaying:false})
  expect(sound('Click').stop).toHaveBeenCalled()
})
it('MAX shares the effects without ever using VK Screen narration', async () => {
  await render({screen:'onboarding',narrationEnabled:false}); accepted()
  await render({screen:'answer-reveal',narrationEnabled:false})
  expect(sound('Screen1').play).not.toHaveBeenCalled()
  expect(sound('ChangeScreen').play).toHaveBeenCalledOnce()
})
it('consent blocking pauses narration and ambience, stops effects and resumes the same bed', async () => {
  await render({screen:'particles'}); accepted(); sound('Screen7').emit('play')
  await render({screen:'particles',blocked:true})
  expect(sound('Screen7').pause).toHaveBeenCalledWith(12)
  expect(sound('AmbienceMain').pause).toHaveBeenCalledWith(12)
  expect(sound('Click').stop).toHaveBeenCalledWith(12)
  await render({screen:'particles',blocked:false})
  expect(sound('AmbienceMain').play).toHaveBeenLastCalledWith(12)
})
it('keeps the already accepted shell gesture when it mounts a new product slice, without replaying a click', async () => {
  emitAcceptedSoundAction(true)
  await render({screen:'onboarding'})
  expect(sound('AmbienceMain').play).toHaveBeenCalledOnce()
  expect(sound('Click').play).not.toHaveBeenCalled()
})

it('retains AUDIO03 metadata without assigning VK narration to MAX or claiming SFX playback', async () => {
  await render({ screen: 'question', questionIndex: 1 })
  expect(setMasterAudioState).toHaveBeenLastCalledWith(expect.objectContaining({
    branch: 'vk', screen: 'question', narrationCue: 'Screen3', effectCue: null, effectMode: 'ordered_sfx', reason: 'scene_active',
  }))
  function MaxHarness() { useMasterMaxAudio({ screen: 'brand-entry', playing: true, splash: true }); return null }
  await act(async () => root.render(<MaxHarness />))
  expect(setMasterAudioState).toHaveBeenLastCalledWith(expect.objectContaining({
    branch: 'max', screen: 'brand-entry', narrationEnabled: false, narrationCue: null, reason: 'brand_splash',
  }))
})
