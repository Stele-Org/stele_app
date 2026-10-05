import http from 'node:http';
import {handleLocalAudio} from '../master-audio/control/local-audio-bridge.mjs';
import path from 'node:path';
import { classifyStellaRequest, readStellaAsset, STELLA_ENTRY } from './stella-package.mjs';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.wav': 'audio/wav', '.txt': 'text/plain; charset=utf-8' };
const MAX_BODY = 16384, MAX_RESPONSE = 2 * 1024 * 1024;
const securityHeaders = {
  'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY', 'Permissions-Policy': 'camera=(), microphone=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
};
const errorResponse = (code, message) => ({ error: code, message });
function send(response, status, body, contentType = 'application/json; charset=utf-8', head = false, extra = {}) {
  if (response.destroyed || response.writableEnded) return;
  const bytes = Buffer.isBuffer(body) ? body : Buffer.from(contentType.startsWith('application/json') ? JSON.stringify(body) : body);
  response.writeHead(status, { ...securityHeaders, ...extra, 'Content-Type': contentType, 'Content-Length': bytes.length });
  response.end(head ? undefined : bytes);
}
async function parseBody(request, limit = MAX_BODY) {
  if ((request.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase() !== 'application/json') throw Object.assign(Error('JSON required'), { status: 415 });
  if (Number(request.headers['content-length']) > limit) throw Object.assign(Error('Request too large'), { status: 413 });
  const chunks = []; let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw Object.assign(Error('Request too large'), { status: 413 });
    chunks.push(chunk);
  }
  let result;
  try { result = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw Object.assign(Error('Invalid JSON'), { status: 400 }); }
  if (result === null || typeof result !== 'object' || Array.isArray(result)) throw Object.assign(Error('JSON object required'), { status: 400 });
  return result;
}
async function boundedRequest(requestMaster, input, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(() => requestMaster(input)),
      new Promise((_, reject) => { timer = setTimeout(() => reject(Error('MASTER_TIMEOUT')), timeoutMs); }),
    ]);
  } finally { clearTimeout(timer); }
}

/** Loopback presentation host; injected transport alone owns mTLS/master destination.
 * requestMaster({method,path,body?}) -> {status,headers?,body: parsed JSON}.
 * It must not forward the browser Origin/Host/cookies to the backend.
 */
