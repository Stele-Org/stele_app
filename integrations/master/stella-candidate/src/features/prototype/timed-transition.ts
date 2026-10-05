import type { ScreenState } from './Prototype'
import { tagPresentation } from './tag-reveal'

/** Non-renderer dwell times; Discovery advances on its visible timeline completion. */
export function timedTransition(screen: ScreenState): { duration: number; next: ScreenState } | null {
  if (tagPresentation(screen)) return null
  switch (screen.type) {
    case 'max-answer-reveal':
    case 'vk-answer-reveal':
    case 'vk-photo-reveal': return { duration: 650, next: screen.next }
    case 'vk-camera': return { duration: 1800, next: { type: 'vk-scanning', themes: screen.themes } }
    case 'vk-final': return { duration: 20000, next: { type: 'home' } }
    default: return null
  }
}
