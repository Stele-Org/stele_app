// @vitest-environment jsdom
import { act, useEffect, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { vkCopy } from '../../content/vkVideo'
import type { Snapshot } from './slice-client.mjs'
import type { TagReveal } from '../prototype/tag-reveal'
vi.mock('./useMasterAudio', () => ({ useMasterAudio: vi.fn() }))

const mocks = vi.hoisted(() => ({ emit: null as null | ((state: Snapshot) => void), complete: vi.fn(), choosePhoto: vi.fn(), control: vi.fn(), dispose: vi.fn(), whiteMount: vi.fn(), whiteUnmount: vi.fn(), white: [] as { onComplete: () => void; playing: boolean; stage: string; silhouetteSrc?: string; generationDurationSeconds: number }[], visuals: [] as { reveal: TagReveal; onComplete: () => void; playing: boolean }[] }))
vi.mock('./slice-client.mjs', () => ({ createSliceClient: ({ onChange }: { onChange: (state: Snapshot) => void }) => {
  mocks.emit = onChange
  return { refresh: async () => {}, complete: mocks.complete, choosePhoto: mocks.choosePhoto, dispose: mocks.dispose, control: mocks.control, retry: vi.fn(), start: vi.fn() }
} }))
vi.mock('../../components/RingScene', () => ({ RingScene: ({ children }: { children: ReactNode }) => <div>{children}</div> }))
vi.mock('../../components/RingActions', () => ({ RingActions: ({ children }: { children: ReactNode }) => <div>{children}</div> }))
vi.mock('../../components/AnswerFlight', () => ({ AnswerFlight: (props: { reveal: TagReveal; onComplete: () => void; playing: boolean }) => { mocks.visuals.push(props); return <div>{props.reveal.label}</div> } }))
vi.mock('../../components/ContinuousQuestions', () => ({ ContinuousQuestions: ({ question, interactive }: { question: { prompt: string }; interactive: boolean }) => <div data-interactive={interactive}>{question.prompt}</div> }))
vi.mock('../../components/WhiteEntity', () => ({ WhiteEntity: (props: {onComplete:()=>void;playing:boolean;stage:string;generationDurationSeconds:number}) => { useEffect(() => { mocks.whiteMount(); return () => { mocks.whiteUnmount() } }, []); mocks.white.push(props);return <div data-white-stage={props.stage}/> } }))
vi.mock('../../service', () => ({ useServicePlaying: () => true, markServiceReady: async () => {} }))
import { MasterSlice } from './MasterSlice'
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ protocol: 'result-origin-v1', resultOrigin: 'https://result.example.test' }) }))
})

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); mocks.visuals.length = 0; mocks.white.length = 0; vi.clearAllMocks() })
it('bypasses photo UI for a non-hero through one advertised fenced skip, and keeps hero photo UI', () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  const host = document.createElement('div'), root = createRoot(host)
  act(() => root.render(<MasterSlice />))
  const choice = { online: true, fresh: true, busy: false, pending: null, canAct: true, station: { sessionId: 's' },
    session: { state: { protocol: 'stella-vk-v1', sessionId: 's', revision: 10, screen: 'photochoice', phase: 'active',
      answers: [{ answerId: 'series' }, { answerId: 'drive' }, { answerId: 'familiar' }] },
      view: { screen: 'photochoice', title: 'Сделаем фото?', options: [{ id: 'accept', label: 'Да, давайте' }, { id: 'skip', label: 'Пропустить' }] } } } as Snapshot
  try {
    act(() => mocks.emit!(choice))
    expect(host.textContent).not.toContain('Сделаем фото?')
    expect(mocks.choosePhoto).toHaveBeenCalledExactlyOnceWith({ sessionId: 's', revision: 10, screen: 'photochoice' }, 'skip')
    act(() => mocks.emit!(structuredClone(choice)))
    expect(mocks.choosePhoto).toHaveBeenCalledOnce()
    const hero = structuredClone(choice); hero.session!.state!.sessionId = 'hero-session'; hero.station!.sessionId = 'hero-session'
    hero.session!.state!.answers![2].answerId = 'hero'
    act(() => mocks.emit!(hero))
    expect(host.textContent).toContain('Сделаем фото?')
    expect(mocks.choosePhoto).toHaveBeenCalledOnce()
  } finally { act(() => root.unmount()) }
})
it('dismisses the final after 20 seconds without releasing the server station or replaying it on poll', () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance'] })
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  const host = document.createElement('div'), root = createRoot(host)
  act(() => root.render(<MasterSlice />))
  const final = { online: true, fresh: true, busy: false, pending: null, canAct: false, canStart: false, error: null, notice: '', storageError: null,
    canPause: false, canResume: false, canCancel: false, canRetry: false, station: { sessionId: 's' },
    session: { state: { protocol: 'stella-vk-v1', sessionId: 's', revision: 10, screen: 'final', phase: 'completed' },
      view: { screen: 'final', title: 'Old verbose copy', options: [] } } } as Snapshot
  try {
    act(() => mocks.emit!(final)); act(() => vi.advanceTimersByTime(12000))
    act(() => mocks.emit!(structuredClone(final))); act(() => vi.advanceTimersByTime(7999))
    expect(host.querySelector('.screen--vk-final')).not.toBeNull()
    act(() => vi.advanceTimersByTime(1)); expect(host.querySelector('[data-screen="home"]')).not.toBeNull()
    act(() => mocks.emit!(structuredClone(final))); expect(host.querySelector('.screen--vk-final')).toBeNull()
    expect(mocks.complete).not.toHaveBeenCalled(); expect(mocks.control).not.toHaveBeenCalled()
    expect(mocks.choosePhoto).not.toHaveBeenCalled()
  } finally { act(() => root.unmount()) }
})
it('finishes Discovery before showing an early server final and starts the final timer after visible completion', () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance'] })
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  const host = document.createElement('div'), root = createRoot(host)
  act(() => root.render(<MasterSlice />))
  const particles = { online: true, fresh: true, busy: false, pending: null, canAct: true, canStart: false, error: null, notice: '', storageError: null,
    canPause: true, canResume: false, canCancel: true, canRetry: false, station: { sessionId: 's' },
    session: { state: { protocol: 'stella-vk-v1', sessionId: 's', revision: 10, screen: 'particles', phase: 'active' },
      view: { screen: 'particles', title: 'Unwanted activation text', discoveryDurationMs: 3200, options: [] } } } as Snapshot
  try {
    act(() => mocks.emit!(particles))
    expect(mocks.white.at(-1)!.generationDurationSeconds).toBe(7)
    act(() => vi.advanceTimersByTime(3200))
    const final = structuredClone(particles); final.session!.state!.screen = 'final'; final.session!.state!.phase = 'completed'; final.canAct = false
    act(() => mocks.emit!(final))
    expect(host.querySelector('.screen--vk-final')).toBeNull()
    expect(host.querySelector('[data-white-stage="activation"]')).not.toBeNull()
    expect(host.textContent).not.toContain('Unwanted activation text')
    const finish = mocks.white.at(-1)!.onComplete
    act(() => vi.advanceTimersByTime(3800)); act(() => finish())
    expect(mocks.complete).not.toHaveBeenCalled()
    expect(host.querySelector('.screen--vk-final')).not.toBeNull()
    act(() => vi.advanceTimersByTime(19999)); expect(host.querySelector('.screen--vk-final')).not.toBeNull()
    act(() => vi.advanceTimersByTime(1)); expect(host.querySelector('[data-screen="home"]')).not.toBeNull()
  } finally { act(() => root.unmount()) }
})
it('real BrandSplash completes while 750ms server polling continues beyond its 1200ms duration', () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance'] })
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host)
  act(() => root.render(<MasterSlice />))
  const free = { online: true, fresh: true, busy: false, pending: null, error: null, notice: 'Ready', storageError: null,
    canStart: true, canAct: false, canPause: false, canResume: false, canCancel: false, canRetry: false,
    station: { sessionId: null }, session: null } satisfies Snapshot
  act(() => mocks.emit!(structuredClone(free)))
  expect(host.querySelector('.master-slice-status')).toBeNull()
  expect(host.querySelector('.master-visitor-status')).toBeNull()
  act(() => host.querySelector<HTMLButtonElement>('button[aria-label="VK Видео"]')!.click())
  expect(host.querySelector('.brand-splash')).not.toBeNull()
  for (let poll = 1; poll <= 4; poll++) {
    act(() => { vi.advanceTimersByTime(750); mocks.emit!(structuredClone(free)) })
    if (poll === 1) expect(host.querySelector('.brand-splash')).not.toBeNull()
    else {
      expect(host.querySelector('.brand-splash')).toBeNull()
      expect(host.querySelector('.screen--onboarding')).not.toBeNull()
    }
  }
  act(() => root.unmount()); host.remove()
})
it('polls and pause revisions preserve reveal identity; stale visual cannot ACK a new screen', () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host)
  act(() => root.render(<MasterSlice />))
  const base = { online: true, error: null, notice: '', storageError: null, canStart: false, canPause: true,
    canResume: false, canCancel: true, canRetry: false, fresh: true, busy: false, pending: null, canAct: true, station: { sessionId: 's' }, session: {
    state: { protocol: 'stella-vk-v1', sessionId: 's', screen: 'answer-reveal', phase: 'active', revision: 2, questionIndex: 0,
      answers: [{ questionId: 'q', answerId: 'science', label: 'Server answer', metadata: ['A','B'] }] },
    view: { screen: 'answer-reveal', title: 'Server answer', options: [] },
  } } as Snapshot
  act(() => mocks.emit!(structuredClone(base)))
  const first = mocks.visuals.at(-1)!
  const poll = structuredClone(base); poll.session!.state!.revision = 20
  act(() => mocks.emit!(poll))
  expect(mocks.visuals.at(-1)!.reveal).toBe(first.reveal)
  expect(mocks.visuals.at(-1)!.onComplete).toBe(first.onComplete)
  const paused = structuredClone(base);paused.session!.state!.phase = 'paused';paused.session!.state!.revision = 3
  act(() => mocks.emit!(paused))
  expect(mocks.visuals.at(-1)!.reveal).toBe(first.reveal);expect(mocks.visuals.at(-1)!.playing).toBe(false)
  const next = structuredClone(base);next.session!.state!.screen = 'question';next.session!.state!.questionIndex = 1;next.session!.state!.revision = 4
  next.session!.view = { screen: 'question', title: 'Next server question', questionId: 'q2', options: [{ id: 'next', label: 'Next' }] }
  act(() => mocks.emit!(next))
  act(() => first.onComplete())
  expect(mocks.complete).not.toHaveBeenCalled()
  expect(host.querySelector('[data-interactive="true"]')?.textContent).toBe('Next server question')
  act(() => root.unmount());host.remove();expect(mocks.dispose).toHaveBeenCalledOnce()
})

