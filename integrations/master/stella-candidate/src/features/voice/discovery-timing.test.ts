import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import bank from '../../../public/audio/vk-production-v1/manifest.json'
import timing from '../../../voice/vasilisa/discovery-timing-provenance.json'
import { DISCOVERY_NETWORK_SECONDS, DISCOVERY_PULSE_AT } from '../../components/discovery-network'

function pcm(asset: string) {
  const bytes = readFileSync(new URL(`../../../public/voice/vasilisa/${asset}`, import.meta.url))
  let rate = 0, block = 0, data = bytes.subarray(0, 0)
  for (let at = 12; at < bytes.length - 8;) {
    const id = bytes.toString('latin1', at, at + 4), size = bytes.readUInt32LE(at + 4)
    if (id === 'fmt ') { rate = bytes.readUInt32LE(at + 12); block = bytes.readUInt16LE(at + 20) }
    if (id === 'data') data = bytes.subarray(at + 8, at + 8 + size)
    at += 8 + size + (size % 2)
  }
  const slice = (from: number, to: number) => data.subarray(Math.round(from * rate) * block, Math.round(to * rate) * block)
  return { bytes, slice, seconds: data.length / block / rate }
}

it('speaks the first Discovery phrase half a second into the appearing dots and the second with the pulse', () => {
  const [first, second] = timing.segments
  expect(first.startSeconds).toBe(0.5)
  // The dots finish appearing at about 3.4 s.
  expect(first.endSeconds).toBeLessThan(3.4)
  expect(second.startSeconds).toBe(DISCOVERY_PULSE_AT)
  // The pulse gives way to the network at 11 s.
  expect(second.endSeconds).toBeLessThan(11)
  expect(timing.durationSeconds).toBeLessThan(DISCOVERY_NETWORK_SECONDS)
})

it('keeps both phrases sample for sample from the master recording and adds nothing but silence', () => {
  const source = pcm(timing.source.asset), timed = pcm(timing.asset)
  // The source is the master line Screen7.
  expect(createHash('sha256').update(source.bytes).digest('hex')).toBe(bank.assets.find(entry => entry.file === 'Screen7.wav')!.sha256)
  expect(timing.source.sha256).toBe(bank.assets.find(entry => entry.file === 'Screen7.wav')!.sha256)
  expect(createHash('sha256').update(timed.bytes).digest('hex')).toBe(timing.sha256)
  expect(timed.seconds).toBeCloseTo(timing.durationSeconds, 3)

  const [first, second] = timing.segments
  for (const segment of [first, second]) {
    const original = source.slice(segment.sourceStartSeconds, segment.sourceEndSeconds)
    expect(original.length).toBeGreaterThan(0)
    expect(timed.slice(segment.startSeconds, segment.endSeconds).equals(original)).toBe(true)
  }
  expect(first.sourceStartSeconds).toBe(0)
  expect(second.sourceEndSeconds).toBeCloseTo(source.seconds, 3)
  // What lies between the phrases in the source is the inserted pause, pure digital silence, like the new gaps.
  const silences = [source.slice(first.sourceEndSeconds, second.sourceStartSeconds), timed.slice(0, first.startSeconds), timed.slice(first.endSeconds, second.startSeconds)]
  for (const silence of silences) {
    expect(silence.length).toBeGreaterThan(0)
    expect(silence.every(byte => byte === 0)).toBe(true)
  }
})
