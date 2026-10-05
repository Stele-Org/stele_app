import { expect, it } from 'vitest'
import phrases from '../../../voice/vasilisa/phrases.json'
import pending from '../../../voice/vasilisa/pending-audio.json'
import provenance from '../../../voice/vasilisa/studio-activation-provenance.json'
import publicManifest from '../../../public/voice/vasilisa/manifest.json'
import { getReadyNarrationAsset, isNarrationAudioPending } from './ready-narration-asset'
import type { VoiceManifest } from './narration'

const manifest: VoiceManifest = { version: 1, voice: 'Василиса', ready: true, assets: {
  'vk-onboarding': 'vk-onboarding.wav', 'vk-digitize': 'vk-digitize.wav', 'vk-camera': 'vk-camera.wav',
  'vk-particles': 'vk-particles.wav', 'vk-discovery-activation': 'vk-discovery-activation.wav', 'vk-final': 'vk-final.wav',
} }

it('suppresses all obsolete recordings despite ready manifest and cannot be bypassed by renaming a file', () => {
  expect(pending.cues.map(cue => cue.id)).toEqual(['vk-digitize', 'vk-camera', 'vk-final'])
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
  expect(activation.delivery?.pauseDurationMs).toBe(400)
  expect(particles.delivery?.pauseDurationMs).toBe(400)
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
  expect(getReadyNarrationAsset(publicManifest as VoiceManifest, activation.id)).toBe(provenance.asset)
  expect(provenance.transcript).toBe(activation.text)
  expect(provenance.insertedSilenceMs).toBe(activation.delivery?.pauseDurationMs)
  expect(provenance.durationSeconds).toBeLessThan(7)
})
