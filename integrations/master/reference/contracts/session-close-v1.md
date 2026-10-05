# Операторское закрытие completed-сессии v1

03.10.2026. Локальный технический показ. [Исследование](../../docs/research/session-close-20261003.md), [проверка](../reports/session-close-check-20261003.json), [старый pending create](../reports/session-close-legacy-check-20261003.json).

Это отдельный lifecycle сессии: результат квиза остаётся completed, ответы, выбранные темы, пакет и история не удаляются. Active/paused quiz отменяется существующей командой квиза. Новая команда предназначена только для completed.

## API

POST `/sessions/{sessionId}/close`:
```json
{"requestId":"unique-command-id","visitId":"visit-id","stationId":"stella-main","generation":1}
```
Точное совпадение sessionId/visitId/stationId/generation сверяется с registry.sessions. Несовпадение 409 SESSION_BINDING_MISMATCH. Некомплектная сессия 409 SESSION_NOT_COMPLETED. Повтор requestId с другим запросом 409 CLOSE_REQUEST_ID_REUSED; с тем же возвращает прежнюю receipt и актуальное closure. Новый requestId для уже закрытой сессии безопасен. Принятый запрос возвращает 200; DBOS ещё не закончил запись — 202 pending; ошибка durable workflow — 503 needsReconciliation.

GET `/sessions/{sessionId}/close` — readonly, `{closure:null}` либо:
```json
{"closure":{"schemaVersion":1,"sessionId":"s","visitId":"v","stationId":"stella-main","generation":1,"requestId":"r","phase":"waiting_for_renderer","executionIds":["execution:id"],"requestedAtMs":123,"closedAtMs":null,"stationRelease":null}}
```
POST возвращает также receipt `{accepted,reason,requestId,sessionId}`, duplicate, workflowStatus, needsReconciliation.

`waiting_for_renderer`: намерение сохранено, все связанные незавершённые показы получили desired=cancelled, phase=cancelling и новый controlRevision. Нет подтверждения остановки — нет закрытия или освобождения станции. Это отсутствие ACK, а не доказанная диагностика сетевого offline. Таймаут не подменяет ACK.

`closed`: нет незавершённых связанных показов. Если они уже completed/cancelled или их вообще нет, закрытие сразу; иначе после fenced cancelled ACK. stationRelease={released,reason:RELEASED|STATION_BINDING_CHANGED}. Изменившаяся привязка станции не является ошибкой: например, после середины ленты на Стелле уже другой посетитель. Его сессия остаётся неизменной.

## Атомарность и восстановление

DBOS3.2 SQLAlchemyDatasource сохраняет close intent, cancellation controlRevision и receipt одной транзакцией. Новые исполнения закрываемого/закрытого пакета получают SESSION_CLOSING_OR_CLOSED в той же writer-транзакции. Новые execution операции protocol3 и `apply_execution_v3`; исторические workflow/transaction v1/v2 и их helpers сохранены без изменения. Snapshot execution остаётся schemaVersion2; новый протокол относится к обработке команд, не к изображению.

ACK cancelled подтверждается после очистки карточек реальным владельцем WebLock. При desired=cancelled attach сразу получает cancelling: ошибка сборки визуализатора не должна препятствовать очистке и ACK. Не требуется ready/timing для никогда не подготовленного показа; ACK несёт текущую durable position и owner/control fencing. Отставший center marker или ACK предыдущего владельца отклоняется. Подтверждение terminal, освобождение execution_slot, closed lifecycle и освобождение строго своего station binding — одна транзакция.

Registry migration3→4 добавляет session_closures, session_close_requests и SQLite BEFORE INSERT trigger; прежние данные не переписываются. Запуск сервера не двигает время показа. Старый сохранённый create protocol1/2 не обходит closure при replay: trigger вызывает ABORT, datasource откатывает изменения; клиент получает ERROR/needsReconciliation. Это явная несовместимость старого незавершённого запроса с новым lifecycle, без ложного успеха и без занятия слота.

Старый terminal ACK не создаёт окно зависания closure: либо его транзакция закончилась до close (close увидит terminal), либо после close у ACK устаревший controlRevision и он отвергается. Новый исполнитель подтверждает отмену с актуальными fences. Уже записанный receipt повторного ACK не запускает side effect повторно.

## Границы

Нет force-release без подтверждения остановки, распределённого lease/watchdog, TD/Spout-команд и удаления контента реальной стены. Один локальный слот исполнения. Закрытие после center не отменяет уже начатый новый квиз. Физическая остановка внешних поверхностей должна получить свой явный ACK-контракт до production. Отмена всех completed-сессий массово не реализована.
