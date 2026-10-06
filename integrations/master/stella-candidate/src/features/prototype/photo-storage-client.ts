import { cameraDiagnostic, cameraError } from '../../components/camera-diagnostics'

export interface ApprovedPhoto { blob: Blob; captureId: string; upright: boolean }

/**
 * The photo the visitor approved goes to the local storage of the dev server (`dev-server/photo-storage.ts`,
 * the `PhotoStorage` directory of the project). A build has no such route and never asks for it.
 * Storing does not hold the scenario: the result is only reported in the camera diagnostics of the console.
 */
export async function storeApprovedPhoto({ blob, captureId, upright }: ApprovedPhoto): Promise<void> {
  if (!import.meta.env.DEV) return
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}photo-storage`, {
      method: 'POST',
      headers: { 'Content-Type': 'image/jpeg', 'X-Capture-Id': captureId, 'X-Camera-Upright': upright ? '1' : '0' },
      body: blob,
    })
    const receipt = await response.json().catch(() => null) as { file?: string; error?: string } | null
    cameraDiagnostic(response.ok ? 'photo-storage.saved' : 'photo-storage.rejected', { status: response.status, file: receipt?.file, error: receipt?.error })
  } catch (error) {
    cameraDiagnostic('photo-storage.error', cameraError(error))
  }
}
