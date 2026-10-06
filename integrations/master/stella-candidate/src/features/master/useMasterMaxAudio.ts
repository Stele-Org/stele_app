import { useMasterAudio, type MasterAudioOptions } from './useMasterAudio'

/** MAX shares ordered effects and central clocks; VK spoken Screen cues do not
 * belong to MAX. Matching MAX central narration is a separate asset contract.
 * The one exception is the start screen: it is common to both products, so it greets
 * with Screen0 also when the MAX slice is the one that shows it. */
export function useMasterMaxAudio(options: MasterAudioOptions) {
  useMasterAudio({ ...options, branch: 'max', narrationEnabled: options.screen === 'home' })
}
