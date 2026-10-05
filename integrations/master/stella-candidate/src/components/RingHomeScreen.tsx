import { onboardingCopy } from '../content/onboarding'
import type { Product } from '../types/prototype'
import { RingTag } from './RingTag'
import './ring-home-marks.css'
import vkHomeLogo from '../assets/ux-reference/home-vk-video.svg'
import maxHomeLogo from '../assets/ux-reference/home-max.svg'

export function RingHomeScreen({ onSelect, exitCueMs }: { onSelect: (product: Product) => void; exitCueMs?: number }) {
  return (
    <section className="screen screen--home" aria-labelledby="home-title">
      <div className="home-intro" data-lc-influence="shadow" data-lc-strength="0.35"><h1 id="home-title">{onboardingCopy.homeQuestion}</h1></div>
      {/* No LumiCells shadow under the logos: the field stays visible behind them. The click pulse remains. */}
      <div className="home-choices">
        <RingTag tone="red" shadowStrength={0} cueMs={exitCueMs} className="product-tag product-tag--vk-video" aria-label="VK Видео" onClick={() => onSelect('vk-video')}>
          <div className="product-mark product-mark--vk-video"><img className="product-mark__image" src={vkHomeLogo} alt="VK Видео" /></div>
        </RingTag>
        <RingTag tone="violet" shadowStrength={0} cueMs={exitCueMs} className="product-tag product-tag--max" aria-label="MAX" onClick={() => onSelect('max')}>
          <div className="product-mark product-mark--max"><img className="product-mark__image" src={maxHomeLogo} alt="MAX" /></div>
        </RingTag>
      </div>
    </section>
  )
}