# VK-02: локальный реестр стены v1

04.10.2026 — новые Discovery показы используют [wall-items-v1](vk-wall-items-v1.md): поэлементные arrivals, all_arrived только проверяет полноту; старые v1–v6 сохраняют описанную ниже полнопакетную доставку. Новый профиль fixture-discovery-compact/2, executor v7. Исторические ограничения ниже относятся к прежнему срезу.

## Граница итерации

Техническая панель, fixtureOnly=true. На стену целиком добавляется неизменяемый пакет после принятого `all_arrived` от действующего владельца Anime-показа. Это подтверждение технического таймлайна, не физического экрана. Первое появление отдельной карточки, видео, распределённая доставка, реакции посетителя и GPU/Spout не реализованы этим контрактом.

Новые execution операции используют DBOS workflow/transaction v4. Тела v1/v2/v3 сохранены. Только созданные новой версией executions имеют wallBinding. Показы, созданные до этой итерации, включая ещё идущие, не помещают контент на стену; история завершённых не импортируется автоматически.

## Идентичность и порядок

Одна запись — один packageId; текущий backend допускает один package на session. Пакет хранит sessionId/visitId и immutable items. Повтор packageId никогда не обновляет порядок и не возвращает вытесненный пакет. Порядок — монотонный SQL sequence первой принятой доставки, а не часы клиента. Сейчас единственный execution slot делает порядок целой доставки однозначным.

По умолчанию пять пакетов. Шестой вытесняет самый старый активный. История посещения/квиза/пакета/доставки сохраняется; у wall_entries только ставится evicted_at_ms. Понижение вместимости немедленно вытесняет старые записи; повышение не воскрешает прежние. Значение сохраняется в registry.sqlite. configs/wall-policy.json задаёт initialCapacity только при первом создании wall_policy. Диапазон1..1000 — техническая валидация API, не обещание вместимости физической визуализации.

## API

GET /wall:

```json
{"wall":{"schemaVersion":1,"fixtureOnly":true,"capacity":5,"revision":0,"occupancy":0,"entries":[],"totalDelivered":0,"totalEvicted":0},"limits":{"minCapacity":1,"maxCapacity":1000}}
```

entries упорядочены от старого к новому; запись: sequence, packageId, sessionId, visitId, executionId, deliveredAtMs, packageReady, fixtureOnly, packageSnapshot. ready остаётся исходным; текущие fixture-пакеты ready=false не превращаются в готовый медиаконтент.

POST /wall/capacity:

```json
{"requestId":"unique-id","expectedRevision":0,"capacity":3}
```

200: receipt={accepted:true,reason:APPLIED,requestId,revision,evictedPackageIds},wall,duplicate,workflowStatus,needsReconciliation. 409 receipt с WALL_REVISION_CONFLICT или ошибка WALL_REQUEST_ID_REUSED. Повтор с тем же requestId и телом возвращает прежнюю квитанцию и текущую wall. 202 означает незавершённую операцию; клиент повторяет то же тело, не генерирует новый requestId. 503 needsReconciliation — операторское разбирательство, не успешное сохранение. Неверная ёмкость отвергается422. wall.revision меняется и при доставке нового пакета, поэтому параллельный POST требует актуальной версии; автоматическое преодоление конфликта без нового решения пользователя запрещено.

## Транзакции и закрытие

Принятие all_arrived, запись доставки, вытеснение, изменение execution state и execution receipt происходят в одной DBOS SQLAlchemyDatasource transaction. Capacity command и вытеснение — другая короткая transaction; SQLite сериализует writers. GET читает согласованный transaction snapshot.

Если close сессии принят до all_arrived, показ переводится в cancelling, controlRevision меняется, поздний marker отклоняется и стена не пополняется. Если доставка уже принята, операторское закрытие сессии её со стены не убирает: это отдельная область жизненного цикла, как и в предыдущем контракте close. Возврат после перезапуска сохраняет вместимость, порядок и историю; сетевые повторы не дублируют размещение.

Registry schema4→5 только добавляет wall таблицы; прежние бизнес-строки сохраняются. DBOS master.sqlite не заменяется.

## Проверки

[Исследование](../../docs/research/vk-wall-retention-20261003.md), [интеграционная проверка](../reports/vk-wall-check-20261003.md). Параллельный arrival/capacity дополнительно проверен root в wall-race-20261003.json. Пользовательская визуальная приёмка и физическая стена остаются OPEN.
