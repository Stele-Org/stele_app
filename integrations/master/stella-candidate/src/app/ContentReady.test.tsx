// @vitest-environment jsdom
import { act, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ContentReady } from './ContentReady'
import { App } from './App'

const store = vi.hoisted(() => ({
  status: { phase: 'idle', completed: 0, total: 3, failed: [] as string[] },
  listeners: new Set<() => void>(),
  preload: vi.fn(() => Promise.resolve()),
}))
vi.mock('./preloadImages', () => ({
  getContentStatus: () => store.status,
  subscribeContent: (listener: () => void) => { store.listeners.add(listener); return () => store.listeners.delete(listener) },
  preloadContent: store.preload,
}))
vi.mock('../features/diagnostics/journal', () => ({ trace: vi.fn() }))
vi.mock('../pages/PrototypePage', () => ({ PrototypePage: () => <h1>Главная Стеллы</h1> }))

let root: Root, host: HTMLDivElement
function update(phase: string, completed = 0) {
  act(() => {
    store.status = { phase, completed, total: 3, failed: phase === 'error' ? ['/missing.svg'] : [] }
    store.listeners.forEach(listener => listener())
  })
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  store.status = { phase: 'idle', completed: 0, total: 3, failed: [] }
  store.preload.mockClear()
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('withholds screen interactions until content is ready, including StrictMode startup', async () => {
  await act(async () => root.render(<StrictMode><ContentReady><button>Начать</button></ContentReady></StrictMode>))
  expect(host.querySelector('button')).toBeNull()
  expect(host.textContent).toContain('Загружено 0 из 3')
  update('loading', 2)
  expect(host.querySelector('progress')?.value).toBe(2)
  update('ready', 3)
  expect(host.querySelector('button')?.textContent).toBe('Начать')
  expect(host.querySelector('progress')).toBeNull()
})

it('keeps the screen gated after failure and exposes an explicit retry', async () => {
  await act(async () => root.render(<ContentReady><button>Начать</button></ContentReady>))
  update('error', 3)
  expect(host.textContent).toContain('Не удалось загрузить контент')
  expect(host.querySelector('main')?.getAttribute('aria-busy')).toBe('false')
  const calls = store.preload.mock.calls.length
  act(() => host.querySelector('button')!.click())
  expect(store.preload).toHaveBeenCalledTimes(calls + 1)
  expect(host.textContent).not.toContain('Начать')
})

it('preserves the stand startup camera and reuses its video-only stream through the content gate and home', async () => {
  const track = { readyState: 'live', stop: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() }
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] }
  const request = vi.fn().mockResolvedValue(stream); vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: request } })
  await act(async () => root.render(<StrictMode><App /></StrictMode>))
  expect(request).toHaveBeenCalledExactlyOnceWith({ video: { facingMode: 'user' }, audio: false })
  expect(host.textContent).not.toContain('Главная Стеллы')
  update('ready', 3)
  expect(host.textContent).toContain('Главная Стеллы')
  expect(request).toHaveBeenCalledOnce()
  expect(track.stop).not.toHaveBeenCalled()
})
