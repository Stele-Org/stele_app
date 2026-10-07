// @vitest-environment jsdom
import { act, StrictMode, type ComponentProps, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { Prototype } from './Prototype'
import type { TagReveal } from './tag-reveal'
import { eventName, type StelaEvent } from './events'
import type { WhiteEntity as WhiteEntityComponent } from '../../components/WhiteEntity'
import type { VkResult } from './vk-result'
import { SCAN_SHOT_MS } from './scan-photo'
import { CameraSessionContext } from '../../components/camera-session-context'

// Real scenario, publisher, input gate, React and Motion. No GPU or external service.
vi.mock('../voice/use-screen-narration', () => ({ useScreenNarration: () => {} }))
vi.mock('../sound/use-stella-sound', () => ({ useStellaSound: () => {} }))
vi.mock('../../components/RingScene', () => ({ RingScene: ({ children }: { children: ReactNode }) => <div data-mock-ring-scene>{children}</div> }))
vi.mock('../../components/WhiteEntity', () => ({ WhiteEntity: ({ stage = 'scan', silhouetteSrc, onComplete }: ComponentProps<typeof WhiteEntityComponent>) => <>
  {stage === 'scan' && silhouetteSrc && <img className="vk-processing-art" src={silhouetteSrc} alt="" aria-hidden="true" />}
  <canvas className="vk-white-entity" data-stage={stage} />
  <button data-discovery-complete onClick={onComplete}>Complete visible Discovery sequence</button>
</> }))
const playback = vi.hoisted(() => ({ playing: true }))
vi.mock('../../service', () => ({ markServiceReady: async () => {}, useServicePlaying: () => playback.playing }))
const bridge = vi.hoisted(() => ({ current: null as null | {
  reveal: TagReveal; embedded?: boolean; flightDurationScale: number;
  onFinalExit?: (reveal: TagReveal) => void; onComplete: (reveal: TagReveal) => void;
} }))
vi.mock('../../components/AnswerFlight', () => ({ AnswerFlight: (props: NonNullable<typeof bridge.current>) => { bridge.current = props; return null } }))
// Only the scan photographs, and only with a ready camera: one test gives it one.
const capture = vi.hoisted(() => ({ photo: vi.fn<() => Promise<Blob>>() }))
vi.mock('../master/camera-capture', () => ({ capturePhoto: capture.photo }))
let root: Root, host: HTMLDivElement, style: HTMLStyleElement
let events: StelaEvent[]
/** The results of finished tests the page sent to the storage of the dev server. */
let results: VkResult[]
const receive = (event: Event) => events.push((event as CustomEvent<StelaEvent>).detail)
const wait = (ms = 110) => act(async () => { await new Promise(resolve => setTimeout(resolve, ms)) })
const state = () => host.querySelector('main')?.getAttribute('data-screen')
const buttons = () => host.querySelectorAll<HTMLButtonElement>('[data-option-id]')
async function click(selector: string) {
  const button = host.querySelector<HTMLButtonElement>(selector)!
  expect(button, selector).not.toBeNull(); expect(button.disabled, selector).toBe(false)
  act(() => button.click()); await wait()
}
const choose = (id: string) => click(`[data-option-id="${id}"]`)
async function start(product: string) { await click(`[aria-label="${product}"]`); await wait(); await click('.onboarding-start'); await wait() }
async function finishReveal(expectedCards: number, expectedState: string) {
  const flight = bridge.current!
  expect(flight.flightDurationScale).toBe(1.25)
  if (flight.embedded) {
    const selected = buttons()[0]
    expect(buttons()).toHaveLength(1)
    act(() => flight.onFinalExit!(flight.reveal)); await wait()
    expect(selected.isConnected).toBe(false)
    expect(buttons()).toHaveLength(0)
  }
  act(() => flight.onComplete(flight.reveal)); await wait()
  expect(state()).toBe(expectedState)
  expect(buttons()).toHaveLength(expectedCards)
}
async function vkThird(answer: string) {
  await start('VK Видео')
  await choose('series'); await finishReveal(4, 'vk-question')
  await choose('heroes'); await finishReveal(4, 'vk-question')
  await choose(answer)
}
function useScenarioClock() {
  // Move an already scheduled browser timeout onto the fake clock through host pause.
  playback.playing = false
  act(() => root.render(<StrictMode><Prototype /></StrictMode>))
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
  playback.playing = true
  act(() => root.render(<StrictMode><Prototype /></StrictMode>))
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('BroadcastChannel', undefined)
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })))
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  events = []; bridge.current = null
  results = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (String(url).endsWith('/result-storage') && init?.method === 'POST') results.push(JSON.parse(String(init.body)) as VkResult)
    return new Response(JSON.stringify({ file: 'stored.json' }), { status: 201 })
  }))
  playback.playing = true
  window.addEventListener(eventName, receive)
  style = document.createElement('style'); style.textContent = '.prototype-viewport { padding: 0px; }'; document.head.append(style)
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  act(() => root.render(<StrictMode><Prototype /></StrictMode>))
})
afterEach(() => {
  act(() => root.unmount()); host.remove(); style.remove()
  window.removeEventListener(eventName, receive); vi.restoreAllMocks(); vi.unstubAllGlobals()
  vi.useRealTimers()
})

