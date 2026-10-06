import { useEffect, useRef, useState } from 'react'
import { CameraPreview } from '../../components/CameraPreview'
import { useCameraSession } from '../../components/camera-session-context'
import { capturePhoto, photoBase64 } from './camera-capture'
import type { Fence, PhotoUpload } from './slice-client.mjs'
import consentDocument from '../../content/vk-consent.json'
import { RingTag } from '../../components/RingTag'
import cameraReference from '../../assets/ux-reference/vk-new-camera.svg'
import { vkCopy } from '../../content/vkVideo'
import './master-camera.css'

interface Props {
  fence: Fence; enabled: boolean
  upload: (fence: Fence, payload: PhotoUpload) => Promise<unknown>
  skip: () => void
  onTermsOpenChange?: (open: boolean) => void
}
function Capture({ fence, enabled, upload, skip, onTermsOpenChange }: Props) {
  const { status, requestAccess, upright } = useCameraSession()
  const video = useRef<HTMLVideoElement>(null)
  const [appearance, setAppearance] = useState<'male' | 'female' | null>(null)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [hasPending, setHasPending] = useState(false)
  const [notice, setNotice] = useState('')
  const pending = useRef<{ fence: Fence; payload: PhotoUpload } | null>(null)
  const working = useRef(false)
  useEffect(() => () => onTermsOpenChange?.(false), [onTermsOpenChange])
  const lifetime = useRef<AbortController | null>(null)
  useEffect(() => {
    const controller = new AbortController(); lifetime.current = controller
    return () => { controller.abort(); pending.current = null; lifetime.current = null }
  }, [])
  async function submit() {
    if (working.current || !enabled || !consent || !appearance || !lifetime.current) return
    working.current = true; setBusy(true); setNotice('Подготавливаем снимок…')
    const signal = lifetime.current.signal
    try {
      if (!pending.current) {
        if (!video.current) throw Error('Камера недоступна')
        const blob = await capturePhoto(video.current, signal, upright)
        const imageBase64 = await photoBase64(blob, signal)
        pending.current = { fence: { ...fence }, payload: { captureId: crypto.randomUUID(), expectedRevision: fence.revision,
          appearance, consent: { accepted: true, version: 'poster-v1' }, imageBase64 } }
        setHasPending(true)
      }
      signal.throwIfAborted()
      setNotice('Сохраняем снимок…')
      await upload(pending.current.fence, pending.current.payload)
      signal.throwIfAborted()
      setNotice('Снимок передан. Подтверждаем сохранение…')
    } catch (error) {
      if (!signal.aborted) setNotice(error instanceof Error ? error.message : 'Снимок не подтверждён. Повтори тот же запрос.')
    } finally { working.current = false; if (!signal.aborted) setBusy(false) }
  }
  return <section className="screen master-camera" aria-label="Фото для персональной подборки">
    <div className="master-camera-layout" data-lc-influence="shadow" data-lc-strength="0.4">
    <h1>{vkCopy.cameraPrompt}</h1>
    <div className="master-camera-preview"><CameraPreview active captureRef={video} /></div>
    {status !== 'ready' && <RingTag navigation className="master-camera-retry" disabled={status === 'requesting'} onClick={requestAccess}>Разрешить камеру</RingTag>}
    <fieldset disabled={busy || hasPending}><legend>Выбери вариант образа</legend>
      <label><input type="radio" name="appearance" checked={appearance === 'male'} onChange={() => setAppearance('male')} />Мужской</label>
      <label><input type="radio" name="appearance" checked={appearance === 'female'} onChange={() => setAppearance('female')} />Женский</label>
    </fieldset>
    <label className="master-camera-consent"><input type="checkbox" checked={consent} disabled={busy || hasPending} onChange={event => setConsent(event.target.checked)} />
      <span>Согласен на использование снимка для создания персональной подборки.</span></label>
    <details className="master-camera-terms" onToggle={event => onTermsOpenChange?.(event.currentTarget.open)}><summary>Условия использования персональных данных</summary>
      <div className="master-camera-terms-body">
      <h2>{consentDocument.title}</h2><p>{consentDocument.introduction}</p>
      {consentDocument.sections.map((section, sectionIndex) => <section key={section.title}><h3>{sectionIndex + 1}. {section.title}</h3>
        {section.blocks.map((block, index) => block.type === 'list'
          ? <ul key={index}>{block.items?.map(item => <li key={item}>{item}</li>)}</ul>
          : <p key={index}>{block.text}</p>)}
      </section>)}<p>{consentDocument.revision}</p></div>
    </details>
    <RingTag navigation tone="red" className={`vk-camera-button master-camera-capture ${hasPending ? 'master-camera-capture--retry' : ''}`}
      aria-label={hasPending ? 'Повторить передачу этого снимка' : 'Сделать фото'}
      disabled={!enabled || busy || !consent || !appearance || (!hasPending && status !== 'ready')} onClick={() => void submit()}>
      {hasPending ? 'Повторить передачу этого снимка' : <><img src={cameraReference} alt="" aria-hidden="true" /><span className="visually-hidden">Сделать фото</span></>}</RingTag>
    <RingTag navigation className="master-camera-skip" disabled={!enabled || busy} onClick={skip}>Продолжить без фото</RingTag>
    <p className="master-camera-notice" role="status">{notice}</p>
    </div>
  </section>
}
export function MasterCamera(props: Props) {
  // Capture attaches to the application-owned stream; server phase does not own it.
  return <Capture {...props} />
}
