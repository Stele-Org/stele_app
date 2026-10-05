# Discovery cycle v1 — технический локальный мастер

04.10.2026 — новые Discovery показы используют [wall-items-v1](vk-wall-items-v1.md): поэлементные arrivals, all_arrived только проверяет полноту; старые v1–v6 сохраняют описанную ниже полнопакетную доставку. Новый профиль fixture-discovery-compact/2, executor v7. Исторические ограничения ниже относятся к прежнему срезу.

Применено 04.10.2026. Health: `discoveryCycleProtocol=discovery-cycle-v1`, `stellaVkEarlyPlanProtocol=stella-early-plan-v1`.

## Источник и области ответственности

Реальная серверная логика квиза сохраняется в F; браузер выбирает только действия, разрешённые текущим view. Ранний immutable video-пакет создаётся при skip фото либо техническом начале scanning/camera_skip. До этого ответы и согласие на фото не запускают ленту. Настоящая камера и генерации не подключены; согласие без снимка не создаёт фиктивный referenceAssetId/генерации.

Мастер принимает новый durable executor v6 в `discovery_store.py`; зарегистрированные v1–v5 и их snapshots сохранены. Profile `fixture-discovery-compact/1` основан на Anime.js4.5.0. В `configs/execution-profiles.json` задаются lead/stagger/travel/easing, revealMs1200, eraseMs900, itemRevealMs350, presentedMs1; параметры замораживаются в execution. Изменение профиля требует новой версии.

## Один execution и его рубежи

| Маркер | Значение |
|---|---|
| entity_reveal_presented | Technical DOM обновлён ненулевым reveal; разрешён выпуск |
| emission_complete | Начало появления последней карточки, прежняя семантика сохранена |
| ribbon_items_visible | Последняя карточка полностью проявлена; начало стирания сущности |
| entity_hidden | Сущность скрыта, цикл Discovery на арке окончен |
| ribbon_center_crossed | Все карточки прошли середину; после completed квиза освобождается только его station binding |
| all_arrived | Все карточки прибыли; тот же packageId/itemId доставлен на техническую стену |

Маркеры упорядочены по actual Anime timing, не по жёсткому перечислению: длительности могут менять взаимный порядок center/erase/arrival. Финальная длительность — максимум прибытия и окончания erase. Checkpoint не перескакивает неподтверждённый семантический барьер. Presented подтверждает только технический DOM fixture, **не GPU, TD, Spout или физический экран**.

Новые Discovery executions стартуют с desired=running и phase=preparing: ready → started без ручной кнопки запуска. Авторун требует раннего плана; старые completed-only manual profiles не изменены. Семантическая идемпотентность на packageId запрещает повтор даже с новым requestId и после отмены/завершения. Пакет с прежним legacy execution автоматически не переигрывается. Параллельно остаётся один fixture executor; следующий готовый пакет ждёт его освобождения.

## Панель и восстановление

Панель показывает теги, отдельную белую клеточную схему reveal/hold/erase, карточки пакета, шесть подтверждённых рубежей и стену. Выборы квиза, согласие и камера остаются ручными. Только владеющая renderer вкладка после принятого presented автоматически завершает post-freeze технические presentation этапы photo-reveal(skip), scanning, particles. Это frontend adapter технического мастера, не автономный production runner.

`POST /executions/{id}/sync-session` принимает requestId и expectedControlRevision. Registry quiz paused приостанавливает execution, cancelled/expired отменяет; resume восстанавливает только quiz-driven паузу, не ручную паузу показа. Неизвестный ответ сохраняет исходный запрос. Окончательный matching conflict требует fresh GET; новый sync intent допустим только по всё ещё актуальному registry состоянию. GET не пишет в историю.

После reload прежние position/profile/timing/markers восстанавливаются; автоматического захвата owner нет. Нужна явная кнопка «Передать управление этой вкладке», затем продолжение при ручной паузе. После backend restart сохраняются обе БД. Отмена показа скрывает локальную схему и карточки; пакет автоматически не запускается повторно. Отмена показа до центра сама по себе не освобождает станцию: активный квиз отменяется своим действием, завершённая сессия — операторским закрытием.

## Ограничения

Сейчас стена принимает весь пакет по all_arrived, не по отдельным item-arrival. Native/TD маски, canonical D Discovery, реальные assets/jobs/late-fill, QR/public host, production clock/renderer supervisor и параллельные исполнители ещё не подключены. Потеря/скрытие владельца и BFCache остаются BE-09/BE-13. Проверки: [интеграционный отчёт](../reports/sys06-discovery-integration-20261004.md).
