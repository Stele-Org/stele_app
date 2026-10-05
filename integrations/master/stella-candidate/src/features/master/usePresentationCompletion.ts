import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Fence } from './slice-client.mjs'

/** Visual completion may occur while a command is settling. Keep only that cue's
 * notification; the existing client still owns revision fencing and delivery. */
export function usePresentationCompletion(cueKey: string | null, fence: Fence | null,
  canComplete: boolean, complete: (fence: Fence) => void) {
  const [requested, setRequested] = useState<string | null>(null)
  const current = useRef(cueKey)
  const submitted = useRef<string | null>(null)
  const deliver = useRef(complete)
  useLayoutEffect(() => { deliver.current = complete })
  useLayoutEffect(() => {
    current.current = cueKey
    submitted.current = null
    setRequested(null)
    return () => { current.current = null }
  }, [cueKey])
  const notify = useCallback(() => {
    if (cueKey && current.current === cueKey && submitted.current !== cueKey) setRequested(cueKey)
  }, [cueKey])
  useEffect(() => {
    if (!cueKey || requested !== cueKey || current.current !== cueKey || !canComplete || !fence || submitted.current === cueKey) return
    submitted.current = cueKey
    deliver.current(fence)
  }, [cueKey, requested, canComplete, fence])
  return notify
}
