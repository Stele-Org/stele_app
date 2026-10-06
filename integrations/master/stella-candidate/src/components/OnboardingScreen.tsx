import { useLayoutEffect, useRef } from 'react'
import { onboardingCopy, onboardingIntroductions } from '../content/onboarding'
import { ARRIVE_EASE, ARRIVE_MS } from '../features/prototype/arrival'
import type { Product } from '../types/prototype'
import { BackButton } from './BackButton'
import { animateFieldShadow } from './field-shadow'
import { useRingActions } from './ring-action-context'
import { ProductMark } from './ProductMark'
import { RingTag } from './RingTag'


interface OnboardingScreenProps {
  product: Product
  onStart: () => void
  onBack: () => void
  showProductMark?: boolean
  voiceEnabled?: boolean
  /** The local scenario fades the screen out before leaving it and lengthens the tap cue to match. */
  exitCueMs?: number
}

// When each part that casts a shadow into the cell field arrives and leaves: the delays and durations of `soft-arrive`
// and of the leaving transitions of this screen in global.css.
const arrivalDelayMs = (element: Element) => element.matches('.back-button') ? 800 : element.closest('.onboarding-actions') ? 640 : 0
const leaving = (element: Element) => element.matches('.back-button') ? { durationMs: 160 }
  : element.closest('.onboarding-actions') ? { durationMs: 400, delayMs: 120 } : { durationMs: 480 }

export function OnboardingScreen({ product, onStart, onBack, showProductMark = true, voiceEnabled = true, exitCueMs }: OnboardingScreenProps) {
  const section = useRef<HTMLElement>(null)
  // The local scenario fades the screen out once the start button is accepted (`exitCueMs`); the server mode keeps it.
  const { busy } = useRingActions()
  const fadingOut = exitCueMs !== undefined && busy
  // The start button and the title bring their shadows in with them and take them away when the screen fades out:
  // a button that is transparent would otherwise keep hiding the background behind it.
  useLayoutEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const cast = [...section.current!.querySelectorAll('[data-lc-influence]')]
      .map(element => ({ element, strength: Number(element.getAttribute('data-lc-strength') ?? 1) }))
    const runs = cast.map(({ element, strength }) => fadingOut
      ? animateFieldShadow(element, strength, 0, { ...leaving(element), ease: 'easeInOut' })
      : animateFieldShadow(element, 0, strength, { durationMs: ARRIVE_MS, delayMs: arrivalDelayMs(element), ease: ARRIVE_EASE }))
    return () => {
      for (const run of runs) run.stop()
      for (const { element, strength } of cast) element.setAttribute('data-lc-strength', String(strength))
    }
  }, [fadingOut])
  const introduction = onboardingIntroductions[product]
  const [voiceIntroduction, voiceExample] = onboardingCopy.voice.split(' Скажи, ')
  // VK Видео follows STELLA Onboard.png: a lower-case start button stands alone, without voice or touch hints
  // and without a back button.
  const extras = product !== 'vk-video'
  return (
    <section ref={section} className="screen screen--onboarding" aria-labelledby="onboarding-title">
      {showProductMark && <ProductMark product={product} />}
      <div className="onboarding-intro">
        <h1 id="onboarding-title" data-lc-influence="shadow" data-lc-strength="0.4">{introduction.title}</h1>
        <ol className="onboarding-steps">
          {introduction.steps.map((step, index) => (
            <li className="onboarding-step" key={step}>
              <span className="onboarding-step__label" aria-label={`Шаг ${index + 1}`}>{index + 1}</span>
              <p>{step}</p>
            </li>
          ))}
        </ol>
      </div>
      <div className="onboarding-actions">
        {extras && voiceEnabled && <p className="onboarding-voice">
          {voiceIntroduction}{' '}
          <span className="onboarding-voice-example">{`Скажи, ${voiceExample}`}</span>
        </p>}
        {extras && <p className="onboarding-touch">{onboardingCopy.touch}</p>}
        <RingTag tone={product === 'max' ? 'violet' : 'red'} cueMs={exitCueMs} className="primary-button onboarding-start" onClick={onStart}>
          {product === 'vk-video' ? 'начать' : onboardingCopy.start}
        </RingTag>
      </div>
      {extras && <BackButton product={product} onClick={onBack} />}
    </section>
  )
}
