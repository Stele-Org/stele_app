import { Howl } from 'howler'
import { ensureMasterAudioObserver } from './remote-audio-observer'

export const AUDIO_FILES = ['Screen1', 'Screen2', 'Screen3', 'Screen4', 'Screen5', 'Screen6', 'Screen7', 'Screen8', 'Click', 'ChangeScreen', 'Tags', 'Scan', 'AmbienceMain', 'ChangeScreen2', 'ChangeScreen3', 'ChangeScreen4', 'ChangeScreen5', 'ScanStart1', 'ScanStart2', 'ScanEnd1', 'ScanEnd2'] as const
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
  }
  ensureMasterAudioObserver(bank)
  return bank
}

export function masterNarration(screen: string, questionIndex?: number): AudioCue | null {
  switch (screen) {
    case 'onboarding': return 'Screen1'
    case 'question': return (['Screen2', 'Screen3', 'Screen4'] as const)[questionIndex ?? -1] ?? null
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