export async function startLocalStellaServer({ packageRoot, requestMaster, port = 9351,
  getTimeoutMs = 2500, postTimeoutMs = 5500, resultOrigin = null } = {}) {
  if (typeof packageRoot !== 'string' || typeof requestMaster !== 'function') throw Error('packageRoot and requestMaster required');
  if (resultOrigin !== null) {
    const configured = new URL(resultOrigin);
    if (!['http:', 'https:'].includes(configured.protocol) || configured.origin !== resultOrigin) throw Error('Invalid trusted result origin');
  }
  if (!Number.isInteger(port) || (port !== 0 && (port < 1024 || port > 65535))) throw Error('Invalid local UI port');
  for (const value of [getTimeoutMs, postTimeoutMs]) if (!Number.isInteger(value) || value < 1 || value > 6000) throw Error('Invalid request deadline');
  // Refuse to launch an absent/tampered entry. Each requested asset is separately verified.
  await readStellaAsset(packageRoot, 'app/stella-ui/index.html');
  let origin, host;
  const server = http.createServer(async (request, response) => {
    if(await handleLocalAudio(request,response,{requestMaster}))return;
    const head = request.method === 'HEAD';
    try {
      if (request.headers.host !== host) return send(response, 403, errorResponse('LOCAL_HOST_REQUIRED', 'Недопустимый адрес Стеллы'), undefined, head);
      const incomingOrigin = request.headers.origin;
      const fetchSite = request.headers['sec-fetch-site'];
      if ((incomingOrigin && incomingOrigin !== origin) || (fetchSite && !['same-origin', 'none'].includes(fetchSite))) return send(response, 403, errorResponse('LOCAL_ORIGIN_REQUIRED', 'Межсайтовый запрос запрещён'), undefined, head);
      if (request.url === '/stella/result-config.json' && ['GET', 'HEAD'].includes(request.method)) {
        return send(response, resultOrigin ? 200 : 503, { protocol: 'result-origin-v1', resultOrigin }, undefined, head);
      }
      const policy = classifyStellaRequest(request.method, request.url);
      if (policy.kind === 'redirect') return send(response, policy.status, '', 'text/plain; charset=utf-8', head, { Location: policy.location });
      if (policy.kind === 'denied') {
        if (policy.reason === 'trusted-result-origin-not-configured' && ['GET', 'HEAD'].includes(request.method)) {
          return send(response, 503, '<!doctype html><html lang="ru"><meta charset="utf-8"><title>Результат пока не опубликован</title><h1>Результат пока не опубликован</h1><p>Публичный адрес результата ещё не настроен. QR с локальным адресом Стеллы не предназначен для телефона. Подборка хранится у мастера.</p></html>', 'text/html; charset=utf-8', head);
        }
        return send(response, policy.status, errorResponse(policy.reason, 'Маршрут не разрешён для Стеллы'), undefined, head);
      }
      if (policy.kind === 'static') {
        try { return send(response, 200, policy.relativePath==='app/stella-ui/index.html'?Buffer.from((await readStellaAsset(packageRoot,policy.relativePath)).toString().replace('<html','<html data-managed-audio="true"')):await readStellaAsset(packageRoot, policy.relativePath), MIME[path.extname(policy.relativePath)] ?? 'application/octet-stream', head, policy.relativePath === 'app/stella-ui/index.html' ? { 'Permissions-Policy': 'camera=(self), microphone=()' } : {}); }
        catch { return send(response, 503, errorResponse('STELLA_ASSET_UNAVAILABLE', 'Принятый файл интерфейса отсутствует или изменён'), undefined, head); }
      }
      let body;
      if (request.method === 'POST') {
        if (incomingOrigin !== origin) return send(response, 403, errorResponse('LOCAL_ORIGIN_REQUIRED', 'Команда требует локальный Origin'));
        body = await parseBody(request, /^\/stella\/vk\/sessions\/[A-Za-z0-9][A-Za-z0-9._:-]{0,127}\/photo$/.test(policy.upstreamPath) ? 2900000 : MAX_BODY);
      }
      try {
        const result = await boundedRequest(requestMaster, { method: request.method, path: policy.upstreamPath, ...(body === undefined ? {} : { body }) }, request.method === 'POST' ? postTimeoutMs : getTimeoutMs);
        // Preserve accepted/error/202 receipts verbatim. Do not forward cookies, redirects or upstream CORS headers.
        if (!result || !Number.isInteger(result.status) || result.status < 200 || result.status > 599 || (result.status >= 300 && result.status < 400)
          || result.body === undefined || result.body === null || typeof result.body !== 'object') throw Error('Invalid master response');
        const encoded = JSON.stringify(result.body);
        if (Buffer.byteLength(encoded) > MAX_RESPONSE) throw Error('Master response too large');
        return send(response, result.status, Buffer.from(encoded));
      } catch { return send(response, 503, errorResponse('MASTER_UNAVAILABLE', 'Нет подтверждённой связи с мастером. Состояние и неподтверждённые команды не заменены локальным квизом.')); }
    } catch (error) { return send(response, error.status ?? 500, errorResponse('LOCAL_REQUEST_FAILED', error.status ? error.message : 'Ошибка локального интерфейса'), undefined, head); }
  });
  server.requestTimeout = 8000; server.headersTimeout = 5000; server.keepAliveTimeout = 1000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  host = `127.0.0.1:${server.address().port}`; origin = `http://${host}`;
  return { server, origin, entry: origin + STELLA_ENTRY, capabilities: { publicResult: resultOrigin !== null, camera: true, maxQuiz: true },
    close: () => new Promise((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeIdleConnections(); }) };
}
