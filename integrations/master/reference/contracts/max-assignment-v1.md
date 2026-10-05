# MAX assignment/status — контракт первой параллельной итерации

03.10.2026. Версия max-assignment/v1. Root владеет контрактом; A — реализацией, B — независимыми проверками. Один слот main, без очереди/освобождения слота/отмены назначения в этой итерации. Поддержка этих операций не обещается. Пользовательский ввод сохраняет прежний отдельный lease.

## HTTP

Prefix /api/max-game/v1. Новый authorizeControl(req) отдельно от authorize(req), по умолчанию deny. Он защищает POST/GET assignments и GET slots, в том числе повторы; отсутствие player lease не означает отсутствие авторизации.

- POST /assignments, Content-Type application/json, строго: `{schemaVersion:1,assignmentId,slotId:"main",expectedGeneration:0,sessionId,missionId,contentRevision}`. ID — прежний token regex1..128, expectedGeneration — неотрицательный safe integer. Никаких owner/nextState/ответов клиента.
- Первое назначение HTTP201 `{receipt,duplicate:false}`. Receipt — неизменный `{schemaVersion:1,assignmentId,slotId,generation,sessionId,missionId,contentRevision,status:"accepted"}`. Поколение слота увеличивается на1; initially0. Accepted означает commit/выбранную scan-миссию, не renderer-ready/показ/прохождение.
- Точный повтор по assignmentId HTTP200 `{receipt,duplicate:true}` независимо от player lease и текущей игровой revision. Нормализация порядка JSON полей; весь смысловой payload сравнивается, включая expectedGeneration.
- Другой payload того же assignmentId:409 ASSIGNMENT_ID_REUSED. Порядок: валидация → поиск существующего ID/сравнение → проверка content и текущей generation/занятости. Старый принятый ID читается после обновления контента, не переисполняется.
- Новый assignment с устаревшей expectedGeneration:409 GENERATION_CONFLICT. Совпадающая generation, но слот занят:409 SLOT_BUSY. Существующая sessionId нового assignment:409 SESSION_EXISTS. Неизвестная миссия/невалидная форма400; несовпадающая текущая contentRevision409 CONTENT_CONFLICT. Эти отказы не создают receipt/сессию/новый run.
- GET /assignments/:assignmentId:200 `{receipt}`, неизвестный404 ASSIGNMENT_NOT_FOUND. Только устойчивый результат, без захвата owner или изменения прогресса.
- GET /slots/main:200 `{slotId:"main",generation:0,assignmentId:null,sessionId:null}` до назначения; после — generation/ID принятого назначения. Неизвестный слот400 INVALID_SLOT. Все ответы no-store.

## Состояние и атомарность

MAX строит начальную модель существующим createMissionModel + SELECT_MISSION (без фиктивного owner), status scan, runId1, ownerActive=false. В одной существующей SQLite BEGIN IMMEDIATE-транзакции фиксируются: новая max_sessions запись + assignment payload/receipt + slot state. Любой отказ откатывает всё. Дубликат не делает commit новой mission revision/второй эффект. HTTP отвечает после commit.

Транзакция только MAX; DBOS-мастер хранит intention отдельно. При неизвестном исходе он читает GET assignment; если404, повторяет **то же** назначение. Он не редактирует expectedGeneration и не создаёт новый assignmentId вслепую. Не добавлять generic outbox/scheduler/replay.

SQLite schema1→2 аддитивна: сохранить старые sessions/imports. schema0 новая база получает2. Не менять семантику старого input-owner API и прогресса. Весь storage новый API находится у одного владельца A, worker сохраняет WAL/FULL и native transaction.

## Приёмка

Отдельные fixture-БД: request-before-commit → restart/retry применяет один раз; after-commit-response-lost → restart/read/retry даёт тот же receipt; renderer-owner → master read/retry не меняет lease/прогресс. Дополнительно auth deny, payload conflict, неизвестное назначение, generation/slot busy, конкурентные старты, session collision, atomic no-partial-state и migration oldschema1. Проверять candidate из canonical artifacts/service и artifacts/max-game, не baseline vendor.

MAX timer5с, slot release/cancel/queue, production-масштабирование и полный master — следующие задачи. Живая панель8781 и стенд8770 не изменяются этой итерацией.
