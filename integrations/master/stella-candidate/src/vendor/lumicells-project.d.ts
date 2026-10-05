// Typed adapter boundary for the project's modified vendor. Vite loads the actual
// source branch; its unrelated internal TS diagnostics are not Stella app types.
// Base API stays the pinned upstream contract; only used native extensions appear here.
declare module 'lumicells-project/core/controller/controller' {
  import { Controller as UpstreamController } from 'lumicells/core/controller/controller'
  export class Controller extends UpstreamController {
    nativeResolution: boolean
    nativeGridFractionalPitch: boolean
    nativeGridPitch: number
    nativeGridAlignX: boolean
    nativeGridAlignY: boolean
  }
}
declare module 'lumicells-project/core/engine/engine' {
  import { Engine as UpstreamEngine } from 'lumicells/core/engine/engine'
  import type { EngineOptions, FrameInputs } from 'lumicells/core/engine/types'
  export class Engine extends UpstreamEngine {
    constructor(canvas: HTMLCanvasElement, options: EngineOptions & {
      cubeGeometry: boolean
      cubeMask: boolean
      scenarioParameters: boolean
      cubeMinPitch: number
    })
    render(frame: FrameInputs, output?: {
      framebuffer: WebGLFramebuffer | null
      x: number; y: number; width: number; height: number
      interaction: {
        enabled: boolean
        cubeArt: Float32Array
        maskPair: number[]
        externalMask: {
          texture: WebGLTexture
          size: number[]; physicalRect: number[]; colorRect: number[]; offset: number[]
          morph: boolean; pitch: number; proceduralEnvelope?: boolean
        }
      }
    }): boolean
  }
}
