# Инструкция агенту Стеллы

Дата сверки: 03.10.2026. Назначение: продолжать разработку интерфейса Стеллы в D и передавать проверенные изменения ведущему интегратору F. Это инструкция по фактическим исходникам, а не подтверждение подключения текущего визуала к новому мастеру.

Общие правила назначения задачи, изоляции и передачи: [AGENT_INTEGRATION_GUIDE.md](AGENT_INTEGRATION_GUIDE.md). Они и корневой [AGENTS.md](../AGENTS.md) обязательны. Само чтение этой инструкции не назначает агенту владение всеми перечисленными файлами.

## 1. Что прочитать перед изменением

1. Последние записи [WORKLOG.md](../WORKLOG.md), свою назначенную задачу и область файлов в [BACKLOG.md](BACKLOG.md).
2. [LOCAL_PAGE.md](../apps/stella-prototype/docs/LOCAL_PAGE.md), [VK_FLOW.md](../apps/stella-prototype/docs/VK_FLOW.md), [RING_INTERFACE.md](../apps/stella-prototype/docs/RING_INTERFACE.md), [DESIGN.md](../apps/stella-prototype/docs/DESIGN.md), [SERVICE.md](../apps/stella-prototype/docs/SERVICE.md).
3. `artifacts/stella-prototype/provenance.json`, `package.json`, `package-lock.json` и исходники затронутого экрана. В app-документах есть последовательные исторические записи: старый таймер, renderer или описание маршрута не имеют приоритета над новым указанием пользователя и проверенным текущим кодом.
4. В F, только для чтения: `docs/VK_ARCH_RIBBON_SCENARIO.md`, `docs/CONTENT_PACKAGE_POLICY.md`, `docs/MASKS_INTEGRATION_ARCHITECTURE.md`, текущий `TODO.md`; контракты `artifacts/contracts/local-admission-v1.md`, `arc-tags-v1.md`, `content-package-v1.md`, `vk-ribbon-release-v1.md`, `early-plan-result-v1.md`. Последний описывает отдельный неприменённый кандидат; не считать его доступным API рабочего экземпляра.
5. Перед визуальной работой — проектные skills `vk-visual-reference-gate`, `vk-live-verification`; для свечения `vk-webgl-neon`, для MAX также `max-brand`. Перед изменением/проверкой общего мастера — `vk-master-startup`. Открывать конкретные `artifacts/skills/<имя>/SKILL.md`, а не угадывать ограничения.

## 2. Карта исходников и область ответственности

| Область | Фактический путь | Правило работы |
|---|---|---|
| React/Vite приложение | `artifacts/stella-prototype/src/app/App.tsx`, `src/pages/PrototypePage.tsx` | Основной исходник UI в D |
| Текущая локальная последовательность экранов | `src/features/prototype/Prototype.tsx`, `src/types/prototype.ts` | Сейчас самостоятельная анкета; при адаптации отличать локальную презентацию от серверного бизнес-состояния |
| Вопросы, ответы, локальный расчёт | `src/content/vkVideo.ts`, `src/content/max.ts`, `src/features/prototype/logic.ts` | Совместимость standalone сохранять; для master-mode значения и результат получать от F, новый независимый расчёт не создавать |
| Локальные события | `src/features/prototype/events.ts` | CustomEvent/BroadcastChannel, не транспорт к мастеру |
| Экраны и анимации | `src/components/`, `src/features/prototype/tag-reveal.ts`, `tag-layout.ts`, `timed-transition.ts`, `question-presentation.ts`, `product-entry.ts`, `ring-cue.ts` | Визуальная область агента при назначении конкретных файлов |
| Белая сущность | `src/components/WhiteEntity.tsx`, `white-entity-renderer.ts`, `white-entity-envelope.ts`, `white-entity-config.ts` | Отдельный слой; изменения общего движка согласовать с визуальным агентом |
| Авторская хореография | `src/vendor/lumicells-scene/` и её `provenance.json` | Сохранять происхождение и лицензионные notices |
| Общий renderer | `artifacts/ribbon/vendor/lumicells/src` через alias `lumicells-project` в `vite.config.ts` | Зависимость нескольких компонентов, не единоличная собственность агента Стеллы |
| Пауза service-host | `src/service.ts` | Сохранять origin/source-проверку, блокировку ввода и готовность ресурсов |
| Ассеты и стили | `src/assets/`, `src/styles/global.css`; брендовые источники `artifacts/DESIGN/BRANDS/` | Исходные клиентские материалы и общий брендовый пакет не менять без отдельного назначения |
| Runtime старого стенда | `apps/stella-prototype/` | Сборочный результат, не основной исходник; не обновлять в визуальной итерации автоматически |
| Backend нового мастера | `F:/project/VK_DigitalProducts_Stand/artifacts/local-master/stella_*.py`, `configs/stella-vk.json`, `panel-client.mjs` | Только чтение; изменения через интегратора |

Запрещены параллельные правки `Prototype.tsx`, общих визуальных vendor-модулей или `global.css` двумя исполнителями без предварительного разделения. Изменение обеих веток VK Видео/MAX в одном компоненте требует согласования с владельцем MAX. Агент Стеллы не присваивает себе игровой backend MAX.

