/**
 * The microphone is off unless the page is opened with `?mic=1`; `?mic=debug` also prints what was heard to the console.
 * It is asked for by the address, like the greeting (greeting.ts), and by nothing else: speech is recognised by the
 * browser, and Chrome and Edge send the sound to their own servers for that.
 */
export type MicrophoneMode = 'off' | 'on' | 'debug'

export function readMicrophone(search: string): MicrophoneMode {
  const value = new URLSearchParams(search).get('mic')
  return value === '1' ? 'on' : value === 'debug' ? 'debug' : 'off'
}
