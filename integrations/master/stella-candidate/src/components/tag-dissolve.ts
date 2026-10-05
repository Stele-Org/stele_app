// Claude Design «D2 код → шарики», принято 05.10.2026: tags leave the answer along light threads,
// stay readable, encode, scatter into Discovery dots and leave past the top-right corner.
// Timings and curves are the accepted prototype's (artifacts/DESIGN/claude-design-stela-20261005),
// except the last second of the dots, which speeds up (user request, 06.10.2026).
import { animate, type AnimationPlaybackControls } from 'motion'
import type { BubbleEntry } from '../vendor/lumicells-scene/bubbles'
import { seeded } from '../vendor/lumicells-scene/flight'
import type { DemoSceneProps } from '../vendor/lumicells-scene/types'

type Point = { x: number; y: number }
/** Screen space of the authored 1080 × 1920 canvas, px. */
export type CardBox = { x: number; y: number; w: number; h: number }
type Phase = 'hidden' | 'entering' | 'idle' | 'leaving'

/** The tag stage is a centered 1080px square, 100px below the screen top. */
const STAGE_SIDE = 1080
const STAGE_TOP = 100
const CANVAS_HEIGHT = 1920

const LEAD = 0.5
const STAGGER = 0.15
const FLIGHT = 1.8
const IDLE = 1.2
const ENCODE_STAGGER = 0.12
const ENCODE = 0.8
const ENCODED_HOLD = 1.0
const FADE = 0.45
const SCATTER_DELAY = 1.0
const SCATTER = 2.0
const GATHER = 1.95
const EXIT = 1.2
/** The cloud of dots speeds up over its last second on screen and ends RUSH_RATE times as fast as authored. */
const RUSH = 1.0
const RUSH_RATE = 3
/** Authored seconds that second swallows on top of its own. */
const RUSH_SAVED = RUSH * (RUSH_RATE - 1) / 2
/** Dots keep leaving after the last tag is gone: delay + scatter + gather + exit, with a short rest; the rush shortens it. */
const TAIL = 6.75
/** The retained answer card retires just before the scene ends. */
const CLOSING_LEAD = 0.8
/** The answer card has faded this long before the last dot leaves (user request, 06.10.2026). */
const CARD_LEAD = 0.75
/** A thread bends off the straight line by this much, px: the authored curve first, flatter ones if curves would cross. */
const BENDS = [140, 90, 45, 0]
/** Straight pieces a thread is checked by, and the room kept around a landed tag, px. */
const THREAD_STEPS = 32
const TAG_MARGIN = 10
const HEAP: Point = { x: 1010, y: 520 }
const HEAP_RADIUS = 145
const REDUCED_SECONDS = 2.4
const REDUCED_FADE = 0.4

const GLYPHS = '0123456789ABCDEF<>/{}#*+='
const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p',
  р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya', ' ': '_',
}

const clamp = (value: number) => value < 0 ? 0 : value > 1 ? 1 : value
const inOut = (v: number) => v < 0.5 ? 2 * v * v : 1 - (-2 * v + 2) ** 2 / 2
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }
const back = (v: number) => 1 + 2.70158 * (v - 1) ** 3 + 1.70158 * (v - 1) ** 2
const bezier = (a: Point, c: Point, b: Point, t: number): Point => {
  const u = 1 - t
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y }
}
const glyph = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)]

/** Scene clock for one batch of tags, seconds from the start of the reveal. */
export function tagDissolveTimeline(count: number) {
  const encodeAt = LEAD + Math.max(0, count - 1) * STAGGER + FLIGHT + IDLE
  const lastDissolve = encodeAt + Math.max(0, count - 1) * ENCODE_STAGGER + ENCODED_HOLD
  const gone = lastDissolve + SCATTER_DELAY + SCATTER + GATHER + EXIT - RUSH_SAVED, rush = gone - RUSH
  return {
    enter: (index: number) => LEAD + index * STAGGER,
    encode: (index: number) => encodeAt + index * ENCODE_STAGGER,
    dissolve: (index: number) => encodeAt + index * ENCODE_STAGGER + ENCODED_HOLD,
    /** The first dot sets off for the heap: 6.95 s for four tags. */
    gather: encodeAt + ENCODED_HOLD + SCATTER,
    /** The cloud starts to speed up: 9.46 s for four tags. */
    rush,
    /** The last dot has left past the corner: 10.46 s for four tags. */
    gone,
    /** The answer card has faded: 9.71 s for four tags. */
    cardGone: gone - CARD_LEAD,
    duration: lastDissolve + TAIL - RUSH_SAVED,
    /** Scene time to the clock of the dots and of the answer card that fades with them: it runs ahead during the rush. */
    cloud: (time: number) => time <= rush ? time : time + (RUSH_RATE - 1) * (time - rush) ** 2 / (2 * RUSH),
  }
}

