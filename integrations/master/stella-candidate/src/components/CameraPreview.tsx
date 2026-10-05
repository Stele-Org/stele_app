import { useEffect, useRef, useState, type RefObject } from 'react'
import { cameraDiagnostic, cameraError, cameraVideo } from './camera-diagnostics'
import { useCameraSession } from './camera-session-context'
import discoveryBorder from '../assets/ux-reference/vk-camera-discovery-border.svg'
import './camera-preview.css'

/** A view of the application-owned camera; detaching never stops its tracks. */
export function CameraPreview({ active, captureRef }: { active: boolean; captureRef?: RefObject<HTMLVideoElement | null> }) {
  const internalRef = useRef<HTMLVideoElement>(null)
  const videoRef = captureRef ?? internalRef
  const { stream, status } = useCameraSession()
  const [failedStream, setFailedStream] = useState<MediaStream | null>(null)
  useEffect(() => {
    const video = videoRef.current
    if (!video || !stream || !active) return
    let current = true
    let frameCallback: number | undefined
    let firstFrame = false
    const start = performance.now()
    const reportFrame = (source: string) => {
      if (!current || firstFrame) return
      firstFrame = true
      cameraDiagnostic('preview.first-frame', { source, elapsedMs: Math.round(performance.now() - start), ...cameraVideo(video) })
    }
    const events = ['loadedmetadata', 'playing', 'stalled', 'error', 'loadeddata'] as const
    const onEvent = (event: Event) => {
      cameraDiagnostic(`preview.${event.type}`, cameraVideo(video))
      // Older engines expose readiness only, not a compositor frame callback.
      if (!video.requestVideoFrameCallback && ['playing', 'loadeddata'].includes(event.type) && video.readyState >= 2) reportFrame('media-ready-fallback')
    }
    events.forEach(event => video.addEventListener(event, onEvent))
    cameraDiagnostic('preview.attach', cameraVideo(video))
    video.srcObject = stream
    if (video.requestVideoFrameCallback) frameCallback = video.requestVideoFrameCallback(() => reportFrame('video-frame-callback'))
    const slowFrame = window.setTimeout(() => { if (current && !firstFrame) cameraDiagnostic('preview.no-first-frame', { elapsedMs: Math.round(performance.now() - start), ...cameraVideo(video) }) }, 10000)
    void video.play().then(() => { if (current) setFailedStream(null) })
      .catch(error => { cameraDiagnostic('preview.play-error', { ...cameraError(error), ...cameraVideo(video) }); if (current) setFailedStream(stream) })
    return () => {
      current = false
      window.clearTimeout(slowFrame)
      if (frameCallback !== undefined) video.cancelVideoFrameCallback?.(frameCallback)
      events.forEach(event => video.removeEventListener(event, onEvent))
      cameraDiagnostic('preview.detach', cameraVideo(video))
      video.pause(); video.srcObject = null
    }
  }, [active, stream, videoRef])
  const previewStatus = stream && failedStream === stream ? 'unavailable' : status
  const message = previewStatus === 'requesting' || previewStatus === 'denied' ? 'Разреши доступ к камере'
    : previewStatus === 'unavailable' ? 'Камера недоступна' : null
  return <div className="camera-preview" data-camera-status={previewStatus}>
    <video ref={videoRef} className="camera-preview__video" muted playsInline aria-hidden="true" />
    <img className="camera-preview__discovery" src={discoveryBorder} alt="" aria-hidden="true" draggable={false} />
    {message && <span className="camera-preview__status" role="status">{message}</span>}
  </div>
}
