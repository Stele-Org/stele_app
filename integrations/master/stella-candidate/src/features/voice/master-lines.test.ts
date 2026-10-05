import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import bank from '../../../public/audio/vk-production-v1/manifest.json'
import publicManifest from '../../../public/voice/vasilisa/manifest.json'
import type { ScreenState } from '../prototype/Prototype'
import { narrationId, type VoiceManifest } from './narration'
import { getReadyNarrationAsset } from './ready-narration-asset'

// The same pairs as masterNarration() in features/audio/production-audio.ts.
const lines: [string, ScreenState][] = [
  ['Screen1', { type: 'vk-onboarding' }],
  ['Screen2', { type: 'vk-question', index: 0, answers: [] }],
  ['Screen3', { type: 'vk-question', index: 1, answers: [] }],
  ['Screen4', { type: 'vk-question', index: 2, answers: [] }],
]
// Discovery speaks the same recording (Screen7) re-timed to its scene: discovery-timing.test.ts.

it.each(lines)('the local scenario speaks the master line %s byte for byte', (file, screen) => {
  const asset = getReadyNarrationAsset(publicManifest as VoiceManifest, narrationId(screen))
  expect(asset).toBeDefined()
  const bytes = readFileSync(new URL(`../../../public/voice/vasilisa/${asset}`, import.meta.url))
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(bank.assets.find(entry => entry.file === `${file}.wav`)!.sha256)
})

it('keeps the photo, camera and final lines silent in both modes until matching recordings exist', () => {
  expect(Object.keys(bank.pending)).toEqual(['Screen5', 'Screen6', 'Screen8'])
  const silent: ScreenState[] = [
    { type: 'vk-digitize', answers: [], rankedThemes: [], discoveryAnswerId: 'hero' },
    { type: 'vk-camera', themes: [] }, { type: 'vk-final', themes: [] },
  ]
  for (const screen of silent) expect(getReadyNarrationAsset(publicManifest as VoiceManifest, narrationId(screen))).toBeUndefined()
})