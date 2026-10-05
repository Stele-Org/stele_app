# VK wall-items-v1 — поэлементная доставка

Применено 04.10.2026 в техническом local master8782. [Проверки](../reports/vk-wall-items-integration-20261004.md). Дополняет [Discovery](discovery-cycle-v1.md) и заменяет полнопакетную доставку только у новых показов. Существующие executions v1–v6 и snapshots сохраняются.

## Контракт событий

Новый `execution_operation_v7` / `apply_execution_v7`, профиль `fixture-discovery-compact/2` с `wallDeliveryProtocol: wall-items-v1`. Движение и таймлайн — Anime4.5.0, транзакции и recovery — DBOS3.2.0 SQLAlchemyDatasource/SQLite. Настройки lead/stagger/travel/reveal/erase остались прежними, snapshot неизменяемый.

К шести semantic markers добавляется `item_arrived:<ordinal>` для каждой карточки, ordinal от0 в неизменяемых packageSnapshot.items/timing.items. Маркер стоит на фактическом Anime endMs. Список строго проверяется на полноту, порядок, принадлежность itemId и соответствие профилю. При одинаковом времени: entity_reveal_presented, emission_complete, ribbon_items_visible, entity_hidden, ribbon_center_crossed, item_arrived по ordinal, all_arrived. Никакого второго таймера.

POST /executions/{id}/events использует прежние поля eventId/ownerId/ownerGeneration/controlRevision/kind=marker/positionMs/markerId. Первое прибытие, запись item, sequence, eviction, wall revision, execution state и receipt атомарны в одном registry transaction. Уникальность SQL(package_id,item_id) и SQL(package_id,ordinal). Повтор принятого eventId/body возвращает прежний receipt. Новый eventId уже пройденного маркера не повторяет доставку. Checkpoint и paused не перескакивают неподтверждённые маркеры; completed требует их принятия. all_arrived только проверяет полноту сохранённых items, ничего не досоздаёт.

## Состав стены

Первая карточка резервирует одну запись wall_entries, один sequence и одно место посетителя. Следующие дополняют её, не переставляя набор. Default5 и текущая изменяемая вместимость сохранены. При переполнении — старейший активный набор; поздние arrivals вытесненного пакета могут дополнять историю, но не возвращают его на стену. Повышение capacity тоже не восстанавливает вытесненные.

GET /wall сохраняет schemaVersion1 и добавляет к entry:

- wallDeliveryProtocol: wall-items-v1 либо legacy-package-v1;
- arrivedItemIds, arrivedItems, arrivalCount, totalItemCount;
- deliveryStatus: partial, complete либо interrupted.

packageSnapshot содержит полный неизменяемый план. UI показывает только arrivedItemIds, сопоставленные с ним; неизвестный протокол/повреждённая проекция оставляют последний подтверждённый снимок с ошибкой. У старых whole-package записей все items считаются доставленными.

При отмене доставленный поднабор остаётся, незавершённый становится interrupted; оставшиеся карточки не добавляются. Закрытие старой сессии не удаляет стену и не затрагивает нового посетителя. Смена interruption увеличивает wall revision. Завершение доставки и готовность медиа — разные понятия; здесь технические карточки без реальных видео.

## Следующий посетитель и восстановление

После принятого ribbon_center_crossed освобождается только sessionId/visitId/generation прежней Стеллы. Новый квиз идёт одновременно с остатком первого показа. Новый ранний пакет сохраняется сразу, но его запуск ждёт единственный execution_slot; после завершения первого техническая панель автоматически создаёт следующий Discovery execution. Два одновременно идущих показа не реализованы.

Pause/reload/restart сохраняют принятые items, позицию, профиль и sequence. После reload — наблюдение, затем явное takeover. Оперативная browser-очередь событий не стала persistent: в той же вкладке неизвестный ACK повторяется с тем же телом; после reload состояние сверяется с registry и новым owner generation. Не выдавать это за production-supervisor.

## Применение

Новая таблица wall_item_arrivals добавляется штатным initialize_tables под существующим registry schema5, без переписывания исторических записей. Durable v1–v6 и их helpers не изменены. Обновить браузер после установки: старый клиент не знает поэлементную проекцию. Откат — код и согласованные обе SQLite из backup после подтверждённой остановки. Старый код на новых v7 workflows не запускать.

TD/Spout/физический output, художественная приёмка D-компонентов, реальные assets/generation/late-fill, независимый renderer и BFCache остаются отдельными задачами.
