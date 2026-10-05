// @vitest-environment jsdom
import {act,type ReactNode} from 'react'
import {createRoot,type Root} from 'react-dom/client'
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import type {MaxSnapshot} from './max-client.mjs'
const mocks=vi.hoisted(()=>({emit:null as null|((state:MaxSnapshot)=>void),begin:vi.fn(),stop:vi.fn(),quiz:vi.fn()}))
vi.mock('./max-client.mjs',()=>({createMaxClient:({onChange}:{onChange:(state:MaxSnapshot)=>void})=>{
 mocks.emit=onChange;return {refresh:async()=>{},begin:mocks.begin,stop:mocks.stop,quiz:mocks.quiz,retry:vi.fn()}
}}))
vi.mock('../../components/RingScene',()=>({RingScene:({children}:{children:ReactNode})=><div>{children}</div>}))
vi.mock('../../components/RingActions',()=>({RingActions:({children,playing}:{children:ReactNode;playing:boolean})=><fieldset disabled={!playing}>{children}</fieldset>}))
vi.mock('../../components/OnboardingScreen',()=>({OnboardingScreen:({onStart}:{onStart:()=>void})=><button onClick={onStart}>Start quiz</button>}))
vi.mock('../../components/BrandSplash',()=>({BrandSplash:({onComplete}:{onComplete:()=>void})=><button onClick={onComplete}>Full MAX logo</button>}))
vi.mock('../../components/RingHomeScreen',()=>({RingHomeScreen:({onSelect}:{onSelect:(product:string)=>void})=><section aria-label="Home"><button onClick={()=>onSelect('vk-video')}>Choose VK</button><button onClick={()=>onSelect('max')}>Choose MAX</button></section>}))
vi.mock('../../components/ContinuousQuestions',()=>({ContinuousQuestions:({interactive}:{interactive:boolean})=><button disabled={!interactive}>Answer</button>}))
vi.mock('../../service',()=>({useServicePlaying:()=>true,markServiceReady:async()=>{}}))
import {MasterMaxSlice} from './MasterMaxSlice'
let root:Root,host:HTMLDivElement
const free:MaxSnapshot={health:{instanceKey:'dataset'},station:{sessionId:null},session:null,game:{waitingCount:0,gameBusy:false},available:true,fresh:true,online:true,busy:false,pending:null,error:'',notice:'',storageError:'',canRetry:false}
beforeEach(()=>{mocks.quiz.mockImplementation(()=>new Promise(()=>{}));vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});host=document.createElement('div');document.body.append(host);root=createRoot(host)})
afterEach(()=>{act(()=>root.unmount());host.remove();vi.unstubAllGlobals();vi.clearAllMocks()})
it('disconnection removes the available start and uncertain admission cannot exit to a second branch',()=>{
 const exit=vi.fn();act(()=>root.render(<MasterMaxSlice onExit={exit}/>));act(()=>mocks.emit!(free))
 expect(host.textContent).toContain('Start quiz')
 act(()=>mocks.emit!({...free,available:false,fresh:false,online:false,error:'Offline',pending:{type:'admission'}}))
 expect(host.textContent).not.toContain('Start quiz')
 const back=[...host.querySelectorAll('button')].find(button=>button.textContent==='Назад')!
 expect(back.disabled).toBe(true);act(()=>back.click());expect(exit).not.toHaveBeenCalled()
})
it('queued server result displays queue count and only permits new quiz after station release',()=>{
 act(()=>root.render(<MasterMaxSlice onExit={()=>{}}/>))
 const queued:MaxSnapshot={...free,game:{waitingCount:7,gameBusy:true},session:{protocol:'stella-max-v1',sessionId:'session',phase:'completed',screen:'queued',revision:3,answers:{},actions:[],missionId:'communication',definition:{questions:[],missions:[{missionId:'communication',label:'Server mission'}]}}}
 act(()=>mocks.emit!({...queued,station:{sessionId:'session'}}))
 expect(host.textContent).toContain('Миссий в очереди: 7');expect(host.textContent).toContain('Server mission')
 expect(host.textContent).not.toContain('Начать новый квиз')
 act(()=>mocks.emit!(queued));expect(host.textContent).toContain('Начать новый квиз')
})

