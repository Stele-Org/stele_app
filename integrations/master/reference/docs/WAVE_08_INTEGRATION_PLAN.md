# WAVE-08 — параллельная интеграция реальных компонентов

04.10.2026. Статус: **G1 применён; пользовательская приёмка OPEN. Остальные срезы в работе/бэклоге**. Каноническое место документа после публикации: `F:/project/VK_DigitalProducts_Stand/docs/WAVE_08_INTEGRATION_PLAN.md`. Актуальные статусы задач — только [TODO](../TODO.md). Этот документ определяет несколько малых итераций, а не разрешение применить их одной большой сборкой. После каждой установленной итерации — короткая проверка и отзыв пользователя до следующего применения.

## Основание и цель

Принята база WAVE07: server VK, canonical MAX v4, очередь/receipts/пакеты/result, отдельный technical surface-lab. Последний не соединён с бизнес-сценариями. В D независимо продолжаются новые визуалы. Цель: показать реальные результаты серверной Стеллы существующими художественными компонентами, сохраняя серверные правила и пользовательские данные.

Источники: [аудит компонентов](../artifacts/reports/components-current-integration-audit-20261004.md), [WAVE07 runtime](WAVE_07_RUNTIME.md), [исследование ownership](research/shared-surface-owner-wave6-20261004.md), [исследование lab](research/shared-surface-lab-wave7-20261004.md). Используем существующие DBOS/SQLAlchemy, текущие execution-client/executor, Anime, canonical MAX и художественные компоненты. Новый транспорт/очередь/движок не проектируются вместо уже принятых. Если адаптер потребует нового проблемного механизма — отдельное исследование готовых решений до реализации.

## Команда и исключительное владение

Root + три исполнителя интеграции. Текущие компонентные авторы продолжают художественные задачи в своих worktrees; исполнители интеграции не правят их рабочие файлы. На старте каждого среза root фиксирует baseline F и переданный source/build manifest D. Снимок вчерашнего аудита не является автоматически сегодняшней поставкой.

| Владелец | Разрешённая область в отдельном D-кандидате | Результат | Что не меняет |
|---|---|---|---|
| A — Стелла | Принятый `parallel-wave3/stella-candidate` как baseline; `src/features/master/MasterSlice.tsx`, projection/styles/tests; новые `src/features/master-max/*` | Новый UI поверх серверных VK/MAX команд и состояния | Camera/voice/Prototype scoring, shared App/transport, master backend |
| B — визуальный адаптер | Переданный snapshot `native-mask-provider-worktree/artifacts/native-masks`; новые frame/content/scene adapters и назначенный renderer; scoped tests/build | Реальные master frames и typed items вместо fixture driver | Серверные admission/очередь/markers, старый vendor executor, работа автора масок |
| C — MAX presentation | Отдельный candidate от принятого F `artifacts/canonical-max/presentation`; назначенные `journey-v5-*`, paint/style/assets/tests | Подтверждённая визуальная дельта текущего MAX с managed lifecycle | Canonical core/catalog/editor, shared game entry и SessionPort |
| Root — интегратор | Shared contracts, `App.tsx`, game entry/SessionPort glue, execution-client/executor wiring, app/registry/config/DBOS, бизнес-привязка поверхностей, F/docs/TODO | Контракты, единый жизненный цикл, последовательное применение | Не дублирует разработку компонентных визуалов |

Пути MAX: источник `D:/job/production/FUTURONIKA/VK_DigitalProducts/artifacts/workspace/tasks/max-flow-editor-v3-worktree`; новый source Стеллы — `.../tasks/stella-voice-v1/artifacts/stella-prototype`; Native — `.../tasks/native-mask-provider-worktree/artifacts/native-masks`. Основной D runtime и worktree runtime могут различаться. Все передаваемые зависимости включаются в manifest, в том числе доноры вне worktree.

Отдельные ветки/worktrees, fixture-БД, browser storage и незанятые порты назначаются перед кодированием. При невозможности Git worktree — явно обозначенный SHA-кандидат с проверкой исходного baseline, не скрытая общая рабочая папка. Ни один исполнитель не пишет F, не перезапускает8782 и не тестирует на бизнес-данных пользователя. Commit/push/merge автоматически не выполняются.

## Нулевой этап — root, до зависимого кодирования

