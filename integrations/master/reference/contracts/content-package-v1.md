# Content package v1 — local fixture contract

03.10.2026. Реализованный первый срез BE-02. Общая продуктовая политика: [CONTENT_PACKAGE_POLICY](../../docs/CONTENT_PACKAGE_POLICY.md). Техническая fixture-модель не заменяет scoring клиентской Стеллы. Проверка реализации ведётся отдельным отчётом; этот файл не объявляет integration PASS.

## Вход и автоматический путь

Новые POST /admissions сохраняют вместе с admission снимки configs/package-policy.json, package-catalog.json и package-quiz-fixture.json. Новый DBOS workflow admit_with_package_v1 вызывает прежний quiz_session без изменения его тела, ждёт child.get_result(), при completed запускает отдельный build_content_package_v1. Cancelled/expired не создают пакета. Receipt допуска доступен сразу; admission workflow теперь PENDING до завершения квиза и сборки, это не отказ допуска.

Фиксированное техническое соответствие первого ответа двум темам задаёт JSON fixture; остальные ответы становятся fixture-тегами. У source всегда technical_fixture. Это не решение клиентского квиза и не production-каталог. На admission snapshot фиксируются также policy/catalog, поэтому редактирование файлов не меняет уже принятую сессию.

Старые admission/session workflow не продолжаются новыми шагами и не получают пакет фоновым переносом. Для завершённой legacy-сессии доступен явный POST. Старый admission должен иметь SUCCESS, quiz — SUCCESS и phase=completed. Для нового automatic admission ручное создание запрещено AUTOMATIC_PACKAGE_MANAGED.

## HTTP

| Метод | Путь | Ответ / назначение |
|---|---|---|
| GET | /package-options | {policy,catalogId,catalogVersion,quizResult,automaticFixture:true,limits,limitations}; результат технического первого примера |
| GET | /package-options?sessionId=… | Та же форма, но fixture QuizResult строится по сохранённым ответам именно завершённой session; ничего не создаёт |
| POST | /sessions/{sessionId}/packages | Явный legacy fixture-вход; форма ниже;201 новый receipt,200 тот же запрос,202 pending,409 предметный конфликт |
| GET | /sessions/{sessionId}/packages | {packages:[…]}; для отсутствующего пакета пустой список, без побочных эффектов |
| GET | /packages/{packageId} | {package:…};404 отсутствующий пакет |
| GET | /sessions/{sessionId} | Прежние поля плюс automaticPackage, packageWorkflowStatus, packageNeedsReconciliation, packageReceipt |

packageWorkflowStatus: NONE (legacy без пакета), WAITING_QUIZ, PENDING, SUCCESS, ERROR/CANCELLED/MAX_RECOVERY_ATTEMPTS_EXCEEDED, REJECTED (предметное отклонение сборки). При ошибке package после успешного quiz используются packageNeedsReconciliation и отдельный статус; успешный quiz не становится ошибочным.

```json
{
  "requestId": "fixture-request-1",
  "quizResult": {
    "schemaVersion": 1,
    "quizVersion": "technical-quiz-3-v1",
    "source": "technical_fixture",
    "recommendedThemes": [{"themeId":"sport","score":2},{"themeId":"culture","score":1}],
    "tags": ["Короткие видео"],
    "photo": {"status":"skipped"}
  },
  "policy": {
    "schemaVersion": 1,
    "id": "example-only",
    "version": "1",
    "videos": {
      "enabled": true,
      "themes": {"mode":"all"},
      "count": {"mode":"per_theme","value":2},
      "selection": "random",
      "shortage": "block"
    },
    "generations": {
      "enabled": true,
      "themes": {"mode":"top","count":1},
      "count": {"mode":"per_theme","value":1},
      "recipeId": "fixture-portrait",
      "recipeVersion": "1"
    },
    "order": "by_theme"
  },
  "catalogId": "fixture-catalog"
}
```

Все модели Pydantic strict + extra=forbid. ID: ASCII буквы/цифры, . _ : -,1–128 символов. Принятое фото: status=accepted и обязательный referenceAssetId; skipped запрещает referenceAssetId. Темы уникальны,1–32; tags до32 и128символов. Score — конечное число либо null.

Независимые selectors: all; top/count (score убывает, исходный порядок для равенств); explicit/ids (только темы QuizResult); random/count (подмножество без повторов). Если count тем больше доступного количества, берутся доступные. Нельзя передавать ids для all/top/random или count для all/explicit.

