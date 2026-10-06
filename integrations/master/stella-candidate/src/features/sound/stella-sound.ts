import { Howl } from 'howler'
import type { ScreenState } from '../prototype/Prototype'
import manifest from '../../../public/sound/stella/manifest.json'

export interface SoundContext {
  screen: ScreenState
  playing: boolean
  blocked: boolean
  hidden: boolean
}

/** Sound-design effects remain separate from spoken narration and its timing. */
export function createStellaSound(base: string) {
  const debug = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('sound') === 'debug'
  const log = (event: string, data: Record<string, unknown>) => {
    if (debug) console.debug(`[stella-sfx] ${event} ${JSON.stringify(data)}`)
  }
  const assets = manifest.assets
  const files = [...new Set([
    assets.ambienceMain, assets.ambienceScan, assets.buttonClick,
    ...assets.scanStart, ...assets.scanEnd, ...assets.transitions,
  ])]
  const sounds = new Map(files.map(file => {
    const ambience = file === assets.ambienceMain || file === assets.ambienceScan
    const sound = new Howl({ src: [`${base}${file}`], loop: ambience,
      volume: ambience ? 0.07 : file === assets.buttonClick ? 0.25 : 0.18, preload: true })
    sound.on('play', () => log('play', { asset: file, loop: ambience }))
    sound.on('end', () => log('end', { asset: file }))
    sound.on('playerror', (_id, error) => {
      if (bed?.file === file) bed.paused = true
      log('playerror', { asset: file, error })
    })
    sound.on('unlock', () => synchronize())
    return [file, sound] as const
  }))
  let context: SoundContext | null = null
  let previous: ScreenState | null = null
  let activated = false
  let disposed = false
  let transitionIndex = 0
  let scanIndex = 0
  let currentScan = 0
  let bed: { file: string; id: number; paused: boolean } | null = null
  const shots = new Set<string>()
  const allowed = () => activated && !disposed && !!context?.playing && !context.blocked && !context.hidden

  const stopShots = () => {
    for (const file of shots) sounds.get(file)?.stop()
    shots.clear()
  }
  const shot = (file: string | undefined) => {
    if (!file || !allowed()) return
    const sound = sounds.get(file)!
    sound.stop()
    sound.play()
    shots.add(file)
  }
  const synchronize = () => {
    if (disposed) return
    if (!allowed()) {
      if (bed && !bed.paused) { sounds.get(bed.file)?.pause(bed.id); bed.paused = true }
      stopShots()
      return
    }
    const file = context!.screen.type === 'vk-scanning' ? assets.ambienceScan : assets.ambienceMain
    if (bed?.file !== file) {
      if (bed) sounds.get(bed.file)?.stop(bed.id)
      bed = { file, id: sounds.get(file)!.play(), paused: false }
    } else if (bed.paused) {
      sounds.get(file)!.play(bed.id)
      bed.paused = false
    }
  }

  return {
    setContext(next: SoundContext) {
      if (disposed) return
      context = next
      synchronize()
      if (previous === next.screen) return
      const from = previous
      previous = next.screen
      if (next.screen.type === 'home') { transitionIndex = 0; stopShots() }
      if (['vk-answer-reveal', 'max-answer-reveal', 'vk-photo-reveal'].includes(next.screen.type)) {
        shot(assets.transitions[transitionIndex % assets.transitions.length])
        transitionIndex++
      }
      if (next.screen.type === 'vk-scanning') {
        currentScan = scanIndex++ % assets.scanStart.length
        shot(assets.scanStart[currentScan])
      }
      // The scan ends into the check of its photo, or straight into Discovery when there is no photo.
      if (from?.type === 'vk-scanning' && (next.screen.type === 'vk-particles' || next.screen.type === 'vk-photo-review')) {
        shot(assets.scanEnd[currentScan % assets.scanEnd.length])
      }
    },
    acceptedAction(manual: boolean) {
      if (disposed) return
      activated = true
      synchronize()
      if (manual) shot(assets.buttonClick)
    },
    retryUnlock() { synchronize() },
    dispose() {
      disposed = true
      for (const sound of sounds.values()) { sound.stop(); sound.unload() }
      sounds.clear()
      shots.clear()
      bed = null
    },
  }
}
