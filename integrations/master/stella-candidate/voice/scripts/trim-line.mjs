// Cuts the end off a recorded line. The kept samples are copied unchanged; only the last few milliseconds,
// which must lie in a pause, are faded out so that the cut does not click. No synthesis or resampling.
// Usage: node voice/scripts/trim-line.mjs <source.wav> <target.wav> <keepSeconds> [fadeMs=40]
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

const [sourcePath, targetPath, keep, fade = '40'] = process.argv.slice(2)
if (!sourcePath || !targetPath || !(Number(keep) > 0)) throw new Error('Usage: trim-line.mjs <source.wav> <target.wav> <keepSeconds> [fadeMs]')

const source = readFileSync(sourcePath)
let format = null, pcm = null
for (let at = 12; at < source.length - 8;) {
  const id = source.toString('latin1', at, at + 4), size = source.readUInt32LE(at + 4)
  if (id === 'fmt ') format = { tag: source.readUInt16LE(at + 8), channels: source.readUInt16LE(at + 10), rate: source.readUInt32LE(at + 12), block: source.readUInt16LE(at + 20), bits: source.readUInt16LE(at + 22) }
  if (id === 'data') pcm = source.subarray(at + 8, at + 8 + size)
  at += 8 + size + (size % 2)
}
if (!format || !pcm || format.tag !== 1 || format.bits !== 16) throw new Error('Expected a 16-bit PCM WAV file')

const frames = Math.round(Number(keep) * format.rate), fadeFrames = Math.round(Number(fade) / 1000 * format.rate)
if (frames * format.block > pcm.length) throw new Error('The recording is shorter than the part to keep')
const body = Buffer.from(pcm.subarray(0, frames * format.block))
// The cut must fall into a pause: refuse to fade audible speech away.
let loudest = 0
for (let frame = frames - fadeFrames; frame < frames; frame++) for (let channel = 0; channel < format.channels; channel++) {
  const at = frame * format.block + channel * 2, value = body.readInt16LE(at)
  loudest = Math.max(loudest, Math.abs(value))
  body.writeInt16LE(Math.round(value * (frames - 1 - frame) / fadeFrames), at)
}
if (loudest > 32768 * 0.01) throw new Error(`The cut is not in a pause: the faded part peaks at ${(loudest / 32768).toFixed(3)} of full scale`)

const header = Buffer.alloc(44)
header.write('RIFF', 0, 'latin1'); header.writeUInt32LE(36 + body.length, 4); header.write('WAVEfmt ', 8, 'latin1')
header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(format.channels, 22)
header.writeUInt32LE(format.rate, 24); header.writeUInt32LE(format.rate * format.block, 28)
header.writeUInt16LE(format.block, 32); header.writeUInt16LE(format.bits, 34)
header.write('data', 36, 'latin1'); header.writeUInt32LE(body.length, 40)
const target = Buffer.concat([header, body])
writeFileSync(targetPath, target)

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
console.log(JSON.stringify({
  sourceSha256: sha256(source), sourceSeconds: Math.round(pcm.length / format.block / format.rate * 100) / 100,
  keptSeconds: frames / format.rate, fadeMs: Number(fade), fadedPeak: Math.round(loudest / 32768 * 10000) / 10000,
  bytes: target.length, sha256: sha256(target), format: `PCM ${format.bits} bit, ${format.rate} Hz, ${format.channels} channels`,
}, null, 1))