## 3. Что реально работает, а что ещё нужно связать

**В D работает отдельная визуальная анкета.** `http://localhost:5175/stella/` — Vite-страница с hot reload, своим состоянием и перезапуском квиза при reload. `App.tsx` открывает `PrototypePage`. В текущем `Prototype.tsx` и `events.ts` нет подключения к HTTP API `stella-vk-v1`. Успешное прохождение этой страницы не доказывает admission, запись результата, очередь MAX или выпуск контента в F.

Текущий standalone рассчитывает веса первых двух вопросов VK Видео, использует случайное разрешение равных оценок и `rankedThemes.slice(0,3)` в событии рекомендации. **Эту историческую локальную модель нельзя переносить как бизнес-истину нового мастера.** В F закреплены определение квиза, seed/приоритеты, положительные темы-кандидаты и изменяемая политика пакета. Число видео/генераций и выбор тем задаёт мастер; на клиенте нельзя фиксировать «три темы», «два видео» или «фото на каждую тему».

**В F реализован серверный VK-квиз и техническое представление его состояния.** Фактические файлы: `stella_api.py`, `stella_models.py`, `stella_domain.py`, `stella_workflows.py`; рабочий клиент-пример — `panel-client.mjs`. Некоторые docstring всё ещё содержат «candidate»: статус выяснять по интеграционному отчёту/версии экземпляра, а не по одной строке файла. Художественный React-интерфейс D ещё не становится клиентом F автоматически.

На дату сверки камера, загрузка reference и генерация в этой ветке не подключены. Согласие на фото означает намерение; `capture_unavailable` честно обозначает тест без снимка. QR из локального макета не является персональным result URL. Ранний plan/result хранится отдельно как проверенный, но неприменённый кандидат; полный сценарий Discovery и автоматическая связь с лентой не объявляются готовыми.

## 4. Реальные протоколы и целевой адаптер

### Существующий standalone-контракт

`events.ts`: событие DOM `vk-stela:event`, BroadcastChannel `vk-stela`. Envelope: `version:1`, `sessionId`, `sequence`, `occurredAt`. Типы: `session-start`, `answer`, `answer-cleared`, `vk-recommendation`. Это локальное уведомление; у него нет серверного ACK, durable replay, admission и межмашинной доставки. `sequence` не является ревизией мастера, `occurredAt` не задаёт общие часы стенда. BroadcastChannel ограничен origin.

`service.ts`: при `?service=1` принимается сообщение `stella-service-state` с boolean `playing` только от `parent` того же origin. Это пауза старого host, а не новый протокол квиза. Готовность `data-service-ready` после fonts/images не подменяет готовность GPU: worker отдельно ждёт успешно отрисованный кадр.

### Существующий HTTP-контракт F

| Операция | Реальный endpoint/форма |
|---|---|
| Определение | `GET /stella/vk/definition` — protocol, quizVersion, copy, themes, вопросы/идентификаторы вариантов |
| Допуск | `POST /stella/vk/admissions` — `requestId`, `visitId`, `sessionId`, `stationId:"stella-main"`, `durationMs`; использовать ограничения модели F |
| Состояние | `GET /stella/vk/sessions/{sessionId}` — snapshot с `state` и серверным `view`; существующий panel-client также читает общий `GET /sessions/{sessionId}` |
| Команда | `POST /stella/vk/sessions/{sessionId}/commands` — `commandId`, `expectedRevision`, `kind`, допустимые `questionId`/`answerId` |
| Сверка результата | Существующие `GET /admissions/{requestId}` и `GET /sessions/{sessionId}/acks/{commandId}`; правила в `panel-client.mjs` |
| Арка | `GET /stella/vk/sessions/{sessionId}/arc` — отдельная read-only проекция `arcTagsV1`; не вычислять арочные теги заново в Стелле |

Текущие `kind`: `begin`, `answer`, `back`, `presentation_complete`, `photo_choice`, `photo_skip`, `capture_unavailable`, `pause`, `resume`, `cancel`. Команда ответа передаёт идентификаторы, **не** самостоятельно вычисленные weights, tags, scores или nextState. Разрешённые варианты/действия брать из `view`; сверять session, instance и revision. При неизвестном исходе сохранять исходный commandId/payload и читать receipt, а не создавать второе действие. Отказ, offline, старая ревизия и смена сессии не означают успешного перехода.

`presentation_complete` уже существует для `answer-reveal`, `photo-reveal`, `scanning`, `particles`. При адаптации отправлять его после реального завершения относящейся к текущему snapshot презентации; dispose, Back, pause, смена session/revision не должны отправлять старый callback. Двойной рендер React и повторный HTTP не должны удваивать бизнес-переход. Не посылать это событие одновременно из таймера и completion анимации.

