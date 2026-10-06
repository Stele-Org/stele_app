import { animate, type AnimationPlaybackControls, type Easing } from 'motion'

/**
 * LumiCells shadows any element that has a box, visible or not, so an element that fades in or out has to take its
 * shadow in the cell field along: otherwise a button that is still, or already, transparent keeps hiding the field
 * behind it. Twenty steps keep the attribute mutations rare, as in TagDissolve.
 */
export function animateFieldShadow(element: Element, from: number, to: number,
  { durationMs, delayMs = 0, ease }: { durationMs: number; delayMs?: number; ease: Easing }): AnimationPlaybackControls {
  const write = (value: number) => {
    const strength = String(Math.round(value * 20) / 20)
    if (element.getAttribute('data-lc-strength') !== strength) element.setAttribute('data-lc-strength', strength)
  }
  write(from)
  return animate(from, to, { duration: durationMs / 1000, delay: delayMs / 1000, ease, onUpdate: write })
}
