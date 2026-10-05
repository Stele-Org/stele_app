import qrcode from './vendor/qrcode.mjs';

/** Same accepted package identity and pinned encoder as the master's result entity. */
export function buildResultQr(packageId, resultPath, origin, apiBase = '') {
  if (typeof packageId !== 'string' || !packageId || resultPath !== '/vkshare/result/' + encodeURIComponent(packageId)) throw Error('Результат не связан с пакетом');
  if (apiBase !== '' && apiBase !== '/master-api') throw Error('Неверный путь API');
  const base = new URL(origin);
  if (!['http:', 'https:'].includes(base.protocol) || base.origin !== origin) throw Error('Неверный адрес мастера');
  const href = new URL(apiBase + resultPath, base).href;
  const qr = qrcode(0, 'M'); qr.addData(href, 'Byte'); qr.make();
  return { href, svg: qr.createSvgTag({ cellSize: 4, margin: 16, scalable: true }) };
}
