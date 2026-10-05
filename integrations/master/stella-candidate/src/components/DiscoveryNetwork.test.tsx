// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DiscoveryNetwork } from './DiscoveryNetwork'
import { WhiteEntity } from './WhiteEntity'

type ClockOptions = { duration: number; ease: string; repeat: number; onUpdate: (time: number) => void; onComplete: () => void }
const clock = vi.hoisted(() => ({ reducedMotion: false, renderers: 0, tracks: [] as Array<{
  options: ClockOptions; pause: ReturnType<typeof vi.fn>; play: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>
}> }))
vi.mock('motion', () => ({ animate: (_from: number, _to: number, options: ClockOptions) => {
  const track = { options, pause: vi.fn(), play: vi.fn(), stop: vi.fn() }
  clock.tracks.push(track)
  return track
} }))
vi.mock('motion/react', () => ({ useReducedMotion: () => clock.reducedMotion }))
vi.mock('./white-entity-renderer', () => ({ createWhiteEntityRenderer: () => {
  clock.renderers++
  return { setPlaying: vi.fn(), setEnvelope: vi.fn(), resize: vi.fn(), dispose: vi.fn() }
} }))

let host: HTMLDivElement
let root: Root
let hidden = false
let arcs = 0

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  clock.tracks.length = 0
  clock.renderers = 0
  clock.reducedMotion = false
  hidden = false
  arcs = 0
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden)
  const context = new Proxy({}, { get: (_target, key) => () => { if (key === 'arc') arcs++ }, set: () => true })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D)
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => { root.unmount() })
  host.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const render = (node: React.ReactNode) => act(async () => { root.render(node) })

it('plays the authored 23.3-second scene once and completes the scenario at its end', async () => {
  const complete = vi.fn()
  await render(<DiscoveryNetwork playing cueKey="session:particles" onComplete={complete} />)
  const track = clock.tracks.at(-1)!
  expect(host.querySelector('canvas.vk-discovery-network')).not.toBeNull()
  expect(track.options.duration).toBe(23.3)
  expect(track.options.ease).toBe('linear')
  expect(track.options.repeat).toBe(0)
  expect(track.pause).not.toHaveBeenCalled()
  arcs = 0
  act(() => track.options.onUpdate(5))
  expect(arcs).toBeGreaterThan(400)
  expect(complete).not.toHaveBeenCalled()
  act(() => track.options.onComplete())
  expect(complete).toHaveBeenCalledOnce()

  // The same cue does not replay; a new one starts from the first frame.
  await render(<DiscoveryNetwork playing cueKey="session:particles" onComplete={complete} />)
  expect(clock.tracks).toHaveLength(1)
  await render(<DiscoveryNetwork playing cueKey="next:particles" onComplete={complete} />)
  expect(clock.tracks).toHaveLength(2)
  expect(track.stop).toHaveBeenCalledOnce()
})

it('follows scenario pause and a hidden page', async () => {
  await render(<DiscoveryNetwork playing={false} cueKey="a" />)
  const track = clock.tracks.at(-1)!
  expect(track.pause).toHaveBeenCalled()
  await render(<DiscoveryNetwork playing cueKey="a" />)
  expect(track.play).toHaveBeenCalledOnce()
  hidden = true
  act(() => { document.dispatchEvent(new Event('visibilitychange')) })
  expect(track.pause.mock.calls.length).toBeGreaterThanOrEqual(2)
  hidden = false
  act(() => { document.dispatchEvent(new Event('visibilitychange')) })
  expect(track.play).toHaveBeenCalledTimes(2)
})

it('repeats in the development preview without completing', async () => {
  const complete = vi.fn()
  await render(<DiscoveryNetwork playing loop cueKey="preview" onComplete={complete} />)
  const track = clock.tracks.at(-1)!
  expect(track.options.repeat).toBe(Infinity)
  act(() => track.options.onComplete())
  expect(complete).not.toHaveBeenCalled()
})

it.each(['generation', 'activation'] as const)('shows the scene for the %s stage instead of the LumiCells field', async stage => {
  const complete = vi.fn()
  await render(<WhiteEntity playing stage={stage} cueKey={`s:${stage}`} generationDurationSeconds={7} onComplete={complete} />)
  expect(host.querySelector('.vk-discovery-network')).not.toBeNull()
  expect(host.querySelector('.vk-white-entity')).toBeNull()
  expect(clock.renderers).toBe(0)
  expect(clock.tracks.at(-1)!.options.duration).toBe(23.3)
  act(() => clock.tracks.at(-1)!.options.onComplete())
  expect(complete).toHaveBeenCalledOnce()
})

it('keeps the scan stage on the LumiCells field', async () => {
  await render(<WhiteEntity playing stage="scan" />)
  expect(host.querySelector('.vk-white-entity')).not.toBeNull()
  expect(host.querySelector('.vk-discovery-network')).toBeNull()
  expect(clock.renderers).toBe(1)
})
