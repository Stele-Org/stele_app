import type { Howl } from 'howler'
import { Howler } from 'howler'
import type { AudioCue } from './production-audio'

export interface RemoteVoice {
  voiceId: string
  assetId: string
  bus: 'voice' | 'vk'
  volume: number
  loop: boolean
  positionSeconds: number
  paused: boolean
}
export interface AudioProducer {
  update(voice: RemoteVoice): void
  remove(voiceId: string): void
  close(): void
  status(): unknown
  setState?(state: Record<string, string | number | boolean | null>): void
  event?(event: { type: string; cue?: string; voiceId?: string; errorCode?: string }): void
}
export type ProducerFactory = (options: { source: string }) => AudioProducer

/** Observe Howler's real clocks; MASTER alone owns the audible device.
 * Electron must setAudioMuted(true) before loading the managed page.
 * Do not mute Howler: its per-voice author volume is part of this protocol.
 */
export function observeProductionAudio(bank: Map<AudioCue, Howl>, producer: AudioProducer, bootId: string = crypto.randomUUID()) {
  const active = new Map<string, { sound: Howl; id: number; cue: AudioCue }>()
  const detach: Array<() => void> = []
  let disposed = false
  const key = (cue: AudioCue, id: number) => `${bootId}:${cue}:${id}`
  const context = () => producer.setState?.({ active: active.size, hidden: document.hidden,
    howlerContextState: Howler?.ctx?.state ?? 'unavailable' })
  const event = (type: string, cue: AudioCue, id?: number, errorCode?: string) => {
    producer.event?.({ type, cue, ...(Number.isInteger(id) ? { voiceId: key(cue, id!) } : {}), ...(errorCode ? { errorCode } : {}) })
    context()
  }
  const publish = (voiceId: string) => {
    const entry = active.get(voiceId)
    if (!entry || disposed) return
    const { sound, id, cue } = entry
    const volume = sound.volume(id), positionSeconds = sound.seek(id)
    if (typeof volume !== 'number' || !Number.isFinite(volume) || !Number.isFinite(positionSeconds)) return
    producer.update({ voiceId, assetId: `stella.${cue}`, bus: cue.startsWith('Screen') ? 'voice' : 'vk',
      volume, loop: sound.loop(id), positionSeconds: Math.max(0, positionSeconds), paused: !sound.playing(id) })
  }
  for (const [cue, sound] of bank) {
    const play = (id: number) => {
      if (disposed || !Number.isInteger(id)) return
      const voiceId = key(cue, id)
      active.set(voiceId, { sound, id, cue }); publish(voiceId); event('play', cue, id)
    }
    const update = (id?: number) => {
      if (id === undefined) {
        for (const [voiceId, entry] of active) if (entry.sound === sound) publish(voiceId)
      } else publish(key(cue, id))
    }
    const stop = (id: number, type = 'stop') => {
      const voiceId = key(cue, id)
      if (active.delete(voiceId)) producer.remove(voiceId)
      event(type, cue, id)
    }
    const end = (id: number) => { if (sound.loop(id)) { update(id); event('end', cue, id) } else stop(id, 'end') }
    const reportUpdate = (type: string) => (id: number) => { update(id); event(type, cue, id) }
    const reportError = (type: string) => (id: number, code?: unknown) => {
      event(type, cue, id, typeof code === 'number' && Number.isFinite(code) ? String(code) : type === 'loaderror' ? 'HOWLER_LOAD_ERROR' : 'HOWLER_PLAY_ERROR')
    }
    const listeners: Array<[string, (id: number) => void]> = [
      ['play', play], ['pause', reportUpdate('pause')], ['seek', reportUpdate('seek')], ['volume', reportUpdate('volume')], ['stop', stop], ['end', end],
      ['load', () => event('load', cue)], ['loaderror', reportError('loaderror')], ['playerror', reportError('playerror')],
      ['unlock', () => event('unlock', cue)], ['mute', reportUpdate('mute')], ['rate', reportUpdate('rate')], ['fade', reportUpdate('fade')],
    ]
    for (const [event, handler] of listeners) {
      sound.on(event, handler)
      detach.push(() => { sound.off(event, handler) })
    }
    event(`asset_${sound.state()}`, cue)
  }
  // Read actual playback time instead of predicting it from wall-clock/phase timers.
  const timer = window.setInterval(() => { for (const id of active.keys()) publish(id); context() }, 250)
  const close = () => {
    if (disposed) return
    disposed = true; window.clearInterval(timer)
    detach.forEach(fn => fn()); active.clear(); producer.event?.({ type: 'dispose' }); producer.close()
    window.removeEventListener('pagehide', close)
  }
  window.addEventListener('pagehide', close)
  return { close, status: () => ({ active: active.size, transport: producer.status() }) }
}