it('completed result survives release and next visitor returns home without mutating a session', () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host)
  act(()=>root.render(<MasterSlice />))
  const final={online:true,error:null,notice:'',storageError:null,canPause:false,canResume:false,canCancel:false,canRetry:false,fresh:true,busy:false,pending:null,canStart:true,canAct:false,station:{sessionId:null},session:{state:{protocol:'stella-vk-v1',sessionId:'old',phase:'completed',screen:'final',revision:10,
    contentPlan:{status:'accepted',packageId:'p',resultPath:'/vkshare/result/p'}},view:{screen:'final',title:'Server final',options:[]}}} as Snapshot
  act(()=>mocks.emit!(final));expect(host.querySelector('h1')?.textContent).toBe(vkCopy.finalDirection)
  const next=[...host.querySelectorAll('button')].find(b=>b.textContent==='Следующий посетитель')!
  act(()=>next.click());expect(host.querySelector('[data-screen="home"]')).not.toBeNull()
  act(()=>mocks.emit!(structuredClone(final)));expect(host.querySelector('[data-screen="home"]')).not.toBeNull()
  act(()=>root.unmount());host.remove()
})

it('uses the short approved final despite old server copy and preserves the dynamic package QR', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('ResizeObserver',class {observe(){} disconnect(){}})
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host)
  act(()=>root.render(<MasterSlice/>))
  const final={online:true,error:null,notice:'',storageError:null,canPause:false,canResume:false,canCancel:false,canRetry:false,fresh:true,busy:false,pending:null,canStart:false,canAct:false,station:{sessionId:'s'},session:{state:{protocol:'stella-vk-v1',sessionId:'s',phase:'completed',screen:'final',revision:10,
    contentPlan:{status:'accepted',packageId:'saved-package',resultPath:'/vkshare/result/saved-package'}},view:{screen:'final',title:'Old accepted heading',options:[],presentationCopy:{finalTitle:'Frozen final',finalDirection:'Frozen direction'}}}} as Snapshot
  await act(async()=>mocks.emit!(final));expect(host.querySelector('h1')?.textContent).toBe(vkCopy.finalDirection)
  expect(host.querySelector('.vk-final-direction')).toBeNull()
  expect(host.textContent).not.toContain('Frozen final')
  expect(host.querySelector('.master-result-qr svg')).not.toBeNull()
  expect(host.querySelector('.master-result-qr')?.getAttribute('href')).toContain('/vkshare/result/saved-package')
  const legacy=structuredClone(final);delete legacy.session!.view!.presentationCopy
  act(()=>mocks.emit!(legacy));expect(host.querySelector('h1')?.textContent).toBe(vkCopy.finalDirection)
  const foreign=structuredClone(final);foreign.session!.state!.contentPlan!.resultPath='/vkshare/result/other'
  act(()=>mocks.emit!(foreign));expect(host.querySelector('.master-result-qr')).toBeNull()
  act(()=>root.unmount());host.remove()
})



