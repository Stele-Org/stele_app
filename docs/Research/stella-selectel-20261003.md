# Стелла: публикация на Selectel /df/stela/

03.10.2026. Явный запрос пользователя — выложить текущую standalone Стеллу. Используем установленный Caddy2.11.4 (Apache-2.0) и Vite8.3.1 (MIT), без нового backend или сервиса.

- [Vite Public Base Path](https://vite.dev/guide/build.html#public-base-path): `vite build --base=/df/stela/` переписывает импортированные ресурсы/HTML/CSS. Dev5175 сохраняет прежнюю базу `/stella/`.
- [Caddy handle_path](https://caddyserver.com/docs/caddyfile/directives/handle_path): стандартный strip-prefix + file_server обслуживает статический каталог. Для ограничения host и path используется эквивалентный `handle` с matcher и `uri strip_prefix`.
- Реальный опыт этого сервера: [публикация MAX 30.09](../../artifacts/reports/max-selectel-20260930T073539Z/README.md),200HTTPS SHA и атомарный current. Повторяем существующую схему releases/current в отдельном корне stela; штатные Caddy validate/reload и POSIX symlink/mv реализуют публикацию, нового сервера/механизма маршрутизации нет.

Ограничения: приложение остаётся клиентским прототипом, не удалённым мастером стенда. Отсутствует настоящий голос/камера backend; исходные крупные SVG около27MB. Cache-Control:no-cache обязателен при стабильных именах app.js/index.css. Публичный путь ранее отсутствовал, поэтому у первой публикации нет previous. Проверка доставки по всем SHA не заменяет пользовательский просмотр WebGL. Никакие секреты, исходные исследования или локальные конфиги не входят в пакет.