const observed = new WeakSet<Map<AudioCue, Howl>>()
const enabled = () => (window as Window & { STAND_AUDIO_MODE?: string }).STAND_AUDIO_MODE === 'master'
    || document.documentElement.dataset.managedAudio === 'true'
let sharedProducer: AudioProducer | undefined
let previousContext = ''

/** Metadata only, including the MAX branch which currently has no mapped cues. */
export function setMasterAudioState(state: Record<string, string | number | boolean | null>) {
  if (!enabled()) return
  const producer = masterProducer()
  producer.setState?.({ ...state, hidden: document.hidden, howlerContextState: Howler?.ctx?.state ?? 'unavailable' })
  const context = JSON.stringify(state)
  if (context !== previousContext) { previousContext = context; producer.event?.({ type: 'state_change', cue: `${state.branch ?? ''}:${state.screen ?? ''}` }) }
}

function masterProducer(): AudioProducer {
  if (sharedProducer) return sharedProducer
  // A pending producer records live state while the bounded, same-origin module loads.
  // Finished one-shots are removed before connection and are never replayed later.
  const voices = new Map<string, RemoteVoice>()
  const metadata: Record<string, string | number | boolean | null> = { active: 0 }
  const events: Array<{ type: string; cue?: string; voiceId?: string; errorCode?: string }> = []
  let delegate: AudioProducer | undefined, closed = false, error: string | undefined
  const buffered: AudioProducer = {
    update(voice) { if (!closed) { voices.set(voice.voiceId, voice); delegate?.update(voice) } },
    remove(id) { voices.delete(id); delegate?.remove(id) },
    close() { closed = true; voices.clear(); delegate?.close() },
    status() { return delegate?.status() ?? { ready: false, error } },
    setState(state) { Object.assign(metadata, state); delegate?.setState?.(state) },
    event(item) { if (delegate) delegate.event?.(item); else { events.push(item); if (events.length > 16) events.shift() } },
  }
  sharedProducer = buffered
  const visibility = () => buffered.setState?.({ hidden: document.hidden, howlerContextState: Howler?.ctx?.state ?? 'unavailable' })
  document.addEventListener('visibilitychange', visibility)
  window.addEventListener('pagehide', () => { document.removeEventListener('visibilitychange', visibility); buffered.close() }, { once: true })
  Object.assign(window, { STAND_STELLA_AUDIO: { status: () => ({ state: { ...metadata }, transport: buffered.status() }) } })
  const modulePath = '/bridge/audio-client.mjs'
  void import(/* @vite-ignore */ modulePath).then((module: { createAudioProducer: ProducerFactory }) => {
    if (closed) return
    delegate = module.createAudioProducer({ source: 'stella' })
    delegate.setState?.(metadata)
    for (const item of events) delegate.event?.(item)
    events.length = 0
    for (const voice of voices.values()) delegate.update(voice)
  }).catch(() => {
    error = 'AUDIO_BRIDGE_UNAVAILABLE'
    console.warn('[stella-audio] MASTER bridge unavailable; satellite output remains muted')
  })
  return buffered
}

export function ensureMasterAudioObserver(bank: Map<AudioCue, Howl>) {
  if (!enabled() || observed.has(bank)) return
  observed.add(bank)
  observeProductionAudio(bank, masterProducer())
}
