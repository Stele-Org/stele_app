// Measures the loudness of recorded lines and brings them to the loudness of a reference line.
// Loudness is the integrated loudness of ITU-R BS.1770-4 (K-weighting, 400 ms blocks, gates at -70 LUFS and -10 LU);
// a mono file is measured as it sounds, on both loudspeakers. Levelling multiplies every sample by one factor;
// where single peaks would then pass the ceiling, the factor dips for a few milliseconds around them (a peak limiter:
// both channels together, the dip is reported). No synthesis, resampling or change of length, and the other chunks
// of the file stay as they are.
// Usage: node voice/scripts/level-lines.mjs measure <file.wav>...
//        node voice/scripts/level-lines.mjs apply <reference.wav> <file.wav>...
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

/** Files within this distance of the reference are left untouched. */
const TOLERANCE_LU = 0.3
/** A levelled file never peaks above this share of full scale. */
const PEAK_CEILING = 0.98
/** Half the width of the two windows of the limiter: the factor starts to dip this long, twice, before a peak. */
const LIMITER_MS = 2

/**
 * The factor for every frame: `factor` everywhere except around the peaks that it would push over the ceiling.
 * A sliding minimum followed by a sliding mean of the same width never exceeds what a peak allows and has no steps.
 */
function envelope({ bytes, format, data }, factor) {
  const frames = data.size / format.block, half = Math.round(format.rate * LIMITER_MS / 1000)
  const allowed = new Float64Array(frames)
  let limited = 0
  for (let frame = 0; frame < frames; frame++) {
    let loudest = 0
    for (let channel = 0; channel < format.channels; channel++) loudest = Math.max(loudest, Math.abs(bytes.readInt16LE(data.at + frame * format.block + channel * 2)) / 32768)
    allowed[frame] = loudest * factor > PEAK_CEILING ? PEAK_CEILING / loudest : factor
    if (allowed[frame] < factor) limited++
  }
  if (!limited) return { gains: null, limited, deepest: 1 }
  const lowest = new Float64Array(frames), gains = new Float64Array(frames)
  for (let frame = 0; frame < frames; frame++) {
    let least = factor
    for (let near = Math.max(0, frame - half); near <= Math.min(frames - 1, frame + half); near++) least = Math.min(least, allowed[near])
    lowest[frame] = least
  }
  let deepest = 1
  for (let frame = 0; frame < frames; frame++) {
    let sum = 0, count = 0
    for (let near = Math.max(0, frame - half); near <= Math.min(frames - 1, frame + half); near++) { sum += lowest[near]; count++ }
    gains[frame] = sum / count
    deepest = Math.min(deepest, gains[frame] / factor)
  }
  return { gains, limited, deepest }
}

function read(path) {
  const bytes = readFileSync(path)
  let format = null, data = null
  for (let at = 12; at < bytes.length - 8;) {
    const id = bytes.toString('latin1', at, at + 4), size = bytes.readUInt32LE(at + 4)
    if (id === 'fmt ') format = { tag: bytes.readUInt16LE(at + 8), channels: bytes.readUInt16LE(at + 10), rate: bytes.readUInt32LE(at + 12), block: bytes.readUInt16LE(at + 20), bits: bytes.readUInt16LE(at + 22) }
    if (id === 'data') data = { at: at + 8, size }
    at += 8 + size + (size % 2)
  }
  if (!format || !data || format.tag !== 1 || format.bits !== 16) throw new Error(`Expected a 16-bit PCM WAV file: ${path}`)
  return { bytes, format, data }
}

/** The two K-weighting filters of BS.1770 for any sampling rate. */
function weighting(rate) {
  const shelf = Math.tan(Math.PI * 1681.974450955533 / rate), gain = 10 ** (3.999843853973347 / 20), bend = gain ** 0.4996667741545416, q = 0.7071752369554196
  const a0 = 1 + shelf / q + shelf * shelf
  const pass = Math.tan(Math.PI * 38.13547087602444 / rate), wide = 0.5003270373238773, p0 = 1 + pass / wide + pass * pass
  return [
    { b: [(gain + bend * shelf / q + shelf * shelf) / a0, 2 * (shelf * shelf - gain) / a0, (gain - bend * shelf / q + shelf * shelf) / a0], a: [2 * (shelf * shelf - 1) / a0, (1 - shelf / q + shelf * shelf) / a0] },
    { b: [1, -2, 1], a: [2 * (pass * pass - 1) / p0, (1 - pass / wide + pass * pass) / p0] },
  ]
}

