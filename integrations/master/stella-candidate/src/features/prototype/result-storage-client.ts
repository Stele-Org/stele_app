import type { VkResult } from './vk-result'

/**
 * The result of a finished test goes to the local storage of the dev server (`dev-server/result-storage.ts`,
 * the `ResultStorage` directory of the project). A build has no such route and never asks for it.
 * Storing does not hold the scenario: what came of it is only reported in the console, in `[stella-result]` lines.
 */
export async function storeResult(result: VkResult): Promise<void> {
  if (!import.meta.env.DEV) return
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}result-storage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(result),
    })
    const receipt = await response.json().catch(() => null) as { file?: string; error?: string } | null
    console.info('[stella-result]', response.ok ? 'saved' : 'rejected', { status: response.status, file: receipt?.file, error: receipt?.error })
  } catch (error) {
    console.info('[stella-result]', 'error', { message: error instanceof Error ? error.message : String(error) })
  }
}
