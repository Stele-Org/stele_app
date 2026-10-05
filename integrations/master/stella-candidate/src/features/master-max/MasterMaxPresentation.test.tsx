// @vitest-environment jsdom
import {act,type ReactNode} from 'react'
import {createRoot,type Root} from 'react-dom/client'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import type {MaxSnapshot} from './max-client.mjs'
const mocks=vi.hoisted(()=>({emit:null as null|((s:MaxSnapshot)=>void),quiz:vi.fn(),audio:vi.fn(),hostPlaying:true}))
vi.mock('../master/useMasterMaxAudio',()=>({useMasterMaxAudio:mocks.audio}))
vi.mock('./max-client.mjs',()=>({createMaxClient:({onChange}:{onChange:(s:MaxSnapshot)=>void})=>{
 mocks.emit=onChange;return{refresh:async()=>{},stop(){},begin:async()=>{},quiz:mocks.quiz,retry:async()=>{}}
}}))
vi.mock('../../components/RingScene',()=>({RingScene:({children,playing}:{children:ReactNode;playing:boolean})=><div data-ring-playing={String(playing)}>{children}</div>}))
vi.mock('../../components/ContinuousQuestions',()=>({ContinuousQuestions:({interactive,onSelect}:{interactive:boolean;onSelect:(id:string)=>void})=><button disabled={!interactive} onClick={()=>onSelect('personal')}>Answer</button>}))
vi.mock('../../service',()=>({useServicePlaying:()=>mocks.hostPlaying,markServiceReady:async()=>{}}))
import {TagDissolve} from '../../components/tag-dissolve'
import {MasterMaxSlice} from './MasterMaxSlice'
const before:MaxSnapshot={health:{instanceKey:'dataset'},station:{sessionId:'session'},session:{protocol:'stella-max-v1',sessionId:'session',phase:'active',screen:'audience',revision:0,answers:{},actions:['answer'],tagsMax:[],definition:{questions:[{id:'audience',prompt:'Audience',options:[{id:'personal',label:'Personal'}]},{id:'goal',prompt:'Goal',options:[{id:'access',label:'ID'}]}],missions:[]}},game:{waitingCount:0,gameBusy:false},available:true,fresh:true,online:true,busy:false,pending:null,error:'',notice:'',storageError:'',canRetry:false}
const after:MaxSnapshot={...before,session:{...before.session!,screen:'goal',revision:1,answers:{audience:'personal'},tagsMax:[{id:'personal',label:'Personal tag',visible:true}]}}
const waiting=(s:MaxSnapshot,kind='answer'):MaxSnapshot=>({...s,available:false,fresh:false,busy:true,pending:{type:'quiz',sessionId:'session',body:{kind,questionId:'goal',answerId:'access'}}})
let root:Root,host:HTMLDivElement,finishes:Array<()=>void>,run:ReturnType<typeof vi.spyOn>,dispose:ReturnType<typeof vi.spyOn>,playing:ReturnType<typeof vi.spyOn>
const emit=(s:MaxSnapshot)=>act(()=>mocks.emit!(s))
const ring=()=>host.querySelector('[data-ring-playing]')?.getAttribute('data-ring-playing')
beforeEach(async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});vi.stubGlobal('matchMedia',()=>({matches:false}))
 mocks.hostPlaying=true;finishes=[]
 // Actual React AnswerFlight lifecycle; only its WAAPI runner is held in jsdom.
 run=vi.spyOn(TagDissolve.prototype,'revealOnce').mockImplementation(async(_hold,done)=>{finishes.push(done)})
 dispose=vi.spyOn(TagDissolve.prototype,'dispose');playing=vi.spyOn(TagDissolve.prototype,'setPlaying')
 host=document.createElement('div');document.body.append(host);root=createRoot(host)
 await act(async()=>root.render(<MasterMaxSlice onExit={()=>{}}/>));emit(before)
})
afterEach(()=>{act(()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals();vi.clearAllMocks()})
it('unaccepted answer stays invisible and duplicate input is blocked while the accepted ring keeps playing',()=>{
 const button=host.querySelector('button')!;act(()=>button.click());expect(mocks.quiz).toHaveBeenCalledTimes(1)
 emit(waiting(before));expect(ring()).toBe('true');expect(run).not.toHaveBeenCalled();expect(host.querySelector('.answer-flight')).toBeNull()
 const disabled=host.querySelector('button')!;expect(disabled.disabled).toBe(true);act(()=>disabled.click());expect(mocks.quiz).toHaveBeenCalledTimes(1)
 emit(after);expect(run).toHaveBeenCalledTimes(1)
})
it('pending write and post-ACK refresh never pause or remount an accepted finite flight, which completes once',()=>{
 emit(after);const node=host.querySelector('.answer-flight');expect(run).toHaveBeenCalledTimes(1)
 emit(waiting(after));expect(ring()).toBe('true');expect(playing).toHaveBeenLastCalledWith(true)
 emit({...after,available:false,fresh:false,pending:null,busy:false});expect(ring()).toBe('true')
 for(let i=0;i<4;i++)emit(structuredClone(after))
 expect(host.querySelector('.answer-flight')).toBe(node);expect(run).toHaveBeenCalledTimes(1);expect(dispose).not.toHaveBeenCalled()
 expect(playing.mock.calls.every(([value]:unknown[])=>value===true)).toBe(true)
 act(()=>finishes[0]());act(()=>finishes[0]());emit(after)
 expect(host.querySelector('.answer-flight')).toBeNull();expect(run).toHaveBeenCalledTimes(1);expect(dispose).toHaveBeenCalledTimes(1)
})
it.each(['pause','cancel'])('explicit %s stops immediately and stays stopped through the ACK refresh gap',kind=>{
 emit(after);emit(waiting(after,kind));expect(ring()).toBe('false');expect(playing).toHaveBeenLastCalledWith(false)
 emit({...after,available:false,fresh:false,pending:null});expect(ring()).toBe('false');expect(playing).toHaveBeenLastCalledWith(false)
 emit({...after,session:{...after.session!,phase:kind==='pause'?'paused':'cancelled'}});expect(ring()).toBe('false')
 if(kind==='pause'){emit(after);expect(ring()).toBe('true');expect(run).toHaveBeenCalledTimes(1)}
 else expect(host.querySelector('.answer-flight')).toBeNull()
})
it('host pause and existing offline/error policy remain effective',()=>{
 emit(after);mocks.hostPlaying=false;emit({...after});expect(ring()).toBe('false');expect(playing).toHaveBeenLastCalledWith(false)
 mocks.hostPlaying=true;emit({...after,online:false,fresh:false});expect(ring()).toBe('false')
 emit({...after,error:'Offline'});expect(ring()).toBe('false')
 emit(after);expect(ring()).toBe('true');expect(run).toHaveBeenCalledTimes(1)
})
it('session switch never mounts an old flight under a new session, and stale completion cannot remove its new flight',()=>{
 emit(after);const oldFinish=finishes[0]
 const second={...before,station:{sessionId:'second'},session:{...before.session!,sessionId:'second'}}
 emit(second);expect(host.querySelector('.answer-flight')).toBeNull();expect(run).toHaveBeenCalledTimes(1)
 emit({...after,station:{sessionId:'second'},session:{...after.session!,sessionId:'second'}})
 expect(run).toHaveBeenCalledTimes(2);const node=host.querySelector('.answer-flight')
 act(()=>oldFinish());expect(host.querySelector('.answer-flight')).toBe(node)
 act(()=>finishes[1]());expect(host.querySelector('.answer-flight')).toBeNull()
})

it('preserves current MAX audio hook and its accepted playing value during pending and pause',()=>{
 emit(after);emit(waiting(after));expect(mocks.audio).toHaveBeenLastCalledWith(expect.objectContaining({playing:true,screen:'answer-reveal'}))
 emit(waiting(after,'pause'));expect(mocks.audio).toHaveBeenLastCalledWith(expect.objectContaining({playing:false,screen:'answer-reveal'}))
})
