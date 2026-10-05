import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const manifestBytes = await readFile(new URL('./reference/accepted-build-manifest.json', import.meta.url))
const manifest = JSON.parse(manifestBytes)
for (const [relative, expected] of Object.entries(manifest.files)) {
  if (!/^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(relative) || relative.split('/').some(x => x === '..' || x === '.')) throw Error('Invalid manifest path')
  const bytes = await readFile(new URL('./stella-candidate/dist/' + relative, import.meta.url))
  if (sha(bytes) !== expected) throw Error('Build differs from installed version: ' + relative)
}
if (process.argv.includes('--seal')) await writeFile(new URL('./stella-candidate/dist/build-manifest.json', import.meta.url), manifestBytes)
console.log(JSON.stringify({ verifiedFiles: Object.keys(manifest.files).length, installedBuildSha256: sha(manifestBytes), sealed: process.argv.includes('--seal') }))
