> Исторический документ. Актуальный статус пакета и запуск — в корневом README.md.

# Стендовый интерфейс Стеллы — 05.10.2026

`stella-candidate/` — единый новый кандидат `0501.2-стенд`: основа STELLA-DESIGN-SYNC-05 / STELLA-AUDIO-02, прежние исправления `0410upd` и новая механика карточек. Историческое имя папки сохранено. В серверном режиме этот UI управляется общим мастером: VK/MAX snapshot, commands, revision, ACK, фото, очередь и результат. `artifacts/stella-prototype` сохранён как источник прежних правок. Полный состав: [UNIFIED_BUILD.md](UNIFIED_BUILD.md).

Node.js >=24. Из корня репозитория:

```sh
npm --prefix integrations/master/stella-candidate ci --ignore-scripts
npm --prefix integrations/master/stella-candidate run typecheck
npm --prefix integrations/master/stella-candidate test
npm --prefix integrations/master/stella-candidate run build
```

`dist` содержит оба режима одного приложения. `verify-build.mjs --seal` предназначен для сверки прежней установленной версии с её pin; новая объединённая сборка закономерно отличается. Старый accepted manifest не переписывается и новый кандидат не объявляется установленным. Новый пакет включает отдельный candidate-manifest и аудиокаталог с SHA; принятие и установка выполняются вместе с центральным MASTER.

STELLA_MASTER_TARGET — loopback API совместимого изолированного мастера; dev-порт5218, /stella/?master=1. Backend/БД/ключей здесь нет. Без backend интерфейс не подменяет реальный сценарий демонстрацией. Голосовой AI и платная генерация для проверки не включаются.

Общая камера открывается при старте и сохраняется между экранами. Hero-карточка и AnswerFlight показывают один поток с контуром Discovery. Передача фото сохраняет согласие, captureRef, revision и защиту повторной отправки. Нативный kiosk и audio bridge находятся в [integrations/stand](../stand/README.md).

reference/accepted-build-manifest.json — принятый runtime. installed-source-manifest.json — исходный provenance сборки на стенде; абсолютные пути там исторические. repository-source-manifest.json описывает переносимый исходник: изменены только пути в Vite/TypeScript. Старые контракты в reference/contracts сохранены как история; актуальные протоколы необходимо сверять с мастером перед новой интеграцией.

Визуальную приёмку выполняет пользователь. Технические проверки запускаются без браузера; слышимость/точность касаний и новый платный фотосценарий здесь не заявлены проверенными.
