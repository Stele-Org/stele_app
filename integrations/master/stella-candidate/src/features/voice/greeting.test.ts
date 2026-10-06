import { expect, it } from 'vitest'
import { readGreeting } from './greeting'

it('greets only when asked to, on the stand and in the dev server', () => {
  expect(readGreeting('', false)).toBe(false)
  expect(readGreeting('?greeting=1', false)).toBe(true)
  expect(readGreeting('?master=1&greeting=1', false)).toBe(true)
  expect(readGreeting('?greeting=0', false)).toBe(false)
  expect(readGreeting('?greeting=yes', false)).toBe(false)
})

it('greets in a test build without being asked, unless it is turned off', () => {
  expect(readGreeting('', true)).toBe(true)
  expect(readGreeting('?greeting=1', true)).toBe(true)
  expect(readGreeting('?greeting=0', true)).toBe(false)
})
