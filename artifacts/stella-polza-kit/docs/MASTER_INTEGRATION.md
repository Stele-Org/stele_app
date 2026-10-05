# POLZA-KIT-01 — интеграция в мастер F

Статус: комплект для передачи интегратору, **не установлен в F**. Read-only сверка исходников F: 2026-10-04T19:51:41.0454258Z. Единственный владелец записи и применения F — ведущий интегратор мастер-проекта. Этот документ не запускает миграцию, сервер, генерацию или публикацию.

Пакет должен объединять clean plates, 10 жанровых рецептов с M/F, stateless Python adapter и обезличенные материалы проверки. Принятый пользователем результат одной генерации Polza — evidence художественного результата; это не доказательство готовности production-сценария. Входная фотография, credentials, provider bearer, приватные URL и бизнес-БД в kit не входят. Итоговое изображение evidence не означает разрешения публиковать исходное фото.

## 1. Что фактически существует в F

Корень проверенного источника: `F:/project/VK_DigitalProducts_Stand`. Исследованы `artifacts/local-master`, перечисленные ниже контракты и действующая документация; работающий процесс и файловые БД не изменялись и не опрашивались.

| Участок | Подтверждено кодом | Ограничение для Polza |
|---|---|---|
| Content package | `package_models.py`: accepted photo требует referenceAssetId; generation item имеет itemId, themeId, instance, referenceAssetId, recipeId/version, jobId/resultAssetId placeholders | Модель допускает описание reference, но его реальный ingress этим не реализован |
| Реальный ранний freeze | `content_entity_store.persist_stella_package_v3` допускает только skip/unavailable; проверка непустого referenceAssetId возвращает INVALID_TECHNICAL_PHOTO_STATE; v2 имеет такой же запрет | Нельзя передать новое фото через старый strict payload и ожидать generation slots |
| Текущий путь workflow | `stella_api.py` выбирает admission v4 для preflight, v3 для content entities; старые v1/v2 сохранены | Не редактировать исторические durable тела; новый photo/provider путь требует новой версии |
| Команды Стеллы | `stella_models.py` включает photo_choice/photo_skip/capture_unavailable, но не upload, confirm-photo или choice male/female; package_request строит skipped photo | Пол/образ и reference не появятся от одной замены provider URL |
| Mutable resources | `asset_store.py`: отдельные asset_resources и asset_commands, revision/CAS, job/attempt identity, атомарный ACK через SQLAlchemyDatasource | Таблица полезна для расширения, но текущая модель payload не принимает production image reference |
| Provider v1 | `asset_models.AssetCommand`: provider только technical-fixture-v1; ready требует fixtureId=placeholder-v1; `asset_provider.fixture_reference` возвращает SVG | Нельзя подставить Polza URL/PNG/новый provider в /api/assets/commands |
| Другой provider | `local_media_models.py`: local-video-fixture-v1, lulu-review-v1; `local_media_provider.py` выдаёт проверенный локальный MP4 | Это не универсальное хранилище пользовательских результатов |
| Result | `early_result_api.py`: постоянные /vkshare/result/{packageId}, /api/results/{packageId}; resource вложен в item, fixtureOnly=true | Сам HTTP путь существует; публичный production result этим не подтверждён |
| Result media | `result.js`: технический resource/assetRef + строгий allowlist SVG placeholder и одного MP4 | Готовый JPEG/PNG Polza сейчас будет отклонён как неподдерживаемый ресурс |
| Данные | app.py задаёт DBOS master.sqlite; registry.py — registry.sqlite в LOCAL_MASTER_DATA, schema gate до5 | Kit не должен создавать третью бизнес-БД или менять эти файлы |
| Queue/recovery | asset_workflows.asset_command_v1 — конечный DBOS workflow одного изменения состояния, без внешнего provider side effect | Внешний submit/poll/reconcile workflow ещё надо добавить мастеру |

Проверенный `configs/package-policy.json`: fixture-variable-package@1, generation top1/per_theme1 и recipe fixture-portrait@1. Это текущий технический профиль, **не правило “всегда одна картинка” и не готовое соответствие десяти жанрам**. Количество позиций задаёт мастерская frozen policy. Kit обрабатывает одну явно назначенную позицию за вызов, не выбирает число запросов.

