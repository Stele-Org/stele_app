// @vitest-environment jsdom
import {act,type ReactNode}from'react';import{createRoot}from'react-dom/client';import{afterEach,expect,it,vi}from'vitest';import type{MaxSnapshot}from'./max-client.mjs';
const mocks=vi.hoisted(()=>({emit:null as null|((s:MaxSnapshot)=>void)}));
vi.mock('./max-client.mjs',()=>({createMaxClient:({onChange}:{onChange:(s:MaxSnapshot)=>void})=>{mocks.emit=onChange;return{refresh:async()=>{},stop(){},begin:async()=>{},quiz:async()=>{},retry:async()=>{}}}}));
vi.mock('../../components/RingScene',()=>({RingScene:({children}:{children:ReactNode})=><div>{children}</div>}));
vi.mock('../../components/ContinuousQuestions',()=>({ContinuousQuestions:()=> <div>Question</div>}));
vi.mock('../../service',()=>({useServicePlaying:()=>true,markServiceReady:async()=>{}}));
import{Choreographer}from'../../vendor/lumicells-scene/choreography';import{MasterMaxSlice}from'./MasterMaxSlice';
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals()});
it('real AnswerFlight effect survives repeated read snapshots and completes the existing reveal once',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});vi.stubGlobal('matchMedia',()=>({matches:false}));
 // Keep the actual AnswerFlight mount/cleanup effects; only the WAAPI runner is held in jsdom.
 let finish=()=>{};const run=vi.spyOn(Choreographer.prototype,'revealOnce').mockImplementation(async(_hold,done)=>{finish=done}),dispose=vi.spyOn(Choreographer.prototype,'dispose'),playing=vi.spyOn(Choreographer.prototype,'setPlaying');
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const before:MaxSnapshot={health:{instanceKey:'dataset'},station:{sessionId:'session'},session:{protocol:'stella-max-v1',sessionId:'session',phase:'active',screen:'audience',revision:0,answers:{},actions:['answer'],tagsMax:[],definition:{questions:[{id:'audience',prompt:'Audience',options:[{id:'personal',label:'Personal'}]},{id:'goal',prompt:'Goal',options:[{id:'access',label:'ID'}]}],missions:[]}},game:{waitingCount:0,gameBusy:false},available:true,fresh:true,online:true,busy:false,pending:null,error:'',notice:'',storageError:'',canRetry:false};
 await act(async()=>root.render(<MasterMaxSlice onExit={()=>{}}/>));act(()=>mocks.emit!(before));
 const after:MaxSnapshot={...before,session:{...before.session!,screen:'goal',revision:1,answers:{audience:'personal'},tagsMax:[{id:'personal',label:'Personal tag',visible:true}]}};
 act(()=>mocks.emit!(after));expect(run).toHaveBeenCalledTimes(1);expect(host.querySelector('.answer-flight')).not.toBeNull();
 for(let n=0;n<6;n++){act(()=>mocks.emit!({...structuredClone(after),refreshing:true}));act(()=>mocks.emit!(structuredClone(after)))}
 expect(run).toHaveBeenCalledTimes(1);expect(dispose).not.toHaveBeenCalled();expect(playing.mock.calls.every(([value])=>value===true)).toBe(true);
 act(()=>mocks.emit!({...after,fresh:false,online:false,available:false}));expect(playing).toHaveBeenLastCalledWith(false);
 act(()=>mocks.emit!(after));expect(run).toHaveBeenCalledTimes(1);act(()=>finish());expect(host.querySelector('.answer-flight')).toBeNull();expect(dispose).toHaveBeenCalledTimes(1);
 act(()=>root.unmount());host.remove();
});
