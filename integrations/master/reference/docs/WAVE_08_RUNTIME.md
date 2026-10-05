# WAVE08 G1: обновлённая Стелла и художественный VK

04.10.2026. Применён первый VK-срез; весь WAVE08 остаётся в работе. [Проверка](../artifacts/reports/parallel-wave8-integration-20261004.md), [план](WAVE_08_INTEGRATION_PLAN.md).

## Открыть и проверить

1. Открыть `http://127.0.0.1:8782/visual-runner`, включить «Включить художественный исполнитель VK».
2. Оставить исполнитель видимым в отдельном окне/экране; скрытая страница приостанавливает работу. Закрыть другой `/runner` либо явно передать исполнение при предложении. Одновременно два владельца не допускаются.
3. На `http://127.0.0.1:8782/stella/?master=1` пройти VK без фото. Проявляются теги реальных ответов; после skip появляются Discovery и карточки, затем QR/теги/медиа приходят на стену.
4. Проверить паузу, перезагрузку с явной передачей владельца и отмену. Отмена убирает активные объекты, оставляя фон. Архивный completed пакет прежнего формата не преобразуется; страница сообщает ограничение, следующие новые квизы доступны.

Это локальная WebGL-проверка, без физического Spout-подтверждения. На Стелле QR/ссылка сохраняют тот же packageId при reload; текущий localhost result доступен только на этом ПК. Публичная публикация и реальная генерация ещё не подключены.

## Состав и контракты

- `/visual-runner.{html,js,css}` и `/artistic/artistic-render-port.js` используют действующие coordinator/execution-client/execution-renderer, server arc projection и resource API. Отдельного scheduler нет.
- Optional async `prepareRenderer` выполняется до attach/ready и не блокирует polling/cancel. Ошибки draw запрещают markers; зависшие preparations ограничены15с. Retry rebuild после transient failure; потерянный GPU context требует reload/нового порта.
- Typed `content-entities-v1`, `discovery-cycle-v1`, `wall-items-v1`; до256элементов, до32 одновременно видимых тегов. Невидимые кандидаты арки исключаются только из отрисовки; исходные IDs/порядок сохраняются.
- Только один текущий VK execution. Независимый reset arch после completed сохраняет прежний кадр стены до новой подготовки. Active-tail takeover, история5посетителей и полноценная concurrent composition здесь ещё не реализованы.
- QR генерируется существующим encoder; явный SVG raster→CanvasTexture, black/white pixel readiness. Поздние ресурсы подставляются по неизменному itemId. Технический MP4 пока является стоп-кадром.
- Новая `stella-vk-20261004-wave8-copy-v1` применяется к новым сессиям. Скоринг/metadata неизменны; `view.presentationCopy` берётся из frozen definition. Старые durable histories/схемы БД/тайминги не мигрировали.
- MAX wall presentation проверен и оставлен без замены. Художественная MAX Стелла и общий пролог — следующие срезы.

## Источник и применение

Компонентные источники D: `artifacts/workspace/tests/parallel-wave8/{stella-candidate,visual-candidate,max-candidate}`. Runtime F: `artifacts/local-master/`. Переданные source/build manifests и release hashes: `artifacts/reports/wave8-evidence/`. Это SHA-изоляция; Git worktree/commit не созданы из-за ownership, настройки Git не менялись. Runtime не требует D для запуска; rebuild выполняется из зафиксированных компонентных исходников D и их manifest.

Резерв применения: `artifacts/workspace/backups/integration-wave8-20261004-173714`, три согласованные SQLite и изменяемые исходники. Static compatibility fix сохраняет промежуточные2JS отдельно в `static-fix-before`. При откате не заменять бизнес-данные тестовыми8850; возвращать только проверенный код. Новых workflow/DB schema нет. Не переписывать новые frozen admission уже созданных посетителей.

Приёмка открыта: artistic motion/layout, реальные материалы/видео, native detail/FPS/Spout, G2–G4, камера/provider/публичный result. Последний wall item появляется сразу на all_arrived, поскольку отдельного postroll у текущего executor нет. Полный новый авторский tag-contact fade остаётся в D; текущая интеграция использует master poses.
