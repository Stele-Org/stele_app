// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const catalog = vi.hoisted(() => ({ images: [] as string[], fonts: [] as string[] }))
vi.mock('./content-assets', () => ({ contentImages: catalog.images, contentFonts: catalog.fonts }))

class PendingImage {
  static created: PendingImage[] = []
  src = ''
  decoding = ''
  resolve!: () => void
  reject!: (error: Error) => void
  promise = new Promise<void>((resolve, reject) => { this.resolve = resolve; this.reject = reject })
  decode = vi.fn(() => this.promise)
  constructor() { PendingImage.created.push(this) }
}
const drain = () => vi.advanceTimersByTimeAsync(0)

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  catalog.images.splice(0, catalog.images.length, '/a.svg', '/b.svg')
  catalog.fonts.splice(0)
  PendingImage.created = []
  vi.stubGlobal('Image', PendingImage)
})
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

it('catalog includes late-screen content and CSS decoration without duplicate URLs', async () => {
  const actual = await vi.importActual<typeof import('./content-assets')>('./content-assets')
  expect(new Set(actual.contentImages).size).toBe(actual.contentImages.length)
  const required = await Promise.all([
    import('../assets/ux-reference/vk-new-home.svg'), import('../assets/ux-reference/vk-new-camera.svg'),
    import('../assets/ux-reference/vk-new-silhouette.svg'), import('../assets/ux-reference/vk-new-qr.svg'),
    import('../assets/ux-reference/max-cta.svg'),
  ])
  for (const asset of required) expect(actual.contentImages).toContain(asset.default)
  expect(actual.contentFonts).toHaveLength(7)
})

it('shares startup work across callers and keeps successful resources ready across screen requests', async () => {
  const loader = await import('./preloadImages')
  const first = loader.preloadContent()
  expect(loader.preloadContent()).toBe(first)
  await drain()
  expect(PendingImage.created.map(image => image.src)).toEqual(['/a.svg', '/b.svg'])
  expect(loader.getContentStatus().phase).toBe('loading')
  PendingImage.created.forEach(image => image.resolve())
  await first
  expect(loader.getContentStatus()).toMatchObject({ phase: 'ready', completed: 2, total: 2, failed: [] })
  await loader.preloadContent()
  expect(PendingImage.created).toHaveLength(2)
  expect(PendingImage.created.every(image => image.src !== '')).toBe(true)
})

it('retries only failures while retaining successful image and font preparation', async () => {
  catalog.fonts.push('400 16px "Example"')
  const fontLoad = vi.fn().mockResolvedValue([{}])
  Object.defineProperty(document, 'fonts', { configurable: true, value: { load: fontLoad } })
  const loader = await import('./preloadImages')
  const first = loader.preloadContent()
  await drain()
  PendingImage.created[0].resolve()
  PendingImage.created[1].reject(new Error('missing'))
  await first
  expect(loader.getContentStatus()).toMatchObject({ phase: 'error', failed: ['/b.svg'], completed: 3 })
  expect(PendingImage.created[1].src).toBe('')
  const retry = loader.preloadContent()
  await drain()
  expect(PendingImage.created.map(image => image.src)).toEqual(['/a.svg', '', '/b.svg'])
  PendingImage.created[2].resolve()
  await retry
  expect(loader.getContentStatus()).toMatchObject({ phase: 'ready', failed: [] })
  expect(fontLoad).toHaveBeenCalledOnce()
})

it('limits decode work to four concurrent resources', async () => {
  catalog.images.splice(0, catalog.images.length, ...Array.from({ length: 9 }, (_, i) => `/${i}.svg`))
  const loader = await import('./preloadImages')
  const work = loader.preloadContent()
  await drain()
  expect(PendingImage.created).toHaveLength(4)
  PendingImage.created[0].resolve()
  await drain()
  expect(PendingImage.created).toHaveLength(5)
  PendingImage.created.slice(1, 5).forEach(image => image.resolve())
  await drain()
  expect(PendingImage.created).toHaveLength(9)
  PendingImage.created.slice(5).forEach(image => image.resolve())
  await work
  expect(loader.getContentStatus().completed).toBe(9)
})

it('times out without wedging startup and ignores late completion after a successful retry', async () => {
  catalog.images.splice(1)
  const loader = await import('./preloadImages')
  const work = loader.preloadContent()
  await drain()
  const stale = PendingImage.created[0]
  await vi.advanceTimersByTimeAsync(20_000)
  await work
  expect(loader.getContentStatus()).toMatchObject({ phase: 'error', failed: ['/a.svg'] })
  const retry = loader.preloadContent()
  await drain()
  PendingImage.created[1].resolve()
  await retry
  stale.resolve()
  await drain()
  expect(loader.getContentStatus()).toMatchObject({ phase: 'ready', completed: 1, failed: [] })
  await loader.preloadContent()
  expect(PendingImage.created).toHaveLength(2)
})

it('treats an unavailable font face as a failed resource', async () => {
  catalog.images.splice(0)
  catalog.fonts.push('400 16px "Missing"')
  Object.defineProperty(document, 'fonts', { configurable: true, value: { load: vi.fn().mockResolvedValue([]) } })
  const loader = await import('./preloadImages')
  await loader.preloadContent()
  expect(loader.getContentStatus()).toMatchObject({ phase: 'error', failed: catalog.fonts })
})
