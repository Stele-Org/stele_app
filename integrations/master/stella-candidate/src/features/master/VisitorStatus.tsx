/** Operator tools are available only in an explicit development session. */
export const operatorToolsEnabled = () => import.meta.env.DEV && new URLSearchParams(window.location.search).get('operator') === '1'

export function VisitorStatus({ fault, pending, paused, refresh, retry }: {
  fault: boolean; pending: boolean; paused: boolean; refresh: () => void; retry?: () => void
}) {
  if (!fault && !pending && !paused) return null
  return <aside className="master-visitor-status" aria-label="Состояние Стеллы">
    <p role="status">{pending ? 'Подтверждаем ваш выбор…' : paused ? 'Небольшая пауза. Скоро продолжим.' : 'Не удалось продолжить. Проверяем соединение.'}</p>
    {fault && <button type="button" onClick={refresh}>Проверить соединение</button>}
    {retry && <button type="button" onClick={retry}>Повторить попытку</button>}
  </aside>
}
