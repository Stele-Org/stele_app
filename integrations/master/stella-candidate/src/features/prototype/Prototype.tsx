import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  Mic,
  X,
} from 'lucide-react'
import { OnboardingScreen } from '../../components/OnboardingScreen'
import { ProductMark } from '../../components/ProductMark'
import { RingHomeScreen } from '../../components/RingHomeScreen'
import { RingScene } from '../../components/RingScene'
import { RingActions } from '../../components/RingActions'
import { RingTag } from '../../components/RingTag'
import finalQrReference from '../../assets/ux-reference/vk-new-qr.svg'
import cameraReference from '../../assets/ux-reference/vk-new-camera.svg'
import silhouetteReference from '../../assets/ux-reference/vk-new-silhouette.svg'
import { WhiteEntity } from '../../components/WhiteEntity'
import { AnswerFlight } from '../../components/AnswerFlight'
import { ContinuousQuestions } from '../../components/ContinuousQuestions'
import { questionPresentation } from './question-presentation'
import { timedTransition } from './timed-transition'
import { SCREEN_EXIT_CUE_MS } from './ring-cue'
import { readDiscoveryPreview } from './discovery-preview'
import { tagPresentation, type TagReveal } from './tag-reveal'
import { BrandSplash } from '../../components/BrandSplash'
import type { RingPhase } from '../../components/ring-scene-config'
import {
  maxAudienceOptions,
  maxThanks,
  maxGoalOptions,
  maxMissionDescriptions,
  maxMissionLabels,
  maxTransitionPrompt,
} from '../../content/max'
import { discoveryRules, vkCopy, vkGenderOptions, vkPhotoOptions, vkQuestions } from '../../content/vkVideo'
import vkConsent from '../../content/vk-consent.json'
import './final-reference.css'
import type {
  MaxAudience,
  MaxMission,
  VkGender,
  VkTheme,
  Product,
} from '../../types/prototype'
import { calculateThemeScores, getMaxMission, rankThemes } from './logic'
import { createBrowserEventSink, createEventPublisher } from './events'
import { markServiceReady, useServicePlaying } from '../../service'
import { useScreenNarration } from '../voice/use-screen-narration'
import { readMicrophone } from '../voice/microphone'
import { voiceCommands } from '../voice/voice-commands'
import { useVoiceCommands } from '../voice/use-voice-commands'
import { useStellaSound } from '../sound/use-stella-sound'
import { useScanPhoto } from './scan-photo'
import { storeApprovedPhoto } from './photo-storage-client'
import { buildVkResult, type VkResultChoices } from './vk-result'
import { storeResult } from './result-storage-client'
import { useIdleReturn, waitsForVisitor } from './idle-return'
import { narrationId } from '../voice/narration'

export type ScreenState =
  | { type: 'home' }
  | { type: 'max-onboarding' }
  | { type: 'vk-onboarding' }
  | { type: 'max-audience' }
  | { type: 'max-goal'; audience: MaxAudience }
  | { type: 'max-result'; mission: MaxMission }
  | { type: 'max-answer-reveal'; label: string; metadata: string[]; next: ScreenState }
  | { type: 'vk-question'; index: number; answers: string[] }
  | { type: 'vk-answer-reveal'; questionIndex: number; optionIndex: number; label: string; metadata: string[]; next: ScreenState }
  | { type: 'vk-photo-reveal'; answerId: 'accept' | 'skip'; metadata: string[]; next: ScreenState }
  | { type: 'vk-digitize'; answers: string[]; rankedThemes: VkTheme[]; discoveryAnswerId: string }
  | { type: 'vk-gender'; answers: string[]; rankedThemes: VkTheme[] }
  | { type: 'vk-camera'; themes: VkTheme[] }
  | { type: 'vk-scanning'; themes: VkTheme[] }
  | { type: 'vk-photo-review'; themes: VkTheme[] }
  | { type: 'vk-particles'; themes: VkTheme[] }
  | { type: 'vk-discovery-activation'; themes: VkTheme[]; metadata: string[] }
  | { type: 'vk-final'; themes: VkTheme[] }

