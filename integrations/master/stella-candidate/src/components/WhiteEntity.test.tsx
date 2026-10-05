// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
// The LumiCells field itself; routing of the recommendation stages is covered in DiscoveryNetwork.test.tsx.
import { WhiteEntityField as WhiteEntity } from './WhiteEntity'

type RendererCallbacks = { onReady: () => void; onError: (error?: unknown) => void }
type TimelineOptions = { onUpdate: (value: number) => void; onComplete: () => void; repeat?: number; duration: number }
const native = vi.hoisted(() => ({
  reducedMotion: false,
  instances: [] as Array<{
    canvas: HTMLCanvasElement
    callbacks: RendererCallbacks
    setPlaying: ReturnType<typeof vi.fn>
    setEnvelope: ReturnType<typeof vi.fn>
    resize: ReturnType<typeof vi.fn>
    dispose: ReturnType<typeof vi.fn>
  }>,
}))
const motion = vi.hoisted(() => ({ tracks: [] as Array<{
  options: TimelineOptions; pause: ReturnType<typeof vi.fn>; play: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>
}> }))
vi.mock('motion', () => ({ animate: (_from: number, _to: number[], options: TimelineOptions) => {
  const track = { options, pause: vi.fn(), play: vi.fn(), stop: vi.fn() }
  motion.tracks.push(track)
  return track
} }))
vi.mock('motion/react', () => ({ useReducedMotion: () => native.reducedMotion }))
vi.mock('./white-entity-renderer', () => ({
  createWhiteEntityRenderer: (canvas: HTMLCanvasElement, callbacks: RendererCallbacks) => {
    const renderer = { canvas, callbacks, setPlaying: vi.fn(), setEnvelope: vi.fn(), resize: vi.fn(), dispose: vi.fn() }
    native.instances.push(renderer)
    return renderer
  },
}))

