import type { MasterState, Snapshot } from './slice-client.mjs'

/** Presentation policy only; commands still use the master's advertised options. */
export function bypassPhoto(state: MasterState | null | undefined): boolean {
  const answer = state?.answers?.[2]?.answerId
  return answer === 'familiar' || answer === 'new' || answer === 'popular'
}

export function automaticPhotoSkip(snapshot: Snapshot | null): string | null {
  if (!snapshot?.canAct || snapshot.session?.state?.screen !== 'photochoice'
    || !bypassPhoto(snapshot.session.state)) return null
  const skip = snapshot.session.view?.options.find(option => option.id === 'skip')
  return skip?.id ?? null
}

export function discoveryStage(snapshot: Snapshot | null): 'activation' | 'generation' {
  const state = snapshot?.session?.state
  if (bypassPhoto(state) || state?.photo?.choice === 'skip') return 'activation'
  if (snapshot?.session?.view?.discoveryVisual === 'activation') return 'activation'
  return state?.photo?.referenceAssetId ? 'generation' : 'activation'
}

export interface DiscoveryHold {
  sessionId: string
  instanceKey?: string
  stage: 'activation' | 'generation'
  done: boolean
}

/** Finish the visible seven-second renderer even if an older master sends final early. */
export function nextDiscoveryHold(previous: DiscoveryHold | null, snapshot: Snapshot): DiscoveryHold | null {
  const state = snapshot.session?.state
  if (!snapshot.fresh) return previous
  if (!state || state.protocol !== 'stella-vk-v1') return null
  const matching = previous?.sessionId === state.sessionId && previous.instanceKey === snapshot.health?.instanceKey
  const current = snapshot.station?.sessionId === state.sessionId
  if (current && ['active', 'paused'].includes(state.phase) && state.screen === 'particles') {
    return matching ? previous : { sessionId: state.sessionId, instanceKey: snapshot.health?.instanceKey, stage: discoveryStage(snapshot), done: false }
  }
  if (matching && state.phase === 'completed' && (current || !snapshot.station?.sessionId)) return previous
  return null
}
