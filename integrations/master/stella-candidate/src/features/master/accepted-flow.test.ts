import { expect, it } from 'vitest'
import { automaticPhotoSkip, bypassPhoto, discoveryStage, nextDiscoveryHold } from './accepted-flow'
import type { Snapshot } from './slice-client.mjs'

function photoChoice(answerId: string): Snapshot {
  return { canAct: true, session: { state: { protocol: 'stella-vk-v1', screen: 'photochoice',
    answers: [{ answerId: 'series' }, { answerId: 'drive' }, { answerId }] },
    view: { options: [{ id: 'accept', label: 'Да, давайте' }, { id: 'skip', label: 'Пропустить' }] } } } as Snapshot
}
it('offers camera only for hero and skips other known choices through an advertised server option', () => {
  for (const id of ['familiar', 'new', 'popular']) {
    const snapshot = photoChoice(id)
    expect(bypassPhoto(snapshot.session!.state)).toBe(true)
    expect(automaticPhotoSkip(snapshot)).toBe('skip')
    snapshot.canAct = false
    expect(automaticPhotoSkip(snapshot)).toBeNull()
    snapshot.canAct = true; snapshot.session!.view!.options = []
    expect(automaticPhotoSkip(snapshot)).toBeNull()
  }
  for (const id of ['hero', 'unknown-future-option']) expect(automaticPhotoSkip(photoChoice(id))).toBeNull()
})
it('uses a neutral cloud after skip and a silhouette only for an actual captured reference', () => {
  const snapshot = photoChoice('hero')
  expect(discoveryStage(snapshot)).toBe('activation')
  snapshot.session!.state!.photo = { choice: 'accept', status: 'captured', referenceAssetId: 'asset-1' }
  expect(discoveryStage(snapshot)).toBe('generation')
  snapshot.session!.state!.photo.choice = 'skip'
  expect(discoveryStage(snapshot)).toBe('activation')
  snapshot.session!.state!.photo.choice = 'accept'; snapshot.session!.view!.discoveryVisual = 'activation'
  expect(discoveryStage(snapshot)).toBe('activation')
})
it('holds only the current Discovery through an early final, and drops it on cancellation, a foreign station or restart', () => {
  const snapshot = photoChoice('familiar')
  snapshot.fresh = true; snapshot.station = { sessionId: 's' }; snapshot.health = { instanceKey: 'boot-1' }
  Object.assign(snapshot.session!.state!, { sessionId: 's', phase: 'active', screen: 'particles' })
  const hold = nextDiscoveryHold(null, snapshot)!
  expect(hold.stage).toBe('activation')
  const final = structuredClone(snapshot); final.session!.state!.phase = 'completed'; final.session!.state!.screen = 'final'
  expect(nextDiscoveryHold(hold, final)).toBe(hold)
  final.session!.state!.phase = 'cancelled'; expect(nextDiscoveryHold(hold, final)).toBeNull()
  final.session!.state!.phase = 'completed'; final.station!.sessionId = 'foreign'
  expect(nextDiscoveryHold(hold, final)).toBeNull()
  final.station!.sessionId = 's'; final.health!.instanceKey = 'boot-2'
  expect(nextDiscoveryHold(hold, final)).toBeNull()
})