let host: HTMLDivElement
let root: Root | undefined
let hidden = false
let observer: { callback: ResizeObserverCallback; observe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  native.instances.length = 0
  motion.tracks.length = 0
  native.reducedMotion = false
  hidden = false
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden)
  vi.stubGlobal('ResizeObserver', class {
    observe = vi.fn()
    disconnect = vi.fn()
    constructor(callback: ResizeObserverCallback) { observer = { callback, observe: this.observe, disconnect: this.disconnect } }
  })
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(async () => {
  if (root) await act(async () => { root!.unmount() })
  host.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function render(playing: boolean, stage: 'scan' | 'generation' | 'activation' = 'scan', onComplete?: () => void, preview = false, silhouetteSrc?: string) {
  await act(async () => { root!.render(<WhiteEntity playing={playing} stage={stage} onComplete={onComplete} preview={preview} silhouetteSrc={silhouetteSrc} />) })
  return native.instances[0]
}

function visibility(next: boolean) {
  hidden = next
  act(() => { document.dispatchEvent(new Event('visibilitychange')) })
}

it('keeps one renderer and the same canvas when scenario playback pauses and resumes', async () => {
  const renderer = await render(true)
  expect(renderer.canvas).toBe(host.querySelector('canvas'))
  expect(renderer.setPlaying).toHaveBeenLastCalledWith(true)
  act(() => { renderer.callbacks.onReady() })
  expect(renderer.canvas.dataset.state).toBe('ready')

  await render(false)
  expect(renderer.setPlaying).toHaveBeenLastCalledWith(false)
  await render(true)
  expect(renderer.setPlaying).toHaveBeenLastCalledWith(true)
  expect(native.instances).toHaveLength(1)
  expect(host.querySelector('canvas')).toBe(renderer.canvas)
  expect(renderer.dispose).not.toHaveBeenCalled()
})

it.each(['scan', 'generation', 'activation'] as const)('keeps %s visible for seven seconds even with reduced motion', async stage => {
  const renderer = await render(true, stage)
  act(() => renderer.callbacks.onReady())
  expect(motion.tracks.at(-1)!.options.duration).toBe(7)
  native.reducedMotion = true
  await render(true, stage)
  expect(motion.tracks.at(-1)!.options.duration).toBe(7)
})

it('supports an explicit master generation duration without shortening scan', async () => {
  await act(async () => root!.render(<WhiteEntity playing stage="generation" generationDurationSeconds={9} />))
  act(() => native.instances[0].callbacks.onReady())
  expect(motion.tracks.at(-1)!.options.duration).toBe(9)
  await act(async () => root!.render(<WhiteEntity playing stage="scan" generationDurationSeconds={9} />))
  expect(motion.tracks.at(-1)!.options.duration).toBe(7)
})

it('keeps the controlled voice layer reversible and reports hidden only after its current exit', async () => {
  const hiddenComplete = vi.fn(), scenarioComplete = vi.fn()
  const draw = (active: boolean) => act(async () => {
    root!.render(<WhiteEntity playing stage="generation" controlledActive={active}
      onHidden={hiddenComplete} onComplete={scenarioComplete} />)
  })
  await draw(true)
  act(() => native.instances[0].callbacks.onReady())
  const entrance = motion.tracks.at(-1)!
  expect(entrance.options.duration).toBeCloseTo(6 * .32)
  act(() => entrance.options.onUpdate(.5))
  await draw(false)
  const interruptedExit = motion.tracks.at(-1)!
  expect(entrance.stop).toHaveBeenCalled()
  await draw(true)
  act(() => interruptedExit.options.onComplete())
  expect(hiddenComplete).not.toHaveBeenCalled()
  const newEntrance = motion.tracks.at(-1)!
  act(() => newEntrance.options.onComplete())
  await draw(false)
  const exit = motion.tracks.at(-1)!
  expect(hiddenComplete).not.toHaveBeenCalled()
  act(() => exit.options.onComplete())
  expect(hiddenComplete).toHaveBeenCalledOnce()
  expect(host.querySelector('canvas')?.getAttribute('data-phase')).toBe('hidden')
  expect(native.instances).toHaveLength(1)
  expect(scenarioComplete).not.toHaveBeenCalled()
})

it('renders neutral activation without a photo even when a silhouette source is supplied', async () => {
  const complete = vi.fn()
  const renderer = await render(true, 'activation', complete, false, '/silhouette.svg')
  expect(host.querySelector('img')).toBeNull()
  act(() => renderer.callbacks.onReady())
  expect(motion.tracks.at(-1)!.options.duration).toBe(7)
  act(() => motion.tracks.at(-1)!.options.onComplete())
  expect(complete).toHaveBeenCalledOnce()
})

it('pauses while hidden and never resumes a scenario that was paused in the meantime', async () => {
  const renderer = await render(true)
  act(() => { renderer.callbacks.onReady() })
  const timeline = motion.tracks[0]
  visibility(true)
  expect(renderer.setPlaying).toHaveBeenLastCalledWith(false)
  expect(timeline.pause).toHaveBeenCalled()
  await render(false)
  timeline.play.mockClear()
  visibility(false)
  expect(renderer.setPlaying).toHaveBeenLastCalledWith(false)
  expect(timeline.play).not.toHaveBeenCalled()
  await render(true)
  expect(renderer.setPlaying).toHaveBeenLastCalledWith(true)
  expect(timeline.play).toHaveBeenCalled()
})

it('prepares a visible static layer for reduced motion without starting playback', async () => {
  native.reducedMotion = true
  const complete = vi.fn()
  const renderer = await render(true, 'scan', complete)
  act(() => { renderer.callbacks.onReady() })
  expect(renderer.canvas.dataset.state).toBe('ready')
  expect(renderer.setPlaying).toHaveBeenLastCalledWith(false)
  visibility(true)
  visibility(false)
  expect(renderer.setPlaying.mock.calls.every(([playing]) => playing === false)).toBe(true)
  act(() => { motion.tracks[0].options.onUpdate(.4) })
  expect(renderer.setEnvelope).toHaveBeenLastCalledWith('scan', 1, 0)
  expect(complete).not.toHaveBeenCalled()
  act(() => { motion.tracks[0].options.onComplete() })
  expect(complete).toHaveBeenCalledOnce()
})

it('forwards resize observations and detaches observers, listeners and renderer on unmount', async () => {
  const renderer = await render(true)
  expect(observer.observe).toHaveBeenCalled()
  vi.spyOn(renderer.canvas, 'getBoundingClientRect').mockReturnValue({ width: 540, height: 960 } as DOMRect)
  Object.defineProperty(renderer.canvas, 'clientWidth', { value: 540, configurable: true })
  Object.defineProperty(renderer.canvas, 'clientHeight', { value: 960, configurable: true })
  const resizeCalls = renderer.resize.mock.calls.length
  act(() => { observer.callback([], {} as ResizeObserver) })
  expect(renderer.resize.mock.calls.length).toBeGreaterThan(resizeCalls)
  expect(renderer.resize).toHaveBeenLastCalledWith(540, 960)

  await act(async () => { root!.unmount(); root = undefined })
  expect(observer.disconnect).toHaveBeenCalledOnce()
  expect(renderer.dispose).toHaveBeenCalledOnce()
  renderer.setPlaying.mockClear()
  visibility(true)
  visibility(false)
  expect(renderer.setPlaying).not.toHaveBeenCalled()
})

it('stops on renderer failure and ignores ready/error callbacks after disposal', async () => {
  const reportError = vi.spyOn(console, 'error').mockImplementation(() => {})
  const failure = vi.fn(), complete = vi.fn()
  await act(async () => root!.render(<WhiteEntity playing onError={failure} onComplete={complete} />))
  const renderer = native.instances[0]
  act(() => { renderer.callbacks.onError(new Error('WebGL unavailable')) })
  expect(failure).toHaveBeenCalledOnce()
  expect(complete).not.toHaveBeenCalled()
  expect(renderer.canvas.dataset.state).toBe('error')
  expect(renderer.setPlaying).toHaveBeenLastCalledWith(false)
  expect(reportError).toHaveBeenCalledOnce()
  await render(false)
  await render(true)
  visibility(true)
  visibility(false)
  act(() => { renderer.callbacks.onReady() })
  expect(renderer.canvas.dataset.state).toBe('error')
  expect(renderer.setPlaying).toHaveBeenLastCalledWith(false)

  await act(async () => { root!.unmount(); root = undefined })
  renderer.setPlaying.mockClear()
  act(() => { renderer.callbacks.onReady(); renderer.callbacks.onError() })
  expect(renderer.canvas.dataset.state).toBe('error')
  expect(renderer.setPlaying).not.toHaveBeenCalled()
  expect(renderer.dispose).toHaveBeenCalledOnce()
  expect(failure).toHaveBeenCalledOnce()
})

it('starts the visual sequence only after GPU readiness and completes after its final frame', async () => {
  const complete = vi.fn()
  const renderer = await render(true, 'scan', complete)
  expect(motion.tracks).toHaveLength(0)
  expect(complete).not.toHaveBeenCalled()
  act(() => { renderer.callbacks.onReady() })
  expect(motion.tracks).toHaveLength(1)
  const timeline = motion.tracks[0]
  act(() => { timeline.options.onUpdate(.5) })
  expect(renderer.setEnvelope).toHaveBeenLastCalledWith('scan', .5, 0)
  act(() => { timeline.options.onUpdate(1.5) })
  expect(renderer.setEnvelope).toHaveBeenLastCalledWith('scan', 1, .5)
  expect(complete).not.toHaveBeenCalled()
  act(() => { timeline.options.onComplete() })
  expect(complete).toHaveBeenCalledOnce()
})

it('retains the renderer across stages but invalidates the old stage animation and callback', async () => {
  const scanComplete = vi.fn(), generationComplete = vi.fn()
  const renderer = await render(true, 'scan', scanComplete)
  act(() => { renderer.callbacks.onReady() })
  const oldTimeline = motion.tracks[0]
  await render(true, 'generation', generationComplete)
  expect(native.instances).toHaveLength(1)
  expect(host.querySelector('canvas')).toBe(renderer.canvas)
  expect(oldTimeline.stop).toHaveBeenCalled()
  expect(motion.tracks).toHaveLength(2)
  renderer.setEnvelope.mockClear()
  act(() => { oldTimeline.options.onUpdate(.8); oldTimeline.options.onComplete() })
  expect(renderer.setEnvelope).not.toHaveBeenCalled()
  expect(scanComplete).not.toHaveBeenCalled()
  expect(generationComplete).not.toHaveBeenCalled()
  act(() => { motion.tracks[1].options.onComplete() })
  expect(generationComplete).toHaveBeenCalledOnce()
})

it('does not let an unmounted timeline complete the old scenario', async () => {
  const complete = vi.fn()
  const renderer = await render(true, 'generation', complete)
  act(() => { renderer.callbacks.onReady() })
  const timeline = motion.tracks[0]
  await act(async () => { root!.unmount(); root = undefined })
  expect(timeline.stop).toHaveBeenCalled()
  renderer.setEnvelope.mockClear()
  act(() => { timeline.options.onUpdate(2); timeline.options.onComplete() })
  expect(renderer.setEnvelope).not.toHaveBeenCalled()
  expect(complete).not.toHaveBeenCalled()
})

it('loops a dedicated preview without completing the surrounding scenario', async () => {
  const complete = vi.fn()
  const renderer = await render(true, 'generation', complete, true)
  act(() => { renderer.callbacks.onReady() })
  expect(motion.tracks[0].options.repeat).toBe(Infinity)
  act(() => { motion.tracks[0].options.onComplete() })
  expect(complete).not.toHaveBeenCalled()
})

it.each(['gpu-first', 'image-first'])('gates the silhouette on both resources and masks it with the same reveal/hold/erase timeline (%s)', async order => {
  const complete = vi.fn()
  const renderer = await render(true, 'scan', complete, false, '/silhouette.svg')
  const image = host.querySelector<HTMLImageElement>('img.vk-processing-art')!
  expect(image).not.toBeNull()
  expect(image.nextElementSibling).toBe(renderer.canvas)
  const initial = image.style.maskImage
  expect(initial).toContain('linear-gradient')
  expect(initial).toContain('transparent')
  expect(initial).not.toContain('black')
  let finishDecode!: () => void
  image.decode = vi.fn(() => new Promise<void>(resolve => { finishDecode = resolve }))
  const ready = () => renderer.callbacks.onReady()
  const loaded = () => { image.dispatchEvent(new Event('load')) }
  act(order === 'gpu-first' ? ready : loaded)
  expect(motion.tracks).toHaveLength(0)
  expect(complete).not.toHaveBeenCalled()
  act(order === 'gpu-first' ? loaded : ready)
  expect(image.decode).toHaveBeenCalledOnce()
  expect(motion.tracks).toHaveLength(0)
  await act(async () => { finishDecode() })
  expect(motion.tracks).toHaveLength(1)
  const timeline = motion.tracks[0]

  act(() => { timeline.options.onUpdate(.5) })
  const reveal = image.style.maskImage
  expect(reveal).toContain('radial-gradient')
  expect(reveal.indexOf('black')).toBeLessThan(reveal.indexOf('transparent'))
  expect(renderer.setEnvelope).toHaveBeenLastCalledWith('scan', .5, 0)
  act(() => { timeline.options.onUpdate(1) })
  expect(image.style.maskImage).toContain('linear-gradient')
  expect(image.style.maskImage).toContain('black')
  expect(image.style.maskImage).not.toContain('transparent')
  act(() => { timeline.options.onUpdate(1.5) })
  const erase = image.style.maskImage
  expect(erase).toContain('radial-gradient')
  expect(erase.indexOf('transparent')).toBeLessThan(erase.indexOf('black'))
  expect(renderer.setEnvelope).toHaveBeenLastCalledWith('scan', 1, .5)
  expect(complete).not.toHaveBeenCalled()
  complete.mockImplementation(() => { expect(image.style.maskImage).toBe(initial) })
  act(() => { timeline.options.onComplete() })
  expect(complete).toHaveBeenCalledOnce()

  await render(true, 'generation', undefined, false, '/silhouette.svg')
  expect(host.querySelector('img.vk-processing-art')).toBeNull()
  expect(image.isConnected).toBe(false)
  expect(host.querySelector('canvas')).toBe(renderer.canvas)
  expect(native.instances).toHaveLength(1)
})

it('reports a failed silhouette image and still allows the GPU-ready sequence to finish', async () => {
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const complete = vi.fn()
  const renderer = await render(true, 'scan', complete, false, '/missing-silhouette.svg')
  act(() => { renderer.callbacks.onReady() })
  expect(motion.tracks).toHaveLength(0)
  const image = host.querySelector('img.vk-processing-art')!
  act(() => { image.dispatchEvent(new Event('error')) })
  expect(warning).toHaveBeenCalledOnce()
  expect(motion.tracks).toHaveLength(1)
  act(() => { motion.tracks[0].options.onComplete() })
  expect(complete).toHaveBeenCalledOnce()
})

it('resets a same-stage accepted cue once without reallocating the GPU renderer', async () => {
  const complete = vi.fn()
  await act(async () => root!.render(<WhiteEntity playing stage="generation" cueKey="first" onComplete={complete} />))
  act(() => native.instances[0].callbacks.onReady())
  const old = motion.tracks[0]
  act(() => { old.options.onComplete(); old.options.onComplete() })
  expect(complete).toHaveBeenCalledOnce()
  await act(async () => root!.render(<WhiteEntity playing stage="generation" cueKey="first" generationDurationSeconds={8} onComplete={complete} />))
  expect(motion.tracks).toHaveLength(1)
  await act(async () => root!.render(<WhiteEntity playing stage="generation" cueKey="second" onComplete={complete} />))
  expect(native.instances).toHaveLength(1)
  expect(motion.tracks).toHaveLength(2)
  expect(native.instances[0].setEnvelope).toHaveBeenLastCalledWith('generation', 0, 0)
  act(() => { old.options.onComplete(); motion.tracks[1].options.onComplete(); motion.tracks[1].options.onComplete() })
  expect(complete).toHaveBeenCalledTimes(2)
})