`content-package-v1.md` прямо описывает fixture. В `early-plan-result-v1.md` осталось историческое предложение «на8782 ещё не применён», тогда как более поздние TODO/WAVE_08_RUNTIME описывают применение WAVE08. Для текущих blockers приоритет отдан фактическим v3/asset/result исходникам и SHA, а не старому текстовому статусу. PROD-W3 кандидаты в TODO не считаются автоматически установленными в local-master или квалифицированными для image jobs.

## 2. Владение и граница kit

Мастер F владеет session/visit/station generation, проверкой согласия и принадлежности фото, immutable package, job/attempt и provider ID, очередью DBOS, долговременными таймерами, CAS, хранением файлов, выдачей результата и retention.

Kit предоставляет только операции:

| Операция | Вход/выход по смыслу | Чего не делает |
|---|---|---|
| prepare | Проверенные локальные photo + cleanplate, выбранные recipe/variant, frozen параметры → provider payload/дескриптор и digest | Не выбирает фотографию по папке, не определяет пол, не создаёт job/БД, не вызывает сеть |
| submit_once | Один подготовленный запрос + credential из внешнего окружения → один ответ POST/ID либо известная ошибка/unknown | Нет автоматического повтора POST, поиска другого ключа, модели или платного fallback |
| get_status | Сохранённый provider ID → один GET и нормализованное наблюдение | Нет своей polling loop, таймеров или очереди |
| download_result | Готовый результат/URL + целевой путь, заданный мастером → проверенный файл/метаданные | Не связывает файл с посетителем самостоятельно, не публикует, не меняет ready |

Точные аргументы и типы Python берутся из кода/README kit; таблица выше — граница ответственности, не обещание наличия в старом F соответствующих функций. Нет отдельного FastAPI-сервиса, конкурирующего worker/scheduler или SQLite в kit. Подготовленные payload содержат фото; их нельзя сохранять в общую документацию, stdout, public logs или evidence bundle.

Порядок изображений: **1 — фото посетителя, 2 — cleanplate**. Промпт: общий prefix + genre.common + **одна** выбранная ветка male/female. M/F — явный выбор пользователя. F_2 мюзикла исключён; используется F_1. Жанр/вариант/recipe version/master theme mapping назначает мастер, не UI-произвольный путь. SHA kit/prompt/cleanplate закрепляется при создании работы.

## 3. Точный порядок интеграции, выполняемый владельцем F

