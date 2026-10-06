import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Howl } from 'howler'
import { masterNarration, productionAudio, soundAllowed, type AudioCue } from '../audio/production-audio'
import { createMasterSound } from '../audio/master-sound'
import { setMasterAudioState } from '../audio/remote-audio-observer'
import { acceptedSoundAction, hasAcceptedSoundAction } from '../sound/sfx-events'
import { readGreeting } from '../voice/greeting'

export interface MasterAudioOptions {
  screen: string
  branch?: 'vk' | 'max'
  sessionId?: string
  instanceKey?: string
  questionIndex?: number
  /** The answer whose reveal is on the screen. */
  answerId?: string
  revision?: number
  playing: boolean
  effectsPlaying?: boolean
  splash?: boolean
  narrationEnabled?: boolean
  blocked?: boolean
}

interface Track {
  sound: Howl
  id?: number
  state: 'idle' | 'starting' | 'playing' | 'paused' | 'blocked' | 'ended'
  start: () => void
  sync: () => void
  dispose: () => void
}

/** UI orchestration over cached Howler clips; never advances the master's scenario. */
export function useMasterAudio({ screen, sessionId, instanceKey, questionIndex, answerId, playing, effectsPlaying = playing, splash = false, narrationEnabled = true, blocked = false, branch = 'vk' }: MasterAudioOptions) {
  const [greeting] = useState(() => readGreeting(window.location.search))
  const phase = JSON.stringify([instanceKey, sessionId, screen, questionIndex, splash])
  const allowed = useRef(false)
  const synchronize = useRef<() => void>(() => {})
  useLayoutEffect(() => { allowed.current = playing && !splash && !blocked }, [playing, splash, blocked])

  // AUDIO03 metadata reports intent/context; observer lifecycle remains the
  // authority for actual voices, including the new ordered SFX and loop beds.
  useEffect(() => {
    const narrationCue = splash || !narrationEnabled ? null : masterNarration(screen, questionIndex, greeting, answerId)
    setMasterAudioState({ branch, phase: screen, screen, questionIndex: questionIndex ?? -1,
      playing, effectsPlaying, splash, blocked, narrationEnabled, narrationCue,
      effectCue: null, effectMode: 'ordered_sfx',
      reason: splash ? 'brand_splash' : blocked ? 'interaction_blocked' : !playing ? 'presentation_paused'
        : narrationCue ? 'scene_active' : !narrationEnabled ? 'narration_disabled' : 'no_narration_for_screen' })
  }, [branch, screen, questionIndex, answerId, playing, effectsPlaying, splash, blocked, narrationEnabled, greeting])

  useEffect(() => {
    const bank = productionAudio(import.meta.env.BASE_URL)
    let disposed = false
    const tracks: Track[] = []
    let narration: Track | undefined
    const effects: Track[] = []
    const mayPlay = () => !disposed && allowed.current && !document.hidden
    const duck = () => {
      const speaking = narration && ['starting', 'playing', 'blocked'].includes(narration.state)
      for (const effect of effects) {
        if (effect.id === undefined) effect.sound.volume(speaking ? 0.13 : 0.28)
        else effect.sound.volume(speaking ? 0.13 : 0.28, effect.id)
      }
    }
    const attach = (cue: AudioCue, voice = false): Track => {
      const sound = bank.get(cue)!
      const track: Track = {
        sound, state: 'idle',
        start: () => {
          if (!mayPlay() || sound.state() !== 'loaded' || ['starting', 'playing', 'ended'].includes(track.state)) return
          // The greeting starts by itself when the start screen appears. Where the browser still holds sound back,
          // Howler would queue it for the first tap, which may be the one that chooses a product: give it up instead.
          if (cue === 'Screen0' && !soundAllowed()) { track.state = 'ended'; return }
          track.state = 'starting'
          sound.volume(voice ? 0.9 : 0.13)
          track.id = track.id === undefined ? sound.play() : sound.play(track.id)
          duck()
        },
        sync: () => {
          if (mayPlay()) track.start()
          else if (['starting', 'playing'].includes(track.state)) {
            sound.pause(track.id)
            track.state = 'paused'
          }
        },
        dispose: () => {
          sound.off('load', track.start).off('unlock', track.start)
          sound.off('play', onPlay).off('end', onEnd).off('playerror', onError).off('loaderror', onLoadError)
          if (track.id !== undefined) sound.stop(track.id)
          track.state = 'ended'
        },
      }
      const onPlay = () => {
        if (disposed) return
        track.state = 'playing'
        if (!mayPlay()) track.sync()
        duck()
      }
      const onEnd = () => { if (!disposed) { track.state = 'ended'; duck() } }
      const onError = () => { if (!disposed) { track.state = 'blocked'; duck() } }
      const onLoadError = () => {
        if (!disposed) {
          track.state = 'ended'; duck()
          console.warn('[stella-audio] asset unavailable:', cue)
        }
      }
      sound.on('load', track.start)
      if (cue !== 'Screen0') sound.on('unlock', track.start)
      sound.on('play', onPlay).on('end', onEnd).on('playerror', onError).on('loaderror', onLoadError)
      tracks.push(track)
      if (!voice) effects.push(track)
      return track
    }
    const cue = splash || !narrationEnabled ? null : masterNarration(screen, questionIndex, greeting, answerId)
    if (cue) narration = attach(cue, true)
    const sync = () => {
      tracks.forEach(track => track.sync())
      duck()
    }
    synchronize.current = sync
    // StrictMode's probe cleanup runs before this microtask, avoiding an audible probe play.
    queueMicrotask(sync)
    document.addEventListener('visibilitychange', sync)
    window.addEventListener('pointerup', sync)
    window.addEventListener('keydown', sync)
    return () => {
      disposed = true
      synchronize.current = () => {}
      tracks.forEach(track => track.dispose())
      document.removeEventListener('visibilitychange', sync)
      window.removeEventListener('pointerup', sync)
      window.removeEventListener('keydown', sync)
    }
    // Phase identity intentionally excludes server revision/checkpoints.
  }, [phase, screen, questionIndex, answerId, splash, narrationEnabled, greeting])

  useEffect(() => { queueMicrotask(() => synchronize.current()) }, [playing, splash, blocked])

  // SFX persist across phase changes; only real host/visibility/consent pause
  // stops one-shots and pauses the ambience. Polling cannot replay a reveal.
  const soundContext = useRef({ phase, screen, playing: effectsPlaying && !splash && !blocked, hidden: false })
  useLayoutEffect(() => {
    soundContext.current = { phase, screen, playing: effectsPlaying && !splash && !blocked, hidden: document.hidden }
  }, [phase, screen, effectsPlaying, splash, blocked])
  const sfx = useRef<ReturnType<typeof createMasterSound> | null>(null)
  useEffect(() => {
    const player = createMasterSound(productionAudio(import.meta.env.BASE_URL))
    sfx.current = player
    const sync = () => player.setContext({ ...soundContext.current, hidden: document.hidden })
    const accepted = (event: Event) => {
      sync()
      player.acceptedAction((event as CustomEvent<{ manual: boolean }>).detail.manual)
    }
    const unlock = () => player.retryUnlock()
    window.addEventListener(acceptedSoundAction, accepted)
    window.addEventListener('pointerup', unlock)
    document.addEventListener('visibilitychange', sync)
    sync()
    if (hasAcceptedSoundAction()) player.acceptedAction(false)
    return () => {
      window.removeEventListener(acceptedSoundAction, accepted)
      window.removeEventListener('pointerup', unlock)
      document.removeEventListener('visibilitychange', sync)
      player.dispose()
      if (sfx.current === player) sfx.current = null
    }
  }, [])
  useEffect(() => { sfx.current?.setContext({ phase, screen, playing: effectsPlaying && !splash && !blocked, hidden: document.hidden }) }, [phase, screen, effectsPlaying, splash, blocked])
}