/** «сериал» → `#serial:3F`: a short transliterated key and a stable two-digit hex suffix. */
export function tagCode(word: string, index: number) {
  const latin = [...word.toLowerCase()].map(char => TRANSLIT[char] ?? char).join('').slice(0, 9)
  return `#${latin}:${Math.floor(hash(index * 3 + word.length) * 255).toString(16).toUpperCase().padStart(2, '0')}`
}

/** A readable word turns into its code through a moving band of random glyphs. */
export function encodeText(word: string, code: string, progress: number) {
  if (progress <= 0) return word
  if (progress >= 1) {
    const settled = Math.floor((0.7 + 0.3 * Math.random()) * code.length)
    return [...code].map((char, i) => i < settled ? char : glyph()).join('')
  }
  const length = Math.round(word.length + (code.length - word.length) * progress)
  let text = ''
  for (let i = 0; i < length; i++) {
    const at = i / length
    text += at < progress - 0.15 ? code[i] ?? '' : at < progress + 0.15 ? glyph() : word[i] ?? glyph()
  }
  return text
}

/** Where the thread leaves the card: towards the tag, just inside the card edge. */
function cardEdge(card: CardBox, target: Point): Point {
  const cx = card.x + card.w / 2, cy = card.y + card.h / 2
  const dx = target.x - cx, dy = target.y - cy
  const k = Math.min(card.w / 2 / Math.abs(dx || 1e-3), card.h / 2 / Math.abs(dy || 1e-3))
  return { x: cx + dx * k * 0.9, y: cy + dy * k * 0.9 }
}

/** The path of a tag from the answer card and the light thread it leaves behind. */
export interface Thread { origin: Point; bend: Point; rest: Point }
/** A landed tag, px. */
export interface TagSize { w: number; h: number }

const turn = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
const meet = (a: Point, b: Point, c: Point, d: Point) => turn(a, b, c) * turn(a, b, d) < 0 && turn(c, d, a) * turn(c, d, b) < 0
const flipped = (mask: number) => { let count = 0; for (let bits = mask; bits; bits >>= 1) count += bits & 1; return count }
const trace = ({ origin, bend, rest }: Thread) => Array.from({ length: THREAD_STEPS + 1 }, (_, i) => bezier(origin, bend, rest, i / THREAD_STEPS))

/** How many pairs of threads cross each other. */
export function threadCrossings(threads: Thread[]) {
  const lines = threads.map(trace)
  let pairs = 0
  for (let a = 0; a < lines.length; a++) for (let b = a + 1; b < lines.length; b++) {
    const one = lines[a], other = lines[b]
    if (one.some((point, i) => i > 0 && other.some((to, j) => j > 0 && meet(one[i - 1], point, other[j - 1], to)))) pairs++
  }
  return pairs
}

/** How many threads run under a landed tag that is not their own; the margin covers the sway of the tag. */
export function threadsUnderTags(threads: Thread[], sizes: TagSize[]) {
  return threads.filter((thread, i) => trace(thread).some(point => threads.some(({ rest }, j) => j !== i
    && Math.abs(point.x - rest.x) < sizes[j].w / 2 + TAG_MARGIN && Math.abs(point.y - rest.y) < sizes[j].h / 2 + TAG_MARGIN))).length
}

/**
 * Threads from the answer card to the landing places of its tags, bent so that no two cross and, where the sizes of
 * the tags are known, none runs under a tag of another thread (user request, 06.10.2026).
 * The authored look, neighbours bending opposite ways by 140px, stays wherever it is clear. Otherwise the fewest threads
 * turn the other way, and the curves flatten only if no set of turns is clear: straight threads cannot cross,
 * each lies on its own ray from the centre of the card.
 */
