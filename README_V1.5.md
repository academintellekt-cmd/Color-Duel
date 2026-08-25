# Lightning 1.5

## Session flow

- After a completed game, the same players return to the game-mode menu.
- The door button ends the current player session and returns Lightning to the
  waiting screen.
- If the players leave the mode-selection, information, difficulty, duration or
  ready screen untouched for five minutes, the session ends automatically.
- The inactivity timeout is disabled during countdowns and active games, so it
  cannot interrupt a round.
- When RFID is unavailable, both player names can be entered manually.

The timeout can be changed in `config.json`:

```json
"sessionIdleTimeoutMs": 300000
```

## Music

Menu tracks go in `music/menu`. General game tracks go in `music/game`.
Mode-specific tracks go in:

```text
music/games/classic
music/games/replacement
music/games/independent
music/games/duel
music/games/colorMatch
music/games/colorSequence
```

Tracks are played in filename order and loop continuously. An empty
mode-specific folder falls back to `music/game`. The older single file
`music/game.mp3` is also supported.

## Arduino

Upload `arduino/Lightning_LED_Controller_Nano/Lightning_LED_Controller_Nano.ino`
again. Version 4.3 makes the physical red and purple LED colors easier to
distinguish. Screen colors were not changed.

