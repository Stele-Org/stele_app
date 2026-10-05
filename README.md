# Текущая Стелла — пакет для доработки, 05.10.2026

Это переносимый снимок исходников и последней установленной нами сборки STELLA-CAMERA-ROTATE-01. Включены незакоммиченные правки, которые отсутствуют в исходной Git-ветке. Начинайте здесь; прежние документы в docs содержат исторические планы и ограничения.

## Локальный репозиторий

С 05.10.2026 пакет ведётся в локальном git-репозитории. Тег `baseline/stella-camera-rotate-01` — пакет в полученном виде. Первый запуск на новой машине, PowerShell из корня проекта:

```powershell
.\scripts\stella.ps1 setup    # Node.js 24 и Gitleaks в .tools, npm ci, git-хуки
.\scripts\stella.ps1 smoke    # проверка типов, сборка, смок-тест без браузера
.\scripts\stella.ps1 dev      # http://127.0.0.1:5218/stella/
```

Системный Node.js не используется и не меняется. Все команды и порядок работы с git: [docs/context/DEV_WORKFLOW.md](docs/context/DEV_WORKFLOW.md). Сцены из Claude Design — показ тегов VK Видео и Discovery — работают внутри приложения. Предпросмотр в dev-сервере: `/stella/?reveal=series` и `/stella/?discovery=generation`. Исходные страницы прототипа: [artifacts/DESIGN/claude-design-stela-20261005](artifacts/DESIGN/claude-design-stela-20261005/README.md).

## Быстрый старт

Ниже исходная инструкция пакета; она работает, если в системе уже стоит Node.js 24+.

Нужен Node.js24+ и npm. Из корня распакованного архива:

```sh
npm --prefix integrations/master/stella-candidate ci --ignore-scripts
npm --prefix integrations/master/stella-candidate run dev
```

Открыть http://127.0.0.1:5218/stella/. Изменять **integrations/master/stella-candidate/src**. Статическая готовая сборка лежит в **integrations/master/stella-candidate/dist**. Не запускайте production-shell как обычный standalone Electron.

```sh
npm --prefix integrations/master/stella-candidate run typecheck
npm --prefix integrations/master/stella-candidate test
npm --prefix integrations/master/stella-candidate run build
```

После build файлы dist изменятся, старый accepted manifest/pin больше не валиден. Новый манифест и принятие готовит интегратор; не отключайте проверку SHA для обхода.

## Что актуально

- Единая UI-сборка VK Видео/MAX, LumiCells/Discovery, камера и серверные адаптеры.
- BRIO выбирается явно через deviceId.exact; NDI/NewTek/virtual не используются. При отсутствии/неоднозначности BRIO — ошибка, без fallback.
- BRIO смонтирована боком: preview и JPEG повернуты90°по часовой стрелке. Для другой установки меняются camera-preview.css и features/master/camera-capture.ts совместно. Preview — центральный covercrop, JPEG — полный кадр.
- Постоянная metadata-диагностика камеры; реальные журналы/фото не включены.
- MAX авторежим с возвратом Home после логотипа и кнопкой «Отменить показ»; освобождение станции подтверждает MASTER.
- Принятые AUDIO03/MOTION01/MOTION03 и корректировки жизненного цикла анимации/аудио сохранены.

## Камера и локальный браузер

На стенде Electron44.4.5 выдаёт video-only разрешение своему origin/main frame. В обычном браузере нового разработчика сначала разрешите камеру для localhost и перезагрузите страницу: если браузер скрывает имена устройств, строгий поиск BRIO завершится labels-unavailable и НЕ откроет другую камеру для получения permission prompt. Нужна подключённая BRIO. Автоповтор после USB-переподключения в этой версии не реализован; требуется перезапуск.

## MASTER и звук

/stella/?master=1 требует совместимого внешнего MASTER. Для dev proxy STELLA_MASTER_TARGET должен быть loopback http://127.0.0.1:PORT; по умолчанию8842. Без MASTER серверный сценарий не является автономным демо. Контракты: integrations/master/reference/contracts (снимок, сверять при интеграции).

integrations/stand содержит shell/adapter/audio bridge. Он требует штатный host, config/node.json, runtimeNode, Electron44.4.5, mTLS и центральный звук интегратора. Эти конфиги/бинарники/сертификаты не входят. В production локальный Electron muted намеренно: звук идёт через MASTER/Dante. AI/платные вызовы для локальной UI-доработки не нужны; ключей нет.

## Состав и границы

- integrations/master/stella-candidate: актуальный src/public/voice, lockfile, tests и dist.
- integrations/stand: оболочка и адаптер с pin именно включённого dist.
- artifacts/ribbon + docs/Research/lumicells-20260930: необходимые исходники LumiCells.
- artifacts/DESIGN: брендовые материалы/референсы; artifacts/stella-polza-kit: фоны/промпты/адаптер генерации без тестового фото/результата.
- docs/context, docs/Research, apps/stella-prototype/docs: история/обоснования. Исторический standalone artifacts/stella-prototype и сырые SOUND-дубли не включены; актуальные медиа находятся в src/public.
- PACKAGE-MANIFEST.json: SHA каждого файла. PROVENANCE.json: происхождение и установленный buildSHA.

Нет .git, node_modules, ключей, реальных .env, operational config/БД, пользовательских фото и логов сессий. Зависимости скачивает получатель. Клиентские материалы не становятся свободно лицензированными: см.NOTICE.md. Архив не является полным автономным стендом и не включает backend MASTER.

## Последняя проверка

Последняя применённая сборка: BRIO live, первый кадр preview263мс; camera22tests и capture4tests/typecheck/build PASS по итерациям. При упаковке исходники и dist сверены по SHA с применённым кандидатом; это не новый online-аудит стенда. Визуальную приёмку делает владелец стенда. Архив проверяется по CRC и SHA после записи.
