// Compares the working tree with PACKAGE-MANIFEST.json (SHA256 of every file of the received package).
// Reports changed and missing files; files added after the hand-over are listed only with --extra.
import { readFile, readdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('..', import.meta.url))
const manifest = JSON.parse(await readFile(path.join(root, 'PACKAGE-MANIFEST.json'), 'utf8')).files
const skipped = new Set(['.git', '.tools', 'node_modules', '.cache'])

const changed = []
const missing = []
for (const [relative, expected] of Object.entries(manifest)) {
  let bytes
  try {
    bytes = await readFile(path.join(root, relative))
  } catch {
    missing.push(relative)
    continue
  }
  if (createHash('sha256').update(bytes).digest('hex') !== expected.sha256) changed.push(relative)
}

const extra = []
if (process.argv.includes('--extra')) {
  const walk = async dir => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (skipped.has(entry.name)) continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) await walk(full)
      else {
        const relative = path.relative(root, full).split(path.sep).join('/')
        if (!(relative in manifest)) extra.push(relative)
      }
    }
  }
  await walk(root)
}

console.log(JSON.stringify({ manifestFiles: Object.keys(manifest).length, changed, missing, extra }, null, 2))
if (missing.length) process.exitCode = 1
