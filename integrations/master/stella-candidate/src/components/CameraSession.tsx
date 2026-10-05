import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { cameraDevices, cameraDiagnostic, cameraError, cameraTrack } from './camera-diagnostics'
import { CameraSessionContext, type CameraSession } from './camera-session-context'

/** One application-owned video-only stream; screens only attach previews. */
export function CameraSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<CameraSession>({ stream: null, status: 'requesting' })
  const requester = useRef<() => void>(() => {})
  const requestAccess = useCallback(() => requester.current(), [])
  useEffect(() => {
    cameraDiagnostic('session.init', { secureContext: window.isSecureContext, mediaDevices: !!navigator.mediaDevices, getUserMedia: !!navigator.mediaDevices?.getUserMedia, visibility: document.visibilityState })
    let disposed = false
    let epoch = 0
    let pending = false
    let pendingDiagnostic: number | undefined
    let pageActive = true
    let resumeRequested = false
    let stream: MediaStream | null = null
    let detachEnded: (() => void) | undefined
    const release = () => {
      window.clearTimeout(pendingDiagnostic)
      if (stream) cameraDiagnostic('session.release', { tracks: stream.getVideoTracks().map(cameraTrack) })
      epoch += 1
      detachEnded?.(); detachEnded = undefined
      stream?.getTracks().forEach(track => track.stop())
      stream = null
    }
    const update = (value: CameraSession) => {
      if (disposed) return
      setSession(value)
    }
    const start = () => {
      if (disposed || !pageActive || pending || stream) return
      release()
      if (disposed) return
      if (!navigator.mediaDevices?.getUserMedia || !navigator.mediaDevices?.enumerateDevices) { cameraDiagnostic('request.unavailable'); update({ stream: null, status: 'unavailable' }); return }
      update({ stream: null, status: 'requesting' })
      pending = true
      const requestEpoch = epoch
      const current = () => !disposed && requestEpoch === epoch
      const started = performance.now()
      const elapsed = () => Math.round(performance.now() - started)
      cameraDiagnostic('selection.start', { epoch: requestEpoch, policy: 'unique-brio-exact' })
      const slowRequest = pendingDiagnostic = window.setTimeout(() => { if (current() && pending) cameraDiagnostic('request.pending', { epoch: requestEpoch, elapsedMs: elapsed() }) }, 10000)
      const capture = async () => {
        const devices = await navigator.mediaDevices.enumerateDevices()
        if (!current()) { cameraDiagnostic('selection.stale', { epoch: requestEpoch }); return null }
        const cameras = devices.filter(device => device.kind === 'videoinput')
        const candidates = cameras.filter(device => /\bbrio\b/i.test(device.label) && !/\bndi\b|newtek|virtual/i.test(device.label))
        if (candidates.length !== 1 || !candidates[0].deviceId) {
          const reason = candidates.length > 1 ? 'ambiguous' : candidates.length === 1 ? 'missing-device-id' : cameras.some(device => !device.label) ? 'labels-unavailable' : 'brio-not-found'
          cameraDiagnostic('selection.unavailable', { epoch: requestEpoch, reason, cameraCount: cameras.length, candidateCount: candidates.length, labels: cameras.slice(0, 32).map(device => device.label.slice(0, 120)) })
          throw new DOMException(`BRIO selection failed: ${reason}`, 'NotFoundError')
        }
        const selected = candidates[0]
        cameraDiagnostic('selection.selected', { epoch: requestEpoch, label: selected.label.slice(0, 120), vendorConfirmed: /logitech|046d/i.test(selected.label), policy: 'unique-brio-exact' })
        cameraDiagnostic('request.start', { epoch: requestEpoch, elapsedMs: elapsed(), constraints: { video: { deviceId: { exact: '[selected-brio]' } }, audio: false } })
        return navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: selected.deviceId } }, audio: false })
      }
      void capture().then(acquired => {
        if (!acquired) return
        cameraDiagnostic('request.success', { epoch: requestEpoch, elapsedMs: elapsed(), stale: !current(), tracks: acquired.getVideoTracks().map(cameraTrack) })
        if (!current()) { acquired.getTracks().forEach(track => track.stop()); return }
        void cameraDevices('after-permission')
        stream = acquired
        const tracks = acquired.getVideoTracks()
        if (!tracks.length || tracks.some(track => track.readyState === 'ended')) {
          release(); update({ stream: null, status: 'unavailable' }); return
        }
        const ended = () => {
          cameraDiagnostic('track.ended', { tracks: tracks.map(cameraTrack), epoch: requestEpoch })
          if (!current()) return
          release(); update({ stream: null, status: 'unavailable' })
        }
        const muted = () => cameraDiagnostic('track.mute', { tracks: tracks.map(cameraTrack), epoch: requestEpoch })
        const unmuted = () => cameraDiagnostic('track.unmute', { tracks: tracks.map(cameraTrack), epoch: requestEpoch })
        tracks.forEach(track => { track.addEventListener('ended', ended); track.addEventListener('mute', muted); track.addEventListener('unmute', unmuted) })
        detachEnded = () => tracks.forEach(track => { track.removeEventListener('ended', ended); track.removeEventListener('mute', muted); track.removeEventListener('unmute', unmuted) })
        update({ stream, status: 'ready' })
      }).catch(error => {
        cameraDiagnostic('request.error', { epoch: requestEpoch, elapsedMs: elapsed(), stale: !current(), ...cameraError(error) })
        if (!current()) return
        release()
        update({ stream: null, status: error instanceof DOMException
          && ['NotAllowedError', 'SecurityError'].includes(error.name) ? 'denied' : 'unavailable' })
      }).finally(() => {
        window.clearTimeout(slowRequest)
        pending = false
        if (resumeRequested) { resumeRequested = false; start() }
      })
    }
    requester.current = start
    // Skip StrictMode's discarded mount before requesting browser permission.
    queueMicrotask(() => { if (!disposed) start() })
    const leave = () => { cameraDiagnostic('page.hide'); pageActive = false; resumeRequested = false; release(); update({ stream: null, status: 'unavailable' }) }
    const restore = (event: PageTransitionEvent) => {
      cameraDiagnostic('page.show', { persisted: event.persisted })
      if (!event.persisted) return
      pageActive = true
      if (pending) resumeRequested = true
      else start()
    }
    const deviceChange = () => { cameraDiagnostic('devices.change'); void cameraDevices('devicechange') }
    navigator.mediaDevices?.addEventListener?.('devicechange', deviceChange)
    window.addEventListener('pagehide', leave)
    window.addEventListener('pageshow', restore)
    return () => {
      cameraDiagnostic('session.dispose')
      navigator.mediaDevices?.removeEventListener?.('devicechange', deviceChange)
      requester.current = () => {}
      disposed = true; release()
      window.removeEventListener('pagehide', leave)
      window.removeEventListener('pageshow', restore)
    }
  }, [])
  return <CameraSessionContext.Provider value={{ ...session, requestAccess }}>{children}</CameraSessionContext.Provider>
}