function measure({ bytes, format, data }) {
  const frames = data.size / format.block, filters = weighting(format.rate)
  const size = Math.round(format.rate * 0.4), step = Math.round(format.rate * 0.1)
  // Squared K-weighted signal summed over the channels, as a running total for the block sums.
  const total = new Float64Array(frames + 1)
  let peak = 0
  for (let channel = 0; channel < format.channels; channel++) {
    const state = filters.map(() => [0, 0, 0, 0])
    for (let frame = 0; frame < frames; frame++) {
      let value = bytes.readInt16LE(data.at + frame * format.block + channel * 2) / 32768
      peak = Math.max(peak, Math.abs(value))
      filters.forEach(({ b, a }, index) => {
        const s = state[index], out = b[0] * value + b[1] * s[0] + b[2] * s[1] - a[0] * s[2] - a[1] * s[3]
        s[1] = s[0]; s[0] = value; s[3] = s[2]; s[2] = out
        value = out
      })
      total[frame + 1] += value * value
    }
  }
  for (let frame = 0; frame < frames; frame++) total[frame + 1] += total[frame]
  // A mono file sounds from both loudspeakers.
  const spread = format.channels === 1 ? 2 : 1
  const blocks = []
  for (let start = 0; start + size <= frames; start += step) blocks.push((total[start + size] - total[start]) / size * spread)
  const loudness = power => -0.691 + 10 * Math.log10(power)
  const mean = list => list.reduce((sum, value) => sum + value, 0) / list.length
  const heard = blocks.filter(power => loudness(power) > -70)
  const gated = heard.filter(power => loudness(power) > loudness(mean(heard)) - 10)
  return { lufs: loudness(mean(gated)), peak, seconds: frames / format.rate, channels: format.channels, rate: format.rate }
}

const [mode, ...paths] = process.argv.slice(2)
const name = path => path.split(/[\\/]/).pop()
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const round = (value, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits

if (mode === 'measure' && paths.length) {
  for (const path of paths) {
    const result = measure(read(path))
    console.log(`${name(path).padEnd(40)} ${result.lufs.toFixed(2).padStart(7)} LUFS  peak ${result.peak.toFixed(3)}  ${result.seconds.toFixed(2).padStart(6)} s  ${result.channels} ch ${result.rate} Hz`)
  }
} else if (mode === 'apply' && paths.length > 1) {
  const target = measure(read(paths[0])).lufs
  const report = { reference: { file: name(paths[0]), lufs: round(target) }, toleranceLu: TOLERANCE_LU, peakCeiling: PEAK_CEILING, files: [] }
  for (const path of paths.slice(1)) {
    const file = read(path), before = measure(file)
    const entry = { file: name(path), before: { lufs: round(before.lufs), peak: round(before.peak, 3), sha256: sha256(file.bytes) } }
    report.files.push(entry)
    if (Math.abs(target - before.lufs) <= TOLERANCE_LU) { entry.change = 'none: within the tolerance'; continue }
    const factor = 10 ** ((target - before.lufs) / 20), { gains, limited, deepest } = envelope(file, factor)
    const frames = file.data.size / file.format.block
    for (let frame = 0; frame < frames; frame++) for (let channel = 0; channel < file.format.channels; channel++) {
      const at = file.data.at + frame * file.format.block + channel * 2
      file.bytes.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(file.bytes.readInt16LE(at) * (gains ? gains[frame] : factor)))), at)
    }
    writeFileSync(path, file.bytes)
    const after = measure(file)
    entry.gainDb = round(20 * Math.log10(factor))
    if (limited) entry.limiter = { framesOverCeiling: limited, secondsOverCeiling: round(limited / file.format.rate, 4), deepestDipDb: round(20 * Math.log10(deepest)) }
    entry.after = { lufs: round(after.lufs), peak: round(after.peak, 3), sha256: sha256(file.bytes) }
  }
  console.log(JSON.stringify(report, null, 1))
} else {
  throw new Error('Usage: level-lines.mjs measure <file.wav>... | apply <reference.wav> <file.wav>...')
}
