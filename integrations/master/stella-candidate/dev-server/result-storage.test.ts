import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { MAX_RESULT_BYTES, ResultRejected, receiveResult, storeResult } from './result-storage'

const sessionId = '4f0c2c1e-6a51-4b8e-9d3f-2b7a9c1e5d10'
const result = (extra: Record<string, unknown> = {}) => ({ schemaVersion: 1, type: 'stella-vk-result', sessionId, tags: ['сериал'], ...extra })
const at = new Date('2026-10-07T10:15:00.345Z')
let directory: string
beforeEach(async () => { directory = await mkdtemp(path.join(tmpdir(), 'stella-result-storage-')) })
afterEach(async () => { await rm(directory, { recursive: true, force: true }) })

it('writes the result as one readable JSON file under a name that sorts by time, and leaves no partial file', async () => {
  const stored = await storeResult(directory, JSON.stringify(result()), at)
  expect(stored).toEqual({ file: `20261007T101500Z_${sessionId}.json`, created: true })
  expect(await readdir(directory)).toEqual([stored.file])
  const text = await readFile(path.join(directory, stored.file), 'utf8')
  expect(JSON.parse(text)).toEqual(result())
  // Indented, with the Russian words as they are, for a person who opens the file.
  expect(text).toContain('\n  "tags": [\n    "сериал"\n  ]')
  expect(text.endsWith('}\n')).toBe(true)
})

it('does not store the result of the same session twice', async () => {
  const first = await storeResult(directory, JSON.stringify(result()), at)
  const again = await storeResult(directory, JSON.stringify(result({ tags: ['другое'] })), new Date('2026-10-07T10:20:00Z'))
  expect(again).toEqual({ file: first.file, created: false })
  expect(await readdir(directory)).toEqual([first.file])
  expect(JSON.parse(await readFile(path.join(directory, first.file), 'utf8')).tags).toEqual(['сериал'])
})

it.each([
  ['an empty body', '', 413],
  ['a body over the limit', JSON.stringify(result({ padding: 'x'.repeat(MAX_RESULT_BYTES) })), 413],
  ['text that is not JSON', '<html>not a result</html>', 400],
  ['JSON that is not a result', JSON.stringify({ sessionId }), 422],
  ['a result of another version', JSON.stringify(result({ schemaVersion: 2 })), 422],
  ['a session id that could leave the directory', JSON.stringify(result({ sessionId: '../../outside' })), 400],
  ['a result without a session id', JSON.stringify(result({ sessionId: undefined })), 400],
])('refuses %s and writes nothing', async (_, text, status) => {
  await expect(storeResult(directory, text)).rejects.toMatchObject({ status })
  await expect(storeResult(directory, text)).rejects.toBeInstanceOf(ResultRejected)
  expect(await readdir(directory)).toEqual([])
})

function exchange(options: { method?: string; url?: string; headers?: Record<string, string>; body?: string }) {
  const request = Object.assign(Readable.from(options.body === undefined ? [] : [Buffer.from(options.body)]), {
    method: options.method ?? 'POST', url: options.url ?? '/',
    headers: { host: '127.0.0.1:5218', 'content-type': 'application/json', ...options.headers },
  }) as unknown as IncomingMessage
  const reply = { status: 0, body: null as unknown }
  const response = {
    writeHead(status: number) { reply.status = status; return this },
    end(text: string) { reply.body = JSON.parse(text) },
  } as unknown as ServerResponse
  return receiveResult(directory, request, response).then(() => reply)
}

it('accepts a result from its own page: 201 for a new one, 200 for a repeat', async () => {
  const body = JSON.stringify(result())
  const first = await exchange({ body, headers: { origin: 'http://127.0.0.1:5218', 'sec-fetch-site': 'same-origin' } })
  expect(first.status).toBe(201)
  expect((first.body as { file: string }).file).toMatch(new RegExp(`^\\d{8}T\\d{6}Z_${sessionId}\\.json$`))
  const again = await exchange({ body })
  expect(again).toEqual({ status: 200, body: first.body })
  expect(await readdir(directory)).toHaveLength(1)
})

it.each([
  ['another method', { method: 'GET' }, 405],
  ['a path below the route', { url: '/latest' }, 404],
  ['a foreign site', { headers: { 'sec-fetch-site': 'cross-site' } }, 403],
  ['a foreign origin', { headers: { origin: 'http://example.test' } }, 403],
  ['a body that is not JSON by its type', { headers: { 'content-type': 'text/plain' } }, 415],
  ['an invalid result', { body: '{"type":"other"}' }, 422],
])('answers %s with an error and stores nothing', async (_, options, status) => {
  const reply = await exchange({ body: JSON.stringify(result()), ...options })
  expect(reply.status).toBe(status)
  expect((reply.body as { error: string }).error).toBeTruthy()
  expect(await readdir(directory).catch(() => [])).toEqual([])
})
