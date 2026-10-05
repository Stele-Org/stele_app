// Browserless smoke test: starts the real Vite dev server on a spare port, requests the entry page and
// every module of the application graph over HTTP, then checks the build output and the design prototypes.
// No browser, camera, MASTER backend or AI is involved.
import { readFile, readdir, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import vm from 'node:vm'

const root = fileURLToPath(new URL('..', import.meta.url))
const candidate = path.join(root, 'integrations/master/stella-candidate')
const buildCheck = path.join(candidate, '.cache/build-check')
const design = path.join(root, 'artifacts/DESIGN/claude-design-stela-20261005')

const results = []
const check = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail })
const exists = file => stat(file).then(() => true, () => false)
const files = async dir => (await readdir(dir, { recursive: true, withFileTypes: true })).filter(entry => entry.isFile()).map(entry => path.join(entry.parentPath, entry.name))

// 1. Dev server: entry page, module graph, public assets.
const vite = await import(pathToFileURL(path.join(candidate, 'node_modules/vite/dist/node/index.js')).href)
const server = await vite.createServer({ configFile: path.join(candidate, 'vite.config.ts'), server: { port: 5290, strictPort: false }, logLevel: 'error', clearScreen: false })
try {
  await server.listen()
  const base = server.resolvedUrls.local[0]
  const origin = new URL(base).origin
  const page = await fetch(base)
  const html = await page.text()
  check('dev: entry page', page.status === 200 && html.includes('<div id="root">') && html.includes('/stella/src/main.tsx'), `${base} -> ${page.status}`)
  check('dev: local header', page.headers.get('x-vk-stella-local') === '1')
  const master = await fetch(base + '?master=1')
  check('dev: master entry page', master.status === 200, `?master=1 -> ${master.status}`)

  const seen = new Set(['/stella/src/main.tsx'])
  const queue = [...seen]
  const failed = []
  while (queue.length && seen.size < 3000) {
    const url = queue.shift()
    let response = await fetch(origin + url)
    // The dependency optimizer may still be bundling on the first requests.
    for (let attempt = 0; response.status === 504 && attempt < 5; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 1500))
      response = await fetch(origin + url)
    }
    const body = await response.text()
    if (response.status !== 200) { failed.push(`${response.status} ${url}`); continue }
    if (!(response.headers.get('content-type') ?? '').includes('javascript')) continue
    for (const match of body.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)["'](\/[^"']+)["']/g)) {
      if (!seen.has(match[1])) { seen.add(match[1]); queue.push(match[1]) }
    }
  }
  check('dev: module graph', failed.length === 0 && seen.size > 50, `${seen.size} modules requested, ${failed.length} failed${failed.length ? ': ' + failed.slice(0, 5).join('; ') : ''}`)

  const publicDir = path.join(candidate, 'public')
  const publicFiles = await files(publicDir)
  const step = Math.max(1, Math.floor(publicFiles.length / 12))
  let served = 0
  const sample = publicFiles.filter((_, index) => index % step === 0)
  for (const file of sample) {
    const relative = path.relative(publicDir, file).split(path.sep).map(encodeURIComponent).join('/')
    const response = await fetch(base + relative)
    const bytes = Buffer.from(await response.arrayBuffer())
    if (response.status === 200 && bytes.length === (await stat(file)).size) served++
  }
  check('dev: public assets', served === sample.length, `${served}/${sample.length} sampled of ${publicFiles.length}`)
} finally {
  await server.close()
}

// 2. Build output of `stella.ps1 build-check` (kept apart from the accepted dist).
if (await exists(path.join(buildCheck, 'index.html'))) {
  const html = await readFile(path.join(buildCheck, 'index.html'), 'utf8')
  const refs = [...html.matchAll(/(?:src|href)="\/stella\/([^"]+)"/g)].map(match => match[1])
  const present = await Promise.all(refs.map(ref => exists(path.join(buildCheck, ref))))
  check('build: entry references', refs.length > 0 && present.every(Boolean), refs.join(', '))
  const accepted = JSON.parse(await readFile(path.join(root, 'integrations/master/reference/accepted-build-manifest.json'), 'utf8')).files
  let identical = 0
  for (const [relative, expected] of Object.entries(accepted)) {
    const bytes = await readFile(path.join(buildCheck, relative)).catch(() => null)
    if (bytes && createHash('sha256').update(bytes).digest('hex') === expected) identical++
  }
  check('build: compared with accepted build', true, `${identical}/${Object.keys(accepted).length} files byte-identical (informational)`)
} else check('build: output present', false, 'run "stella.ps1 build-check" first')

// 3. Design prototypes imported from the Claude Design session.
const standalone = await readFile(path.join(design, 'Stela.standalone.html'), 'utf8').catch(() => '')
check('design: standalone page', ['manifest', 'template'].every(type => standalone.includes(`<script type="__bundler/${type}">`)), `${standalone.length} chars`)
for (const file of (await readdir(path.join(design, 'dc')).catch(() => [])).filter(name => name.endsWith('.dc.html'))) {
  const html = await readFile(path.join(design, 'dc', file), 'utf8')
  const refs = new Set()
  for (const match of html.matchAll(/(?:src|href)="([^"{]+)"|url\("([^"]+)"\)|'((?:assets|fonts)\/[^']+)'/g)) {
    const ref = match[1] ?? match[2] ?? match[3]
    if (!/^(https?:|data:|#)/.test(ref)) refs.add(ref.replace(/^\.\//, ''))
  }
  const missing = []
  for (const ref of refs) if (!(await exists(path.join(design, 'dc', ref)))) missing.push(ref)
  let syntax = ''
  try {
    const script = /<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/.exec(html)[1]
    new vm.Script(`(function (DCLogic, React) {${script}\n})`)
  } catch (error) { syntax = String(error) }
  check(`design: ${file}`, missing.length === 0 && !syntax, `${refs.size} local references${missing.length ? ', missing: ' + missing.join(', ') : ''}${syntax ? ', ' + syntax : ''}`)
}

for (const result of results) console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.detail ? '  -- ' + result.detail : ''}`)
const failures = results.filter(result => !result.ok).length
console.log(`\nSMOKE ${failures ? 'FAILED' : 'PASSED'}: ${results.length - failures}/${results.length}`)
process.exit(failures ? 1 : 0)
