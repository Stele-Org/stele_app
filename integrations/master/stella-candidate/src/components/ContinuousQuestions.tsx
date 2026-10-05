import { createContext, useContext, useCallback, useEffectEvent, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, useAnimate, usePresence } from 'motion/react'
import { animate as animateValue, type AnimationPlaybackControls } from 'motion'
import { ChevronRight } from 'lucide-react'
import type { QuestionPresentation } from '../features/prototype/question-presentation'
import type { TagReveal } from '../features/prototype/tag-reveal'
import { answerCardPosition } from '../features/prototype/answer-card-layout'
import { ARRIVE_EASE, ARRIVE_LEAD_MS, ARRIVE_MS, ARRIVE_STAGGER_MS } from '../features/prototype/arrival'
import { startFloat } from '../vendor/lumicells-scene/flight'
import { AnswerFlight } from './AnswerFlight'
import { BackButton } from './BackButton'
import { ProductMark } from './ProductMark'
import { RingActions } from './RingActions'
import { RingTag } from './RingTag'
import { referenceCards, vkCardLines } from './ux-artwork'
import { CameraPreview } from './CameraPreview'

// Exiting children still receive playback changes through this persistent context.
const Playback = createContext(true)

/** The shadow a landed card or button casts in the cell field (RingTag's own default). */
const FIELD_SHADOW = 1

/** LumiCells shadows any element that has a box, visible or not, so the shadow of an arriving element has to arrive
 * with it: otherwise a card that is still transparent already hides the field behind it.
 * Twenty steps keep the attribute mutations rare, as in TagDissolve. */
function arriveShadow(element: Element, delayMs: number) {
  const write = (value: number) => {
    const strength = String(Math.round(value * 20) / 20)
    if (element.getAttribute('data-lc-strength') !== strength) element.setAttribute('data-lc-strength', strength)
  }
  write(0)
  return animateValue(0, FIELD_SHADOW, { duration: ARRIVE_MS / 1000, delay: delayMs / 1000, ease: ARRIVE_EASE, onUpdate: write })
}

function useSoftPresence(kind: 'card' | 'copy' | 'heading', order = 0, onReady?: () => void) {
  const playing = useContext(Playback)
  const [present, safeToRemove] = usePresence()
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const controls = useRef<ReturnType<typeof animate> | null>(null)
  const shadow = useRef<AnimationPlaybackControls | null>(null)
  const finish = useEffectEvent(() => { if (present) onReady?.(); else safeToRemove?.() })
  useLayoutEffect(() => {
    let cancelled = false
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const card = kind === 'card', heading = kind === 'heading'
    const duration = reduced ? 0 : present ? (card || heading ? ARRIVE_MS / 1000 : .42) : card ? .44 : .28
    const animation = animate(scope.current,
      card ? { opacity: present ? 1 : 0, y: reduced || present ? 0 : -38, scale: reduced || present ? 1 : .96 }
        : heading ? { opacity: present ? 1 : 0, y: 0 } : { opacity: present ? 1 : 0 },
      // A question arrives in the rhythm of the onboarding screen, from the top down: the heading first, like its
      // title, then the answer cards one after another, like its steps, each settling downwards into place.
      // Leaving keeps its quick fade and spring.
      (card || heading) && present && !reduced ? { duration, ease: ARRIVE_EASE, delay: card ? (ARRIVE_LEAD_MS + order * ARRIVE_STAGGER_MS) / 1000 : 0 }
        : card && !reduced ? {
          type: 'spring', stiffness: 90, damping: 18, mass: 1.1, restDelta: .2, restSpeed: 2,
          opacity: { type: 'tween', duration, ease: 'easeInOut' }, delay: order * .025,
        } : { duration, ease: 'easeInOut' })
    controls.current = animation
    // The card's shadow in the field rises with the card itself; a leaving card drops it at once (shadowStrength).
    const tile = card && present && !reduced ? scope.current.querySelector('[data-lc-influence]') : null
    shadow.current = tile && arriveShadow(tile, ARRIVE_LEAD_MS + order * ARRIVE_STAGGER_MS)
    void animation.then(() => {
      if (cancelled) return
      controls.current = null
      finish()
    })
    // Motion cannot stop a native (WAAPI) animation that has not reached its first frame: with no start time yet
    // it commits the final value, and the element is simply there. React StrictMode's probe run ends exactly at
    // that point, so an animation that never showed a frame is cancelled back to its start instead of stopped.
    let underway = false
    let frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => { underway = true }) })
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      if (underway) animation.stop()
      else animation.cancel()
      controls.current = null
      shadow.current?.stop()
      shadow.current = null
    }
  }, [present, kind, order, animate, scope])
  useLayoutEffect(() => {
    if (playing) { controls.current?.play(); shadow.current?.play() }
    else { controls.current?.pause(); shadow.current?.pause() }
  }, [playing, present])
  return { scope, present }
}

