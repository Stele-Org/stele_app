/** Browser Canvas2D owns frame sampling/encoding; no face inference or uploads. */
export async function capturePhoto(video: HTMLVideoElement, signal: AbortSignal): Promise<Blob> {
  signal.throwIfAborted()
  const stream = video.srcObject as MediaStream | null
  if (!stream?.getVideoTracks().some(track => track.readyState === 'live' && track.enabled && !track.muted)
    || video.readyState < 2 || !video.videoWidth || !video.videoHeight) throw Error('Кадр камеры ещё не готов')
  const canvas = document.createElement('canvas')
  const scale = Math.min(1, 960 / Math.max(video.videoWidth, video.videoHeight))
  const frameWidth = Math.max(1, Math.round(video.videoWidth * scale))
  const frameHeight = Math.max(1, Math.round(video.videoHeight * scale))
  canvas.width = frameHeight
  canvas.height = frameWidth
  try {
    const context = canvas.getContext('2d')
    if (!context) throw Error('Не удалось подготовить снимок')
    // Stand camera is mounted sideways: encode the same 90° clockwise orientation as its preview.
    context.translate(canvas.width, 0)
    context.rotate(Math.PI / 2)
    context.drawImage(video, 0, 0, frameWidth, frameHeight)
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(Error('Ошибка снимка')), 'image/jpeg', .85))
    signal.throwIfAborted()
    if (blob.type !== 'image/jpeg' || !blob.size || blob.size >= 1024 * 1024) throw Error('Снимок превышает допустимый размер')
    return blob
  } finally { canvas.width = canvas.height = 0 }
}

export async function photoBase64(blob: Blob, signal: AbortSignal): Promise<string> {
  signal.throwIfAborted()
  const bytes = new Uint8Array(await blob.arrayBuffer())
  signal.throwIfAborted()
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
  return btoa(binary)
}
