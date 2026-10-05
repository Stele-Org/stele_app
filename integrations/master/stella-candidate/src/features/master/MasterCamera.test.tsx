// @vitest-environment jsdom
import {act, type ReactNode, type RefObject} from 'react'
import {createRoot} from 'react-dom/client'
import {afterEach,expect,it,vi} from 'vitest'
const capture=vi.hoisted(()=>({frame:vi.fn(),base64:vi.fn()}))
vi.mock('./camera-capture',()=>({capturePhoto:capture.frame,photoBase64:capture.base64}))
vi.mock('../../components/CameraSession',()=>({CameraSessionProvider:({children}:{children:ReactNode})=>children}))
vi.mock('../../components/camera-session-context',()=>({useCameraSession:()=>({status:'ready'})}))
vi.mock('../../components/CameraPreview',()=>({CameraPreview:({captureRef}:{captureRef:RefObject<HTMLVideoElement|null>})=><video ref={captureRef}/>}))
import {MasterCamera} from './MasterCamera'
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();capture.frame.mockReset();capture.base64.mockReset()})
it('requires explicit M/F and consent; unknown result retries same capture instead of sampling again',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true)
 capture.frame.mockResolvedValue(new Blob(['jpeg'],{type:'image/jpeg'}));capture.base64.mockResolvedValue('/9j/')
 const upload=vi.fn().mockRejectedValue(Error('Unknown upload'))
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host)
 try{
  await act(async()=>root.render(<MasterCamera fence={{sessionId:'s',revision:4,screen:'camera'}} enabled upload={upload} skip={()=>{}}/>))
  expect(host.querySelector('h1')?.textContent).toBe('Смотри в камеру над экраном')
  expect(host.querySelector('.master-camera-terms-body')?.textContent).toContain('7. Другие условия')
  expect(host.querySelector('.master-camera-terms-body')?.textContent).toContain('Редакция от 05.10.2026.')
  const button=()=>[...host.querySelectorAll('button')].find(b=>b.textContent?.includes('фото')||b.textContent?.includes('этого снимка'))!
  expect(button().disabled).toBe(true)
  act(()=>host.querySelector<HTMLInputElement>('input[type=radio]')!.click());expect(button().disabled).toBe(true)
  act(()=>host.querySelector<HTMLInputElement>('input[type=checkbox]')!.click());expect(button().disabled).toBe(false)
  await act(async()=>{button().click();button().click()})
  expect(capture.frame).toHaveBeenCalledOnce();expect(upload).toHaveBeenCalledOnce()
  expect(upload.mock.calls[0][1].appearance).toBe('male');expect(upload.mock.calls[0][1].consent).toEqual({accepted:true,version:'poster-v1'})
  await act(async()=>button().click())
  expect(capture.frame).toHaveBeenCalledOnce();expect(upload).toHaveBeenCalledTimes(2)
  expect(upload.mock.calls[1]).toEqual(upload.mock.calls[0])
 }finally{act(()=>root.unmount());host.remove()}
})
it('unmount during delayed capture does not upload',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true)
 let resolve!:(value:Blob)=>void;capture.frame.mockImplementation(()=>new Promise<Blob>(done=>resolve=done));capture.base64.mockResolvedValue('/9j/')
 const upload=vi.fn(),host=document.createElement('div');document.body.append(host);const root=createRoot(host)
 await act(async()=>root.render(<MasterCamera fence={{sessionId:'s',revision:4,screen:'camera'}} enabled upload={upload} skip={()=>{}}/>))
 act(()=>{host.querySelector<HTMLInputElement>('input[type=radio]')!.click();host.querySelector<HTMLInputElement>('input[type=checkbox]')!.click()})
 act(()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Сделать фото')!.click())
 act(()=>root.unmount());await act(async()=>resolve(new Blob(['jpeg'])));expect(upload).not.toHaveBeenCalled();host.remove()
})
