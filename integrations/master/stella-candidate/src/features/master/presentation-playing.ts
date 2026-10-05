import { useLayoutEffect, useState } from 'react'

type PresentationSnapshot = {
  online: boolean; fresh: boolean; error: unknown; storageError: unknown; pending: unknown
  station?: { sessionId: string | null } | null
}
function explicitStop(snapshot: PresentationSnapshot | null) {
  const pending = snapshot?.pending as { payload?: { kind?: string } } | null
  return pending?.payload?.kind === 'pause' || pending?.payload?.kind === 'cancel'
}

/** Input authority remains in the pinned client. An in-flight write does not revoke
 * the already accepted presentation; errors/offline and explicit stops still do. */
export function presentationPlaying(hostPlaying: boolean, snapshot: PresentationSnapshot | null,
  state?: { sessionId: string; phase: string } | null): boolean {
  if (!hostPlaying || !snapshot?.online || snapshot.error || snapshot.storageError) return false
  if (state && ['paused', 'cancelled', 'expired'].includes(state.phase)) return false
  if (explicitStop(snapshot)) return false
  return snapshot.fresh || Boolean(state && snapshot.station?.sessionId === state.sessionId)
}

export function usePresentationPlaying(hostPlaying: boolean, snapshot: PresentationSnapshot | null,
  state?: { sessionId: string; phase: string } | null) {
  const [stopping, setStopping] = useState(false)
  const stop = explicitStop(snapshot)
  const fresh = snapshot?.fresh === true
  useLayoutEffect(() => {
    // ACK clears pending before refresh publishes phase. Do not briefly resume
    // in that gap after an explicit pause/cancel.
    if (stop) setStopping(true)
    else if (fresh) setStopping(false)
  }, [stop, fresh])
  return presentationPlaying(hostPlaying, snapshot, state) && !(stopping && !fresh)
}