export function tagThreads(card: CardBox, rests: Point[], sizes?: TagSize[]): Thread[] {
  const base = rests.map(rest => {
    const origin = cardEdge(card, rest)
    const nx = -(rest.y - origin.y), ny = rest.x - origin.x, length = Math.hypot(nx, ny) || 1
    return { origin, rest, middle: { x: (origin.x + rest.x) / 2, y: (origin.y + rest.y) / 2 }, normal: { x: nx / length, y: ny / length } }
  })
  // Every choice of turned threads, the fewest turns first; ten threads are far more than a batch holds.
  const turns = Array.from({ length: 2 ** Math.min(base.length, 10) }, (_, mask) => mask).sort((a, b) => flipped(a) - flipped(b))
  let best: Thread[] = [], least = Infinity
  for (const amount of BENDS) for (const mask of turns) {
    const threads = base.map(({ origin, rest, middle, normal }, index) => {
      const reach = amount * (index % 2 ? 1 : -1) * (mask >> index & 1 ? -1 : 1)
      return { origin, rest, bend: { x: middle.x + normal.x * reach, y: middle.y + normal.y * reach } }
    })
    // A crossing weighs more than any number of threads under tags.
    const clashes = threadCrossings(threads) * (base.length + 1) + (sizes ? threadsUnderTags(threads, sizes) : 0)
    if (!clashes) return threads
    if (clashes < least) { best = threads; least = clashes }
  }
  return best
}

interface Dot {
  from: Point; via: Point; spread: Point; lift: Point
  radius: number; start: number; settled: number; angle: number; distance: number
}

interface Tag {
  entry: BubbleEntry
  label: HTMLElement | null
  word: string
  code: string
  seed: number
  origin: Point
  bend: Point
  rest: Point
  enter: number
  arrive: number
  encode: number
  dissolve: number
  gone: number
  step: 0 | 1 | 2 | 3 | 4
  tick: number
  progress: number
  eased: number
  life: number
  center: Point
  dots: Dot[] | null
}

export interface TagDissolveOptions {
  canvas: HTMLCanvasElement | null
  card: CardBox
  seed: number
  reduced: boolean
  /** The scene is about to end: the caller may retire the retained answer card. */
  onClosing?: () => void
  /** The answer card of the last batch: it fades while its dots fly to the heap and leave past the corner. */
  retiring?: HTMLElement | null
}

/**
 * Same surface and flight events as the LumiCells Choreographer, so AnswerFlight keeps its
 * influence binding, echoes and completion. One Motion clock owns the whole batch and its pause.
 */
export class TagDissolve {
  private phase: Phase = 'hidden'
  private busy = false
  private disposed = false
  private playing = true
  private clock: AnimationPlaybackControls | null = null
  private context: CanvasRenderingContext2D | null = null
  private contextRequested = false
  private tags: Tag[] = []
  private closing = false
  /** `strength` is the card's shadow in the cell field when its fade begins: a card tapped early is still arriving at the start. */
  private retire: { from: number; to: number; strength?: string | null } | null = null
  private cloud = (time: number) => time
  private readonly random: () => number

  constructor(
    private readonly root: HTMLElement,
    private readonly entries: () => BubbleEntry[],
    private readonly hooks: () => DemoSceneProps,
    private readonly options: TagDissolveOptions,
  ) {
    this.random = seeded(options.seed)
  }

