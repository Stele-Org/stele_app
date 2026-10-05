# Execution v1 — один технический renderer

04.10.2026 — ранний план/result применён; технический [Discovery cycle v1](discovery-cycle-v1.md) добавляет отдельный executor v6. Прежние durable версии и семантика emission_complete сохраняются. [Проверка](../reports/sys06-discovery-integration-20261004.md).

### BE-12 — восстановление после конфликта команды

Подтверждённый `CONTROL_REVISION_CONFLICT` для точного commandId/executionId не является постоянной ошибкой панели. После валидного свежего GET показывается уведомление, а кнопки определяются текущей фазой. Отклонённое действие автоматически не повторяется; новое нажатие создаёт новую команду. Потерянный ответ, 202, reconciliation, несовпавший/некорректный receipt и ошибка sessionStorage сохраняют блокировку и исходный запрос. Renderer-event/prepare/attach ветки и backend v5 не изменены. [Проверка](../reports/be12-command-conflict-integration-20261003.md).

## BE-11: действующее владение, manual-owner-v1

Эта запись заменяет прежнее правило автоматического attach чужого owner. GET /execution-options возвращает ownershipProtocol=manual-owner-v1. Новые операции проходят execution_operation_v5/apply_execution_v5, в том числе для старого execution; прежние durable функции v1–v4 сохранены для повторов и восстановления. Схема registry остаётся5.

POST /executions/{id}/attach принимает необязательный takeover:boolean=false. Без takeover:true чужой владелец получает отказ RENDERER_OWNED, даже при свежих expectedOwnerGeneration/expectedControlRevision. Свободный owner подключается автоматически. Повторное присоединение того же owner с актуальными fences — accepted no-op без смены phase, revision, checkpoint или generation. Явная передача повышает generation/controlRevision ровно один раз, сохраняет checkpoint/desired/markers и заново подтверждает ready; отменяемый показ остаётся cancelling. Точное повторение requestId возвращает прежний receipt. takeover:false канонически опускается, чтобы не менять payload старых retries.

Web Lock относится только к origin/профилю браузера и не разрешает перехват backend. Чужое окно отображает checkpoint как наблюдатель и не отправляет renderer ACK. Операторские start/pause/cancel остаются отдельными командами. Для takeover необходим локальный Web Lock: при второй вкладке того же origin сначала закрыть прежнюю вкладку исполнителя. При другом origin/браузере кнопка передаёт серверное владение непосредственно. Новая страница имеет новый ownerId; после reload нажать «Передать управление этой вкладке». Pending takeover повторяется с исходным ownerId/requestId; новая страница не присваивает себе чужую identity после такого retry.

Автоматического TTL/failover нет. Старое окно может продолжать посылать отклоняемые attach до обновления/закрытия, создавая записи истории; серверное владение от этого не меняется. Старый renderer останавливается при polling/ACK; fencing защищает сохранённое состояние, но не гарантирует одновременную остановку физического вывода на другом ПК. Production renderer/retention — отдельные задачи.

[Исследование](../../docs/research/renderer-owner-20261003.md) · [Интеграция](../reports/renderer-owner-integration-20261003.md).


03.10.2026 · первый срез BE-03. [Исследование жизненного цикла](../../docs/research/execution-lifecycle-20261003.md), [выбор timeline](../../docs/research/execution-timeline-20261003.md). Это контракт реализованного addon; результаты интеграции оформляются отдельно в artifacts/reports.

## Владение

Backend хранит желаемое состояние, подтверждённую фазу, владельца, checkpoint и receipts. Готовый Anime.js4.5.0 вычисляет зависимости/длительности и исполняет timeline. Renderer сообщает фактическую локальную позицию и подтверждения; backend не воспроизводит формулу lead/stagger/travel и не отсчитывает показ своим таймером. JSON описывает профиль, не исполняемый код.

Один глобальный fixture-слот на local-master. Одновременно допускается одно нетерминальное execution, даже у разных пакетов. После completed/cancelled освобождается только технический слот; Стелла остаётся занятой. Пакет не меняется; для подготовки требуется planReady=true и явно fixtureOnly=true. package.ready=false сохраняется и отображается. Нет auto-start, Spout/TD, аппаратных экранов, внешнего видео, генерации, QR или station release.

## HTTP

