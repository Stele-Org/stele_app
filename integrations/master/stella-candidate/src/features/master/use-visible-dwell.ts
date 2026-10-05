import { useEffect, useRef } from 'react'

/** Counts visible, unpaused presentation time without closing/releasing a server session. */
export function useVisibleDwell(id: string | null, duration: number, playing: boolean, onComplete: () => void) {
  const progress = useRef<{ id: string; remaining: number; done: boolean } | null>(null)
  const callback = useRef(onComplete)
  useEffect(() => { callback.current = onComplete }, [onComplete])
  useEffect(() => {
    if (!id) { progress.current = null; return }
    if (progress.current?.id !== id) progress.current = { id, remaining: duration, done: false }
    const current = progress.current
    let timer: ReturnType<typeof setTimeout> | undefined
    let started: number | null = null
    const stop = () => {
      if (timer !== undefined) clearTimeout(timer)
      timer = undefined
      if (started !== null) current.remaining = Math.max(0, current.remaining - (performance.now() - started))
      started = null
    }
    const sync = () => {
      stop()
      if (!playing || document.hidden || current.done) return
      started = performance.now()
      timer = setTimeout(() => {
        current.done = true
        current.remaining = 0
        started = null
        callback.current()
      }, current.remaining)
    }
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => { stop(); document.removeEventListener('visibilitychange', sync) }
  }, [id, duration, playing])
}
