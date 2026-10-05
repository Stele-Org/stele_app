# Local master admission v1 — ограниченный контракт BE-01

03.10.2026. Один local процесс и одна станция `stella-main`. Предметная модель: посещение (`visitId`) может иметь несколько последовательных сессий; каждая сессия принадлежит одному посещению и одному запросу допуска. Доступность станции хранится в registry, не выводится из того, открыта ли браузерная вкладка.

## Вход и неизменность результата

`POST /admissions` принимает только:

```json
{"requestId":"request-1","visitId":"visit-1","sessionId":"session-1","stationId":"stella-main","durationMs":20000}
```

ID — непустые безопасные token1..128; durationMs целый1000..120000 для малого local компонента. Это настройка квиза, не длительность допуска станции.

- Первый принятый запрос:201 `{receipt,duplicate:false}`. Повтор того же requestId и payload:200 с тем же receipt. Изменение payload для занятого requestId:409 `ADMISSION_ID_REUSED`.
- Busy и collision session возвращают409 с неизменяемым отказным receipt. Тот же отказной requestId остаётся отказом и после освобождения станции. Для новой попытки нужен новый requestId.
- Неуспешный допуск не создаёт посещение или сессию и не меняет поколение станции. Запись отказного admission и готовый DBOS receipt допустимы.
- Accepted receipt содержит schemaVersion1, requestId, accepted, reason, stationId, visitId, sessionId, generation, workflowId. Это подтверждение сохранённого допуска, не готовность renderer и не фактический показ на экране.
- До появления результата допуска:202. Аварийное состояние с неизвестным исходом:503 и `needsReconciliation`; его нельзя трактовать как обычный отказ или безусловно повторять новым ID.

`GET /admissions/:requestId` возвращает сохранённый результат/состояние процесса; `GET /stations/stella-main` — stationId, generation, sessionId/visitId либо null; `GET /visits/:visitId` — посещение со связанными сессиями. `GET /sessions/:id` и POST commands / GET ACKs наследуют семантику finite-sessions: durable повторы, conflict payload, безопасные поздние команды. Прямого `POST /sessions` нет: он обошёл бы допуск.

## Хранение и готовый механизм

Используется публичный **DBOS3.2.0 SQLAlchemyDatasource** с SQLite и SERIALIZABLE. Предметные записи и библиотечный transaction-result находятся в одной datasource транзакции. Занятие станции проверяется атомарным conditional write; недостаточно прочитать свободный слот и потом безусловно записать владельца.

Admission workflow выполняет datasource claim, затем публичный durable start конечной сессии с фиксированным ID. DBOS replay восстанавливает промежуток между сохранением допуска и запуском сессии. Registry и system DBOS — две локальные БД; общей распределённой транзакции между ними не заявляем. Дополнительный самописный outbox/replay/scheduler не вводится.

Поколение увеличивается при каждом успешном допуске. Завершение старой сессии может снять только её собственное владение с совпадающим поколением. История посещений/сессий/receipt сохраняется после освобождения.

## Освобождение и предел этого шага

- `cancelled` или `expired` технического квиза освобождают его владение через datasource-транзакцию самой сессии до подтверждения команды.
- `completed` **удерживает станцию**: VK ждёт прохождения контента через центр ленты; MAX — подтверждённой постановки в очередь либо готовности миссии при свободной игре. Эти бизнес-маркеры в первом срезе BE-01 ещё не подключены.
- Нет force-release endpoint, автоматического освобождения по HTTP timeout, повторного назначения при неизвестном исходе и TTL аренды станции.
- Нет очереди MAX, визуальных исполнителей, production доступа, глобальной multi-process блокировки или переноса живого quiz-panel. OS owner-lock ограничивает один процесс одного data-dir; HTTP слушает loopback.

## Приёмка

Реальные HTTP/DBOS/SQLite: конкурентные одинаковые/разные запросы, busy без частичных данных, неизменный отказной receipt, session collision без перезаписи, restart занятой станции, crash после claim до child start, cancel/expiry и защита нового владельца от старой команды, completed с занятым слотом. Fixtures и PIDs изолированы; запрещены изменения работающего стенда. Результат хранится в artifacts/reports; источники и версии готового механизма — docs/research/local-master-admission-20261003.md.

Сверка реализации: существующая registry session до запуска дочернего workflow возвращает503 SESSION_STARTING при команде, а не404. GET session отдельно показывает registry/state/workflowStatus/needsReconciliation. Схема registry поддерживает0→1; production migration и согласованный backup двух БД не входят в этот срез.