Количество: per_theme/value плюс необязательные perTheme override; total/value распределяется round-robin в выбранном порядке (разница не более1). Значения0–32; верхняя граница запрошенных позиций в local fixture256. Для random с overrides валидатор проверяет худшее подмножество выбранной мощности. Без фото generation-позиции не входят в число запрошенных результатов.

Видео: ordered по порядку каталога или random; уникальные assetId внутри пакета, только approved=true. Shortage=block даёт CATALOG_SHORTAGE в reasons; allow_partial оставляет эту же причину в warnings и сохраняет меньший план. Автоматических дубликатов/замен нет. Порядок by_type: сначала видео, затем generation; by_theme: стабильная группировка по исходным темам; shuffle: перемешанный сохранённый порядок.

## Снимок и готовность

POST при успехе: {package,duplicate,workflowStatus,needsReconciliation}.202: {pending:true,requestId}.409 может содержать detail.code (валидация HTTP-контекста) либо receipt={accepted:false,reason,requestId} (durable предметное решение). Повторяется исходный requestId и полный прежний payload; нельзя генерировать новый ID после неизвестного ответа.

Package: schemaVersion,packageId,packageVersion=1,sessionId,visitId,requestId,createdAtMs,quizResult,quizStateSnapshot,policySnapshot,catalogVersion,catalogSnapshot,selectedThemes,selectionSeed,selectionAlgorithm,items,generationSlots,planReady,ready,reasons,warnings. Item: itemId,kind,themeId,position,required,status,ready. Видео дополнительно assetId/title. Generation: instance,referenceAssetId,recipeId,recipeVersion,jobId=null,resultAssetId=null,status=planned.

planReady означает достаточность разрешённого состава. ready означает готовность обязательных реальных медиа к выпуску. Fixture-видео имеют status=fixture и ready=false с FIXTURE_MEDIA_NOT_DEPLOYABLE. Generation имеет reason GENERATION_PROVIDER_NOT_CONNECTED; задание провайдеру не отправляется. Нет фото — generation-позиций нет, warning GENERATIONS_SKIPPED_NO_PHOTO. Пустой пакет всегда planReady=false с EMPTY_PACKAGE_NO_SCENARIO. PlanReady не является разрешением выпуска/освобождения Стеллы.

Один пакет версии1 на сессию. Новая попытка пересборки — PACKAGE_ALREADY_EXISTS; автоматической перезаписи нет. Изменение содержимого под прежней парой policy id/version или catalog id/version отвергается POLICY_VERSION_REUSED / CATALOG_VERSION_REUSED. Для изменённых файлов поднять version. Это не изменение уже сохранённого пакета.

## Хранение, совместимость и проверки

Используются прежние master.sqlite DBOS и registry.sqlite business, третья БД не добавлена. registry schema1→2 — additive DDL в явной BEGIN IMMEDIATE-транзакции; старые таблицы/данные сохраняются. Receipt, пакет, policy/catalog pins и DBOS datasource checkpoint фиксируются атомарно. Writer lock и UNIQUE ограничивают конкурентные пакеты; фактические выборки сохраняются, retry/restart не перевыбирают.

application_version остаётся local-master-v1 лишь потому, что legacy durable workflow/transaction bodies неизменны. Новые workflow имеют отдельные имена. Это не разрешение будущих несовместимых изменений под прежней версией. Откат старого приложения к schema2 запрещён старым schema gate; полноценный paired backup/restore и production rollout остаются открытыми. Сначала проверка копии/fixture v1→v2, потом применение пользователю.

Тестовые ENV: LOCAL_MASTER_TEST_PACKAGE_CONFIG_DIR задаёт каталог fixture JSON; LOCAL_MASTER_TEST_PACKAGE_BARRIER останавливает новый package workflow после commit, до завершения; marker содержит receipt, отпускание — файл <marker>.release. В обычном launcher эти переменные очищаются. Это не продуктовые настройки и не механизм recovery.

Ограничения среза: только technical_fixture; нет rotation, weights, explicit asset list, межпосетительской дедупликации, запасного каталога, recipe parameters, пересборки, внешней генерации, QR, физических медиа и вывода. Рабочие количества/селекторы задаёт редактируемый JSON; значение2/1 только пример текущего fixture-профиля, не глобальное правило.
