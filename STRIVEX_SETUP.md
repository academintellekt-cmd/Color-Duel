# Подключение Color Duel к StriveX

На ПК Color Duel используется отдельный экземпляр Gateway или отдельная конфигурация службы Gateway.

`gateway/.env`:

```env
STATION_ID=color-duel-01
SERVER_URL=http://IP_СЕРВЕРА:3000
STATION_KEY=ТОТ_ЖЕ_КЛЮЧ_ЧТО_НА_СЕРВЕРЕ
ADAPTER=gameserver
GAME_WS_URL=ws://127.0.0.1:4210
HEARTBEAT_MS=30000
DATA_DIR=./data-color-duel
GATEWAY_UI_PORT=4110
```

Порядок запуска:

```text
1. StriveX Server
2. Color Duel
3. Gateway Color Duel
```

Команды игры:

```bat
cd /d "D:\Color-Duel"
npm.cmd install --include=dev
npm.cmd run check
scripts\start-dev.bat
```

Команда Gateway выполняется из папки соответствующего экземпляра Gateway:

```bat
npm.cmd start
```

Gateway передаёт `unlock` с `session_id`, оплаченным временем, полем `user` (первый игрок, для обратной совместимости) и полем `users` — полным списком игроков лобби (для Color Duel Gateway ждёт до двух сканов браслетов в течение `LOBBY_WINDOW_MS`, см. `stations/color-duel.env` в проекте Gateway). Оба имени в игре подставляются из `users`; если пришёл только один игрок, второй отображается как `Player 2`.

По завершении оплаченной сессии отправляется один `session_result` со сводкой всех сыгранных режимов. `meta.points` содержит персональный итог каждого игрока — сумму очков по всем сыгранным им режимам за сессию, в формате `[{ic:"UID_браслета",points:число}, ...]`. Gateway раскладывает эти очки по каждому браслету отдельно в свою историю и очередь на сервер; если игрок не был авторизован по браслету (например, при `simulateStart` в dev-режиме), для него запись в `points` не отправляется.
