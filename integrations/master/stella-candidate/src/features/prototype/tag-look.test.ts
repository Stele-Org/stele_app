import { expect, it } from 'vitest'
import { readTagLook } from './tag-look'

it('defaults to the gradient frame and switches to the solid fill on request', () => {
  expect(readTagLook('')).toBe('gradient')
  expect(readTagLook('?master=1')).toBe('gradient')
  expect(readTagLook('?tagLook=gradient')).toBe('gradient')
  expect(readTagLook('?tagLook=unknown')).toBe('gradient')
  expect(readTagLook('?master=1&tagLook=solid')).toBe('solid')
})