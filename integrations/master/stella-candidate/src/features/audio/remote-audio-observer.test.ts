// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Howl } from 'howler'
import { observeProductionAudio, setMasterAudioState, type RemoteVoice } from './remote-audio-observer'
import type { AudioCue } from './production-audio'

class ClockSound {
  listeners = new Map<string, Set<(id: number) => void>>()
  clocks = new Map<number, { position: number; gain: number; playing: boolean; loop: boolean }>()
  on(event: string, callback: (id: number) => void) { if (!this.listeners.has(event)) this.listeners.set(event, new Set()); this.listeners.get(event)!.add(callback); return this }
  off(event: string, callback: (id: number) => void) { this.listeners.get(event)?.delete(callback); return this }
  emit(event: string, id: number) { this.listeners.get(event)?.forEach(fn => fn(id)) }
  volume(id: number) { return this.clocks.get(id)!.gain }
  seek(id: number) { return this.clocks.get(id)!.position }
  playing(id: number) { return this.clocks.get(id)!.playing }
  loop(id: number) { return this.clocks.get(id)!.loop }
  state() { return 'loaded' }
  start(id: number, position = 0) { this.clocks.set(id, { position, gain: .9, playing: true, loop: false }); this.emit('play', id) }
}
let close: () => void
beforeEach(() => vi.useFakeTimers())
afterEach(() => { close?.(); vi.useRealTimers() })
function fixture() {
  const voice = new ClockSound(), effect = new ClockSound()
  const snapshots = new Map<string, RemoteVoice>()
  const producer = { update: vi.fn((value: RemoteVoice) => snapshots.set(value.voiceId, value)), remove: vi.fn((id: string) => snapshots.delete(id)), close: vi.fn(), status: () => ({ ready: true }), event:vi.fn(),setState:vi.fn() }
  const bank = new Map<AudioCue, Howl>([['Screen1', voice as unknown as Howl], ['Tags', effect as unknown as Howl]])
  const observer = observeProductionAudio(bank, producer, 'boot-1'); close = observer.close
  return { voice, effect, producer, snapshots, observer }
}
it('forwards the authored Howler voice and effect gains to separate buses, never creates playback', () => {
  const { voice, effect, snapshots } = fixture()
  expect(snapshots.size).toBe(0)
  voice.start(11, .3); effect.start(22)
  expect(snapshots.get('boot-1:Screen1:11')).toEqual({voiceId:'boot-1:Screen1:11',assetId:'stella.Screen1',bus:'voice',volume:.9,loop:false,positionSeconds:.3,paused:false})
  expect(snapshots.get('boot-1:Tags:22')!.bus).toBe('vk')
})
it('refreshes actual player position and pause/resume on the same voice identity', () => {
  const { voice, snapshots } = fixture(); voice.start(11)
  Object.assign(voice.clocks.get(11)!, { position: 2.1, playing: false }); voice.emit('pause',11)
  expect(snapshots.get('boot-1:Screen1:11')).toMatchObject({positionSeconds:2.1,paused:true})
  voice.clocks.get(11)!.playing=true; voice.emit('play',11)
  voice.clocks.get(11)!.position=3.7; vi.advanceTimersByTime(250)
  expect(snapshots.size).toBe(1)
  expect(snapshots.get('boot-1:Screen1:11')).toMatchObject({positionSeconds:3.7,paused:false})
})
it('forwards seek and duck gain without resetting the clip', () => {
  const { effect, snapshots }=fixture(); effect.start(22)
  effect.clocks.get(22)!.gain=.13; effect.emit('volume',22)
  effect.clocks.get(22)!.position=4; effect.emit('seek',22)
  expect(snapshots.get('boot-1:Tags:22')).toMatchObject({volume:.13,positionSeconds:4})
})
it('natural end and departure remove voices; polling never resurrects finished one-shots', () => {
  const { voice,effect,producer,snapshots }=fixture(); voice.start(11);effect.start(22)
  voice.emit('end',11);effect.emit('stop',22);vi.advanceTimersByTime(2000)
  expect(snapshots.size).toBe(0);expect(producer.remove).toHaveBeenCalledTimes(2)
  expect(producer.update).toHaveBeenCalledTimes(2)
})
it('loop end keeps a still-looping voice, explicit stop removes it', () => {
  const {effect,snapshots}=fixture();effect.start(22);effect.clocks.get(22)!.loop=true
  effect.emit('end',22);expect(snapshots.size).toBe(1)
  effect.emit('stop',22);expect(snapshots.size).toBe(0)
})
it('pagehide closes the lease once and removes all listeners and intervals', () => {
  const {voice,producer}=fixture();voice.start(11)
  window.dispatchEvent(new Event('pagehide'));close();voice.emit('play',11);vi.advanceTimersByTime(1000)
  expect(producer.close).toHaveBeenCalledOnce();expect(producer.update).toHaveBeenCalledOnce()
  expect([...voice.listeners.values()].every(set=>set.size===0)).toBe(true)
})
it('rejects invalid clock data instead of publishing a corrupt snapshot', () => {
  const {voice,producer}=fixture();voice.start(11);voice.clocks.get(11)!.position=NaN
  voice.emit('seek',11);vi.advanceTimersByTime(250);expect(producer.update).toHaveBeenCalledOnce()
})
it('reports load, blocked playback and unlock even when no playable voice exists', () => {
  const {voice,producer,snapshots}=fixture()
  voice.emit('load',0);voice.emit('loaderror',0);voice.emit('playerror',11);voice.emit('unlock',0)
  expect(snapshots.size).toBe(0)
  expect(producer.event.mock.calls.map(([event])=>event.type)).toEqual(['asset_loaded','asset_loaded','load','loaderror','playerror','unlock'])
  expect(producer.event).toHaveBeenCalledWith({type:'playerror',cue:'Screen1',voiceId:'boot-1:Screen1:11',errorCode:'HOWLER_PLAY_ERROR'})
})
it('preserves successful lifecycle names, active counts and paused voice identity', () => {
  const {voice,producer}=fixture();voice.start(11)
  voice.clocks.get(11)!.playing=false;voice.emit('pause',11)
  voice.emit('seek',11);voice.emit('volume',11);voice.emit('mute',11);voice.emit('rate',11);voice.emit('fade',11)
  voice.clocks.get(11)!.playing=true;voice.emit('play',11);voice.emit('end',11)
  expect(producer.event.mock.calls.map(([event])=>event.type).slice(2)).toEqual(['play','pause','seek','volume','mute','rate','fade','play','end'])
  expect(producer.setState).toHaveBeenLastCalledWith(expect.objectContaining({active:0,hidden:false}))
})
it('direct MAX entry has observable state with zero cues, even before any Howler bank exists', async () => {
  document.documentElement.dataset.managedAudio='true'
  const warn=vi.spyOn(console,'warn').mockImplementation(()=>{})
  try {
    setMasterAudioState({branch:'max',phase:'active',screen:'goal',questionIndex:-1,playing:true,effectsPlaying:false,splash:false,narrationCue:null,effectCue:null,reason:'no_cues_mapped'})
    const debug=(window as unknown as Window & {STAND_STELLA_AUDIO:{status:()=>{state:Record<string,unknown>}}}).STAND_STELLA_AUDIO
    expect(debug.status().state).toMatchObject({branch:'max',phase:'active',screen:'goal',active:0,reason:'no_cues_mapped'})
    setMasterAudioState({branch:'vk',phase:'question',screen:'question',questionIndex:1,playing:false,effectsPlaying:true,splash:false,narrationCue:'Screen3',effectCue:null,reason:'presentation_paused'})
    expect(debug.status().state).toMatchObject({branch:'vk',screen:'question',narrationCue:'Screen3',playing:false})
    await vi.dynamicImportSettled() // This isolated test deliberately has no bridge server.
  } finally {window.dispatchEvent(new Event('pagehide'));delete document.documentElement.dataset.managedAudio;warn.mockRestore()}
})