function Copy({ children, heading = false, onReady }: { children: ReactNode; heading?: boolean; onReady?: () => void }) {
  const { scope, present } = useSoftPresence(heading ? 'heading' : 'copy', 0, onReady)
  return <div ref={scope} className={heading ? 'continuous-heading-copy' : 'continuous-card-copy'}
    style={heading ? { opacity: 0, transform: 'translateY(-18px)' } : { opacity: 0 }} aria-hidden={!present || undefined}>{children}</div>
}

/** A control around the cards joins the arrival of its question (global.css) only when it mounts with it;
 * one that returns later, when the server allows the action again, appears at once. */
function Extra({ withQuestion, children }: { withQuestion: boolean; children: ReactNode }) {
  const [arriving] = useState(withQuestion)
  const ref = useRef<HTMLDivElement>(null)
  const shadows = useRef<AnimationPlaybackControls[]>([])
  const playing = useContext(Playback)
  // Its shadow in the field arrives with the control: the same 800ms delay as `soft-descend` in global.css.
  useLayoutEffect(() => {
    if (!arriving || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const cast = [...ref.current!.querySelectorAll('[data-lc-influence]')]
    shadows.current = cast.map(element => arriveShadow(element, 800))
    return () => {
      for (const run of shadows.current) run.stop()
      shadows.current = []
      for (const element of cast) element.setAttribute('data-lc-strength', String(FIELD_SHADOW))
    }
  }, [arriving])
  useLayoutEffect(() => {
    for (const run of shadows.current) { if (playing) run.play(); else run.pause() }
  }, [playing])
  return <div ref={ref} className="continuous-extra" data-arriving={arriving}>{children}</div>
}

function FloatingCard({ slot, children }: { slot: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const float = useRef<Animation | null>(null)
  const playing = useContext(Playback)
  useLayoutEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const drift = startFloat(ref.current!, slot + 1)
    drift.playbackRate = .75
    void drift.finished.catch(() => {})
    float.current = drift
    return () => { drift.cancel(); float.current = null }
  }, [slot])
  useLayoutEffect(() => {
    if (playing && float.current?.playState === 'paused') float.current.play()
    else if (!playing) float.current?.pause()
  }, [playing])
  return <div ref={ref} className="continuous-card-drift">{children}</div>
}

function AnswerOption({ slot, question, retained, onSelect, authoritativeCopy }: {
  slot: number; question: QuestionPresentation; retained: boolean; onSelect: (id: string) => void; authoritativeCopy: boolean
}) {
  const { scope, present } = useSoftPresence('card', slot)
  const option = question.options[slot]
  const artwork = question.layout === 'grid' ? referenceCards[option.id] : undefined
  const photo = question.layout === 'photo'
  const gender = question.layout === 'gender'
  const cameraPreview = question.product === 'vk-video' && option.id === 'hero'
  const playing = useContext(Playback)
  const tone = question.product === 'max' ? slot % 2 ? 'cyan' : 'violet' : photo || gender ? slot === 0 ? 'red' : 'blue' : 'blue'
  const position = answerCardPosition({ slot, product: question.product, layout: question.layout, choiceCount: question.options.length })
  return (
    <div ref={scope} className={`continuous-option continuous-option--${question.layout}`} inert={!present} aria-hidden={!present || undefined}
      style={{ opacity: 0, transform: 'translateY(-24px) scale(.98)', ...position }}>
      <FloatingCard slot={slot}>
        <RingTag disabled={!present} tone={tone} className={`${photo ? slot === 0 ? 'primary-button' : 'secondary-button' : gender ? 'gender-option' : 'option-button'} ${artwork ? 'option-button--reference' : ''}`}
          shadowStrength={present ? FIELD_SHADOW : 0} data-option-id={option.id} data-retained={retained}
          aria-label={gender ? option.id === 'male' ? 'Мужской' : 'Женский' : option.label} onClick={() => { if (present) onSelect(option.id) }}>
          <AnimatePresence initial={false} mode="sync">
            <Copy key={option.id}>
              {/* Presence owns removal: keep video attached throughout the visible exit. */}
              {cameraPreview ? <CameraPreview active={playing} />
                : artwork && <img className="reference-card-artwork" src={artwork} alt="" aria-hidden="true" draggable={false} />}
              <span className="continuous-card-label">{question.product === 'vk-video' && !authoritativeCopy ? vkCardLines[option.id] ?? option.label : option.label}</span>
              {photo && slot === 1 && <ChevronRight className="continuous-photo-chevron" aria-hidden="true" />}
            </Copy>
          </AnimatePresence>
        </RingTag>
      </FloatingCard>
    </div>
  )
}

