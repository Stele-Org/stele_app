# Контентные сущности v1 — применено04.10.2026

Первый срез VK-02B на локальном мастере8782. Белая Discovery не меняется. Один immutable пакет содержит video, generation, result_qr и tag; он проходит прежний исполнительv7 целиком. QR и теги не являются декоративными слоями вне счётчика.

| Вид | Данные | Готовность |
|---|---|---|
| video | Прежние media поля и themeId | Прежняя готовность файла |
| generation | Прежний слот генерации и themeId | Прежняя готовность генерации |
| result_qr | payload.resultPath=/vkshare/result/{encoded packageId} | available/ready; медиа не требуется |
| tag | payload.text из quizResult.tags | available/ready; медиа не требуется |

QR/tag имеют уникальные стабильные itemId packageId:kind:ordinal, position и required:true; themeId им не нужен. QR связан с тем же пакетом. Старые media IDs/порядок сохраняются; дополнительные виды идут после медиа в порядке entity policy. planReady не означает готовое медиа, готовые QR/теги не повышают готовность placeholder видео.

## Настройки и расширение

`artifacts/local-master/configs/content-entity-policy.json`: schemaVersion1, id/version, maxItems<=256, список entities(kind,handlerVersion,enabled,maxCount). По умолчанию1QR и до32тегов. Policy snapshot закрепляется при admission, версия атомарно проверяется/фиксируется в SQLite. Правка требует новой version; начатые сессии и пакеты не меняются. Лимит admission консервативен: возможные media всех тем + максимальные extras. Пустой состав не подтверждает сценарий автоматически.

Backend registry HANDLERS_V1 сопоставляет kind/version строгой Pydantic-модели payload и builder. Добавление вида требует новой версии реестра/компилятора и согласованного frontend handler; неизвестный backend kind отвергается, UI показывает ошибку представления. Это точка расширения, а не готовый произвольный конструктор визуальных видов. Семейства LumiCell/Discovery/MAX-тегов пока не подключены: текущие теги — технические текстовые карточки.

## Совместимость и сценарий

Новые durable admission/session/package workflows v3, package schema4/content-entities-v1. Прежниеv1/v2, compiler/helpers и executorv1–v7 сохранены. Добавлена таблица content_entity_policy_versions; пользовательские записи не переписываются. GETresult schema1 аддитивно выдаёт payload и optionalthemeId. Исторические media-only пакеты остаются прежними.

Discovery по прежним маркерам: presented разрешает выпуск, все элементы полностью появились → erase, затем hidden. QR/теги входят в общий состав. Размер пакета влияет на общую длительность штатной формулой; тайминги фаз не подменены. Выпуск пока последовательный, Стелла освобождается после100% через середину. Группы/параллельный/общий выпуск, доля и другая граница ещё НЕ реализованы.

## Представление и эксплуатация

Единый content-entity-view.mjs обслуживает ленту, стену и result. qrcode-generator2.0.4 MIT работает локально, vendor имеет license/sourceSHA/npm integrity. QR указывает на текущий HTTP(S) origin; localhost не является публичной ссылкой для телефона. Общий публичный URL, TLS, assets/jobs/late-fill и физические экраны отдельно.

Техническая лента mixed-пакета увеличена для читаемого QR120px; прежняя media-only лента сохраняет прежнюю геометрию. Стена показывает первые12 прибывших с явным числом остальных, result показывает весь пакет. Нужен новый квиз после обновления страницы; старые пакеты не пересобираются. Для отката послеv3 — согласованный backup исходников и обеихБД.

[Интеграционная проверка](../reports/content-entities-integration-20261004.md) · [общие требования](../../docs/SCENARIO_ENTITIES_AND_RELEASE.md).
