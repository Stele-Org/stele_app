# Радиальная рампа силуэта — 03.10.2026

Цель: силуэт проявляется и стирается от центра синхронно белой сущности, без резкой вставки/удаления SVG.

Готовые механизмы: CSS mask-image с radial-gradient (нативный браузерный механизм), существующий Motion13.5.0 MIT. Дополнительная библиотека или новый шейдер не нужны. [MDN mask-image](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/mask-image) содержит пример мягкой радиальной маски. [MDN radial-gradient](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/gradient/radial-gradient) определяет радиус farthest-corner. [WPT mask + blend](https://github.com/web-platform-tests/wpt/blob/master/css/compositing/mix-blend-mode/mix-blend-mode-mask.html) проверяет совместное применение эффектов. [HTMLImageElement.decode](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/decode) даёт готовность изображения перед показом.

Реализация: img и canvas — соседи в React Fragment; Color Dodge остаётся на img. Один Motion timeline обновляет envelope и CSS mask. Общие центр540,800 и feather180 взяты из существующей рампы Discovery. Проценты stops рассчитаны относительно farthest-corner, а не ширины. При нуле и после erase маска полностью прозрачна. Scan ждёт GPU-ready и decode; исходная прозрачная маска задаётся до первого paint. Ошибка изображения пропускает только его, не блокирует сценарий. Reduced motion сохраняет статичный hold.

Ограничения: mask-image не интерполируется CSS transition; Motion обновляет рассчитанную маску на каждом кадре. Canvas рендерится своим ticker, поэтому точное совпадение paint до одного кадра не гарантируется. SVG, цвет, размеры, контуры сущности и длительность этапа сохранены. [Проверка](../../artifacts/reports/stella-silhouette-ramp-20261003.md).
