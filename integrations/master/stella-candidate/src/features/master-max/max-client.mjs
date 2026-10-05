/** Adapted from accepted master max.js; game control deliberately excluded. */
export const MAX_STORAGE_KEY = 'production-stella-max-pending-v1';
const clone = value => structuredClone(value);
const token = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(value);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function routes(op) {
  if (op.type === 'admission') return { post: '/stella/max/admissions', receipt: '/stella/max/admissions/' + op.body.requestId };
  if (op.type === 'quiz') return { post: '/stella/max/sessions/' + op.sessionId + '/commands', receipt: '/stella/max/sessions/' + op.sessionId + '/commands/' + op.body.commandId };
  throw Error('STELLA_ROUTE_FORBIDDEN');
}
function validPending(op) {
  if (!object(op) || !['admission', 'quiz'].includes(op.type) || typeof op.instanceKey !== 'string' || !op.instanceKey || !object(op.body)) return false;
  if (op.type === 'admission') return token(op.sessionId) && token(op.body.requestId) && op.body.sessionId === op.sessionId && token(op.body.visitId) && op.body.stationId === 'stella-main';
  return token(op.body.commandId) && Number.isSafeInteger(op.body.expectedRevision) && op.body.expectedRevision >= 0 &&
    typeof op.body.kind === 'string' && (op.type !== 'quiz' || token(op.sessionId));
}

