import { useEffect, useSyncExternalStore, type ReactNode } from 'react'
import { getContentStatus, preloadContent, subscribeContent } from './preloadImages'
import './content-ready.css'

export function ContentReady({ children }: { children: ReactNode }) {
  const status = useSyncExternalStore(subscribeContent, getContentStatus)
  useEffect(() => { void preloadContent() }, [])
  if (status.phase === 'ready') return children
  const failed = status.phase === 'error'
  return <main className="content-loading" aria-busy={!failed}>
    <div className="content-loading__panel">
      <h1>{failed ? 'Не удалось загрузить контент' : 'Подготавливаем Стеллу'}</h1>
      <p role="status">{failed ? 'Проверь соединение и повтори загрузку.' : `Загружено ${status.completed} из ${status.total}`}</p>
      {!failed && <progress aria-label="Загрузка контента" max={status.total} value={status.completed} />}
      {failed && <button onClick={() => { void preloadContent() }}>Повторить загрузку</button>}
    </div>
  </main>
}