it('WhiteEntity remains one current presentation across polling and stops owning ACK after a foreign station session', () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('ResizeObserver',class {observe(){} disconnect(){}})
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host)
  act(()=>root.render(<MasterSlice/>))
  const particles={online:true,error:null,notice:'',storageError:null,canStart:false,canPause:true,canResume:false,canCancel:true,canRetry:false,
    fresh:true,busy:false,pending:null,canAct:true,station:{sessionId:'s'},session:{state:{protocol:'stella-vk-v1',sessionId:'s',phase:'active',screen:'particles',revision:10},view:{screen:'particles',title:'Processing',options:[]}}} as Snapshot
  act(()=>mocks.emit!(particles));const first=mocks.white.at(-1)!
  expect(first.stage).toBe('activation');expect(first.silhouetteSrc).toBeUndefined()
  expect(first.generationDurationSeconds).toBe(7)
  expect(host.textContent).not.toContain('Processing')
  const modern=structuredClone(particles);modern.session!.view!.discoveryVisual='activation';modern.session!.view!.discoveryDurationMs=7000
  act(()=>mocks.emit!(modern));expect(mocks.white.at(-1)!.stage).toBe('activation')
  const polled=structuredClone(particles);polled.session!.state!.revision++
  act(()=>mocks.emit!(polled));expect(mocks.white.at(-1)!.onComplete).toBe(first.onComplete)
  const foreign=structuredClone(polled);foreign.station!.sessionId='max';foreign.canAct=false
  act(()=>mocks.emit!(foreign));expect(host.querySelector('[data-white-stage]')).toBeNull()
  act(()=>first.onComplete());expect(mocks.complete).not.toHaveBeenCalled()
  act(()=>root.unmount());host.remove()
})

