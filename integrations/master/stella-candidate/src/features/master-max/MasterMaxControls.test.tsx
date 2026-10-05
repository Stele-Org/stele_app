// @vitest-environment jsdom
import {act,type ReactNode} from 'react'
import {createRoot} from 'react-dom/client'
import {afterEach,expect,it,vi} from 'vitest'
import type {MaxSnapshot} from './max-client.mjs'
const mocks=vi.hoisted(()=>({emit:null as null|((state:MaxSnapshot)=>void),begin:vi.fn(async()=>{})}))
vi.mock('./max-client.mjs',()=>({createMaxClient:({onChange}:{onChange:(state:MaxSnapshot)=>void})=>{mocks.emit=onChange;return{refresh:async()=>{},stop:()=>{},begin:mocks.begin,quiz:async()=>{},retry:async()=>{}}}}))
vi.mock('../../components/RingScene',()=>({RingScene:({children}:{children:ReactNode})=><div>{children}</div>}))
vi.mock('../../service',()=>({useServicePlaying:()=>true,markServiceReady:async()=>{}}))
// RingActions, RingTag and RingCue are real: technical controls must not consume their one-shot cue.
import {MasterMaxSlice} from './MasterMaxSlice'
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.clearAllMocks()})
it('expired-session new-quiz and service selection remain retryable across real RingActions and polling',async()=>{
 vi.useFakeTimers();vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});vi.stubGlobal('matchMedia',()=>({matches:false}))
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host),exit=vi.fn();
 const expired:MaxSnapshot={health:{instanceKey:'dataset'},station:{sessionId:null},session:{protocol:'stella-max-v1',sessionId:'old-session',phase:'expired',screen:'audience',revision:1,answers:{},actions:[],definition:{questions:[],missions:[]}},game:{waitingCount:0,gameBusy:false},available:true,fresh:true,online:true,busy:false,pending:null,error:'',notice:'',storageError:'',canRetry:false};
 const button=(label:string)=>[...host.querySelectorAll('button')].find(item=>item.textContent===label)!
 await act(async()=>root.render(<MasterMaxSlice onExit={exit}/>));act(()=>mocks.emit!(expired));
 expect(host.querySelector('.master-slice-status')).toBeNull();expect(host.querySelector('.master-visitor-status')).toBeNull()
 await act(async()=>button('Начать новый квиз').click());expect(mocks.begin).toHaveBeenCalledTimes(1)
 act(()=>{mocks.emit!({...expired,refreshing:true,busy:false,available:true});vi.advanceTimersByTime(750);mocks.emit!(expired)})
 await act(async()=>button('Начать новый квиз').click());expect(mocks.begin).toHaveBeenCalledTimes(2)
 await act(async()=>button('Выбор сервиса').click());expect(exit).toHaveBeenCalledTimes(1)
 act(()=>root.unmount());host.remove()
})
