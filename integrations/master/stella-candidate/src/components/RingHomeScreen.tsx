import { onboardingCopy } from '../content/onboarding'
import type { Product } from '../types/prototype'
import { RingTag } from './RingTag'
import { ProductMark } from './ProductMark'
import './ring-home-marks.css'
import vkHomeMark from '../assets/ux-reference/vk-new-home.svg'

export function RingHomeScreen({ onSelect }: { onSelect: (product: Product) => void }) {
  return (
    <section className="screen screen--home" aria-labelledby="home-title">
      <div className="home-intro" data-lc-influence="shadow" data-lc-strength="0.35"><h1 id="home-title">{onboardingCopy.homeQuestion}</h1></div>
      <div className="home-choices">
        <RingTag tone="red" className="product-tag" aria-label="VK Видео" onClick={() => onSelect('vk-video')}>
          <div className="product-mark product-mark--vk-video"><img className="product-mark__image" src={vkHomeMark} alt="VK Видео" /></div>
        </RingTag>
        <RingTag tone="violet" className="product-tag" aria-label="MAX" onClick={() => onSelect('max')}>
          <ProductMark product="max" symbol />
        </RingTag>
      </div>
    </section>
  )
}
