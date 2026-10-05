import { contentFonts, contentImages } from './content-assets'

interface Resource { image?: HTMLImageElement; ready: boolean }
interface ContentStatus {
  phase: 'idle' | 'loading' | 'ready' | 'error'
  completed: number
  total: number
  failed: string[]
}

// Page-lifetime ownership, independent of React screens and StrictMode mounts.
// Browsers still control decoded/GPU cache eviction under memory pressure.
const resources = new Map<string, Resource>()
const listeners = new Set<() => void>()
let status: ContentStatus = { phase: 'idle', completed: 0, total: contentImages.length + contentFonts.length, failed: [] }
let pending: Promise<void> | undefined
export const getContentStatus = () => status
export const subscribeContent = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
function publish(next: ContentStatus) {
  status = next
  listeners.forEach(listener => listener())
}

function prepare(key: string, kind: 'image' | 'font'): Promise<void> {
  const resource: Resource = { ready: false }
  resources.set(key, resource)
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (error?: unknown) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (error) {
        if (resource.image) resource.image.src = ''
        resources.delete(key)
        reject(error)
      } else {
        resource.ready = true
        resolve()
      }
    }
    const timer = setTimeout(() => finish(new Error('Resource timeout (20s)')), 20_000)
    try {
      if (kind === 'image') {
        const image = new Image()
        resource.image = image
        image.decoding = 'async'
        image.src = key
        void image.decode().then(() => finish(), finish)
      } else {
        void document.fonts.load(key, 'Выбери бренд VK Видео MAX').then(faces => {
          if (!faces.length) finish(new Error('Font face missing'))
          else finish()
        }, finish)
      }
    } catch (error) { finish(error) }
  })
}

export function preloadContent(): Promise<void> {
  if (pending) return pending
  if (status.phase === 'ready') return Promise.resolve()
  const tasks = [
    ...contentImages.map(key => ({ key, kind: 'image' as const })),
    ...contentFonts.map(key => ({ key, kind: 'font' as const })),
  ].filter(task => !resources.get(task.key)?.ready)
  const failed: string[] = []
  let completed = status.total - tasks.length
  let cursor = 0
  // Defer work so StrictMode callers share pending before notifications.
  pending = Promise.resolve().then(async () => {
    publish({ ...status, phase: 'loading', completed, failed: [] })
    async function worker() {
      while (cursor < tasks.length) {
        const task = tasks[cursor++]
        try { await prepare(task.key, task.kind) }
        catch {
          failed.push(task.key)
        }
        completed++
        publish({ ...status, completed, failed: [...failed] })
      }
    }
    await Promise.all(Array.from({ length: Math.min(4, tasks.length) }, worker))
    publish({ ...status, phase: failed.length ? 'error' : 'ready', failed })
  }).finally(() => { pending = undefined })
  return pending
}
