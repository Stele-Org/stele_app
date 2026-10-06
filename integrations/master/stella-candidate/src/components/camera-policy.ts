/**
 * Which camera the session opens. The stand accepts exactly one Logitech BRIO and nothing else.
 * `any-local` is for a developer's machine: `?camera=any` opens the browser's default camera, whatever it is,
 * and shows it upright. The switch exists in the dev server only: `import.meta.env.DEV` is false in a build,
 * so an address cannot talk the stand out of its camera.
 */
export type CameraPolicy = 'unique-brio-exact' | 'any-local'

export function readCameraPolicy(search: string, dev: boolean = import.meta.env.DEV): CameraPolicy {
  return dev && new URLSearchParams(search).get('camera') === 'any' ? 'any-local' : 'unique-brio-exact'
}
