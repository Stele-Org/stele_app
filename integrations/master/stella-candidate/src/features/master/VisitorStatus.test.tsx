// @vitest-environment jsdom
import {act} from 'react'
import {createRoot} from 'react-dom/client'
import {expect,it,vi} from 'vitest'
import {VisitorStatus,operatorToolsEnabled} from './VisitorStatus'

it('keeps retry reachable outside operator controls; healthy presentation has no overlay',()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true)
  const host=document.createElement('div'),root=createRoot(host),refresh=vi.fn(),retry=vi.fn()
  act(()=>root.render(<VisitorStatus fault={false} pending={false} paused={false} refresh={refresh}/>))
  expect(host.childElementCount).toBe(0)
  expect(operatorToolsEnabled()).toBe(false)
  act(()=>root.render(<VisitorStatus fault pending paused={false} refresh={refresh} retry={retry}/>))
  act(()=>host.querySelectorAll('button')[0].click())
  act(()=>host.querySelectorAll('button')[1].click())
  expect(refresh).toHaveBeenCalledOnce();expect(retry).toHaveBeenCalledOnce()
  expect(host.textContent).not.toMatch(/revision|MASTER|серверный квиз/)
  act(()=>root.unmount());vi.unstubAllGlobals()
})
