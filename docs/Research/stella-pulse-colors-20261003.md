# Цвет импульсов LumiCells — 03.10.2026

Применимая версия: supsad/lumicells commit1007717d72cfd9d768d4b9a3f7fc80a126e49c51, уже используемый основной фон Стеллы. package.json: UNLICENSED; права использования — по прежнему проектному разрешению, новой внешней библиотеки нет. [Закреплённое исследование и происхождение](lumicells-20260930/README.md).

Подтверждено первичными локальными исходниками:

- element/data-attrs.ts и element/lumi-cells-element.ts: data-lc-color используется также для pulse с colorMix1. Удалять атрибут неправильно: волна теряет принадлежность кнопке.
- core/controller/controller.ts: публичный PulseRequest поддерживает цвет, mix, strength, speed, width, duration; переключателя запрета смешивания нет.
- core/engine/passes/field.ts: tint/tintW усредняет пересекающиеся цвета; base смешивается с tint; каждый pulse добавляет hotAdd0.1*band независимо от color.hot.amount.
- core/controller/lut.ts и passes/composite.ts: горячая строка LUT осветлена; composite примешивает её к окрашенному pulse. Поэтому настройка hot.amount0 не является полным исправлением.

[Исходный field](https://github.com/supsad/lumicells/blob/1007717d72cfd9d768d4b9a3f7fc80a126e49c51/src/core/engine/passes/field.ts), [composite](https://github.com/supsad/lumicells/blob/1007717d72cfd9d768d4b9a3f7fc80a126e49c51/src/core/engine/passes/composite.ts). Попытка получить актуальную GitHub страницу через web завершилась cache miss; новых upstream исправлений/issues не подтверждено.

Фактический опыт текущей интеграции: AnswerFlight дополнительно генерировал красные pulse от декоративных topic-тегов даже после синего ответа. Нативный pulse сохранён; адаптер теперь передаёт цвет ответа всем его эхам. Это устраняет лишний источник смешивания, но не обеспечивает неизменный hue красной волны на синем фоне.

Пробел готового API явно открыт. Не предлагать просто поднять saturation или снизить hot.amount как гарантированное решение. Полное устранение требует другой поддерживаемой политики композитинга в движке: выбор цвета волны без усреднения с другими цветами и без подмешивания pastel LUT. Такая политика в закреплённой версии не найдена; самописная реализация не начата.

[Проверка интеграции](../../artifacts/reports/stella-pulse-colors-20261003.md).
