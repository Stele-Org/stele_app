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
        {voiceEnabled && <p className="onboarding-voice">
          {voiceIntroduction}{' '}
          <span className="onboarding-voice-example">{product === 'vk-video' ? 'Скажи, например, «ПОЕХАЛИ»' : `Скажи, ${voiceExample}`}</span>
        </p>}
        <p className="onboarding-touch">{onboardingCopy.touch}</p>
        <RingTag tone={product === 'max' ? 'violet' : 'red'} className="primary-button onboarding-start" onClick={onStart}>
          {product === 'vk-video' ? 'Начать' : onboardingCopy.start}
        </RingTag>
      </div>
      <BackButton product={product} onClick={onBack} />
    </section>
  )
}
