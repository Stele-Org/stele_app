import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { matchVoiceCommand, type VoiceCommand } from './voice-commands'

/** How long the microphone waits for an answer. After that it goes off and the screen is answered by touch. */
export const LISTEN_MS = 30000
// The browser ends its session after a silence; the pause before the next one keeps a failing start from spinning.
const RESUME_MS = 250
// With these the microphone will not work until the page is opened again: do not ask on every screen.
const refusals = new Set<SpeechRecognitionErrorCode>(['not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported'])

// The part of the browser's recogniser used here; the DOM typings describe its events but not the recogniser itself.
interface Recogniser {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onstart: (() => void) | null
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start(): void
  abort(): void
}
const recognition = () => {
  const scope = window as unknown as { SpeechRecognition?: new () => Recogniser; webkitSpeechRecognition?: new () => Recogniser }
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition
}

interface VoiceCommandOptions {
  /** The voice has asked and the screen is waiting for an answer. */
  active: boolean
  commands: VoiceCommand[]
  /** Presses the named button; false when it cannot be pressed yet, and the microphone keeps listening. */
  onCommand: (target: string) => boolean
  debug?: boolean
}

/**
 * Opens the microphone while `active` and gives the first recognised command to `onCommand`. Speech is recognised by
 * the browser (Web Speech API); where the browser has none, nothing happens and the screen is answered by touch.
 * Nothing that was heard is kept. Returns whether the microphone is on right now.
 */
export function useVoiceCommands({ active, commands, onCommand, debug = false }: VoiceCommandOptions): boolean {
  const [listening, setListening] = useState(false)
  const handler = useRef(onCommand)
  const refused = useRef(false)
  useLayoutEffect(() => { handler.current = onCommand }, [onCommand])

  useEffect(() => {
    const Recognition = recognition()
    if (!active || !commands.length || refused.current || !Recognition) return
    const trace = (...details: unknown[]) => { if (debug) console.debug('[stella-mic]', ...details) }
    let stopped = false
    let resume: number | undefined
    const deadline = window.setTimeout(() => stop('no-answer'), LISTEN_MS)
    let session: Recogniser | null = null
    const stop = (reason: string) => {
      if (stopped) return
      stopped = true
      trace('off', reason)
      window.clearTimeout(resume)
      window.clearTimeout(deadline)
      if (session) { session.onstart = session.onresult = session.onerror = session.onend = null; session.abort() }
      session = null
      setListening(false)
    }
    const listen = () => {
      const current = session = new Recognition()
      current.lang = 'ru-RU'
      current.continuous = true
      current.interimResults = false
      current.maxAlternatives = 3
      current.onstart = () => { trace('on'); setListening(true) }
      current.onresult = event => {
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index]
          if (!result.isFinal) continue
          const heard = Array.from(result, reading => reading.transcript)
          const target = matchVoiceCommand(heard, commands)
          trace('heard', heard, target)
          if (target && handler.current(target)) { stop('answered'); return }
        }
      }
      current.onerror = event => {
        if (event.error === 'no-speech') return
        if (refusals.has(event.error)) refused.current = true
        stop(event.error)
      }
      current.onend = () => {
        setListening(false)
        resume = window.setTimeout(listen, RESUME_MS)
      }
      try { current.start() } catch { stop('start-failed') }
    }
    listen()
    return () => stop('left')
  }, [active, commands, debug])

  return listening
}
