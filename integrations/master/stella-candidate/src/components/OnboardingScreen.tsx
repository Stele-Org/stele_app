import { onboardingCopy, onboardingIntroductions } from '../content/onboarding'
import type { Product } from '../types/prototype'
import { BackButton } from './BackButton'
import { ProductMark } from './ProductMark'
import { RingTag } from './RingTag'


interface OnboardingScreenProps {
  product: Product
  onStart: () => void
  onBack: () => void
  showProductMark?: boolean
  voiceEnabled?: boolean
}

export function OnboardingScreen({ product, onStart, onBack, showProductMark = true, voiceEnabled = true }: OnboardingScreenProps) {
  const introduction = onboardingIntroductions[product]
  const [voiceIntroduction, voiceExample] = onboardingCopy.voice.split(' Скажи, ')
  // VK Видео follows STELLA Onboard.png: a lower-case start button stands alone, without voice or touch hints
  // and without a back button.
  const extras = product !== 'vk-video'
  return (
    <section className="screen screen--onboarding" aria-labelledby="onboarding-title">
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
        <RingTag tone={product === 'max' ? 'violet' : 'red'} className="primary-button onboarding-start" onClick={onStart}>
          {product === 'vk-video' ? 'начать' : onboardingCopy.start}
        </RingTag>
      </div>
      {extras && <BackButton product={product} onClick={onBack} />}
    </section>
  )
}