/** Keep the selected answer through tag batches, then retire it with the final exit. */
export function ContinuousQuestions({ question, reveal, playing, onSelect, onBack, onComplete, children, interactionKey, showProductMark = true, interactive = true, authoritativeCopy = false, backEnabled = true }: {
  question: QuestionPresentation; reveal: TagReveal | null; playing: boolean; onSelect: (id: string) => void
  onBack: () => void; onComplete: (reveal: TagReveal) => void; children?: ReactNode; interactionKey?: boolean
  showProductMark?: boolean
  interactive?: boolean
  authoritativeCopy?: boolean
  backEnabled?: boolean
}) {
  const phase = useMemo(() => ({ id: question.id }), [question.id])
  const gatePhase = useMemo(() => ({ phase, interactionKey }), [phase, interactionKey])
  const [readyPhase, setReadyPhase] = useState<typeof phase | null>(null)
  const [closingReveal, setClosingReveal] = useState<TagReveal | null>(null)
  const headingReady = useCallback(() => setReadyPhase(phase), [phase])
  const selected = question.selectedIndex
  const closing = question.answering && (!reveal || closingReveal === reveal)
  const hidePhotoCopy = question.layout === 'photo' && question.answering
  const enabled = playing && interactive && readyPhase === phase && !question.answering
  const body = useRef<HTMLDivElement>(null)
  const focusedPhase = useRef<typeof phase | null>(null)
  useLayoutEffect(() => {
    if (enabled && focusedPhase.current !== phase) {
      body.current?.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true })
      focusedPhase.current = phase
    }
  }, [enabled, phase])
  return (
    <Playback.Provider value={playing}>
      <section className={`screen continuous-vk experience--${question.product} continuous--${question.layout}`} data-choice-count={question.options.length} aria-label={`Вопросы ${question.product === 'max' ? 'MAX' : 'VK Видео'}`} data-motion="continuous-questions">
        {showProductMark && <ProductMark product={question.product} />}
        <div ref={body} className="continuous-question" data-question-id={question.id} inert={!enabled}>
          <RingActions playing={enabled} phaseKey={gatePhase}>
            <div className="question-heading" hidden={hidePhotoCopy} data-lc-influence="shadow" data-lc-strength="0.5">
              <AnimatePresence initial={false} mode="sync">
                <Copy key={question.id} heading onReady={headingReady}>
                  <h1 tabIndex={-1} id={`continuous-question-${question.id}`}>{question.prompt}</h1>
                </Copy>
              </AnimatePresence>
            </div>
            {question.description && <p className="digitize-description" hidden={hidePhotoCopy}>{question.description}</p>}
            <AnimatePresence initial={false} mode="sync">
              {question.options.map((option, slot) => !closing && (selected === undefined || selected === slot) && (
                <AnswerOption key={`${question.id}:${option.id}`} slot={slot} question={question} retained={selected === slot}
                  authoritativeCopy={authoritativeCopy} onSelect={id => { if (enabled) onSelect(id) }} />
              ))}
            </AnimatePresence>
            {!question.answering && <>
              {children && <Extra key={`extra:${question.id}`} withQuestion={readyPhase !== phase}>{children}</Extra>}
              {backEnabled && <Extra key={`back:${question.id}`} withQuestion={readyPhase !== phase}><BackButton product={question.product} onClick={() => { if (enabled) onBack() }} /></Extra>}
            </>}
          </RingActions>
        </div>
        {reveal && <AnswerFlight embedded flightDurationScale={1.25} reveal={reveal} playing={playing} onComplete={onComplete} onFinalExit={setClosingReveal} />}
      </section>
    </Playback.Provider>
  )
}
