import { useSyncExternalStore } from 'react'

let playing = true
const listeners = new Set<() => void>()
if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('service') === '1') {
  let cancelled = false
  window.addEventListener('stella-service-pointer-cancel', () => { cancelled = true })
  window.addEventListener('pointerdown', () => { cancelled = false }, true)
  window.addEventListener('click', event => {
    if (!playing || cancelled) { event.preventDefault(); event.stopImmediatePropagation() }
  }, true)
  window.addEventListener('message', event => {
    if (event.source !== parent || event.origin !== location.origin ||
        event.data?.type !== 'stella-service-state' || typeof event.data.playing !== 'boolean') return
    playing = event.data.playing
    document.documentElement.dataset.servicePaused = String(!playing)
    listeners.forEach(listener => listener())
  })
}
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
export const useServicePlaying = () => useSyncExternalStore(subscribe, () => playing, () => true)

export async function markServiceReady() {
  await document.fonts.ready
  await Promise.all(Array.from(document.images, img => img.decode().catch(() => {})))
  // The worker separately waits for lc-ready (a successfully rendered GPU frame).
  document.documentElement.dataset.serviceReady = 'true'
}