export function createMaxClient({ request = globalThis.fetch, storage, uuid = () => crypto.randomUUID(), onChange = () => {} } = {}) {
  let saved = { version: 1, instanceKey: null, lastSessionId: null, pending: null };
  const view = { health: null, definition: null, station: null, session: null, game: null, online: false,
    fresh: false, error: '', notice: '', storageError: '', needsReconciliation: false };
  let stopped = false, epoch = 0, flight = null, activeAbort = null;
  try {
    const raw = storage.getItem(MAX_STORAGE_KEY);
    if (raw !== null) {
      const next = JSON.parse(raw);
      if (!object(next) || next.version !== 1 || (next.lastSessionId !== null && !token(next.lastSessionId)) ||
          (next.instanceKey !== null && typeof next.instanceKey !== 'string') || (next.pending !== null && !validPending(next.pending))) throw Error('invalid');
      saved = next;
    }
  } catch { view.storageError = 'Не удалось прочитать сохранённую команду. Данные не удалены; управление заблокировано.'; }
  const mismatch = () => Boolean(saved.pending && view.health && saved.pending.instanceKey !== view.health.instanceKey);
  function getSnapshot() {
    const available = !stopped && flight?.kind !== 'write' && view.online && view.fresh && !view.storageError && !view.needsReconciliation && !saved.pending;
    return clone({ ...view, pending: saved.pending, lastSessionId: saved.lastSessionId, busy: flight?.kind === 'write', refreshing: flight?.kind === 'read', stopped,
      error: mismatch() ? 'Сохранённая команда принадлежит другому экземпляру мастера. Повтор заблокирован.' : view.error,
      available, canRetry: Boolean(!stopped && !flight && view.online && saved.pending && !mismatch() && !view.storageError && !view.needsReconciliation) });
  }
  const emit = () => { if (!stopped) onChange(getSnapshot()); };
  const live = ticket => !stopped && ticket === epoch;
  function persist(next) {
    if (view.storageError) return false;
    try { storage.setItem(MAX_STORAGE_KEY, JSON.stringify(next)); saved = next; return true; }
    catch { view.storageError = 'Не удалось сохранить команду. Отправка заблокирована; прежняя запись сохранена.'; return false; }
  }
  async function http(path, body, ticket) {
    if (!live(ticket)) throw Error('Client stopped');
    const controller = new AbortController(); activeAbort = controller;
    const timeout = setTimeout(() => controller.abort(), 6000);
    try {
      const response = await request(path, { cache: 'no-store', signal: controller.signal,
        ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
      const data = await response.json();
      if (!live(ticket)) throw Error('Client stopped');
      return { status: response.status, ok: response.ok, data };
    } finally { clearTimeout(timeout); if (activeAbort === controller) activeAbort = null; }
  }
  function resolve(op, data) {
    let receipt;
    if (op.type === 'admission') {
      receipt = data?.receipt;
      if (!receipt || !['requestId', 'sessionId', 'visitId', 'stationId'].every(key => receipt[key] === op.body[key])) return false;
    } else {
      receipt = data?.ack;
      if (!object(receipt?.command) || !Object.entries(op.body).every(([key, value]) => receipt.command[key] === value) ||
          (op.type === 'quiz' && receipt.command.sessionId !== op.sessionId)) return false;
    }
    if (data.needsReconciliation || typeof receipt.accepted !== 'boolean' ||
        (receipt.accepted === false && (typeof receipt.reason !== 'string' || !receipt.reason))) return false;
    if (!persist({ ...saved, pending: null, lastSessionId: op.type === 'admission' && receipt.accepted ? op.sessionId : saved.lastSessionId })) return false;
    view.needsReconciliation = false; view.error = '';
    view.notice = receipt.accepted ? 'Действие подтверждено мастером.' : 'Действие отклонено: ' + receipt.reason + '. Состояние обновлено; выберите доступное действие.';
    return true;
  }
  function uncertain(data) {
    const reason = data?.detail?.code || data?.ack?.reason || '';
    view.needsReconciliation = Boolean(data?.needsReconciliation || /ID_REUSED/.test(reason));
    view.error = view.needsReconciliation ? 'Нужна сверка команды на backend. Новый запрос не создаётся.' :
      'Исход команды не подтверждён. Сохранены прежние ID и данные; доступен безопасный повтор.';
  }
  async function read(path, ticket) {
    const response = await http(path, null, ticket);
    if (!response.ok) throw Error(response.data?.detail?.code || 'HTTP ' + response.status);
    return response.data;
  }
  async function load(ticket) {
    const health = await read('/health', ticket);
    if (!health.ready || typeof health.instanceKey !== 'string' || !health.instanceKey) throw Error('Мастер ещё не готов');
    view.health = health;
    if (health.maxProtocol !== 'technical-max-v1' || health.maxQuizProtocol !== 'stella-max-v1') throw Error('Технический сценарий MAX ещё не установлен на этом мастере');
    if (!saved.pending && saved.instanceKey !== health.instanceKey && !view.storageError) persist({ ...saved, instanceKey: health.instanceKey, lastSessionId: null });
    const definition = await read('/max/definition', ticket);
    const station = await read('/stations/stella-main', ticket);
    const game = await read('/stella/max/queue-summary', ticket);
    if (game.protocol !== 'stella-max-queue-v1' || !Number.isSafeInteger(game.waitingCount) || game.waitingCount < 0 || typeof game.gameBusy !== 'boolean' ||
        !Array.isArray(definition.questions) || !Array.isArray(definition.missions) || !object(station) ||
        (station.sessionId !== null && !token(station.sessionId))) throw Error('Несовместимое состояние MAX');
    if (saved.pending && !mismatch()) {
      const op = clone(saved.pending), result = await http(routes(op).receipt, null, ticket);
      if ([200, 409].includes(result.status) && resolve(op, result.data)) { /* Exact receipt reconciled. */ }
      else if (result.status !== 404) uncertain(result.data);
    }
    let session = null;
    const sessionIds = [...new Set([station.sessionId, saved.instanceKey === health.instanceKey ? saved.lastSessionId : null].filter(Boolean))];
    for (const sessionId of sessionIds) {
      const result = await http('/stella/max/sessions/' + sessionId, null, ticket);
      if (result.ok) {
        const state = result.data.state;
        if (!object(state) || state.protocol !== 'stella-max-v1' || state.sessionId !== sessionId || !Array.isArray(state.actions) || !Number.isSafeInteger(state.revision) ||
            !Array.isArray(state.definition?.questions) || !Array.isArray(state.definition?.missions)) throw Error('Несовместимое состояние квиза MAX');
        session = state;
        if (!view.storageError && saved.lastSessionId !== sessionId && !mismatch()) persist({ ...saved, instanceKey: health.instanceKey, lastSessionId: sessionId });
        break;
      }
      else if (result.status !== 404) throw Error(result.data?.detail?.code || 'Сессия не прочитана');
    }
    if (!live(ticket)) return;
    Object.assign(view, { definition, station, game, session, online: true, fresh: true });
    if (!saved.pending) view.error = '';
  }
  async function run(work) {
    if (stopped || flight) return getSnapshot();
    let complete;
    const ticket = epoch, marker = { kind: work === load ? 'read' : 'write', done: new Promise(resolve => { complete = resolve; }) }; flight = marker; emit();
    try { await work(ticket); }
    catch (error) {
      if (live(ticket)) { view.fresh = false; view.online = false; view.error = 'Нет подтверждённого состояния: ' + error.message + (saved.pending ? '. Команда сохранена для сверки.' : ''); }
    } finally { if (flight === marker) flight = null; complete(); if (live(ticket)) emit(); }
    return getSnapshot();
  }
  const refresh = () => run(load);
  async function submit(ticket) {
    if (!saved.pending || mismatch() || view.storageError || !live(ticket)) return;
    const op = clone(saved.pending); view.fresh = false; emit();
    try {
      const result = await http(routes(op).post, op.body, ticket);
      if (result.status === 202 || !resolve(op, result.data)) uncertain(result.data);
    } catch (error) {
      if (!live(ticket)) return;
      view.error = 'Ответ не получен: ' + error.message + '. Повтор использует ту же команду.';
    }
    if (live(ticket)) await load(ticket);
  }
  async function issue(op) {
    if (!getSnapshot().available || !validPending(op)) return getSnapshot();
    if (!persist({ ...saved, instanceKey: view.health.instanceKey, pending: op })) { emit(); return getSnapshot(); }
    return run(submit);
  }
  let intent = null;
  function afterRead(work) {
    if (intent) return intent;
    if (stopped || flight?.kind === 'write') return Promise.resolve(getSnapshot());
    const ticket = epoch, wait = flight?.done ?? Promise.resolve();
    const pending = wait.then(() => live(ticket) ? work() : getSnapshot()).finally(() => { if (intent === pending) intent = null; });
    intent = pending; return pending;
  }
  function begin() {
    const dataset = view.health?.instanceKey;
    return afterRead(() => {
      if (!getSnapshot().available || view.station?.sessionId !== null || view.health?.instanceKey !== dataset) return getSnapshot();
      const sessionId = uuid();
      return issue({ type: 'admission', instanceKey: view.health.instanceKey, sessionId,
        body: { requestId: uuid(), sessionId, visitId: uuid(), stationId: 'stella-main' } });
    });
  }
  function quiz(kind, extra = {}) {
    const clicked = { dataset: view.health?.instanceKey, sessionId: view.session?.sessionId, screen: view.session?.screen, revision: view.session?.revision }, captured = clone(extra);
    return afterRead(() => {
      if (!getSnapshot().available || view.station?.sessionId !== clicked.sessionId || view.session?.sessionId !== clicked.sessionId || view.session?.screen !== clicked.screen || view.session?.revision !== clicked.revision || view.health?.instanceKey !== clicked.dataset || !view.session?.actions?.includes(kind)) return getSnapshot();
      return issue({ type: 'quiz', instanceKey: view.health.instanceKey, sessionId: view.session.sessionId,
        body: { commandId: uuid(), expectedRevision: view.session.revision, kind, ...captured } });
    });
  }
  const retry = () => getSnapshot().canRetry ? run(submit) : Promise.resolve(getSnapshot());
  function stop() { if (stopped) return; stopped = true; epoch++; activeAbort?.abort(); view.fresh = false; }
  function start() { if (stopped) { stopped = false; epoch++; } return refresh(); }
  return { getSnapshot, refresh, begin, quiz, retry, stop, start };
}
