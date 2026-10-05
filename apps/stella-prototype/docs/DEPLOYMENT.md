# Публикация Стеллы

04.10.2026 — текущий релиз **20261004T143212Z** на https://futuronika.pro/df/stela/: текст экрана согласия скрывается при запуске фото-reveal. [Проверки и кадр](../../../artifacts/reports/stella-selectel-20261004T143212Z/README.md). Предыдущий20261004T141956Z сохранён; источник тот же worktree stella-voice-v1, AI выключен.

04.10.2026 — актуальная публикация: **https://futuronika.pro/df/stela/**, релиз `20261004T141956Z`. Источник — `artifacts/workspace/tasks/stella-voice-v1/artifacts/stella-prototype`, порт разработки5196; предыдущий релиз сохранён. [Отчёт](../../../artifacts/reports/stella-selectel-20261004T141956Z/README.md): 27/27 профильных тестов, build и HTTPS59/59SHA PASS, короткая IAB-проверка. AI отключён, камера запрашивается со старта; публикация остаётся standalone. Новые package/verify scripts: `artifacts/workspace/tests/stella-selectel-20261004T141956Z/`. Ниже — история предыдущей публикации и общий порядок.

04.10.2026 — По новому прямому запросу пользователя опубликована текущая standalone Стелла с актуальным UI/Discovery и записанной озвучкой Василисы. Исторический финал предыдущего этапа20261003T134547Z сохранён для отката. [Резерв исходников предыдущего этапа](../../../artifacts/reports/stella-background-iteration-20261003/baseline.json).

Текущий Selectel: **https://futuronika.pro/df/stela/**, релиз `20261004T064616Z`,04.10.2026. [Проверка](../../../artifacts/reports/stella-selectel-20261004T064616Z/README.md). Это standalone вариант, не комплект мастера/TD. Живой диалог Qwen-Omni этой публикацией не добавлен.

Сборка из `artifacts/stella-prototype`: `npm run build -- --base=/df/stela/ --outDir ../workspace/dist/stella-selectel/<UTC> --emptyOutDir`. Локальный Vite по-прежнему использует `/stella/` и5175. Публикуется только статический output плюс SHA256SUMS/release.json, включая лицензионные уведомления; src/docs/credentials не передаются.

Selectel SSH: существующий профиль `C:/Users/futuronika_ai/.ssh/selectel-vidrs.conf`, host `selectel-vidrs`, BatchMode и StrictHostKeyChecking=yes. Ключи не читать/не копировать в сборку. Релиз загружается в новый `/srv/projects/futuronika/df/stela/releases/<UTC>`. Активация — `sudo sh activate-selectel.sh <UTC>` из `artifacts/stella-prototype/scripts/activate-selectel.sh`; ограничена hostname vidrs-prod-01 и корнем stela. Проверяет SHA, принадлежность current/route, Caddy validate, атомарно переключает current, выполняет reload. Соседние маршруты не редактируются.

Маршрут `/etc/caddy/sites-enabled/df-stela.caddy` ограничен host futuronika.pro и `/df/stela/*`; Cache-Control:no-cache нужен из-за стабильных имён JS/CSS. HTTPS после активации сверяется по каждому файлу release manifest, а не только статусу index. Текущие package/verify scripts — `artifacts/workspace/tests/stella-selectel-20261004/`; allowlist дополнен только `voice/vasilisa/*.wav` и голосовым manifest.json. Исходные записи, voice tooling и credentials не публикуются.

Откат последующих релизов: вернуть current на предыдущий проверенный каталог через временный symlink и `mv -T`, сохраняя оба релиза. Для первой публикации previous отсутствует: перенести только df-stela.caddy из sites-enabled в каталог stela, выполнить validate/reload; каталог релиза и current сохранить. Не удалять общие маршруты/серверные файлы. Новые публикации требуют отдельного пользовательского запроса.
