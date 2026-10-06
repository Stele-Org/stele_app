import { TEST_BUILD } from '../../app/test-build'

/**
 * The start screen greets only when the page is opened with `?greeting=1` (user decision, 06.10.2026).
 * The greeting starts by itself when the start screen appears. A tap that chooses a product must never
 * be what starts it: a browser that holds sound back until the first tap would otherwise play it right then.
 * A test build (app/test-build.ts) greets without being asked, since its link is opened as it is; `?greeting=0`
 * turns that off.
 */
export function readGreeting(search: string, testBuild: boolean = TEST_BUILD): boolean {
  const value = new URLSearchParams(search).get('greeting')
  return value === '1' || (testBuild && value !== '0')
}

/** Whether a tap landed on one of the product logos of the start screen. */
export function isProductChoice(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('.product-tag') !== null
}
