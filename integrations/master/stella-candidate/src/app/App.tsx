import { CameraSessionProvider } from '../components/CameraSession'
import { ContentReady } from './ContentReady'
import { PrototypePage } from '../pages/PrototypePage'
import { MasterShell } from '../features/master/MasterShell'
import { TestStart } from './TestStart'
import { TEST_BUILD } from './test-build'

export function App() {
  const app = <CameraSessionProvider><ContentReady>{new URLSearchParams(window.location.search).get('master') === '1' ? <MasterShell /> : <PrototypePage />}</ContentReady></CameraSessionProvider>
  return TEST_BUILD ? <TestStart>{app}</TestStart> : app
}
