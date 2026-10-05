// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AnswerStream } from './answer-stream'

class AnimationBoundary {
  playState: AnimationPlayState = 'running'
  finished: Promise<void>
  private resolve!: () => void
  private reject!: (error: Error) => void
  constructor(readonly element: Element, readonly frames: Keyframe[], readonly options: KeyframeAnimationOptions) {
    this.finished = new Promise((resolve, reject) => { this.resolve = resolve; this.reject = reject })
  }
  pause() { this.playState = 'paused' }
  play() { this.playState = 'running' }
  cancel() { if (this.playState !== 'finished' && this.playState !== 'idle') this.reject(Error('AbortError')); this.playState = 'idle' }
  finish() { if (this.playState === 'running') { this.playState = 'finished'; this.resolve() } }
}
let animations: AnimationBoundary[], stage: HTMLDivElement, answer: HTMLDivElement, tag: HTMLSpanElement
let visual: AnswerStream | undefined
let animateDescriptor: PropertyDescriptor | undefined
const flush = async () => { await Promise.resolve(); await Promise.resolve() }

beforeEach(() => {
  animations = []
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
  animateDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'animate')
  Object.defineProperty(Element.prototype, 'animate', { configurable: true, value: function (this: Element, frames: Keyframe[], options: KeyframeAnimationOptions) {
    const animation = new AnimationBoundary(this, frames as Keyframe[], options as KeyframeAnimationOptions)
    animations.push(animation)
    return animation as unknown as Animation
  } })
  stage = document.createElement('div')
  answer = document.createElement('div')
  answer.innerHTML = '<img class="reference-card-artwork" src="/cover.svg" alt="">'
  tag = document.createElement('span')
  tag.innerHTML = '<span class="lc-scene-label">персонализация</span><span class="answer-stream-code">0101</span>'
  document.body.append(stage, answer, tag)
})
afterEach(() => {
  visual?.dispose(); visual = undefined
  stage?.remove(); answer?.remove(); tag?.remove()
  if (animateDescriptor) Object.defineProperty(Element.prototype, 'animate', animateDescriptor)
  else delete (Element.prototype as Partial<Element>).animate
  vi.restoreAllMocks(); vi.unstubAllGlobals()
})
const create = (reduced = false) => visual = new AnswerStream(stage, answer,
  { left: 558.5, top: 549, width: 468, height: 280 }, '#0077FF', reduced, 31)

it('anchors the stream to the actual scaled card and disassembles its supplied artwork once across batches', async () => {
  vi.spyOn(stage, 'getBoundingClientRect').mockReturnValue({ left: 20, top: 50, width: 540, height: 540 } as DOMRect)
  vi.spyOn(answer, 'getBoundingClientRect').mockReturnValue({ left: 299.25, top: 274.5, width: 234, height: 140 } as DOMRect)
  const stream = create()
  expect(stream.route.origin.fx).toBeCloseTo((558.5 + 234) / 1080)
  expect(stream.route.origin.fy).toBeCloseTo((549 - 100 + 140) / 1080)
  stream.enterTag(tag, { fx: .26, fy: .75 }, 0, 1150)
  expect(stage.querySelectorAll('.answer-stream__fragment')).toHaveLength(24)
  expect([...stage.querySelectorAll<HTMLImageElement>('.answer-stream__fragment img')].every(img => img.getAttribute('src')?.endsWith('/cover.svg'))).toBe(true)
  expect(stage.querySelectorAll('[role="status"]')).toHaveLength(0)
  expect(stage.querySelector('.answer-stream')?.getAttribute('aria-hidden')).toBe('true')
  expect(animations.every(animation => Number(animation.options.delay ?? 0) + Number(animation.options.duration) <= 1150)).toBe(true)
  for (const animation of animations) animation.finish()
  await flush()
  expect(stage.querySelectorAll('.answer-stream__fragment')).toHaveLength(0)
  stream.enterTag(tag, { fx: .72, fy: .64 }, 1, 1150)
  expect(stage.querySelectorAll('.answer-stream__fragment')).toHaveLength(0)
  expect(animations.filter(animation => animation.element === answer)).toHaveLength(1)
  expect(tag.querySelector('.lc-scene-label')?.textContent).toBe('персонализация')
})

it('pauses every decorative animation, resumes existing objects and cancels them on a changed session', async () => {
  const stream = create()
  stream.setPlaying(false)
  stream.enterTag(tag, { fx: .3, fy: .7 }, 0, 920)
  const count = animations.length
  expect(count).toBeGreaterThan(0)
  expect(animations.every(animation => animation.playState === 'paused')).toBe(true)
  for (const animation of animations) animation.finish()
  await flush()
  expect(stage.querySelector('.answer-stream__filament')).not.toBeNull()
  stream.setPlaying(true)
  expect(animations).toHaveLength(count)
  expect(animations.every(animation => animation.playState === 'running')).toBe(true)
  stream.leaveTag(tag, { fx: .3, fy: .7 }, 0, 640)
  const exit = animations.slice(count)
  expect(exit.every(animation => Number(animation.options.delay ?? 0) + Number(animation.options.duration) <= 640)).toBe(true)
  stream.dispose()
  await flush()
  expect(animations.every(animation => animation.playState === 'idle')).toBe(true)
  expect(stage.querySelector('.answer-stream')).toBeNull()
})

it('uses light cells for live camera without capturing, cloning video or stopping tracks', () => {
  const video = document.createElement('video'), stop = vi.fn()
  const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream
  video.srcObject = stream
  answer.replaceChildren(video)
  create().enterTag(tag, { fx: .6, fy: .9 }, 0, 1150)
  expect(document.querySelectorAll('video')).toHaveLength(1)
  expect(video.isConnected).toBe(true)
  expect(video.srcObject).toBe(stream)
  expect(stage.querySelectorAll('img, canvas')).toHaveLength(0)
  expect(stage.querySelectorAll('.answer-stream__fragment--light')).toHaveLength(24)
  visual!.dispose()
  expect(video.srcObject).toBe(stream)
  expect(stop).not.toHaveBeenCalled()
})

it('leaves only scenario-owned fades under reduced motion', () => {
  const stream = create(true)
  stream.enterTag(tag, { fx: .3, fy: .7 }, 0, 920)
  stream.leaveTag(tag, { fx: .3, fy: .7 }, 0, 640)
  expect(animations).toHaveLength(0)
  expect(stage.querySelector('.answer-stream')?.children).toHaveLength(0)
})
