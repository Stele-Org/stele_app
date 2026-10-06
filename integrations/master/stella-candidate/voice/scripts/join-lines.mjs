// Keeps the beginning of one recorded line and continues it with another whole recording after a pause.
// Samples of both recordings are copied unchanged; only the last few milliseconds of the kept part,
// which must lie in a pause, are faded out so that the cut does not click. No synthesis or resampling.
// Usage: node voice/scripts/join-lines.mjs <first.wav> <keepSeconds> <second.wav> <secondAtSeconds> <target.wav> [fadeMs=40]
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

const [firstPath, keep, secondPath, secondAt, targetPath, fade = '40'] = process.argv.slice(2)
if (!firstPath || !secondPath || !targetPath || !(Number(keep) > 0) || !(Number(secondAt) >= Number(keep))) {
  throw new Error('Usage: join-lines.mjs <first.wav> <keepSeconds> <second.wav> <secondAtSeconds> <target.wav> [fadeMs]')
}

function read(path) {
  const bytes = readFileSync(path)
  let format = null, pcm = null
  for (let at = 12; at < bytes.length - 8;) {
    const id = bytes.toString('latin1', at, at + 4), size = bytes.readUInt32LE(at + 4)
    if (id === 'fmt ') format = { tag: bytes.readUInt16LE(at + 8), channels: bytes.readUInt16LE(at + 10), rate: bytes.readUInt32LE(at + 12), block: bytes.readUInt16LE(at + 20), bits: bytes.readUInt16LE(at + 22) }
    if (id === 'data') pcm = bytes.subarray(at + 8, at + 8 + size)
    at += 8 + size + (size % 2)
  }
  if (!format || !pcm || format.tag !== 1 || format.bits !== 16) throw new Error(`Expected a 16-bit PCM WAV file: ${path}`)
  return { bytes, format, pcm }
}

const first = read(firstPath), second = read(secondPath), format = first.format
if (JSON.stringify(format) !== JSON.stringify(second.format)) throw new Error('The recordings differ in format')

const frames = Math.round(Number(keep) * format.rate), fadeFrames = Math.round(Number(fade) / 1000 * format.rate)
if (frames * format.block > first.pcm.length) throw new Error('The first recording is shorter than the part to keep')
const head = Buffer.from(first.pcm.subarray(0, frames * format.block))
// The cut must fall into a pause: refuse to fade audible speech away.
let loudest = 0
for (let frame = frames - fadeFrames; frame < frames; frame++) for (let channel = 0; channel < format.channels; channel++) {
  const at = frame * format.block + channel * 2, value = head.readInt16LE(at)
  loudest = Math.max(loudest, Math.abs(value))
  head.writeInt16LE(Math.round(value * (frames - 1 - frame) / fadeFrames), at)
}
if (loudest > 32768 * 0.01) throw new Error(`The cut is not in a pause: the faded part peaks at ${(loudest / 32768).toFixed(3)} of full scale`)

const startFrame = Math.round(Number(secondAt) * format.rate)
const body = Buffer.concat([head, Buffer.alloc((startFrame - frames) * format.block), second.pcm])

const header = Buffer.alloc(44)
header.write('RIFF', 0, 'latin1'); header.writeUInt32LE(36 + body.length, 4); header.write('WAVEfmt ', 8, 'latin1')
header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(format.channels, 22)
header.writeUInt32LE(format.rate, 24); header.writeUInt32LE(format.rate * format.block, 28)
header.writeUInt16LE(format.block, 32); header.writeUInt16LE(format.bits, 34)
header.write('data', 36, 'latin1'); header.writeUInt32LE(body.length, 40)
const target = Buffer.concat([header, body])
writeFileSync(targetPath, target)

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const seconds = pcm => Math.round(pcm.length / format.block / format.rate * 1000) / 1000
console.log(JSON.stringify({
  first: { sha256: sha256(first.bytes), bytes: first.bytes.length, seconds: seconds(first.pcm) },
  second: { sha256: sha256(second.bytes), bytes: second.bytes.length, seconds: seconds(second.pcm), pcmSha256: sha256(second.pcm) },
  keptSeconds: frames / format.rate, fadeMs: Number(fade), fadedPeak: Math.round(loudest / 32768 * 10000) / 10000,
  secondAtSeconds: startFrame / format.rate,
  bytes: target.length, sha256: sha256(target), seconds: seconds(body), format: `PCM ${format.bits} bit, ${format.rate} Hz, ${format.channels} channels`,
}, null, 1))
