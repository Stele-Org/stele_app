// @vitest-environment jsdom
import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { App } from './App'
import { CameraPreview } from '../components/CameraPreview'
import { AnswerFlight } from '../components/AnswerFlight'
import { MasterCamera } from '../features/master/MasterCamera'
import type { TagReveal } from '../features/prototype/tag-reveal'
const view = vi.hoisted(() => ({ content: null as ReactNode }))
vi.mock('../features/master/MasterShell', () => ({ MasterShell: () => view.content }))
vi.mock('../pages/PrototypePage', () => ({ PrototypePage: () => null }))
vi.mock('./ContentReady', () => ({ ContentReady: ({ children }: { children: ReactNode }) => children }))
// Exercise real answer DOM; native tag choreography has independent tests.
vi.mock('../vendor/lumicells-scene/choreography', () => ({ Choreographer: class {
  revealOnce() { return Promise.resolve() }
  setPlaying() {}
  dispose() {}
} }))
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); window.history.replaceState({}, '', '/') })
it('requests at home once and shares capture across master phases', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  const track = Object.assign(new EventTarget(), { stop: vi.fn(), readyState: 'live' })
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream
  const request = vi.fn().mockResolvedValue(stream)
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: request } })
  window.history.replaceState({}, '', '/stella/?master=1')
  const host = document.createElement('div'); document.body.append(host)
  const root = createRoot(host)
  const render = async (content: ReactNode) => { view.content = content; await act(async () => root.render(<App />)) }
  try {
    await render(<h1>Home</h1>); expect(request).toHaveBeenCalledOnce()
    await render(<CameraPreview active />)
    expect(host.querySelector('video')!.srcObject).toBe(stream)
    const reveal = { product: 'vk-video', label: 'Hero', batches: [['hero', 'film']],
      answerCard: { index: 2, tone: 'blue', artworkId: 'hero' } } as TagReveal
    await render(<AnswerFlight reveal={reveal} playing onComplete={() => {}} />)
    const video = host.querySelector('video')!
    expect(video.srcObject).toBe(stream)
    expect(host.querySelector('.camera-preview__discovery')).not.toBeNull()
    expect(host.querySelector('.answer-flight__answer')!.textContent).toContain('Hero')
    await render(<AnswerFlight reveal={reveal} playing={false} onComplete={() => {}} />)
    expect(video.srcObject).toBeNull(); expect(track.stop).not.toHaveBeenCalled()
    await render(<AnswerFlight reveal={reveal} playing onComplete={() => {}} />)
    expect(video.srcObject).toBe(stream)
    await render(<MasterCamera fence={{ sessionId: 's', revision: 4, screen: 'camera' }} enabled upload={vi.fn()} skip={() => {}} />)
    expect(host.querySelector('video')!.srcObject).toBe(stream)
    expect(request).toHaveBeenCalledOnce(); expect(track.stop).not.toHaveBeenCalled()
    await render(<h1>Done</h1>); expect(track.stop).not.toHaveBeenCalled()
    await act(async () => root.render(null)); expect(track.stop).toHaveBeenCalledOnce()
  } finally { act(() => root.unmount()); host.remove() }
})
