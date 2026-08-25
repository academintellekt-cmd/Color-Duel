# Lightning 2.0

## Important

Upload the new Arduino sketch before running this version:

```text
arduino/Lightning_LED_Controller_Nano/Lightning_LED_Controller_Nano.ino
```

The controller identifies itself as `LIGHTNING_LED V5.0 READY`. The sketch uses
two separate LED outputs: D6 for the blue player and D7 for the orange player.

## Automatic USB controller assignment

With two connected gamepad boards, Lightning automatically assigns the lower
Windows Gamepad index to blue and the next index to orange. The assignment is
remembered locally. To exchange the two sides permanently, set:

```json
"joystick":{"autoAssign":true,"swapPlayers":true}
```

No button-by-button assignment is required during normal startup.

## Color Code

Each player now receives an independent color pattern. Position 8 is excluded
from the generated pattern and becomes the rainbow confirmation button.
After restoring the pattern, press button 8. A correct answer scores and flashes
green. A wrong answer flashes red. That player immediately receives a new
independent pattern; the opponent continues their own pattern.

## New modes

- Color Conquest: five fixed rounds of 30 seconds. A press paints both matching
  positions with that player's color. The opponent can repaint it.
- Catch Your Color: Fill Field and Time Attack variants, with 300/250/200 ms
  color speeds. Very Hard also transfers an opponent-color hit.
- Catch Intersection: two independently moving lights, random speed after each
  reflection, and an 80 ms hit window.
- 2D Ping-Pong: random serve and paddles, a 200 ms return window, and a 50 ms
  attack window that accelerates the ball by 50%.

Very Hard in Catch Your Color and 2D Ping-Pong unlocks after completing Hard.

## Languages and names

The touchscreen supports Russian, English, German, French, Chinese and Japanese.
Tap the globe to open or close the vertical flag selector. Selecting a flag
changes all touchscreen slides and closes the selector.

Name entry includes an on-screen keyboard. Russian uses Cyrillic keys; the other
languages use Latin keys so player names remain easy to enter.

## Audio

Put the separate 3-2-1 sound here:

```text
public/audio/start-countdown.mp3
```

The existing `countdown.mp3` remains the final-five-seconds sound.

Mode-specific music folders were added under `music/games` for `paint`,
`catchColor`, `intersection`, and `pong`.

