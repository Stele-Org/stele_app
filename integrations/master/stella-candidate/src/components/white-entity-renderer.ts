import { Controller } from 'lumicells-project/core/controller/controller'
import { Engine } from 'lumicells-project/core/engine/engine'
import { subscribeTicker } from 'lumicells/core/ticker'
import { whiteEntityArt, whiteEntityConfig, whiteEntityPitch } from './white-entity-config'
import { createWhiteEntityEnvelope, type WhiteEntityEnvelopeState, type WhiteEntityStage } from './white-entity-envelope'

export interface WhiteEntityRenderer {
  setPlaying(playing: boolean): void
  setEnvelope(stage: WhiteEntityStage, reveal: number, erase: number): void
  resize(width: number, height: number): void
  dispose(): void
}

interface RendererOptions {
  onReady(): void
  onError(error: Error): void
}

/** Standalone host for the project's existing per-cell LumiCells/CUBES renderer.
 * The native field owns noise, cell sizes and their motion. A cell-sized atlas
 * multiplies presence and supplies the white-circle morph without replacing noise.
 */
export function createWhiteEntityRenderer(canvas: HTMLCanvasElement, options: RendererOptions): WhiteEntityRenderer {
  const controller = new Controller({ config: whiteEntityConfig, random: () => 0.5 })
  let engine: Engine
  try {
    engine = new Engine(canvas, {
      opaque: true,
      paramsPrelude: controller.layout.glslPrelude,
      paramsVec4Count: controller.layout.vec4Count,
      cubeGeometry: true,
      cubeMask: true,
      scenarioParameters: false,
      cubeMinPitch: 1,
    })
  } catch (error) {
    controller.destroy()
    throw error
  }
  const gl = canvas.getContext('webgl2')!
  const morphAtlas = gl.createTexture()
  if (!morphAtlas) {
    engine.dispose()
    controller.destroy()
    throw new Error('[Discovery] Cannot allocate the LumiCells morph atlas')
  }
  let envelope: ReturnType<typeof createWhiteEntityEnvelope>
  try {
    envelope = createWhiteEntityEnvelope()
  } catch (error) {
    gl.deleteTexture(morphAtlas)
    engine.dispose()
    controller.destroy()
    throw error
  }
  // Native field uses R only as an envelope multiplier; G=1 keeps its white
  // circle morph. A cell can reach zero size without clipping a rendered disc.
  gl.activeTexture(gl.TEXTURE0 + 12)
  gl.bindTexture(gl.TEXTURE_2D, morphAtlas)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 255, 255, 255]))
  controller.nativeResolution = true
  controller.nativeGridFractionalPitch = true
  controller.nativeGridAlignX = true
  controller.nativeGridAlignY = true
  controller.setMaxDrawableSize(engine.caps.maxDrawableSize)

  const output = {
    framebuffer: null,
    x: 0, y: 0, width: 1, height: 1,
    interaction: {
      enabled: false,
      cubeArt: whiteEntityArt,
      maskPair: [0, 0, 0, 0],
      externalMask: {
        texture: morphAtlas,
        size: [1, 1], physicalRect: [0, 0, 1, 1], colorRect: [0, 0, 1, 1], offset: [0, 0],
        morph: true, proceduralEnvelope: true, pitch: whiteEntityPitch,
      },
    },
  }
  let playing = false
  let disposed = false
  let failed = false
  let ready = false
  let dirty = true
  let previousTime: number | null = null
  let warmupStarted: number | null = null
  let unsubscribe: (() => void) | null = null
  let envelopeState: WhiteEntityEnvelopeState = { stage: 'scan', reveal: 0, erase: 0 }
  let envelopeDirty = true
  let envelopeGeometry = ''

  function stopTicking() {
    unsubscribe?.()
    unsubscribe = null
    previousTime = null
  }

  function fail(error: unknown) {
    if (disposed || failed) return
    failed = true
    stopTicking()
    options.onError(error instanceof Error ? error : new Error(String(error)))
  }

  function updateSubscription() {
    if (disposed || failed) return
    if (playing || !ready || dirty) {
      unsubscribe ??= subscribeTicker({ render })
    } else stopTicking()
  }

  function render(now: number) {
    if (disposed || failed) return
    try {
      if (engine.isContextLost()) throw new Error('[Discovery] LumiCells WebGL context was lost')
      if (engine.error) throw engine.error
      // Shader warmup and paused redraws do not advance the animation clock.
      const delta = playing && ready && previousTime !== null ? Math.max(0, (now - previousTime) / 1000) : 0
      previousTime = now
      const frame = controller.update(delta)
      if (canvas.width !== frame.canvasWidth) canvas.width = frame.canvasWidth
      if (canvas.height !== frame.canvasHeight) canvas.height = frame.canvasHeight
      output.width = frame.canvasWidth
      output.height = frame.canvasHeight
      output.interaction.externalMask.pitch = frame.pitchPx
      const geometryKey = `${frame.canvasWidth}:${frame.canvasHeight}:${frame.pitchPx}`
      if (envelopeDirty || geometryKey !== envelopeGeometry) {
        const atlas = envelope.render(frame.canvasWidth, frame.canvasHeight, frame.pitchPx, envelopeState)
        const external = output.interaction.externalMask
        gl.activeTexture(gl.TEXTURE0 + 12)
        gl.bindTexture(gl.TEXTURE_2D, morphAtlas)
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
        if (atlas.width !== external.size[0] || atlas.height !== external.size[1]) {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, atlas.width, atlas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, atlas.pixels)
        } else {
          gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, atlas.width, atlas.height, gl.RGBA, gl.UNSIGNED_BYTE, atlas.pixels)
        }
        external.size = [atlas.width, atlas.height]
        external.physicalRect = [0, 0, atlas.width, atlas.height]
        external.colorRect = [0, 0, atlas.width, atlas.height]
        envelopeDirty = false
        envelopeGeometry = geometryKey
      }
      if (!engine.render(frame, output)) {
        if (engine.error) throw engine.error
        warmupStarted ??= now
        if (now - warmupStarted > 15000) throw new Error('[Discovery] LumiCells shader warmup timed out')
        return
      }
      controller.commitFrame()
      dirty = false
      if (!ready) {
        ready = true
        options.onReady()
      }
      updateSubscription()
    } catch (error) {
      fail(error)
    }
  }

  const onContextLost = (event: Event) => {
    event.preventDefault()
    fail(new Error('[Discovery] LumiCells WebGL context was lost'))
  }
  canvas.addEventListener('webglcontextlost', onContextLost)

  const api: WhiteEntityRenderer = {
    setPlaying(value) {
      if (playing === value) return
      playing = value
      previousTime = null
      updateSubscription()
    },
    setEnvelope(stage, reveal, erase) {
      if (disposed || failed) return
      const clamp = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
      const next = { stage, reveal: clamp(reveal), erase: clamp(erase) }
      if (next.stage === envelopeState.stage && next.reveal === envelopeState.reveal && next.erase === envelopeState.erase) return
      envelopeState = next
      envelopeDirty = true
      dirty = true
      updateSubscription()
    },
    resize(width, height) {
      if (disposed || failed || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return
      // Preserve the logical lattice at every preview scale, with a bounded
      // standalone texture budget (1080x1920 at the authored Stella aspect).
      const scale = Math.min(1, Math.sqrt((1080 * 1920) / (width * height)))
      const w = Math.max(1, Math.round(width * scale))
      const h = Math.max(1, Math.round(height * scale))
      if (controller.frame.canvasWidth === w && controller.frame.canvasHeight === h && !dirty) return
      controller.nativeGridPitch = whiteEntityPitch * w / 1080
      controller.setViewport({ hostCssW: w, hostCssH: h, dpr: 1, deviceW: w, deviceH: h })
      dirty = true
      updateSubscription()
    },
    dispose() {
      if (disposed) return
      disposed = true
      stopTicking()
      canvas.removeEventListener('webglcontextlost', onContextLost)
      if (!gl.isContextLost()) gl.deleteTexture(morphAtlas)
      envelope.dispose()
      engine.dispose()
      controller.destroy()
    },
  }
  return api
}
