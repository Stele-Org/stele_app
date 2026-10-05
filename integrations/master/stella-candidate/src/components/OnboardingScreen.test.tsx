// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { OnboardingScreen } from './OnboardingScreen'
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
      expect(host.querySelector('.onboarding-start')?.textContent).toBe('Начать')
    } else {
      expect(host.querySelector('.onboarding-voice-example')?.textContent).toBe('Скажи, например, «поехали»')
      expect(host.querySelector('.onboarding-voice')?.textContent).toBe(onboardingCopy.voice)
      expect(host.querySelector('.onboarding-touch')?.textContent).toBe(onboardingCopy.touch)
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
    expect(html).toContain('Начать')
  })

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
