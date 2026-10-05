# Изменения при выделении репозитория

Только копия; исходные D/F/сайт не менялись.

- Сохранён layout artifacts/stella-prototype и siblingassets. Включены обе LumiCells src, discovery-cutout.js и cubes-art.js/json. Все обязательные imports собираются без обращения к внешним D/F каталогам.
- Voice credentials: STELLA_CREDENTIALS_DIR или local repo/secrets/secrets/AI; STELLA_PYTHON или python. Это server-only, секретов в repo нет. Python нужен только ручным credential/TTS инструментам; обычный UI без него работает.
- Diagnostics: STELLA_DIAGNOSTICS_DIR или local ignored artifacts/workspace/stella-diagnostics. Исторические absolute paths в отчётах не менялись.
- probe-tools использует import.meta.url; ws8.22.0 закреплён как direct dependency. Probe и TTS не запускались при переносе, поскольку они могут обращаться к провайдеру.
- Windows launcher приведён к5196, как текущий Vite. Старые LOCAL_PAGE/README внутри app сохраняют исторический5175; актуальный запуск описан в корневомREADME.
- Mastercandidate vite/tsconfig привязаны к repo-relative root. Его historical HTTP/baseline helpers требуют исходный Fmaster и помечены отдельно.
- npm зависимости восстановимы из lockfiles; node_modules/dist/cache не версионируются. Для Vitest5 выбирать Node24LTS или26+, а не25. На имеющемся25.9.0 сборки прошли, npm показал enginewarning.

Первый полный тестовый прогон:306/308PASS. Два существующих ожидания OnboardingScreen.test.tsx устарели: проверяют lowercase«поехали» вместо текущего«ПОЕХАЛИ» и пытаются SSRrender browser-only Prototype безwindow. Исправление поведения/тестов не включено в выделение репозитория; сохранена честная диагностика. Сборка standalone и mastercandidate PASS.

Mastercandidate: отдельный Node-runner7/7PASS (snapshot/ACK/reload/QR). Общий исторический `npm test` содержит143/147PASS и2runnererrors: старый preload17vs19, те же2onboardingожидания, старый mockсилуэта, Node-tests ошибочно обнаруживаются Vitest. Эти inheritedtests сохранены, зелёный полный прогон не заявляется. Для HTTPинтеграции необходим внешний master; она при экспорте не запускалась.
