import videoLogo from '../../../DESIGN/BRANDS/vk-video/assets/logos/vk-video-primary-white.svg'
import maxLogo from '../../../DESIGN/BRANDS/MAX/assets/logos/max-primary-white.svg'
import videoMono from '../../../DESIGN/BRANDS/vk-video/assets/logos/vk-video-mono-white.svg'
import maxMono from '../../../DESIGN/BRANDS/MAX/assets/logos/max-mono-white.svg'
import videoSymbol from '../../../DESIGN/BRANDS/vk-video/assets/logos/vk-video-symbol-color.svg'
import maxSymbol from '../../../DESIGN/BRANDS/MAX/assets/logos/max-symbol-color.svg'
import homeVideo from '../assets/ux-reference/home-vk-video.svg'
import homeMax from '../assets/ux-reference/home-max.svg'
import cameraBorder from '../assets/ux-reference/vk-camera-discovery-border.svg'
import camera from '../assets/ux-reference/vk-new-camera.svg'
import silhouette from '../assets/ux-reference/vk-new-silhouette.svg'
import qr from '../assets/ux-reference/vk-new-qr.svg'
import maxCta from '../assets/ux-reference/max-cta.svg'
import { referenceCards } from '../components/ux-artwork'
import { optionArtwork } from '../components/question-artwork'

// Use the same Vite URLs as the screens/CSS: no duplicate fetch/blob URL layer.
export const contentImages = [...new Set([
  homeVideo, homeMax, videoLogo, maxLogo, maxSymbol, videoSymbol, videoMono, maxMono,
  ...Object.values(referenceCards), ...Object.values(optionArtwork),
  camera, cameraBorder, silhouette, qr, maxCta,
])]

export const contentFonts = [
  '400 16px "VK Sans Display"', '600 16px "VK Sans Display"', '700 16px "VK Sans Display"',
  '400 16px "VK Sans Text"', '500 16px "VK Sans Text"', '600 16px "VK Sans Text"',
  '400 16px "Max Sans"',
]
