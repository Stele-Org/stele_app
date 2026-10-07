// Drives the local VK Видео scenario in a real Chrome over the DevTools protocol: real mouse clicks on the real page.
// Usage: node drive.mjs <debugPort> <appOrigin> <outFile> <workers> [limit] [screenshotsDir]
import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'

const [debugPort, origin, outFile, workersArg, limitArg, shotsDir] = process.argv.slice(2)
const WORKERS = Number(workersArg ?? 3)
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

class Browser {
  constructor(socket) {
    this.socket = socket; this.next = 1; this.pending = new Map(); this.listeners = new Map()
    socket.addEventListener('message', ({ data }) => {
      const message = JSON.parse(data)
      if (message.id) {
        const waiter = this.pending.get(message.id); this.pending.delete(message.id)
        if (message.error) waiter.reject(new Error(`${waiter.method}: ${message.error.message}`)); else waiter.resolve(message.result)
      } else for (const listener of this.listeners.get(message.sessionId) ?? []) listener(message.method, message.params)
    })
  }
  static async connect(port) {
    const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()
    const socket = new WebSocket(webSocketDebuggerUrl)
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve); socket.addEventListener('error', reject) })
    return new Browser(socket)
  }
  send(method, params = {}, sessionId) {
    const id = this.next++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method })
      this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }))
    })
  }
  listen(sessionId, listener) { this.listeners.set(sessionId, [...(this.listeners.get(sessionId) ?? []), listener]) }
}

class Tab {
  static async open(browser) {
    // A window of its own: a tab in the background is not painted, and the page waits for its first painted frame.
    const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank', newWindow: true })
    const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true })
    const tab = new Tab(browser, sessionId)
    for (const domain of ['Page', 'Runtime']) await tab.send(`${domain}.enable`)
    await tab.send('Network.enable', { maxPostDataSize: 262144 })
    await tab.send('Emulation.setDeviceMetricsOverride', { width: 540, height: 960, deviceScaleFactor: 1, mobile: false })
    return tab
  }
  constructor(browser, sessionId) {
    this.browser = browser; this.sessionId = sessionId; this.reset()
    browser.listen(sessionId, (method, params) => {
      if (method === 'Network.requestWillBeSent' && /\/(result|photo)-storage$/.test(params.request.url)) {
        const kind = params.request.url.endsWith('result-storage') ? 'result' : 'photo'
        this.requests.set(params.requestId, kind)
        this.sent[kind]++
        this.posts[kind] = { requestId: params.requestId, postData: params.request.postData, headers: params.request.headers }
      }
      if (method === 'Network.responseReceived' && this.requests.has(params.requestId)) this.posts[this.requests.get(params.requestId)].status = params.response.status
      if (method === 'Network.loadingFinished' && this.requests.has(params.requestId)) this.posts[this.requests.get(params.requestId)].finished = true
      if (method === 'Runtime.exceptionThrown') this.errors.push(params.exceptionDetails.exception?.description ?? params.exceptionDetails.text)
      if (method === 'Runtime.consoleAPICalled' && params.type === 'error') this.errors.push(params.args.map(arg => arg.value ?? arg.description ?? '').join(' ').slice(0, 300))
    })
  }
  reset() { this.requests = new Map(); this.posts = {}; this.sent = { result: 0, photo: 0 }; this.errors = []; this.clicks = [] }
  send(method, params) { return this.browser.send(method, params, this.sessionId) }
  async evaluate(expression) {
    const { result, exceptionDetails } = await this.send('Runtime.evaluate', { expression, returnByValue: true })
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text)
    return result.value
  }
  async waitFor(expression, what, timeout = 30000) {
    const started = Date.now()
    for (;;) {
      const value = await this.evaluate(expression).catch(() => null)
      if (value) return value
      if (Date.now() - started > timeout) throw new Error(`Timed out after ${timeout} ms waiting for ${what}; screen=${await this.screen().catch(() => '?')}`)
      await sleep(100)
    }
  }
  screen() { return this.evaluate(`document.querySelector('main')?.dataset.screen ?? null`) }
  /** A real mouse press and release in the middle of the element, once it is there, enabled and on top. */
  async click(selector, what = selector, timeout = 30000) {
    const point = await this.waitFor(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)})
      if (!el || el.disabled || el.closest('[inert]')) return null
      const r = el.getBoundingClientRect()
      if (r.width < 4 || r.height < 4) return null
      const x = r.left + r.width / 2, y = r.top + r.height / 2
      const top = document.elementFromPoint(x, y)
      return { x, y, hit: !!top && (top === el || el.contains(top)) }
    })()`, what, timeout)
    this.clicks.push({ selector, hit: point.hit })
    if (!point.hit) { await this.evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`); return }
    for (const type of ['mousePressed', 'mouseReleased']) {
      await this.send('Input.dispatchMouseEvent', { type, x: point.x, y: point.y, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1 })
    }
  }
  async screenshot(file) {
    const { data } = await this.send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(file, Buffer.from(data, 'base64'))
  }
}

