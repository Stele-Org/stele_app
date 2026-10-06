import type { ScreenState } from '../prototype/Prototype'

/** The visitor starts the home conversation: the start screen speaks only when the greeting is asked for
 * (`?greeting=1`, see greeting.ts). The brand splash and the tag reveals stay silent. */
export function narrationId(screen: ScreenState, brandSplash = false, greeting = false): string | null {
  if (brandSplash) return null
  switch (screen.type) {
    case 'home': return greeting ? 'home' : null
    case 'max-answer-reveal':
    case 'vk-answer-reveal':
    case 'vk-photo-reveal': return null
    case 'vk-question': return ['vk-question-evening', 'vk-question-ideal-content', 'vk-question-discovery'][screen.index] ?? null
    case 'max-result': return `max-result-${screen.mission}`
    default: return screen.type
  }
}

export interface VoiceManifest {
  version: 1
  voice: 'Василиса'
  ready: boolean
  assets: Record<string, string>
}

/** A generated local asset is required; never substitute a browser/system voice. */
export function parseVoiceManifest(value: unknown): VoiceManifest | null {
  if (!value || typeof value !== 'object') return null
  const manifest = value as Partial<VoiceManifest>
  if (manifest.version !== 1 || manifest.voice !== 'Василиса' || typeof manifest.ready !== 'boolean'
    || !manifest.assets || typeof manifest.assets !== 'object' || Array.isArray(manifest.assets)) return null
  const assets: Record<string, string> = {}
  for (const [id, file] of Object.entries(manifest.assets)) {
    if (typeof file !== 'string' || !/^[a-zA-Z0-9_-]+\.(mp3|wav|ogg|webm)$/.test(file)) continue
    assets[id] = file
  }
  return { version: 1, voice: 'Василиса', ready: manifest.ready, assets }
}
