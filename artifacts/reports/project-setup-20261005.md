# Настройка локального проекта и смок-тест — 05.10.2026

Проверки выполнены на Windows 11, Node.js 24.21.0, npm 11.19.0. Браузер, headless, камера, MASTER и AI не запускались. Визуальную приёмку делает пользователь.

## Итог

| Проверка | Результат |
| --- | --- |
| Целостность пакета по `PACKAGE-MANIFEST.json` | PASS: 827 из 827 файлов совпали по SHA256 |
| `dist` против принятого манифеста сборки | PASS: 101 файл, SHA манифеста `493dfdde…2d6bce`, совпадает с `PROVENANCE.json` |
| `npm ci --ignore-scripts` | PASS: 227 пакетов, уязвимостей 0, lockfile не изменился |
| Проверка типов | PASS |
| Сборка в `.cache/build-check` | PASS; 101 из 101 файла побайтно совпал с принятой сборкой |
| Смок-тест `scripts/smoke.mjs` | PASS: 11 из 11 |
| Тесты Vitest | 302 из 304; 2 не проходят, см. ниже |
| ESLint | 12 ошибок, 2 предупреждения, см. ниже |
| Gitleaks, рабочие файлы и история | PASS: утечек нет |

Сборка из исходников воспроизводит установленную на стенде сборку побайтно. Это подтверждает, что исходники в репозитории соответствуют STELLA-CAMERA-ROTATE-01.

## Смок-тест

```text
PASS  dev: entry page  -- http://127.0.0.1:5290/stella/ -> 200
PASS  dev: local header
PASS  dev: master entry page  -- ?master=1 -> 200
PASS  dev: module graph  -- 263 modules requested, 0 failed
PASS  dev: public assets  -- 13/13 sampled of 63
PASS  build: entry references  -- assets/app.js, assets/index.css
PASS  build: compared with accepted build  -- 101/101 files byte-identical (informational)
PASS  design: standalone page  -- 883905 chars
PASS  design: Stela D2 - gradient.dc.html  -- 6 local references
PASS  design: Stela D2 - solid.dc.html  -- 6 local references
PASS  design: Stela.dc.html  -- 12 local references

SMOKE PASSED: 11/11
```

Отдельно проверены команды из инструкции: `stella.ps1 dev` отдал http://127.0.0.1:5218/stella/ с кодом 200, `stella.ps1 design` — http://127.0.0.1:5219/ с кодом 200. Оба процесса после проверки остановлены.

Что это доказывает: dev-сервер стартует, стартовая страница отдаётся в обоих режимах, все 263 модуля приложения находятся и преобразуются, включая LumiCells из `artifacts/ribbon` и `docs/Research`, файлы из `public` отдаются, сборка проходит.

Что не проверено: отрисовка в браузере, анимации, звук, камера BRIO, серверный режим с настоящим MASTER, работа на стенде.

## Тесты, которые не проходят

Оба относятся к запуску камеры и не проходят на неизменённых исходниках пакета:

| Тест | Ожидание теста | Поведение кода |
| --- | --- | --- |
| `src/app/App.camera.test.tsx` — «requests at home once and shares capture across master phases» | `getUserMedia` вызван один раз | `CameraSession.tsx` сначала требует `enumerateDevices`. В тесте его нет, камера получает статус `unavailable`, `getUserMedia` не вызывается. |
| `src/app/ContentReady.test.tsx` — «preserves the stand startup camera…» | запрос `{ video: { facingMode: 'user' }, audio: false }` | Код запрашивает `{ video: { deviceId: { exact } } }` после поиска BRIO. |

Причина: тесты не обновлены после перехода на строгий выбор BRIO в STELLA-CAMERA-ROTATE-01. От окружения сбой не зависит. Исправление — обновить два теста под новый контракт камеры; исходники в рамках настройки не менялись.

## Замечания ESLint

| Файл | Правило | Количество |
| --- | --- | --- |
| `src/features/master-max/MasterMaxSlice.tsx` | `react-hooks/set-state-in-effect` | 2 |
| `src/features/master-max/MasterMaxSlice.tsx` | `react-hooks/refs` | 8 |
| `src/features/master/presentation-playing.ts` | `react-hooks/set-state-in-effect` | 1 |
| `src/features/master/usePresentationCompletion.ts` | `react-hooks/set-state-in-effect` | 1 |
| `src/components/RingTag.tsx`, `src/features/master/VisitorStatus.tsx` | `react-refresh/only-export-components`, предупреждение | 2 |

Предупреждения известны по прежним отчётам. Ошибки находятся в коде авторежима MAX и завершения презентации, исходники не менялись.

## Что установлено

- Node.js 24.21.0 и Gitleaks 8.30.1 в `.tools`, SHA256 архивов сверены с опубликованными. Системный Node.js 22.14.0 не тронут.
- 227 npm-пакетов по `package-lock.json` в `integrations/master/stella-candidate/node_modules`.
- Python-зависимости `artifacts/stella-polza-kit` не ставились: комплект относится к платной генерации, которая для локальной доработки интерфейса не нужна.

## Git

- `main`, коммит `b12eef5`, тег `baseline/stella-camera-rotate-01`: пакет без изменений, 726 файлов. Папка `dist` не версионируется по исходному `.gitignore`.
- Настройка и материалы дизайн-сессии — ветка `codex/project-setup-20261005`.

## Трафик

На компьютер разработчика скачаны Node.js, Gitleaks и npm-пакеты, объём не измерялся. На стенд ничего не передавалось.
