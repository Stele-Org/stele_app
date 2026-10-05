/** Authored composition only. Native Canvas2D rasterizes these contours;
 * LumiCells continues to generate the independent sizes and their motion. */
export type WhiteEntityStage = 'scan' | 'generation' | 'activation'

export interface WhiteEntityEnvelopeState {
  stage: WhiteEntityStage
  reveal: number
  erase: number
}

export const whiteEntityContours: Record<WhiteEntityStage, string> = {
  scan: 'M540 330 C440 330 405 405 415 490 C415 565 447 620 466 642 C460 686 406 692 351 723 C266 759 202 824 200 916 C198 1000 224 1120 258 1190 C279 1232 315 1222 343 1190 L369 1080 C381 1150 369 1260 392 1320 L714 1320 C743 1237 726 1137 741 1068 L771 1190 C797 1230 840 1238 865 1187 C900 1112 924 988 920 905 C916 814 856 751 772 721 C716 695 654 686 640 642 C679 593 699 540 695 483 C690 387 639 330 540 330 Z',
  generation: 'M550 370 C435 357 359 439 380 567 C396 668 436 733 384 805 C331 877 230 870 144 951 C57 1032 48 1139 126 1227 C214 1326 265 1327 281 1464 C298 1640 353 1765 495 1784 C652 1800 805 1755 838 1606 C867 1474 812 1410 930 1351 C1015 1308 1041 1224 1009 1143 C975 1058 893 1010 805 972 C712 932 683 859 713 753 C747 633 748 510 690 431 C654 386 601 369 550 370 Z',
  // Neutral particle cloud for visitors without a photo: no head/body contour.
  activation: 'M540 390 C308 390 120 699 120 1080 C120 1461 308 1770 540 1770 C772 1770 960 1461 960 1080 C960 699 772 390 540 390 Z',
}

export const whiteEntityCenters: Record<WhiteEntityStage, readonly [number, number]> = {
  scan: [540, 800], generation: [540, 1080], activation: [540, 1080],
}
export const whiteEntityFeather = 180
const supersample = 4
const clampProgress = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0

export function createWhiteEntityEnvelope() {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('[Discovery] Canvas2D envelope is unavailable')
  const paths = {
    scan: new Path2D(whiteEntityContours.scan),
    generation: new Path2D(whiteEntityContours.generation),
    activation: new Path2D(whiteEntityContours.activation),
  }

  return {
    /** Result is a bottom-up cell atlas: R=presence, G=white-circle morph.
     * CPU reads only this small Canvas2D mask, never a WebGL drawing buffer. */
    render(width: number, height: number, pitch: number, state: WhiteEntityEnvelopeState) {
      if (![width, height, pitch].every(value => Number.isFinite(value) && value > 0)) {
        throw new Error('[Discovery] Invalid envelope dimensions')
      }
      const columns = Math.ceil(width / pitch)
      const rows = Math.ceil(height / pitch)
      const rasterWidth = columns * supersample
      const rasterHeight = rows * supersample
      if (canvas.width !== rasterWidth) canvas.width = rasterWidth
      if (canvas.height !== rasterHeight) canvas.height = rasterHeight
      context.resetTransform()
      context.globalCompositeOperation = 'source-over'
      context.clearRect(0, 0, rasterWidth, rasterHeight)
      // Match the native atlas' bottom-origin addressing even when the final
      // partial row is not a whole pitch. All contours use the 1080x1920 design.
      context.setTransform(
        supersample * width / (pitch * 1080), 0,
        0, supersample * height / (pitch * 1920),
        0, supersample * (rows - height / pitch),
      )
      context.fillStyle = '#fff'
      context.fill(paths[state.stage])
      const reveal = clampProgress(state.reveal)
      const erase = clampProgress(state.erase)
      if (reveal === 0 || erase === 1) {
        context.resetTransform()
        context.clearRect(0, 0, rasterWidth, rasterHeight)
      } else {
        const [cx, cy] = whiteEntityCenters[state.stage]
        const feather = whiteEntityFeather
        const maximumRadius = Math.hypot(540, Math.max(cy, 1920 - cy))
        const applyFront = (progress: number, operation: GlobalCompositeOperation) => {
          const radius = progress * (maximumRadius + feather)
          const gradient = context.createRadialGradient(cx, cy, Math.max(0, radius - feather), cx, cy, radius)
          gradient.addColorStop(0, '#fff')
          gradient.addColorStop(1, 'rgba(255,255,255,0)')
          context.globalCompositeOperation = operation
          context.fillStyle = gradient
          context.fillRect(0, 0, 1080, 1920)
        }
        if (reveal < 1) applyFront(reveal, 'destination-in')
        if (erase > 0) applyFront(erase, 'destination-out')
      }
      context.globalCompositeOperation = 'source-over'
      const source = context.getImageData(0, 0, rasterWidth, rasterHeight).data
      const pixels = new Uint8Array(columns * rows * 4)
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < columns; x++) {
          let coverage = 0
          for (let sy = 0; sy < supersample; sy++) {
            for (let sx = 0; sx < supersample; sx++) {
              coverage += source[((y * supersample + sy) * rasterWidth + x * supersample + sx) * 4 + 3]
            }
          }
          const offset = ((rows - 1 - y) * columns + x) * 4
          pixels[offset] = Math.round(coverage / (supersample * supersample))
          pixels[offset + 1] = 255
          pixels[offset + 2] = 255
          pixels[offset + 3] = 255
        }
      }
      return { width: columns, height: rows, pixels }
    },
    dispose() { canvas.width = 1; canvas.height = 1 },
  }
}
