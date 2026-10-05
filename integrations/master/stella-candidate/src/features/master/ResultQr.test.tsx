// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { ResultQr } from './ResultQr'
afterEach(() => { vi.unstubAllGlobals() })
it('uses trusted LAN result origin and preserves exact package path', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ protocol: 'result-origin-v1', resultOrigin: 'http://10.0.0.92:9577' }) })
  vi.stubGlobal('fetch', fetcher)
  const host=document.createElement('div'),root=createRoot(host)
  try {
    await act(async()=>root.render(<ResultQr packageId="pkg-1" resultPath="/vkshare/result/pkg-1" apiBase="/master-api"/>))
    expect(host.querySelector('a')?.href).toBe('http://10.0.0.92:9577/vkshare/result/pkg-1')
    expect(host.querySelector('svg')).not.toBeNull()
    expect(fetcher.mock.calls[0][0]).toBe('/stella/result-config.json')
  } finally { act(()=>root.unmount()) }
})
it('does not display unusable localhost QR if origin is absent or malformed', async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true)
  for(const resultOrigin of [null,'http://evil/path','javascript:alert(1)']) {
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({protocol:'result-origin-v1',resultOrigin})}))
    const host=document.createElement('div'),root=createRoot(host)
    try { await act(async()=>root.render(<ResultQr packageId="pkg-1" resultPath="/vkshare/result/pkg-1"/>));expect(host.querySelector('a')).toBeNull();expect(host.textContent).toContain('недоступен') }
    finally {act(()=>root.unmount())}
  }
})
it('removes a previous package QR immediately while a new package configuration is pending', async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true)
  const fetcher=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({protocol:'result-origin-v1',resultOrigin:'https://result.example.test'})})
    .mockImplementationOnce(()=>new Promise(()=>{}))
  vi.stubGlobal('fetch',fetcher)
  const host=document.createElement('div'),root=createRoot(host)
  try {
    await act(async()=>root.render(<ResultQr packageId="first" resultPath="/vkshare/result/first"/>))
    expect(host.querySelector('a')?.href).toContain('/first')
    act(()=>root.render(<ResultQr packageId="second" resultPath="/vkshare/result/second"/>))
    expect(host.querySelector('a')).toBeNull()
    expect(host.textContent).toContain('Подготавливаем QR')
  } finally {act(()=>root.unmount())}
})
