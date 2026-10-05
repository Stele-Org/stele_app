> Исторический документ. Актуальный статус пакета и запуск — в корневом README.md.

# Оболочка установленной Стеллы

Десять исходных файлов адаптера, kiosk и audio bridge сверены с установленной ролью 05.10.2026. Хэши — в `provenance.json`. Это компоненты существующего стенда; здесь нет второго MASTER или готового комплекта его реквизитов.

Размещение при интеграции:

```text
ROLE/
  app/stella-ui/              # sealed dist из ../master/stella-candidate
  app/stella-kiosk/           # Electron shell
  app/stella-adapter/         # same-origin allowlist + pinned assets
  app/master-audio/control/  # транспорт событий звука
  config/node.json           # выдаётся интегратором, НЕ хранится здесь
  runtime/node/node.exe      # штатный runtime интегратора
  runtime/electron/          # Electron 44.4.5
```

`local-server.mjs` получает `requestMaster` и конфигурацию из общего host. mTLS transport/launcher/certificates и MASTER backend принадлежат мастеру. Не копировать старый полный role bundle поверх принятого мастера. Данные посетителей, credentials, сертификаты, устройства Windows, реальные журналы и runtime binaries исключены.

Сохранены: DirectShow для Logitech BRIO (`MediaFoundationVideoCapture` disabled), video-only разрешения своего origin, вертикальный полноэкранный режим, ожидание готовности UI перед открытием окна. В AUDIO-02 локальный Electron muted намеренно: Howler clocks передаются через same-origin bridge на MASTER/Dante. Это не означает отключение всего стендового звука.

При удалённом применении запускать role host через существующую `VKStand-r1-Start-STELLA`, затем kiosk через `VKStand-r1-StellaKiosk`, предварительно сверив их действия и корень роли. Не запускать долгоживущий host напрямую из SSH: при такой попытке он завершился после закрытия команды. Kiosk завершать только по проверенным PID/пути/пользовательской сессии; не использовать массовое завершение Electron.

Перед обновлением — SHA/CAS по принятому manifest и резервная копия изменяемых файлов. После — отдельное SSH-подключение: живой host и kiosk, HTTP200 entry/JS/CSS, SHA ассетов, готовность master proxy. Build manifest проверяется с диска и по pin: публичный allowlist его не отдаёт. Визуальную проверку выполняет пользователь.

Изменения этой GitHub-ветки не обновляют F, сайт или стенд автоматически.