  /** The hold argument belongs to the Choreographer contract; this scene has its own authored pause. */
  revealOnce(_holdMs: number, onDone: () => void): Promise<void> {
    if (this.busy || this.disposed || this.phase !== 'hidden') return Promise.resolve()
    this.busy = true
    const entries = [...this.entries()].sort((a, b) => a.item.order - b.item.order)
    const timeline = tagDissolveTimeline(entries.length), reduced = this.options.reduced
    const threads = tagThreads(this.options.card, entries.map(entry => ({ x: entry.item.fx * STAGE_SIDE, y: entry.item.fy * STAGE_SIDE + STAGE_TOP })),
      entries.map(entry => ({ w: entry.el.offsetWidth || 240, h: entry.el.offsetHeight || 80 })))
    this.tags = entries.map((entry, index) => {
      const { origin, bend, rest } = threads[index]
      const word = entry.info().label
      return {
        entry, word, code: tagCode(word, index), seed: index + 2, origin, bend, rest,
        label: entry.el.querySelector<HTMLElement>('.lc-scene-label'),
        enter: reduced ? 0 : timeline.enter(index), arrive: reduced ? REDUCED_FADE : timeline.enter(index) + FLIGHT,
        encode: timeline.encode(index), dissolve: reduced ? REDUCED_SECONDS - REDUCED_FADE : timeline.dissolve(index),
        gone: reduced ? REDUCED_SECONDS : timeline.dissolve(index) + FADE,
        step: 0, tick: -1, progress: 0, eased: 0, life: 1, center: rest, dots: null,
      }
    })
    this.setPhase('entering')
    const duration = reduced ? REDUCED_SECONDS : timeline.duration
    if (!reduced) this.cloud = timeline.cloud
    if (this.options.retiring) this.retire = {
      from: reduced ? REDUCED_SECONDS - REDUCED_FADE : timeline.gather, to: reduced ? REDUCED_SECONDS : timeline.cardGone,
    }
    const tick = (time: number) => { if (reduced) this.reducedFrame(time); else this.frame(time, duration) }
    return new Promise(resolve => {
      this.clock = animate(0, duration, {
        duration, ease: 'linear',
        onUpdate: tick,
        onComplete: () => {
          this.busy = false
          if (!this.disposed) {
            tick(duration)
            this.setPhase('hidden')
            onDone()
          }
          resolve()
        },
      })
      if (!this.playing) this.clock.pause()
    })
  }

  setPlaying(playing: boolean): void {
    if (this.disposed || this.playing === playing) return
    this.playing = playing
    if (playing) this.clock?.play()
    else this.clock?.pause()
  }

  dispose(): void {
    this.disposed = true
    this.clock?.stop()
    this.clock = null
    // An interrupted scene gives the answer card back; a finished one leaves it faded for its exit.
    const card = this.options.retiring
    if (card && this.retire && this.busy) {
      card.style.removeProperty('opacity')
      if (this.retire.strength != null) card.setAttribute('data-lc-strength', this.retire.strength)
    }
    this.context?.clearRect(0, 0, STAGE_SIDE, CANVAS_HEIGHT)
    for (const tag of this.tags) {
      const el = tag.entry.el
      tag.entry.resetHover()
      el.removeAttribute('data-shown')
      el.removeAttribute('data-live')
      el.removeAttribute('data-encoded')
      el.style.removeProperty('transform')
      el.style.removeProperty('opacity')
      el.style.removeProperty('filter')
      this.write(tag, tag.word)
    }
    delete this.root.dataset.phase
  }

  private setPhase(phase: Phase) {
    this.phase = phase
    this.root.dataset.phase = phase
  }

  private write(tag: Tag, text: string) {
    const node = tag.label?.firstChild
    if (node && node.nodeValue !== text) node.nodeValue = text
  }

  private advance(tag: Tag, time: number) {
    const el = tag.entry.el, hooks = this.hooks()
    if (tag.step === 0 && time >= tag.enter) {
      tag.step = 1
      el.setAttribute('data-shown', '')
      hooks.onFlight?.(el, tag.entry.info(), 'start')
    }
    if (tag.step === 1 && time >= tag.arrive) {
      tag.step = 2
      el.setAttribute('data-live', '')
      hooks.onFlight?.(el, tag.entry.info(), 'end')
      if (this.tags.every(other => other.step >= 2)) this.setPhase('idle')
    }
    if (tag.step === 2 && time >= tag.dissolve) {
      tag.step = 3
      if (this.phase !== 'leaving') this.setPhase('leaving')
      el.removeAttribute('data-live')
      hooks.onFlight?.(el, tag.entry.info(), 'start')
    }
    if (tag.step === 3 && time >= tag.gone) {
      tag.step = 4
      el.removeAttribute('data-shown')
      hooks.onFlight?.(el, tag.entry.info(), 'end')
    }
  }