1. Зафиксировать текущие F API/schema/версии и получить точные D manifests с согласованными файлами. Native уже изменился после аудита: новый smooth-fades отчёт содержит114 inputs, fade-in1500мс/fade-out900мс; прежние SHA/26с gate не использовать как текущие.
2. Записать потребляемые интерфейсы и примеры: Stella definition/snapshot/commands/receipts; VK execution frame, typed package/resources, timing profile; MAX assignment/session/presented; surface composition owner/entry bindings. Имена новых полей и endpoints — предложение до реализации, не выдуманная существующая API.
3. Определить profile/capability pinning и rollout для новых admission. Старые durable histories и frozen profiles не переключать на новые побочные эффекты. Нужны явный drain/совместимость и контролируемое переключение, не общий флаг, незаметно меняющий старые сессии.
4. Разделить свидетельства: подготовка ресурсов, успешный WebGL render/submit и реальный downstream/Spout показ. HTTP202, таймер и надпись демо не подтверждают кадр. Для первой browser-итерации допускается подтверждённый browser render, физический вывод остаётся отдельным gate.

Во время этого этапа A/C могут готовить read-only diff/ассеты, B — перечень входов renderer. Зависимую бизнес-связь реализовывать после фиксации контракта.

## Параллельные срезы

| ID | Работа | Зависимости | Проверяемый результат |
|---|---|---|---|
| ST-1 | Свежие home/onboarding/вопрос/reveal на принятом MasterSlice | Контракт Стеллы + SHA компонентов автора | Admission → answer ACK → реальная анимация → один completion → следующий вопрос; reload/lost response/cancel не считают ответ повторно |
| ST-2 | Остальные вопросы, актуальный Discovery/final и QR результата | ST-1; root согласует visual timing (новые7с не подменяют старые6с молча) | Полный VK без фото, тот же packageId/result URL после reload; сервер освобождает станцию, UI не делает этого самостоятельно |
| ST-3 | Художественные MAX audience/goal/reveal/result | Существующий серверный MAX contract; routing root | Busy → enqueue → release Стеллы + число ожидающих; свободный путь удерживает Стеллу до фактического presented игры. UI не выбирает миссию локально |
| VIS-1 | Внешние frame/clock и lifecycle художественного renderer | Контракт root + актуальный F executor | Один isolated VK: pause/seek/reload/cancel; отказ renderer/context loss запрещает markers; старый owner не подтверждает новый кадр |
| VIS-2 | Typed video/tag/QR/generation placeholders, динамический layout и resource overlay | VIS-1 + реальные package/resource API | Нет15 фиксированных ID; пакет переменного размера; один item проходит pending→ready под тем же ID на ленте/стене/result. Неподдерживаемые типы/ёмкость отвергаются до старта |
| MX-1 | Выделить актуальную visual delta и собрать managed candidate | Переданный manifest MAX + F baseline | Сохраняются assignment/session/auth/no-create/no-select/presented/release. Каталог уже равен; при пустой visual delta срез завершается отчётом, без искусственных изменений |
| MX-2 | Подключить MAX пролог к общему output и игре | MX-1 + business binding root + сцены B | Те же MAX tagId/visibility/orbit → лента → SCREEN_RIGHT → presented → ожидание касания; Discovery отсутствует |
| SYS-7B | Additive real business bindings, arch reservation/admission, semantic ACK guards, legacy drain | Нулевой контракт; root исключительный владелец | Реальные execution/assignment связаны с output owner; технический lab не используется как production API |
| SYS-7C | Несколько ribbon entries и общая задняя композиция | SYS-7B + VIS-2/MX-2 | Старый хвост VK продолжает идти при новой сцене арки; отмена одного пакета не уничтожает другой; общий rear до crop |

ST-1/ST-2, VIS-1/VIS-2, MX-1 выполняются параллельно; root ведёт SYS-7B малыми шагами. ST-3 может готовиться в отдельных файлах раньше ST-2, но общий brand routing применяется последовательно root. MAX пролог рисует B в общей сцене по MAX launch contract; C владеет только игровым presentation и его handshake. Двух реализаций тегов/ленты не создаём.

## Бизнес-правила, которые сохраняем

