// Claude Design «D1 пульс + нейросеть», принято 05.10.2026: the dot pattern appears, rests, pulses,
// unfolds into a working neural network, returns to the same frame and ends with a wave.
// Geometry and timings are the accepted prototype's (artifacts/DESIGN/claude-design-stela-20261005),
// except its closing half-second hold: the scenario leaves for the final screen as soon as the wave has passed.

/** Authored on the 1080 × 1920 canvas; dots never rise above the logo line. The wave ends at 22.76 s. */
export const DISCOVERY_NETWORK_SECONDS = 22.8
/** The appearance front needs this long to reach the far corners; each dot then grows for one second. */
const APPEAR_SPREAD = 2.8
/** The second spoken phrase starts with the pulse (voice/scripts/time-discovery-line.mjs). */
export const DISCOVERY_PULSE_AT = 6
const PULSE_SECONDS = 5
const NETWORK_AT = 11
const UNFOLD_SECONDS = 2.8
const RETURN_AT = 19.8
const WAVE_AT = 21.5
const WAVE_SECONDS = 1.26
const WAVE_RADIUS = 1250
const CENTER = { x: 555, y: 1150 }
const LINK_DISTANCE = 130
const LINK_BUCKETS = 16

export interface DiscoveryDot {
  x: number
  y: number
  /** Three stable per-dot random numbers. */
  h: number
  h2: number
  h3: number
  /** Resting radius and opacity; opacity 1 marks the dots of the form itself. */
  radius: number
  alpha: number
}

export interface DiscoveryPoint { x: number; y: number; radius: number; alpha: number; h: number }
export interface DiscoveryFrame { points: DiscoveryPoint[]; pulse: number; network: number }

const clamp = (value: number) => value < 0 ? 0 : value > 1 ? 1 : value
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }
const inOut = (v: number) => v < 0.5 ? 4 * v * v * v : 1 - (-2 * v + 2) ** 3 / 2
const back = (v: number) => 1 + 2.70158 * (v - 1) ** 3 + 1.70158 * (v - 1) ** 2

let pattern: DiscoveryDot[] | null = null

/** 19 × 28 grid: a cloud of large white dots, small and large translucent dots around it. */
export function discoveryDots(): DiscoveryDot[] {
  if (pattern) return pattern
  const dots: DiscoveryDot[] = []
  for (let row = 0; row < 28; row++) for (let column = -2; column < 17; column++) {
    const x = 121 + 57.2 * column, y = 362 + 57.2 * row, k = row * 19 + column + 2
    const h = hash(k + 1), h2 = hash(k * 3.7 + 11), h3 = hash(k * 1.3 + 5)
    const dx = x - 555, dy = (y - 1200) * 0.88, angle = Math.atan2(dy, dx)
    const edge = 430 + 45 * Math.sin(3 * angle + 0.7) + 35 * Math.sin(5 * angle - 1.2) + 25 * Math.cos(2 * angle)
    let presence = Math.max(0, Math.min(1, (edge - Math.hypot(dx, dy)) / 140), Math.max(0, 1 - Math.hypot((x - 560) / 160, (y - 400) / 60)) * 0.7)
    if (h < 0.14) presence *= 0.2
    let radius = presence > 0.04 ? 2.5 + 15 * presence * (0.3 + 0.7 * h2) : 0, alpha = 1
    if (!radius) {
      const noise = 0.5 + 0.25 * Math.sin(x * 0.011 + y * 0.004) + 0.25 * Math.cos(y * 0.009 - x * 0.003)
      const large = h2 * (0.6 + 0.8 * noise) > 0.78
      radius = large ? 5.5 + 7 * noise * (0.6 + 0.4 * h) : 1.4 + 3.6 * noise * (0.5 + 0.5 * h)
      alpha = large ? 0.5 + 0.35 * noise : 0.3 + 0.3 * noise
    }
    dots.push({ x, y, h, h2, h3, radius, alpha })
  }
  pattern = dots
  return dots
}