  private frame(time: number, duration: number) {
    if (this.disposed) return
    for (const tag of this.tags) {
      this.advance(tag, time)
      const el = tag.entry.el
      const progress = clamp((time - tag.enter) / FLIGHT), eased = 1 - (1 - progress) ** 4
      const at = bezier(tag.origin, tag.bend, tag.rest, eased)
      const driftX = Math.sin(time * 0.6 + tag.seed * 1.7) * 7, driftY = Math.cos(time * 0.5 + tag.seed * 2.3) * 9
      const dx = at.x - tag.rest.x + driftX * eased, dy = at.y - tag.rest.y + driftY * eased
      const life = time > tag.dissolve ? Math.max(0, 1 - (time - tag.dissolve) / FADE) : 1
      let scale = 0.3 + 0.7 * eased, opacity = Math.min(1, progress * 2.5), blur = (1 - eased) * 9
      if (life < 1) { opacity *= life; blur = Math.max(blur, (1 - life) * 8); scale *= 1 + (1 - life) * 0.08 }
      el.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${scale.toFixed(3)})`
      el.style.opacity = opacity.toFixed(3)
      el.style.filter = blur > 0.2 ? `blur(${blur.toFixed(1)}px)` : 'none'
      // The gradient frame turns at 60° per second, each tag from its own angle.
      el.style.setProperty('--a', ((time * 60 + tag.seed * 47) % 360).toFixed(1))
      const tick = Math.floor(time * 18)
      // A tag that is gone stays invisible: no more text changes, so no layout work behind the dots.
      if (tag.step < 4 && tick !== tag.tick) {
        tag.tick = tick
        const encoding = clamp((time - tag.encode) / ENCODE)
        this.write(tag, encodeText(tag.word, tag.code, encoding))
        el.toggleAttribute('data-encoded', encoding > 0.3)
      }
      tag.progress = progress; tag.eased = eased; tag.life = life
      tag.center = { x: tag.rest.x + dx, y: tag.rest.y + dy }
      if (tag.step >= 3 && !tag.dots) tag.dots = this.scatter(tag)
    }
    this.fadeCard(time)
    if (!this.closing && time >= duration - CLOSING_LEAD) {
      this.closing = true
      this.options.onClosing?.()
    }
    this.paint(this.cloud(time))
  }

  /** The card and its shadow in the cell field thin out together with the dots that carry the answer away,
   * on their clock, and are gone CARD_LEAD before the last dot. */
  private fadeCard(time: number) {
    const card = this.options.retiring, retire = this.retire
    if (!card || !retire || time < retire.from) return
    if (retire.strength === undefined) retire.strength = card.getAttribute('data-lc-strength')
    const clock = this.cloud, from = clock(retire.from)
    const left = 1 - inOut(clamp((clock(time) - from) / (clock(retire.to) - from)))
    card.style.opacity = left.toFixed(3)
    if (retire.strength === null) return
    // LumiCells follows the attribute; twenty steps keep the mutations rare.
    const strength = String(Math.round(Number(retire.strength) * left * 20) / 20)
    if (card.getAttribute('data-lc-strength') !== strength) card.setAttribute('data-lc-strength', strength)
  }

  /** No flight, blur or dots: the tags fade in, stay readable and fade out. */
  private reducedFrame(time: number) {
    if (this.disposed) return
    for (const tag of this.tags) {
      this.advance(tag, time)
      tag.entry.el.style.opacity = Math.min(clamp(time / REDUCED_FADE), clamp((REDUCED_SECONDS - time) / REDUCED_FADE)).toFixed(3)
    }
    this.fadeCard(time)
    if (!this.closing && time >= REDUCED_SECONDS - REDUCED_FADE) {
      this.closing = true
      this.options.onClosing?.()
    }
  }

  /** One dot per ~17px cell of the tag, without the four corners. */
  private scatter(tag: Tag): Dot[] {
    const random = this.random, el = tag.entry.el
    const width = el.offsetWidth || 240, height = el.offsetHeight || 80
    const left = tag.center.x - width / 2, top = tag.center.y - height / 2
    const columns = Math.max(3, Math.round(width / 17)), rows = Math.max(3, Math.round(height / 17))
    const dots: Dot[] = []
    for (let column = 0; column < columns; column++) for (let row = 0; row < rows; row++) {
      if ((column === 0 || column === columns - 1) && (row === 0 || row === rows - 1)) continue
      const size = random()
      const from = { x: left + random() * width, y: top + random() * height }
      const start = tag.dissolve + random() * SCATTER_DELAY
      const spread = { x: from.x + (random() - 0.5) * 300, y: from.y + (random() - 0.5) * 220 }
      dots.push({
        from, spread, start, settled: start + SCATTER, radius: 1.6 + 6 * size * size,
        via: { x: (from.x + spread.x) / 2 + (random() - 0.5) * 320, y: (from.y + spread.y) / 2 + (random() - 0.5) * 320 },
        lift: { x: spread.x * 0.55 + HEAP.x * 0.45 + (random() - 0.5) * 180, y: spread.y * 0.25 + HEAP.y * 0.75 + (random() - 0.5) * 120 },
        angle: random() * Math.PI * 2, distance: Math.sqrt(random()) * HEAP_RADIUS,
      })
    }
    return dots
  }

  /** `time` is the clock of the dots; the threads follow the tags, which are gone before the rush. */
  private paint(time: number) {
    const canvas = this.options.canvas
    if (!canvas) return
    if (!this.context) {
      if (this.contextRequested) return
      this.contextRequested = true
      const context = canvas.getContext('2d')
      if (!context) return
      const ratio = Math.min(2, Math.max(1, canvas.getBoundingClientRect().width / STAGE_SIDE * (window.devicePixelRatio || 1)))
      canvas.width = Math.round(STAGE_SIDE * ratio)
      canvas.height = Math.round(CANVAS_HEIGHT * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      this.context = context
    }
    const g = this.context
    g.clearRect(0, 0, STAGE_SIDE, CANVAS_HEIGHT)
    g.lineCap = 'round'
    for (const tag of this.tags) {
      if (tag.progress <= 0 || tag.life <= 0) continue
      g.globalAlpha = tag.life
      const head = bezier(tag.origin, tag.bend, tag.rest, tag.eased)
      const gradient = g.createLinearGradient(tag.origin.x, tag.origin.y, head.x, head.y)
      gradient.addColorStop(0, 'rgba(80,140,255,0.05)')
      gradient.addColorStop(1, 'rgba(150,215,255,0.95)')
      g.shadowColor = '#3f8cff'; g.shadowBlur = 16; g.strokeStyle = gradient; g.lineWidth = 2.8
      g.beginPath()
      for (let i = 0; i <= 28; i++) {
        const point = bezier(tag.origin, tag.bend, tag.rest, tag.eased * i / 28)
        if (i) g.lineTo(point.x, point.y); else g.moveTo(point.x, point.y)
      }
      g.stroke()
      if (tag.progress < 1) {
        g.fillStyle = 'rgba(225,242,255,.95)'; g.shadowColor = '#7fd8ff'; g.shadowBlur = 26
        g.beginPath(); g.arc(head.x, head.y, 5, 0, Math.PI * 2); g.fill()
      }
      g.shadowBlur = 0
    }
    g.globalAlpha = 1
    for (const tag of this.tags) for (const dot of tag.dots ?? []) {
      if (time < dot.start) continue
      let at: Point, radius = dot.radius, alpha = 1
      if (time < dot.settled) {
        // The scatter does not come to rest: it is still moving when the gather takes over.
        const m = clamp((time - dot.start) / SCATTER)
        at = bezier(dot.from, dot.via, dot.spread, m + 0.5 * m * (1 - m))
        radius *= Math.max(0, back(m)); alpha = Math.min(1, m * 2)
      } else {
        const elapsed = time - dot.settled
        const offset = { x: Math.cos(dot.angle) * dot.distance, y: Math.sin(dot.angle) * dot.distance * 0.92 }
        const heap = { x: HEAP.x + offset.x, y: HEAP.y + offset.y }
        if (elapsed < GATHER) at = bezier(dot.spread, dot.lift, heap, elapsed / GATHER)
        else {
          const v = (elapsed - GATHER) / EXIT
          if (v >= 1) continue
          at = bezier(heap, { x: heap.x + 160, y: heap.y - 120 }, { x: 1350 + offset.x * 1.6, y: -220 + offset.y * 1.6 }, 0.5 * v + 0.5 * v * v)
          alpha = 1 - clamp((v - 0.6) / 0.4)
        }
      }
      if (radius < 0.3 || alpha < 0.02) continue
      g.fillStyle = `rgba(255,255,255,${alpha})`
      g.beginPath(); g.arc(at.x, at.y, radius, 0, Math.PI * 2); g.fill()
    }
  }
}
