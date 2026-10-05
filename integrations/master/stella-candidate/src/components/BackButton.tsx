import { ArrowLeft } from 'lucide-react'
import { RingTag } from './RingTag'
import type { Product } from '../types/prototype'

interface BackButtonProps {
  onClick: () => void
  product?: Product
}

export function BackButton({ onClick, product = 'vk-video' }: BackButtonProps) {
  return (
    <RingTag navigation tone={product === 'max' ? 'cyan' : 'blue'}
      className="back-button"
      aria-label="Назад"
      onClick={onClick}
    >
      <ArrowLeft aria-hidden="true" /> Назад
    </RingTag>
  )
}
