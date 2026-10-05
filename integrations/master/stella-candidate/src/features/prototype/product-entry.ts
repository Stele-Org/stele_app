import type { Product } from '../../types/prototype'

export const PRODUCT_ENTRY_MS = 1200

/** One confirmed choice; a service pause freezes the remaining visual cue. */
export class ProductEntry {
  private product: Product | null = null
  private remaining = PRODUCT_ENTRY_MS
  private started = 0
  private timer: ReturnType<typeof setTimeout> | null = null
  private playing = true
  private disposed = false

  constructor(private readonly commit: (product: Product) => void) {}

  choose(product: Product, reducedMotion: boolean): boolean {
    if (this.disposed || !this.playing || this.product !== null) return false
    this.product = product
    this.remaining = reducedMotion ? 0 : PRODUCT_ENTRY_MS
    this.arm()
    return true
  }

  setPlaying(playing: boolean) {
    if (this.playing === playing || this.disposed) return
    this.playing = playing
    if (playing) this.arm()
    else this.suspend()
  }

  dispose() {
    this.suspend()
    this.disposed = true
  }

  private suspend() {
    if (this.timer === null) return
    clearTimeout(this.timer)
    this.timer = null
    this.remaining = Math.max(0, this.remaining - (performance.now() - this.started))
  }

  private arm() {
    if (this.disposed || !this.playing || this.product === null || this.timer !== null) return
    this.started = performance.now()
    this.timer = setTimeout(() => {
      this.timer = null
      if (this.disposed || !this.playing || this.product === null) return
      this.disposed = true
      this.commit(this.product)
    }, this.remaining)
  }
}
