# LIGHTNING 1.4 — color modes, audio and timed bonus

## Important

Flash the updated Arduino sketch before using either color mode:

`arduino/Lightning_LED_Controller_Nano/Lightning_LED_Controller_Nano.ino`

The existing wiring is unchanged:

- D6 — all 15 Blue-player LEDs
- D7 — all 15 Orange-player LEDs

## Bonus

In Endless Set and Independent Race, a green bonus remains available for 7 seconds.
It stays steady for 4 seconds, then flashes faster during its last 3 seconds.
If nobody collects it, the button returns to its ordinary active color.
Collecting it starts X2 for 5 seconds and removes the offer from the opponent.

## Audio files

Menu music can be provided as a playlist. Put any number of MP3, WAV, OGG,
M4A or AAC files in `music/menu`. Files are sorted by name and played in order;
after the last file the playlist starts again. When building the EXE,
`build-exe.bat` copies this folder to `dist/music/menu` beside the application.

General game music goes to `music/game`. A separate playlist can be assigned
to every mode using the folders under `music/games`:

- `classic`
- `replacement`
- `independent`
- `duel`
- `colorMatch`
- `colorSequence`

An empty mode folder falls back to `music/game`.

Put your MP3 files in `public/audio`:

- `menu.mp3` — looping menu music
- `game.mp3` — looping session music
- `end.mp3` — session-ending music
- `button.mp3` — every physical game-button press
- `bonus.mp3` — bonus pickup
- `countdown.mp3` — start countdown and final five seconds
- `red.mp3`, `blue.mp3`, `green.mp3`, `yellow.mp3`, `purple.mp3` — color sounds

Missing audio files do not stop the game. Paths, volumes and crossfade time are
configured in `config.json`. Menu, game and ending music crossfade. Button,
bonus and countdown effects play independently.

During Light Melody, game music is automatically reduced to
`audio.sequenceMusicVolume` so the five color sounds remain easy to hear.

## Color Code

- Easy: 5 colored buttons, 15 seconds to answer
- Medium: 6 colored buttons, 15 seconds to answer
- Hard: 6 colored buttons, 10 seconds to answer

The target is shown for 5 seconds and then fades. Each press cycles that
physical button through red, blue, green, yellow, purple and off. At the end of
the answer timer, correct players score. Both strips flash green or red twice.
No target color occurs more than twice in one combination.

## Light Melody

- Easy: sequence of 4 buttons
- Medium: sequence of 6 buttons
- Hard: sequence of 8 buttons
- Very Hard: sequence of 8 buttons, starts at 1000 ms between steps, becomes
  100 ms faster after every round down to 300 ms, and has no button/color sound

The sequence remains illuminated after its demonstration. The first player to
repeat the physical-button order correctly scores. A mistake resets only that
player's sequence progress. Very Hard is unlocked for a player profile after
finishing Light Melody on Hard.

## Start and build

Development:

`scripts\start-dev.bat`

Portable EXE:

`scripts\build-exe.bat`
