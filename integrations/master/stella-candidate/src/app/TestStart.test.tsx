// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { TestStart } from './TestStart'
import { TEST_BUILD } from './test-build'

let root: Root, host: HTMLDivElement
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals() })

it('is off unless the build is made as a test build', () => {
  expect(TEST_BUILD).toBe(false)
})

it('starts the application only after one press, so that the greeting may sound', () => {
  const mounted = vi.fn()
  function Application() { mounted(); return <h1>Стелла</h1> }
  act(() => root.render(<TestStart><Application /></TestStart>))
  expect(mounted).not.toHaveBeenCalled()
  expect(host.textContent).toContain('тестовая версия')
  act(() => host.querySelector('button')!.click())
  expect(mounted).toHaveBeenCalled()
  expect(host.querySelector('h1')!.textContent).toBe('Стелла')
  expect(host.querySelector('button')).toBeNull()
})
