import { expect, it } from 'vitest'
import phrases from '../../../voice/vasilisa/phrases.json'
import pending from '../../../voice/vasilisa/pending-audio.json'
import provenance from '../../../voice/vasilisa/studio-activation-provenance.json'
import timing from '../../../voice/vasilisa/discovery-timing-provenance.json'
import { DISCOVERY_NETWORK_SECONDS } from '../../components/discovery-network'
import publicManifest from '../../../public/voice/vasilisa/manifest.json'
import { getReadyNarrationAsset, isNarrationAudioPending } from './ready-narration-asset'
import type { VoiceManifest } from './narration'

const manifest: VoiceManifest = { version: 1, voice: 'Василиса', ready: true, assets: {
  'vk-onboarding': 'vk-onboarding.wav', 'vk-digitize': 'vk-digitize.wav', 'vk-camera': 'vk-camera.wav',
  'vk-particles': 'vk-particles.wav', 'vk-discovery-activation': 'vk-discovery-activation.wav', 'vk-final': 'vk-final.wav',
} }

it('suppresses all obsolete recordings despite ready manifest and cannot be bypassed by renaming a file', () => {
  // vk-final left the list on 05.10.2026: the user enabled the master recording Screen8 as it is.
  // vk-digitize left the list on 06.10.2026 the same way: the user enabled Screen5 as it is.
  expect(pending.cues.map(cue => cue.id)).toEqual(['vk-camera'])
  expect(getReadyNarrationAsset(publicManifest as VoiceManifest, 'vk-digitize')).toBe('vk-digitize-studio.wav')
  expect(getReadyNarrationAsset(publicManifest as VoiceManifest, 'vk-final')).toBe('vk-final-studio.wav')
  for (const { id } of pending.cues) {
    expect(isNarrationAudioPending(id)).toBe(true)
    expect(getReadyNarrationAsset(manifest, id)).toBeUndefined()
    expect(getReadyNarrationAsset({ ...manifest, assets: { [id]: 'unverified-new.wav' } }, id)).toBeUndefined()
  }
})

it('preserves ready unrelated recordings and still requires ready manifest, cue and asset', () => {
  expect(getReadyNarrationAsset(manifest, 'vk-onboarding')).toBe('vk-onboarding.wav')
  expect(isNarrationAudioPending('vk-onboarding')).toBe(false)
  expect(getReadyNarrationAsset(null, 'vk-onboarding')).toBeUndefined()
  expect(getReadyNarrationAsset({ ...manifest, ready: false }, 'vk-onboarding')).toBeUndefined()
  expect(getReadyNarrationAsset(manifest, null)).toBeUndefined()
  expect(getReadyNarrationAsset(manifest, 'missing')).toBeUndefined()
})

it('keeps intentional pauses outside spoken text and records the exact new scripts', () => {
  const activation = phrases.phrases.find(phrase => phrase.id === 'vk-discovery-activation')!
  const particles = phrases.phrases.find(phrase => phrase.id === 'vk-particles')!
  const digitize = phrases.phrases.find(phrase => phrase.id === 'vk-digitize')!
  const camera = phrases.phrases.find(phrase => phrase.id === 'vk-camera')!
  const final = phrases.phrases.find(phrase => phrase.id === 'vk-final')!
  expect(activation.text).toBe('Технологии Discovery активированы. Технологии персонализации Discovery уже начали собирать подборку.')
  expect(particles.text).toBe(activation.text)
  expect(digitize.text).toBe('Сделаем фото? На его основе превратим тебя в главного героя твоей персональной подборке. Нажми «Да, давайте», чтобы сфотографироваться. Или пропусти этот шаг.')
  expect(digitize.delivery?.segments[0]).toBe('Сделаем фото?')
  expect(camera.text).toBe('Смотри в камеру над экраном')
  expect(final.text).toBe('Готово. Discovery разобрал твои ответы и собрал твой профиль интересов: темы, героев, настроение и атмосферу. Пройди к левой панели VK Видео – там твоя подборка оживёт вокруг тебя.')
  // The pause is stretched to the Discovery scene: discovery-timing.test.ts.
  expect(activation.delivery).toMatchObject({ pauseDurationMs: timing.pauseBetweenSegmentsMs, leadSilenceMs: timing.leadSilenceMs })
  expect(particles.delivery).toEqual(activation.delivery)
  for (const phrase of [final, digitize]) {
    expect(phrase.delivery?.segments.join(' ')).toBe(phrase.text)
    expect(phrase.delivery?.pauseAfterSegments).toEqual([0])
    expect(phrase.delivery?.pauseDurationMs).toBeNull()
    expect(phrase.text).not.toContain('[пауза]')
  }
})

it.each(['vk-discovery-activation', 'vk-particles'])('reuses the supplied recording for %s and finishes its whole spoken text within the screen duration', cue => {
  const activation = phrases.phrases.find(phrase => phrase.id === cue)!
  expect(isNarrationAudioPending(activation.id)).toBe(false)
  expect(getReadyNarrationAsset(publicManifest as VoiceManifest, activation.id)).toBe(timing.asset)
  expect(timing.source).toEqual({ asset: provenance.asset, sha256: provenance.sha256 })
  expect(provenance.transcript).toBe(activation.text)
  expect(timing.segments.map(segment => segment.text)).toEqual(activation.delivery?.segments)
  expect(timing.durationSeconds).toBeLessThan(DISCOVERY_NETWORK_SECONDS)
})
