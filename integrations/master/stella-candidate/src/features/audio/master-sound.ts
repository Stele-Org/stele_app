import type { Howl } from 'howler'
import type { AudioCue } from './production-audio'

export interface MasterSoundContext {
  phase: string
  screen: string
  playing: boolean
  hidden: boolean
}
const transitions: AudioCue[] = ['ChangeScreen', 'ChangeScreen2', 'ChangeScreen3', 'ChangeScreen4', 'ChangeScreen5']
const starts: AudioCue[] = ['ScanStart1', 'ScanStart2']
const ends: AudioCue[] = ['ScanEnd1', 'ScanEnd2']

/** Reuse AUDIO-02 Howls, so every effect and loop keeps the same central
 * observer, authored gain and real playback clock as spoken narration. */
export function createMasterSound(bank: Map<AudioCue, Howl>) {
  let context: MasterSoundContext | null = null
  let previous: MasterSoundContext | null = null
  let activated = false, disposed = false, transition = 0, scan = 0, pair = 0
  let bed: { cue: AudioCue; id: number; paused: boolean } | null = null
  const shots = new Map<AudioCue, number>()
  const allowed = () => activated && !disposed && !!context?.playing && !context.hidden
  const stopShots = () => {
    for (const [cue, id] of shots) bank.get(cue)?.stop(id)
    shots.clear()
  }
  const shot = (cue: AudioCue) => {
    if (!allowed() || bank.get(cue)?.state() !== 'loaded') return
    const sound = bank.get(cue)!
    const old = shots.get(cue)
    if (old !== undefined) sound.stop(old)
    sound.volume(cue === 'Click' ? 0.25 : 0.18)
    shots.set(cue, sound.play())
  }
  const sync = () => {
    if (disposed) return
    if (!allowed()) {
      if (bed && !bed.paused) { bank.get(bed.cue)?.pause(bed.id); bed.paused = true }
      stopShots()
      return
    }
    const cue: AudioCue = context!.screen === 'scanning' ? 'Scan' : 'AmbienceMain'
    const sound = bank.get(cue)!
    if (sound.state() !== 'loaded') return
    if (bed?.cue !== cue) {
      if (bed) bank.get(bed.cue)?.stop(bed.id)
      sound.volume(0.07)
      bed = { cue, id: sound.play(), paused: false }
    } else if (bed.paused) {
      sound.play(bed.id); bed.paused = false
    }
  }
  const retry = () => sync()
  for (const sound of bank.values()) sound.on('load', retry).on('unlock', retry)
  const failures: Array<[Howl, () => void]> = []
  for (const [cue, sound] of bank) {
    const failed = () => { if (bed?.cue === cue) bed.paused = true }
    sound.on('playerror', failed)
    failures.push([sound, failed])
  }
  return {
    setContext(next: MasterSoundContext) {
      if (disposed) return
      context = next; sync()
      if (previous?.phase === next.phase) return
      const from = previous; previous = next
      if (next.screen === 'home') { transition = 0; stopShots() }
      if (['answer-reveal', 'photo-reveal'].includes(next.screen)) {
        shot(transitions[transition++ % transitions.length])
      }
      if (next.screen === 'scanning') { pair = scan++ % starts.length; shot(starts[pair]) }
      if (from?.screen === 'scanning' && next.screen === 'particles') shot(ends[pair])
    },
    acceptedAction(manual: boolean) {
      if (disposed) return
      activated = true; sync()
      if (manual) shot('Click')
    },
    retryUnlock: retry,
    dispose() {
      disposed = true; stopShots()
      if (bed) bank.get(bed.cue)?.stop(bed.id)
      for (const sound of bank.values()) sound.off('load', retry).off('unlock', retry)
      for (const [sound, failed] of failures) sound.off('playerror', failed)
      bed = null
    },
  }
}