1. **Сверить baseline.** Пересчитать SHA таблицы в конце; при расхождении перечитать изменённые файлы. Сверить активный production candidate/provenance с local-master. В isolated F candidate разместить versioned kit целиком как зависимость и сохранить manifest; не копировать D поверх master. Не помещать kit в secrets или runtime data и не переносить туда исходные фотографии.
2. **Определить production reference boundary новой версией.** Согласовать descriptor `referenceAssetId + photoRevision + sessionId + visitId + station generation + selectedAppearance + consent version/status`, размер/MIME/SHA и разрешённый storage. Добавить явные upload/confirm-photo receipts с ownership/revision проверками. Старые Stella commands сохранить. Имена новых endpoint ещё не являются утверждённым контрактом; не добавлять эти поля в существующий extra=forbid запрос.
3. **Новый freeze/package путь.** Создать новую версию workflow/transaction рядом с `content_entity_workflows.py`/`content_entity_store.py`, согласовать dispatch `stella_api.py`. Разрешить только проверенный accepted reference. Закрепить выбранный M/F, recipe/prompt version+SHA, cleanplate SHA, provider/model/quality/aspect ratio и reference revision. Сохранить policy-driven stable generation items. Не менять уже frozen packages и прежние v1–v4 histories.
4. **Production resource/job контракт.** Добавить версионные strict модели, транзакции и APIs рядом с `asset_models/store/api/workflows`. Сохранить предметные CAS/commandId/jobId/attemptId проверки. Production ready должен принимать зарегистрированный локальный PNG/JPEG assetRef; technicalOnly/technicalFixture не использовать как обход. Проверить additive migration и общий namespace command IDs. Kit сам эту миграцию не выполняет.
5. **Подготовка работы мастером.** Для каждого frozen generation item мастер назначает стабильные jobId/attemptId/operationId и durable state до сети. На вход prepare передаёт только принадлежащий ему reference. Сохраняет descriptor/digests, не base64 в диагностический журнал. Budget/AI enabled/WAN policy проверяются до платного POST.
6. **Один внешний submit.** Мастер вызывает submit_once вне бизнес-SQL transaction. Успешно полученный provider ID немедленно сохраняет в своей durable записи вместе с correlation и observed status. Этот шаг не должен наследовать общий retry-decorator/HTTP retry POST. `user` в Polza — корреляция, не доказанная billing idempotency.
7. **Recovery неопределённого submit.** Если соединение оборвалось или процесс упал после отправки до сохранения ID, состояние uncertain/unknown сохраняется/восстанавливается; повторного POST автоматически нет. Мастер должен иметь явное правило claim/fence: восстановление durable submit-intent без подтверждённого завершения не разрешает заново отправить. DBOS step может повториться после crash; одного имени submit_once недостаточно для гарантии единственного списания между рестартами. Reconciliation ищет именно прежнюю попытку; отсутствие найденного ID не равно доказательству, что запрос не принят. Новая платная попытка — отдельное контролируемое решение.
8. **Опрос и файл.** DBOS/F планирует GET get_status для сохранённого provider ID (документация предлагает3–5с). pending/processing остаются pending; failed/cancelled — terminal outcome; timeout GET не означает failed генерацию. completed ещё не ready: сначала download_result, MIME/decode/dimensions/bytes/SHA, локальное атомарное сохранение в master-owned storage, затем CAS resolve той же job/attempt/photoRevision/item. Повтор скачивания не создаёт новую генерацию.
9. **Media route и projection.** Зарегистрировать assetId и безопасный same-origin resourcePath в мастерском media API; не выдавать клиенту локальный путь, секрет, исходный reference или произвольный provider URL. Обновить `early_result_api.result_projection` и typed image consumers `result.js`/лента/стена новой версией: изображение заменяет placeholder у прежнего itemId. Старые fixture previews сохранить; не отключать allowlist глобально.
10. **Отдельная публикация.** Мастерский publisher выдаёт public share origin/token/download и retention. Политика references/generated/public copies задаётся отдельно. Ошибка публикации не возвращает job на генерацию. QR ведёт на постоянный result, а не на временный CDN URL Polza. WAN outage оставляет durable pending/reconcile и не блокирует локальный запуск, если это допускает сценарная policy.
11. **Применение.** После isolated проверок интегратор фиксирует source SHA/контракт/миграцию/backup и применяет через существующий release process. Старые бизнес-БД не заменяются fixture данными. Отдельно фиксируется приёмка пользовательского результата; художественное одобрение одного evidence не закрывает recovery/security/media gates.

Рекомендуемая логическая связь:

```text
session + visit + station generation
  → confirmed referenceAssetId/photoRevision + appearance
  → frozen packageId/itemId + recipe version/hash
  → master jobId/attemptId
  → Polza providerId
  → downloaded/validated master assetId
  → asset_resources CAS ready
  → same result URL + same itemId in result/ribbon/wall
```

## 4. Обязательные проверки интегратора

