import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { normalizeConfig } from 'lumicells/schema'
import { QuestionScreen } from './QuestionScreen'
import { ringSceneConfig, type RingPhase } from './ring-scene-config'
import { vkQuestions } from '../content/vkVideo'
import { maxAudienceOptions, maxGoalOptions, maxPrompts } from '../content/max'
import { RingTag, ringToneColors, type TagTone } from './RingTag'

describe('ring interface preserves scenario inputs', () => {
  it.each<TagTone>(['blue', 'red', 'violet', 'cyan'])('uses the %s button color for its native pulse', tone => {
    const html = renderToStaticMarkup(<RingTag tone={tone}>Answer</RingTag>)
    expect(html).toContain(`ring-tag--${tone}`)
    expect(html).toContain('data-lc-pulse="click"')
    expect(html).toContain('data-lc-influence="shadow"')
    expect(html).toContain(`data-lc-color="${ringToneColors[tone]}"`)
  })
  const questions = [
    ...vkQuestions.map(q => ({ ...q, product: 'vk-video' as const })),
    { product: 'max' as const, prompt: maxPrompts.audience, options: maxAudienceOptions },
    { product: 'max' as const, prompt: maxPrompts.goal, options: maxGoalOptions },
  ]
  it.each(questions)('every original option in $prompt is a native ring tag', q => {
    const html = renderToStaticMarkup(<QuestionScreen {...q} onSelect={() => {}} onBack={() => {}} />)
    expect(html).toContain(q.prompt)
    for (const option of q.options) expect(html).toContain(option.label)
    expect(html.match(/data-lc-pulse="click"/g)).toHaveLength(q.options.length + 1)
    expect(html).not.toContain('data-lc-lift')
    expect(html).not.toContain('data-lc-influence="light"')
    expect(html).not.toMatch(/\.webp|result-orbit|background-image/)
  })
  it.each<RingPhase>(['entry', 'brand-entry', 'intro', 'question', 'photo', 'processing', 'result', 'terms'])('keeps the same native bindings without a visible ring in %s', phase => {
    const config = ringSceneConfig(phase)
    expect(config.modes?.sphere?.weight).toBe(0)
    expect(config.modes?.flow?.weight).toBe(0.15)
    expect(config.color?.palette).toEqual(ringSceneConfig('entry').color?.palette)
    expect(config.interaction?.pointer).toBe(false)
    expect(config.interaction?.click).toBe(false)
    // Exercise the real pinned engine schema: no silently rejected/clamped visual settings.
    const normalized = normalizeConfig(config)
    expect(normalized.issues).toEqual([])
    expect(normalized.config.lift.enabled).toBe(false)
    expect(normalized.config.modes.rain.weight).toBe(0)
  })
})
