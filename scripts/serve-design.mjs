// Serves the imported Claude Design prototypes on loopback for manual review.
// Usage: node scripts/serve-design.mjs [port]
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const base = fileURLToPath(new URL('../artifacts/DESIGN/claude-design-stela-20261005/', import.meta.url))
const port = Number(process.argv[2] ?? 5219)
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.md': 'text/plain; charset=utf-8', '.json': 'application/json' }
const pages = ['Stela.standalone.html', 'dc/Stela.dc.html', 'dc/Stela D2 - gradient.dc.html', 'dc/Stela D2 - solid.dc.html']

createServer(async (request, response) => {
  const relative = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/^\/+/, '')
  if (!relative) {
    response.writeHead(200, { 'content-type': types['.html'] })
    response.end('<meta charset="utf-8"><title>Stela design prototypes</title><ul>' + pages.map(page => `<li><a href="/${encodeURI(page)}">${page}</a></li>`).join('') + '</ul>')
    return
  }
  const file = path.join(base, relative)
  if (!file.startsWith(base)) { response.writeHead(403).end(); return }
  try {
    const bytes = await readFile(file)
    response.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' })
    response.end(bytes)
  } catch {
    response.writeHead(404).end('Not found')
  }
}).listen(port, '127.0.0.1', () => console.log(`Design prototypes: http://127.0.0.1:${port}/`))
