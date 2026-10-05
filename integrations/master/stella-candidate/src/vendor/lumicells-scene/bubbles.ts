// Structural mount contract from the upstream bubbles.tsx; UI is supplied by Stella.
import type { SceneItem } from './layout'
import type { BubbleInfo } from './types'
export type BubbleEntry = {
  item: SceneItem
  el: HTMLElement
  info: () => BubbleInfo
  resetHover: () => void
}