it.each([['personal', 'access'], ['business', 'visibility']])('MAX %s/%s retains brand, exits both answers and reaches result', async (audience, goal) => {
  await start('MAX')
  expect(buttons()).toHaveLength(2)
  expect(host.querySelector('.continuous-vk')?.classList.contains('experience--max')).toBe(true)
  expect(buttons()[0].classList.contains('ring-tag--violet')).toBe(true)
  expect(buttons()[1].classList.contains('ring-tag--cyan')).toBe(true)
  await choose(audience); await finishReveal(3, 'max-goal')
  await click('[aria-label="Назад"]'); expect(buttons()).toHaveLength(2)
  await choose(audience); await finishReveal(3, 'max-goal')
  await choose(goal); await finishReveal(0, 'max-result')
  expect(events.filter(event => event.type === 'answer')).toHaveLength(3)
  expect(events.filter(event => event.type === 'answer-cleared')).toHaveLength(1)
  await click('.result-reset'); expect(state()).toBe('home')
})

it.each(['familiar', 'new', 'popular'])('VK %s bypasses photo and completes the silhouette-free Discovery sequence before final', async (answer) => {
  await vkThird(answer)
  // The third answer was the last choice: the result is stored at once, the same as the recommendation event says.
  const recommended = events.find(event => event.type === 'vk-recommendation')!
  expect(results).toHaveLength(1)
  expect(results[0]).toMatchObject({ schemaVersion: 1, type: 'stella-vk-result', product: 'vk-video', sessionId: recommended.sessionId,
    createdAt: recommended.occurredAt, discovery: { answerId: answer }, photo: { status: 'not-requested' } })
  expect(results[0].answers.map(item => item.answerId)).toEqual(['series', 'heroes', answer])
  expect(results[0].tags).toHaveLength(12)
  expect(recommended.type === 'vk-recommendation' && results[0].themes.map(item => item.theme)).toEqual(recommended.type === 'vk-recommendation' && recommended.rankedThemes)
  // Six covers: two for each of the three themes the recommendation selected, and no AI cover.
  expect(recommended.type === 'vk-recommendation' && results[0].covers).toEqual(recommended.type === 'vk-recommendation' && recommended.selectedThemes.map(theme => ({ theme, count: 2 })))
  expect(results[0].aiCover).toEqual([])
  expect(results[0].coversTotal).toBe(6)
  await finishReveal(0, 'vk-discovery-activation')
  expect(host.querySelector('[data-option-id="accept"]')).toBeNull()
  expect(host.querySelector('.vk-white-entity')?.getAttribute('data-stage')).toBe('activation')
  expect(host.querySelector('.vk-processing-art')).toBeNull()
  expect(host.textContent).not.toContain('Технологии Discovery активированы.')
  expect(host.textContent).not.toContain('Технологии персонализации Discovery уже начали собирать подборку.')
  expect(host.querySelector('#vk-result-title')).toBeNull()
  await click('[data-discovery-complete]')
  expect(state()).toBe('vk-final')
  expect(events.filter(event => event.type === 'answer')).toHaveLength(3)
  const recommendations = events.filter(event => event.type === 'vk-recommendation')
  expect(recommendations).toHaveLength(1)
  expect(recommendations[0]).toMatchObject({ discoveryAnswerId: answer, photoMode: 'not-requested' })
  expect(events.some(event => event.type === 'answer' && event.questionId === 'photo')).toBe(false)
  expect(host.querySelector('#vk-result-title')?.textContent).toBe('Пройди к экрану\nVK Видео – там твоя подборка\nоживёт вокруг тебя')
  expect(host.querySelector('.vk-final-direction')).toBeNull()
  expect(host.querySelector('.vk-final-qr img')?.getAttribute('src')).toContain('vk-new-qr')
  expect(host.querySelector('.result-thanks')).toBeNull()
}, 10000)

