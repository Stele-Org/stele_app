// @vitest-environment jsdom
import { act, StrictMode, type ComponentProps, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { Prototype } from './Prototype'
import { SCAN_SHOT_MS } from './scan-photo'
import { CameraSessionContext, type CameraSession } from '../../components/camera-session-context'
import type { WhiteEntity as WhiteEntityComponent } from '../../components/WhiteEntity'

// The real scenario and input gate; the camera frame, the scan renderer and the sound are stand-ins.
vi.mock('../voice/use-screen-narration', () => ({ useScreenNarration: () => {} }))
vi.mock('../sound/use-stella-sound', () => ({ useStellaSound: () => {} }))
vi.mock('../../components/RingScene', () => ({ RingScene: ({ children }: { children: ReactNode }) => <div>{children}</div> }))
vi.mock('../../components/WhiteEntity', () => ({ WhiteEntity: ({ onComplete }: ComponentProps<typeof WhiteEntityComponent>) =>
  <button data-discovery-complete onClick={onComplete}>Complete</button> }))
vi.mock('../../service', () => ({ markServiceReady: async () => {}, useServicePlaying: () => true }))
vi.mock('../../components/AnswerFlight', () => ({ AnswerFlight: () => null }))
const capture = vi.hoisted(() => ({ photo: vi.fn<(video: HTMLVideoElement, signal: AbortSignal, upright?: boolean) => Promise<Blob>>() }))
vi.mock('../master/camera-capture', () => ({ capturePhoto: capture.photo }))

let root: Root, host: HTMLDivElement
let created: string[], revoked: string[]
let request: ReturnType<typeof vi.fn<(url: string, init: RequestInit) => Promise<Response>>>
const stream = { getTracks: () => [], getVideoTracks: () => [] } as unknown as MediaStream
const ready: CameraSession = { stream, status: 'ready', upright: true }
const state = () => host.querySelector('main')?.getAttribute('data-screen')
const pass = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })
const show = (session?: CameraSession) => act(() => root.render(<StrictMode>
  {session ? <CameraSessionContext.Provider value={session}><Prototype /></CameraSessionContext.Provider> : <Prototype />}
</StrictMode>))
async function press(label: string) {
  const button = [...host.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent === label)!
  expect(button, label).toBeDefined(); expect(button.disabled, label).toBe(false)
  act(() => button.click())
  await pass(400)
}
const endScan = async () => { act(() => host.querySelector<HTMLButtonElement>('[data-discovery-complete]')!.click()); await pass(0) }

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('BroadcastChannel', undefined)
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })))
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  created = []; revoked = []
  URL.createObjectURL = vi.fn(() => { created.push(`blob:photo-${created.length + 1}`); return created.at(-1)! })
  URL.revokeObjectURL = vi.fn((url: string) => { revoked.push(url) })
  capture.photo.mockReset().mockImplementation(async () => new Blob(['jpeg'], { type: 'image/jpeg' }))
  request = vi.fn(async () => new Response(JSON.stringify({ file: 'stored.jpg' }), { status: 201 }))
  vi.stubGlobal('fetch', request)
  // The dev entry that starts at the scan and then follows the scenario.
  window.history.replaceState(null, '', '?discovery=sequence')
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount()); host.remove()
  vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals()
  window.history.replaceState(null, '', window.location.pathname)
})