| Метод | Путь | Форма |
|---|---|---|
| GET | /execution-options | {profiles,fixtureOnly:true,engine:{name:animejs,version:4.5.0},limitations} |
| POST | /executions | {requestId,packageId,profileId,fixtureOnly:true} |
| GET | /executions/{executionId} | {execution} |
| GET | /packages/{packageId}/executions | {executions:[…]} |
| POST | /executions/{executionId}/commands | {commandId,expectedControlRevision,kind:start/pause/resume/cancel} |
| POST | /executions/{executionId}/attach | {requestId,ownerId,expectedOwnerGeneration,expectedControlRevision} |
| POST | /executions/{executionId}/events | {eventId,ownerId,ownerGeneration,controlRevision,kind,positionMs,markerId?,timing?} |

Mutation response200: {execution,receipt:{accepted:true,reason:APPLIED,requestId,executionId},duplicate,workflowStatus,needsReconciliation}. Domain rejection409 — тот же wrapper с accepted=false и reason. HTTP/schema failures используют detail.code или стандартную Pydantic422. Неизвестный исход202: {pending:true,operationId}; повторить исходный payload с прежним ID. Runtime failure503 не означает, что commit отсутствовал: GET проверяет сохранённое состояние, повторный запрос сверяется с прежним operation ID.

IDs используют общий ASCII token1–128 символов; счётчики неотрицательные int; ownerGeneration события>=1. Pydantic strict+extra=forbid. fixtureOnly требует настоящий JSON true; false/1 отклоняются. Одинаковый ID внутри типа операции с иным payload даёт EXECUTION_REQUEST_ID_REUSED. Повтор идентичного запроса возвращает прежний receipt и текущее состояние; он не выполняет переход заново.

## Сохранённое состояние

```json
{
  "schemaVersion":1,
  "executionId":"execution:<stable-request-hash>",
  "packageId":"package:...:1",
  "packageSnapshot":{"items":[],"ready":false},
  "profileSnapshot":{"id":"fixture-flow-compact","version":"1","leadMs":600,"staggerMs":700,"travelMs":6500,"easing":"outQuad"},
  "fixtureOnly":true,
  "packageReady":false,
  "timing":null,
  "phase":"preparing",
  "desired":"ready",
  "positionMs":0,
  "markers":[],
  "ownerId":null,
  "ownerGeneration":0,
  "controlRevision":0,
  "revision":0,
  "createdAtMs":0,
  "updatedAtMs":0
}
```

Пример packageSnapshot сокращён для описания; фактически хранится полный неизменный пакет с непустыми items. profileSnapshot берётся из configs/execution-profiles.json. Та же пара profile id/version с изменёнными параметрами отклоняется PROFILE_VERSION_REUSED. Новый профиль требует новой версии. duration и markers не вычисляются backend по профилю.

revision меняется каждым принятым изменением после create; controlRevision — только operator command или attach. Поэтому checkpoint не делает операторскую команду автоматически устаревшей. ownerGeneration повышается при каждом новом attach, в том числе нового документа с тем же ownerId; exact retry attach не повышает его повторно.

## Переходы и ACK

| Операция | Предусловие | Результат |
|---|---|---|
| create | Пакет planReady, fixture-слот свободен | preparing, desired=ready, owner отсутствует |
| attach | Не terminal; оба expected счётчика совпали | Новый ownerGeneration/controlRevision; preparing, desired/position/markers сохранены |
| ready | Текущий owner+controlRevision, preparing, позиция равна checkpoint | timing фиксируется; phase ready / starting / pausing / cancelling согласно desired |
| start command | ready | starting, desired=running |
| started ACK | starting или resuming; позиция равна checkpoint | running |
| checkpoint | running, позиция не убывает и<=duration | Сохраняется positionMs |
| pause command | running/starting/resuming | pausing, desired=paused; это ещё НЕ подтверждённая остановка |
| paused ACK | pausing, позиция не убывает | paused с фактической остановленной позицией |
| resume command | paused | resuming, desired=running; далее started ACK |
| marker | running/pausing, semantic order и label совпали | Сохраняется один marker; checkpoint=max(старый,marker.positionMs) |
| completed ACK | running, position=duration и оба marker подтверждены | completed; освобождается fixture-слот |
| cancel command | Любая нетерминальная фаза | cancelling, desired=cancelled |
| cancelled ACK | Текущий owner, cancelling | cancelled; освобождается fixture-слот |