const homeState: ScreenState = { type: 'home' }
const canvasWidth = 1080
const canvasHeight = 1920

export function Prototype() {
  const [discoveryPreview] = useState(() => readDiscoveryPreview(window.location.search, import.meta.env.DEV))
  const [screen, setScreen] = useState<ScreenState>(() => discoveryPreview?.screen ?? homeState)
  // The camera photographs the visitor while the scan is on the screen; the check of that photo follows the scan.
  const { url: photoUrl, held: heldPhoto, discard: discardPhoto } = useScanPhoto(screen.type === 'vk-scanning' && !discoveryPreview?.hold)
  const completeDiscoveryScan = useCallback(() => {
    if (discoveryPreview?.hold) return
    // The check follows every scan (user, 07.10.2026): without a camera or a frame it shows a black square instead of a photo.
    setScreen(current => current.type !== 'vk-scanning' ? current : { type: 'vk-photo-review', themes: current.themes })
  }, [discoveryPreview])
  const completeDiscoveryGeneration = useCallback(() => {
    if (discoveryPreview?.hold) return
    setScreen(current => current.type === 'vk-particles' || current.type === 'vk-discovery-activation'
      ? { type: 'vk-final', themes: current.themes } : current)
  }, [discoveryPreview])
  const [enteringProduct, setEnteringProduct] = useState<Product | null>(null)
  const completeProductEntry = useCallback(() => setEnteringProduct(null), [])
  const tagReveal = useMemo(() => tagPresentation(screen), [screen])
  const completeAnswerFlight = useCallback((reveal: TagReveal) => {
    // A held preview replays the same reveal: a fresh screen object restarts the scene.
    setScreen(current => current !== reveal.source ? current : discoveryPreview?.hold ? { ...current } : reveal.next)
  }, [discoveryPreview])
  const [termsOpen, setTermsOpen] = useState(false)
  const [termsMounted, setTermsMounted] = useState(false)
  const [canvasScale, setCanvasScale] = useState(1)
  const viewportRef = useRef<HTMLDivElement>(null)
  const playing = useServicePlaying()
  // The consent text pauses the screen and its sound effects, but not the voice.
  const asked = useScreenNarration({ screen, playing, brandSplash: enteringProduct !== null })
  useStellaSound({ screen, playing, blocked: termsMounted })
  // The microphone opens when the voice has finished the line of a screen that waits for an answer, and what the
  // visitor says presses the button they named: the same press as a tap, with its cue and its sound.
  const [microphone] = useState(() => readMicrophone(window.location.search))
  const commands = useMemo(() => voiceCommands(screen), [screen])
  const pressNamed = useCallback((target: string) => {
    const button = viewportRef.current?.querySelector<HTMLButtonElement>(`${target}:not(:disabled)`)
    button?.click()
    return !!button
  }, [])
  const listening = useVoiceCommands({
    active: microphone !== 'off' && asked !== null && playing && !termsMounted && enteringProduct === null,
    commands, onCommand: pressNamed, debug: microphone === 'debug',
  })
  const transitionRemaining = useRef<{ screen: ScreenState; remaining: number } | null>(null)
  // The result of the test is stored once every choice is made (vk-result.ts). After «Начать» that is the check of
  // the photo: until then the choices wait here.
  const awaitingPhoto = useRef<VkResultChoices | null>(null)

  useEffect(() => { void markServiceReady().catch(console.error) }, [])
  const termsTriggerRef = useRef<HTMLButtonElement>(null)
  const hadTerms = useRef(false)
  const termsCloseRef = useRef<HTMLButtonElement>(null)
  const termsCloseTimeoutRef = useRef<number | null>(null)
  const [sink] = useState(createBrowserEventSink)
  const [publisher, setPublisher] = useState(() => createEventPublisher(crypto.randomUUID(), sink))
  const reset = useCallback(() => {
    if (termsCloseTimeoutRef.current !== null) window.clearTimeout(termsCloseTimeoutRef.current)
    termsCloseTimeoutRef.current = null
    transitionRemaining.current = null
    awaitingPhoto.current = null
    setTermsOpen(false)
    setTermsMounted(false)
    setPublisher(createEventPublisher(crypto.randomUUID(), sink))
    setScreen(homeState)
    setEnteringProduct(null)
    discardPhoto()
  }, [sink, discardPhoto])
  // Nobody acts on a screen that waits for a press: the scenario returns to the start screen like after the last one.
  // The consent text does not stop the count; reading it by scrolling is acting.
  useIdleReturn({
    screen, active: playing && enteringProduct === null && waitsForVisitor(screen),
    spoken: Boolean(asked) || narrationId(screen) === null, onIdle: reset,
  })

  useLayoutEffect(() => {
    const fitCanvas = () => {
      const viewport = viewportRef.current
      if (!viewport) return
      const style = window.getComputedStyle(viewport)
      const width = viewport.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      const height = viewport.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
      setCanvasScale(
        Math.min(
          width / canvasWidth,
          height / canvasHeight,
        ),
      )
    }

    fitCanvas()
    const observer = new ResizeObserver(fitCanvas)
    if (viewportRef.current) observer.observe(viewportRef.current)
    window.addEventListener('resize', fitCanvas)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', fitCanvas)
    }
  }, [])

  useEffect(() => {
    const transition = timedTransition(screen)
    if (!transition) { transitionRemaining.current = null; return }
    if (transitionRemaining.current?.screen !== screen) {
      transitionRemaining.current = { screen, remaining: transition.duration }
    }
    if (!playing) return
    const progress = transitionRemaining.current
    const startedAt = performance.now()
    const timeout = window.setTimeout(() => {
      if (transition.next.type === 'home') reset()
      else setScreen(transition.next)
    }, progress.remaining)
    return () => {
      window.clearTimeout(timeout)
      progress.remaining = Math.max(0, progress.remaining - (performance.now() - startedAt))
    }
  }, [screen, playing, reset])

  useEffect(() => {
    // Focusing a control in the sliding sheet must not scroll the scaled canvas.
    if (termsOpen) termsCloseRef.current?.focus({ preventScroll: true })
  }, [termsOpen])

  useLayoutEffect(() => {
    if (hadTerms.current && !termsMounted) termsTriggerRef.current?.focus({ preventScroll: true })
    hadTerms.current = termsMounted
  }, [termsMounted])

  useEffect(() => {
    if (!termsMounted) return
    const frame = window.requestAnimationFrame(() => setTermsOpen(true))
    return () => window.cancelAnimationFrame(frame)
  }, [termsMounted])

  useEffect(() => () => {
    if (termsCloseTimeoutRef.current !== null) window.clearTimeout(termsCloseTimeoutRef.current)
  }, [])

  const closeTerms = () => {
    setTermsOpen(false)
    if (termsCloseTimeoutRef.current !== null) window.clearTimeout(termsCloseTimeoutRef.current)
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220
    termsCloseTimeoutRef.current = window.setTimeout(() => {
      setTermsMounted(false)
      termsCloseTimeoutRef.current = null
    }, duration)
  }

  const startProduct = useCallback((product: 'max' | 'vk-video') => {
    publisher.start(product)
    setScreen({ type: product === 'max' ? 'max-onboarding' : 'vk-onboarding' })
    setEnteringProduct(product)
  }, [publisher])


  const goBack = () => {
    switch (screen.type) {
      case 'max-onboarding':
      case 'vk-onboarding':
        reset()
        break
      case 'max-audience':
      case 'vk-question':
        if (screen.type === 'vk-question' && screen.index > 0) {
          publisher.clear('vk-video', vkQuestions[screen.index - 1].id)
          setScreen({
            type: 'vk-question',
            index: screen.index - 1,
            answers: screen.answers.slice(0, -1),
          })
        } else {
          setScreen({ type: screen.type === 'max-audience' ? 'max-onboarding' : 'vk-onboarding' })
        }
        break
      case 'max-goal':
        publisher.clear('max', 'audience')
        setScreen({ type: 'max-audience' })
        break
      // The photo step (vk-digitize) has no back button: user, 06.10.2026.
      case 'vk-gender':
        publisher.clear('vk-video', 'photo')
        setScreen({ type: 'vk-digitize', answers: screen.answers, rankedThemes: screen.rankedThemes, discoveryAnswerId: 'hero' })
        break
      default:
        break
    }
  }

  const selectVkAnswer = (answerId: string) => {
    if (screen.type !== 'vk-question') return

    const question = vkQuestions[screen.index]
    const option = question.options.find(({ id }) => id === answerId)
    if (!option) return

    if (screen.index < 2) {
      const weightedQuestion = screen.index === 0 ? vkQuestions[0] : vkQuestions[1]
      const weightedOption = weightedQuestion.options.find(({ id }) => id === answerId)!
      publisher.answer('vk-video', question.id, weightedOption, { [weightedOption.plusTwo]: 2, [weightedOption.plusOne]: 1 })
      setScreen({
        type: 'vk-answer-reveal',
        questionIndex: screen.index,
        optionIndex: question.options.findIndex(({ id }) => id === answerId),
        label: option.label,
        metadata: option.metadata,
        next: { type: 'vk-question', index: screen.index + 1, answers: [...screen.answers, answerId] },
      })
      return
    }

    publisher.answer('vk-video', question.id, option)
    const rankedThemes = rankThemes(screen.answers)
    if (answerId !== 'hero') {
      const { sessionId, occurredAt } = publisher.recommendation(calculateThemeScores(screen.answers), rankedThemes,
        answerId, discoveryRules[answerId], 'not-requested')
      void storeResult(buildVkResult({ sessionId, answers: screen.answers, discoveryAnswerId: answerId, rankedThemes }, { status: 'not-requested' }, occurredAt))
    }
    setScreen({
      type: 'vk-answer-reveal', questionIndex: screen.index,
      optionIndex: question.options.findIndex(({ id }) => id === answerId), label: option.label, metadata: option.metadata,
      next: answerId === 'hero'
        ? { type: 'vk-digitize', answers: screen.answers, rankedThemes, discoveryAnswerId: answerId }
        : { type: 'vk-discovery-activation', themes: rankedThemes.slice(0, 3), metadata: [] },
    })
  }

  const selectPhoto = (answerId: 'accept' | 'skip') => {
    if (screen.type !== 'vk-digitize') return
    const option = vkPhotoOptions.find(({ id }) => id === answerId)!
    publisher.answer('vk-video', 'photo', option)
    const { sessionId, occurredAt } = publisher.recommendation(calculateThemeScores(screen.answers), screen.rankedThemes,
      screen.discoveryAnswerId, discoveryRules[screen.discoveryAnswerId], answerId === 'accept' ? 'included' : 'skipped')
    const choices: VkResultChoices = { sessionId, answers: screen.answers, discoveryAnswerId: screen.discoveryAnswerId, rankedThemes: screen.rankedThemes }
    if (answerId === 'accept') awaitingPhoto.current = choices
    else void storeResult(buildVkResult(choices, { status: 'skipped' }, occurredAt))
    // Neither answer shows tags (user request, 07.10.2026): «Начать» leaves for the camera after the same short cue
    // as «Пропустить» leaves for Discovery. The tags of «Начать» stay in its answer event.
    setScreen({
      type: 'vk-photo-reveal', answerId, metadata: [],
      next: answerId === 'accept'
        ? { type: 'vk-camera', themes: screen.rankedThemes.slice(0, 3) }
        : { type: 'vk-discovery-activation', themes: screen.rankedThemes.slice(0, 3), metadata: [] },
    })
  }

  const selectGender = (gender: VkGender) => {
    if (screen.type !== 'vk-gender') return
    const option = vkGenderOptions.find(({ id }) => id === gender)!
    publisher.answer('vk-video', 'gender', option)
    publisher.recommendation(calculateThemeScores(screen.answers), screen.rankedThemes, 'hero', discoveryRules.hero, 'included', gender)
    setScreen({ type: 'vk-camera', themes: screen.rankedThemes.slice(0, 3) })
  }

  // The page releases the photo either way. An approved one is first handed to the local storage of the dev server;
  // a photo the visitor chose to repeat is not stored anywhere, and neither is the black square shown without a photo.
  const leavePhotoReview = (next: 'vk-particles' | 'vk-camera') => {
    if (screen.type !== 'vk-photo-review') return
    const approved = next === 'vk-particles' ? heldPhoto() : null
    if (approved) void storeApprovedPhoto(approved)
    // «Продолжить» was the last choice: the result names the approved photo, or says that there is none.
    if (next === 'vk-particles' && awaitingPhoto.current) {
      void storeResult(buildVkResult(awaitingPhoto.current,
        approved ? { status: 'accepted', captureId: approved.captureId } : { status: 'unavailable' }, new Date().toISOString()))
      awaitingPhoto.current = null
    }
    discardPhoto()
    setScreen({ type: next, themes: screen.themes })
  }

  const product = screen.type === 'home' ? null : screen.type.startsWith('max-') ? 'max' : 'vk-video'
  const phase: RingPhase = enteringProduct ? 'brand-entry' : termsMounted ? 'terms'
    : screen.type === 'home' ? 'entry'
    : ['vk-scanning', 'vk-particles', 'vk-camera', 'vk-discovery-activation'].includes(screen.type) ? 'processing'
    : screen.type.endsWith('result') || screen.type === 'vk-final' ? 'result'
    : screen.type.endsWith('onboarding') ? 'intro'
    : screen.type === 'vk-digitize' || screen.type === 'vk-gender' || screen.type === 'vk-photo-review' ? 'photo' : 'question'
  const phaseKey = `${screen.type}:${screen.type === 'vk-question' ? screen.index : ''}:${termsMounted}:${termsOpen}:${enteringProduct ?? ''}`
  const actionPhase = useMemo(() => ({ id: phaseKey }), [phaseKey])
  const continuousQuestion = questionPresentation(screen)
  const selectQuestion = (id: string) => {
    if (screen.type === 'vk-question') selectVkAnswer(id)
    else if (screen.type === 'vk-digitize' && (id === 'accept' || id === 'skip')) selectPhoto(id)
    else if (screen.type === 'vk-gender' && (id === 'male' || id === 'female')) selectGender(id)
    else if (screen.type === 'max-audience') {
      const option = maxAudienceOptions.find(option => option.id === id)
      if (!option) return
      publisher.answer('max', 'audience', option)
      setScreen({ type: 'max-answer-reveal', label: option.label, metadata: option.metadata, next: { type: 'max-goal', audience: option.id } })
    } else if (screen.type === 'max-goal') {
      const option = maxGoalOptions.find(option => option.id === id)
      if (!option) return
      publisher.answer('max', 'goal', option)
      setScreen({ type: 'max-answer-reveal', label: option.label, metadata: option.metadata,
        next: { type: 'max-result', mission: getMaxMission(screen.audience, option.id) } })
    }
  }

  return (
    <div
      ref={viewportRef}
      className="prototype-viewport"
    >
      <div
        className="prototype-canvas"
        style={{
          width: canvasWidth * canvasScale,
          height: canvasHeight * canvasScale,
        }}
      >
        <RingScene playing={playing} product={product} phase={phase} scale={canvasScale}>
          {/* Keep the brand outside animated screen content for the whole VK flow. */}
          {product === 'vk-video' && !enteringProduct && (
            <header className="stella-product-header"><ProductMark product="vk-video" /></header>
          )}
          {listening && <div className="microphone-indicator" role="status" aria-label="Микрофон включён"><Mic aria-hidden="true" /></div>}
          <RingActions phaseKey={actionPhase} playing={playing}>
          <main className={`experience experience--${product ?? 'entry'}`} data-screen={screen.type}>
        {enteringProduct ? <BrandSplash product={enteringProduct} playing={playing} onComplete={completeProductEntry} /> : <>
        {screen.type === 'home' && (
          <RingHomeScreen onSelect={startProduct} exitCueMs={SCREEN_EXIT_CUE_MS} />
        )}

        {(screen.type === 'max-onboarding' || screen.type === 'vk-onboarding') && (
          <OnboardingScreen
            showProductMark={product !== 'vk-video'}
            product={screen.type === 'max-onboarding' ? 'max' : 'vk-video'}
            exitCueMs={SCREEN_EXIT_CUE_MS}
            onStart={() => setScreen(screen.type === 'max-onboarding'
              ? { type: 'max-audience' }
              : { type: 'vk-question', index: 0, answers: [] })}
            onBack={goBack}
          />
        )}

        {screen.type === 'max-result' && (
          <section className="screen screen--result" aria-labelledby="max-result-title">
            <ProductMark product="max" />
            <h1 id="max-result-title">
              <span className="mission-label">Миссия</span>{' '}
              <span className="mission-name">
                «{maxMissionLabels[screen.mission]}»
              </span>
            </h1>
            <p className="result-copy result-copy--description">
              {maxMissionDescriptions[screen.mission]}
            </p>
            <p className="result-copy result-copy--direction">
              {maxTransitionPrompt}
            </p>
            <RingTag
              tone="violet" className="secondary-button result-reset"
              type="button"
              onClick={reset}
            >
              {maxThanks}
            </RingTag>
          </section>
        )}

        {screen.type === 'vk-camera' && (
          <section className="screen" aria-label="Подготовка к фото">
            <div className="scan-copy" role="status" data-lc-influence="shadow" data-lc-strength="0.4">
              <h1>{vkCopy.cameraPrompt}</h1>
              <RingTag tone="red" className="vk-camera-button" aria-label="Сделать фото"
                onClick={() => setScreen({ type: 'vk-scanning', themes: screen.themes })}>
                <img src={cameraReference} alt="" aria-hidden="true" />
              </RingTag>
            </div>
          </section>
        )}

        {screen.type === 'vk-photo-review' && (
          <section className="screen screen--vk-photo-review" aria-label="Проверка фото">
            <div className="photo-review-frame">
              {photoUrl ? <img className="photo-review-image" src={photoUrl} alt="Твоё фото" draggable={false}
                data-lc-influence="shadow" data-lc-strength="1" data-lc-falloff="2.5" data-lc-padding="12" />
                : <div className="photo-review-image photo-review-image--empty" role="img" aria-label="Фото не снято"
                  data-lc-influence="shadow" data-lc-strength="1" data-lc-falloff="2.5" data-lc-padding="12" />}
            </div>
            <div className="photo-review-actions">
              {/* "Повторить" returns to the camera prompt: the visitor gets ready and the scan photographs again. */}
              <RingTag tone="blue" className="secondary-button" onClick={() => leavePhotoReview('vk-camera')}>{vkCopy.photoRetake}</RingTag>
              <RingTag tone="red" className="primary-button" onClick={() => leavePhotoReview('vk-particles')}>{vkCopy.photoContinue}</RingTag>
            </div>
          </section>
        )}

        {screen.type === 'vk-digitize' && termsMounted && (
          <div
            className="terms-overlay"
            data-open={termsOpen}
            role="dialog"
            aria-modal="true"
            aria-labelledby="terms-title"
            onClick={(event) => {
              if (event.target === event.currentTarget) closeTerms()
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') closeTerms()
              if (event.key === 'Tab') event.preventDefault()
            }}
          >
            <div className="terms-panel">
              <div className="terms-header">
                <h2 id="terms-title">{vkConsent.title}</h2>
                <RingTag
                  ref={termsCloseRef}
                  navigation className="terms-close"
                  type="button"
                  aria-label="Закрыть"
                  title="Закрыть"
                  onClick={closeTerms}
                >
                  <X aria-hidden="true" />
                </RingTag>
              </div>
              <div className="terms-body">
                <div className="terms-document">
                  <p>{vkConsent.introduction}</p>
                  {vkConsent.sections.map((section, index) => (
                    <section key={section.title}>
                      <h3>{index + 1}. {section.title}</h3>
                      {section.blocks.map((block, blockIndex) => block.type === 'list' ? (
                        <ul key={blockIndex}>
                          {block.items?.map(item => <li key={item}>{item}</li>)}
                        </ul>
                      ) : <p key={blockIndex}>{block.text}</p>)}
                    </section>
                  ))}
                  <p>{vkConsent.revision}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {(screen.type === 'vk-scanning' || screen.type === 'vk-particles' || screen.type === 'vk-discovery-activation') && (
          <section className="screen screen--vk-processing" aria-label={screen.type === 'vk-scanning' ? 'Имитация оцифровки' : 'Подготовка подборки'} role="status">
          </section>
        )}

        {screen.type === 'vk-final' && (
          <section className="screen screen--result screen--vk-final" aria-labelledby="vk-result-title">
            <h1 id="vk-result-title">{vkCopy.finalDirection}</h1>
            <div className="vk-final-qr" role="img" aria-label="QR-код: узнай больше о Discovery">
              <img src={finalQrReference} alt="" draggable={false} />
            </div>
            <p className="vk-final-caption">{vkCopy.finalQrCaption}</p>
          </section>
        )}
        </>}
          </main>
          </RingActions>
          {continuousQuestion && (
            <ContinuousQuestions key={`${continuousQuestion.product}:${continuousQuestion.layout}`} question={continuousQuestion} reveal={tagReveal} playing={playing && !termsMounted} interactionKey={termsMounted}
              showProductMark={product !== 'vk-video'}
              onSelect={selectQuestion} onBack={goBack} onComplete={completeAnswerFlight}>
              {screen.type === 'vk-digitize' && <RingTag ref={termsTriggerRef} navigation flat className="digitize-notice"
                aria-haspopup="dialog" aria-expanded={termsMounted} onClick={() => setTermsMounted(true)}>
                {vkCopy.digitizeNoticePrefix}<span className="digitize-terms-link">{vkCopy.digitizeNoticeAction}</span>.
              </RingTag>}
            </ContinuousQuestions>
          )}
          {tagReveal && !continuousQuestion && (
            <AnswerFlight key={screen.type} showProductMark={product !== 'vk-video'} flightDurationScale={1.25} reveal={tagReveal} playing={playing} onComplete={completeAnswerFlight} />
          )}
        </RingScene>
        {/* Blend against the painted background, outside the isolated/scaled UI tree. */}
        {(screen.type === 'vk-scanning' || screen.type === 'vk-particles' || screen.type === 'vk-discovery-activation') && <>
          <WhiteEntity playing={playing} stage={screen.type === 'vk-scanning' ? 'scan' : screen.type === 'vk-discovery-activation' ? 'activation' : 'generation'}
            silhouetteSrc={screen.type === 'vk-scanning' ? silhouetteReference : undefined}
            preview={discoveryPreview?.hold ?? false}
            onComplete={screen.type === 'vk-scanning' ? completeDiscoveryScan : completeDiscoveryGeneration} />
        </>}
      </div>
    </div>
  )
}
