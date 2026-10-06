import { useCallback, useEffect, useRef, useState } from 'react'
import { cameraDiagnostic, cameraError } from '../../components/camera-diagnostics'
import { useCameraSession } from '../../components/camera-session-context'
import { capturePhoto } from '../master/camera-capture'
import type { ApprovedPhoto } from './photo-storage-client'

/** The scan runs 7 s and its silhouette stands fully drawn from 2.2 to 4.8 s: the frame is taken in the middle of that. */
export const SCAN_SHOT_MS = 3500

/**
 * While the visitor watches the scan, one frame of the application's camera is photographed for the check that
 * follows it (user request, 06.10.2026). The encoder is the stand's own (`capturePhoto`), so the frame is turned
 * for the sideways BRIO and left as it comes for an upright camera.
 * The page keeps the photo in memory only, shown through an object URL, and `discard` releases it; what happens to
 * an approved photo is up to the caller (`held`). Without a ready camera, or when the frame fails, there is simply
 * no photo and the scenario goes on as before.
 */
export function useScanPhoto(scanning: boolean) {
  const { stream, status, upright } = useCameraSession()
  const [url, setUrl] = useState<string | null>(null)
  const photo = useRef<(ApprovedPhoto & { url: string }) | null>(null)
  const replace = useCallback((next: (ApprovedPhoto & { url: string }) | null) => {
    if (photo.current) URL.revokeObjectURL(photo.current.url)
    photo.current = next
    setUrl(next?.url ?? null)
  }, [])

  useEffect(() => {
    if (!scanning || status !== 'ready' || !stream) return
    const controller = new AbortController()
    // A view of the shared stream that is never shown: it only has to hold a current frame at the moment of the shot.
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.srcObject = stream
    void Promise.resolve().then(() => video.play()).catch(() => { /* A frame that never comes is reported by the shot. */ })
    const timer = window.setTimeout(() => {
      capturePhoto(video, controller.signal, upright).then(blob => {
        if (controller.signal.aborted) return
        cameraDiagnostic('scan-photo.taken', { bytes: blob.size, upright: !!upright })
        // One id per photograph: storing the same photo twice is then recognised as a repeat.
        replace({ blob, captureId: crypto.randomUUID(), upright: !!upright, url: URL.createObjectURL(blob) })
      }).catch(error => {
        if (!controller.signal.aborted) cameraDiagnostic('scan-photo.error', cameraError(error))
      })
    }, SCAN_SHOT_MS)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
      video.pause()
      video.srcObject = null
    }
  }, [scanning, stream, status, upright, replace])

  const taken = useCallback(() => photo.current !== null, [])
  /** The photograph itself, for the caller that keeps an approved one. */
  const held = useCallback((): ApprovedPhoto | null => photo.current && { blob: photo.current.blob, captureId: photo.current.captureId, upright: photo.current.upright }, [])
  const discard = useCallback(() => replace(null), [replace])
  return { url, taken, held, discard }
}