Никакой timeout сам не объявляет paused/completed/cancelled. До подготовки timeline отмена может подтвердиться нулевой позицией без timing. Без renderer ACK отмена остаётся cancelling. Повтор новой команды cancel может повысить controlRevision, поэтому клиент должен повторять прежний ID при неизвестном ответе.

Terminal execution нельзя перезапустить, прикрепить или менять его checkpoint. Новый показ того же пакета — новый create после terminal старого исполнения. Поздний ACK старого execution не меняет следующий слот; старый ownerGeneration либо controlRevision отвергается. Для duplicate ID сначала проверяется сохранённый receipt, поэтому ранее принятый ACK остаётся известным фактом даже после смены владельца.

## Timing и markers

Только ready содержит timing; только marker содержит markerId. Остальные события запрещают эти поля. Timing получает renderer.getTiming() непосредственно от готовой timeline:

```json
{
  "durationMs":9200,
  "markers":[
    {"markerId":"emission_complete","positionMs":2700},
    {"markerId":"all_arrived","positionMs":9200}
  ],
  "items":[{"itemId":"...","startMs":600,"endMs":7100}]
}
```

Items в примере сокращены; требуется точный набор всех itemId пакета, без повторов,1–256. Все позиции конечные и в0..3600000ms; duration>0. У каждого item end>start; максимум start совпадает с emission_complete, максимум end и all_arrived — с duration. Это проверка согласованности уже разрешённой timeline, не второй resolver. При восстановлении timing должен совпасть с сохранённым целиком.

Оба marker в фиксированном порядке: emission_complete, all_arrived. Event marker.positionMs — точная позиция label из callback C. Поздний marker допустим после более нового checkpoint; он не откатывает позицию. Marker с другим новым eventId после подтверждения того же marker даёт MARKER_ALREADY_CONFIRMED; lost-response retry использует прежний ID. Completed без обоих markers отвергается. Эти события доказывают локальное техническое исполнение, а не кадр физического экрана или проход хвоста настоящей ленты.

## Владелец, восстановление и границы

Frontend получает exclusive Web Lock по instanceKey внутри одного origin/browser storage bucket и удерживает его весь срок работы renderer. После получения lock он делает attach с текущими счётчиками, seek сохранённой positionMs, ready с прежним timing и продолжает desired. Backend даёт fence старым сообщениям, но не реализует таймерную TTLlease. Web Lock не является распределённой блокировкой между браузерными профилями/ПК и не служит аутентификацией.

При hidden/offline renderer локально останавливается; checkpoint отправляется с backpressure. Корректная paused-проекция требует отдельного ACK. При restart простой не добавляется к animation time. Заявление «откат<=1с» допускается только для фактически измеренной малой local-проверки с заданным интервалом checkpoint; это не гарантия GPU/powerloss/долгой блокировки JS.

Хранение — прежняя registry.sqlite, additive schema2→3 одной транзакцией. execution state, singleton slot, receipt, version pin и DBOS checkpoint согласованы через SQLAlchemyDatasource. Каждая HTTP-операция — конечный именованный execution_operation_v1; нет постоянно тикающего backend timeline. Legacy durable функции и предыдущие таблицы не меняются. Старый binary отвергнет schema3; полный rollback/backup остаётся SYS-06.

Тестовые ENV: LOCAL_MASTER_TEST_PACKAGE_CONFIG_DIR также задаёт fixture execution-profiles.json; LOCAL_MASTER_TEST_EXECUTION_BARRIER и LOCAL_MASTER_TEST_EXECUTION_BARRIER_REQUEST_ID останавливают ровно указанную операцию после commit до workflow return. Marker-файл отпускается файлом <marker>.release. Обычный launcher очищает эти переменные. Это fault injection, не продуктовая настройка.

## Уточнение BE-07 — 03.10.2026

profile.version — редакция содержимого профиля, а не enum протокола: renderer принимает новые редакции с поддерживаемой структурой, включая3/4. execution.schemaVersion/protocolVersion по-прежнему определяют протокол. При неудачном создании renderer привязка не фиксируется как успешная; явный повтор готовит тот же snapshot. Ошибка не является ready/cancelled и не освобождает слот/станцию. Backend проверяет новую конфигурацию до старта workflow; повтор ранее принятого запроса использует его сохранённый snapshot.