it('explicit MAX choice admits once only when the master enables show mode; polling and cancellation do not restart it',()=>{
 act(()=>root.render(<MasterMaxSlice onExit={()=>{}} selectedFromHome/>))
 act(()=>mocks.emit!({...free,definition:{showMode:{enabled:false,revision:0}}}));expect(mocks.begin).not.toHaveBeenCalled()
 const enabled={...free,definition:{showMode:{enabled:true,revision:1}}}
 act(()=>mocks.emit!(enabled));expect(mocks.begin).toHaveBeenCalledTimes(1)
 act(()=>mocks.emit!({...enabled,refreshing:true}));act(()=>mocks.emit!(enabled));expect(mocks.begin).toHaveBeenCalledTimes(1)
})
it('reload without explicit MAX choice does not auto-admit a free station',()=>{
 act(()=>root.render(<MasterMaxSlice onExit={()=>{}}/>))
 act(()=>mocks.emit!({...free,definition:{showMode:{enabled:true,revision:1}}}));expect(mocks.begin).not.toHaveBeenCalled()
 expect(host.querySelector('[aria-label="Home"]')).not.toBeNull();expect(host.textContent).not.toContain('Start quiz')
})
it('auto show waits for canonical assignment and skips every quiz screen without cancelling the mission',()=>{
 const exit=vi.fn();act(()=>root.render(<MasterMaxSlice onExit={exit}/>))
 const final:MaxSnapshot={...free,station:{sessionId:'show-session'},session:{protocol:'stella-max-v1',sessionId:'show-session',phase:'active',screen:'final',revision:3,answers:{},actions:['cancel'],definition:{questions:[],missions:[]},show:{protocol:'max-show-v1',runId:'show-session',phase:'videos',elapsedMs:5000,missionId:'digital-id',cancelAllowed:true}}}
 act(()=>mocks.emit!(final));const cancel=()=>[...host.querySelectorAll('button')].find(button=>button.textContent==='Отменить сценарий')!
 expect(cancel()).toBeUndefined();expect(host.textContent).toContain('Запускаем миссию MAX')
 expect(host.querySelector('[aria-label="Home"]')).toBeNull();expect(mocks.quiz).not.toHaveBeenCalled();expect(exit).not.toHaveBeenCalled()
})