const questions = ['evening', 'ideal-content', 'discovery']
const first = ['series', 'standup', 'interview', 'science'], second = ['drive', 'heroes', 'learn', 'rest']
const passes = []
for (const a of first) for (const b of second) {
  for (const c of ['familiar', 'new', 'popular']) passes.push({ answers: [a, b, c], photo: 'not-requested' })
  for (const photo of ['accepted', 'unavailable', 'skipped']) passes.push({ answers: [a, b, 'hero'], photo })
}
// The visitor goes back and answers again: `answers` are the ones that stand at the end. A step is `question:answer`,
// `back:question` (the back button pressed on that question) or `start` (the start button of the introduction).
passes.push(
  { name: 'back-from-second-and-third', answers: ['science', 'rest', 'new'], photo: 'not-requested',
    route: ['evening:series', 'back:ideal-content', 'evening:science', 'ideal-content:drive', 'back:discovery', 'ideal-content:rest', 'discovery:new'] },
  { name: 'back-three-times-then-hero-skip', answers: ['interview', 'rest', 'hero'], photo: 'skipped',
    route: ['evening:standup', 'ideal-content:heroes', 'back:discovery', 'ideal-content:learn', 'back:discovery', 'back:ideal-content',
      'evening:interview', 'ideal-content:rest', 'discovery:hero'] },
  { name: 'back-to-introduction', answers: ['series', 'drive', 'popular'], photo: 'not-requested',
    route: ['back:evening', 'start', 'evening:series', 'ideal-content:drive', 'discovery:popular'] },
  { name: 'back-then-hero-photo-repeated', answers: ['science', 'heroes', 'hero'], photo: 'accepted', retake: true,
    route: ['evening:science', 'ideal-content:learn', 'back:discovery', 'ideal-content:heroes', 'discovery:hero'] },
)
const todo = passes.slice(limitArg && Number(limitArg) < 0 ? Number(limitArg) : 0, limitArg && Number(limitArg) > 0 ? Number(limitArg) : passes.length)
// One pass of every kind goes on to the last screen, with screenshots on the way.
const fullKinds = new Set()

