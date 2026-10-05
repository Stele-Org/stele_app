# Рабочий процесс в локальном репозитории

Действует с 05.10.2026. Правила агента — в корневом [AGENTS.md](../../AGENTS.md), статус — в [CURRENT_STATE.md](CURRENT_STATE.md).

## Инструменты

| Инструмент | Версия | Где |
| --- | --- | --- |
| Node.js | 24.21.0 | `.tools/node`, скачивается скриптом, в git не попадает |
| npm | 11.19.0 | в составе Node.js |
| Gitleaks | 8.30.1 | `.tools/gitleaks` |
| Git | 2.48+ | системный |

Приложению нужен Node.js 24+. Системный Node.js на машине разработчика может быть старше: все команды идут через `scripts/stella.ps1`, который берёт Node.js из `.tools`. Архивы сверяются по SHA256 из `scripts/setup-tools.ps1`. Чтобы обновить версию, поменяйте там адрес и SHA256.

## Команды

Из корня проекта, PowerShell:

| Команда | Что делает |
| --- | --- |
| `.\scripts\stella.ps1 setup` | Скачивает инструменты, выполняет `npm ci --ignore-scripts`, включает git-хуки. Повторный запуск безопасен. |
| `.\scripts\stella.ps1 dev` | Dev-сервер Vite: http://127.0.0.1:5218/stella/ |
| `.\scripts\stella.ps1 typecheck` | `tsc -b` |
| `.\scripts\stella.ps1 test` | Все тесты Vitest. С аргументом — один файл: `test src/components/AnswerFlight.test.tsx` |
| `.\scripts\stella.ps1 lint` | ESLint |
| `.\scripts\stella.ps1 build-check` | Проверка типов и сборка в `.cache/build-check`. Папку `dist` не трогает. |
| `.\scripts\stella.ps1 smoke` | Смок-тест без браузера, см. ниже |
| `.\scripts\stella.ps1 design` | Прототипы Claude Design: http://127.0.0.1:5219/ |
| `.\scripts\stella.ps1 verify-dist` | Сверка `dist` с принятым манифестом сборки |
| `.\scripts\stella.ps1 verify-package` | Сверка рабочих файлов с `PACKAGE-MANIFEST.json`: показывает, что изменено относительно полученного пакета |
| `.\scripts\stella.ps1 secrets` | Gitleaks по рабочим файлам и по истории git |
| `.\scripts\stella.ps1 build` | Сборка в `dist`. После неё принятый манифест и pin стенда перестают совпадать с `dist`. |

## Смок-тест

`smoke` выполняет проверку типов и сборку в `.cache/build-check`, затем `scripts/smoke.mjs`:

1. поднимает настоящий dev-сервер Vite на свободном порту от 5290 и запрашивает стартовую страницу в локальном режиме и с `?master=1`;
2. обходит по HTTP весь граф модулей приложения от `src/main.tsx` и требует ответ 200 на каждый;
3. запрашивает выборку файлов из `public` и сверяет размер;
4. проверяет, что собранный `index.html` ссылается на существующие файлы, и сообщает, сколько файлов сборки побайтно совпало с принятой;
5. проверяет страницы прототипов: локальные ссылки и синтаксис скрипта.

Браузер, камера, MASTER и AI не используются. Смок-тест не заменяет визуальную приёмку: её делает пользователь.

## Папка dist

`dist` — принятая сборка STELLA-CAMERA-ROTATE-01, на неё ссылается pin в `integrations/stand`. По исходному `.gitignore` она не версионируется, эталон лежит в исходном архиве пакета. Для проверок используйте `build-check`. Команду `build` запускайте, только когда нужна новая сборка для передачи интегратору.

## Git

- `main` — принятое состояние. Тег `baseline/stella-camera-rotate-01` — пакет в том виде, в каком он получен.
- Работа идёт в ветках `codex/<тема>-<ггггммдд>` от `main`.
- Перед коммитом: `typecheck`, тесты по затронутой области, `build-check`. Перед слиянием в `main`: `smoke`.
- После изменений обновить `CURRENT_STATE.md` и `WORKLOG.md`. Исследования — в `docs/Research`, фактические проверки — в `artifacts/reports`.
- Версии помечаются тегами `vX.Y.Z` на `main`.
- Удалённого репозитория нет. Push, деплой сайта и изменения на стенде — только по отдельному поручению.

### Хуки

`setup` включает `core.hooksPath=.githooks`:

- `pre-commit` — Gitleaks по файлам, добавленным в коммит;
- `pre-push` — Gitleaks по рабочим файлам и по всей истории, как требует AGENTS.md.

Найденный секрет нельзя глушить общим исключением: сначала разобраться. `.gitleaks.workdir.toml` исключает только скачанные каталоги `node_modules`, `.tools`, `.cache`.

### Что не попадает в git

Секреты и `.env`, `node_modules`, `dist`, `.cache`, `.tools`, базы SQLite, журналы `jsonl` и `log`, реальные фото и аудио посетителей. Полный список — в `.gitignore`.

## Известные отклонения базового пакета

Зафиксированы 05.10.2026 на неизменённых исходниках, подробности — в [отчёте](../../artifacts/reports/project-setup-20261005.md):

- 2 из 304 тестов не проходят: `src/app/App.camera.test.tsx` и `src/app/ContentReady.test.tsx` ждут прежний запрос камеры, а код уже выбирает BRIO по `deviceId`.
- ESLint: 12 ошибок правил `react-hooks` в трёх файлах `features/master` и `features/master-max`, 2 предупреждения.
