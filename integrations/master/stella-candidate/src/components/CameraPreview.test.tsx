// @vitest-environment jsdom
import { act, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { CameraPreview } from './CameraPreview'
import { CameraSessionProvider } from './CameraSession'
vi.mock('../features/diagnostics/journal', () => ({ trace: vi.fn() }))

function cameraStream() {
  const track = Object.assign(new EventTarget(), { stop: vi.fn(), readyState: 'live' })
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream
  return { stream, track }
}
let root: Root, host: HTMLDivElement
let request: ReturnType<typeof vi.fn<() => Promise<MediaStream>>>
let enumerate: ReturnType<typeof vi.fn<() => Promise<MediaDeviceInfo[]>>>
const brio = { kind: 'videoinput', label: 'Logitech BRIO (046d:085e)', deviceId: 'brio-device', groupId: 'brio-group' } as MediaDeviceInfo
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  request = vi.fn(() => Promise.resolve(cameraStream().stream))
  enumerate = vi.fn().mockResolvedValue([brio])
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: request, enumerateDevices: enumerate } })
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount()); host.remove(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals()
})
const screen = (preview = false, active = true) => <CameraSessionProvider>
  {preview ? <CameraPreview active={active} /> : <h1>Главная</h1>}
</CameraSessionProvider>

it('requests video at app startup with no preview, reuses the stream across screens and stops only on app unmount', async () => {
  const { stream, track } = cameraStream(); request.mockResolvedValue(stream)
  await act(async () => root.render(screen()))
  expect(request).toHaveBeenCalledExactlyOnceWith({ video: { deviceId: { exact: 'brio-device' } }, audio: false })
  await act(async () => root.render(screen(true)))
  const video = host.querySelector('video')!
  expect(video.srcObject).toBe(stream); expect(video.muted).toBe(true); expect(video.playsInline).toBe(true)
  await act(async () => root.render(screen(true, false)))
  expect(video.srcObject).toBeNull(); expect(track.stop).not.toHaveBeenCalled()
  await act(async () => root.render(screen()))
  await act(async () => root.render(screen(true)))
  expect(host.querySelector('video')!.srcObject).toBe(stream)
  expect(request).toHaveBeenCalledOnce(); expect(track.stop).not.toHaveBeenCalled()
  await act(async () => root.render(null)); expect(track.stop).toHaveBeenCalledOnce()
})

it('keeps capture running while hidden or the preview is paused', async () => {
  const { stream, track } = cameraStream(); request.mockResolvedValue(stream)
  await act(async () => root.render(screen(true)))
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
  act(() => document.dispatchEvent(new Event('visibilitychange')))
  await act(async () => root.render(screen(true, false)))
  expect(track.stop).not.toHaveBeenCalled(); expect(request).toHaveBeenCalledOnce()
  await act(async () => root.render(screen(true)))
  expect(host.querySelector('video')!.srcObject).toBe(stream)
})

it('StrictMode requests once and retains the surviving stream', async () => {
  const { stream, track } = cameraStream(); request.mockResolvedValue(stream)
  await act(async () => root.render(<StrictMode>{screen(true)}</StrictMode>))
  expect(request).toHaveBeenCalledOnce(); expect(track.stop).not.toHaveBeenCalled()
  expect(host.querySelector('video')!.srcObject).toBe(stream)
  await act(async () => root.render(null)); expect(track.stop).toHaveBeenCalledOnce()
})

it('stops a late permission result after application unmount', async () => {
  let resolve!: (stream: MediaStream) => void
  request.mockReturnValue(new Promise<MediaStream>(done => { resolve = done }))
  await act(async () => root.render(screen()))
  await act(async () => root.render(null))
  const late = cameraStream(); await act(async () => resolve(late.stream))
  expect(late.track.stop).toHaveBeenCalledOnce()
})

it('shares a pending permission request across preview changes', async () => {
  let resolve!: (stream: MediaStream) => void
  request.mockReturnValue(new Promise<MediaStream>(done => { resolve = done }))
  await act(async () => root.render(screen()))
  await act(async () => root.render(screen(true)))
  await act(async () => root.render(screen()))
  const late = cameraStream(); await act(async () => resolve(late.stream))
  expect(request).toHaveBeenCalledOnce(); expect(late.track.stop).not.toHaveBeenCalled()
  await act(async () => root.render(screen(true)))
  expect(host.querySelector('video')!.srcObject).toBe(late.stream)
})

it('shows denied/missing API without repeated permission requests on navigation', async () => {
  request.mockRejectedValue(new DOMException('Denied', 'NotAllowedError'))
  await act(async () => root.render(screen(true)))
  expect(host.textContent).toBe('Разреши доступ к камере')
  await act(async () => root.render(screen())); await act(async () => root.render(screen(true)))
  expect(request).toHaveBeenCalledOnce()
  await act(async () => root.render(null)); vi.stubGlobal('navigator', {})
  await act(async () => root.render(screen(true)))
  expect(host.textContent).toBe('Камера недоступна')
})

