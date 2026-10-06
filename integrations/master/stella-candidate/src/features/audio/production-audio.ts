import { Howl, Howler } from 'howler'
import { ensureMasterAudioObserver } from './remote-audio-observer'

export const AUDIO_FILES = ['Screen0', 'Screen1', 'Screen2', 'Screen3', 'Screen4', 'Screen4_Hero', 'Screen5', 'Screen6', 'Screen7', 'Screen8', 'Click', 'ChangeScreen', 'Tags', 'Scan', 'AmbienceMain', 'ChangeScreen2', 'ChangeScreen3', 'ChangeScreen4', 'ChangeScreen5', 'ScanStart1', 'ScanStart2', 'ScanEnd1', 'ScanEnd2'] as const
export type AudioCue = typeof AUDIO_FILES[number]
const banks = new Map<string, Map<AudioCue, Howl>>()

/** Howler owns decoding, caching, gesture unlock, output and playback clocks. */
export function productionAudio(base: string): Map<AudioCue, Howl> {
  let bank = banks.get(base)
  if (!bank) {
    bank = new Map(AUDIO_FILES.map(cue => [cue, new Howl({
      src: [`${base}audio/vk-production-v1/${cue}.wav`], preload: true,
      autoplay: false, loop: cue === 'AmbienceMain' || cue === 'Scan', pool: 1,
    })]))
    banks.set(base, bank)
    // Remember the moment sound becomes allowed, so that a later idle suspension is not taken for a locked browser.
    Howler.ctx?.addEventListener('statechange', soundAllowed)
  }
  ensureMasterAudioObserver(bank)
  return bank
}

let soundHasRun = false
/**
 * Whether sound may begin without a tap. A browser keeps Web Audio suspended until the first gesture on the page;
 * once it has run it stays allowed, also while Howler suspends an idle context to save power.
 */
export function soundAllowed(): boolean {
  if (!Howler.usingWebAudio || Howler.ctx?.state === 'running') soundHasRun = true
  return soundHasRun
}

/**
 * `greeting` is the page's `?greeting=1` (features/voice/greeting.ts): without it the start screen stays silent.
 * `answerId` is the answer whose reveal is on the screen.
 */
export function masterNarration(screen: string, questionIndex?: number, greeting = false, answerId?: string): AudioCue | null {
  switch (screen) {
    // The start screen greets the visitor (recording added by the user on 06.10.2026): once each time it appears.
    case 'home': return greeting ? 'Screen0' : null
    case 'onboarding': return 'Screen1'
    case 'question': return (['Screen2', 'Screen3', 'Screen4'] as const)[questionIndex ?? -1] ?? null
    // The third question continues only for the visitor who chose to become the hero (user, 06.10.2026).
    case 'answer-reveal': return questionIndex === 2 && answerId === 'hero' ? 'Screen4_Hero' : null
    // Enabled by the user on 06.10.2026 as recorded, although the bank marked it as not matching the changed photo copy.
    case 'photochoice': return 'Screen5'
    // The approved camera script awaits a matching recording. Its legacy file
    // stays in the source bank but must never substitute new copy.
    case 'camera': return null
    // Enabled by the user on 05.10.2026 as recorded, although it differs from the approved final copy.
    case 'final': return 'Screen8'
    case 'particles': return 'Screen7'
    default: return null
  }
}

export function masterEffect(screen: string): AudioCue | null {
  // SFX sequencing and scan beds are owned by createMasterSound, not narration.
  void screen
  return null
}
