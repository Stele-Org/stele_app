import type { FlightRoute } from '../vendor/lumicells-scene/choreography'
import { seeded, streamFlightFrames } from '../vendor/lumicells-scene/flight'

type Point = { fx: number; fy: number }
type CardBox = { left: number; top: number; width: number; height: number }
const cq = (fraction: number) => `${fraction * 100}cqmin`
const codes = ['0101', '0x7F', '1010', '{01}', '0011', '0xA8', '[10]', '1100']

/** Decoration only. Choreographer still owns timing and the one scenario completion. */
export class AnswerStream {
  readonly route: FlightRoute
  private readonly layer: HTMLDivElement
  private readonly animations = new Set<Animation>()
  private readonly nodes = new Set<Element>()
  private readonly box: { x: number; y: number; w: number; h: number }
  private dissolved = false
  private playing = true
  private disposed = false

  constructor(
    stage: HTMLElement,
    private readonly answer: HTMLElement | null,
    fallback: CardBox | undefined,
    private readonly color: string,
    private readonly reduced: boolean,
    private readonly seed: number,
  ) {
    const bounds = stage.getBoundingClientRect(), card = answer?.getBoundingClientRect()
    this.box = card && bounds.width > 0 && card.width > 0
      ? { x: (card.left - bounds.left) / bounds.width, y: (card.top - bounds.top) / bounds.width,
          w: card.width / bounds.width, h: card.height / bounds.width }
      : fallback ? { x: fallback.left / 1080, y: (fallback.top - 100) / 1080, w: fallback.width / 1080, h: fallback.height / 1080 }
      : { x: .46, y: .46, w: .08, h: .08 }
    this.route = { origin: { fx: this.box.x + this.box.w / 2, fy: this.box.y + this.box.h / 2 }, destination: { fx: .94, fy: 1.16 } }
    this.layer = document.createElement('div')
    this.layer.className = 'answer-stream'
    this.layer.setAttribute('aria-hidden', 'true')
    this.layer.style.color = color
    stage.prepend(this.layer)
  }

  private animate(element: Element, frames: Keyframe[], duration: number, delay = 0, retain = false) {
    if (this.disposed || typeof element.animate !== 'function') return
    const animation = element.animate(frames, { duration, delay, fill: 'both', easing: 'linear' })
    this.animations.add(animation)
    if (!this.playing) animation.pause()
    void animation.finished.then(() => {
      if (retain || this.disposed) return
      this.animations.delete(animation)
      animation.cancel()
      if (this.nodes.delete(element)) element.remove()
    }, () => {})
  }

  private addNode<T extends Element>(node: T): T {
    this.nodes.add(node)
    this.layer.append(node)
    return node
  }

  private glyph(origin: Point, destination: Point, code: string, duration: number, delay = 0) {
    const node = this.addNode(document.createElement('span'))
    node.className = 'answer-stream__glyph'
    node.textContent = code
    node.style.left = cq(destination.fx)
    node.style.top = cq(destination.fy)
    const travel = streamFlightFrames({ dx: origin.fx - destination.fx, dy: origin.fy - destination.fy }, true)
    const frames = travel.map((frame, i) => ({ ...frame, opacity: i === 0 || i === travel.length - 1 ? 0 : i < 4 ? .85 : .85 * (1 - i / travel.length) }))
    this.animate(node, frames, duration, delay)
  }

