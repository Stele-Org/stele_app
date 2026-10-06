import { useState, type ReactNode } from 'react'
import './content-ready.css'

/**
 * Test builds only (test-build.ts). A browser keeps a page silent until the visitor has pressed something, and on
 * the start screen a press on a product logo gives the greeting up. A tester opens a link, so the application
 * starts behind one press: the greeting can then sound as soon as the start screen appears.
 */
export function TestStart({ children }: { children: ReactNode }) {
  const [started, setStarted] = useState(false)
  if (started) return children
  return <main className="content-loading">
    <div className="content-loading__panel">
      <h1>Стела · тестовая версия</h1>
      <p>Понадобятся камера и звук. Браузер спросит разрешение на камеру.</p>
      <button onClick={() => setStarted(true)}>Начать</button>
    </div>
  </main>
}
