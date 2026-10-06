// @vitest-environment jsdom
import { act, StrictMode, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { Prototype } from './Prototype'
vi.mock('../sound/use-stella-sound', () => ({ useStellaSound: () => {} }))
vi.mock('../voice/use-screen-narration', () => ({ useScreenNarration: () => {} }))
import type { TagReveal } from './tag-reveal'

// Preserve the real screen tree and Motion transitions; isolate GPU and external services.
vi.mock('../../components/RingScene', () => ({ RingScene: ({ children }: { children: ReactNode }) => <div data-background-host>{children}</div> }))
vi.mock('../../service', () => ({ markServiceReady: async () => {}, useServicePlaying: () => true }))
vi.mock('../../components/WhiteEntity', () => ({ WhiteEntity: ({ onComplete }: { onComplete?: () => void }) =>
  <button data-discovery-complete onClick={onComplete}>Complete Discovery stage</button>,
}))
const flight = vi.hoisted(() => ({ current: null as null | {
  reveal: TagReveal
  embedded?: boolean
  onFinalExit?: (reveal: TagReveal) => void
  onComplete: (reveal: TagReveal) => void
} }))
vi.mock('../../components/AnswerFlight', () => ({ AnswerFlight: (props: NonNullable<typeof flight.current>) => {
  flight.current = props
  return null
} }))

let root: Root, host: HTMLDivElement, style: HTMLStyleElement
const settle = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 110)) })

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('BroadcastChannel', undefined)
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })))
  flight.current = null
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
  vi.unstubAllGlobals()
})

it('retains the same VK logo and background host from onboarding through the final screen', async () => {
  const background = host.querySelector('[data-background-host]')
  expect(background).not.toBeNull()
  const click = async (selector: string) => {
    const button = host.querySelector<HTMLButtonElement>(selector)
    expect(button, selector).not.toBeNull()
    expect(button!.disabled, selector).toBe(false)
    act(() => button!.click())
    await settle()
  }

  await click('[aria-label="VK Видео"]')
  await settle() // Reduced-motion splash completes on its own zero-delay timer.
  const header = host.querySelector('.stella-product-header')
  const logo = host.querySelector<HTMLImageElement>('.stella-product-header img')
  const actions = host.querySelector('main')
  expect(header).not.toBeNull()
  expect(logo).not.toBeNull()
  expect(actions).not.toBeNull()
  expect(logo!.alt).toBe('VK Видео')
  const source = logo!.getAttribute('src')
  const retained = (screen: string) => {
    expect(host.querySelector('main')).toBe(actions)
    expect(host.querySelector('main')?.getAttribute('data-screen')).toBe(screen)
    expect(host.querySelector('.stella-product-header')).toBe(header)
    expect(host.querySelector('.stella-product-header img')).toBe(logo)
    expect(logo!.getAttribute('src')).toBe(source)
    expect(logo!.isConnected).toBe(true)
    expect(host.querySelector('[data-background-host]')).toBe(background)
    // The persistent brand mark is the only standalone VK logo in the screen tree.
    expect(host.querySelectorAll('.product-mark--vk-video img')).toHaveLength(1)
  }
  const finishAnswer = async () => {
    const current = flight.current!
    expect(current).not.toBeNull()
    if (current.embedded) {
      act(() => current.onFinalExit!(current.reveal))
      await settle()
    }
    act(() => current.onComplete(current.reveal))
    await settle()
  }

  retained('vk-onboarding')
  await click('.onboarding-start')
  retained('vk-question')
  for (const answer of ['series', 'heroes', 'hero']) {
    await click(`[data-option-id="${answer}"]`)
    expect(host.querySelector('.stella-product-header img')).toBe(logo)
    await finishAnswer()
    retained(answer === 'hero' ? 'vk-digitize' : 'vk-question')
  }
  await click('[data-option-id="accept"]')
  // The photo answer has no tag scene: the camera prompt follows its 650 ms cue.
  retained('vk-photo-reveal')
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 650)) })
  retained('vk-camera')
  await click('.vk-camera-button')
  retained('vk-scanning')
  await click('[data-discovery-complete]')
  retained('vk-particles')
  await click('[data-discovery-complete]')
  retained('vk-final')
}, 10000)
