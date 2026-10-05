import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProductEntry, PRODUCT_ENTRY_MS } from './product-entry'

describe('product logo entry phase', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] }))
  afterEach(() => vi.useRealTimers())

  it('commits the first choice once even when both cards are tapped rapidly', () => {
    const commit = vi.fn()
    const entry = new ProductEntry(commit)
    expect(entry.choose('vk-video', false)).toBe(true)
    expect(entry.choose('max', false)).toBe(false)
    vi.advanceTimersByTime(PRODUCT_ENTRY_MS - 1)
    expect(commit).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(commit).toHaveBeenCalledExactlyOnceWith('vk-video')
    expect(entry.choose('max', false)).toBe(false)
  })

  it('freezes an accepted choice on pause and resumes only the remaining cue', () => {
    const commit = vi.fn()
    const entry = new ProductEntry(commit)
    entry.choose('max', false)
    vi.advanceTimersByTime(120)
    entry.setPlaying(false)
    vi.advanceTimersByTime(5000)
    expect(commit).not.toHaveBeenCalled()
    entry.setPlaying(true)
    vi.advanceTimersByTime(PRODUCT_ENTRY_MS - 121)
    expect(commit).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(commit).toHaveBeenCalledExactlyOnceWith('max')
  })

  it('cancels its completion when the splash is unmounted', () => {
    const commit = vi.fn()
    const entry = new ProductEntry(commit)
    entry.choose('max', false)
    entry.dispose()
    vi.runAllTimers()
    expect(commit).not.toHaveBeenCalled()
  })

  it('rejects paused input and skips the visual wait with reduced motion', () => {
    const commit = vi.fn()
    const entry = new ProductEntry(commit)
    entry.setPlaying(false)
    expect(entry.choose('max', true)).toBe(false)
    entry.setPlaying(true)
    expect(entry.choose('max', true)).toBe(true)
    vi.advanceTimersByTime(0)
    expect(commit).toHaveBeenCalledExactlyOnceWith('max')
  })
})
