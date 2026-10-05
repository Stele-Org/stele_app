import { useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { InfluenceHandle } from 'lumicells/core'
import type { LumiCellsElement } from 'lumicells/element'
import { Choreographer } from '../vendor/lumicells-scene/choreography'
import type { BubbleEntry } from '../vendor/lumicells-scene/bubbles'
import { COLOR_BLUE, COLOR_RED, type DemoSceneProps } from '../vendor/lumicells-scene/types'
import '../vendor/lumicells-scene/scene.css'
import type { TagReveal } from '../features/prototype/tag-reveal'
import { ProductMark } from './ProductMark'
import { referenceCards } from './ux-artwork'
import { clearTagPositions, dissolveTagBox, tagPositions } from '../features/prototype/tag-layout'
import { answerCardPosition } from '../features/prototype/answer-card-layout'
import { ringToneColors } from './RingTag'
import { CameraPreview } from './CameraPreview'
import { AnswerStream } from './answer-stream'
import './answer-stream.css'
import { TagDissolve } from './tag-dissolve'
import './tag-dissolve.css'
import { readTagLook } from '../features/prototype/tag-look'

export function AnswerFlight({ reveal, playing, onComplete, onFinalExit, embedded = false, flightDurationScale = 1, showProductMark = true }: {
  reveal: TagReveal; playing: boolean; onComplete: (reveal: TagReveal) => void; onFinalExit?: (reveal: TagReveal) => void; embedded?: boolean; flightDurationScale?: number
  showProductMark?: boolean
}) {
  const root = useRef<HTMLDivElement>(null)
  const choreographer = useRef<Choreographer | TagDissolve | null>(null)
  const dots = useRef<HTMLCanvasElement>(null)
  const stream = useRef<AnswerStream | null>(null)
  const [batch, setBatch] = useState(0)
  const [seed] = useState(() => Math.floor(Math.random() * 0x100000000))
  // VK Видео follows the accepted Claude Design scene; MAX keeps the LumiCells flight.
  const dissolve = reveal.product === 'vk-video'
  const [look] = useState(() => readTagLook(typeof window === 'undefined' ? '' : window.location.search))
  const tags = reveal.batches[batch]
  const card = reveal.answerCard
  const cameraPreview = reveal.product === 'vk-video' && card?.artworkId === 'hero'
  const artwork = card?.artworkId && referenceCards[card.artworkId]
  const cardPosition = useMemo(() => card ? answerCardPosition({ slot: card.index, product: reveal.product,
    layout: card.photo ? 'photo' : 'grid', choiceCount: card.centered ? 3 : 4 }) : undefined, [card, reveal.product])
  // VK Видео tags keep clear of the answer card; MAX keeps its regions.
  const positions = useMemo(() => dissolve && card && cardPosition
    ? clearTagPositions({ ...cardPosition, photo: Boolean(card.photo) }, tags.map((tag, i) => dissolveTagBox(tag, i === 0)), seed, batch)
    : tagPositions(card, seed, batch), [dissolve, card, cardPosition, tags, seed, batch])
  const finalExit = useEffectEvent(() => onFinalExit?.(reveal))

  useLayoutEffect(() => {
    const host = root.current!
    const retained = host.closest('.continuous-vk')?.querySelector<HTMLElement>('[data-retained="true"]')
    const answer = retained ?? host.closest('.answer-flight')?.querySelector<HTMLElement>('.answer-flight__answer') ?? null
    const visual = new AnswerStream(host.querySelector<HTMLElement>('.lc-scene-stage')!, answer, cardPosition,
      ringToneColors[card?.tone ?? (reveal.product === 'max' ? 'violet' : 'blue')],
      window.matchMedia('(prefers-reduced-motion: reduce)').matches, seed)
    stream.current = visual
    return () => { visual.dispose(); stream.current = null }
  }, [reveal, card, cardPosition, seed])

  useLayoutEffect(() => {
    const host = root.current!
    const ring = host.closest('lumi-cells') as LumiCellsElement | null
    const elements = Array.from(host.querySelectorAll<HTMLElement>('.lc-scene-bubble'))
    const records = elements.map((el, i) => ({ el, color: reveal.product === 'max' ? (i === 0 ? '#00BFFF' : '#6E1AFF') : (i === 0 ? COLOR_BLUE : COLOR_RED), live: false, handle: null as InfluenceHandle | null }))
    const bind = () => {
      if (!ring?.instance) return
      for (const rec of records) {
        if (!rec.handle) rec.handle = ring.instance.bindElement(rec.el, {
          track: 'auto', type: 'shadow', falloff: 2.5, strength: rec.live ? 1 : 0,
        })
      }
    }
    const entries: BubbleEntry[] = records.map((rec, i) => ({
      el: rec.el,
      item: { id: String(i), kind: i === 0 ? 'primary' : 'topic', ...positions[i], h: 26, order: i },
      info: () => ({ id: String(i), label: tags[i], kind: i === 0 ? 'primary' : 'topic', color: rec.color, selected: i === 0 }),
      resetHover: () => rec.el.removeAttribute('data-hover'),
    }))
    let exitNotified = false
    const hooks: DemoSceneProps = {
      onFlight: (el, _info, phase) => {
        const rec = records.find(record => record.el === el)!
        const index = records.indexOf(rec)
        const entering = host.dataset.phase === 'entering'
        if (phase === 'start' && !dissolve) {
          if (entering) stream.current?.enterTag(el, positions[index], index, 920 * flightDurationScale)
          else stream.current?.leaveTag(el, positions[index], index, 640 * flightDurationScale)
        }
        if (!dissolve && host.dataset.phase === 'leaving' && phase === 'start' && batch === reveal.batches.length - 1 && !exitNotified) {
          exitNotified = true
          finalExit()
        }
        if (entering && phase === 'start') rec.live = true
        if (!entering && phase === 'end') rec.live = false
        rec.handle?.update({ strength: rec.live ? 1 : 0 })
        if (!entering || !ring?.instance) return
        const source = host.closest('.continuous-vk')?.querySelector<HTMLElement>('[data-retained="true"]')
          ?? host.closest('.answer-flight')?.querySelector<HTMLElement>('.answer-flight__answer')
        const rect = (phase === 'start' ? source ?? host : el).getBoundingClientRect()
        ring.instance.pulse({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, space: 'client',
          // All echoes belong to the selected answer, not to decorative tag-outline colors.
          strength: phase === 'start' ? .25 : .3,
          color: ringToneColors[reveal.answerCard?.tone ?? (reveal.product === 'max' ? 'violet' : 'blue')], colorMix: 1 })
      },
    }
    bind()
    ring?.addEventListener('lc-ready', bind)
    const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const box = stream.current?.box ?? { x: .46, y: .46, w: .08, h: .08 }
    const last = batch === reveal.batches.length - 1
    const answer = host.closest('.continuous-vk')?.querySelector<HTMLElement>('[data-retained="true"]')
      ?? host.closest('.answer-flight')?.querySelector<HTMLElement>('.answer-flight__answer') ?? null
    const motion = dissolve
      ? new TagDissolve(host, () => entries, () => hooks, {
        canvas: dots.current, seed: seed + batch, reduced: reduced(),
        // The answer thins out while the dots of the last batch gather and leave.
        retiring: last ? answer : null,
        // Stage fractions to the 1080px-wide screen; the stage starts 100px below its top.
        card: { x: box.x * 1080, y: box.y * 1080 + 100, w: box.w * 1080, h: box.h * 1080 },
        // By then the answer has faded with the dots; it retires with the last batch.
        onClosing: () => {
          if (!last || exitNotified) return
          exitNotified = true
          finalExit()
        },
      })
      : new Choreographer(host, () => entries, () => hooks, reduced, flightDurationScale, stream.current?.route)
    choreographer.current = motion
    void motion.revealOnce(350, () => {
      if (batch + 1 < reveal.batches.length) setBatch(batch + 1)
      else onComplete(reveal)
    })
    return () => {
      motion.dispose()
      ring?.removeEventListener('lc-ready', bind)
      for (const rec of records) rec.handle?.dispose()
      choreographer.current = null
    }
  }, [reveal, onComplete, batch, tags, positions, flightDurationScale, dissolve, seed])

  useLayoutEffect(() => {
    choreographer.current?.setPlaying(playing)
    stream.current?.setPlaying(playing)
  }, [playing, reveal, batch])

  return (
    <section className={`screen answer-flight answer-flight--${reveal.product}`} data-has-answer={Boolean(card)} data-description={Boolean(reveal.description)} aria-label="Метаданные ответа" data-motion="lumicells-native-flight" data-effect={dissolve ? 'discovery-dots' : 'digital-answer-stream'} data-tag-look={dissolve ? look : undefined}>
      {!embedded && showProductMark && <ProductMark product={reveal.product} />}
      {!embedded && <div className={card ? 'question-heading' : 'progress-copy'} data-lc-influence="shadow" data-lc-strength="0.35"><h1>{reveal.prompt ?? reveal.label}</h1>{reveal.description && <p>{reveal.description}</p>}</div>}
      {!embedded && card && (
        <div className={`ring-tag ring-tag--${card.tone} ${card.photo ? 'primary-button' : 'option-button'} ${artwork ? 'option-button--reference' : ''} ${cameraPreview ? 'answer-flight__answer--camera' : ''} answer-flight__answer`}
          style={cardPosition}
          role="group" aria-label="Выбранный ответ" data-lc-influence="shadow" data-lc-strength="1" data-lc-falloff="2.5" data-lc-padding="12" data-lc-color-mix="0.55"
          data-lc-color={{ blue: '#0077FF', red: '#FF2B42', violet: '#6E1AFF', cyan: '#00BFFF' }[card.tone]}>
          {cameraPreview ? <CameraPreview active={playing} /> : artwork && <img className="reference-card-artwork" src={artwork} alt="" draggable={false} />}
          <span className="answer-flight__label">{reveal.label}</span>
        </div>
      )}
      <p className="visually-hidden" role="status">{reveal.label}. {tags.join(', ')}.</p>
      <div ref={root} aria-hidden="true" className="lc-scene answer-flight__visuals">
        {dissolve && <canvas ref={dots} className="tag-dissolve__canvas" />}
        <div className="lc-scene-stage">
          {tags.map((tag, i) => (
            <div key={`${batch}:${tag}`} className="lc-scene-slot" style={{ left: `${positions[i].fx * 100}%`, top: `${positions[i].fy * 100}%` }}>
              <span className={`lc-scene-bubble lc-scene-pill ${dissolve ? 'tag-dissolve__tag' : 'lc-scene-stream-tag'}`} data-kind={i === 0 ? 'primary' : 'topic'} data-selected={i === 0 ? '' : undefined} data-tone={dissolve ? i % 2 ? 'red' : 'blue' : undefined}>
                <span className="lc-scene-label">{tag}</span>
                {!dissolve && <span className="answer-stream-code">{`0${i + 1} / ${[...tag].length.toString(16).toUpperCase()} · 0101`}</span>}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
