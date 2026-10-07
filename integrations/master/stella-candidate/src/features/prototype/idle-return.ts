import { useEffect, useEffectEvent } from 'react'
import type { ScreenState } from './Prototype'

/** A screen with buttons waits this long for the visitor after its line, then the scenario returns to the start
 * screen (user request, 08.10.2026). */
export const IDLE_RETURN_MS = 30000
/** A line that has not been spoken to its end by then is not waited for any longer: the voice is silent. */
export const LINE_WAIT_MS = 30000

/** Screens that wait for a press as long as it takes. The start screen is where the return leads; the camera prompt
 * and the last VK screen leave by their own timers (timed-transition.ts); the rest show something and go on. */
export function waitsForVisitor(screen: ScreenState): boolean {
  switch (screen.type) {
    case 'vk-onboarding':
    case 'max-onboarding':
    case 'vk-question':
    case 'max-audience':
    case 'max-goal':
    case 'vk-digitize':
    case 'vk-gender':
    case 'vk-photo-review':
    case 'max-result': return true
    default: return false
  }
}

// What counts as the visitor acting: a touch, a key, a turn of the wheel, a scroll of the consent text, and a press
// of a button, which is also how an answer given by voice arrives.
const ACTIONS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll', 'click'] as const

/**
 * Calls `onIdle` when the visitor has done nothing for IDLE_RETURN_MS on a screen that waits for them.
 * The count starts when the line of the screen has been spoken (`spoken`; a screen without a line has it at once)
 * and starts again with every action. `screen` is the screen object: a new screen is a new wait.
 * A pause of the scenario (`active` false) stops the count, and the wait is whole again afterwards.
 */
export function useIdleReturn({ screen, active, spoken, onIdle }: {
  screen: ScreenState; active: boolean; spoken: boolean; onIdle: () => void
}) {
  const idle = useEffectEvent(onIdle)
  useEffect(() => {
    if (!active) return
    const wait = spoken ? IDLE_RETURN_MS : LINE_WAIT_MS + IDLE_RETURN_MS
    let last = performance.now()
    let timer = 0
    // An action only notes its time: the timer looks at it when it runs out and waits for the rest.
    const acted = () => { last = performance.now() }
    const check = () => {
      const left = last + wait - performance.now()
      if (left <= 0) idle()
      else timer = window.setTimeout(check, left)
    }
    timer = window.setTimeout(check, wait)
    for (const action of ACTIONS) window.addEventListener(action, acted, { capture: true, passive: true })
    return () => {
      window.clearTimeout(timer)
      for (const action of ACTIONS) window.removeEventListener(action, acted, { capture: true })
    }
  }, [screen, active, spoken])
}
