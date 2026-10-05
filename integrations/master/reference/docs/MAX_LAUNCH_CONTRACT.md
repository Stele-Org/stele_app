# MAX launch: реализованный технический контракт

04.10.2026 — WAVE-04 additive v3: launchPlan от квиза сохраняет tagsMax целиком, tagSource=quiz-snapshot, sourceSessionId и orbit anchor. Видимые теги не заменяются mission defaults; invisible slots остаются opacity0. Direct wall имеет tagSource=mission-template. JSON configs/max-launch.json содержит orbit; новые значения snapshot только для новых admissions. Старые v1/v2 планы не пересчитываются. [Проверка](../artifacts/reports/max-quiz-launch-handoff-20261004.md).

04.10.2026, WAVE-03. Backend и UI реализованы и проверены на изолированных данных. Этот документ описывает поведение; факт применения в F/8782 и итоговый IAB-прогон фиксирует интегратор отдельно. Художественная и production-приёмка не заявляются.

## Сценарий и данные

Стелла показывает аудиторию/цель; принятые ответы проявляют MAX-теги на арке. Подтверждение создаёт назначение. Активное назначение проходит **теги арки → объекты ленты → SCREEN_RIGHT → отдельное подтверждение показа**. Белая сущность отсутствует; ветка Discovery VK не меняется.

SCREEN_RIGHT — правый технический участок единого заднего экрана. Этот preview не создаёт отдельную production-сцену/фон MAX.

Конфигурация `configs/max-launch.json`:

| Поле | Реализованная семантика |
|---|---|
| version/id/revision | Версия и происхождение frozen определения |
| destination / whiteEntity | Только SCREEN_RIGHT / false |
| timingsMs | Длительности tags/ribbon/wall в миллисекундах |
| tagBindings | id/label/questionId/answerId; ссылки проверяются по определению квиза |
| missions[missionId].tags | Массив тегов с уникальными id/label |
| missions[missionId].objects | Массив id/label/kind/tagIds; сейчас явно поддержан mission-object |

Количество элементов не зашито в renderer. Неизвестный kind и неверные ссылки отвергаются; UI также блокирует auto-ACK неизвестного kind. Definition фиксируется при admission или прямом wall_select. Выбранный plan фиксируется при назначении либо wall_start; дальнейшая правка JSON влияет только на новые запуски.

`quiz.state.tagsMax` — readonly массив `{id,label,visible,opacity}`. Значения основаны на принятых ответах: непрозрачность1 у соответствующих тегов,0 у остальных. Кнопка назад убирает прежний ответ и его проявление. Renderer не вычисляет миссию самостоятельно.

## Assignment snapshot

```text
current.schemaVersion = 2
current.launchPlan = {
  version: "max-launch-v1", planId, assignmentId, missionId,
  definitionId, definitionRevision,
  destination: "SCREEN_RIGHT", whiteEntity: false,
  tags: [{id,label}], objects: [{id,label,kind,tagIds}],
  timingsMs: {tags,ribbon,wall}
}
current.launch = {
  planId, phase: "tags" | "ribbon" | "wall" | "presented",
  completedMarkers: [], phaseElapsedMs
}
```

| Assignment phase | Launch phase | Доступный следующий смысловой шаг |
|---|---|---|
| launch | tags | tags_complete |
| launch | ribbon | ribbon_complete |
| launch | wall | wall_arrived |
| delivery, delivered=true | wall, elapsed=duration | presented |
| awaiting_touch | presented | contact |
| playing | presented | Технический finish/cancel |

При wall_arrived сохраняется финальная wall-поза, без прыжка к началу. Только presented освобождает удерживаемую Стеллу и запускает ожидание руки. Пока назначения ждут в FIFO, их launch не проигрывается; Стелла освобождается после durable enqueue. При получении слота каждое проходит собственный plan. Прямой вход выбирает миссию и затем проходит такой же запуск, не обходя FIFO. Очередь не имеет продуктового лимита; сохраняются ресурсные/priority ограничения DBOS.

## Команды, guard’ы и восстановление

`POST /max/commands` использует прежний transport и receipt endpoint `GET /max/commands/{commandId}`:

```json
{"commandId":"marker-1","expectedRevision":5,"assignmentId":"max:assignment","kind":"launch_marker","planId":"max-launch:plan","marker":"tags_complete"}
```

Допустимые markers: tags_complete, ribbon_complete, wall_arrived. Проверяются текущий assignment, **world revision**, planId, строгий порядок и достижение длительности. Pause блокирует продвижение; delivery/presented/contact/finish не позволяют обойти пролог. Неправильный plan → LAUNCH_PLAN_MISMATCH, порядок → LAUNCH_MARKER_OUT_OF_ORDER, раннее время → LAUNCH_TOO_EARLY. Тот же commandId/payload возвращает исходный receipt; другой payload с тем же ID запрещён.

Elapsed сохраняет сервер существующими DBOS recv/clock_sample и SQLite transactions. Во время движения checkpoint примерно каждые0.2с; после duration частые тики прекращаются, автоматического перехода нет. Pause и смена bootId не расходуют бюджет. Semantic revision меняется от событий, а не от кадров/тиков. После перезагрузки UI делает Anime seek к сохранённой фазе и elapsed. Допускается откат до последнего checkpoint; жёсткая real-time гарантия на нагруженном ПК не заявлена.

Техническая автоматика по умолчанию выключена. После явного включения использует Anime completion/seek, отрисованный frame и два RAF, свежие assignment/plan/boot/revision и серверный elapsed. Pending-запрос остаётся в прежнем transport до сверки receipt. Auto-preview не отвечает на квиз, не отправляет contact/finish и не подменяет явный presented. Web Lock защищает preview данного origin, не распределённые физические поверхности.

После завершения launch новый активный/paused MAX-квиз может использовать арку при сохранённой миссии справа; его отмена не удаляет прежнюю миссию. Активный launch удерживает арку, а queued launch не запускается поверх него.

## Совместимость и статус

Root применил14файлов на8782; IAB и сохранность данных PASS. [Итог применения](../artifacts/reports/parallel-wave3-integration-20261004.md). Нижние компонентные проверки фиксируют состояние передачи до интеграции.

Новые admission/direct-wall envelopes помечены launchVersion2; назначения — schemaVersion2. Старые envelopes и назначения сохраняют v1 workflow/delivery. Старые durable bodies и receipts не менялись. SQL migration не нужна: дополнительные данные хранятся в versioned JSON прежних таблиц. Transport protocol technical-max-v1 сохранён; новая семантика различается по launch/schemaVersion.

Реальная проверка:64 backend assertions на HTTP/DBOS/SQLite, в том числе restart/pause, повторные/ранние маркеры, freeze конфигурации и передача общей DBOS queue от активного v1 к ожидающему v2. UI:10 Node-тестов, включая seek, stale callbacks, pending receipts и второй квиз при занятой правой стене. Root отдельно проводит IAB и применяет кандидат. Доказательства: `artifacts/reports/max-launch-backend-20261004.md`, `artifacts/reports/max-launch-ui-20261004.md`.

Остаются отдельными работами: общий production AV-owner VK/MAX для арки/ленты, CanonicalMaxPort/игровое ядро, реальные контакты, production renderer credentials/ready/presented/reconciliation, физический GPU/Spout-вывод. Технический preview этих гарантий не даёт.
