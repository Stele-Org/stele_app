// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { OnboardingScreen } from './OnboardingScreen'
import { RingActionContext } from './ring-action-context'
import { Prototype } from '../features/prototype/Prototype'
import { onboardingCopy, onboardingIntroductions } from '../content/onboarding'

describe('onboarding presentation', () => {
  it.each(['max', 'vk-video'] as const)('preserves approved %s copy without a microphone; VK Видео shows no voice or touch hint', (product) => {
    const html = renderToStaticMarkup(<OnboardingScreen product={product} onStart={() => {}} onBack={() => {}} />)
    const host = document.createElement('div')
    host.innerHTML = html
    expect(html).toContain(onboardingIntroductions[product].title)
    if (product === 'vk-video') {
      // STELLA Onboard.png: only the start button below the steps.
      expect(host.querySelector('.onboarding-voice')).toBeNull()
      expect(host.querySelector('.onboarding-touch')).toBeNull()
      expect(html).not.toContain(onboardingCopy.touch)
      expect(host.querySelector('.onboarding-start')?.textContent).toBe('начать')
      expect(host.querySelector('.back-button')).toBeNull()
    } else {
      expect(host.querySelector('.onboarding-voice-example')?.textContent).toBe('Скажи, например, «поехали»')
      expect(host.querySelector('.onboarding-voice')?.textContent).toBe(onboardingCopy.voice)
      expect(host.querySelector('.onboarding-touch')?.textContent).toBe(onboardingCopy.touch)
      expect(host.querySelector('.back-button')).not.toBeNull()
    }
    for (const step of onboardingIntroductions[product].steps) expect(html).toContain(step)
    expect(html).not.toContain(onboardingCopy.spokenGreeting)
    expect(html).not.toContain('lucide-mic')
    expect(html).not.toContain('vk-onboarding-art')
    expect(html).toContain('data-lc-pulse="click"')
  })

  it('keeps the VK server mode free of voice and touch hints', () => {
    const html = renderToStaticMarkup(<OnboardingScreen product="vk-video" voiceEnabled={false} onStart={() => {}} onBack={() => {}} />)
    expect(html).not.toContain('onboarding-voice')
    expect(html).not.toContain(onboardingCopy.touch)
    expect(html).toContain('>начать<')
  })

  it('brings the field shadow of the start button in with it and takes it away when the local scenario fades the screen out', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    const host = document.createElement('div'), root = createRoot(host)
    document.body.append(host)
    const render = (busy: boolean, exitCueMs?: number) => act(async () => root.render(
      <RingActionContext.Provider value={{ busy, enabled: true, active: null, run: () => true }}>
        <OnboardingScreen product="vk-video" exitCueMs={exitCueMs} onStart={() => {}} onBack={() => {}} />
      </RingActionContext.Provider>))
    const wait = (ms: number) => act(async () => { await new Promise(resolve => setTimeout(resolve, ms)) })
    const strength = (selector: string) => host.querySelector(selector)!.getAttribute('data-lc-strength')
    try {
      // The server mode keeps the screen while MASTER answers: an accepted tap does not take the shadow away.
      await render(true)
      // Still transparent: neither the button nor the title hides the background yet.
      expect(strength('.onboarding-start')).toBe('0')
      expect(strength('h1')).toBe('0')
      await wait(640 + 1120 + 150)
      expect(strength('.onboarding-start')).toBe('1')
      expect(strength('h1')).toBe('0.4')
      // The local scenario fades the screen out during the tap cue, and the shadows go with it.
      await render(true, 520)
      expect(strength('.onboarding-start')).toBe('1')
      await wait(520)
      expect(strength('.onboarding-start')).toBe('0')
      expect(strength('h1')).toBe('0')
    } finally {
      act(() => root.unmount())
      host.remove()
      vi.unstubAllGlobals()
    }
  }, 10000)

  it('opens a new session on the question and two logos, not onboarding', () => {
    const html = renderToStaticMarkup(<Prototype />)
    expect(html).toContain(onboardingCopy.homeQuestion)
    expect(html).toContain('aria-label="VK Видео"')
    expect(html).toContain('aria-label="MAX"')
    expect(html).toContain('<lumi-cells')
    expect(html).toContain('preset="reference"')
    expect(html.match(/data-lc-pulse="click"/g)).toHaveLength(2)
    expect(html).toContain('home-choices')
    expect(html).not.toContain('onboarding-steps')
    expect(html).not.toContain(onboardingCopy.start)
    expect(html).not.toContain('speech-toggle')
    expect(html).not.toContain('speech-error')
    expect(html).not.toContain('Включить озвучку')
  })
})
