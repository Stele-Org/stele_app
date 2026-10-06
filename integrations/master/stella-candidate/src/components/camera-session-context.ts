import { createContext, useContext } from 'react'

export type CameraStatus = 'requesting' | 'ready' | 'denied' | 'unavailable'
export interface CameraSession {
  stream: MediaStream | null; status: CameraStatus; requestAccess?: () => void
  /** The camera stands upright (a developer's own, `?camera=any`): the stand's BRIO is mounted sideways and its picture is turned. */
  upright?: boolean
}
export const CameraSessionContext = createContext<CameraSession>({ stream: null, status: 'unavailable' })
export const useCameraSession = () => useContext(CameraSessionContext)
