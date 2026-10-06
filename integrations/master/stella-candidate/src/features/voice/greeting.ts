/**
 * The start screen greets only when the page is opened with `?greeting=1` (user decision, 06.10.2026).
 * The greeting starts by itself when the start screen appears. A tap that chooses a product must never
 * be what starts it: a browser that holds sound back until the first tap would otherwise play it right then.
 */
export function readGreeting(search: string): boolean {
  return new URLSearchParams(search).get('greeting') === '1'
}

/** Whether a tap landed on one of the product logos of the start screen. */
export function isProductChoice(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('.product-tag') !== null
}
