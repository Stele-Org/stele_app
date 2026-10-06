import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Howl } from 'howler'
import type { ScreenState } from '../prototype/Prototype'
import { narrationId, parseVoiceManifest, type VoiceManifest } from './narration'
import { getReadyNarrationAsset } from './ready-narration-asset'
import { isProductChoice, readGreeting } from './greeting'

interface NarrationOptions {
  screen: ScreenState
  playing: boolean
  brandSplash: boolean
}

interface ActiveNarration {
  sound: Howl
  id?: number
  phase: 'idle' | 'starting' | 'playing' | 'paused' | 'blocked' | 'ended'
  /** The greeting of the start screen: it starts by itself and is never started by choosing a product. */
  greeting: boolean
  attempt: () => void
}

/** The voice follows the scenario pause and the visibility of the page, nothing else: opening the consent text
 * leaves it speaking (user, 06.10.2026). */
export function useScreenNarration({ screen, playing, brandSplash }: NarrationOptions) {
  const [greeting] = useState(() => readGreeting(window.location.search))
  const cue = narrationId(screen, brandSplash, greeting)
  const [manifest, setManifest] = useState<VoiceManifest | null>(null)
  const active = useRef<ActiveNarration | null>(null)
  const current = useRef({ cue, allowed: playing })
  const base = `${import.meta.env.BASE_URL}voice/vasilisa/`
  const asset = getReadyNarrationAsset(manifest, cue)

  useLayoutEffect(() => {
    current.current = { cue, allowed: playing }
  }, [cue, playing])

  useEffect(() => {
    const abort = new AbortController()
    let disposed = false
    void fetch(`${base}manifest.json`, { signal: abort.signal, cache: 'no-cache' })
      .then(response => response.ok ? response.json() : null)
      .then(value => { if (!disposed) setManifest(parseVoiceManifest(value)) })
      .catch(() => { /* A missing/unready voice is silent; UI keeps working. */ })
    return () => { disposed = true; abort.abort() }
  }, [base])

  useEffect(() => {
    if (!asset || !cue) return
    let disposed = false
    const debug = new URLSearchParams(window.location.search).get('voice') === 'debug'
    const trace = (event: 'play' | 'pause' | 'stop' | 'end' | 'playerror' | 'loaderror') => {
      if (debug) console.debug('[stella-voice]', cue, event)
    }
    const allowed = () => !disposed && current.current.cue === cue && current.current.allowed && !document.hidden
    const narration: ActiveNarration = {
      sound: new Howl({ src: [`${base}${asset}`], html5: true, preload: true, autoplay: false, loop: false }),
      phase: 'idle',
      greeting: cue === 'home',
      attempt: () => {
        if (!allowed() || narration.sound.state() !== 'loaded'
          || narration.phase === 'ended' || narration.phase === 'starting' || narration.phase === 'playing') return
        narration.phase = 'starting'
        narration.id = narration.id === undefined ? narration.sound.play() : narration.sound.play(narration.id)
      },
    }
    active.current = narration
    narration.sound.on('load', narration.attempt)
    // Howler reports the unlock on the very tap that may be choosing a product: the greeting does not listen to it.
    if (!narration.greeting) narration.sound.on('unlock', narration.attempt)
    narration.sound.on('play', () => {
      if (disposed) return
      trace('play')
      if (!allowed()) { narration.sound.pause(narration.id); narration.phase = 'paused' }
      else narration.phase = 'playing'
    })
    narration.sound.on('pause', () => { if (!disposed) trace('pause') })
    narration.sound.on('playerror', () => { if (!disposed) { narration.phase = 'blocked'; trace('playerror') } })
    narration.sound.on('loaderror', () => { if (!disposed) { narration.phase = 'ended'; trace('loaderror') } })
    narration.sound.on('end', () => { if (!disposed) { narration.phase = 'ended'; trace('end') } })
    narration.attempt()
    return () => {
      disposed = true
      if (active.current === narration) active.current = null
      narration.sound.off()
      narration.sound.stop()
      trace('stop')
      narration.sound.unload()
    }
  }, [asset, base, cue])

  useEffect(() => {
    const synchronize = (event?: Event) => {
      const narration = active.current
      if (!narration) return
      if (!current.current.allowed || document.hidden) {
        if (narration.phase === 'playing' || narration.phase === 'starting') {
          narration.sound.pause(narration.id)
          narration.phase = 'paused'
        }
        return
      }
      // A greeting the browser held back at the appearance of the start screen may begin with the first tap
      // elsewhere on the page, but a tap on a product logo gives it up: the visitor is already leaving.
      if (narration.greeting && event && (narration.phase === 'idle' || narration.phase === 'blocked') && isProductChoice(event.target)) {
        narration.phase = 'ended'
        return
      }
      narration.attempt()
    }
    synchronize()
    document.addEventListener('visibilitychange', synchronize)
    // Howler owns unlocking. These retries always consult the current screen.
    window.addEventListener('pointerup', synchronize)
    window.addEventListener('keydown', synchronize)
    return () => {
      document.removeEventListener('visibilitychange', synchronize)
      window.removeEventListener('pointerup', synchronize)
      window.removeEventListener('keydown', synchronize)
    }
  }, [playing])
}
