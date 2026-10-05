import pendingAudio from '../../../voice/vasilisa/pending-audio.json'
import type { VoiceManifest } from './narration'

const pendingCues = new Set(pendingAudio.cues.map(cue => cue.id))

export function isNarrationAudioPending(cue: string | null): boolean {
  return cue !== null && pendingCues.has(cue)
}

/** The legacy manifest has no text hashes. Pending copy revisions therefore
 * remain silent even if it says ready or the asset filename has been changed.
 * Remove a pending entry only after rendering and verifying its new delivery. */
export function getReadyNarrationAsset(manifest: VoiceManifest | null, cue: string | null): string | undefined {
  if (!manifest?.ready || !cue || isNarrationAudioPending(cue)) return undefined
  return manifest.assets[cue]
}