- Без сети/AI: 20 recipe/variant связок разрешаются в существующие PNG, digest совпадает, один нужный gender prompt; нет фото/ключей в kit/log.
- Reference: чужая session/visit, stale generation/photoRevision, skip вместо accepted, пустой/повреждённый снимок, превышенный размер; подтверждение того же кадра после review.
- Package: policy count0/1/несколько, прежний itemId/порядок после restart; отсутствие фото не создаёт скрытых генераций.
- Submit: crash до сети, после отправки, после получения ID до commit; unknown не порождает второй POST. Сбой GET/download/restart повторяет только неплатные операции той же попытки.
- Resource: duplicate command, differing payload под тем же ID, stale revision, чужой job/attempt, поздний ответ прошлой фотографии; accepted ACK и resource сохраняются вместе.
- Result/media: настоящий PNG/JPEG late-fill открывается через тот же result URL; input photo и source path отсутствуют в JSON/HTML. MIME/SHA/fileroute соответствуют сохранённому asset. Завершённая анимация не запускается заново от позднего ready.
- Legacy: old sessions/workflows и technical SVG/MP4 продолжают работать; приложение не объявляет готовность всего пакета по одному ready item или по окончанию7сек Discovery.
- Сеть/публикация: pending при WAN outage, restart при сохранённом provider ID, самостоятельный retry публикации; публичная ссылка проверяется извне localhost.

Это будущие integration gates. Read-only аудит и одна художественно принятая картинка не отмечают их PASS.

## 5. Подтверждённый HTTP контракт и ограничения

