import { createHash } from 'node:crypto'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { MAX_PHOTO_BYTES, PhotoRejected, receivePhoto, storePhoto, type StoredPhoto } from './photo-storage'

const jpeg = (size = 64) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(size - 6, 7), Buffer.from([0xff, 0xd9])])
const captureId = '4f0c2c1e-6a51-4b8e-9d3f-2b7a9c1e5d10'
const at = new Date('2026-10-06T19:45:12.345Z')
let directory: string
beforeEach(async () => { directory = await mkdtemp(path.join(tmpdir(), 'stella-photo-storage-')) })
afterEach(async () => { await rm(directory, { recursive: true, force: true }) })

it('writes the photo and then its description, under names that sort by time, and leaves no partial files', async () => {
  const bytes = jpeg()
  const { stored, created } = await storePhoto(directory, { captureId, upright: true, bytes }, at)
  expect(created).toBe(true)
  expect(stored).toEqual({
    captureId, file: `20261006T194512Z_${captureId}.jpg`, storedAt: '2026-10-06T19:45:12.345Z', bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'), upright: true,
  })
  expect((await readdir(directory)).sort()).toEqual([`20261006T194512Z_${captureId}.jpg`, `20261006T194512Z_${captureId}.json`])
  expect(await readFile(path.join(directory, stored.file))).toEqual(bytes)
  expect(JSON.parse(await readFile(path.join(directory, `20261006T194512Z_${captureId}.json`), 'utf8'))).toEqual(stored)
})

it('does not store the same photograph twice', async () => {
  const first = await storePhoto(directory, { captureId, upright: false, bytes: jpeg() }, at)
  const again = await storePhoto(directory, { captureId, upright: false, bytes: jpeg(128) }, new Date('2026-10-06T19:50:00Z'))
  expect(again).toEqual({ stored: first.stored, created: false })
  expect(await readdir(directory)).toHaveLength(2)
})

it.each([
  ['a capture id that could leave the directory', { captureId: '../../outside', bytes: jpeg() }, 400],
  ['an empty body', { captureId, bytes: Buffer.alloc(0) }, 413],
  ['a photo of 1 MB or more', { captureId, bytes: jpeg(MAX_PHOTO_BYTES) }, 413],
  ['a file that is not a JPEG', { captureId, bytes: Buffer.from('<html>not a photo</html>') }, 415],
])('refuses %s and writes nothing', async (_, photo, status) => {
  await expect(storePhoto(directory, { upright: true, ...photo })).rejects.toMatchObject({ status })
  await expect(storePhoto(directory, { upright: true, ...photo })).rejects.toBeInstanceOf(PhotoRejected)
  expect(await readdir(directory)).toEqual([])
})

function exchange(options: { method?: string; url?: string; headers?: Record<string, string>; body?: Buffer }) {
  const request = Object.assign(Readable.from(options.body ? [options.body] : []), {
    method: options.method ?? 'POST', url: options.url ?? '/',
    headers: { host: '127.0.0.1:5218', 'content-type': 'image/jpeg', 'x-capture-id': captureId, 'x-camera-upright': '1', ...options.headers },
  }) as unknown as IncomingMessage
  const result = { status: 0, body: null as unknown }
  const response = {
    writeHead(status: number) { result.status = status; return this },
    end(text: string) { result.body = JSON.parse(text) },
  } as unknown as ServerResponse
  return receivePhoto(directory, request, response).then(() => result)
}

it('accepts a JPEG from its own page: 201 for a new photo, 200 for a repeat', async () => {
  const first = await exchange({ body: jpeg(), headers: { origin: 'http://127.0.0.1:5218', 'sec-fetch-site': 'same-origin' } })
  expect(first.status).toBe(201)
  expect((first.body as StoredPhoto).upright).toBe(true)
  expect(await readdir(directory)).toHaveLength(2)
  const repeat = await exchange({ body: jpeg() })
  expect(repeat.status).toBe(200)
  expect(repeat.body).toEqual(first.body)
  expect(await readdir(directory)).toHaveLength(2)
})

it.each([
  ['another site open in the same browser', { body: jpeg(), headers: { origin: 'https://example.com' } }, 403],
  ['a cross-site request', { body: jpeg(), headers: { 'sec-fetch-site': 'cross-site' } }, 403],
  ['a method other than POST', { method: 'GET' }, 405],
  ['a path below the route', { url: '/../secrets', body: jpeg() }, 404],
  ['a body that is not declared as JPEG', { body: jpeg(), headers: { 'content-type': 'application/json' } }, 415],
  ['a declared length over the limit', { body: jpeg(), headers: { 'content-length': String(MAX_PHOTO_BYTES + 1) } }, 413],
  ['a missing capture id', { body: jpeg(), headers: { 'x-capture-id': '' } }, 400],
])('refuses %s', async (_, options, status) => {
  expect((await exchange(options)).status).toBe(status)
  expect(await readdir(directory)).toEqual([])
})
