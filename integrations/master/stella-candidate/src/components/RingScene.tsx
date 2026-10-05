import { useLayoutEffect, useRef, type ReactNode } from 'react'
import 'lumicells/element/define'
import type { LumiCellsElement } from 'lumicells/element'
import type { Product } from '../types/prototype'
import { ringSceneConfig, type RingPhase } from './ring-scene-config'

interface RingSceneProps {
  playing: boolean
  product: Product | null
  phase: RingPhase
  scale: number
  children: ReactNode
}

/** A single persistent original renderer for every Stella screen. */
export function RingScene({ playing, product, phase, scale, children }: RingSceneProps) {
  const ring = useRef<LumiCellsElement>(null)
  useLayoutEffect(() => {
    const element = ring.current
    if (!element) return
    const root = document.documentElement
    root.dataset.stellaRenderer = 'ring'
    root.dataset.stellaRingState = 'loading'
    const ready = () => { root.dataset.stellaRingState = 'ready' }
    const failed = () => { root.dataset.stellaRingState = 'error' }
    element.addEventListener('lc-ready', ready)
    element.addEventListener('lc-error', failed)
    element.addEventListener('lc-fallback', failed)
    return () => {
      element.removeEventListener('lc-ready', ready)
      element.removeEventListener('lc-error', failed)
      element.removeEventListener('lc-fallback', failed)
      delete root.dataset.stellaRingState
      delete root.dataset.stellaRenderer
    }
  }, [])
  useLayoutEffect(() => {
    const element = ring.current
    if (!element) return
    element.transition = 380
    element.config = ringSceneConfig(phase, product)
  }, [phase, product])
  useLayoutEffect(() => { if (ring.current) ring.current.paused = !playing }, [playing])

  return (
    <lumi-cells ref={ring} preset="reference" className="ring-scene" data-product={product ?? 'entry'} data-phase={phase}>
      <div className="stella-content" style={{ transform: `scale(${scale})` }}>{children}</div>
    </lumi-cells>
  )
}
