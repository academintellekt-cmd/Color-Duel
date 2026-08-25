# Запуск Lightning со StriveX

Эта версия Lightning работает только после разрешения от StriveX Gateway. Локальная RFID-база и кнопка запуска без браслета отключены. RFID-считывателем, пользователями, временем оплаченной сессии и отправкой результатов управляет Gateway.

## Схема

```text
Главный ПК StriveX Server :3000
              |
           Ethernet
              |
ПК аттракциона
  StriveX Gateway :4100
       | WebSocket 127.0.0.1:4200
  Lightning Attraction
       | COM, 115200
  Arduino Nano
```

## 1. Главный сервер

Распакуйте `Strivex-Gateway-update-2026-08-06.zip`, например в `C:\StriveX`.

В корне `C:\StriveX` создайте `.env`:

```env
DESK_KEY=replace-with-a-long-desk-secret
STATION_KEY=replace-with-a-long-station-secret
SESSION_TTL_MINUTES=60
```

`STATION_KEY` должен совпадать с ключом на каждом ПК аттракциона.

При установленном Docker Desktop запустите:

```bat
cd /d C:\StriveX
docker compose up -d
```

Проверка сервера:

```text
http://IP_ГЛАВНОГО_ПК:3000/health
```

Панель регистрации браслетов:

```text
http://IP_ГЛАВНОГО_ПК:3000/
```

Разрешите входящие TCP-подключения к порту `3000` в брандмауэре Windows для частной сети.

## 2. Gateway на ПК Lightning

В папке `C:\StriveX\gateway` создайте `.env` из `.env.example` и задайте:

```env
STATION_ID=lightning-01
SERVER_URL=http://IP_ГЛАВНОГО_ПК:3000
STATION_KEY=replace-with-a-long-station-secret
ADAPTER=gameserver
GAME_WS_URL=ws://127.0.0.1:4200
HEARTBEAT_MS=30000
DATA_DIR=./data
GATEWAY_UI_PORT=4100
```

Для второго аттракциона используйте другой уникальный `STATION_ID`, например `lightning-02`.

Один раз установите компоненты Gateway:

```bat
cd /d C:\StriveX\gateway
npm install
```

## 3. Lightning

В `config.json` уже установлены рабочие параметры:

```json
"strivex": {
  "enabled": true,
  "transport": "websocket",
  "wsHost": "127.0.0.1",
  "wsPort": 4200,
  "developmentMode": false
},
"rfid": { "enabled": false },
"offline": { "enabled": false }
```

Arduino продолжает использовать отдельный COM-порт из секции `serial`. Значение `"port":"auto"` оставляет автоматический поиск контроллера.

Для разработки:

```bat
cd /d C:\Lightning\lightning_windows
scripts\start-dev.bat
```

Для штатной эксплуатации запустите собранный `Lightning-Attraction-2.2.0.exe`.

## 4. Правильный порядок ежедневного запуска

1. Запустите StriveX Server на главном ПК.
2. Подключите к ПК аттракциона Arduino Nano, два USB-джойстика, RFID-считыватель и оба монитора.
3. Запустите Lightning. Игра откроет оба окна и начнёт слушать `127.0.0.1:4200`.
4. Запустите Gateway:

```bat
cd /d C:\StriveX\gateway
npm start
```

5. Откройте журнал Gateway: `http://127.0.0.1:4100`.
6. Зарегистрируйте игрока и браслет в панели главного сервера.
7. Просканируйте браслет на ПК аттракциона. После успешной проверки Gateway передаст Lightning имя игрока и оплаченное время, после чего откроется выбор игровых режимов.
8. По окончании сессии Lightning один раз отправит суммарный результат Gateway, а Gateway сохранит его на сервере. При временной недоступности сервера Gateway хранит результат в локальной очереди.

Если запустить Gateway раньше игры, ничего критичного не произойдёт: он будет переподключаться. Однако порядок «сначала Lightning, затем Gateway» быстрее показывает готовность станции.

## Диагностика

- Экран остаётся в ожидании браслета: проверьте `ADAPTER=gameserver`, регистрацию браслета и адрес `SERVER_URL`.
- Gateway не соединяется с игрой: проверьте, что Lightning запущен и порт `4200` не занят другим процессом.
- Arduino не найдена: укажите её точный `COMx` в `serial.port` или оставьте `auto` и отключите лишние COM-устройства.
- Сервер недоступен с ПК аттракциона: проверьте `http://IP_ГЛАВНОГО_ПК:3000/health`, Ethernet и брандмауэр.
- Журнал Gateway находится на `http://127.0.0.1:4100`.

## Сборка EXE

```bat
cd /d C:\Lightning\lightning_windows
npm install --include=dev
npm run check
scripts\build-exe.bat
```

Результат появится в папке `dist`. Каталог `node_modules` в исходный архив не включается и восстанавливается через `npm install`.

## Проверка этой версии

Автоматические тесты игровых движков, Arduino-протокола, музыки, прежнего построчного StriveX-протокола и нового WebSocket-сеанса выполнены успешно. Проверены `unlock`, защита от дублированного запуска, единственный итог, `lock`/отмена и готовность к следующей сессии. Фактический обмен с физическим RFID-считывателем и развернутым StriveX Server необходимо выполнить на целевом оборудовании по шагам выше.
