/** Native browser transport only. The server owns workflows and replay. */
export const STORAGE_KEY='local-master-panel-v1';
const token=value=>typeof value==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(value);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const copy=value=>structuredClone(value);
const keys=(value,allowed)=>object(value)&&Object.keys(value).every(key=>allowed.includes(key));
const durations=[20000,60000,120000];
const STELLA='stella-vk-v1';
const stellaKinds=['begin','answer','back','presentation_complete','photo_choice','photo_skip','capture_unavailable','photo_captured','pause','resume','cancel'];

function validPending(op){
  if(!keys(op,['type','sessionId','payload','protocol','instanceKey','expectedStep'])||!token(op.sessionId)||!object(op.payload))return false;
  const modern=op.protocol===STELLA;
  if(op.protocol!==undefined&&!modern)return false;
  if(modern&&(!token(op.instanceKey)||typeof op.expectedStep!=='string'))return false;
  const p=op.payload;
  if(op.type==='admission')return keys(p,['requestId','visitId','sessionId','stationId','durationMs'])&&
    token(p.requestId)&&token(p.visitId)&&p.sessionId===op.sessionId&&p.stationId==='stella-main'&&durations.includes(p.durationMs);
  if(modern&&op.type==='command')return keys(p,['commandId','expectedRevision','kind','questionId','answerId','referenceAssetId'])&&token(p.commandId)&&Number.isSafeInteger(p.expectedRevision)&&p.expectedRevision>=0&&stellaKinds.includes(p.kind)&&(p.questionId===undefined||token(p.questionId))&&(p.answerId===undefined||token(p.answerId))&&(p.kind==='photo_captured'?token(p.referenceAssetId):p.referenceAssetId===undefined);
  if(op.type!=='command'||!keys(p,['commandId','kind','question','value'])||!token(p.commandId)||!['answer','pause','resume','cancel'].includes(p.kind))return false;
  return p.kind==='answer'?Number.isInteger(p.question)&&p.question>=0&&p.question<=2&&typeof p.value==='string'&&p.value.length<=80:
    p.question===undefined&&p.value===undefined;
}

function validEnvelope(value){return keys(value,['version','lastSessionId','pending'])&&value.version===1&&
  (value.lastSessionId===null||token(value.lastSessionId))&&(value.pending===null||validPending(value.pending));}

