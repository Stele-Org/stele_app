// Unpacks a standalone Claude Design export (one self-contained HTML) into a readable .dc.html
// with relative asset paths. Resources already present in the target folder are reused by SHA256.
// Usage: node scripts/import-design-bundle.mjs <standalone.html> <targetDir> <name.dc.html>
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import path from 'node:path'

const [bundlePath, targetDir, outName] = process.argv.slice(2)
if (!bundlePath || !targetDir || !outName) throw Error('Usage: import-design-bundle.mjs <standalone.html> <targetDir> <name.dc.html>')

const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const html = await readFile(bundlePath, 'utf8')
const section = type => {
  const open = `<script type="__bundler/${type}">`
  const start = html.indexOf(open)
  if (start < 0) throw Error('Not a standalone bundle: section ' + type + ' is missing')
  return JSON.parse(html.slice(start + open.length, html.indexOf('</script>', start)))
}
const manifest = section('manifest')
let template = section('template')

const existing = new Map()
const index = async dir => {
  for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) await index(full)
    else existing.set(sha(await readFile(full)), path.relative(targetDir, full).split(path.sep).join('/'))
  }
}
await index(targetDir)

const extensions = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/svg+xml': 'svg', 'text/javascript': 'js', 'font/woff2': 'woff2', 'font/ttf': 'ttf' }
const fontName = uuid => {
  // Google Fonts CSS: "/* subset */ @font-face { font-family: 'Name'; ... url("uuid")".
  const at = template.indexOf(uuid)
  const block = template.slice(template.lastIndexOf('/*', at), at)
  const subset = /\/\*\s*([a-z-]+)\s*\*\//.exec(block)?.[1]
  const family = /font-family:\s*['"]([^'"]+)['"]/.exec(block)?.[1]
  return subset && family ? `${family.toLowerCase().replace(/\s+/g, '-')}-${subset}` : uuid
}

const written = []
const reused = []
const embeddedOnly = []
for (const [uuid, resource] of Object.entries(manifest)) {
  if (!template.includes(uuid)) { embeddedOnly.push(resource.mime + ' ' + uuid); continue }
  const raw = Buffer.from(resource.data, 'base64')
  const bytes = resource.compressed ? gunzipSync(raw) : raw
  const digest = sha(bytes)
  let relative = existing.get(digest)
  if (relative) reused.push(relative)
  else {
    const extension = extensions[resource.mime] ?? 'bin'
    const folder = resource.mime.startsWith('font/') ? 'fonts' : 'assets'
    relative = `${folder}/${resource.mime === 'font/woff2' ? fontName(uuid) : uuid}.${extension}`
    await mkdir(path.join(targetDir, folder), { recursive: true })
    await writeFile(path.join(targetDir, relative), bytes)
    existing.set(digest, relative)
    written.push(relative)
  }
  template = template.split(uuid).join(relative)
}

await writeFile(path.join(targetDir, outName), template)
console.log(JSON.stringify({ output: outName, bytes: Buffer.byteLength(template), sha256: sha(Buffer.from(template)), reused, written, embeddedOnly }, null, 2))