it('photo terms restore input/focus; accept goes to camera without a tag scene, then silhouette, photo check, particles and result', async () => {
  await vkThird('hero'); await finishReveal(2, 'vk-digitize')
  expect(buttons()[0].classList.contains('ring-tag--red')).toBe(true)
  await click('.digitize-notice')
  const consentDialog = host.querySelector('[role="dialog"]')
  expect(consentDialog).not.toBeNull()
  expect(consentDialog?.querySelector('#terms-title')?.textContent).toBe('СОГЛАСИЕ НА ОБРАБОТКУ ПЕРСОНАЛЬНЫХ ДАННЫХ')
  expect(consentDialog?.querySelectorAll('.terms-document section')).toHaveLength(7)
  expect(consentDialog?.textContent).toContain('«Единое Видео» (ОГРН 1247700591588, ИНН 9714058115')
  expect(consentDialog?.textContent).not.toContain('передача между компаниями')
  expect(consentDialog?.textContent).toContain('После завершения сценария фотография и созданная обложка автоматически удаляются и не хранятся.')
  expect(consentDialog?.textContent).toContain('Если я откажусь, Инсталляция продолжит работу без фотографии.')
  expect(consentDialog?.textContent).toContain('Редакция от 05.10.2026.')
  expect(consentDialog?.textContent).not.toContain('здесь будут')
  expect(consentDialog?.textContent).not.toContain('Демонстрационный макет')
  expect(buttons()[0].disabled).toBe(true)
  await click('[aria-label="Закрыть"]')
  expect(host.querySelector('[role="dialog"]')).toBeNull()
  expect(document.activeElement).toBe(host.querySelector('.digitize-notice'))
  bridge.current = null
  await choose('accept')
  expect(host.querySelector('.question-heading')?.hasAttribute('hidden')).toBe(true)
  expect(host.querySelector('.digitize-description')).toBeNull()
  // «Начать» shows no tags: the camera prompt follows the same 650 ms cue as «Пропустить».
  expect(state()).toBe('vk-photo-reveal')
  await wait(650)
  expect(bridge.current).toBeNull()
  expect(state()).toBe('vk-camera')
  expect(buttons()).toHaveLength(0)
  // Its tags are still reported with the answer.
  expect(events.find(event => event.type === 'answer' && event.questionId === 'photo'))
    .toMatchObject({ answerId: 'accept', metadata: ['ракурс', 'освещение', 'композиция', 'обработка'] })
  expect(host.querySelector('[aria-label="Мужской"]')).toBeNull()
  expect(host.querySelector('.vk-camera-button')).not.toBeNull()
  await wait(1850); expect(state()).toBe('vk-scanning')
  expect(host.querySelector('.vk-processing-art')?.getAttribute('src')).toContain('vk-new-silhouette')
  const entity = host.querySelector('.vk-white-entity')
  expect(entity).not.toBeNull()
  expect(entity?.getAttribute('data-stage')).toBe('scan')
  expect(entity?.parentElement?.classList.contains('prototype-canvas')).toBe(true)
  expect(entity?.closest('[data-mock-ring-scene]')).toBeNull()
  expect(host.textContent).not.toContain('Технологии Discovery активированы.')
  // No camera here: the check of the photo shows a black square, and «Продолжить» goes on to Discovery.
  await click('[data-discovery-complete]'); expect(state()).toBe('vk-photo-review')
  expect(host.querySelector('.vk-white-entity')).toBeNull()
  expect(host.querySelector('.photo-review-image--empty')).not.toBeNull()
  // The hero's result waits for the photo: «Продолжить» is the last choice, and here there is no photo to name.
  expect(results).toEqual([])
  await click('.photo-review-actions .primary-button'); expect(state()).toBe('vk-particles')
  expect(results).toHaveLength(1)
  expect(results[0]).toMatchObject({ sessionId: events[0].sessionId, discovery: { answerId: 'hero' }, photo: { status: 'unavailable' } })
  expect(results[0].answers.map(item => item.answerId)).toEqual(['series', 'heroes', 'hero', 'accept'])
  expect(results[0].tags).toHaveLength(16)
  // Without a photo there is no AI cover: plain recommendations, two covers for each of three themes.
  expect(results[0].aiCover).toEqual([])
  expect(results[0].covers.map(item => item.count)).toEqual([2, 2, 2])
  expect(results[0].coversTotal).toBe(6)
  expect(host.querySelector('.vk-white-entity')?.getAttribute('data-stage')).toBe('generation')
  expect(host.querySelector('.vk-white-entity')?.parentElement?.classList.contains('prototype-canvas')).toBe(true)
  expect(host.querySelector('.vk-processing-art')).toBeNull()
  expect(host.textContent).not.toContain('Технологии Discovery активированы.')
  await click('[data-discovery-complete]'); expect(state()).toBe('vk-final')
  expect(host.querySelector('.vk-white-entity')).toBeNull()
  expect(host.textContent).not.toContain('Технологии Discovery активированы.')
  expect(events.filter(event => event.type === 'vk-recommendation')).toHaveLength(1)
  expect(events.some(event => event.type === 'answer' && event.questionId === 'gender')).toBe(false)
}, 15000)

