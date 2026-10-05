export const RING_CUE_MS = 260
/** A longer cue for taps that leave a whole screen: it covers the 480ms fade of that screen. */
export const SCREEN_EXIT_CUE_MS = 520

/** One action per visible phase. Navigation/unmount cancels it; pause freezes its cue. */
export class RingCue {
  private action: (() => void) | null = null
  private remaining = RING_CUE_MS
  private started = 0
  private timer: ReturnType<typeof setTimeout> | null = null
  private playing = true
  private disposed = false

  choose(action: () => void, reducedMotion: boolean, duration = RING_CUE_MS) {
    if (this.disposed || !this.playing || this.action) return false
    this.action = action
    this.remaining = reducedMotion ? 0 : duration
    this.arm()
    return true
  }

  navigate(action: () => void) {
    if (this.disposed || !this.playing) return false
    this.dispose()
    action()
    return true
  }

  setPlaying(playing: boolean) {
    if (this.disposed || this.playing === playing) return
    this.playing = playing
    if (playing) this.arm()
    else this.suspend()
  }

  dispose() { this.suspend(); this.action = null; this.disposed = true }

  private suspend() {
    if (this.timer === null) return
    clearTimeout(this.timer)
    this.timer = null
    this.remaining = Math.max(0, this.remaining - (performance.now() - this.started))
  }

  private arm() {
    if (this.disposed || !this.playing || !this.action || this.timer !== null) return
    this.started = performance.now()
    this.timer = setTimeout(() => {
      this.timer = null
      if (this.disposed || !this.playing || !this.action) return
      const action = this.action
      this.action = null
      this.disposed = true
      action()
    }, this.remaining)
  }
}