it('photographs during the scan, shows the photo after it and offers to continue or to repeat', async () => {
  show(ready)
  expect(state()).toBe('vk-scanning')
  await pass(SCAN_SHOT_MS - 100)
  expect(capture.photo).not.toHaveBeenCalled()
  await pass(100)
  // One frame of the shared stream, through the stand's encoder, upright as the session says.
  expect(capture.photo).toHaveBeenCalledOnce()
  const [video, , upright] = capture.photo.mock.calls[0]
  expect(video.srcObject).toBe(stream); expect(video.muted).toBe(true); expect(upright).toBe(true)
  expect(state()).toBe('vk-scanning')

  await endScan()
  expect(state()).toBe('vk-photo-review')
  expect(host.querySelector<HTMLImageElement>('.photo-review-image')!.getAttribute('src')).toBe('blob:photo-1')
  expect(host.querySelector('.photo-review-image--empty')).toBeNull()
  expect([...host.querySelectorAll('.photo-review-actions button')].map(button => button.textContent)).toEqual(['Повторить', 'Продолжить'])

  // "Повторить": back to the camera prompt, the photo is released without being stored, and the next scan photographs again.
  await press('Повторить')
  expect(state()).toBe('vk-camera')
  expect(revoked).toEqual(['blob:photo-1'])
  expect(request).not.toHaveBeenCalled()
  expect(host.querySelector('.photo-review-image')).toBeNull()
  await pass(1850)
  expect(state()).toBe('vk-scanning')
  await pass(SCAN_SHOT_MS)
  expect(capture.photo).toHaveBeenCalledTimes(2)
  await endScan()
  expect(state()).toBe('vk-photo-review')
  expect(host.querySelector<HTMLImageElement>('.photo-review-image')!.getAttribute('src')).toBe('blob:photo-2')

  // "Продолжить": on to Discovery; the approved photo goes to the local storage of the dev server and leaves the page.
  await press('Продолжить')
  expect(state()).toBe('vk-particles')
  expect(revoked).toEqual(['blob:photo-1', 'blob:photo-2'])
  expect(request).toHaveBeenCalledOnce()
  const [url, init] = request.mock.calls[0]
  expect(url).toBe('/photo-storage')
  expect(init.method).toBe('POST')
  expect(init.body).toBe(await capture.photo.mock.results[1].value)
  expect(init.headers).toMatchObject({ 'Content-Type': 'image/jpeg', 'X-Camera-Upright': '1' })
  expect((init.headers as Record<string, string>)['X-Capture-Id']).toMatch(/^[0-9a-f-]{36}$/)
})

/** The check without a photo: a black square in place of the image, the same two choices. */
const blackSquare = () => {
  expect(state()).toBe('vk-photo-review')
  const square = host.querySelector('.photo-review-frame > .photo-review-image--empty')!
  expect(square).not.toBeNull()
  expect(square.tagName).toBe('DIV')
  expect(square.classList.contains('photo-review-image')).toBe(true)
  expect(square.getAttribute('aria-label')).toBe('Фото не снято')
  expect(square.getAttribute('data-lc-influence')).toBe('shadow')
  expect(host.querySelector('img.photo-review-image')).toBeNull()
  expect([...host.querySelectorAll('.photo-review-actions button')].map(button => button.textContent)).toEqual(['Повторить', 'Продолжить'])
}

it('keeps the check when there is no camera: a black square, and nothing is stored', async () => {
  show()
  await pass(SCAN_SHOT_MS + 500)
  expect(capture.photo).not.toHaveBeenCalled()
  await endScan()
  blackSquare()

  // "Повторить": the camera prompt and another scan, which ends in the same check.
  await press('Повторить')
  expect(state()).toBe('vk-camera')
  await pass(1850)
  expect(state()).toBe('vk-scanning')
  await endScan()
  blackSquare()

  await press('Продолжить')
  expect(state()).toBe('vk-particles')
  expect(request).not.toHaveBeenCalled()
  expect(created).toEqual([])
  expect(revoked).toEqual([])
})

it('shows the black square when the frame could not be taken', async () => {
  capture.photo.mockRejectedValue(new Error('Кадр камеры ещё не готов'))
  show(ready)
  await pass(SCAN_SHOT_MS + 500)
  expect(capture.photo).toHaveBeenCalledOnce()
  await endScan()
  blackSquare()
  expect(created).toEqual([])
  await press('Продолжить')
  expect(state()).toBe('vk-particles')
  expect(request).not.toHaveBeenCalled()
})

it('does not photograph after a scan that ended before the shot, and shows the black square', async () => {
  show(ready)
  await pass(1000)
  await endScan()
  blackSquare()
  await pass(SCAN_SHOT_MS)
  expect(capture.photo).not.toHaveBeenCalled()
  blackSquare()
})