it('names the approved photo in the result of the hero and stores the photo under the same id', async () => {
  capture.photo.mockImplementation(async () => new Blob(['jpeg'], { type: 'image/jpeg' }))
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  URL.createObjectURL = vi.fn(() => 'blob:photo'); URL.revokeObjectURL = vi.fn()
  const stream = { getTracks: () => [], getVideoTracks: () => [] } as unknown as MediaStream
  act(() => root.render(<StrictMode><CameraSessionContext.Provider value={{ stream, status: 'ready', upright: true }}><Prototype /></CameraSessionContext.Provider></StrictMode>))
  await vkThird('hero'); await finishReveal(2, 'vk-digitize')
  await choose('accept'); await wait(650)
  await click('.vk-camera-button'); expect(state()).toBe('vk-scanning')
  await wait(SCAN_SHOT_MS + 100)
  await click('[data-discovery-complete]'); expect(state()).toBe('vk-photo-review')
  expect(host.querySelector('img.photo-review-image')?.getAttribute('src')).toBe('blob:photo')
  expect(results).toEqual([])
  await click('.photo-review-actions .primary-button'); expect(state()).toBe('vk-particles')
  expect(results).toHaveLength(1)
  const { photo } = results[0]
  // An approved photo: two AI covers by genres and two covers for each of two themes.
  expect(results[0].aiCover.map(item => item.count)).toEqual([1, 1])
  expect(results[0].covers.map(item => item.count)).toEqual([2, 2])
  expect(results[0].coversTotal).toBe(6)
  expect(photo).toEqual({ status: 'accepted', captureId: expect.stringMatching(/^[0-9a-f-]{36}$/) })
  const stored = vi.mocked(fetch).mock.calls.find(([url]) => String(url).endsWith('/photo-storage'))!
  expect((stored[1]!.headers as Record<string, string>)['X-Capture-Id']).toBe(photo.status === 'accepted' && photo.captureId)
}, 15000)

