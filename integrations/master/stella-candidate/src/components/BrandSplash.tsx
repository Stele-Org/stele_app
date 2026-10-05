import { useEffect, useRef } from 'react'
import { ProductEntry, PRODUCT_ENTRY_MS } from '../features/prototype/product-entry'
import type { Product } from '../types/prototype'
import { ProductMark } from './ProductMark'

/** Presentation-only phase. One timer shares the logo duration, pause and cancellation. */
export function BrandSplash({ product, playing, onComplete }: { product: Product; playing: boolean; onComplete: () => void }) {
  const entry = useRef<ProductEntry | null>(null)
  useEffect(() => {
    const cue = new ProductEntry(onComplete)
    entry.current = cue
    cue.choose(product, window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    return () => { cue.dispose(); entry.current = null }
  }, [product, onComplete])
  useEffect(() => { entry.current?.setPlaying(playing) }, [playing])
  return (
    <section className="screen brand-splash" data-product={product} role="status" aria-label={product === 'max' ? 'MAX' : 'VK Видео'}>
      <div className="brand-splash__logo" style={{ animationDuration: `${PRODUCT_ENTRY_MS}ms`, animationPlayState: playing ? 'running' : 'paused' }}>
        <ProductMark product={product} />
      </div>
    </section>
  )
}