it('a preview play failure does not stop shared capture', async () => {
  const { stream, track } = cameraStream(); request.mockResolvedValue(stream)
  vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValue(new DOMException('Playback failed'))
  await act(async () => root.render(screen(true)))
  expect(host.textContent).toBe('Камера недоступна'); expect(track.stop).not.toHaveBeenCalled()
  await act(async () => root.render(screen()))
  vi.mocked(HTMLMediaElement.prototype.play).mockResolvedValue()
  await act(async () => root.render(screen(true)))
  expect(host.querySelector('[data-camera-status="ready"]')).not.toBeNull()
  expect(request).toHaveBeenCalledOnce()
})

it('device ended releases capture and detaches previews without a retry loop', async () => {
  const { stream, track } = cameraStream(); request.mockResolvedValue(stream)
  await act(async () => root.render(screen(true)))
  act(() => track.dispatchEvent(new Event('ended')))
  expect(track.stop).toHaveBeenCalledOnce(); expect(host.textContent).toBe('Камера недоступна')
  expect(host.querySelector('video')!.srcObject).toBeNull(); expect(request).toHaveBeenCalledOnce()
})

it('page exit releases tracks and BFCache return starts a new session', async () => {
  const first = cameraStream(), second = cameraStream()
  request.mockResolvedValueOnce(first.stream).mockResolvedValueOnce(second.stream)
  await act(async () => root.render(screen(true)))
  act(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })))
  expect(first.track.stop).toHaveBeenCalledOnce()
  await act(async () => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })))
  expect(request).toHaveBeenCalledTimes(2); expect(host.querySelector('video')!.srcObject).toBe(second.stream)
  await act(async () => root.render(null)); expect(second.track.stop).toHaveBeenCalledOnce()
})

it('BFCache restoration waits for an unresolved permission before requesting again', async () => {
  const resolves: Array<(stream: MediaStream) => void> = []
  request.mockImplementation(() => new Promise<MediaStream>(done => resolves.push(done)))
  await act(async () => root.render(screen(true)))
  act(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })))
  act(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })))
  expect(request).toHaveBeenCalledOnce()
  const stale = cameraStream(); await act(async () => resolves[0](stale.stream))
  expect(stale.track.stop).toHaveBeenCalledOnce(); expect(request).toHaveBeenCalledTimes(2)
  const live = cameraStream(); await act(async () => resolves[1](live.stream))
  expect(live.track.stop).not.toHaveBeenCalled()
  expect(host.querySelector('video')!.srcObject).toBe(live.stream)
})

function loggedEvents() {
  return vi.mocked(console.info).mock.calls.filter(call => call[0] === '[stella-camera]').map(call => JSON.parse(String(call[1])))
}
it('records capture error and pending timeout without a second capture attempt', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  let reject!: (error: unknown) => void
  request.mockReturnValue(new Promise<MediaStream>((_, fail) => { reject = fail }))
  await act(async () => root.render(screen(true)))
  await act(async () => vi.advanceTimersByTime(10000))
  expect(loggedEvents().filter(event => event.event === 'request.pending')).toHaveLength(1)
  expect(request).toHaveBeenCalledOnce()
  await act(async () => reject(new DOMException('Device could not start', 'NotReadableError')))
  expect(loggedEvents()).toContainEqual(expect.objectContaining({ event: 'request.error', name: 'NotReadableError', message: 'Device could not start' }))
})
it('records one compositor frame and cleans up without stopping shared capture', async () => {
  let callback!: VideoFrameRequestCallback
  const frame = vi.fn((next: VideoFrameRequestCallback) => { callback = next; return 17 })
  const cancel = vi.fn()
  Object.defineProperty(HTMLVideoElement.prototype, 'requestVideoFrameCallback', { configurable: true, value: frame })
  Object.defineProperty(HTMLVideoElement.prototype, 'cancelVideoFrameCallback', { configurable: true, value: cancel })
  try {
    const { stream, track } = cameraStream(); request.mockResolvedValue(stream)
    await act(async () => root.render(screen(true)))
    callback(0, {} as VideoFrameCallbackMetadata); callback(1, {} as VideoFrameCallbackMetadata)
    expect(loggedEvents().filter(event => event.event === 'preview.first-frame')).toHaveLength(1)
    const video = host.querySelector('video')!
    await act(async () => root.render(screen(true, false)))
    expect(cancel).toHaveBeenCalledWith(17)
    const count = loggedEvents().length
    video.dispatchEvent(new Event('stalled')); callback(2, {} as VideoFrameCallbackMetadata)
    expect(loggedEvents()).toHaveLength(count)
    expect(track.stop).not.toHaveBeenCalled()
  } finally {
    Reflect.deleteProperty(HTMLVideoElement.prototype, 'requestVideoFrameCallback')
    Reflect.deleteProperty(HTMLVideoElement.prototype, 'cancelVideoFrameCallback')
  }
})
it('uses local device tokens and records playback rejection', async () => {
  const enumerateDevices = vi.fn().mockResolvedValue([{ kind: 'videoinput', label: 'Logitech BRIO', deviceId: 'private-device-id', groupId: 'private-group-id' }])
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: request, enumerateDevices } })
  vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValue(new DOMException('Playback blocked', 'NotAllowedError'))
  await act(async () => root.render(screen(true)))
  const logs = loggedEvents()
  expect(logs).toContainEqual(expect.objectContaining({ event: 'preview.play-error', name: 'NotAllowedError' }))
  expect(logs).toContainEqual(expect.objectContaining({ event: 'devices.result', reason: 'after-permission', devices: [expect.objectContaining({ label: 'Logitech BRIO', device: expect.stringMatching(/^local-/) })] }))
  expect(JSON.stringify(logs)).not.toContain('private-device-id')
  expect(JSON.stringify(logs)).not.toContain('private-group-id')
})

