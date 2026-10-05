import maxLogo from '../../../DESIGN/BRANDS/MAX/assets/logos/max-primary-white.svg'
import vkVideoLogo from '../../../DESIGN/BRANDS/vk-video/assets/logos/vk-video-primary-white.svg'
import maxMono from '../../../DESIGN/BRANDS/MAX/assets/logos/max-mono-white.svg'
import videoMono from '../../../DESIGN/BRANDS/vk-video/assets/logos/vk-video-mono-white.svg'
import maxSymbol from '../../../DESIGN/BRANDS/MAX/assets/logos/max-symbol-color.svg'
import videoSymbol from '../../../DESIGN/BRANDS/vk-video/assets/logos/vk-video-symbol-color.svg'
import type { Product } from '../types/prototype'

interface ProductMarkProps {
  product: Product
  monochrome?: boolean
  symbol?: boolean
}

export function ProductMark({ product, monochrome = false, symbol = false }: ProductMarkProps) {
  const isVideo = product === 'vk-video'

  return (
    <div className={`product-mark product-mark--${product}`}>
      <img
        className="product-mark__image"
        src={symbol ? isVideo ? videoSymbol : maxSymbol : isVideo ? monochrome ? videoMono : vkVideoLogo : monochrome ? maxMono : maxLogo}
        alt={isVideo ? 'VK Видео' : 'MAX'}
      />
    </div>
  )
}
