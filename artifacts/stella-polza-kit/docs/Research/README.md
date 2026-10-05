# POLZA-KIT-01 — обоснование Python-адаптера

Дата проверки: 04.10.2026. Область: публичная документация и read-only чтение BFM-AIMIRROR. Секреты не читались; запросы генерации и другие авторизованные обращения к Polza не выполнялись. Это исследование, не акт проверки живой интеграции.

## Решение и границы

Для портативного комплекта подходит тонкий REST-адаптер на **HTTPX** и проверка изображений через **Pillow**. Библиотеки выполняют собственно HTTP-транспорт и декодирование; писать свой HTTP-клиент, декодер, очередь или retry engine не требуется. Очередь, постоянные business-state, возобновление и публикация принадлежат мастер-проекту F.

Официальный отдельный Python SDK Polza для `POST /v1/media` **не найден** при проверке официального индекса, media create/status и поиске SDK. Это результат ограниченного поиска, не доказательство отсутствия любого пакета. На media-страницах Python-примеры используют `requests`; пример с OpenAI SDK на сайте относится к chat/completions и сам по себе не подтверждает поддержку custom media. Источники: [индекс Polza](https://polza.ai/docs/llms.txt), [создание media](https://polza.ai/docs/api-reference/media/create), [сайт с примером chat SDK](https://polza.ai/).

## Подтверждённый контракт Polza

- `POST https://polza.ai/api/v1/media`: `model`, `input`, `async:true`, опциональный `user`; изображения в `input.images` — объекты с типом и данными. Заголовок Bearer только для API-хоста. Поле `user` — корреляция, не гарантия дедупликации. В просмотренной документации create нет контракта `Idempotency-Key`. [Media create](https://polza.ai/docs/api-reference/media/create).
- Статус: `GET /api/v1/media/{id}`; состояния pending/processing/completed/failed/cancelled. Сохранять полученный ID до продолжения UI. Результат может содержать error, warnings, content; completed без изображения требует отдельной обработки. Документация указывает 7 дней хранения на CDN — интегратор должен скачать результат в своё постоянное хранилище. [Media status](https://polza.ai/docs/api-reference/media/status).
- Для `bytedance/seedream-5-lite`: prompt до 2996 символов, 0–10 референсов по 10 МБ, JPEG/PNG/WebP, quality basic (2K) или high (3K). Эти ограничения относятся к конкретной модели; не переносить их автоматически на другую. [Seedream 5 Lite](https://polza.ai/docs/gaidy/seedream-5-lite).
- Порядок «постер / фото посетителя» должен соответствовать тексту промпта. Смысл input image 1/2 задаётся комплектом, а не универсальным правилом API. Подтверждение сохранения лица, надписей и композиции требует отдельной разрешённой живой генерации.

## Готовые зависимости

| Компонент | Проверенная опубликованная версия | Лицензия | Применение / ограничение |
|---|---|---|---|
| HTTPX | 0.28.1; Python >=3.8 | BSD-3-Clause | HTTPS, pooling, sync/async, JSON, streaming, типизированные сетевые ошибки |
| Pillow | 12.3.0; Python >=3.10 | MIT-CMU | Реальное декодирование JPEG/PNG/WebP, размер и формат, обнаружение части повреждений |

Версии и лицензии сверены по [HTTPX PyPI](https://pypi.org/project/httpx/0.28.1/) и [Pillow PyPI](https://pypi.org/project/pillow/12.3.0/). Это кандидаты для lock-файла, а не утверждение об уже установленной версии среды F. При упаковке сохранить license notices и проверить wheels под точные Python/OS интегратора.

## Таймауты и повторы

HTTPX различает connect/read/write/pool timeouts. Read timeout — ожидание очередного блока, а не общий deadline всей операции. Поэтому время генерации и дедлайн получения результата должен ограничивать хозяин задания в F отдельно. Не выставлять глобальное `timeout=None`. [HTTPX timeouts](https://www.python-httpx.org/advanced/timeouts/).

Встроенный `HTTPTransport(retries=N)` повторяет ConnectError/ConnectTimeout, но не является политикой HTTP 429/503 либо read/write ошибок. Для платного POST рекомендуемый default kit — `retries=0`, один явный вызов submit, redirects выключены. Если ответ POST потерян, возвращать неопределённый исход, а не автоматически начинать новую генерацию. После известного provider ID повторное получение статуса относится к той же операции. Если F нужны повторы GET по 429/503, использовать готовый механизм в его существующем scheduler; в kit его не дублировать. [HTTPX transports](https://www.python-httpx.org/advanced/transports/).

Реальные обсуждения подтверждают границу транспорта: [HTTPX #1677](https://github.com/encode/httpx/discussions/1677) — статусные повторы не встроены; [HTTPX #2941](https://github.com/encode/httpx/discussions/2941) — случайные ReadTimeout нельзя считать доказательством отказа приёма сервером. Это сообщения пользователей/обсуждения, не доказательство сбоя Polza или актуального бага HTTPX. Для отдельной будущей политики GET исследован готовый [httpx-retries, обсуждение автора #3484](https://github.com/encode/httpx/discussions/3484); сейчас добавлять его в kit незачем.

## Проверка файлов

Не доверять расширению или Content-Type. Рекомендованный состав проверки: ограничить размер скачивания; Pillow open в разрешённых форматах; проверить width/height/pixel budget; verify; повторно открыть и выполнить load для фактического декодирования. Использовать context managers. Это применение готового декодера, не самописная проверка PNG/JPEG-заголовка. [Pillow Image](https://pillow.readthedocs.io/en/stable/reference/Image.html), [жизненный цикл файла](https://pillow.readthedocs.io/en/stable/reference/open_files.html).

`LOAD_TRUNCATED_IMAGES` оставить False; не маскировать повреждения разрешением неполных файлов. [Константа Pillow](https://pillow.readthedocs.io/en/stable/reference/ImageFile.html#PIL.ImageFile.LOAD_TRUNCATED_IMAGES). В [реальном issue #5834](https://github.com/python-pillow/Pillow/issues/5834) подавление ошибок давало чёрные непригодные картинки. Успешное декодирование не проверяет сходство лица, точность русского текста или художественное качество. Локальное сохранение — временный файл и атомарная замена только после полной загрузки и проверки.

## Что действительно делает BFM-AIMIRROR

Read-only источники:
- [server.mjs](D:/job/production/RESTRUCTURA/BEELINE-2026/BFM-AIMIRROR/app/server.mjs:319): fetch + AbortController, обработка HTTP/Retry-After/JSON; сборка payload около строки 614 передаёт сначала фото посетителя, затем reference.
- [generation-worker.mjs](D:/job/production/RESTRUCTURA/BEELINE-2026/BFM-AIMIRROR/app/lib/generation-worker.mjs:1): SQLite/WAL, запись попытки перед POST, уникальный marker в user, поиск metadata.externalUserId в истории, хранение нескольких provider IDs, polling, отдельная публикация.
- [действующая спецификация BFM](D:/job/production/RESTRUCTURA/BEELINE-2026/BFM-AIMIRROR/app/DOCS/16-generation-reliability-architecture.md): принятая там политика до трёх POST на 0/20/40 сек при отсутствии ID допускает повторные списания. **Она не является default нашего kit и не переносится в F автоматически.**
- [исследование с реальными тестами 11.09.2026](D:/job/production/RESTRUCTURA/BEELINE-2026/BFM-AIMIRROR/research/2026-09-11-polza-reliable-generation-architecture.md), [receipts](D:/job/production/RESTRUCTURA/BEELINE-2026/BFM-AIMIRROR/research/2026-09-11-polza-test-receipts.json): одинаковые body/user/Idempotency-Key дали разные ID и отдельные списания. Маркер удалось найти через историю; сроки появления pending и отказоустойчивость при реальном обрыве не проверялись. Это более сильное практическое основание, чем предположение о стандартной идемпотентности.

SHA256 прочитанных исходников:
- generation-worker.mjs: `60d0207f5c6338fbcf3f580e2a5bdccde17696caa5fce0ed28d390c12becbda4`
- server.mjs: `516de4e1fe00f9fbe80414a0e5b492e07a3018999398294fd5f4ea26d963dfdc`

Код BFM изучен как опыт внедрения. Его собственный Node worker нельзя объявлять готовой Python-библиотекой либо молча переносить как второй мастер. Лицензия на переиспользование кода BFM этим исследованием не установлена; в kit предлагаются HTTPX/Pillow и тонкое отображение публичного REST-контракта.

## Неподтверждённое и передача интегратору

Платный end-to-end сейчас не проводился. Не подтверждены доступ текущего ключа, конкретный маршрут провайдера, гарантированная цена, SLA, гарантии identity preservation, callback/reconciliation SLA и exactly-once. Offline проверки адаптера подтверждают обработку ответов и файлов, но не заменяют живую приёмку. Kit не должен включать ключи, фотографии посетителей, реальные provider URLs и историю пользовательских генераций в логи или архив.