export function createPanelClient({fetch:request,storage,uuid,onChange=()=>{},admissionProtocol=null}){
  let saved={version:1,lastSessionId:null,pending:null};
  const view={online:false,fresh:false,health:null,station:null,session:null,visit:null,busy:false,
    storageError:null,error:null,notice:'Подключение к локальному мастеру…',needsReconciliation:false};
  let epoch=0,flight=null;
  try{
    const raw=storage.getItem(STORAGE_KEY);
    if(raw!==null){const value=JSON.parse(raw);if(!validEnvelope(value))throw Error('Некорректная сохранённая операция');saved=value;}
  }catch{view.storageError='Не удалось прочитать сохранённую операцию вкладки. Управление заблокировано; данные не удалены.';}

  function getSnapshot(){
    const phase=view.session?.state?.phase;
    const foreignProtocol=Boolean(view.session?.state?.protocol&&view.session.state.protocol!==STELLA);
    const runtimeFailed=view.session?.needsReconciliation===true;
    const mismatch=Boolean(saved.pending&&view.health?.instanceKey&&saved.pending.instanceKey!==view.health.instanceKey);
    const backendSupportsModern=view.health?.stellaVkProtocol===STELLA;
    const protocolReady=view.session?.state?.protocol!==STELLA||backendSupportsModern;
    const ready=protocolReady&&!mismatch&&view.online&&view.fresh&&view.health?.ready&&!view.busy&&!saved.pending&&!view.storageError&&!runtimeFailed&&!view.needsReconciliation;
    const admissionAvailable=admissionProtocol!==STELLA||view.health?.stellaVkProtocol===STELLA;
    const ownSession=view.station?.sessionId&&view.station.sessionId===view.session?.state?.sessionId;
    return copy({...view,admissionAvailable,error:mismatch?'Сохранённая команда относится к другому backend. Повтор заблокирован.':view.error,pending:saved.pending,lastSessionId:saved.lastSessionId,
      canAct:Boolean(!foreignProtocol&&ready&&ownSession&&phase==='active'),
      canStart:Boolean(admissionAvailable&&ready&&view.station&&view.station.sessionId===null),
      canAnswer:Boolean(!foreignProtocol&&ready&&ownSession&&phase==='active'),canPause:Boolean(!foreignProtocol&&ready&&ownSession&&phase==='active'),
      canResume:Boolean(!foreignProtocol&&ready&&ownSession&&phase==='paused'),canCancel:Boolean(!foreignProtocol&&ready&&ownSession&&['active','paused'].includes(phase)),
      canRetry:Boolean((saved.pending?.protocol!==STELLA||backendSupportsModern)&&!mismatch&&saved.pending&&view.online&&!view.busy&&!view.storageError&&!runtimeFailed&&!view.needsReconciliation)});
  }
  const emit=()=>onChange(getSnapshot());
  function persist(next){
    if(view.storageError)return false;
    try{storage.setItem(STORAGE_KEY,JSON.stringify(next));saved=next;return true;}
    catch{view.storageError='Не удалось сохранить операцию во вкладке. Новые действия заблокированы; неподтверждённая операция сохранена в прежнем виде.';return false;}
  }
  async function http(path,options={}){
    const signal=globalThis.AbortSignal?.timeout?AbortSignal.timeout(options.method==='POST'?6000:3000):undefined;
    const response=await request(path,{cache:'no-store',...options,signal});
    const data=await response.json();
    return {status:response.status,ok:response.ok,data};
  }
  function resolveResult(op,data){
    let accepted,reason;
    if(op.type==='admission'){
      const r=data?.receipt,p=op.payload;
      if(!r||r.requestId!==p.requestId||r.sessionId!==p.sessionId||r.visitId!==p.visitId||r.stationId!==p.stationId||typeof r.accepted!=='boolean')return false;
      accepted=r.accepted;reason=r.reason;
    }else{
      const ack=data?.ack,c=ack?.command,p=op.payload;
      if(!c||c.sessionId!==op.sessionId||c.commandId!==p.commandId||c.kind!==p.kind||typeof ack.accepted!=='boolean')return false;
      if(op.protocol===STELLA){if(!Object.entries(p).every(([key,value])=>c[key]===value))return false;}
      else if((c.question??null)!==(p.question??null)||(c.value??null)!==(p.value??null))return false;
      accepted=ack.accepted;reason=ack.reason;
    }
    const next={...saved,pending:null,lastSessionId:op.type==='admission'&&!accepted?saved.lastSessionId:op.sessionId};
    if(!persist(next))return false;
    view.error=null;view.needsReconciliation=false;
    view.notice=accepted?(op.type==='admission'?'Допуск сохранён. Ожидаем состояние квиза.':'Действие подтверждено и сохранено.'):
      ({STATION_BUSY:'Станция уже занята. Запрос отклонён.',SESSION_EXISTS:'Сессия с таким ID уже существует.',
        STALE_OR_INVALID_ANSWER:'Вопрос уже сменился или ответ недопустим.',SESSION_TERMINAL:'Эта сессия уже завершена.'}[reason]||`Действие отклонено: ${reason}`);
    return true;
  }
  function uncertain(data){
    const code=data?.detail?.code;
    view.needsReconciliation=Boolean(data?.needsReconciliation||data?.ack?.accepted===null||['ADMISSION_ID_REUSED','COMMAND_ID_REUSED'].includes(code));
    view.error=view.needsReconciliation?'Нужна сверка результата на backend. Новый запрос вместо этого не создаётся.':
      `Результат ещё не подтверждён${code?` (${code})`:''}. Можно проверить состояние или вручную повторить тот же запрос.`;
  }
  async function recoverPending(ticket,instanceKey){
    const op=saved.pending;if(!op)return;
    if(op.instanceKey!==instanceKey){view.error='Сохранённая команда относится к другому backend. Повтор заблокирован.';return;}
    const url=op.type==='admission'?`/admissions/${op.payload.requestId}`:`/sessions/${op.sessionId}/acks/${op.payload.commandId}`;
    const result=await http(url);
    if(ticket!==epoch)return;
    if(result.status===200&&resolveResult(op,result.data))return;
    if(result.status===404){view.error='Backend пока не нашёл результат. Неподтверждённый запрос сохранён; повтор использует тот же ID.';return;}
    uncertain(result.data);
  }
  async function refresh(){
    if(flight)return flight;
    const ticket=epoch;
    const run=(async()=>{
      try{
        const health=await http('/health');if(!health.ok||!health.data?.ready)throw Error('Мастер ещё не готов');
        if(ticket!==epoch)return getSnapshot();
        const previousBootId=view.health?.bootId;
        view.health=health.data;
        if(saved.pending)await recoverPending(ticket,health.data.instanceKey);
        if(ticket!==epoch)return getSnapshot();
        const station=await http('/stations/stella-main');if(!station.ok)throw Error('Не удалось прочитать станцию');
        const id=station.data.sessionId||saved.lastSessionId;
        let session=null,visit=null;
        if(id){
          const result=await http(`/sessions/${id}`);if(!result.ok)throw Error('Не удалось прочитать сессию');session=result.data;
          if(session.registry?.visitId){const result=await http(`/visits/${session.registry.visitId}`);if(!result.ok)throw Error('Не удалось прочитать посещение');visit=result.data;}
        }
        if(ticket!==epoch)return getSnapshot();
        if(station.data.sessionId&&saved.lastSessionId!==station.data.sessionId&&!view.storageError)persist({...saved,lastSessionId:station.data.sessionId});
        const restarted=previousBootId&&previousBootId!==health.data.bootId;
        Object.assign(view,{health:health.data,station:station.data,session,visit,online:true,fresh:true});
        if(view.error?.startsWith('Нет свежего состояния: '))view.error=null;
        if(view.notice==='Подключение к локальному мастеру…')view.notice='Состояние получено от мастера.';
        if(restarted&&!saved.pending)view.notice='Мастер перезапущен. Текущее состояние восстановлено из backend.';
      }catch(error){if(ticket===epoch){view.online=false;view.fresh=false;view.error=`Нет свежего состояния: ${error.message}`;}}
      emit();return getSnapshot();
    })();
    flight=run;
    try{return await run;}finally{if(flight===run)flight=null;}
  }
  async function submit(){
    const op=copy(saved.pending);view.busy=true;view.fresh=false;view.error=null;++epoch;emit();
    try{
      const prefix=op.protocol===STELLA?'/stella/vk':'';
      const url=op.type==='admission'?prefix+'/admissions':prefix+`/sessions/${op.sessionId}/commands`;
      const result=await http(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(op.payload)});
      if(result.status===202)uncertain(result.data);
      else if((result.ok||result.status===409)&&resolveResult(op,result.data)){}
      else uncertain(result.data);
    }catch(error){view.error=`Ответ не получен: ${error.message}. Запрос сохранён; новый ID не создаётся.`;}
    finally{++epoch;view.fresh=false;view.busy=false;emit();}
    await refresh();
    if(!view.fresh)await refresh();
    return getSnapshot();
  }
  async function begin(durationMs=20000){
    if(!getSnapshot().canStart||!durations.includes(durationMs))return getSnapshot();
    let op;
    try{const requestId=uuid(),visitId=uuid(),sessionId=uuid();op={type:'admission',sessionId,instanceKey:view.health?.instanceKey,...(admissionProtocol===STELLA?{protocol:STELLA,instanceKey:view.health?.instanceKey,expectedStep:'admission'}:{}),payload:{requestId,visitId,sessionId,stationId:'stella-main',durationMs}};if(!validPending(op))throw Error('ID unavailable');}
    catch{view.error='Безопасный генератор ID недоступен. Запуск заблокирован.';emit();return getSnapshot();}
    if(!persist({...saved,pending:op})){emit();return getSnapshot();}
    return submit();
  }
  async function act(kind,extra={}){
    const snapshot=getSnapshot(),allowed={answer:snapshot.canAnswer,pause:snapshot.canPause,resume:snapshot.canResume,cancel:snapshot.canCancel};
    const modern=view.session?.state?.protocol===STELLA;
    const exposed=[...(view.session?.view?.options||[]),...(view.session?.view?.actions||[])].some(item=>item.command?.kind===kind&&Object.entries(item.command).every(([key,value])=>key==='kind'||extra[key]===value));
    if(modern?!((['pause','resume','cancel'].includes(kind)&&allowed[kind])||(snapshot.canAct&&exposed)):!allowed[kind])return snapshot;
    const sessionId=view.session.state.sessionId;let op;
    try{op={type:'command',sessionId,instanceKey:view.health?.instanceKey,...(modern?{protocol:STELLA,instanceKey:view.health?.instanceKey,expectedStep:view.session.state.screen}:{}),payload:{commandId:uuid(),...(modern?{expectedRevision:view.session.state.revision}:{}),kind,...extra}};if(!validPending(op))throw Error('Invalid command');}
    catch{view.error='Не удалось подготовить корректную команду.';emit();return getSnapshot();}
    if(!persist({...saved,pending:op})){emit();return getSnapshot();}
    return submit();
  }
  async function retryPending(){if(!getSnapshot().canRetry)return getSnapshot();return submit();}
  return {getSnapshot,refresh,begin,act,retryPending};
}
