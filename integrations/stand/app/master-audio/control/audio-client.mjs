// Presentation clocks stay local; only small desired-state snapshots cross the LAN.
export function createAudioProducer({source}) {
  const producerId=crypto.randomUUID(),voices=new Map();
  let seq=0,closed=false,busy=false,dirty=false,timer,last={ok:false,error:'CONNECTING'};
  async function flush(){
    if(busy){dirty=true;return;} if(closed)return;
    busy=true;dirty=false;
    const sent=performance.now();
    const body={protocol:'stand-audio-v1',producerId,source,seq:++seq,voices:[...voices.values()].filter(v=>sent-v.sampledAt<1500).map(({sampledAt,...v})=>({...v,positionSeconds:v.positionSeconds+(v.paused?0:(sent-sampledAt)/1000)}))};
    try{const r=await fetch('/bridge/audio-events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(2000)});last=await r.json();if(!r.ok)last.ok=false;}
    catch{last={ok:false,error:'AUDIO_MASTER_UNAVAILABLE'};}
    finally{busy=false;if(dirty&&!closed)schedule();}
  }
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(flush,10);};
  const heartbeat=setInterval(flush,500);
  const api={update(v){if(closed)return;if(!v||typeof v.voiceId!=='string')throw Error('AUDIO_VOICE_REQUIRED');voices.set(v.voiceId,{...v,sampledAt:performance.now()});schedule();},remove(id){voices.delete(id);schedule();},status(){return {...last,producerId,source,voices:voices.size};},close(){if(closed)return;closed=true;voices.clear();clearTimeout(timer);clearInterval(heartbeat);void fetch('/bridge/audio-events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({protocol:'stand-audio-v1',producerId,source,seq:++seq,voices:[]}),keepalive:true}).catch(()=>{});window.removeEventListener('pagehide',api.close);}};
  window.addEventListener('pagehide',api.close);
  return api;
}
