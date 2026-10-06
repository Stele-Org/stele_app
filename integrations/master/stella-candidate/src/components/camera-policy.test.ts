import { expect, it } from 'vitest'
import { readCameraPolicy } from './camera-policy'

it('opens any camera only when the dev server is asked to', () => {
  expect(readCameraPolicy('?camera=any', true)).toBe('any-local')
  expect(readCameraPolicy('?reveal=series&camera=any', true)).toBe('any-local')
  expect(readCameraPolicy('', true)).toBe('unique-brio-exact')
  expect(readCameraPolicy('?camera=1', true)).toBe('unique-brio-exact')
  expect(readCameraPolicy('?camera=ANY', true)).toBe('unique-brio-exact')
})

it('keeps the stand on its BRIO whatever the address says: a build has no switch', () => {
  expect(readCameraPolicy('?camera=any', false, false)).toBe('unique-brio-exact')
  expect(readCameraPolicy('?master=1&camera=any', false, false)).toBe('unique-brio-exact')
})

it('opens any camera in a test build without being asked: testers have no BRIO', () => {
  expect(readCameraPolicy('', false, true)).toBe('any-local')
  expect(readCameraPolicy('?greeting=1', false, true)).toBe('any-local')
})
