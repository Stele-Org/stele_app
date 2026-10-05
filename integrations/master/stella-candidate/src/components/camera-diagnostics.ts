/** Bounded lifecycle telemetry only: never serializes streams, images or raw device IDs. */
const tokens = new Map<string, string>()
let emitted = 0
const LIMIT = 1200
function token(value: string): string | undefined {
  if (!value) return undefined
  if (!tokens.has(value) && tokens.size < 256) tokens.set(value, `local-${tokens.size + 1}`)
  return tokens.get(value) ?? 'overflow'
}
export function cameraError(error: unknown) {
  const value = error as { name?: string; message?: string; constraint?: string } | null
  let message = String(value?.message ?? error ?? '')
  for (const id of tokens.keys()) message = message.split(id).join('[device]')
  return { name: String(value?.name ?? 'Error').slice(0, 80), message: message.slice(0, 300), constraint: String(value?.constraint ?? '').slice(0, 80) }
}
export function cameraDiagnostic(event: string, details: Record<string, unknown> = {}) {
  try {
    if (emitted >= LIMIT) return
    emitted += 1
    console.info('[stella-camera]', JSON.stringify({ ...details, event: emitted === LIMIT ? 'diagnostic.limit' : event, at: new Date().toISOString() }))
  } catch { /* Diagnostics must never interrupt capture. */ }
}
export async function cameraDevices(reason: string) {
  if (!navigator.mediaDevices?.enumerateDevices) { cameraDiagnostic('devices.unavailable', { reason }); return }
  cameraDiagnostic('devices.request', { reason })
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    cameraDiagnostic('devices.result', { reason, count: devices.length, devices: devices.slice(0, 32).map(device => ({ kind: device.kind, label: device.label.slice(0, 120), device: token(device.deviceId), group: token(device.groupId) })) })
  } catch (error) { cameraDiagnostic('devices.error', { reason, ...cameraError(error) }) }
}
export function cameraTrack(track: MediaStreamTrack) {
  const settings = track.getSettings?.() ?? {}
  return { label: track.label, kind: track.kind, readyState: track.readyState, enabled: track.enabled, muted: track.muted, width: settings.width, height: settings.height, frameRate: settings.frameRate, facingMode: settings.facingMode }
}
export function cameraVideo(video: HTMLVideoElement) {
  return { readyState: video.readyState, networkState: video.networkState, width: video.videoWidth, height: video.videoHeight, paused: video.paused, currentTime: video.currentTime, errorCode: video.error?.code }
}
