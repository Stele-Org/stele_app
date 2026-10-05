# Реальная Стелла: полный VK-квиз в мастере

Принят04.10.2026, WAVE-03. Вход http://127.0.0.1:8782/stella/?master=1. Срез «один ответ» WAVE-02 расширен: все серверные VK-вопросы и reveal → выбор фото → skip или честный экран неподключённой камеры → WhiteEntity → final со ссылкой на текущий result. MAX в этом UI ещё не подключён: технический вход /max.

Backend владеет вопросами/тегами/пакетом и ACK. Panel-client сохранён побайтно, pending isolated namespace, receipt/reload остаются прежними. Reload восстанавливает серверный экран; reveal начинает локальную анимацию заново, точный кадр не сохраняется. Пауза/продолжение/отмена доступны в технической полосе. После freeze пакет неизменяем, Back запрещён. Нового посетителя UI допускает только после backend station release; final сам не освобождает Стеллу, рубеж ленты сохраняется.

Камера не подключена: согласие не является снимком, нет synthetic capture или AI generation. В final есть действительная ссылка результата; полноценный QR на самой Стелле ещё не подключён. Voice/AI/реальная фотосъёмка и MAX visual — следующие интеграции. Standalone без master=1 не является master-сценарием. Не включать одновременно второго владельца presentation ACK.

Runtime artifacts/local-master/stella-ui, same-origin/no-store, после API mounts. Основной принятый source candidate D:/job/production/FUTURONIKA/VK_DigitalProducts/artifacts/workspace/tests/parallel-wave3/stella-candidate. Точный provenance в build-manifest.json: sourceManifestSha256 afc6ebd6ec0119e0aa0cc520fa52067fff17e341787720dc23b3402c27d03511. Независимый voice-кандидат5196 сюда не переносился. Backend VK workflows не менялись, notices сохранены.

[Компонентные проверки](../artifacts/reports/stella-vk-full-questions-20261004.md), [IAB и применение](../artifacts/reports/parallel-wave3-integration-20261004.md). Художественная приёмка остаётся у пользователя.
