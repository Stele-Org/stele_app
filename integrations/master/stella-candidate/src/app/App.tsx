import { CameraSessionProvider } from '../components/CameraSession'
import { ContentReady } from './ContentReady'
import { PrototypePage } from '../pages/PrototypePage'
import { MasterShell } from '../features/master/MasterShell'

export function App() {
  return <CameraSessionProvider><ContentReady>{new URLSearchParams(window.location.search).get('master') === '1' ? <MasterShell /> : <PrototypePage />}</ContentReady></CameraSessionProvider>
}
