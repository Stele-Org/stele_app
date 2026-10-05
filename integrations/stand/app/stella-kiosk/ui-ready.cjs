'use strict';
const http = require('node:http');
const {performance} = require('node:perf_hooks');
const {setTimeout: delay} = require('node:timers/promises');

function head(port, timeoutMs) {
  return new Promise(resolve => {
    let done=false;
    const finish = result => {
      if (done) return;
      done=true;
      clearTimeout(timer);
      request.destroy();
      resolve(result);
    };
    const request = http.request({hostname:'127.0.0.1',port,path:'/stella/?master=1',method:'HEAD',
      agent:false,maxHeaderSize:16384}, response => {
      const html=/^text\/html(?:\s*;|$)/i.test(String(response.headers['content-type'] ?? ''));
      finish({ready:response.statusCode===200 && html,status:response.statusCode});
    });
    request.on('error',error => finish({ready:false,error:error.code ?? 'HTTP_ERROR'}));
    // Absolute request deadline, including connect; request.setTimeout is only inactivity.
    const timer=setTimeout(() => finish({ready:false,error:'REQUEST_TIMEOUT'}),timeoutMs);
    request.end();
  });
}

async function waitForLocalUi(port,{timeoutMs=120000,requestTimeoutMs=2000,intervalMs=1000}={}) {
  if (!Number.isInteger(port) || port<1024 || port>65535) throw Error('Valid STELLA uiPort required');
  for (const value of [timeoutMs,requestTimeoutMs,intervalMs]) {
    if (!Number.isFinite(value) || value<=0) throw Error('Positive readiness deadlines required');
  }
  const started=performance.now(),deadline=started+Math.min(timeoutMs,120000);
  let attempts=0,last;
  while (performance.now()<deadline) {
    attempts++;
    last=await head(port,Math.max(1,Math.min(requestTimeoutMs,deadline-performance.now())));
    if (last.ready) return {attempts,elapsedMs:Math.round(performance.now()-started)};
    const remaining=deadline-performance.now();
    if (remaining<=0) break;
    await delay(Math.min(intervalMs,remaining));
  }
  throw Error(`STELLA local UI not ready within ${Math.min(timeoutMs,120000)} ms (${last?.error ?? `HTTP_${last?.status ?? 'UNKNOWN'}`}); Electron was not started`);
}
module.exports={waitForLocalUi};