function motionSnapshot(screen = 'answer-reveal'): Snapshot {
  return { online: true, error: null, notice: '', storageError: null, canStart: false, canPause: true,
    canResume: false, canCancel: true, canRetry: false, fresh: true, busy: false, pending: null, canAct: true,
    station: { sessionId: 'motion-s' }, session: {
      state: { protocol: 'stella-vk-v1', sessionId: 'motion-s', screen, phase: 'active', revision: 2, questionIndex: 0,
        answers: [{ questionId: 'q', answerId: 'science', label: 'Server answer', metadata: ['A', 'B'] }] },
      view: { screen, title: 'Server answer', options: [] },
    } }
}
function mountMotion() {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host)
  act(() => root.render(<MasterSlice />))
  return () => { act(() => root.unmount()); host.remove() }
}

it('keeps an accepted flight moving through submit and ACK-refresh, queues completion until authority returns once', () => {
  const cleanup = mountMotion(), accepted = motionSnapshot()
  act(() => mocks.emit!(accepted)); const first = mocks.visuals.at(-1)!
  const pending = structuredClone(accepted)
  Object.assign(pending, { fresh: false, busy: true, canAct: false, pending: { payload: { kind: 'answer' } } })
  act(() => mocks.emit!(pending))
  expect(mocks.visuals.at(-1)!.playing).toBe(true)
  expect(mocks.visuals.at(-1)!.reveal).toBe(first.reveal)
  act(() => { first.onComplete(); first.onComplete() })
  expect(mocks.complete).not.toHaveBeenCalled()
  const settling = { ...pending, busy: false, pending: null }
  act(() => mocks.emit!(settling))
  expect(mocks.visuals.at(-1)!.playing).toBe(true)
  expect(mocks.complete).not.toHaveBeenCalled()
  const fresh = structuredClone(accepted); fresh.session!.state!.revision = 5
  act(() => mocks.emit!(fresh))
  expect(mocks.complete).toHaveBeenCalledExactlyOnceWith({ sessionId: 'motion-s', revision: 5, screen: 'answer-reveal' })
  act(() => { first.onComplete(); mocks.emit!(structuredClone(fresh)) })
  expect(mocks.complete).toHaveBeenCalledOnce()
  cleanup()
})

