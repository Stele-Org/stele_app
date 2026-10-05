/** Lifecycle/presentation adapter around the unchanged, SHA-pinned F transport. */
import { createPanelClient } from './vendor/panel-client.mjs';
export const SLICE_STORAGE_PREFIX = 'stella-master-slice-v1:';
export function createSliceClient({ fetch, storage, uuid, onChange = () => {}, apiBase = '' }) {
  if (apiBase !== '' && apiBase !== '/master-api') throw Error('Unsupported master API base');
  let disposed = false, photoFlight = null;
  const lifetime = new AbortController();
  const client = createPanelClient({
    fetch: (path, options = {}) => {
      if (disposed) return Promise.reject(new DOMException('Presentation unmounted', 'AbortError'));
      const signal = options.signal ? AbortSignal.any([lifetime.signal, options.signal]) : lifetime.signal;
      return fetch(apiBase + path, { ...options, signal });
    }, uuid, admissionProtocol: 'stella-vk-v1',
    storage: { getItem: key => storage.getItem(SLICE_STORAGE_PREFIX + key), setItem: (key, value) => storage.setItem(SLICE_STORAGE_PREFIX + key, value) },
    onChange: state => { if (!disposed) onChange(state); },
  });
  const current = () => client.getSnapshot();
  function same(fence) {
    const s = current().session?.state;
    return !disposed && s?.protocol === 'stella-vk-v1' && s.sessionId === fence.sessionId && s.revision === fence.revision && s.screen === fence.screen;
  }
  return {
    getSnapshot: current,
    refresh: () => disposed ? Promise.resolve(current()) : client.refresh(),
    async start() {
      if (disposed) return current();
      if (current().canStart) await client.begin(120000);
      if (!disposed && current().session?.state?.screen === 'onboarding') return client.act('begin');
      return current();
    },
    answer(fence, questionId, answerId) {
      return same(fence) && fence.screen === 'question' ? client.act('answer', { questionId, answerId }) : Promise.resolve(current());
    },
    complete(fence) {
      return same(fence) && ['answer-reveal', 'photo-reveal', 'scanning', 'particles'].includes(fence.screen) ? client.act('presentation_complete') : Promise.resolve(current());
    },
    choosePhoto(fence, answerId) { return same(fence) && fence.screen === 'photochoice' ? client.act('photo_choice', { answerId }) : Promise.resolve(current()); },
    control(kind) {
      if (disposed || !['back', 'pause', 'resume', 'cancel', 'photo_skip'].includes(kind) || (kind === 'back' && current().session?.state?.contentPlan?.status === 'accepted')) return Promise.resolve(current());
      return client.act(kind);
    },
    async uploadPhoto(fence, payload) {
      if (photoFlight) throw Error('Передача снимка уже выполняется');
      const owned = () => same(fence) && fence.screen === 'camera' && current().canAct;
      if (!owned()) throw Error('Экран или состояние сессии изменились. Обнови состояние.');
      if (!payload || payload.expectedRevision !== fence.revision || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(payload.captureId) || !['male','female'].includes(payload.appearance) || payload.consent?.accepted !== true || payload.consent?.version !== 'poster-v1' || typeof payload.imageBase64 !== 'string' || !payload.imageBase64.length || payload.imageBase64.length > 1400000) throw Error('Некорректный снимок');
      const dataset = current().health?.instanceKey;
      photoFlight = (async () => {
        const response = await fetch(apiBase + '/stella/vk/sessions/' + encodeURIComponent(fence.sessionId) + '/photo', {
          method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),
          signal:AbortSignal.any([lifetime.signal,AbortSignal.timeout(10000)])
        });
        const receipt = await response.json();
        if (!response.ok || receipt.captureId !== payload.captureId || receipt.photoRevision !== 1 || typeof receipt.referenceAssetId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(receipt.referenceAssetId)) throw Error('Снимок не подтверждён. Повтори передачу этого снимка.');
        if (!owned() || current().health?.instanceKey !== dataset) throw Error('Снимок передан, но сессия изменилась. Обнови состояние.');
        return client.act('photo_captured', {referenceAssetId:receipt.referenceAssetId});
      })();
      try { return await photoFlight; } finally { photoFlight = null; }
    },
    retry: () => disposed ? Promise.resolve(current()) : client.retryPending(),
    dispose() { disposed = true; lifetime.abort(); },
  };
}
