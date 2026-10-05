/** Emitted only after the existing input gate accepts an action. */
export const acceptedSoundAction = 'stella:accepted-sound-action'
let activated = false
/** Preserve the accepted entry gesture when it mounts a new product slice. */
export function hasAcceptedSoundAction() { return activated }
export function emitAcceptedSoundAction(manual: boolean) {
  activated = true
  window.dispatchEvent(new CustomEvent(acceptedSoundAction, { detail: { manual } }))
}
