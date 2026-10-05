# Голос Василиса

Отдельная рабочая папка функционала озвучки Стеллы.

- `vasilisa/reference.wav` — объединённые пользовательские записи (вопрос, варианты1–4), mono PCM16/24кГц,24,609с.
- `vasilisa/phrases.json` — тексты и стабильные ID экранных подсказок.
- `scripts/qwen-voice.mjs` — создание TTS-клона и предварительный синтез. Запускается только вручную, вне браузера.
- `../public/voice/vasilisa/` — готовые WAV и публичный manifest без ключей/voice ID.
- `../src/features/voice/` — согласование экранов и Howler.

Команда из корня проекта: `node artifacts/stella-prototype/voice/scripts/qwen-voice.mjs`.
Требуются Node≥24 и локальный Python из настроенного Codex runtime для чтения CSV. API доступы читаются из `secrets/secrets/AI/*.csv`; private state хранится рядом в `vasilisa-tts-state.json`. Не копировать state или CSV в приложение.

Повторный запуск использует существующий voice и WAV с совпадающим хешем текста. Неизвестный исход enrollment требует сверки provider list; автоматического повторного создания нет. После явно отклонённого enrollment запуск с `--retry-rejected` допустим только после устранения причины. Ошибки не подменяются чужим голосом. Manifest становится ready только после полного набора.

Василиса создана для `qwen3-tts-vc-2026-01-22`; это не Omni voice. Для диалога понадобится отдельный совместимый enrollment.

## Кандидат восстановления 0410 поверх AUDIO-02

В локальном preview `phrases.json` содержит утверждённые полные реплики фото и финала, инструкцию камеры и паузы. `pending-audio.json` блокирует фото, камеру и финал до точных готовых WAV; браузерный голос и старые несовпадающие записи не подставляются. Частицы и активация используют проверенный studio WAV 6,77 с / вставленная пауза 400 мс. Главная не произносит автоприветствие.

Стендовый режим использует `src/features/master/useMasterAudio.ts` и AUDIO-02 банк `public/audio/vk-production-v1`, а не локальный voice manifest. Подробная карта, SHA и требования центрального MASTER — `public/audio/vk-production-v1/{README.md,central-catalogue.candidate.json}`. Кандидат не развёрнут; central catalogue и accepted pins автоматически не обновляются. Новых платных вызовов или синтеза не было.
