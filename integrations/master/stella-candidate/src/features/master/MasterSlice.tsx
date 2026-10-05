import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { RingScene } from '../../components/RingScene'
import { RingActions } from '../../components/RingActions'
import { RingHomeScreen } from '../../components/RingHomeScreen'
import { OnboardingScreen } from '../../components/OnboardingScreen'
import { BrandSplash } from '../../components/BrandSplash'
import { ProductMark } from '../../components/ProductMark'
import { ContinuousQuestions } from '../../components/ContinuousQuestions'
import { AnswerFlight } from '../../components/AnswerFlight'
import { WhiteEntity } from '../../components/WhiteEntity'
import { MasterCamera } from './MasterCamera'
import { PhotoReveal } from './PhotoReveal'
import { ResultQr } from './ResultQr'
import { VisitorStatus, operatorToolsEnabled } from './VisitorStatus'
import { useMasterAudio } from './useMasterAudio'
import { markServiceReady, useServicePlaying } from '../../service'
import { createSliceClient, type SliceClient, type Snapshot } from './slice-client.mjs'
import { questionFromSnapshot, revealFromSnapshot, resultPath } from './presentation'
import { acceptedVkQuestion, acceptedVkReveal } from './accepted-presentation'
import { automaticPhotoSkip, bypassPhoto, discoveryStage, nextDiscoveryHold, type DiscoveryHold } from './accepted-flow'
import { useVisibleDwell } from './use-visible-dwell'
import { usePresentationPlaying } from './presentation-playing'
import { usePresentationCompletion } from './usePresentationCompletion'
import { vkCopy } from '../../content/vkVideo'
import silhouetteReference from '../../assets/ux-reference/vk-new-silhouette.svg'
import './master-slice.css'
import '../prototype/revision-seven.css'
import '../prototype/final-reference.css'