  /** Disassemble the exact supplied artwork once, including when metadata spans several batches. */
  private dissolve(duration: number) {
    if (this.dissolved || this.reduced) return
    this.dissolved = true
    if (!this.answer || typeof this.answer.animate !== 'function') return
    const image = this.answer.querySelector<HTMLImageElement>('.reference-card-artwork')
    const random = seeded(this.seed)
    const columns = 6, rows = 4
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
      const x = column * this.box.w / columns, y = row * this.box.h / rows
      const tile = this.addNode(document.createElement('div'))
      tile.className = 'answer-stream__fragment'
      Object.assign(tile.style, { left: cq(this.box.x + x), top: cq(this.box.y + y), width: cq(this.box.w / columns), height: cq(this.box.h / rows) })
      if (image) {
        const fragmentImage = document.createElement('img')
        fragmentImage.src = image.currentSrc || image.src
        fragmentImage.alt = ''
        fragmentImage.draggable = false
        Object.assign(fragmentImage.style, { left: cq(-x), top: cq(-y), width: cq(this.box.w), height: cq(this.box.h) })
        tile.append(fragmentImage)
      } else {
        // Live camera is never captured/cloned for decoration; cells reveal its existing video underneath.
        tile.classList.add('answer-stream__fragment--light')
      }
      const dx = .04 + random() * .15, dy = -.07 - random() * .12
      const delay = (rows - 1 - row) * 35 + column * 12
      this.animate(tile, [
        { transform: 'translate(0, 0) scale(1)', opacity: image ? 1 : .35 },
        { transform: `translate(${cq(dx * .3)}, ${cq(dy * .3)}) scale(.8)`, opacity: .8, offset: .35 },
        { transform: `translate(${cq(dx)}, ${cq(dy)}) scale(.08)`, opacity: 0 },
      ], duration * .7, delay)
      this.glyph({ fx: this.box.x + x + this.box.w / columns / 2, fy: this.box.y + y + this.box.h / rows / 2 },
        { fx: this.route.origin.fx + dx * 2, fy: this.route.origin.fy + dy * 2 }, codes[(row * columns + column) % codes.length],
        duration * .82, delay)
    }
    // Retain the fade across batches. Camera DOM and application-owned tracks remain attached.
    this.animate(this.answer, [{ opacity: 1 }, { opacity: 0 }], 180, 0, true)
  }

  private filament(origin: Point, destination: Point, duration: number) {
    if (this.reduced) return
    const svg = this.addNode(document.createElementNS('http://www.w3.org/2000/svg', 'svg'))
    svg.setAttribute('viewBox', '0 0 1080 1080')
    svg.classList.add('answer-stream__filament')
    const points = Array.from({ length: 25 }, (_, i) => {
      const t = i / 24, bend = Math.sin(t * Math.PI) * .07
      return `${i === 0 ? 'M' : 'L'}${1080 * (origin.fx + (destination.fx - origin.fx) * t + bend)},${1080 * (origin.fy + (destination.fy - origin.fy) * t - bend)}`
    }).join(' ')
    for (const glow of [true, false]) {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      path.setAttribute('d', points)
      path.setAttribute('pathLength', '1')
      path.setAttribute('fill', 'none')
      path.setAttribute('stroke', glow ? this.color : '#e2f6ff')
      path.setAttribute('stroke-width', glow ? '5' : '1.4')
      path.setAttribute('stroke-linecap', 'round')
      path.setAttribute('stroke-dasharray', '.24 .76')
      path.style.opacity = glow ? '.35' : '.85'
      svg.append(path)
      this.animate(path, [{ strokeDashoffset: '1' }, { strokeDashoffset: '-1' }], duration)
    }
    this.animate(svg, [{ opacity: 0 }, { opacity: 1, offset: .15 }, { opacity: .7, offset: .65 }, { opacity: 0 }], duration)
  }

  enterTag(element: HTMLElement, position: Point, index: number, duration: number) {
    if (this.disposed || this.reduced) return
    this.dissolve(duration)
    this.filament(this.route.origin, position, duration)
    this.transformText(element, true, duration)
    for (let i = 0; i < 3; i++) this.glyph(
      { fx: this.route.origin.fx + (i - 1) * .025, fy: this.route.origin.fy + (i - 1) * .015 },
      { fx: position.fx + (i - 1) * .035, fy: position.fy + .05 }, codes[(index * 3 + i) % codes.length], duration * .85, i * 30)
  }

  leaveTag(element: HTMLElement, position: Point, index: number, duration: number) {
    if (this.disposed || this.reduced) return
    this.filament(position, this.route.destination, duration)
    this.transformText(element, false, duration)
    for (let i = 0; i < 3; i++) this.glyph(position,
      { fx: this.route.destination.fx + (i - 1) * .02, fy: this.route.destination.fy }, codes[(index + i + 2) % codes.length], duration * .86, i * 25)
  }

  private transformText(element: HTMLElement, entering: boolean, duration: number) {
    const label = element.querySelector('.lc-scene-label'), code = element.querySelector('.answer-stream-code')
    if (label) this.animate(label, entering
      ? [{ opacity: 0 }, { opacity: 0, offset: .2 }, { opacity: 1, offset: .56 }, { opacity: 1 }]
      : [{ opacity: 1 }, { opacity: 0, offset: .42 }, { opacity: 0 }], duration)
    if (code) this.animate(code, entering
      ? [{ opacity: 1 }, { opacity: 1, offset: .2 }, { opacity: 0, offset: .56 }, { opacity: 0 }]
      : [{ opacity: 0 }, { opacity: 1, offset: .42 }, { opacity: 1, offset: .7 }, { opacity: 0 }], duration)
  }

  setPlaying(playing: boolean) {
    this.playing = playing
    for (const animation of this.animations) {
      if (playing && animation.playState === 'paused') animation.play()
      else if (!playing && animation.playState === 'running') animation.pause()
    }
  }

  dispose() {
    this.disposed = true
    for (const animation of this.animations) animation.cancel()
    this.animations.clear()
    this.nodes.clear()
    this.layer.remove()
  }
}