it('shows full logo, admits once, then shows home only after mission ACK; occupied station cannot launch another session',()=>{
 const exit=vi.fn();act(()=>root.render(<MasterMaxSlice selectedFromHome onExit={exit}/>))
 const enabled={...free,definition:{showMode:{enabled:true,revision:1}}}
 act(()=>mocks.emit!(enabled));expect(mocks.begin).toHaveBeenCalledTimes(1)
 expect(host.textContent).toContain('Full MAX logo');expect(host.textContent).not.toContain('Start quiz')
 const show:MaxSnapshot={...enabled,station:{sessionId:'run'},session:{protocol:'stella-max-v1',sessionId:'run',phase:'active',screen:'audience',revision:0,answers:{},actions:['answer','cancel'],definition:{questions:[{id:'audience',prompt:'Test quiz',options:[]}],missions:[]},show:{protocol:'max-show-v1',runId:'assignment',phase:'tags',elapsedMs:0,missionId:'digital-id',cancelAllowed:true,canonical:null}}}
 act(()=>mocks.emit!(show));expect(host.textContent).not.toContain('Answer')
 act(()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Full MAX logo')!.click())
 expect(host.querySelector('[aria-label="Home"]')).toBeNull()
 const ready=structuredClone(show);ready.session!.show!.canonical={mode:'canonical-local-v1',assignmentId:'assignment',sessionId:'canonical-run',contentRevision:'v1',generation:1,source:'stella',receipt:{}}
 act(()=>mocks.emit!(ready));expect(host.querySelector('[aria-label="Home"]')).not.toBeNull()
 expect(host.textContent).not.toContain('Answer');expect(host.textContent).not.toContain('Start quiz')
 act(()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Choose VK')!.click());expect(exit).not.toHaveBeenCalled()
 act(()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Choose MAX')!.click());expect(mocks.begin).toHaveBeenCalledTimes(1)
 act(()=>mocks.emit!({...ready,available:false,fresh:false,online:false}));expect(host.querySelector('[aria-label="Home"]')).toBeNull()
 act(()=>mocks.emit!({...ready,available:false,pending:{type:'admission'}}));expect(host.querySelector('[aria-label="Home"]')).toBeNull()
 act(()=>mocks.emit!({...ready,station:{sessionId:null}}))
 act(()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Choose VK')!.click());expect(exit).toHaveBeenCalledTimes(1)
 expect(mocks.quiz).not.toHaveBeenCalled()
})

it('show-disabled keeps the manual onboarding after the logo',()=>{
 act(()=>root.render(<MasterMaxSlice selectedFromHome onExit={()=>{}}/>))
 act(()=>mocks.emit!({...free,definition:{showMode:{enabled:false,revision:1}}}))
 expect(mocks.begin).not.toHaveBeenCalled();expect(host.textContent).toContain('Full MAX logo')
 act(()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Full MAX logo')!.click())
 expect(host.textContent).toContain('Start quiz');expect(host.querySelector('[aria-label="Home"]')).toBeNull()
})

it('a recovered active show does not admit again or show its decorative quiz',()=>{
 act(()=>root.render(<MasterMaxSlice onExit={()=>{}}/>))
 const ready:MaxSnapshot={...free,station:{sessionId:'run'},session:{protocol:'stella-max-v1',sessionId:'run',phase:'active',screen:'audience',revision:2,answers:{},actions:['answer','cancel'],definition:{questions:[{id:'audience',prompt:'Test quiz',options:[]}],missions:[]},show:{protocol:'max-show-v1',runId:'assignment',phase:'tags',elapsedMs:1000,missionId:'digital-id',cancelAllowed:true,canonical:{mode:'canonical-local-v1',assignmentId:'assignment',sessionId:'canonical-run',contentRevision:'v1',generation:1,source:'stella',receipt:{}}}}}
 act(()=>mocks.emit!(ready));expect(host.querySelector('[aria-label="Home"]')).not.toBeNull()
 expect(mocks.begin).not.toHaveBeenCalled();expect(mocks.quiz).not.toHaveBeenCalled();expect(host.textContent).not.toContain('Answer')
})

it('a fast canonical assignment still waits for the full logo',()=>{
 act(()=>root.render(<MasterMaxSlice selectedFromHome onExit={()=>{}}/>))
 const ready:MaxSnapshot={...free,station:{sessionId:'run'},session:{protocol:'stella-max-v1',sessionId:'run',phase:'active',screen:'audience',revision:1,answers:{},actions:['answer'],definition:{questions:[],missions:[]},show:{protocol:'max-show-v1',runId:'assignment',phase:'tags',elapsedMs:0,missionId:'digital-id',cancelAllowed:true,canonical:{mode:'canonical-local-v1',assignmentId:'assignment',sessionId:'canonical-run',contentRevision:'v1',generation:1,source:'stella',receipt:{}}}}}
 act(()=>mocks.emit!(ready));expect(host.textContent).toContain('Full MAX logo');expect(host.querySelector('[aria-label="Home"]')).toBeNull()
 act(()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Full MAX logo')!.click())
 expect(host.querySelector('[aria-label="Home"]')).not.toBeNull();expect(mocks.quiz).not.toHaveBeenCalled()
})

it('a rejected admission never looks like a launched mission and cannot automatically retry',()=>{
 act(()=>root.render(<MasterMaxSlice selectedFromHome onExit={()=>{}}/>))
 const enabled={...free,definition:{showMode:{enabled:true,revision:1}}}
 act(()=>mocks.emit!(enabled));expect(mocks.begin).toHaveBeenCalledTimes(1)
 act(()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Full MAX logo')!.click())
 act(()=>mocks.emit!({...enabled,notice:'Действие отклонено'}))
 expect(host.querySelector('[aria-label="Home"]')).toBeNull();expect(host.textContent).toContain('Запуск MAX не подтверждён')
 expect(mocks.begin).toHaveBeenCalledTimes(1);expect(mocks.quiz).not.toHaveBeenCalled()
})

function assignedShow():MaxSnapshot {
 return {...free,definition:{showMode:{enabled:true,revision:1}},station:{sessionId:'show-run'},session:{
  protocol:'stella-max-v1',sessionId:'show-run',phase:'active',screen:'audience',revision:2,
  answers:{},actions:['answer','cancel'],definition:{questions:[],missions:[]},
  show:{protocol:'max-show-v1',runId:'assignment',phase:'wall',elapsedMs:5000,
   missionId:'digital-id',cancelAllowed:true,canonical:{mode:'canonical-local-v1',assignmentId:'assignment',
    sessionId:'canonical-run',contentRevision:'v1',generation:1,source:'stella',receipt:{}}},
 }}
}
function showStop(){return host.querySelector<HTMLButtonElement>('.master-max-show-stop button')}
function chooseVk(){return [...host.querySelectorAll('button')].find(button=>button.textContent==='Choose VK')}

it('offers cancel outside the locked home controls and sends only one command for a double tap',()=>{
 act(()=>root.render(<MasterMaxSlice onExit={()=>{}}/>));act(()=>mocks.emit!(assignedShow()))
 expect(chooseVk()?.matches(':disabled')).toBe(true)
 const stop=showStop()!
 expect(stop).not.toBeNull();expect(stop.textContent).toBe('Отменить показ')
 expect(stop.matches(':disabled')).toBe(false)
 expect(stop.closest('fieldset[disabled]')).toBeNull()
 act(()=>{stop.click();stop.click()})
 expect(mocks.quiz).toHaveBeenCalledTimes(1)
 expect(mocks.quiz.mock.calls[0][0]).toBe('cancel')
 expect(host.textContent).toContain('Завершаем показ…')
 expect(showStop()?.matches(':disabled')).toBe(true)
 expect(mocks.begin).not.toHaveBeenCalled()
})

it.each([
 ['offline',{available:false,fresh:false,online:false,error:'Offline'}],
 ['pending',{available:false,busy:true,pending:{type:'command',body:{kind:'cancel'}}}],
] as const)('does not accept show cancellation while %s',(_name,unavailable)=>{
 act(()=>root.render(<MasterMaxSlice onExit={()=>{}}/>))
 act(()=>mocks.emit!(assignedShow()))
 act(()=>mocks.emit!({...assignedShow(),...unavailable}))
 const stop=showStop()!
 expect(stop).not.toBeNull();expect(stop.matches(':disabled')).toBe(true)
 act(()=>stop.click());expect(mocks.quiz).not.toHaveBeenCalled()
 expect(mocks.begin).not.toHaveBeenCalled()
})

it('waits for station release after cancel ACK and does not auto-admit the selected MAX again',()=>{
 const exit=vi.fn()
 act(()=>root.render(<MasterMaxSlice selectedFromHome onExit={exit}/>))
 act(()=>mocks.emit!({...free,definition:{showMode:{enabled:true,revision:1}}}))
 expect(mocks.begin).toHaveBeenCalledTimes(1)
 act(()=>mocks.emit!(assignedShow()))
 act(()=>[...host.querySelectorAll('button')].find(button=>button.textContent==='Full MAX logo')!.click())
 act(()=>showStop()!.click())
 expect(mocks.quiz).toHaveBeenCalledTimes(1)
 const cancelling=assignedShow()
 cancelling.session={...cancelling.session!,phase:'cancelled',revision:3,actions:[],
  show:{...cancelling.session!.show!,phase:'cancelled',cancelAllowed:false}}
 act(()=>mocks.emit!(cancelling))
 expect(host.textContent).toContain('Завершаем показ…')
 const lockedChoice=chooseVk()
 expect(!lockedChoice||lockedChoice.matches(':disabled')).toBe(true)
 act(()=>lockedChoice?.click());expect(exit).not.toHaveBeenCalled()
 expect(mocks.begin).toHaveBeenCalledTimes(1)
 act(()=>mocks.emit!({...cancelling,station:{sessionId:null}}))
 expect(chooseVk()).toBeDefined();expect(chooseVk()!.matches(':disabled')).toBe(false)
 expect(showStop()).toBeNull()
 act(()=>chooseVk()!.click());expect(exit).toHaveBeenCalledTimes(1)
 expect(mocks.begin).toHaveBeenCalledTimes(1);expect(mocks.quiz).toHaveBeenCalledTimes(1)
})

it('does not offer the show cancellation control in manual MAX mode',()=>{
 act(()=>root.render(<MasterMaxSlice onExit={()=>{}}/>))
 act(()=>mocks.emit!({...free,definition:{showMode:{enabled:false,revision:0}}}))
 expect(showStop()).toBeNull()
 const manual=assignedShow();delete manual.session!.show
 manual.definition={showMode:{enabled:false,revision:0}}
 act(()=>mocks.emit!(manual))
 expect(showStop()).toBeNull();expect(mocks.quiz).not.toHaveBeenCalled()
})
