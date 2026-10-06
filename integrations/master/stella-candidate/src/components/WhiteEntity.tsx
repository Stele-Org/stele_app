import { useLayoutEffect, useRef, useState } from 'react'
import { animate, type AnimationPlaybackControls } from 'motion'
import { useReducedMotion } from 'motion/react'
import { createWhiteEntityRenderer } from './white-entity-renderer'
import { whiteEntityCenters, whiteEntityFeather, type WhiteEntityStage } from './white-entity-envelope'
import { DiscoveryNetwork } from './DiscoveryNetwork'

type Stage = WhiteEntityStage
type Props = {
  playing: boolean; stage?: Stage; preview?: boolean; onComplete?: () => void; silhouetteSrc?: string
  /** Undefined preserves the scenario timeline. Boolean holds/reverses the same radial envelope. */
  generationDurationSeconds?: number
  /** An accepted cue resets the timeline without rebuilding the GPU renderer. */
  cueKey?: string
  controlledActive?: boolean
  onHidden?: () => void
  onError?: () => void
}

const emptyMask = 'linear-gradient(transparent, transparent)'
const fullMask = 'linear-gradient(black, black)'

/** CSS paints the same radial front over the full-resolution silhouette. */
function silhouetteMask(reveal: number, erase: number) {
  if (reveal <= 0 || erase >= 1) return emptyMask
  if (reveal >= 1 && erase <= 0) return fullMask
  const [cx, cy] = whiteEntityCenters.scan
  const maximumRadius = Math.hypot(540, Math.max(cy, 1920 - cy))
  const radius = (erase > 0 ? erase : reveal) * (maximumRadius + whiteEntityFeather)
  const inner = Math.max(0, radius - whiteEntityFeather) / maximumRadius * 100
  const outer = radius / maximumRadius * 100
  const colors = erase > 0 ? ['transparent', 'black'] : ['black', 'transparent']
  return `radial-gradient(circle farthest-corner at ${cx / 1080 * 100}% ${cy / 1920 * 100}%, ${colors[0]} ${inner}%, ${colors[1]} ${outer}%)`
}

/**
 * Scan keeps the LumiCells field with the visitor's silhouette. The recommendation stages show the
 * Claude Design «пульс + нейросеть» scene, which owns its authored 23.06-second timeline.
 */
export function WhiteEntity(props: Props) {
  const stage = props.stage ?? 'scan'
  if (stage === 'scan' || props.controlledActive !== undefined) return <WhiteEntityField {...props} />
  return <DiscoveryNetwork playing={props.playing} loop={props.preview} cueKey={props.cueKey ?? stage} onComplete={props.onComplete} />
}