it('stores one result with the last answers when the visitor goes back and answers again', async () => {
  await start('VK Видео')
  // First question answered, then changed from the second question.
  await choose('series'); await finishReveal(4, 'vk-question')
  await click('[aria-label="Назад"]')
  expect(host.querySelector('.continuous-question')?.getAttribute('data-question-id')).toBe('evening')
  await choose('science'); await finishReveal(4, 'vk-question')
  // Second question answered, then changed from the third question.
  await choose('drive'); await finishReveal(4, 'vk-question')
  await click('[aria-label="Назад"]')
  expect(host.querySelector('.continuous-question')?.getAttribute('data-question-id')).toBe('ideal-content')
  // Nothing is stored while an answer can still be changed.
  expect(results).toEqual([])
  expect(events.filter(event => event.type === 'vk-recommendation')).toEqual([])
  await choose('rest'); await finishReveal(4, 'vk-question')
  await choose('new')
  // One result, built from the last answers only: «Документалку» and «Расслабляющий», not «Сериал» and «Драйвовый».
  expect(results).toHaveLength(1)
  expect(results[0].answers.map(item => item.answerId)).toEqual(['science', 'rest', 'new'])
  expect(Object.fromEntries(results[0].themes.filter(item => item.score > 0).map(item => [item.theme, item.score])))
    .toEqual({ 'Наука': 2, 'Музыка': 2, 'Спорт': 1, 'Медиа и шоу': 1 })
  expect(results[0].tags).toEqual(['наука', 'знания', 'документальное кино', 'научпоп', 'музыка', 'медиа', 'отдых', 'лёгкий контент', 'новинки', 'лайки', 'интересы', 'темы'])
  expect(results[0].covers.every(item => ['Наука', 'Музыка', 'Спорт', 'Медиа и шоу'].includes(item.theme))).toBe(true)
  // The events tell the same story: two answers taken back, one recommendation.
  expect(events.filter(event => event.type === 'answer-cleared').map(event => event.type === 'answer-cleared' && event.questionId)).toEqual(['evening', 'ideal-content'])
  const recommended = events.filter(event => event.type === 'vk-recommendation')
  expect(recommended).toHaveLength(1)
  expect(recommended[0].type === 'vk-recommendation' && recommended[0].rankedThemes).toEqual(results[0].themes.map(item => item.theme))
  // And nothing more is sent on the way to the last screen.
  await finishReveal(0, 'vk-discovery-activation')
  await click('[data-discovery-complete]'); expect(state()).toBe('vk-final')
  expect(results).toHaveLength(1)
}, 15000)

it('stores the hero\'s result once, after a repeated photo, with the answers given last', async () => {
  await start('VK Видео')
  await choose('standup'); await finishReveal(4, 'vk-question')
  await choose('learn'); await finishReveal(4, 'vk-question')
  await click('[aria-label="Назад"]')
  await choose('heroes'); await finishReveal(4, 'vk-question')
  await choose('hero'); await finishReveal(2, 'vk-digitize')
  await choose('accept'); await wait(650)
  // «Повторить» on the check of the photo goes round the camera again and stores nothing.
  await click('.vk-camera-button'); await click('[data-discovery-complete]'); expect(state()).toBe('vk-photo-review')
  await click('.photo-review-actions .secondary-button'); expect(state()).toBe('vk-camera')
  expect(results).toEqual([])
  await click('.vk-camera-button'); await click('[data-discovery-complete]'); expect(state()).toBe('vk-photo-review')
  await click('.photo-review-actions .primary-button'); expect(state()).toBe('vk-particles')
  expect(results).toHaveLength(1)
  expect(results[0].answers.map(item => item.answerId)).toEqual(['standup', 'heroes', 'hero', 'accept'])
  expect(results[0].photo).toEqual({ status: 'unavailable' })
}, 15000)

it('offers no way back from the photo step, only its two answers', async () => {
  await vkThird('hero'); await finishReveal(2, 'vk-digitize')
  expect(host.querySelector('[aria-label="Назад"]')).toBeNull()
  expect([...buttons()].map(button => button.dataset.optionId)).toEqual(['accept', 'skip'])
  expect(events.some(event => event.type === 'answer-cleared' && event.questionId === 'discovery')).toBe(false)
}, 10000)

