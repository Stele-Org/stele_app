// @vitest-environment jsdom
import { act, StrictMode, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { Prototype } from './Prototype'
vi.mock('../sound/use-stella-sound', () => ({ useStellaSound: () => {} }))
vi.mock('../voice/use-screen-narration', () => ({ useScreenNarration: () => {} }))
import { PRODUCT_ENTRY_MS } from './product-entry'
import { RING_CUE_MS, SCREEN_EXIT_CUE_MS } from './ring-cue'

// Exercise the real product selection and BrandSplash; GPU and service are outside this check.
vi.mock('../../components/RingScene', () => ({ RingScene: ({ children }: { children: ReactNode }) => <div>{children}</div> }))
vi.mock('../../service', () => ({ markServiceReady: async () => {}, useServicePlaying: () => true }))

let root: Root, host: HTMLDivElement, style: HTMLStyleElement

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('BroadcastChannel', undefined)
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })))
  style = document.createElement('style')
  style.textContent = '.prototype-viewport { padding: 0px; }'
  document.head.append(style)
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  act(() => root.render(<StrictMode><Prototype /></StrictMode>))
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
  style.remove()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('takes actual VK selection through its logo splash before showing the instructions', () => {
  expect(host.querySelector('main')?.getAttribute('data-screen')).toBe('home')
  const select = host.querySelector<HTMLButtonElement>('button[aria-label="VK Видео"]')!
  expect(select).not.toBeNull()
  act(() => select.click())
  // Leaving the start screen takes the longer cue: the screen fades out before the splash.
  expect(SCREEN_EXIT_CUE_MS).toBe(2 * RING_CUE_MS)
  act(() => vi.advanceTimersByTime(SCREEN_EXIT_CUE_MS - 1))
  expect(host.querySelector('main')?.getAttribute('data-screen')).toBe('home')
  expect(select.getAttribute('data-active')).toBe('true')
  act(() => vi.advanceTimersByTime(1))

  const splash = host.querySelector('.brand-splash[data-product="vk-video"]')
  expect(splash).not.toBeNull()
  expect(splash?.querySelector('img')?.getAttribute('alt')).toBe('VK Видео')
  expect(host.querySelector('.screen--onboarding')).toBeNull()
  expect(host.querySelector('.onboarding-start')).toBeNull()
  expect(host.querySelector('.stella-product-header')).toBeNull()

  act(() => vi.advanceTimersByTime(PRODUCT_ENTRY_MS - 1))
  expect(host.querySelector('.brand-splash')).toBe(splash)
  expect(host.querySelector('.screen--onboarding')).toBeNull()
  act(() => vi.advanceTimersByTime(1))
  expect(host.querySelector('.brand-splash')).toBeNull()
  expect(host.querySelector('main')?.getAttribute('data-screen')).toBe('vk-onboarding')
  expect(host.querySelector('.onboarding-start')).not.toBeNull()
  expect(host.querySelector('.stella-product-header img')?.getAttribute('alt')).toBe('VK Видео')
  expect(host.querySelector('#onboarding-title')?.textContent).toContain('Исследуй мир')
})
