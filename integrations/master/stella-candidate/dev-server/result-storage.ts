import { mkdir, readdir } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import type { Plugin } from 'vite'
import { ownPage, readBody, writeWhole } from './photo-storage.ts'

/**
 * Local result storage of the dev server (user request, 07.10.2026): when a visitor has made every choice of the
 * VK Видео test, the page sends the result, and it is written as one JSON file to a plain directory,
 * `ResultStorage` in the project root, where the wall and the page behind the QR code can pick it up.
 * Nothing here runs in a build or on the stand.
 *
 * A result is `<UTC time>_<session id>.json`, written under a `.part` name and renamed: a reader never sees half
 * a file. The page builds the document (`src/features/prototype/vk-result.ts`); the server checks only what it
 * needs to name the file and to refuse something that is not a result.
 */
export const RESULT_STORAGE_ROUTE = '/stella/result-storage'
export const MAX_RESULT_BYTES = 64 * 1024
const SESSION_ID = /^[A-Za-z0-9-]{8,64}$/

export class ResultRejected extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}

/** Stores one result; a repeated session id returns the file written the first time and writes nothing. */
export async function storeResult(directory: string, text: string, now = new Date()): Promise<{ file: string; created: boolean }> {
  if (!text.length || Buffer.byteLength(text) > MAX_RESULT_BYTES) throw new ResultRejected(413, 'Result size out of bounds')
  let result: unknown
  try { result = JSON.parse(text) } catch { throw new ResultRejected(400, 'Not JSON') }
  const { type, schemaVersion, sessionId } = (result && typeof result === 'object' ? result : {}) as Record<string, unknown>
  if (type !== 'stella-vk-result' || schemaVersion !== 1) throw new ResultRejected(422, 'Not a Stella VK result')
  if (typeof sessionId !== 'string' || !SESSION_ID.test(sessionId)) throw new ResultRejected(400, 'Invalid session id')
  await mkdir(directory, { recursive: true })
  const known = (await readdir(directory)).find(name => name.endsWith(`_${sessionId}.json`))
  if (known) return { file: known, created: false }
  // 20261007T101500Z: sorts by time and is a valid file name on every system.
  const file = `${now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}_${sessionId}.json`
  await writeWhole(path.join(directory, file), `${JSON.stringify(result, null, 2)}\n`)
  return { file, created: true }
}

/** `POST <route>` with the result as a JSON body. */
export async function receiveResult(directory: string, request: IncomingMessage, response: ServerResponse) {
  const reply = (status: number, body: unknown) => {
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
    response.end(JSON.stringify(body))
  }
  try {
    // The route is mounted by prefix: nothing below it exists.
    if (!['', '/'].includes((request.url ?? '').split('?')[0])) throw new ResultRejected(404, 'Not found')
    if (request.method !== 'POST') throw new ResultRejected(405, 'POST only')
    if (!ownPage(request)) throw new ResultRejected(403, 'Foreign origin')
    if (!/^application\/json\b/.test(String(request.headers['content-type']))) throw new ResultRejected(415, 'application/json only')
    const bytes = await readBody(request, MAX_RESULT_BYTES).catch(() => { throw new ResultRejected(413, 'Result too large') })
    const { file, created } = await storeResult(directory, bytes.toString('utf8'))
    reply(created ? 201 : 200, { file })
  } catch (error) {
    if (error instanceof ResultRejected) { reply(error.status, { error: error.message }); return }
    console.error('[result-storage]', error)
    reply(500, { error: 'Result was not stored' })
  }
}

/** Dev server only (`apply: 'serve'`): a build has no such route. */
export function resultStorage(directory: string): Plugin {
  return {
    name: 'stella-result-storage',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(RESULT_STORAGE_ROUTE, (request, response) => { void receiveResult(directory, request, response) })
    },
  }
}