**Предлагаемый следующий срез, пока не реализация:** выделить из `Prototype.tsx` отображение server snapshot и адаптер команд, сохранив standalone как явно помеченный fixture-режим. Сначала связать один ответ → его визуальный reveal → подтверждённый следующий вопрос. Не переносить целиком UI технической панели или её локальный storage без сверки; использовать её как фактический пример правил pending/ACK. Протоколы для реальной камеры, photo upload и MAX-ветки Стеллы согласовать с интегратором отдельно. Контракт игрового `max-assignment-v1` не означает, что локальный `getMaxMission()` уже подключён к очереди/мастеру.

## 5. Что сохранить в визуале

- Текущие брендовые экраны и утверждённые ассеты; постоянные main/VK header, native-кнопки и существующую авторскую хореографию ответов/групп тегов. Дизайн менять только в рамках конкретного запроса, не ради удобства серверного адаптера.
- `WhiteEntity` — отдельный LumiCells/CUBES canvas; свой procedural envelope, индивидуальные клетки, scan/generation. На дату сверки scan использует 5.2 с, generation 6 с, reveal/hold/erase и Motion completion. Это текущие локальные длительности, не универсальные тайминги мастер-сценария.
- Начало после GPU-ready; scan также ждёт decode силуэта. Color Dodge у силуэта, reveal/erase его маски, скрытие после erase. Сохранять pause, document.hidden, reduced motion, корректный dispose и обработку ошибок. Общий renderer не пересоздавать без необходимости между этапами.
- Белую сущность не заменять отбеливанием всего фона. Система масок F описывает отдельный слой сущности; planned markers и новая архитектура масок не становятся доступным API только из-за записи в документе.
- Нельзя выпускать содержимое ленты, освобождать Стеллу или занимать MAX по локальному `setTimeout`. Эти решения принадлежат F; агент сообщает завершение поддерживаемой презентации, мастер принимает переход.

## 6. Изолированная проверка и сборка

До кода получить task ID, владельца файлов, worktree/ветку, baseline commit или SHA, тестовый порт и scope. Не создавать worktree так, чтобы потерять необходимые незакоммиченные изменения исходной папки; основу согласовать с интегратором. Git staging/commit/push/merge требуют предусмотренного AGENTS разрешения.

В `artifacts/stella-prototype` есть команды `npm run typecheck`, `npm test`, `npm run lint`, `npm run build`; зависимости закрепляет `package-lock.json`, требование `engines.node >=24`. Установка — `npm ci --ignore-scripts` в своём окружении, не поверх используемого другим агентом `node_modules`. Выбирать проверки по изменению, не запускать тяжёлые GPU-тесты под видом unit-тестов.

В актуальном `vite.config.ts` порт **5175 фиксирован** и `strictPort:true`; этот порт не зарезервирован автоматически за новой задачей. Существующий `Start-Local.bat` относится к отдельной пользовательской странице. Новый исполнитель не перехватывает её процесс: изолированный Vite запускается на назначенном свободном порту из своей копии. Базовый путь `/stella/` и относительные alias должны разрешаться в его worktree. Не выставлять filesystem allow на весь D или secrets.

Минимальный набор для адаптера: accepted answer, повтор/двойной клик, Back с отменой предыдущего reveal, pause/resume, reload, offline/неизвестный ACK, stale revision, cancel/новая session, ошибка GPU и отсутствие фото. Fixture-сервер и БД изолированы; чтение/изменение посетительских данных недопустимо. В браузере проверить затронутую ветку, видимый результат и console; отдельно отметить технический PASS, визуальную самопроверку и ожидание пользовательской приёмки.

Для санкционированной интеграции в старый D runtime: сначала `python artifacts/web/tools/check_project_duplicates.py`, далее `python artifacts/web/tools/build_stella_prototype.py`; `build_service.py` нужен при изменении host/service, `build_bundle.py` — при изменении Viewer. Не собирать все приложения «на всякий случай». Локальная визуальная правка на Vite не требует автоматического обновления `apps/`. Запуск/остановка общего D мастера — только по `vk-master-startup`; F и Selectel агент Стеллы не обновляет.

## 7. Передача интегратору

Передать одну небольшую итерацию с:

- task ID, точными изменёнными путями, baseline и итоговым commit либо SHA-256 файлов, сохранёнными пользовательскими изменениями;
- режимом проверки: standalone fixture / isolated F adapter candidate / accepted integration; не смешивать статусы;
- поддерживаемыми версиями `stella-vk-v1` и зависимых контрактов, схемой входного snapshot и отправляемых команд; расхождения/требуемые расширения отдельно;
- source provenance, обновлением lockfile, версиями/лицензиями новых зависимостей; изменёнными defaults, ассетами и миграциями;
- проверенными сценариями, командой/окружением теста, адресом изолированной страницы, console-результатом и ссылкой на отчёт в `artifacts/reports/`;
- границами художественной приёмки, известными пробелами и последовательностью применения/отката без потери данных.

Документацию своей функции обновлять в `apps/stella-prototype/docs/` только в назначенных файлах. Изменения общих D документов и WORKLOG передавать владельцу текущей координации, если они заняты. F `TODO.md`, backend, контракты, сборку и данные меняет только ведущий интегратор мастера. Новая визуальная ветка D не заменяет принятую F-версию до явной интеграции.
