import { TEST_BUILD } from '../app/test-build'

/**
 * Which camera the session opens. The stand accepts exactly one Logitech BRIO and nothing else.
 * `any-local` opens the browser's default camera, whatever it is, and shows it upright. It is for machines that
 * are not the stand: a developer's, with `?camera=any` in the dev server, and a tester's, always in a test build
 * (app/test-build.ts). The stand build is neither: `import.meta.env.DEV` is false there and it is not a test build,
 * so an address cannot talk the stand out of its camera.
 */
export type CameraPolicy = 'unique-brio-exact' | 'any-local'

export function readCameraPolicy(search: string, dev: boolean = import.meta.env.DEV, testBuild: boolean = TEST_BUILD): CameraPolicy {
  if (testBuild) return 'any-local'
  return dev && new URLSearchParams(search).get('camera') === 'any' ? 'any-local' : 'unique-brio-exact'
}
