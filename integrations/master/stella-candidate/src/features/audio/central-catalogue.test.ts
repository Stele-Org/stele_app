/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { expect, it } from 'vitest'
import catalogue from '../../../public/audio/vk-production-v1/central-catalogue.candidate.json'
import { AUDIO_FILES, masterNarration } from './production-audio'

it('provides every existing and new central cue with matching physical asset, SHA and bus', () => {
  expect(catalogue.status).toBe('candidate_not_deployed')
  expect(catalogue.assets.map(a => a.uiCue)).toEqual([...AUDIO_FILES])
  for (const asset of catalogue.assets) {
    const content = readFileSync(new URL(`../../../public/${asset.path}`, import.meta.url))
    expect(createHash('sha256').update(content).digest('hex')).toBe(asset.sha256)
    expect(content.length).toBe(asset.bytes)
    expect(asset.assetId).toBe(`stella.${asset.uiCue}`)
    expect(asset.bus).toBe(asset.uiCue.startsWith('Screen') ? 'voice' : 'vk')
  }
})

it('keeps pending spoken cues disabled and complete Discovery inside the seven-second animation', () => {
  for (const cue of ['Screen5', 'Screen6']) expect(catalogue.assets.find(a => a.uiCue === cue)?.playbackEnabled).toBe(false)
  for (const screen of ['photochoice','camera']) expect(masterNarration(screen)).toBeNull()
  // The user enabled the final line as recorded; it must end before the final screen leaves after 20 s.
  expect(masterNarration('final')).toBe('Screen8')
  expect(catalogue.assets.find(a => a.uiCue === 'Screen8')).toMatchObject({ playbackEnabled: true, bus: 'voice' })
  expect(catalogue.assets.find(a => a.uiCue === 'Screen8')!.seconds).toBeLessThan(20)
  expect(catalogue.assets.find(a => a.uiCue === 'Screen7')?.seconds).toBe(6.77)
  expect(catalogue.assets.filter(a => a.loop).map(a => a.uiCue)).toEqual(['Scan', 'AmbienceMain'])
})
