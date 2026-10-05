# Белая сущность Стеллы на LumiCells

Уточнение пользователя 03.10.2026 отменяет предыдущий выбор Ribbon EntityRenderer. Нужен отдельный слой того же LumiCells, более крупные клетки, круги и изменение размера.

## Подтверждённый механизм

- Используется тот же импорт `lumicells/element/define`, что у RingScene: LumiCells 0.1.0, commit `1007717d72cfd9d768d4b9a3f7fc80a126e49c51`. [Репозиторий](https://github.com/supsad/lumicells), [локальный README](lumicells-20260930/upstream/lumicells-1007717d72cfd9d768d4b9a3f7fc80a126e49c51/README.md). GitHub-страницы репозитория/issues сейчас не прочитались через web; выводы опираются на сохранённый код и прежнее исследование, не на выдуманный опыт внедрения.
- `schema.ts`: `grid.roundness=1` даёт круг; count задаёт шаг; gap допустим от0.02 до0.6. `StampPass` использует SDF круглой формы и сглаживание. `modulate('grid.gap')` меняет реальную геометрию клетки через штатный stamp, а не масштаб CSS-canvas.
- В этой ревизии основной stamp один на всю сетку: независимые диаметры каждой клетки не предусмотрены. В текущем небольшом шаге общий диаметр дышит через gap0.60↔0.28, а поле/яркость/разреженность кругов меняются штатным sphere/flicker/sparsity. Это явно общий цикл размера, не новая реализация per-cell частиц.
- Готовый Motion13.5.0 MIT (уже установлен) анимирует число и отдаёт его в ModulatorHandle.set. [Официальный animate API](https://motion.dev/docs/animate): repeat/mirror, onUpdate, pause/play/stop. Цикл3.6с, по1.8с в каждую сторону, easeInOut.
- [Motion issue2046](https://github.com/motiondivision/motion/issues/2046) описывает проблемы ручного учёта времени при остановке useAnimationFrame; здесь применены готовые playback controls без собственного RAF. [Issue3336](https://github.com/motiondivision/motion/issues/3336) сообщает о возможном update после stop; адаптер проверяет флаг live перед обновлением и снимает подписки при уходе. Старый issue не считается доказательством бага текущей13.5.0.

Лицензия upstream LumiCells в package.json — UNLICENSED. В проекте уже есть явное разрешение пользователя на полное использование проекта коллеги: [permission.json](../../artifacts/ribbon/vendor/lumicells/permission.json). Новых библиотек или правок shader/core не добавлено.

## Принятый слой

Белый orb без отверстия, count24 против50 у фона; чёткие круги, слабый halo/bloom, без haze/цветных пятен/поднятых клеток. На логической ширине1080 шаг около45px, диаметр18–32px. Чёрная подложка слоя через CSS screen не перекрашивает основной фон. Маска сообщения и Three/Ribbon импорты исключены. Силуэт человека остаётся отдельным Color Dodge слоем.

Один custom element сохраняется на scanning→particles. Shared LumiCells ticker управляет рендером; paused, скрытие вкладки и reduced motion замораживают оба источника анимации. DisconnectedCallback исходного элемента освобождает GPU-ресурсы. Дополнительный контекст существует только на processing-экранах. Бюджет maxDpr1/maxPixels2 — настройка, не замер GPU.

[Проверка интеграции](../../artifacts/reports/stella-lumicells-entity-20261003.md). GPU и визуальная приёмка остаются за пользовательским кадром по текущему правилу коротких итераций.
