import { useEffect, useLayoutEffect, useRef } from 'react'
import { acceptedSoundAction } from './sfx-events'
import { createStellaSound, type SoundContext } from './stella-sound'

export function useStellaSound(options: Omit<SoundContext, 'hidden'>) {
  const current = useRef(options)
  const { screen, playing, blocked } = options
  useLayoutEffect(() => { current.current = { screen, playing, blocked } }, [screen, playing, blocked])
  const player = useRef<ReturnType<typeof createStellaSound> | null>(null)
  useEffect(() => {
    const sound = createStellaSound(`${import.meta.env.BASE_URL}sound/stella/`)
    player.current = sound
    const synchronize = () => sound.setContext({ ...current.current, hidden: document.hidden })
    const accepted = (event: Event) => {
      synchronize()
      sound.acceptedAction((event as CustomEvent<{ manual: boolean }>).detail.manual)
    }
    const unlock = () => sound.retryUnlock()
    window.addEventListener(acceptedSoundAction, accepted)
    window.addEventListener('pointerup', unlock)
    document.addEventListener('visibilitychange', synchronize)
    synchronize()
    return () => {
      window.removeEventListener(acceptedSoundAction, accepted)
      window.removeEventListener('pointerup', unlock)
      document.removeEventListener('visibilitychange', synchronize)
      sound.dispose()
      if (player.current === sound) player.current = null
    }
  }, [])
  useEffect(() => {
    player.current?.setContext({ screen, playing, blocked, hidden: document.hidden })
  }, [screen, playing, blocked])
}