/** One native field; Motion drives the authored contour's circular ramp. */
export function WhiteEntityField({ playing, stage = 'scan', preview = false, onComplete, silhouetteSrc, controlledActive, onHidden, onError, generationDurationSeconds = 7, cueKey }: Props) {
  const layer = useRef<HTMLCanvasElement>(null)
  const silhouette = useRef<HTMLImageElement>(null)
  const [loadedSilhouette, setLoadedSilhouette] = useState<string>()
  const silhouetteReady = stage !== 'scan' || !silhouetteSrc || loadedSilhouette === silhouetteSrc
  const renderer = useRef<ReturnType<typeof createWhiteEntityRenderer> | null>(null)
  const animation = useRef<AnimationPlaybackControls | null>(null)
  const playingRef = useRef(false)
  const reducedRef = useRef(false)
  const failedRef = useRef(false)
  const completeRef = useRef(onComplete)
  const errorRef = useRef(onError)
  const hiddenRef = useRef(onHidden)
  const controlledRef = useRef(controlledActive)
  const hiddenReported = useRef(false)
  const envelope = useRef({ reveal: 0, erase: 0 })
  const [ready, setReady] = useState(false)
  const completedCue = useRef<string | null>(null)
  const automaticCue = cueKey ?? stage
  useLayoutEffect(() => { completedCue.current = null }, [automaticCue])
  const reducedMotion = useReducedMotion()

  useLayoutEffect(() => { completeRef.current = onComplete }, [onComplete])
  useLayoutEffect(() => { errorRef.current = onError }, [onError])
  useLayoutEffect(() => {
    hiddenRef.current = onHidden
    controlledRef.current = controlledActive
    if (controlledActive) hiddenReported.current = false
  }, [onHidden, controlledActive])
  useLayoutEffect(() => {
    playingRef.current = playing
    reducedRef.current = !!reducedMotion
    const sync = () => {
      const active = playingRef.current && !document.hidden && !failedRef.current
      const visible = controlledRef.current === undefined || !hiddenReported.current
      renderer.current?.setPlaying(active && visible && !reducedRef.current)
      if (active) animation.current?.play()
      else animation.current?.pause()
    }
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [playing, reducedMotion, controlledActive])

  useLayoutEffect(() => {
    const canvas = layer.current!
    let live = true
    failedRef.current = false
    canvas.dataset.state = 'loading'
    const failed = (error: unknown) => {
      if (!live) return
      failedRef.current = true
      errorRef.current?.()
      canvas.dataset.state = 'error'
      animation.current?.stop()
      animation.current = null
      renderer.current?.setPlaying(false)
      renderer.current?.dispose()
      renderer.current = null
      // A failed renderer is already invisible. It must not strand a requested exit.
      if (controlledRef.current === false && !hiddenReported.current) {
        hiddenReported.current = true
        hiddenRef.current?.()
      }
      console.error('[Stella Discovery]', error)
    }
    try {
      const instance = createWhiteEntityRenderer(canvas, {
        onReady: () => {
          if (!live || failedRef.current) return
          canvas.dataset.state = 'ready'
          setReady(true)
        },
        onError: failed,
      })
      renderer.current = instance
      instance.setPlaying(playingRef.current && !reducedRef.current && !document.hidden)
      const resize = () => {
        const { width, height } = canvas.getBoundingClientRect()
        if (width > 0 && height > 0) instance.resize(width, height)
      }
      const observer = new ResizeObserver(resize)
      observer.observe(canvas)
      resize()
      return () => {
        live = false
        observer.disconnect()
        animation.current?.stop()
        animation.current = null
        if (renderer.current === instance) {
          instance.dispose()
          renderer.current = null
        }
      }
    } catch (error) {
      failed(error)
      return () => { live = false }
    }
  }, [])

  useLayoutEffect(() => {
    if (controlledActive !== undefined) return
    if (!ready || !silhouetteReady || failedRef.current || !renderer.current) return
    if (!preview && completedCue.current === automaticCue) return
    const instance = renderer.current
    const canvas = layer.current!
    let live = true
    const updateSilhouette = (reveal: number, erase: number) => {
      if (silhouette.current) silhouette.current.style.maskImage = silhouetteMask(reveal, erase)
    }
    instance.setEnvelope(stage, reducedMotion ? 1 : 0, 0)
    envelope.current = { reveal: reducedMotion ? 1 : 0, erase: 0 }
    updateSilhouette(reducedMotion ? 1 : 0, 0)
    canvas.dataset.phase = reducedMotion ? 'hold' : 'reveal'
    const controls = animate(0, [0, 1, 1, 2], {
      duration: stage === 'scan' ? 7 : generationDurationSeconds,
      times: [0, 0.32, 0.68, 1], ease: 'easeInOut',
      repeat: preview ? Infinity : 0, repeatDelay: 0.35,
      onUpdate: value => {
        if (!live || failedRef.current) return
        if (!reducedMotion) {
          envelope.current = { reveal: Math.min(value, 1), erase: Math.max(value - 1, 0) }
          instance.setEnvelope(stage, envelope.current.reveal, envelope.current.erase)
        }
        if (!reducedMotion) updateSilhouette(Math.min(value, 1), Math.max(value - 1, 0))
        canvas.dataset.phase = reducedMotion ? 'hold' : value < 1 ? 'reveal' : value > 1 ? 'erase' : 'hold'
      },
      onComplete: () => {
        if (!live || failedRef.current || preview || completedCue.current === automaticCue) return
        completedCue.current = automaticCue
        instance.setEnvelope(stage, 1, 1)
        envelope.current = { reveal: 1, erase: 1 }
        updateSilhouette(1, 1)
        completeRef.current?.()
      },
    })
    animation.current = controls
    if (!playingRef.current || document.hidden) controls.pause()
    return () => {
      live = false
      controls.stop()
      if (animation.current === controls) animation.current = null
    }
  }, [ready, stage, preview, reducedMotion, silhouetteReady, controlledActive, generationDurationSeconds, automaticCue])

  useLayoutEffect(() => {
    if (controlledActive === undefined) return
    const canvas = layer.current!
    const notifyHidden = () => {
      if (controlledRef.current !== false || hiddenReported.current) return
      hiddenReported.current = true
      canvas.dataset.phase = 'hidden'
      renderer.current?.setPlaying(false)
      hiddenRef.current?.()
    }
    // No frame was shown yet (or the GPU failed), so there is no erase to await.
    if (!ready || failedRef.current || !renderer.current) {
      if (!controlledActive) notifyHidden()
      return
    }
    if (!silhouetteReady) return
    const instance = renderer.current
    let live = true
    const apply = (reveal: number, erase: number) => {
      envelope.current = { reveal, erase }
      instance.setEnvelope(stage, reveal, erase)
      if (silhouette.current) silhouette.current.style.maskImage = silhouetteMask(reveal, erase)
    }
    if (!controlledActive && (envelope.current.reveal === 0 || envelope.current.erase === 1)) {
      apply(0, 0)
      notifyHidden()
      return
    }
    // A fully erased frame can restart its centre-out reveal without a visible reset.
    if (controlledActive && envelope.current.erase === 1) apply(0, 0)
    const from = { ...envelope.current }
    const target = controlledActive ? { reveal: 1, erase: 0 } : { reveal: from.reveal, erase: 1 }
    const distance = Math.max(Math.abs(target.reveal - from.reveal), Math.abs(target.erase - from.erase))
    canvas.dataset.phase = controlledActive ? distance === 0 ? 'hold' : 'reveal' : 'erase'
    instance.setPlaying(playingRef.current && !document.hidden && !reducedMotion)
    if (distance === 0) return
    const controls = animate(0, 1, {
      // Retain the authored scan/generation front speed; no new contour or field algorithm.
      duration: reducedMotion ? 0.001 : (stage === 'scan' ? 5.2 : 6) * 0.32 * distance,
      ease: 'easeInOut',
      onUpdate: value => {
        if (!live || failedRef.current) return
        if (!reducedMotion) apply(from.reveal + (target.reveal - from.reveal) * value, from.erase + (target.erase - from.erase) * value)
      },
      onComplete: () => {
        if (!live || failedRef.current) return
        if (controlledActive) {
          apply(1, 0)
          canvas.dataset.phase = 'hold'
        } else {
          apply(0, 0)
          notifyHidden()
        }
        if (animation.current === controls) animation.current = null
      },
    })
    animation.current = controls
    if (!playingRef.current || document.hidden) controls.pause()
    return () => {
      live = false
      controls.stop()
      if (animation.current === controls) animation.current = null
    }
  }, [ready, stage, controlledActive, reducedMotion, silhouetteReady])

  return <>
    {stage === 'scan' && silhouetteSrc && <img ref={silhouette} className="vk-processing-art"
      src={silhouetteSrc} alt="" aria-hidden="true" draggable={false}
      style={{ maskImage: emptyMask }}
      onLoad={event => {
        const image = event.currentTarget
        void image.decode().then(() => {
          if (silhouette.current === image) setLoadedSilhouette(silhouetteSrc)
        }).catch(() => {
          if (silhouette.current !== image) return
          image.style.visibility = 'hidden'
          setLoadedSilhouette(silhouetteSrc)
          console.warn('[Stella Discovery] Silhouette decode failed')
        })
      }}
      onError={event => {
        event.currentTarget.style.visibility = 'hidden'
        setLoadedSilhouette(silhouetteSrc)
        console.warn('[Stella Discovery] Silhouette asset unavailable')
      }} />}
    <canvas ref={layer} className="vk-white-entity" data-state="loading" data-stage={stage} aria-hidden="true" />
  </>
}