export function MasterSlice({ onSelectMax }: { onSelectMax?: () => void }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const client = useRef<SliceClient | null>(null)
  const [selected, setSelected] = useState(false)
  const [consentOpen, setConsentOpen] = useState(false)
  const [discoveryHold, setDiscoveryHold] = useState<DiscoveryHold | null>(null)
  const [dismissedResult, setDismissedResult] = useState<string | null>(null)
  const [splash, setSplash] = useState(false)
  const completeBrandSplash = useCallback(() => setSplash(false), [])
  const [localNotice, setLocalNotice] = useState('')
  const [scale, setScale] = useState(1)
  const viewport = useRef<HTMLDivElement>(null)
  const hostPlaying = useServicePlaying()
  const state = snapshot?.session?.state
  const current = Boolean(state && snapshot?.station?.sessionId === state.sessionId)
  const active = current && state?.protocol === 'stella-vk-v1' && ['active', 'paused'].includes(state?.phase ?? '')
  const completed = state?.sessionId !== dismissedResult && state?.protocol === 'stella-vk-v1' && state.phase === 'completed' && (current || !snapshot?.station?.sessionId)
  const screen = active || completed ? state!.screen : selected ? 'onboarding' : 'home'
  const finishingDiscovery = Boolean(completed && discoveryHold?.sessionId === state?.sessionId && !discoveryHold?.done)
  const showFinal = completed && !finishingDiscovery
  const visualScreen = finishingDiscovery ? 'particles' : screen
  const frozen = state?.contentPlan?.status === 'accepted'
  const canBack = Boolean(snapshot?.canAct && !frozen && snapshot.session?.view?.actions?.some(a => a.command.kind === 'back'))
  const link = snapshot ? resultPath(snapshot) : null
  const apiBase = import.meta.env.VITE_MASTER_API_BASE ?? (import.meta.env.DEV ? '/master-api' : '')
  const product = screen === 'home' ? null : 'vk-video'
  const playing = usePresentationPlaying(hostPlaying, snapshot, state)
  const skipPhoto = bypassPhoto(state)
  useMasterAudio({screen: skipPhoto && ['photochoice', 'camera'].includes(screen) ? 'photo-bridge' : visualScreen, sessionId: state?.sessionId, questionIndex: ['question', 'answer-reveal'].includes(visualScreen) ? state?.questionIndex : undefined, playing, splash,
    blocked: screen === 'camera' && consentOpen,
    effectsPlaying: hostPlaying && snapshot?.online === true && state?.phase !== 'paused',
    revision: state?.revision, instanceKey: snapshot?.health?.instanceKey})
  const operator = operatorToolsEnabled()
  // Timer checkpoints and pause revisions do not reconstruct a running visual.
  const contentKey = JSON.stringify({ state: state && { protocol: state.protocol, screen: state.screen, questionIndex: state.questionIndex,
    sessionId: state.sessionId, answers: state.answers, photo: state.photo }, view: snapshot?.session?.view && {
      questionId: snapshot.session.view.questionId, title: snapshot.session.view.title, description: snapshot.session.view.description, options: snapshot.session.view.options } })
  const presentation = useMemo(() => {
    const input = JSON.parse(contentKey)
    const s = { session: input } as Snapshot
    return { question: acceptedVkQuestion(questionFromSnapshot(s)), reveal: acceptedVkReveal(revealFromSnapshot(s)) }
  }, [contentKey])
  const fence = state ? { sessionId: state.sessionId, revision: state.revision, screen: state.screen } : null
  const cueKey = active && ['answer-reveal', 'photo-reveal', 'scanning', 'particles'].includes(screen)
    ? JSON.stringify([state!.sessionId, screen, state!.questionIndex,
      state!.answers?.[state!.questionIndex ?? -1]?.answerId, state!.photo?.choice]) : null
  const completeReveal = usePresentationCompletion(cueKey, fence, Boolean(snapshot?.canAct && playing),
    acceptedFence => { void client.current?.complete(acceptedFence) })
  const completeDiscovery = useCallback(() => {
    setDiscoveryHold(current => current && current.sessionId === state?.sessionId && current.instanceKey === snapshot?.health?.instanceKey ? { ...current, done: true } : current)
    completeReveal()
  }, [completeReveal, state?.sessionId, snapshot?.health?.instanceKey])
  const failDiscovery = useCallback(() => {
    // A renderer fault may stop holding an already-confirmed final; it never ACKs a visual that did not run.
    setDiscoveryHold(current => current && current.sessionId === state?.sessionId && current.instanceKey === snapshot?.health?.instanceKey ? { ...current, done: true } : current)
  }, [state?.sessionId, snapshot?.health?.instanceKey])
  const phaseKey = useMemo(() => ({ id: `${screen}:${state?.sessionId ?? ''}:${state?.questionIndex ?? ''}:${splash}` }), [screen, state?.sessionId, state?.questionIndex, splash])
  const dismissFinal = useCallback(() => {
    if (!showFinal || !state) return
    setDismissedResult(state.sessionId); setSelected(false); setSplash(false)
  }, [showFinal, state])
  useVisibleDwell(showFinal ? state!.sessionId : null, 20000, playing, dismissFinal)
  const automaticSkip = useRef<string | null>(null)
  useEffect(() => {
    const option = automaticPhotoSkip(snapshot)
    const skipCamera = snapshot?.canAct && state?.screen === 'camera' && skipPhoto
    const key = state ? `${state.sessionId}:${state.revision}` : null
    if ((!option && !skipCamera) || !key || automaticSkip.current === key || !playing) return
    automaticSkip.current = key
    if (skipCamera) void client.current?.control('photo_skip')
    else void client.current?.choosePhoto({ sessionId: state!.sessionId, revision: state!.revision, screen: state!.screen }, option!)
  }, [snapshot, state, playing, skipPhoto])

  useEffect(() => {
    let storage: Pick<Storage, 'getItem' | 'setItem'>
    try { storage = window.sessionStorage } catch { storage = { getItem() { throw Error('Storage unavailable') }, setItem() { throw Error('Storage unavailable') } } }
    const adapter = createSliceClient({ fetch: window.fetch.bind(window), storage, uuid: () => crypto.randomUUID(), onChange: next => {
      setDiscoveryHold(previous => nextDiscoveryHold(previous, next)); setSnapshot(next)
    },
      apiBase: import.meta.env.VITE_MASTER_API_BASE ?? (import.meta.env.DEV ? '/master-api' : '') })
    client.current = adapter
    void adapter.refresh()
    const timer = window.setInterval(() => { if (!document.hidden) void adapter.refresh() }, 750)
    const wake = () => { void adapter.refresh() }
    window.addEventListener('pageshow', wake); document.addEventListener('visibilitychange', wake)
    void markServiceReady().catch(console.error)
    return () => { adapter.dispose(); client.current = null; clearInterval(timer); window.removeEventListener('pageshow', wake); document.removeEventListener('visibilitychange', wake) }
  }, [])
  useLayoutEffect(() => {
    const fit = () => {
      const node = viewport.current
      if (!node) return
      const style = getComputedStyle(node)
      setScale(Math.min((node.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)) / 1080,
        (node.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)) / 1920))
    }
    fit(); const observer = new ResizeObserver(fit)
    if (viewport.current) observer.observe(viewport.current)
    return () => observer.disconnect()
  }, [])
  const available = Boolean(snapshot?.canStart || snapshot?.canAct)
  const status = snapshot?.storageError || snapshot?.error || localNotice || (completed ? 'Квиз завершён. Освобождение станции подтверждает мастер.' : snapshot?.notice) || 'Подключение к мастеру…'

  return <>
    {operator ? <aside className="master-slice-status" aria-label="Интеграционный срез">
      <strong>VK · серверный квиз</strong><span role="status">{status}</span>
      <div>
        <button onClick={() => void client.current?.refresh()}>Обновить</button>
        <button disabled={!snapshot?.canRetry} onClick={() => void client.current?.retry()}>Повторить сохранённый запрос</button>
        <button disabled={!snapshot?.canPause} onClick={() => void client.current?.control('pause')}>Пауза</button>
        <button disabled={!snapshot?.canResume} onClick={() => void client.current?.control('resume')}>Продолжить</button>
        <button disabled={!snapshot?.canCancel} onClick={() => { setSelected(false); setSplash(false); void client.current?.control('cancel') }}>Отменить сессию</button>
      </div>
    </aside> : <VisitorStatus fault={Boolean(snapshot && !snapshot.busy && (snapshot.storageError || snapshot.error || !snapshot.fresh))}
      pending={Boolean(snapshot?.canRetry)} paused={state?.phase === 'paused'} refresh={() => void client.current?.refresh()}
      retry={snapshot?.canRetry ? () => void client.current?.retry() : undefined} />}
    <div ref={viewport} className="prototype-viewport"><div className="prototype-canvas" style={{ width: 1080 * scale, height: 1920 * scale }}>
      <RingScene playing={hostPlaying && state?.phase !== 'paused'} product={product} phase={splash ? 'brand-entry' : visualScreen === 'home' ? 'entry' : visualScreen === 'onboarding' ? 'intro' : showFinal ? 'result' : ['camera', 'scanning', 'particles'].includes(visualScreen) ? 'processing' : 'question'} scale={scale}>
        {product && !splash && <header className="stella-product-header"><ProductMark product="vk-video" /></header>}
        <RingActions playing={hostPlaying && available} phaseKey={phaseKey}>
          <main className={`experience experience--${product ?? 'entry'}`} data-screen={splash ? 'brand-entry' : visualScreen} data-master-slice="vk-full-questions">
            {splash ? <BrandSplash product="vk-video" playing={hostPlaying} onComplete={completeBrandSplash} /> : <>
              {screen === 'home' && <RingHomeScreen onSelect={brand => {
                if (brand === 'max') { if (snapshot?.canStart && onSelectMax) onSelectMax(); return }
                if (snapshot?.canStart) { setSelected(true); setSplash(true); setLocalNotice('') }
              }} />}
              {screen === 'onboarding' && <OnboardingScreen product="vk-video" showProductMark={false} voiceEnabled={false}
                onStart={() => void client.current?.start()} onBack={() => { if (active) void client.current?.control('cancel'); setSelected(false) }} />}
              {active && screen === 'camera' && !skipPhoto && fence && <MasterCamera key={state!.sessionId} fence={fence} enabled={Boolean(snapshot?.canAct && playing)}
                onTermsOpenChange={setConsentOpen}
                upload={(capturedFence, payload) => client.current ? client.current.uploadPhoto(capturedFence, payload) : Promise.reject(Error('Сессия закрыта'))}
                skip={() => void client.current?.control('photo_skip')} />}
              {((active && ['scanning', 'particles'].includes(screen)) || finishingDiscovery) && <section className="screen screen--vk-processing" aria-label="Подготовка подборки" role="status" />}
              {showFinal && <section className="screen screen--result screen--vk-final" aria-labelledby="vk-result-title">
                <h1 id="vk-result-title">{vkCopy.finalDirection}</h1>
                {link && state?.contentPlan?.packageId ? <>
                  <ResultQr packageId={state.contentPlan.packageId} resultPath={link} apiBase={apiBase} />
                  <p className="vk-final-caption">{vkCopy.finalQrCaption}</p>
                  {operator && <><a className="master-result-link" href={apiBase + link} target="_blank" rel="noreferrer">Открыть сохранённый результат</a>
                  <p className="master-result-scope">Локальная ссылка этого мастера</p></>}
                </> : <p className="master-result-missing">Результат пока не подтверждён сервером.</p>}
                {snapshot?.canStart && <button className="master-next-visitor" onClick={dismissFinal}>Следующий посетитель</button>}
              </section>}
            </>}
          </main>
        </RingActions>
        {!splash && active && presentation.question && !(skipPhoto && screen === 'photochoice') && <ContinuousQuestions key={`${presentation.question.product}:${presentation.question.layout}`} question={presentation.question} reveal={null} playing={Boolean(playing)} interactive={Boolean(snapshot?.canAct)} authoritativeCopy backEnabled={canBack} showProductMark={false}
          onSelect={id => { if (fence) { if (screen === 'photochoice') void client.current?.choosePhoto(fence, id); else void client.current?.answer(fence, presentation.question!.id, id) } }}
          onBack={() => void client.current?.control('back')} onComplete={() => {}} />}
        {!splash && active && presentation.reveal && fence && <AnswerFlight key={`${fence.sessionId}:${state?.questionIndex}:${state?.answers?.[state.questionIndex ?? -1]?.answerId}`} reveal={presentation.reveal} playing={Boolean(playing)} flightDurationScale={1.25} showProductMark={false}
          onComplete={completeReveal} />}
        {!splash && active && (screen === 'photo-reveal' || (screen === 'answer-reveal' && !presentation.reveal)) &&
          <PhotoReveal key={`${state!.sessionId}:${screen}:${state?.questionIndex}:${state?.photo?.choice}`} title={snapshot?.session?.view?.title ?? ''} hideCopy={screen === 'photo-reveal'} playing={Boolean(playing)} onComplete={completeReveal} />}
      </RingScene>
      {!splash && ((active && ['scanning', 'particles'].includes(screen)) || finishingDiscovery) && <WhiteEntity key={state!.sessionId} cueKey={`${state!.sessionId}:${visualScreen}`} stage={visualScreen === 'scanning' ? 'scan' : discoveryHold?.stage ?? discoveryStage(snapshot)} silhouetteSrc={state?.photo?.referenceAssetId && !skipPhoto ? silhouetteReference : undefined} generationDurationSeconds={7} playing={Boolean(playing)} onComplete={visualScreen === 'particles' ? completeDiscovery : completeReveal} onError={failDiscovery} />}
    </div></div>
  </>
}
