# Стелла: журнал диалога и интерфейса

04.10.2026. Задача STELLA-DIAG-01. Область: отдельный кандидат `codex/stella-voice-v1`, localhost:5196. Журнал нужен для восстановления цепочки «речь/нажатие → ответ модели → команда → проверка допуска → анимация → фактический экран». Это наблюдение за текущим сценарием, не новый движок диалога и не интеграция мастера F.

## Выбранные готовые механизмы

| Механизм | Версия / лицензия | Применение и ограничения |
|---|---|---|
| [Pino](https://github.com/pinojs/pino) | 10.4.0, MIT | Реальный structured logger в браузере и сервере; JSONL serializer и файловый destination. Адаптер добавляет семантику Стеллы, готовый logger выполняет запись. |
| [Dexie](https://github.com/dexie/Dexie.js) | 4.2.1, Apache-2.0 | IndexedDB-транзакции и durable outbox до ACK сервера, повторная доставка после reload/offline. Это локальный Dexie, не Dexie Cloud. |
| [Qwen Omni client events](https://docs.modelstudio.console.alibabacloud.com/en/model-studio/client-events) | API qwen3.5-omni-flash-realtime | `input_audio_transcription: {model:'qwen3-asr-flash-realtime'}` включает отдельную расшифровку; существующий native WebRTC сохраняется. |

Pino [browser.write](https://github.com/pinojs/pino/blob/main/docs/browser.md) передаёт структурированное событие в локальную очередь. [Асинхронная запись](https://github.com/pinojs/pino/blob/main/docs/asynchronous.md) может потерять незавершённый буфер при аварии; поэтому локальный collector использует sync destination и flushSync перед ACK, без pino-pretty/worker transport. Это подтверждает запись процессом, но не гарантирует выживание при физическом отказе диска/питания.

Реальный опыт: [Pino #2132](https://github.com/pinojs/pino/issues/2132) описывает проблемы browser Error serialization; Error здесь явно превращается в name/message/stack перед передачей Pino. [Pino #960](https://github.com/pinojs/pino/issues/960) — особенности browser child levels; используется один фиксированный info writer, без иерархии фильтров. [Dexie #840](https://github.com/dexie/Dexie.js/issues/840) и [StorageManager](https://dexie.org/docs/StorageManager) показывают, что свободное место диска не гарантирует доступную браузерную квоту. Отказ IndexedDB/переполнение отображается пользователю, не маскируется успешной записью.

Готовые rrweb/OpenTelemetry не подключались: replay DOM/пикселей не объяснит отклонённую прикладную команду; здесь первична семантическая хронология. Pino-transmit-http рассмотрен как готовый транспорт, но его debounce/throttle-доставка не заменяет требуемую подтверждаемую очередь после reload. За долговечность очереди отвечает готовый Dexie, HTTP flush/ACK — небольшой протокольный адаптер коллектора.

## Корреляция

- Diagnostic session UUID переживает reload текущей вкладки; page UUID разделяет загрузки. Каждое событие содержит event UUID, sequence страницы, ISO UTC и монотонное время.
- Контекст: экран, продукт, индекс вопроса, business session, host playing, voice phase и input lock.
- Голос: connectionId, epoch, input item, responseId, callId и voiceTurnId. Команда UI получает requestId и semantic actionId; запрос, принятие, выполнение, отмена и итоговый экран — разные события.
- Provider input/output, ASR, tool arguments, статус response и usage сохраняются при наличии этих полей. Расшифровка ASR не объявляется внутренней интерпретацией Omni: это прямо оговорено в [server events](https://help.aliyun.com/en/model-studio/server-events).
- Причина отказа — фактический guard/статус (stale epoch, invalid tool, overlap, disabled/paused, timeout, cue cancellation). Скрытые рассуждения модели не запрашиваются; отсутствующее объяснение не придумывается.

## Хранение и границы

Клиент сохраняет очищенные события в IndexedDB; удаляет только подтверждённые event IDs. Сервер повторно очищает данные, проверяет UUID/schema/origin и дедуплицирует повторные доставки. Локальный просмотрщик читает JSONL, показывает события и позволяет скачать сеанс. Произвольные сообщения выводятся как текст.

Сырые аудио, камера, SDP, ключи, auth headers и бинарные payload не записываются. Записываются тексты разговора и прикладные события, поэтому журнал остаётся локальным, вне Vite served source и вне Git. Полные движения мыши/кадры анимации не нужны для этой задачи; фиксируются действия, границы этапов и сбои. Размеры сообщений/очереди/хранилища ограничены с явным сообщением об отказе; старые пользовательские сессии автоматически не удаляются.

Это DEV-функция кандидата. Публичная Стелла, основной runtime D и мастер F автоматически не получают журнал. События до внедрения восстановить нельзя. Проверка микрофонной акустики и того, какие ASR-события реально пришлёт провайдер, отделяется от тестов сохранения/интерфейса.

Фактические проверки и выявленные ограничения: [отчёт](../../artifacts/reports/stella-diagnostics-20261004.md). Эксплуатация: [DIAGNOSTICS.md](../../apps/stella-prototype/docs/DIAGNOSTICS.md).