it('switches hero grid to photo without retaining the enlarged old heading or static hero image', async () => {
  await vkThird('hero')
  expect(host.querySelector('[data-option-id="hero"] video')).not.toBeNull()
  expect(host.querySelector('[data-option-id="hero"] .reference-card-artwork')).toBeNull()
  const flight = bridge.current!
  act(() => flight.onFinalExit!(flight.reveal)); await wait()
  act(() => flight.onComplete(flight.reveal))
  expect(state()).toBe('vk-digitize')
  expect(host.querySelectorAll('.question-heading h1')).toHaveLength(1)
  expect(host.querySelector('.question-heading h1')?.textContent).toBe('Ты – главный герой VK Видео')
  // The photo step: no description line and no way back, only «Начать» and «Пропустить».
  expect(host.querySelector('.digitize-description')).toBeNull()
  expect(host.querySelector('.back-button')).toBeNull()
  expect([...buttons()].map(button => button.textContent)).toEqual(['Начать', 'Пропустить'])
  expect(host.querySelector('.digitize-notice')?.textContent).toBe('Отвечая «Начать», вы принимаете условия использования персональных данных.')
  // The consent line is plain text: it casts no tint or shadow into the cell field, unlike the buttons.
  expect(host.querySelector('.digitize-notice')?.hasAttribute('data-lc-influence')).toBe(false)
  expect(buttons()[0].getAttribute('data-lc-influence')).toBe('shadow')
  expect(host.querySelector('#continuous-question-discovery')).toBeNull()
  act(() => flight.onComplete(flight.reveal))
  expect(state()).toBe('vk-digitize')
}, 10000)

it('hero photo skip bypasses capture and activates Discovery without claiming a photo', async () => {
  await vkThird('hero'); await finishReveal(2, 'vk-digitize')
  await choose('skip')
  // «Пропустить» was the last choice.
  expect(results).toHaveLength(1)
  expect(results[0]).toMatchObject({ discovery: { answerId: 'hero' }, photo: { status: 'skipped' } })
  expect(results[0].answers.map(item => item.answerId)).toEqual(['series', 'heroes', 'hero', 'skip'])
  expect(results[0].aiCover).toEqual([])
  expect(results[0].covers.map(item => item.count)).toEqual([2, 2, 2])
  await wait(650)
  expect(state()).toBe('vk-discovery-activation')
  expect(host.querySelector('.vk-white-entity')?.getAttribute('data-stage')).toBe('activation')
  expect(host.querySelector('.vk-processing-art')).toBeNull()
  expect(host.querySelector('.vk-camera-button')).toBeNull()
  expect(host.textContent).not.toContain('Технологии Discovery активированы.')
  expect(host.textContent).not.toContain('Технологии персонализации Discovery уже начали собирать подборку.')
  expect(host.querySelector('#vk-result-title')).toBeNull()
  expect(events.find(event => event.type === 'vk-recommendation')).toMatchObject({ photoMode: 'skipped', discoveryAnswerId: 'hero' })
  await click('[data-discovery-complete]')
  expect(state()).toBe('vk-final')
}, 10000)

it('resets the VK final after 20 active seconds and starts the next visitor with a new session', async () => {
  await vkThird('new'); await finishReveal(0, 'vk-discovery-activation')
  const previousSession = events.find(event => event.type === 'session-start')!.sessionId
  // Complete the renderer while paused, so the final gets its full twenty active seconds.
  act(() => {
    host.querySelector<HTMLButtonElement>('[data-discovery-complete]')!.click()
    playback.playing = false
    root.render(<StrictMode><Prototype /></StrictMode>)
  })
  expect(state()).toBe('vk-final')
  useScenarioClock()
  await act(async () => { vi.advanceTimersByTime(10000) })
  playback.playing = false
  act(() => root.render(<StrictMode><Prototype /></StrictMode>))
  await act(async () => { vi.advanceTimersByTime(30000) })
  expect(state()).toBe('vk-final')
  playback.playing = true
  act(() => root.render(<StrictMode><Prototype /></StrictMode>))
  await act(async () => { vi.advanceTimersByTime(9999) })
  expect(state()).toBe('vk-final')
  await act(async () => { vi.advanceTimersByTime(1) })
  expect(state()).toBe('home')
  vi.useRealTimers()
  await start('VK Видео')
  expect(events.filter(event => event.type === 'session-start').at(-1)!.sessionId).not.toBe(previousSession)
}, 10000)
