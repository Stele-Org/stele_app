import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Offline preparation only. Never import this credential-bearing tool into the browser.
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const app = path.join(root, 'artifacts/stella-prototype');
const statePath = path.join(root, 'secrets/secrets/AI/vasilisa-tts-state.json');
const reportPath = path.join(root, 'artifacts/reports/vasilisa-api-20261004.json');
const python = 'C:/Users/futuronika_ai/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const creds = JSON.parse(execFileSync(python, ['-c', "import csv,json,io; from pathlib import Path; p=list(Path('secrets/secrets/AI').glob('*.csv')); assert len(p)==1; print(json.dumps(dict(csv.reader(io.StringIO(p[0].read_text(encoding='utf-8-sig'))))))"], { cwd: root, encoding: 'utf8' }));
const host = `${creds.workspaceId}.ap-southeast-1.maas.aliyuncs.com`;
if (creds.apiHost !== host || creds.dashScope !== `https://${host}/api/v1`) throw new Error('Endpoint validation failed');
const model = 'qwen3-tts-vc-2026-01-22';
const reference = readFileSync(path.join(app, 'voice/vasilisa/reference.wav'));
const sha256 = createHash('sha256').update(reference).digest('hex');
const safeCode = v => typeof v === 'string' && /^[a-zA-Z0-9_.-]{1,70}$/.test(v) && !v.startsWith('sk-') ? v : 'unclassified';
const save = (p, v) => writeFileSync(p, JSON.stringify(v, null, 2) + '\n');
let state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : null;
const report = { checkedAt: new Date().toISOString(), model, referenceSha256: sha256, referenceBytes: reference.length, checks: [] };
async function post(endpoint, payload) {
  const r = await fetch(`${creds.dashScope}/${endpoint}`, { method: 'POST', headers: { Authorization: `Bearer ${creds.apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(90000), redirect: 'error' });
  const body = await r.json().catch(() => ({}));
  report.checks.push({ operation: payload.input?.action ?? 'synthesis', httpStatus: r.status, errorCode: r.ok ? null : safeCode(body.code ?? body.error?.code) });
  save(reportPath, report);
  if (!r.ok) throw new Error(`Provider:${safeCode(body.code ?? body.error?.code)}`);
  return body;
}
async function main() {
  if (state && (state.referenceSha256 !== sha256 || state.model !== model)) throw new Error('Stored voice differs from sample/model; inspect private state');
  if (!state?.voice) {
    if (state?.status === 'pending' || state?.status === 'unknown') throw new Error('Uncertain previous enrollment; reconcile with provider list before retry');
    if (state?.status === 'rejected' && !process.argv.includes('--retry-rejected')) throw new Error('Previous request rejected; resolve access before explicit retry');
    state = { model, referenceSha256: sha256, preferredName: 'vasilisa', status: 'pending', createdAt: new Date().toISOString() };
    save(statePath, state);
    try {
      const body = await post('services/audio/tts/customization', { model: 'qwen-voice-enrollment', input: { action: 'create', target_model: model, preferred_name: 'vasilisa', audio: { data: `data:audio/wav;base64,${reference.toString('base64')}` } } });
      if (!body.output?.voice) throw new Error('No voice identifier returned');
      state.voice = body.output.voice;
      state.status = 'created';
      save(statePath, state);
    } catch (error) {
      state.status = error.message.startsWith('Provider:') ? 'rejected' : 'unknown';
      save(statePath, state);
      throw error;
    }
  }
  report.voiceCreated = true;
  const phrases = JSON.parse(readFileSync(path.join(app, 'voice/vasilisa/phrases.json'), 'utf8')).phrases;
  const output = path.join(app, 'public/voice/vasilisa');
  mkdirSync(output, { recursive: true });
  const manifest = { version: 1, voice: 'Василиса', ready: false, assets: {} };
  for (const phrase of phrases) {
    if (!/^[a-z0-9-]+$/.test(phrase.id)) throw new Error('Invalid phrase ID');
    const file = `${phrase.id}.wav`;
    const destination = path.join(output, file);
    const textSha = createHash('sha256').update(phrase.text).digest('hex');
    const tempo = phrase.id === 'vk-camera' ? 1.2 : 1;
    state.clips ??= {};
    if (!existsSync(destination) || state.clips[phrase.id]?.textSha !== textSha) {
      const result = state.pendingClip?.id === phrase.id && state.pendingClip?.textSha === textSha ? state.pendingClip.result : await post('services/aigc/multimodal-generation/generation', { model, input: { text: phrase.text, voice: state.voice, language_type: 'Russian' } });
      state.pendingClip = { id: phrase.id, textSha, result };
      save(statePath, state);
      const url = new URL(result.output?.audio?.url);
      // The service may return a public OSS HTTP link; always download over TLS.
      if (url.protocol === 'http:' && url.hostname.endsWith('.aliyuncs.com')) url.protocol = 'https:';
      if (url.protocol !== 'https:' || !(url.hostname.endsWith('.aliyuncs.com') || url.hostname.endsWith('.alibabacloud.com'))) throw new Error('Unexpected audio download host');
      const audio = await fetch(url, { signal: AbortSignal.timeout(30000), redirect: 'error' });
      if (!audio.ok) throw new Error('Audio download failed');
      const bytes = Buffer.from(await audio.arrayBuffer());
      if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') throw new Error('Expected WAV audio');
      execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', 'pipe:0', '-af', `atempo=${tempo}`, '-ac', '1', '-ar', '24000', '-c:a', 'pcm_s16le', destination], { input: bytes, stdio: ['pipe', 'pipe', 'pipe'] });
      const normalized = readFileSync(destination);
      state.clips[phrase.id] = { textSha, bytes: normalized.length, sha256: createHash('sha256').update(normalized).digest('hex'), normalized: true, tempo };
      delete state.pendingClip;
      save(statePath, state);
    } else if (!state.clips[phrase.id].normalized || (state.clips[phrase.id].tempo ?? 1) !== tempo) {
      const bytes = readFileSync(destination);
      execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', 'pipe:0', '-af', `atempo=${tempo / (state.clips[phrase.id].tempo ?? 1)}`, '-ac', '1', '-ar', '24000', '-c:a', 'pcm_s16le', destination], { input: bytes, stdio: ['pipe', 'pipe', 'pipe'] });
      const normalized = readFileSync(destination);
      Object.assign(state.clips[phrase.id], { normalized: true, tempo, bytes: normalized.length, sha256: createHash('sha256').update(normalized).digest('hex') });
      save(statePath, state);
    }
    manifest.assets[phrase.id] = file;
    report.completedClips = Object.keys(manifest.assets).length;
    save(reportPath, report);
  }
  manifest.ready = true;
  save(path.join(output, 'manifest.json'), manifest);
}
try { await main(); } catch (error) { report.failure = error.message?.startsWith('Provider:') || ['Unexpected audio download host', 'Audio download failed', 'Expected WAV audio'].includes(error.message) ? error.message : safeCode(error.name); report.complete = false; }
report.complete ??= true;
save(reportPath, report);
console.log(JSON.stringify(report, null, 2));
if (!report.complete) process.exitCode = 1;