it.each(['pause', 'cancel'])('holds explicit %s through ACK-refresh and never sends completion offline or after ownership loss', kind => {
  const cleanup = mountMotion(), accepted = motionSnapshot()
  act(() => mocks.emit!(accepted)); const first = mocks.visuals.at(-1)!
  const pending = { ...accepted, fresh: false, busy: true, canAct: false, pending: { payload: { kind } } }
  act(() => mocks.emit!(pending)); expect(mocks.visuals.at(-1)!.playing).toBe(false)
  act(() => first.onComplete()); expect(mocks.complete).not.toHaveBeenCalled()
  act(() => mocks.emit!({ ...pending, busy: false, pending: null }))
  expect(mocks.visuals.at(-1)!.playing).toBe(false)
  act(() => mocks.emit!({ ...pending, busy: false, online: false, error: 'Offline' }))
  expect(mocks.visuals.at(-1)!.playing).toBe(false)
  expect(mocks.complete).not.toHaveBeenCalled()
  const foreign = { ...accepted, station: { sessionId: 'someone-else' }, canAct: false }
  act(() => mocks.emit!(foreign)); act(() => first.onComplete())
  expect(mocks.complete).not.toHaveBeenCalled()
  cleanup()
})

it('keeps one Discovery mount from scan through particles, resets the cue, ignores late scan completion', () => {
  const cleanup = mountMotion(), scan = motionSnapshot('scanning')
  act(() => mocks.emit!(scan)); const old = mocks.white.at(-1)!
  expect(mocks.whiteMount).toHaveBeenCalledOnce()
  act(() => old.onComplete()); expect(mocks.complete).toHaveBeenCalledOnce()
  const next = motionSnapshot('particles'); next.session!.state!.revision = 3
  act(() => mocks.emit!(next))
  expect(mocks.whiteMount).toHaveBeenCalledOnce(); expect(mocks.whiteUnmount).not.toHaveBeenCalled()
  expect(mocks.white.at(-1)!.stage).toBe('activation')
  act(() => old.onComplete()); expect(mocks.complete).toHaveBeenCalledOnce()
  act(() => { mocks.white.at(-1)!.onComplete(); mocks.white.at(-1)!.onComplete() })
  expect(mocks.complete).toHaveBeenCalledTimes(2)
  expect(mocks.complete).toHaveBeenLastCalledWith({ sessionId: 'motion-s', revision: 3, screen: 'particles' })
  cleanup(); expect(mocks.whiteUnmount).toHaveBeenCalledOnce()
})
