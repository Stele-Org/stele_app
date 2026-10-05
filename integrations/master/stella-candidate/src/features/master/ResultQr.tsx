import { useEffect, useMemo, useState } from 'react'
import { buildResultQr } from './result-qr.mjs'

type Props = { packageId: string; resultPath: string; apiBase?: string }

export function ResultQr(props: Props) {
  return <BoundResultQr key={JSON.stringify([props.packageId, props.resultPath])} {...props} />
}

function BoundResultQr({ packageId, resultPath }: Props) {
  const [resultOrigin, setResultOrigin] = useState<string | null>(null)
  const [configError, setConfigError] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => { setConfigError(true); controller.abort() }, 4000)
    fetch('/stella/result-config.json', { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw Error('RESULT_ORIGIN_UNAVAILABLE')
        const config = await response.json()
        if (config.protocol !== 'result-origin-v1' || typeof config.resultOrigin !== 'string') throw Error('RESULT_ORIGIN_INVALID')
        // Validate using the same exact package/path contract before rendering the QR.
        buildResultQr(packageId, resultPath, config.resultOrigin)
        if (!controller.signal.aborted) setResultOrigin(config.resultOrigin)
      }).catch(() => { if (!controller.signal.aborted) setConfigError(true) })
      .finally(() => clearTimeout(timer))
    return () => { clearTimeout(timer); controller.abort() }
  }, [packageId, resultPath])
  const result = useMemo(() => {
    if (!resultOrigin) return { value: null, error: configError ? 'Адрес результата пока недоступен.' : 'Подготавливаем QR результата…' }
    try { return { value: buildResultQr(packageId, resultPath, resultOrigin), error: null } }
    catch { return { value: null, error: 'Не удалось отобразить QR результата.' } }
  }, [packageId, resultPath, resultOrigin, configError])
  if (!result.value) return <p className="master-qr-error" role="alert">{result.error}</p>
  return <a className="vk-final-qr master-result-qr" href={result.value.href} target="_blank" rel="noreferrer" aria-label="Открыть сохранённый результат">
    {/* SVG comes exclusively from the pinned QR encoder, never backend HTML. */}
    <span role="img" aria-label="QR-код сохранённого результата" dangerouslySetInnerHTML={{ __html: result.value.svg }} />
  </a>
}
