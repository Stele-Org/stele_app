import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import type { Plugin } from 'vite'

/**
 * Local photo storage of the dev server (user request, 06.10.2026): the photo a visitor approved in the local
 * scenario is written to a plain directory, `PhotoStorage` in the project root, where another machine or service
 * can pick it up once the directory is shared. Nothing here runs in a build or on the stand.
 *
 * A photo is two files, `<UTC time>_<capture id>.jpg` and the same name with `.json`. Each is written under a
 * `.part` name and renamed, and the description is written last: a reader that sees the `.json` has a whole photo.
 */
export const PHOTO_STORAGE_ROUTE = '/stella/photo-storage'
/** The capture encoder keeps a frame under 1 MB (features/master/camera-capture.ts). */
export const MAX_PHOTO_BYTES = 1024 * 1024
const CAPTURE_ID = /^[A-Za-z0-9-]{8,64}$/

export interface StoredPhoto {
  captureId: string
  file: string
  storedAt: string
  bytes: number
  sha256: string
  /** False: the frame of the stand's sideways BRIO, already turned upright by the encoder. True: a camera that stands upright. */
  upright: boolean
}

export class PhotoRejected extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}

export async function writeWhole(file: string, data: Buffer | string) {
  await writeFile(`${file}.part`, data)
  await rename(`${file}.part`, file)
}

/** Stores one photo; a repeated capture id returns the description written the first time and writes nothing. */
export async function storePhoto(directory: string, photo: { captureId: string; upright: boolean; bytes: Buffer }, now = new Date()): Promise<{ stored: StoredPhoto; created: boolean }> {
  const { captureId, upright, bytes } = photo
  if (!CAPTURE_ID.test(captureId)) throw new PhotoRejected(400, 'Invalid capture id')
  if (!bytes.length || bytes.length >= MAX_PHOTO_BYTES) throw new PhotoRejected(413, 'Photo size out of bounds')
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) throw new PhotoRejected(415, 'Not a JPEG')
  await mkdir(directory, { recursive: true })
  const known = (await readdir(directory)).find(name => name.endsWith(`_${captureId}.json`))
  if (known) return { stored: JSON.parse(await readFile(path.join(directory, known), 'utf8')) as StoredPhoto, created: false }
  // 20261006T194512Z: sorts by time and is a valid file name on every system.
  const name = `${now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}_${captureId}`
  const stored: StoredPhoto = {
    captureId, file: `${name}.jpg`, storedAt: now.toISOString(), bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'), upright,
  }
  await writeWhole(path.join(directory, stored.file), bytes)
  await writeWhole(path.join(directory, `${name}.json`), `${JSON.stringify(stored, null, 2)}\n`)
  return { stored, created: true }
}

export function readBody(request: IncomingMessage, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    if (Number(request.headers['content-length']) > limit) { reject(new PhotoRejected(413, 'Photo too large')); return }
    const chunks: Buffer[] = []
    let size = 0
    request.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > limit) { reject(new PhotoRejected(413, 'Photo too large')); request.destroy(); return }
      chunks.push(chunk)
    })
    request.on('end', () => resolve(Buffer.concat(chunks)))
    request.on('error', reject)
  })
}

/** Only the page this dev server serves may store a photo: a foreign site open in the same browser may not. */
export function ownPage(request: IncomingMessage) {
  const site = request.headers['sec-fetch-site']
  if (site && site !== 'same-origin') return false
  const { origin } = request.headers
  if (!origin) return true
  try { return new URL(origin).host === request.headers.host } catch { return false }
}

/** `POST <route>` with the JPEG as the body, `X-Capture-Id` and `X-Camera-Upright: 1|0`. */
export async function receivePhoto(directory: string, request: IncomingMessage, response: ServerResponse) {
  const reply = (status: number, body: unknown) => {
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
    response.end(JSON.stringify(body))
  }
  try {
    // The route is mounted by prefix: nothing below it exists.
    if (!['', '/'].includes((request.url ?? '').split('?')[0])) throw new PhotoRejected(404, 'Not found')
    if (request.method !== 'POST') throw new PhotoRejected(405, 'POST only')
    if (!ownPage(request)) throw new PhotoRejected(403, 'Foreign origin')
    if (!/^image\/jpeg\b/.test(String(request.headers['content-type']))) throw new PhotoRejected(415, 'image/jpeg only')
    const bytes = await readBody(request, MAX_PHOTO_BYTES)
    const { stored, created } = await storePhoto(directory, {
      captureId: String(request.headers['x-capture-id'] ?? ''), upright: request.headers['x-camera-upright'] === '1', bytes,
    })
    reply(created ? 201 : 200, stored)
  } catch (error) {
    if (error instanceof PhotoRejected) { reply(error.status, { error: error.message }); return }
    console.error('[photo-storage]', error)
    reply(500, { error: 'Photo was not stored' })
  }
}

/** Dev server only (`apply: 'serve'`): a build has no such route. */
export function photoStorage(directory: string): Plugin {
  return {
    name: 'stella-photo-storage',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(PHOTO_STORAGE_ROUTE, (request, response) => { void receivePhoto(directory, request, response) })
    },
  }
}
