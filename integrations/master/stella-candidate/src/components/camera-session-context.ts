import { createContext, useContext } from 'react'

export type CameraStatus = 'requesting' | 'ready' | 'denied' | 'unavailable'
export interface CameraSession { stream: MediaStream | null; status: CameraStatus; requestAccess?: () => void }
export const CameraSessionContext = createContext<CameraSession>({ stream: null, status: 'unavailable' })
export const useCameraSession = () => useContext(CameraSessionContext)
