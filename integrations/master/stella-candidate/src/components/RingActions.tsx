import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { RingCue } from '../features/prototype/ring-cue'
import { RingActionContext } from './ring-action-context'
import { emitAcceptedSoundAction } from '../features/sound/sfx-events'

export function RingActions({ playing, children, phaseKey }: { playing: boolean; children: ReactNode; phaseKey?: object }) {
  const cue = useRef<RingCue | null>(null)
  const [selection, setSelection] = useState<{ phase: object | undefined; id: string } | null>(null)
  const busy = selection !== null && selection.phase === phaseKey
  const active = busy ? selection.id : null
  useLayoutEffect(() => {
    const gate = new RingCue()
    cue.current = gate
    return () => { gate.dispose(); cue.current = null }
  }, [phaseKey])
  useLayoutEffect(() => { cue.current?.setPlaying(playing) }, [playing, phaseKey])
  const run = (action: () => void, navigation: boolean, id: string) => {
    const gate = cue.current
    if (!gate || !playing) return false
    const accepted = navigation ? gate.navigate(action) : gate.choose(action, window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    if (accepted && !navigation) setSelection({ phase: phaseKey, id })
    if (accepted) emitAcceptedSoundAction(true)
    return accepted
  }
  return <RingActionContext.Provider value={{ busy, enabled: playing, active, run }}>{children}</RingActionContext.Provider>
}
