// @vitest-environment jsdom
import {act} from 'react'
import {createRoot} from 'react-dom/client'
import {expect,it,vi} from 'vitest'
import {PhotoReveal} from './PhotoReveal'
it('keeps photo completion but suppresses the obsolete activation screen text',()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true)
  const host=document.createElement('div'),root=createRoot(host)
  try {
    act(()=>root.render(<PhotoReveal title="Технологии Discovery активированы" hideCopy playing={false} onComplete={()=>{}}/>))
    expect(host.querySelector('h1')).toBeNull()
    expect(host.textContent).not.toContain('активированы')
  } finally {act(()=>root.unmount());vi.unstubAllGlobals()}
})
it('installed Motion pauses then finishes once despite repeated snapshot renders; unmount cancels completion',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true)
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const done=vi.fn()
  const render=(playing:boolean)=>act(()=>root.render(<PhotoReveal title="Server choice" playing={playing} onComplete={done}/>))
  try {
    render(false);await act(async()=>{await new Promise(r=>setTimeout(r,700))});expect(done).not.toHaveBeenCalled()
    render(true)
    for(let n=0;n<4;n++){await act(async()=>{await new Promise(r=>setTimeout(r,220))});render(true)}
    expect(done).toHaveBeenCalledOnce()
  } finally {act(()=>root.unmount());host.remove();vi.unstubAllGlobals()}
})
