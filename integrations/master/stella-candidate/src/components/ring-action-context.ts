import { createContext, useContext } from 'react'

export const RingActionContext = createContext<{
  busy: boolean
  enabled: boolean
  active: string | null
  run: (action: () => void, navigation: boolean, id: string) => boolean
}>({ busy: false, enabled: true, active: null, run: action => { action(); return true } })

export function useRingActions() { return useContext(RingActionContext) }
