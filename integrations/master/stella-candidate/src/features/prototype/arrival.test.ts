import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { ARRIVE_EASE, ARRIVE_LEAD_MS, ARRIVE_MS, ARRIVE_STAGGER_MS } from './arrival'
import { PRODUCT_ENTRY_MS } from './product-entry'

const css = readFileSync(new URL('../../styles/global.css', import.meta.url), 'utf8')

it('keeps the onboarding cascade, the brand splash and the answer cards on one arrival rhythm', () => {
  const curve = `cubic-bezier(${ARRIVE_EASE.map(value => String(value).replace(/^0\./, '.')).join(', ')})`
  expect(css).toContain(`animation: soft-arrive ${ARRIVE_MS}ms ${curve} backwards`)
  const delays = [...css.matchAll(/\.screen--onboarding (?:\.onboarding-step \+ )*\.onboarding-step \{ animation-delay: (\d+)ms; \}/g)].map(match => Number(match[1]))
  expect(delays).toHaveLength(3)
  expect(delays[0]).toBe(ARRIVE_LEAD_MS)
  expect(delays[1] - delays[0]).toBe(ARRIVE_STAGGER_MS)
  expect(delays[2] - delays[1]).toBe(ARRIVE_STAGGER_MS)

  // Around the question cards: the photo description and the controls that mount with the question.
  expect(css).toContain(`.continuous-question .digitize-description, .continuous-extra[data-arriving='true'] > * { animation: soft-arrive ${ARRIVE_MS}ms ${curve} backwards; }`)

  // The splash spends one arrival on each of its thirds: in, hold, out.
  expect(PRODUCT_ENTRY_MS).toBe(3 * ARRIVE_MS)
  expect(css).toContain(`animation: brand-logo-arrive ${PRODUCT_ENTRY_MS}ms`)
  expect(css).toContain(`0% { opacity: 0; transform: translate(-50%, 24px) scale(.96); animation-timing-function: ${curve}; }`)
  expect(css).toContain('33.333%, 66.667% {')
})