/** Pure scene state at `time` seconds; the painter and the tests share it. */
export function discoveryNetworkFrame(dots: DiscoveryDot[], time: number): DiscoveryFrame {
  const pulseIn = inOut(clamp((time - DISCOVERY_PULSE_AT) / PULSE_SECONDS)), pulseOut = inOut(clamp((time - 20.3) / 1.4))
  const unfold = inOut(clamp((time - NETWORK_AT) / UNFOLD_SECONDS)), fold = inOut(clamp((time - RETURN_AT) / 1.4))
  const pulse = pulseIn * (1 - pulseOut), network = unfold * (1 - fold)
  const wave = clamp((time - WAVE_AT) / WAVE_SECONDS), waveRadius = wave * WAVE_RADIUS
  const sources = [
    [300 + 200 * Math.sin(time * 0.7), 800 + 300 * Math.cos(time * 0.5)],
    [800 + 150 * Math.cos(time * 0.6), 1300 + 250 * Math.sin(time * 0.8)],
    [CENTER.x, CENTER.y],
  ]
  const points = dots.map(dot => {
    const netX = 90 + dot.h2 * 900 + Math.sin(time * 0.7 + dot.h * 20) * 26, netY = 380 + dot.h3 * 1420 + Math.cos(time * 0.6 + dot.h2 * 20) * 26
    const x = dot.x + (netX - dot.x) * network, y = dot.y + (netY - dot.y) * network
    let level = 0
    for (const [sx, sy] of sources) level += Math.sin(Math.hypot(x - sx, y - sy) * 0.022 - time * 4.5)
    level = level / 6 + 0.5
    let radius = dot.radius + (1.5 + 12 * level ** 3 - dot.radius) * pulse
    const fromCenter = Math.hypot(dot.x - CENTER.x, dot.y - CENTER.y)
    let crest = 0
    if (wave > 0 && wave < 1) {
      const gap = Math.abs(fromCenter - waveRadius)
      if (gap < 110) crest = (1 - gap / 110) ** 2 * (1 - wave * 0.4)
    }
    radius += crest * (dot.alpha === 1 ? 6 : 7)
    // The pattern grows from the centre of the form outwards, each dot with a small overshoot.
    const appear = clamp(time - fromCenter / 1300 * APPEAR_SPREAD - dot.h * 0.3)
    if (appear < 1) radius *= back(appear)
    const alpha = Math.min(1, (dot.alpha < 1 ? Math.max(dot.alpha, pulse * (0.4 + 0.5 * level)) : 1) + crest * 0.5) * clamp(appear * 2)
    return { x, y, radius: Math.max(0, radius), alpha, h: dot.h }
  })
  return { points, pulse, network }
}

export function paintDiscoveryNetwork(g: CanvasRenderingContext2D, dots: DiscoveryDot[], time: number) {
  const { points, pulse, network } = discoveryNetworkFrame(dots, time)
  g.clearRect(0, 0, 1080, 1920)
  if (network > 0.02) {
    // Links are grouped by opacity: one stroke per group instead of one per link.
    const groups: number[][] = Array.from({ length: LINK_BUCKETS }, () => [])
    const impulses: number[] = []
    for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
      const a = points[i], b = points[j], dx = a.x - b.x, dy = a.y - b.y, square = dx * dx + dy * dy
      if (square > LINK_DISTANCE * LINK_DISTANCE) continue
      const alpha = network * Math.min(a.alpha, b.alpha) * (1 - Math.sqrt(square) / LINK_DISTANCE) * 0.55
      if (alpha < 0.02) continue
      groups[Math.min(LINK_BUCKETS - 1, Math.floor(alpha / 0.55 * LINK_BUCKETS))].push(a.x, a.y, b.x, b.y)
      if ((i * 7 + j) % 9 === 0) {
        // An impulse travels along every ninth link.
        const along = (time * 1.2 + a.h) % 1
        impulses.push(a.x - dx * along, a.y - dy * along)
      }
    }
    g.lineWidth = 1.4
    groups.forEach((lines, bucket) => {
      if (!lines.length) return
      g.strokeStyle = `rgba(110,170,255,${(bucket + 0.5) / LINK_BUCKETS * 0.55})`
      g.beginPath()
      for (let i = 0; i < lines.length; i += 4) { g.moveTo(lines[i], lines[i + 1]); g.lineTo(lines[i + 2], lines[i + 3]) }
      g.stroke()
    })
    g.fillStyle = `rgba(200,235,255,${network * 0.95})`
    for (let i = 0; i < impulses.length; i += 2) { g.beginPath(); g.arc(impulses[i], impulses[i + 1], 2.6, 0, Math.PI * 2); g.fill() }
  }
  // The pulse tints the white dots towards blue.
  const tint = pulse > 0.01 ? pulse * 0.7 : 0
  const color = `${Math.floor(255 - 125 * tint)},${Math.floor(255 - 65 * tint)},255`
  for (const point of points) {
    if (point.radius <= 0.3 || point.alpha <= 0.02) continue
    g.fillStyle = `rgba(${color},${Math.min(1, point.alpha)})`
    g.beginPath(); g.arc(point.x, point.y, point.radius, 0, Math.PI * 2); g.fill()
  }
}