async function run(tab, pass) {
  const { answers, photo } = pass
  const kind = `${answers[2]}:${photo}`
  const full = shotsDir && !pass.route && !fullKinds.has(kind) && (fullKinds.add(kind), true)
  const shot = name => full ? tab.screenshot(path.join(shotsDir, `${answers[2]}-${photo}_${name}.png`)) : null
  tab.reset()
  const started = Date.now()
  const times = {}
  const mark = name => { times[name] = Date.now() - started }
  // The camera switch of the dev server gives the hero's photo; without it the strict search finds no camera.
  await tab.send('Page.navigate', { url: `${origin}/stella/${photo === 'accepted' ? '?camera=any' : ''}` })
  await tab.click('[aria-label="VK Видео"]', 'the VK Видео logo on the start screen', 60000); mark('home')
  await tab.click('.onboarding-start', 'the start button of the introduction'); mark('onboarding')
  const question = id => `.continuous-question[data-question-id="${id}"]`
  for (const [index, step] of (pass.route ?? answers.map((answer, i) => `${questions[i]}:${answer}`)).entries()) {
    const [id, answer] = step.split(':')
    if (step === 'start') await tab.click('.onboarding-start', 'the start button of the introduction, again')
    else if (id === 'back') await tab.click(`${question(answer)} [aria-label="Назад"]`, `«Назад» on question ${answer}`)
    else await tab.click(`${question(id)} [data-option-id="${answer}"]`, `answer ${answer} of question ${id}`)
    if (!pass.route) mark(`answer${index + 1}`)
    if (full && index === 0) { await sleep(1500); await shot('tags') }
  }
  if (answers[2] === 'hero') {
    if (photo === 'skipped') { await tab.click(`${question('photo')} [data-option-id="skip"]`, '«Пропустить»'); mark('skip') }
    else {
      await tab.click(`${question('photo')} [data-option-id="accept"]`, '«Начать»'); mark('accept')
      for (const round of pass.retake ? ['retake', 'keep'] : ['keep']) {
        await tab.click('.vk-camera-button', 'the camera button'); mark('camera')
        await tab.waitFor(`document.querySelector('main')?.dataset.screen === 'vk-photo-review'`, 'the check of the photo', 30000); mark('review')
        pass.photoShown = await tab.evaluate(`document.querySelector('img.photo-review-image') ? 'photo' : document.querySelector('.photo-review-image--empty') ? 'black-square' : 'nothing'`)
        await sleep(300); await shot('photo-review')
        if (round === 'retake') {
          await tab.click('.photo-review-actions .secondary-button', '«Повторить»')
          pass.sentBeforeKeep = { ...tab.sent }
        } else { await tab.click('.photo-review-actions .primary-button', '«Продолжить»'); mark('continue') }
      }
    }
  }
  const sent = Date.now()
  while (!tab.posts.result?.finished && Date.now() - sent < 10000) await sleep(50)
  const stored = tab.posts.result
  if (!stored?.finished) throw new Error('The page did not send the result')
  mark('result')
  const body = await tab.send('Network.getResponseBody', { requestId: stored.requestId })
  pass.status = stored.status
  pass.file = JSON.parse(body.body).file
  pass.sent = JSON.parse(stored.postData)
  if (photo === 'accepted') {
    const begun = Date.now()
    while (!(tab.posts.photo?.finished) && Date.now() - begun < 5000) await sleep(50)
    pass.photoStatus = tab.posts.photo?.status ?? null
    pass.photoCaptureId = tab.posts.photo?.headers?.['X-Capture-Id'] ?? null
  }
  if (full) {
    await tab.waitFor(`document.querySelector('main')?.dataset.screen === 'vk-final'`, 'the last screen', 60000); mark('final')
    await sleep(400); await shot('final')
    pass.finalText = await tab.evaluate(`document.querySelector('#vk-result-title')?.textContent ?? null`)
  }
  // A changed answer must not have sent a result of its own: the count is taken a moment after the last one.
  if (pass.route) await sleep(2000)
  pass.resultPosts = tab.sent.result; pass.photoPosts = tab.sent.photo
  pass.times = times; pass.clicks = tab.clicks; pass.errors = tab.errors.slice(0, 5); pass.full = !!full
}

const browser = await Browser.connect(debugPort)
if (shotsDir) mkdirSync(shotsDir, { recursive: true })
const queue = [...todo]
let done = 0
await Promise.all(Array.from({ length: WORKERS }, async (_, worker) => {
  const tab = await Tab.open(browser)
  for (let pass; (pass = queue.shift());) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try { await run(tab, pass); pass.attempts = attempt; delete pass.error; break }
      catch (error) { pass.error = String(error.message ?? error); pass.attempts = attempt }
    }
    done++
    console.log(`[${done}/${todo.length}] w${worker} ${pass.name ?? pass.answers.join('+')} ${pass.photo} -> ${pass.error ? 'FAILED: ' + pass.error : pass.status + ' ' + pass.file}`)
    writeFileSync(outFile, JSON.stringify(todo, null, 1))
  }
}))
writeFileSync(outFile, JSON.stringify(todo, null, 1))
console.log('finished', todo.filter(pass => !pass.error).length, 'of', todo.length)
process.exit(0)
