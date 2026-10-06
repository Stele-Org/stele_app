// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { capturePhoto } from './camera-capture'
afterEach(() => vi.restoreAllMocks())
function video() {
  return {srcObject:{getVideoTracks:()=>[{readyState:'live',enabled:true,muted:false}]},readyState:2,videoWidth:1920,videoHeight:1080} as unknown as HTMLVideoElement
}
it('uses actual frame dimensions, JPEG and bounded canvas; releases canvas memory', async () => {
  const canvas={width:0,height:0,getContext:()=>({drawImage:vi.fn(),translate:vi.fn(),rotate:vi.fn()}),toBlob:vi.fn((callback:BlobCallback,mime:string)=>callback(new Blob(['jpeg'],{type:mime})))}
  vi.spyOn(document,'createElement').mockReturnValue(canvas as unknown as HTMLCanvasElement)
  const blob=await capturePhoto(video(),new AbortController().signal)
  expect(blob.type).toBe('image/jpeg');expect(blob.size).toBe(4)
  expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function),'image/jpeg',.85)
  expect(canvas.width).toBe(0);expect(canvas.height).toBe(0)
})
it('rejects unavailable frame or oversized encoding without returning a fake capture',async()=>{
  await expect(capturePhoto({...video(),videoWidth:0} as HTMLVideoElement,new AbortController().signal)).rejects.toThrow('Кадр')
  const canvas={width:0,height:0,getContext:()=>({drawImage:vi.fn(),translate:vi.fn(),rotate:vi.fn()}),toBlob:(callback:BlobCallback)=>callback(new Blob([new Uint8Array(1024*1024)],{type:'image/jpeg'}))}
  vi.spyOn(document,'createElement').mockReturnValue(canvas as unknown as HTMLCanvasElement)
  await expect(capturePhoto(video(),new AbortController().signal)).rejects.toThrow('размер')
  expect(canvas.width).toBe(0)
})
it('does not export a delayed capture after disposal',async()=>{
  let callback:BlobCallback=()=>{};const controller=new AbortController()
  const canvas={width:0,height:0,getContext:()=>({drawImage:vi.fn(),translate:vi.fn(),rotate:vi.fn()}),toBlob:(fn:BlobCallback)=>callback=fn}
  vi.spyOn(document,'createElement').mockReturnValue(canvas as unknown as HTMLCanvasElement)
  const capture=capturePhoto(video(),controller.signal);controller.abort();callback(new Blob(['jpeg'],{type:'image/jpeg'}))
  await expect(capture).rejects.toThrow();expect(canvas.width).toBe(0)
})

it('encodes a 90 degree clockwise portrait frame before JPEG encoding', async () => {
  const context = { drawImage: vi.fn(), translate: vi.fn(), rotate: vi.fn() }
  let encodedSize: number[] = []
  const canvas = { width: 0, height: 0, getContext: () => context, toBlob: (callback: BlobCallback) => {
    encodedSize = [canvas.width, canvas.height]
    callback(new Blob(['jpeg'], { type: 'image/jpeg' }))
  } }
  vi.spyOn(document, 'createElement').mockReturnValue(canvas as unknown as HTMLCanvasElement)
  const source = video()
  await capturePhoto(source, new AbortController().signal)
  expect(encodedSize).toEqual([540, 960])
  expect(context.translate).toHaveBeenCalledExactlyOnceWith(540, 0)
  expect(context.rotate).toHaveBeenCalledExactlyOnceWith(Math.PI / 2)
  expect(context.drawImage).toHaveBeenCalledExactlyOnceWith(source, 0, 0, 960, 540)
  expect(context.translate.mock.invocationCallOrder[0]).toBeLessThan(context.rotate.mock.invocationCallOrder[0])
  expect(context.rotate.mock.invocationCallOrder[0]).toBeLessThan(context.drawImage.mock.invocationCallOrder[0])
  expect([canvas.width, canvas.height]).toEqual([0, 0])
})

it('encodes the frame of an upright camera as it comes, without the turn', async () => {
  const context = { drawImage: vi.fn(), translate: vi.fn(), rotate: vi.fn() }
  let encodedSize: number[] = []
  const canvas = { width: 0, height: 0, getContext: () => context, toBlob: (callback: BlobCallback) => {
    encodedSize = [canvas.width, canvas.height]
    callback(new Blob(['jpeg'], { type: 'image/jpeg' }))
  } }
  vi.spyOn(document, 'createElement').mockReturnValue(canvas as unknown as HTMLCanvasElement)
  const source = video()
  await capturePhoto(source, new AbortController().signal, true)
  expect(encodedSize).toEqual([960, 540])
  expect(context.translate).not.toHaveBeenCalled()
  expect(context.rotate).not.toHaveBeenCalled()
  expect(context.drawImage).toHaveBeenCalledExactlyOnceWith(source, 0, 0, 960, 540)
})
