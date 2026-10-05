import {useEffect,useState} from 'react'
import {MasterSlice} from './MasterSlice'
import {MasterMaxSlice} from '../master-max/MasterMaxSlice'

const MODE_KEY='production-stella-presentation-v1'
type Mode='vk'|'max'
const token=(value:unknown):value is string=>typeof value==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(value)

/** Routing only: every admission and command remains owned by the server clients. */
export function MasterShell({apiBase=import.meta.env.VITE_MASTER_API_BASE??(import.meta.env.DEV?'/master-api':'')}:{apiBase?:''|'/master-api'}){
 const [mode,setMode]=useState<Mode|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0),[maxSelected,setMaxSelected]=useState(false)
 useEffect(()=>{
  const lifetime=new AbortController()
  const read=async(path:string)=>{
   const response=await fetch(apiBase+path,{cache:'no-store',signal:AbortSignal.any([lifetime.signal,AbortSignal.timeout(3500)])})
   if(!response.ok)throw Error('Не удалось подтвердить состояние станции')
   return response.json()
  }
  void(async()=>{
   try{
    setError('')
    const health=await read('/health')
    if(health.ready!==true||typeof health.instanceKey!=='string')throw Error('Мастер ещё не готов')
    const station=await read('/stations/stella-main')
    let selected:Mode
    if(station.sessionId===null){
     selected=window.sessionStorage.getItem(MODE_KEY)==='max'?'max':'vk'
    }else{
     if(!token(station.sessionId))throw Error('Неизвестное состояние станции')
     const session=await read('/sessions/'+station.sessionId)
     if(session.state?.sessionId!==station.sessionId)throw Error('Сессия станции изменилась; повторите проверку')
     if(session.state.protocol==='stella-max-v1')selected='max'
     else if(session.state.protocol==='stella-vk-v1')selected='vk'
     else throw Error('Неподдерживаемый сценарий станции')
    }
    if(!lifetime.signal.aborted){window.sessionStorage.setItem(MODE_KEY,selected);setMode(selected)}
   }catch(cause){if(!lifetime.signal.aborted)setError(cause instanceof Error?cause.message:'Мастер недоступен')}
  })()
  return()=>lifetime.abort()
 },[apiBase,attempt])
 const choose=(next:Mode,verify=false)=>{
  try{window.sessionStorage.setItem(MODE_KEY,next)}catch{setMode(null);setError('Хранилище браузера недоступно. Запуск заблокирован.');return}
  setMaxSelected(next==='max'&&!verify)
  if(verify){setMode(null);setAttempt(value=>value+1)}else setMode(next)
 }
 if(mode==='max')return <MasterMaxSlice apiBase={apiBase} selectedFromHome={maxSelected} onExit={()=>choose('vk',true)}/>
 if(mode==='vk')return <MasterSlice onSelectMax={()=>choose('max')}/>
 return <main aria-label="Проверка станции"><p role="status">{error||'Проверяем станцию у мастера…'}</p>
  {error&&<button onClick={()=>setAttempt(value=>value+1)}>Повторить проверку</button>}</main>
}