it('selects BRIO exactly when NDI is the default first camera', async () => {
  enumerate.mockResolvedValue([{ ...brio, label: 'NewTek NDI Video', deviceId: 'ndi-default' }, brio])
  await act(async () => root.render(screen(true)))
  expect(request).toHaveBeenCalledExactlyOnceWith({ video: { deviceId: { exact: 'brio-device' } }, audio: false })
  expect(loggedEvents()).toContainEqual(expect.objectContaining({ event: 'selection.selected', label: brio.label, vendorConfirmed: true }))
})
it.each([
  ['missing', [{ ...brio, label: 'NewTek NDI Video' }]],
  ['labels hidden', [{ ...brio, label: '' }]],
  ['ambiguous', [brio, { ...brio, deviceId: 'second-brio' }]],
  ['no device ID', [{ ...brio, deviceId: '' }]],
  ['NDI BRIO label', [{ ...brio, label: 'NewTek NDI Logitech BRIO' }]],
  ['virtual BRIO label', [{ ...brio, label: 'Virtual Logitech BRIO' }]],
])('does not open a default camera if BRIO selection is %s', async (_, devices) => {
  enumerate.mockResolvedValue(devices)
  await act(async () => root.render(screen(true)))
  expect(request).not.toHaveBeenCalled()
  expect(loggedEvents()).toContainEqual(expect.objectContaining({ event: 'selection.unavailable' }))
  expect(host.querySelector('[data-camera-status="unavailable"]')).not.toBeNull()
})
it('does not capture if device enumeration completes after unmount', async () => {
  let resolve!: (devices: MediaDeviceInfo[]) => void
  enumerate.mockReturnValue(new Promise(done => { resolve = done }))
  await act(async () => root.render(screen(true)))
  await act(async () => root.render(null))
  await act(async () => resolve([brio]))
  expect(request).not.toHaveBeenCalled()
  expect(loggedEvents()).toContainEqual(expect.objectContaining({ event: 'selection.stale' }))
})
it('does not capture if enumeration fails or start a retry loop', async () => {
  enumerate.mockRejectedValue(new DOMException('Enumeration denied', 'NotAllowedError'))
  await act(async () => root.render(screen(true)))
  expect(request).not.toHaveBeenCalled()
  expect(enumerate).toHaveBeenCalledOnce()
  expect(loggedEvents()).toContainEqual(expect.objectContaining({ event: 'request.error', name: 'NotAllowedError' }))
})

// The developer's switch, dev server only (camera-policy.ts): ?camera=any opens the default camera, upright.
it('opens the default camera upright when the dev server is asked for any camera, and never without being asked', async () => {
  const webcam = { kind: 'videoinput', label: 'HD Pro Webcam C920 (046d:082d)', deviceId: 'webcam', groupId: 'webcam-group' } as MediaDeviceInfo
  enumerate.mockResolvedValue([webcam])
  // Without the switch a machine with no BRIO gets no camera and no permission prompt.
  await act(async () => root.render(screen(true)))
  expect(request).not.toHaveBeenCalled()
  expect(host.querySelector('[data-camera-status="unavailable"]')).not.toBeNull()
  expect(host.querySelector('[data-camera-mount]')).toBeNull()
  await act(async () => root.render(null))
  window.history.replaceState(null, '', '?camera=any')
  try {
    const { stream } = cameraStream(); request.mockResolvedValue(stream)
    await act(async () => root.render(screen(true)))
    expect(request).toHaveBeenCalledExactlyOnceWith({ video: true, audio: false })
    expect(host.querySelector('video')!.srcObject).toBe(stream)
    expect(host.querySelector('.camera-preview')!.getAttribute('data-camera-status')).toBe('ready')
    expect(host.querySelector('.camera-preview')!.getAttribute('data-camera-mount')).toBe('upright')
    expect(loggedEvents()).toContainEqual(expect.objectContaining({ event: 'selection.start', policy: 'any-local' }))
  } finally { window.history.replaceState(null, '', window.location.pathname) }
})
