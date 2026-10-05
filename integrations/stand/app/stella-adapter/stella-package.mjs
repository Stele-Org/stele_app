import { createHash } from 'node:crypto';
import { readFile, lstat, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const ACCEPTED_BUILD_SHA256 = '493dfdde595641aa029f19f0b9814ce9dfd1ef2321718a164b43fac74a2d6bce';
export const STELLA_ENTRY = '/stella/?master=1';
const manifestBytes = await readFile(new URL('./accepted-build-manifest.json', import.meta.url));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
if (sha(manifestBytes) !== ACCEPTED_BUILD_SHA256) throw Error('Pinned Stella manifest integrity failure');
const accepted = JSON.parse(manifestBytes);
const files = Object.freeze({ ...accepted.files });

/** Paths in this component use portable POSIX notation, never filesystem URLs. */
export function validateStellaRelativePath(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(value)
    || value.split('/').some(p => p === '.' || p === '..' || /[. ]$/.test(p))) throw Error('Unsafe Stella relative path');
  return value;
}
Object.keys(files).forEach(validateStellaRelativePath);

async function rejectSymlinkAncestors(target) {
  const absolute = path.resolve(target);
  let cursor = path.parse(absolute).root;
  for (const part of absolute.slice(cursor.length).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, part);
    try {
      const info = await lstat(cursor);
      if (info.isSymbolicLink()) throw Error(`Symlink/reparse point is not accepted: ${cursor}`);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}

/** Copy only the SHA-approved presentation. Never copies source directories or databases. */
export async function packageStella({ sourceRoot, destinationRoot }) {
  if (!sourceRoot || !destinationRoot) throw Error('sourceRoot and destinationRoot required');
  const source = path.resolve(sourceRoot), destination = path.resolve(destinationRoot);
  const output = path.join(destination, 'app', 'stella-ui');
  if (source === output || source.startsWith(output + path.sep) || output.startsWith(source + path.sep)) throw Error('Source and output overlap');
  await rejectSymlinkAncestors(source);
  await rejectSymlinkAncestors(output);
  try { await lstat(output); throw Error('Stella output already exists; use a fresh release destination'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const sourceManifest = await readFile(path.join(source, 'build-manifest.json'));
  if (sha(sourceManifest) !== ACCEPTED_BUILD_SHA256) throw Error('Source build manifest is not the accepted WAVE08 manifest');
  // Validate the entire payload before creating any release files.
  const payload = [];
  for (const [name, expected] of Object.entries(files)) {
    const filename = path.join(source, name);
    await rejectSymlinkAncestors(filename);
    const info = await lstat(filename);
    if (!info.isFile()) throw Error(`Not a regular Stella file: ${name}`);
    const bytes = await readFile(filename);
    if (sha(bytes) !== expected) throw Error(`Stella payload SHA mismatch: ${name}`);
    payload.push([name, bytes]);
  }
  payload.push(['build-manifest.json', sourceManifest]);
  await mkdir(output, { recursive: true });
  for (const [name, bytes] of payload) {
    const filename = path.join(output, name);
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(filename, bytes, { flag: 'wx' });
  }
  return {
    schema: 'production-stella-component-v1', role: 'STELLA', component: 'stella-ui',
    release: 'PROD-W3-C-MOUNT', root: 'app/stella-ui', entry: STELLA_ENTRY,
    acceptedBuildSha256: ACCEPTED_BUILD_SHA256, sourceManifestSha256: accepted.sourceManifestSha256,
    files: { ...files, 'build-manifest.json': ACCEPTED_BUILD_SHA256 },
    payloadBytes: payload.reduce((total, [, bytes]) => total + bytes.length, 0),
    capabilities: { vkQuiz: 'master-authoritative', maxQuiz: 'master-authoritative', camera: 'not-integrated',
      voice: 'not-integrated', resultPublicUrl: 'blocked-until-trusted-origin', offlineAssets: true,
      offlineQuiz: false, spout: 'host-integration-required' },
    requirements: { stationId: 'stella-main', api: 'same-origin-allowlisted-proxy',
      businessRuntime: 'MASTER-only', requestPolicy: 'classifyStellaRequest',
      pendingStorage: 'existing-sessionStorage-no-new-durability-claim' },
  };
}

const denied = reason => ({ kind: 'denied', status: 403, reason });
const token = '[A-Za-z0-9][A-Za-z0-9._:-]{0,127}';
const readRoutes = [ /^\/health$/, /^\/stations\/stella-main$/,
  new RegExp(`^/sessions/${token}$`), new RegExp(`^/visits/${token}$`),
  new RegExp(`^/admissions/${token}$`), new RegExp(`^/sessions/${token}/acks/${token}$`),
  /^\/max\/definition$/, /^\/stella\/max\/queue-summary$/,
  new RegExp(`^/stella/max/admissions/${token}$`),
  new RegExp(`^/stella/max/sessions/${token}$`),
  new RegExp(`^/stella/max/sessions/${token}/commands/${token}$`) ];
const writeRoutes = [ new RegExp(`^/stella/vk/sessions/${token}/photo$`), /^\/stella\/(?:vk|max)\/admissions$/, new RegExp(`^/stella/(?:vk|max)/sessions/${token}/commands$`) ];

/** Classify the raw HTTP request target BEFORE URL normalization; transport is the host's job.
 * The optional third argument supports hosts that supply pathname and query separately.
 * Route permission is not authorization or payload validation: the master retains both.
 */
export function classifyStellaRequest(method, pathname, query = '') {
  if (typeof method !== 'string' || typeof pathname !== 'string' || typeof query !== 'string') return denied('malformed-request');
  const target = pathname + (query ? (query.startsWith('?') ? query : '?' + query) : '');
  if (!target.startsWith('/') || target.startsWith('//') || /[\\\x00-\x20#]/.test(target)) return denied('unsafe-request-target');
  const split = target.indexOf('?');
  const rawPath = split < 0 ? target : target.slice(0, split);
  const search = split < 0 ? '' : target.slice(split);
  // Percent-encoded paths and dot-segments are not part of this fixed component contract.
  if (rawPath.includes('%') || rawPath.includes('//') || rawPath.split('/').some(p => p === '.' || p === '..')) return denied('unsafe-request-path');
  if (/^\/vkshare(?:\/|$)/.test(rawPath)) return denied('trusted-result-origin-not-configured');
  if (['/', '/index.html', '/stella', '/stella/', '/stella/index.html'].includes(rawPath)) {
    if (!['GET', 'HEAD'].includes(method)) return denied('entry-method');
    if (rawPath !== '/stella/' || search !== '?master=1') return { kind: 'redirect', status: 307, location: STELLA_ENTRY };
    return { kind: 'static', relativePath: 'app/stella-ui/index.html', cacheControl: 'no-store' };
  }
  if (search) return denied('query-not-supported');
  if ((method === 'GET' && readRoutes.some(rule => rule.test(rawPath)))
    || (method === 'POST' && writeRoutes.some(rule => rule.test(rawPath)))) return { kind: 'master-api', method, upstreamPath: rawPath };
  if (['GET', 'HEAD'].includes(method) && rawPath.startsWith('/stella/')) {
    const relative = rawPath.slice('/stella/'.length);
    if (Object.hasOwn(files, relative) && relative !== 'index.html') return { kind: 'static', relativePath: `app/stella-ui/${relative}`, cacheControl: 'no-store' };
  }
  return denied('not-in-stella-allowlist');
}

/** Read only an approved, unmodified asset under a packaged role directory. */
export async function readStellaAsset(packageRoot, relativePath) {
  const prefix = 'app/stella-ui/';
  if (typeof relativePath !== 'string' || !relativePath.startsWith(prefix)) throw Error('Not a Stella asset');
  const relative = relativePath.slice(prefix.length);
  validateStellaRelativePath(relative);
  if (!Object.hasOwn(files, relative)) throw Error('Not an approved Stella asset');
  const filename = path.join(path.resolve(packageRoot), prefix, relative);
  await rejectSymlinkAncestors(filename);
  if (!(await lstat(filename)).isFile()) throw Error('Not a regular Stella asset');
  const bytes = await readFile(filename);
  if (sha(bytes) !== files[relative]) throw Error('Stella asset integrity failure');
  return bytes;
}
