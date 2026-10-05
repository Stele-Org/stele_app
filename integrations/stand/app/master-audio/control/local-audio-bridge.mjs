import fs from 'node:fs';
const client=fs.readFileSync(new URL('./audio-client.mjs',import.meta.url));
const send=(res,status,body,type='application/json')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(type==='application/json'?JSON.stringify(body):body);};
// Called before the application's router. Its requestMaster is the existing pinned mTLS client.
export async function handleLocalAudio(req,res,{requestMaster,enabled=true}){
  if(!['/bridge/audio-client.mjs','/bridge/audio-events'].includes(req.url))return false;
  const host=req.headers.host,origin=`http://${host}`;
  if(!/^127\.0\.0\.1:\d+$/.test(host??'')||req.headers.origin&&req.headers.origin!==origin||req.headers['sec-fetch-site']&&!['same-origin','none'].includes(req.headers['sec-fetch-site'])){send(res,403,{error:'AUDIO_LOCAL_ORIGIN_REQUIRED'});return true;}
  if(!enabled){send(res,503,{error:'AUDIO_NOT_CONFIGURED'});return true;}
  if(req.url==='/bridge/audio-client.mjs'&&req.method==='GET'){send(res,200,client,'text/javascript');return true;}
  if(req.url!=='/bridge/audio-events'||req.method!=='POST'||req.headers.origin!==origin||!/^application\/json(?:;|$)/.test(req.headers['content-type']??'')){send(res,403,{error:'AUDIO_LOCAL_ORIGIN_REQUIRED'});return true;}
  try{
    const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>65536)throw Error('AUDIO_BODY_LIMIT');chunks.push(c);}
    const body=JSON.parse(Buffer.concat(chunks));
    const r=await requestMaster({method:'POST',path:'/production/audio/snapshot',body});
    send(res,r.status,r.data??r.body);
  }catch{send(res,503,{ok:false,error:'AUDIO_MASTER_UNAVAILABLE'});}
  return true;
}
