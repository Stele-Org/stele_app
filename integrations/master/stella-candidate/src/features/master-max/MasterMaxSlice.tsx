import {useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react'
import {RingScene} from '../../components/RingScene'
import {RingActions} from '../../components/RingActions'
import {RingTag} from '../../components/RingTag'
import {OnboardingScreen} from '../../components/OnboardingScreen'
import {ProductMark} from '../../components/ProductMark'
import {BrandSplash} from '../../components/BrandSplash'
import {RingHomeScreen} from '../../components/RingHomeScreen'
import {ContinuousQuestions} from '../../components/ContinuousQuestions'
import {AnswerFlight} from '../../components/AnswerFlight'
import {markServiceReady,useServicePlaying} from '../../service'
import type {TagReveal} from '../prototype/tag-reveal'
import {tagBatches} from '../prototype/tag-reveal'
import {createMaxClient,type MaxClient,type MaxSnapshot,type MaxState} from './max-client.mjs'
import {VisitorStatus,operatorToolsEnabled} from '../master/VisitorStatus'
import {useMasterMaxAudio} from '../master/useMasterMaxAudio'
import {usePresentationPlaying} from '../master/presentation-playing'
import {maxMissionDescriptions} from '../../content/max'
import '../master/master-slice.css'
import '../prototype/revision-seven.css'
import './master-max-show.css'

/** Thin presentation over stella-max-v1. No scoring, mission selection or release timers. */
export function MasterMaxSlice({onExit,apiBase='',selectedFromHome=false}:{onExit:()=>void;apiBase?:''|'/master-api';selectedFromHome?:boolean}){
 const [snapshot,setSnapshot]=useState<MaxSnapshot|null>(null),[scale,setScale]=useState(1),[reveal,setReveal]=useState<TagReveal|null>(null)
 const [splash,setSplash]=useState(selectedFromHome)
 const [launchRequested,setLaunchRequested]=useState(selectedFromHome)
 const completeSplash=useCallback(()=>setSplash(false),[])
 const completeReveal=useCallback((completed:TagReveal)=>setReveal(current=>current===completed?null:current),[])
 const client=useRef<MaxClient|null>(null),viewport=useRef<HTMLDivElement>(null),previous=useRef<MaxState|null>(null)
 const revealSession=useRef<string|null>(null)
 const hostPlaying=useServicePlaying(),state=snapshot?.session
 const current=Boolean(state&&snapshot?.station?.sessionId===state.sessionId)
 const active=current&&state?.phase==='active',canAct=Boolean(snapshot?.available&&active&&!reveal)
 // Input authority remains separate from accepted presentation during command transport.
 const pending=snapshot?.pending as {body?:{kind?:string}}|null
 const presentationSnapshot=snapshot?{...snapshot,pending:pending?{payload:pending.body}:null}:null
 const playing=usePresentationPlaying(hostPlaying,presentationSnapshot,state)
 const question=active?state?.definition.questions.find(q=>q.id===state.screen):null
 const mission=state?.definition.missions.find(m=>m.missionId===state.missionId)
 const canStart=Boolean(snapshot?.available&&snapshot.station?.sessionId===null)
 const show=state?.show?.protocol==='max-show-v1',autoStarted=useRef(false)
 const autoPresentation=show||Boolean(!current&&snapshot?.definition?.showMode?.enabled)
 // Showing home never cancels the server-owned mission or releases its station.
 const missionAssigned=Boolean(current&&state?.phase==='active'&&state.show?.canonical)
 const autoHome=Boolean(autoPresentation&&!splash&&snapshot?.available&&((canStart&&!launchRequested)||missionAssigned||(current&&state?.phase==='cancelled')))
 useEffect(()=>{if(snapshot?.available&&missionAssigned)setLaunchRequested(false)},[snapshot?.available,missionAssigned])
 useMasterMaxAudio({screen:autoPresentation?(autoHome?'home':'brand-entry'):reveal?'answer-reveal':state?.screen??'onboarding',splash,
  sessionId:state?.sessionId,instanceKey:snapshot?.health?.instanceKey,
  questionIndex:autoPresentation?undefined:state?.definition.questions.findIndex(q=>q.id===state.screen),playing,effectsPlaying:hostPlaying&&snapshot?.online===true&&state?.phase!=='paused'})
 useEffect(()=>{
   // Admission is still persisted/reconciled by the existing client. Reconnect and polling never create a second run.
   if(selectedFromHome&&snapshot?.definition?.showMode?.enabled&&canStart&&!autoStarted.current){
     autoStarted.current=true;void client.current?.begin()
   }
 },[selectedFromHome,snapshot?.definition?.showMode?.enabled,canStart])
 const stopInFlight=useRef(false),[stopping,setStopping]=useState(false)
 const showStop=Boolean(autoPresentation&&!splash&&current&&state&&['active','cancelled'].includes(state.phase))
 const canStop=Boolean(hostPlaying&&snapshot?.available&&current&&state?.actions.includes('cancel')&&!stopping)
 const stopShow=()=>{
   if(!canStop||stopInFlight.current)return
   const adapter=client.current;if(!adapter)return
   stopInFlight.current=true;setStopping(true)
   void Promise.resolve(adapter.quiz('cancel')).finally(()=>{stopInFlight.current=false;setStopping(false)})
 }
 const terminal=state&&['completed','cancelled','expired'].includes(state.phase)
 const phaseKey=useMemo(()=>({id:`${state?.sessionId??''}:${state?.screen??'onboarding'}`}),[state?.sessionId,state?.screen])
 useEffect(()=>{
   let storage:Pick<Storage,'getItem'|'setItem'>;try{storage=window.sessionStorage}catch{storage={getItem(){throw Error('Storage unavailable')},setItem(){throw Error('Storage unavailable')}}}
   const adapter=createMaxClient({request:(path,options)=>window.fetch(apiBase+String(path),options),storage,uuid:()=>crypto.randomUUID(),onChange:setSnapshot})
   client.current=adapter;void adapter.refresh();void markServiceReady().catch(console.error)
   const timer=window.setInterval(()=>{if(!document.hidden)void adapter.refresh()},750),wake=()=>void adapter.refresh()
   window.addEventListener('pageshow',wake);document.addEventListener('visibilitychange',wake)
   return()=>{adapter.stop();client.current=null;clearInterval(timer);window.removeEventListener('pageshow',wake);document.removeEventListener('visibilitychange',wake)}
 },[apiBase])
 useLayoutEffect(()=>{
   const fit=()=>{const node=viewport.current;if(node){const s=getComputedStyle(node);setScale(Math.min((node.clientWidth-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight))/1080,(node.clientHeight-parseFloat(s.paddingTop)-parseFloat(s.paddingBottom))/1920))}}
   fit();const observer=new ResizeObserver(fit);if(viewport.current)observer.observe(viewport.current);return()=>observer.disconnect()
 },[])
 useEffect(()=>{
   if(!snapshot?.fresh||!state)return
   const old=previous.current;previous.current=state
   if(state.show?.protocol==='max-show-v1'){setReveal(null);return}
   if(!current||!['active','paused'].includes(state.phase)||old?.sessionId!==state.sessionId){setReveal(null);return}
   const changed=state.definition.questions.find(q=>state.answers[q.id]&&state.answers[q.id]!==old.answers[q.id])
   if(!changed){if(Object.keys(state.answers).length<Object.keys(old.answers).length)setReveal(null);return}
   const answer=changed.options.find(o=>o.id===state.answers[changed.id]),oldTags=new Set(old.tagsMax?.filter(t=>t.visible).map(t=>t.id))
   const metadata=state.tagsMax?.filter(t=>t.visible&&!oldTags.has(t.id)).map(t=>t.label)??[]
   if(!answer||!metadata.length)return
   const next={type:'home' as const},source={type:'max-answer-reveal' as const,label:answer.label,metadata,next}
   revealSession.current=state.sessionId
   const index=changed.options.indexOf(answer)
   setReveal({source,next,product:'max',label:answer.label,prompt:changed.prompt,batches:tagBatches(metadata),answerCard:{index,tone:index%2?'cyan':'violet',artworkId:answer.id,centered:changed.options.length===3&&index===2}})
 },[snapshot?.fresh,state,current])
 const command=(kind:string,extra?:Record<string,unknown>)=>{if(kind==='back'||kind==='cancel')setReveal(null);void client.current?.quiz(kind,extra)}
 return <>
  {operatorToolsEnabled() ? <aside className="master-slice-status"><strong>MAX · серверный квиз</strong><span role="status">{snapshot?.storageError||snapshot?.error||snapshot?.notice||'Подключение к мастеру…'}</span>
   <div><button onClick={()=>void client.current?.refresh()}>Обновить</button><button disabled={!snapshot?.canRetry} onClick={()=>void client.current?.retry()}>Повторить сохранённый запрос</button>
   {['pause','resume','cancel'].map(kind=><button key={kind} disabled={!snapshot?.available||!current||!state?.actions.includes(kind)} onClick={()=>command(kind)}>{({pause:'Пауза',resume:'Продолжить',cancel:'Отменить'} as Record<string,string>)[kind]}</button>)}</div>
  </aside> : <VisitorStatus fault={Boolean(snapshot&&!snapshot.busy&&(snapshot.storageError||snapshot.error||!snapshot.fresh))}
    pending={Boolean(snapshot?.canRetry)} paused={state?.phase==='paused'} refresh={()=>void client.current?.refresh()}
    retry={snapshot?.canRetry?()=>void client.current?.retry():undefined}/>}
  <div ref={viewport} className="prototype-viewport"><div className="prototype-canvas" style={{width:1080*scale,height:1920*scale}}>
   <RingScene product={autoHome?null:'max'} playing={playing} phase={splash?'brand-entry':autoHome?'entry':terminal?'result':!state?'intro':'question'} scale={scale}>
    {!splash&&!autoPresentation&&<header className="stella-product-header"><ProductMark product="max"/></header>}
    <RingActions playing={hostPlaying&&Boolean(snapshot?.available)&&(!autoHome||canStart)} phaseKey={phaseKey}>
     <main className={`experience experience--${autoHome?'entry':'max'}`} data-screen={splash?'brand-entry':autoHome?'home':state?.screen??'onboarding'} data-master-slice="max-server">
      {splash?<BrandSplash product="max" playing={hostPlaying} onComplete={completeSplash}/>:autoPresentation?<>
       {autoHome?<RingHomeScreen onSelect={brand=>{
        if(!canStart)return
        if(brand==='max'){setLaunchRequested(true);setSplash(true);void client.current?.begin()}else onExit()
       }}/>:<section className="screen brand-splash" role="status" aria-label="Запуск MAX">
        <ProductMark product="max"/><p>{canStart&&launchRequested?'Запуск MAX не подтверждён':state?.show?.canonicalError?'Ожидаем подтверждения запуска MAX…':'Запускаем миссию MAX…'}</p>
        {canStart&&launchRequested&&<><button type="button" onClick={()=>{setSplash(true);void client.current?.begin()}}>Повторить запуск</button><button type="button" onClick={onExit}>Выбор сервиса</button></>}
       </section>}
      </>:<>
      {!state&&canStart&&<OnboardingScreen product="max" showProductMark={false} voiceEnabled={false} onStart={()=>void client.current?.begin()} onBack={onExit}/>}
      {!state&&!canStart&&<section className="screen"><h1>Станция ожидает мастера</h1><p>Начало доступно после подтверждения свободной станции.</p><button disabled={Boolean(snapshot?.pending||snapshot?.busy||snapshot?.storageError)} onClick={onExit}>Назад</button></section>}
      {state&&!question&&!reveal&&<section className={`screen screen--result${show?' master-max-show-result':''}`}><h1>{mission?.label??(state.phase==='paused'?'Пауза':'MAX')}</h1>
       {mission?.missionId==='digital-id'&&<p className="master-max-mission-description">{maxMissionDescriptions['digital-id']}</p>}
       <p className="master-max-status-copy">{state.phase==='cancelled'?'Сессия отменена':show&&state.screen==='final'?'Сценарий MAX продолжается на экране. Вы можете завершить его кнопкой ниже.':state.screen==='queued'?'Миссия поставлена в очередь':state.phase==='completed'?'Следуйте к экрану MAX':state.phase==='expired'?'Время ожидания истекло':'Ваша миссия'}</p>
       {!show&&snapshot?.game&&<p>Миссий в очереди: {snapshot.game.waitingCount}</p>}
       {state.actions.includes('confirm')&&<RingTag tone="violet" disabled={!canAct} onClick={()=>command('confirm')}>{show?'Продолжить':'Начать миссию'}</RingTag>}
       {show&&state.screen==='final'&&state.actions.includes('cancel')&&<button type="button" className="ring-tag ring-tag--violet" disabled={!canAct} onClick={()=>command('cancel')}>Отменить сценарий</button>}
       {state.actions.includes('back')&&<RingTag navigation tone="cyan" disabled={!canAct} onClick={()=>command('back')}>Вернуться</RingTag>}
       {canStart&&<><button type="button" className="ring-tag ring-tag--violet" onClick={()=>void client.current?.begin()}>Начать новый квиз</button><button type="button" className="ring-tag ring-tag--cyan" onClick={onExit}>Выбор сервиса</button></>}
      </section>}
      </>}
     </main>
    </RingActions>
    {showStop&&<div className="master-max-show-stop">
     <button type="button" disabled={!canStop} aria-busy={stopping||state?.phase==='cancelled'} onClick={stopShow}>
      {stopping||state?.phase==='cancelled'?'Завершаем показ…':'Отменить показ'}
     </button>
    </div>}
    {!splash&&!autoPresentation&&question&&!reveal&&<ContinuousQuestions question={{...question,product:'max',layout:'grid',answering:false}} reveal={null} playing={Boolean(playing)} interactive={canAct} authoritativeCopy showProductMark={false} backEnabled={state?.actions.includes('back')} onSelect={answerId=>command('answer',{questionId:question.id,answerId})} onBack={()=>command('back')} onComplete={()=>{}}/>}
    {!splash&&!autoPresentation&&reveal&&current&&revealSession.current===state?.sessionId&&['active','paused'].includes(state.phase)&&<AnswerFlight key={`${state?.sessionId}:${reveal.label}`} reveal={reveal} playing={Boolean(playing)} showProductMark={false} onComplete={completeReveal}/>}
   </RingScene>
  </div></div>
 </>
}
