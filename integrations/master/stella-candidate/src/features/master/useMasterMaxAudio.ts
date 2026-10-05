import { useMasterAudio, type MasterAudioOptions } from './useMasterAudio'

/** MAX shares ordered effects and central clocks; VK spoken Screen cues do not
 * belong to MAX. Matching MAX central narration is a separate asset contract. */
export function useMasterMaxAudio(options: MasterAudioOptions) {
  useMasterAudio({ ...options, branch: 'max', narrationEnabled: false })
}
