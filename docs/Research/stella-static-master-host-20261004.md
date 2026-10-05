# Доставка реального интерфейса Стеллы с origin мастера

2026-10-04. Выбрана уже установленная FastAPI0.142.2 / Starlette1.7.0 StaticFiles, без новой реализации файлового сервера или установки пакетов. FastAPI — MIT; Starlette — BSD-3-Clause. Статический mount регистрируется после существующих /stella/vk и /stella/max API, принимает точный Vite dist под /stella/. Master mode вызывается query master=1; API использует тот же origin. В DEV Vite использует отдельный фиксируемый env proxy.

Источники:

- [FastAPI Static Files](https://fastapi.tiangolo.com/tutorial/static-files/) — готовый mount StaticFiles.
- [Starlette StaticFiles](https://www.starlette.io/staticfiles/) — directory, html, check_dir, follow_symlink и HTTP404/405.
- [Практическое обсуждение FastAPI8174](https://github.com/fastapi/fastapi/discussions/8174) — зависимость относительного static path от cwd; в реализации путь берётся от __file__.

Риски: стабильные Vite app.js/css имена могут оставлять старый bundle в кеше; thin subclass только ставит Cache-Control:no-store. Нетбуфера/reverse proxy/кастомногоresolver. Нет автомиграции standalone scoring: отдельный master entry подключает существующий SHA-pinned panel-client. Статическая доставка сама по себе не решает ownership презентаций, durable pending и реальный захват/голос. Эти части проверяются отдельно.

Фактическая проверка использовала реальные Uvicorn HTTP sockets, API precedence, MIME, cache,404/405, traversal и missing-directory startup. [Интеграционный отчёт](../../artifacts/reports/parallel-wave2-integration-20261004.md). Подтверждён только локальный loopback; production network/auth не заявляются.
