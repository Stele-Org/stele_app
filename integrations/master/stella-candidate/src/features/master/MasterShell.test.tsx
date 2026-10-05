// @vitest-environment jsdom
import {act,useEffect} from 'react'
import {createRoot,type Root} from 'react-dom/client'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
const log=vi.hoisted(()=>({vk:0,max:0,vkDispose:0,maxStop:0}))
vi.mock('./MasterSlice',()=>({MasterSlice:({onSelectMax}:{onSelectMax:()=>void})=>{
 useEffect(()=>{log.vk++;return()=>{log.vkDispose++}},[])
 return <button onClick={onSelectMax}>MAX branch</button>
}}))
vi.mock('../master-max/MasterMaxSlice',()=>({MasterMaxSlice:({onExit}:{onExit:()=>void})=>{
 useEffect(()=>{log.max++;return()=>{log.maxStop++}},[])
 return <button onClick={onExit}>Return home</button>
}}))
import {MasterShell} from './MasterShell'
let root:Root,host:HTMLDivElement
beforeEach(()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);sessionStorage.clear()
 Object.assign(log,{vk:0,max:0,vkDispose:0,maxStop:0})
 host=document.createElement('div');document.body.append(host);root=createRoot(host)
})
afterEach(()=>{act(()=>root.unmount());host.remove();vi.unstubAllGlobals()})
function fixture(protocol:string|null){
 return vi.fn(async(path:string)=>({ok:true,json:async()=>path==='/health'?{ready:true,instanceKey:'dataset'}:
  path==='/stations/stella-main'?{sessionId:protocol?'current-session':null}:
  {state:{sessionId:'current-session',protocol}}}))
}
it('recovers occupied MAX directly on reload without mounting VK, ignoring a stale presentation hint',async()=>{
 sessionStorage.setItem('production-stella-presentation-v1','vk')
 const request=fixture('stella-max-v1');vi.stubGlobal('fetch',request)
 await act(async()=>root.render(<MasterShell apiBase=""/>))
 expect(log.max).toBe(1);expect(log.vk).toBe(0)
 expect(sessionStorage.getItem('production-stella-presentation-v1')).toBe('max')
 expect(request.mock.calls.map(call=>call[0])).toEqual(['/health','/stations/stella-main','/sessions/current-session'])
})
it('selecting MAX disposes VK; returning stops MAX and rechecks authority before mounting any client',async()=>{
 const request=fixture(null);vi.stubGlobal('fetch',request)
 await act(async()=>root.render(<MasterShell apiBase=""/>))
 expect(log.vk).toBe(1)
 await act(async()=>host.querySelector('button')!.click())
 expect(log.vkDispose).toBe(1);expect(log.max).toBe(1)
 request.mockRejectedValue(Error('offline'))
 await act(async()=>host.querySelector('button')!.click())
 expect(log.maxStop).toBe(1);expect(log.vk).toBe(1)
 expect(host.textContent).toContain('offline');expect(host.textContent).not.toContain('MAX branch')
 request.mockImplementation(fixture('stella-max-v1'))
 await act(async()=>host.querySelector('button')!.click())
 expect(log.max).toBe(2);expect(log.vk).toBe(1)
})
it('blocked bootstrap never mounts a client or enables admission',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({ready:false})})))
 await act(async()=>root.render(<MasterShell apiBase=""/>))
 expect(log.vk+log.max).toBe(0);expect(host.textContent).toContain('Мастер ещё не готов')
})