- VK: `entity_reveal_presented` разрешает выпуск; `emission_complete` означает начало последнего элемента, а не полную видимость; `ribbon_items_visible` разрешает стирание Discovery; `entity_hidden` завершает стирание. Текущий `ribbon_center_crossed` обслуживает release Стеллы, `item_arrived:N` — достижение конца движения, не окончание wall fade. Новые групповые выпуски/процентные рубежи VK-02B ещё открыты: не обещать их готовность и не менять семантику v7 под видом visual port.
- MAX: теги и лента без белой сущности; выход на правую часть, затем отдельный game presented. При занятой игре — FIFO без продуктового лимита, Стелла освобождается после подтверждённой постановки. При свободной — после запуска/показа миссии. Очередная миссия ждёт руку; существующие20/60с и настройки сохраняются.
- Ожидающий MAX получает свободную арку раньше ещё не начатого квиза; активный квиз не прерывается. Root атомарно согласует admission/reservation, а не исправляет гонку приоритетом в UI.
- Один owner композиции, отдельное владение аркой, независимые entries ленты. Освобождение арки не удаляет хвост пакета. Общая задняя поверхность7168×1280 и crop3072/4096 остаются единым доменом.
- Маски/стиль/бизнес-состояния независимы. Полный Native цикл необходим без TD; ручную синхронизацию TD агент не реализует. В этой волне не выдаём Native integration за завершённый TD adapter.

## Порядок совместной приёмки

**G1.** На изолированных данных обновлённая Стелла + один реальный VK execution + художественные арка/лента/стена + персональный локальный result/QR. Сначала без фото, с явно техническим медиаресурсом. Ролик Lulu по решению пользователя остаётся техническим примером, не утверждённым контентом.

**G2.** Две последовательные VK-сессии с пересечением хвостов: новая Стелла после разрешённого рубежа, независимое прибытие/отмена, configurable wall capacity по прежней политике.

**G3.** Художественная MAX Стелла + реальный пролог + managed игра: свободный и занятый путь, очередь, касание, завершение/timeout/следующая миссия. Старт анимации не запускает игровой countdown преждевременно.

**G4.** Смешанный VK/MAX: ожидающий MAX выигрывает свободную арку; текущий квиз не прерывается; хвосты не пропадают; pause/restart/reconnect/stale ACK не освобождают чужую сессию.

Каждый G — отдельная небольшая принимаемая итерация, а не обещание одного общего релиза. Тесты соответствуют изменённым контрактам, короткий IAB-проход подтверждает действие/видимый переход/reload/console. Не подменять изменение состояния доказательством видимого результата. Root сверяет SHA, выполняет backup/проверку совместимости и применяет только принятый набор. Откат новой durable истории не сводится к возврату файлов: старые зарегистрированные workflow остаются доступны, восстановление данных согласованное.

## Следующие независимые контуры и предел готовности

Фото/capture/review/образ уже имеет отдельного владельца и STELLA-PHOTO-AUDIT-13. Не дублировать его и не включать provider молча. В F ещё нет production reference upload/provider, текущий freeze отвергает referenceAssetId. Полный фотопуть требует отдельного контракта/проверки. До него accept честно показывает недоступность/возврат к skip; таймер Discovery не изображает готовую генерацию.

После первого связанного цикла освободившийся исполнитель берёт BE-04 (checkpoint MAX до согласованного1с, durable pending), затем SYS-06 согласованный restore трёх БД/переносимый runtime. Эти долги не блокируют подготовку UI, но ограничивают заявление о полной отказоустойчивости.

Отдельные приёмки: допустимый реальный медиакаталог, публичный результат для телефона, физические камера/ввод, TD/Spout и native pixel map, local/production распределение. Нагрузочные GPU/многомашинные испытания и видео только после отдельного разрешения. Произвольный граф MAX editor, новые игровые зоны, voice и художественная переработка не входят в текущий перенос.

## Передача и отсутствие дублирования

Один владелец/allowlist/task ID; source baseline + SHA/manifest; потребляемая версия F; зависимости/defaults; точный diff; результаты коротких tests/IAB; ограничения и три статуса (технически/визуально/пользователем). Shared docs/TODO/F обновляет только root. Роль интегратора не означает право переписать работающий компонентный worktree. Новые задания оформляются как срезы существующих SYS-07/VK-06/VK-04/MAX/Stella задач, а не второй независимый бэклог.