- [Seedream5Lite guide](https://polza.ai/docs/gaidy/seedream-5-lite): `bytedance/seedream-5-lite`, prompt до2996символов, quality basic/high, images0–10 до10МБ каждое JPEG/PNG/WebP. Для этих постеров задан16:9; исходные clean plates приблизительно16:9, точные размеры смотрятся в manifest.
- [POST Media](https://polza.ai/docs/api-reference/media/create): `POST https://polza.ai/api/v1/media`, JSON model/input/async; images элементы type=base64 с dataURI либо rawbase64. Входы Polza могут быть загружены в её хранилище, даже при inline transport.
- [Media status](https://polza.ai/docs/api-reference/media/status): `GET https://polza.ai/api/v1/media/{id}`, status pending/processing/completed/failed/cancelled; результат в data, пример data.url; usage.cost_rub/cost могут присутствовать. Отсутствующая стоимость не означает0. Результаты CDN хранятся7дней, поэтому provider URL не долговременный assetRef.
- [DBOS steps](https://docs.dbos.dev/python/tutorials/step-tutorial), [datasources](https://docs.dbos.dev/python/reference/datasources): основу durable orchestration предоставляет существующий DBOS мастера. Зафиксированное исследование F описывает DBOS3.2.0; совместимость среды kit сверяет интегратор. Не создавать свой scheduler для обхода ограничений.
- F research `docs/research/asset-late-fill-dbos-20261004.md` разбирает готовый DBOS datasource и реальные upstream issues #761/#818; внешний network side effect не включён в atomic SQL ACK.
- F research `docs/research/stella-ai-mirror-transfer-20261004.md` отделяет готовый multi-reference transport Mirror от рискованного повторного POST и собственного SQLite worker. Kit переносит transport/подготовку, не конкурирующий сервер зеркала.
- Лицензии клиента на исходные постеры/брендовые материалы не превращаются автоматически в open-source grant. Hosted Polza — внешний сервис; лицензии Python dependencies указываются в комплекте отдельно.

## 6. SHA snapshot F для повторной сверки

Снято 2026-10-04T19:51:41.0454258Z; пути относительно `F:/project/VK_DigitalProducts_Stand`. Это фиксация **прочитанного источника**, не SHA активного процесса/production release. До установки нужно повторить проверку; совпадение SHA само по себе не заменяет интеграционный тест.

| Файл | SHA-256 |
|---|---|
| artifacts/contracts/content-package-v1.md | `7ddcf11d7c86adf5381d92f5dafe550e5a687ef37e9252af8f1db9e12e309556` |
| artifacts/contracts/early-plan-result-v1.md | `afe65c77a499083d26eb9678c8165120f6cea06ddddb248129d9bd1402ac2bb3` |
| artifacts/local-master/asset_models.py | `ba87faabfb0559a836f439ec02f696da076549e27cc59eebd1c3e84f878fa775` |
| artifacts/local-master/asset_provider.py | `a8a8928249c332e2f9b4917c3bedec6016d95d6f803c112b44351b3eb14ff104` |
| artifacts/local-master/asset_store.py | `80ba9b99a0cffff02cb6febfe64afe3fc9a5321319a5e54c7d352dd02e6261f1` |
| artifacts/local-master/asset_api.py | `bd48860ec82a70018394642348eb344fe5dfb196ca8f8afe45cc9bb10665b413` |
| artifacts/local-master/asset_workflows.py | `5d41f7fe5cf15a89cb4b31ba9c46033a78c08219508d39f3a6566f4f0e8a406b` |
| artifacts/local-master/early_plan_store.py | `51dc7d0127ab05d1615a02da934913a71b6423ede3870e12517715849a1cf211` |
| artifacts/local-master/early_plan_workflows.py | `8890137a9261c152b8ebecbf153162a287f8b54e9638f0ce483ddbb0732f5fe2` |
| artifacts/local-master/early_result_api.py | `968db6f2f7d1a9dae1f21d910d4f3f62846e56dd50c2d79ef4e350004b531089` |
| artifacts/local-master/package_models.py | `17ea4d66341743b9992ca0a58d3433558c45347f4570cf9fb30683c1ccf80157` |
| artifacts/local-master/package_store.py | `fcb7c185d8c7e459e1dc0320dd8bba2541c9e6ac5031c36227591b3d1563f02a` |
| artifacts/local-master/stella_models.py | `5965e868e8abe658e159410d35122537aba38ac8e8634788b4fa345de167777e` |
| artifacts/local-master/stella_api.py | `2aa0b77ce5aee5a604b65bb16d97d18f0b3e8f87483b1d35212eeee7be2b8e85` |
| artifacts/local-master/content_entity_workflows.py | `98fde7ebb53c458a566ef15dc9ebc1a7b5caa731b1c72509dc8ce9916e62c6fb` |
| artifacts/local-master/content_entity_store.py | `48e5f214f582442dcb78f02b95d5c470cabf4cf5018ea895f58dac74da716331` |
| artifacts/local-master/local_media_models.py | `0a0f49cebc142cf50c3f328120b0588458efd434bd1dcdeaed84cfcaa726ae7b` |
| artifacts/local-master/local_media_store.py | `f9bc76a32695872c8833fc63b92b2ec24eb1dfe57b437cbf76906aaf44615b56` |
| artifacts/local-master/local_media_provider.py | `6a59edc34afa21afa6deae3e5f3e9f1364c0955622495efd463acfb27afc059c` |
| artifacts/local-master/result.js | `c842c4914c0d9c12178b26188d8d2b12b9dc1105be4da4f729cb3d5ddf20e604` |
| artifacts/local-master/registry.py | `0a27e465f2ad4a6f0189e455d144323c392d28bb26f2b1d2e74832f65a7005ab` |
| artifacts/local-master/app.py | `8df5189b6c38b004a17a8b5aff6f74e212825883018177019ac8fa782259a100` |
| artifacts/local-master/configs/package-policy.json | `e0450a929ba1d490c9f9885b80dd9bdad757118e7083e9c259bcf0b0195eaad0` |
| docs/research/asset-late-fill-dbos-20261004.md | `53a4c0572094239b229356f2a6a8e7d38c2b7ef00f89ad849182598d440bd645` |
| docs/research/stella-ai-mirror-transfer-20261004.md | `319e03d800cf026c3612d1a6420696761f358e995b8521031d2e9959e1d4049c` |
| docs/WAVE_08_RUNTIME.md | `3ca7f5cb5604532518a9a39515320a92b24b55fdbcc4b0dbb3d47aa44362cb89` |
| docs/PRODUCTION_NODE_DELIVERY_PLAN.md | `75426def2ef8d43c1558aa5a6122c175ad4df46595c7b497d894dbd28b7086a5` |
| TODO.md | `bf8cf77ba033b6948dc6ea997ba2cd8bd73b13a34eedad4ff687d1a9f536d9d3` |

Проверка выбранного файла, без изменения F:

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath 'F:/project/VK_DigitalProducts_Stand/artifacts/local-master/asset_models.py'
```

Общие TODO/архитектура/контракты F в этой задаче не изменялись. Их обновляет интегратор после принятия конкретной версии и фактической проверки.

