// Re-times the studio Discovery line to the «пульс + нейросеть» scene. The recording itself is not touched:
// both phrases are copied sample for sample, only the silence before and between them changes.
// Run from anywhere: node voice/scripts/time-discovery-line.mjs
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

/** Scene time at which each phrase starts (src/components/discovery-network.ts). */
const FIRST_AT_MS = 500 // dots are appearing, 0–3.4 s
const SECOND_AT_MS = 6000 // the pulse begins, 6.0–11.0 s

const root = new URL('../../', import.meta.url)
const sourceName = 'vk-discovery-activation-studio.wav'
const targetName = 'vk-discovery-timed-studio.wav'
const source = readFileSync(new URL(`public/voice/vasilisa/${sourceName}`, root))
const phrases = JSON.parse(readFileSync(new URL('voice/vasilisa/phrases.json', root), 'utf8'))
const spoken = phrases.phrases.find(phrase => phrase.id === 'vk-discovery-activation').delivery.segments

let format = null, pcm = null
for (let at = 12; at < source.length - 8;) {
  const id = source.toString('latin1', at, at + 4), size = source.readUInt32LE(at + 4)
  if (id === 'fmt ') format = { tag: source.readUInt16LE(at + 8), channels: source.readUInt16LE(at + 10), rate: source.readUInt32LE(at + 12), block: source.readUInt16LE(at + 20), bits: source.readUInt16LE(at + 22) }
  if (id === 'data') pcm = source.subarray(at + 8, at + 8 + size)
  at += 8 + size + (size % 2)
}
if (!format || !pcm || format.tag !== 1) throw new Error('Expected a PCM WAV file')
const frames = pcm.length / format.block

// The pause inserted between the two supplied recordings is the only long run of digital silence.
let gap = [0, 0], from = -1
for (let frame = 0; frame <= frames; frame++) {
  const silent = frame < frames && pcm.subarray(frame * format.block, (frame + 1) * format.block).every(byte => byte === 0)
  if (silent) { if (from < 0) from = frame; continue }
  if (from >= 0 && frame < frames && from > 0 && frame - from > gap[1] - gap[0]) gap = [from, frame]
  from = -1
}
if (gap[1] - gap[0] < format.rate * 0.3) throw new Error('The pause between the phrases was not found')

const first = pcm.subarray(0, gap[0] * format.block), second = pcm.subarray(gap[1] * format.block)
const firstAt = Math.round(format.rate * FIRST_AT_MS / 1000), secondAt = Math.round(format.rate * SECOND_AT_MS / 1000)
if (firstAt + gap[0] >= secondAt) throw new Error('The first phrase would overlap the second')

const body = Buffer.alloc(secondAt * format.block + second.length)
first.copy(body, firstAt * format.block)
second.copy(body, secondAt * format.block)
const header = Buffer.alloc(44)
header.write('RIFF', 0, 'latin1'); header.writeUInt32LE(36 + body.length, 4); header.write('WAVEfmt ', 8, 'latin1')
header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(format.channels, 22)
header.writeUInt32LE(format.rate, 24); header.writeUInt32LE(format.rate * format.block, 28)
header.writeUInt16LE(format.block, 32); header.writeUInt16LE(format.bits, 34)
header.write('data', 36, 'latin1'); header.writeUInt32LE(body.length, 40)
const target = Buffer.concat([header, body])
writeFileSync(new URL(`public/voice/vasilisa/${targetName}`, root), target)

const seconds = frame => Math.round(frame / format.rate * 1000) / 1000
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const provenance = {
  asset: targetName,
  cues: ['vk-particles', 'vk-discovery-activation'],
  changeDate: '2026-10-05',
  change: 'User asked to synchronise the Discovery lines with the scene: the first phrase while the dots appear, with a 0.5 s delay; the second from 6.0 s, with the pulse.',
  source: { asset: sourceName, sha256: sha256(source) },
  edit: 'Both phrases are copied sample for sample from the source; only the silence before and between them is new. No synthesis, resampling, trimming or voice modification.',
  segments: [
    { text: spoken[0], sourceStartSeconds: 0, sourceEndSeconds: seconds(gap[0]), startSeconds: seconds(firstAt), endSeconds: seconds(firstAt + gap[0]) },
    { text: spoken[1], sourceStartSeconds: seconds(gap[1]), sourceEndSeconds: seconds(frames), startSeconds: seconds(secondAt), endSeconds: seconds(secondAt + frames - gap[1]) },
  ],
  leadSilenceMs: FIRST_AT_MS,
  pauseBetweenSegmentsMs: Math.round((secondAt - firstAt - gap[0]) / format.rate * 1000),
  durationSeconds: seconds(body.length / format.block),
  format: `PCM ${format.bits} bit, ${format.rate} Hz, ${format.channels} channels`,
  bytes: target.length,
  sha256: sha256(target),
  verification: 'PCM equality of both phrases with the source and digital silence elsewhere (src/features/voice/discovery-timing.test.ts). The agent did not listen to the recording; which phrase is which follows studio-activation-provenance.json.',
}
writeFileSync(new URL('voice/vasilisa/discovery-timing-provenance.json', root), `${JSON.stringify(provenance, null, 2)}\n`)
console.log(JSON.stringify(provenance, null, 2))
