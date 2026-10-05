# VK ribbon release v1 — первый local-срез VK-01

03.10.2026. Дополнение [execution-v1](execution-v1.md); [исследование](../../docs/research/vk-ribbon-release-20261003.md). Технические карточки fixtureOnly, без Spout/production.

## Профиль и время

Новый профиль version2 содержит releaseMarker:ribbon_center_crossed, centerTravelRatio:1/3 и approachEasing:linear. Часть x0→50 и часть x50→100 выполняет Anime; easing второй части остаётся outQuad. Профиль целиком закрепляется в execution.profileSnapshot. Legacy профили без этих полей сохраняют два marker и прежнее поведение.

Timing нового профиля содержит упорядоченные emission_complete, ribbon_center_crossed, all_arrived; каждый item содержит itemId,startMs,centerMs,endMs. startMs<centerMs<endMs. max(startMs)=emission_complete, max(centerMs)=ribbon_center_crossed, max(endMs)=all_arrived=durationMs. Center обязан лежать строго между emission и arrival. Точные дробные позиции разрешены и сравниваются с сохранённым label. При ready набор itemId обязан совпасть с неизменным пакетом; restore не меняет timing. Новый профиль с двумя маркерами и legacy с тремя отклоняются TIMING_PROFILE_MISMATCH.

## Привязка и освобождение

POST /executions не получает sessionId/generation от клиента. Backend находит content_packages.session_id и sessions, проверяет completed, совпадение visitId/sessionId снимка и текущее владение станцией. Старый пакет, владелец которого уже сменился, не может открыть новое release-исполнение: STATION_BINDING_CHANGED. В schemaVersion2 сохраняются:

```json
{
  "releaseBinding": {
    "sessionId":"session-id", "visitId":"visit-id", "stationId":"stella-main",
    "generation":1, "markerId":"ribbon_center_crossed"
  },
  "stationRelease":null
}
```

Marker проходит прежние ownerId/ownerGeneration/controlRevision, phase, порядок и position guards. Тот же DBOS datasource transaction записывает marker, receipt, состояние execution и:

```sql
UPDATE stations SET session_id=NULL,visit_id=NULL
WHERE station_id=:stationId AND session_id=:sessionId
  AND generation=:generation AND visit_id=:visitId;
```

stationRelease становится `{...releaseBinding,eventId,released:true,reason:'RELEASED'}` при одной изменённой строке. Если владелец уже отличается, marker остаётся фактом старого показа, но результат `released:false,reason:'STATION_BINDING_CHANGED'`; новая сессия не затрагивается. Повтор принятого eventId возвращает исходный receipt и актуальное состояние без нового эффекта. Новый ID того же marker отклоняется MARKER_ALREADY_CONFIRMED. Старые renderer fences отклоняются до смены станции.

Освобождение происходит только на center marker. emission, checkpoint даже после center, ready, pause, cancel и all_arrived сами не освобождают. Completed требует все маркеры текущего профиля. Данные завершённого квиза, visit и пакет не удаляются. Generation станции повышается существующим admission при входе следующего пользователя.

## Глобальный показ

GET /executions/current возвращает `{execution:...}`: активный singleton, либо последнее глобальное terminal execution при пустом слоте, либо null при пустой истории. Этот GET должен применяться независимо от активной сессии/пакета Стеллы. Новый квиз не убирает старое движущееся полотно. Показ нового пакета разрешается лишь после освобождения renderer slot completed/cancelled; сейчас это одна очередь подготовки вручную, без автоматического второго исполнения.

При cancel до center станция остаётся занятой; карточки отменённого исполнения скрывает клиент. Можно создать повторный показ того же пакета. Отдельная политика отмены всей сессии здесь не вводится. После center cancel не отменяет уже выданный доступ следующему игроку.

## Совместимость и проверки

Registry schema3 и DDL не меняются. Новые операции — execution_operation_v2/apply_execution_v2; зарегистрированные v1 тела сохранены для pending replay. Существующие execution JSON schema1/timing двух маркеров не переписываются. API сохраняет прежнюю форму nullable event-полей; отсутствующий item.centerMs не добавляется как null в legacy ready retry. Профиль модели исключает отсутствующие новые поля, чтобы старые version pins не изменились.

Обязательные проверки: actual Anime x50, станция занята до center; новый admission после center при работающем старом показе; exact retry и поздние события не меняют нового владельца; cancel до center; process restart после atomic commit; paused restore; legacy двухмаркерный show. Браузер дополняет HTTP — новый квиз и старые движущиеся карточки видимы вместе. Fixture не доказывает доставку кадра реальным экранам.