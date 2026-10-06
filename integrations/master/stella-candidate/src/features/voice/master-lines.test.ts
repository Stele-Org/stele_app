import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import bank from '../../../public/audio/vk-production-v1/manifest.json'
import publicManifest from '../../../public/voice/vasilisa/manifest.json'
import type { ScreenState } from '../prototype/Prototype'
import { narrationId, type VoiceManifest } from './narration'
import { getReadyNarrationAsset } from './ready-narration-asset'

// The same pairs as masterNarration() in features/audio/production-audio.ts, and the line of the scanning screen,
// which the user added to the bank on 06.10.2026 and which the stand mode does not play yet.
const lines: [string, ScreenState][] = [
  ['Screen0', { type: 'home' }],
  ['Screen1', { type: 'vk-onboarding' }],
  ['Screen2', { type: 'vk-question', index: 0, answers: [] }],
  ['Screen3', { type: 'vk-question', index: 1, answers: [] }],
  ['Screen4', { type: 'vk-question', index: 2, answers: [] }],
  ['Screen5', { type: 'vk-digitize', answers: [], rankedThemes: [], discoveryAnswerId: 'hero' }],
  ['Screen8', { type: 'vk-final', themes: [] }],
  ['Screen_Scan', { type: 'vk-scanning', themes: [] }],
]
// Discovery speaks the same recording (Screen7) re-timed to its scene: discovery-timing.test.ts.

it.each(lines)('the local scenario speaks the master line %s byte for byte', (file, screen) => {
  // With the greeting asked for (?greeting=1): only then does the start screen have a line.
  const asset = getReadyNarrationAsset(publicManifest as VoiceManifest, narrationId(screen, false, true))
  expect(asset).toBeDefined()
  const bytes = readFileSync(new URL(`../../../public/voice/vasilisa/${asset}`, import.meta.url))
  // Against the file in the bank itself, not only its description: a recording replaced in the bank
  // must not leave a stale copy playing in the local scenario.
  expect(bytes.equals(readFileSync(new URL(`../../../public/audio/vk-production-v1/${file}.wav`, import.meta.url)))).toBe(true)
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(bank.assets.find(entry => entry.file === `${file}.wav`)!.sha256)
})

it('names only recordings that exist in the local voice folder', () => {
  for (const [cue, asset] of Object.entries(publicManifest.assets)) {
    expect(existsSync(new URL(`../../../public/voice/vasilisa/${asset}`, import.meta.url)), `${cue} -> ${asset}`).toBe(true)
  }
})

it('keeps the camera line silent in both modes until a matching recording exists', () => {
  expect(Object.keys(bank.pending)).toEqual(['Screen6'])
  const silent: ScreenState[] = [{ type: 'vk-camera', themes: [] }]
  for (const screen of silent) expect(getReadyNarrationAsset(publicManifest as VoiceManifest, narrationId(screen))).toBeUndefined()
})