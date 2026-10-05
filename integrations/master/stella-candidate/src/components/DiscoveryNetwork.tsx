import { useLayoutEffect, useRef } from 'react'
import { animate, type AnimationPlaybackControls } from 'motion'
import { useReducedMotion } from 'motion/react'
import { DISCOVERY_NETWORK_SECONDS, discoveryDots, paintDiscoveryNetwork } from './discovery-network'

type Props = {
  playing: boolean
  /** Development preview: the scene repeats and never completes the scenario. */
  loop?: boolean
  /** A new cue restarts the scene from its first frame. */
  cueKey: string
  onComplete?: () => void
}

/** Recommendation stage of Discovery: one Motion clock drives the authored 23.3-second canvas scene. */
export function DiscoveryNetwork({ playing, loop = false, cueKey, onComplete }: Props) {
  const layer = useRef<HTMLCanvasElement>(null)
  const clock = useRef<AnimationPlaybackControls | null>(null)
  const playingRef = useRef(playing)
  const completeRef = useRef(onComplete)
  const reducedMotion = useReducedMotion()

  useLayoutEffect(() => { completeRef.current = onComplete }, [onComplete])
  useLayoutEffect(() => {
    playingRef.current = playing
    const sync = () => {
      if (playingRef.current && !document.hidden) clock.current?.play()
      else clock.current?.pause()
    }
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [playing])

  useLayoutEffect(() => {
    const canvas = layer.current!
    const context = canvas.getContext('2d')
    const dots = discoveryDots()
    let live = true
    const paint = (time: number) => {
      if (!live || !context) return
      // The layer fills the scaled 1080 × 1920 frame; keep its backing store at device resolution, 2× at most.
      const width = Math.min(2160, Math.max(1080, Math.round(canvas.clientWidth * (window.devicePixelRatio || 1))))
      if (canvas.width !== width) { canvas.width = width; canvas.height = Math.round(width * 1920 / 1080) }
      context.setTransform(width / 1080, 0, 0, width / 1080, 0, 0)
      // Reduced motion keeps the resting pattern for the same duration.
      paintDiscoveryNetwork(context, dots, reducedMotion ? DISCOVERY_NETWORK_SECONDS : time)
    }
    paint(0)
    const controls = animate(0, DISCOVERY_NETWORK_SECONDS, {
      duration: DISCOVERY_NETWORK_SECONDS, ease: 'linear', repeat: loop ? Infinity : 0, repeatDelay: 0.35,
      onUpdate: paint,
      onComplete: () => {
        if (!live || loop) return
        paint(DISCOVERY_NETWORK_SECONDS)
        completeRef.current?.()
      },
    })
    clock.current = controls
    if (!playingRef.current || document.hidden) controls.pause()
    return () => {
      live = false
      controls.stop()
      if (clock.current === controls) clock.current = null
    }
  }, [cueKey, loop, reducedMotion])

  return <canvas ref={layer} className="vk-discovery-network" data-scene="pulse-network" aria-hidden="true" />
}
