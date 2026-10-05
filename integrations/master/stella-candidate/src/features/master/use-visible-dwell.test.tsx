// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { useVisibleDwell } from './use-visible-dwell'

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
it('counts 20 visible active seconds, survives polling and pauses, and gives each session a full timer', () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  let hidden = false
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden)
  const done = vi.fn()
  function Subject({ id, playing }: { id: string | null; playing: boolean }) {
    useVisibleDwell(id, 20000, playing, done); return null
  }
  const host = document.createElement('div'), root = createRoot(host)
  const render = (id: string | null, playing = true) => act(() => root.render(<Subject id={id} playing={playing} />))
  try {
    render('first'); act(() => vi.advanceTimersByTime(7000)); render('first')
    hidden = true; act(() => document.dispatchEvent(new Event('visibilitychange')))
    act(() => vi.advanceTimersByTime(30000)); expect(done).not.toHaveBeenCalled()
    hidden = false; act(() => document.dispatchEvent(new Event('visibilitychange')))
    act(() => vi.advanceTimersByTime(5000)); render('first', false)
    act(() => vi.advanceTimersByTime(30000)); expect(done).not.toHaveBeenCalled()
    render('first'); act(() => vi.advanceTimersByTime(7999)); expect(done).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1)); expect(done).toHaveBeenCalledOnce()
    render('first'); act(() => vi.advanceTimersByTime(30000)); expect(done).toHaveBeenCalledOnce()
    render('second'); act(() => vi.advanceTimersByTime(19999)); expect(done).toHaveBeenCalledOnce()
    act(() => vi.advanceTimersByTime(1)); expect(done).toHaveBeenCalledTimes(2)
    render(null)
  } finally { act(() => root.unmount()) }
})
