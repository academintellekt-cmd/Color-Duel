#include <Adafruit_NeoPixel.h>

const uint8_t BLUE_DATA_PIN = 6;
const uint8_t ORANGE_DATA_PIN = 7;
const uint8_t BUTTONS = 15;
const uint8_t LEDS_PER_BUTTON = 1;
const uint16_t LEDS_PER_PLAYER = BUTTONS * LEDS_PER_BUTTON;

// Logical position 1..15 -> physical button index on each separate line.
// Change these tables if either line is physically routed in a different order.
const uint8_t BLUE_ORDER[BUTTONS]   = {0,1,2,3,4,5,6,7,8,9,10,11,12,13,14};
const uint8_t ORANGE_ORDER[BUTTONS] = {0,1,2,3,4,5,6,7,8,9,10,11,12,13,14};

Adafruit_NeoPixel blueStrip(LEDS_PER_PLAYER, BLUE_DATA_PIN, NEO_GRB + NEO_KHZ800);
Adafruit_NeoPixel orangeStrip(LEDS_PER_PLAYER, ORANGE_DATA_PIN, NEO_GRB + NEO_KHZ800);
String line;
bool idleAnimation = true;
uint8_t rainbowOffset = 0;
unsigned long lastRainbowFrame = 0;
uint8_t confirmPosition[2] = {0, 0};
uint8_t catchPosition[2] = {0, 0};
uint8_t catchPhase[2] = {0, 0};
uint16_t catchInterval[2] = {300, 300};
uint16_t catchFilledMask[2] = {0, 0};
unsigned long catchStartedAt[2] = {0, 0};
bool catchActive[2] = {false, false};
uint8_t lastCatchStep[2] = {255, 255};
bool fadeActive[2] = {false, false};
uint8_t fadeStep[2] = {0, 0};
uint16_t fadeInterval[2] = {50, 50};
unsigned long fadeNextAt[2] = {0, 0};
bool positionFlashActive[2] = {false, false};
uint8_t positionFlashPosition[2] = {0, 0};
bool positionFlashGreen[2] = {false, false};
unsigned long positionFlashStartedAt[2] = {0, 0};
bool panelFlashActive[2] = {false, false};
bool panelFlashGreen[2] = {false, false};
unsigned long panelFlashStartedAt[2] = {0, 0};

uint32_t rainbowColor(Adafruit_NeoPixel &strip, uint8_t value) {
  value = 255 - value;
  if (value < 85) return strip.Color(255 - value * 3, 0, value * 3);
  if (value < 170) {
    value -= 85;
    return strip.Color(0, value * 3, 255 - value * 3);
  }
  value -= 170;
  return strip.Color(value * 3, 255 - value * 3, 0);
}

uint32_t colorCode(Adafruit_NeoPixel &strip, char code) {
  switch (code) {
    case '1': return strip.Color(255, 0, 0);     // clear red
    case '2': return strip.Color(0, 110, 255);   // blue
    case '3': return strip.Color(0, 235, 65);    // green
    case '4': return strip.Color(255, 190, 0);   // yellow
    case '5': return strip.Color(75, 0, 255);    // deep violet
    default: return 0;
  }
}

void setButton(Adafruit_NeoPixel &strip, const uint8_t *order, uint8_t position, uint32_t color) {
  if (position < 1 || position > BUTTONS) return;
  uint16_t first = order[position - 1] * LEDS_PER_BUTTON;
  for (uint8_t i = 0; i < LEDS_PER_BUTTON; i++) strip.setPixelColor(first + i, color);
}

void applyState(uint16_t blueMask, uint16_t orangeMask, uint8_t boostFlags,
                uint8_t bluePower, uint8_t orangePower) {
  blueStrip.clear();
  orangeStrip.clear();
  bool blueBoost = boostFlags & 0x01;
  bool orangeBoost = boostFlags & 0x02;

  for (uint8_t position = 1; position <= BUTTONS; position++) {
    uint16_t bit = 1U << (position - 1);
    if (blueMask & bit) {
      bool powerVisible = (boostFlags & 0x04) && position == bluePower;
      uint32_t color = (blueBoost || powerVisible)
        ? blueStrip.Color(0, 255, 55) : blueStrip.Color(0, 130, 255);
      setButton(blueStrip, BLUE_ORDER, position, color);
    }
    if (orangeMask & bit) {
      bool powerVisible = (boostFlags & 0x08) && position == orangePower;
      uint32_t color = (orangeBoost || powerVisible)
        ? orangeStrip.Color(0, 255, 55) : orangeStrip.Color(255, 90, 0);
      setButton(orangeStrip, ORANGE_ORDER, position, color);
    }
  }
  blueStrip.show();
  orangeStrip.show();
}

void applyColors(Adafruit_NeoPixel &strip, const uint8_t *order, const String &digits) {
  strip.clear();
  for (uint8_t position = 1; position <= BUTTONS && position <= digits.length(); position++) {
    setButton(strip, order, position, colorCode(strip, digits.charAt(position - 1)));
  }
  strip.show();
}

void applyPositionFeedback(uint8_t player, Adafruit_NeoPixel &strip, const uint8_t *order) {
  if (!positionFlashActive[player]) return;
  unsigned long elapsed = millis() - positionFlashStartedAt[player];
  if (elapsed >= 420) { positionFlashActive[player] = false; return; }
  bool visible = elapsed < 120 || (elapsed >= 210 && elapsed < 330);
  uint32_t color = positionFlashGreen[player] ? strip.Color(0, 255, 55) : strip.Color(255, 0, 0);
  setButton(strip, order, positionFlashPosition[player], visible ? color : 0);
}

void startPositionFeedback(uint8_t player, uint8_t position, bool green) {
  positionFlashActive[player] = true;
  positionFlashPosition[player] = position;
  positionFlashGreen[player] = green;
  positionFlashStartedAt[player] = millis();
  lastCatchStep[player] = 255;
}

void startPanelFeedback(uint8_t player, bool green) {
  panelFlashActive[player] = true;
  panelFlashGreen[player] = green;
  panelFlashStartedAt[player] = millis();
}

void updatePanelFeedbacks() {
  unsigned long now = millis();
  for (uint8_t player = 0; player < 2; player++) {
    if (!panelFlashActive[player]) continue;
    Adafruit_NeoPixel &strip = player == 0 ? blueStrip : orangeStrip;
    const uint8_t *order = player == 0 ? BLUE_ORDER : ORANGE_ORDER;
    unsigned long elapsed = now - panelFlashStartedAt[player];
    if (elapsed >= 560) { strip.clear(); strip.show(); panelFlashActive[player] = false; continue; }
    bool visible = elapsed < 150 || (elapsed >= 280 && elapsed < 430);
    strip.clear();
    if (visible) {
      uint32_t color = panelFlashGreen[player] ? strip.Color(0, 255, 55) : strip.Color(255, 20, 25);
      for (uint8_t position = 1; position <= BUTTONS; position++) setButton(strip, order, position, color);
    }
    strip.show();
  }
}

void showCatch(uint8_t player) {
  Adafruit_NeoPixel &strip = player == 0 ? blueStrip : orangeStrip;
  const uint8_t *order = player == 0 ? BLUE_ORDER : ORANGE_ORDER;
  uint8_t index = (catchPhase[player] + ((millis() - catchStartedAt[player]) / max((uint16_t)1, catchInterval[player]))) % 4;
  if (lastCatchStep[player] == index && !positionFlashActive[player]) return;
  lastCatchStep[player] = index;
  strip.clear();
  uint32_t ownColor = player == 0 ? strip.Color(0, 110, 255) : strip.Color(255, 90, 0);
  for (uint8_t position = 1; position <= BUTTONS; position++) {
    if (catchFilledMask[player] & (1U << (position - 1))) setButton(strip, order, position, ownColor);
  }
  const uint32_t colors[4] = {
    strip.Color(255, 90, 0), strip.Color(0, 110, 255),
    strip.Color(0, 235, 65), strip.Color(255, 20, 130)
  };
  setButton(strip, order, catchPosition[player], colors[index]);
  applyPositionFeedback(player, strip, order);
  strip.show();
}

void showDots(uint8_t player, uint8_t first, uint8_t second) {
  Adafruit_NeoPixel &strip = player == 0 ? blueStrip : orangeStrip;
  const uint8_t *order = player == 0 ? BLUE_ORDER : ORANGE_ORDER;
  strip.clear();
  uint32_t playerColor = player == 0 ? strip.Color(0, 110, 255) : strip.Color(255, 90, 0);
  setButton(strip, order, first, playerColor);
  setButton(strip, order, second, playerColor);
  applyPositionFeedback(player, strip, order);
  strip.show();
}

void applyOwners(const String &digits) {
  blueStrip.clear(); orangeStrip.clear();
  for (uint8_t position = 1; position <= BUTTONS && position <= digits.length(); position++) {
    char owner = digits.charAt(position - 1);
    uint32_t colorB = owner == '1' ? blueStrip.Color(0, 110, 255) : owner == '2' ? blueStrip.Color(255, 90, 0) : 0;
    uint32_t colorO = owner == '1' ? orangeStrip.Color(0, 110, 255) : owner == '2' ? orangeStrip.Color(255, 90, 0) : 0;
    setButton(blueStrip, BLUE_ORDER, position, colorB);
    setButton(orangeStrip, ORANGE_ORDER, position, colorO);
  }
  blueStrip.show(); orangeStrip.show();
}

void applyPong(int ball, uint8_t bluePaddle, uint8_t orangePaddle, uint8_t server, bool serving, bool active) {
  blueStrip.clear(); orangeStrip.clear();
  if (serving) {
    if (server == 0) setButton(blueStrip, BLUE_ORDER, bluePaddle, blueStrip.Color(0, 110, 255));
    else setButton(orangeStrip, ORANGE_ORDER, orangePaddle, orangeStrip.Color(255, 90, 0));
  } else {
    uint8_t receiver = 1 - server;
    if (receiver == 0) setButton(blueStrip, BLUE_ORDER, bluePaddle, active ? blueStrip.Color(0, 255, 55) : blueStrip.Color(0, 110, 255));
    else setButton(orangeStrip, ORANGE_ORDER, orangePaddle, active ? orangeStrip.Color(0, 255, 55) : orangeStrip.Color(255, 90, 0));
    if (ball < 15) setButton(blueStrip, BLUE_ORDER, ball + 1, blueStrip.Color(0, 110, 255));
    else setButton(orangeStrip, ORANGE_ORDER, 30 - ball, orangeStrip.Color(255, 90, 0));
  }
  blueStrip.show(); orangeStrip.show();
}

void startFade(uint8_t player, uint16_t durationMs) {
  fadeActive[player] = true;
  fadeStep[player] = 0;
  fadeInterval[player] = max((uint16_t)1, (uint16_t)(durationMs / 20));
  fadeNextAt[player] = millis();
}

void updateFades() {
  unsigned long now = millis();
  for (uint8_t player = 0; player < 2; player++) {
    if (!fadeActive[player] || (long)(now - fadeNextAt[player]) < 0) continue;
    Adafruit_NeoPixel &strip = player == 0 ? blueStrip : orangeStrip;
    fadeNextAt[player] = now + fadeInterval[player];
    fadeStep[player]++;
    if (fadeStep[player] >= 20) {
      strip.clear(); strip.show(); fadeActive[player] = false; continue;
    }
    for (uint16_t i = 0; i < LEDS_PER_PLAYER; i++) {
      uint32_t c = strip.getPixelColor(i);
      strip.setPixelColor(i, ((uint8_t)(c >> 16) * 210) / 255,
                          ((uint8_t)(c >> 8) * 210) / 255,
                          ((uint8_t)c * 210) / 255);
    }
    strip.show();
  }
}

void cancelDynamicEffects() {
  catchActive[0] = catchActive[1] = false;
  fadeActive[0] = fadeActive[1] = false;
  positionFlashActive[0] = positionFlashActive[1] = false;
  panelFlashActive[0] = panelFlashActive[1] = false;
}

void flashRoundWinner(char winner) {
  uint32_t blue = winner == 'B' ? blueStrip.Color(0, 110, 255) : winner == 'O' ? blueStrip.Color(255, 90, 0) : blueStrip.Color(255, 255, 255);
  uint32_t orange = winner == 'B' ? orangeStrip.Color(0, 110, 255) : winner == 'O' ? orangeStrip.Color(255, 90, 0) : orangeStrip.Color(255, 255, 255);
  for (uint8_t n = 0; n < 2; n++) {
    for (uint8_t position = 1; position <= BUTTONS; position++) {
      setButton(blueStrip, BLUE_ORDER, position, blue);
      setButton(orangeStrip, ORANGE_ORDER, position, orange);
    }
    blueStrip.show(); orangeStrip.show(); delay(180);
    blueStrip.clear(); orangeStrip.clear(); blueStrip.show(); orangeStrip.show(); delay(130);
  }
}

void testLines() {
  for (uint8_t position = 1; position <= BUTTONS; position++) {
    blueStrip.clear();
    orangeStrip.clear();
    setButton(blueStrip, BLUE_ORDER, position, blueStrip.Color(0, 80, 180));
    setButton(orangeStrip, ORANGE_ORDER, position, orangeStrip.Color(180, 50, 0));
    blueStrip.show();
    orangeStrip.show();
    delay(100);
  }
  applyState(0, 0, 0, 0, 0);
}

void updateIdleAnimation() {
  if (!idleAnimation || millis() - lastRainbowFrame < 45) return;
  lastRainbowFrame = millis();
  for (uint8_t position = 1; position <= BUTTONS; position++) {
    uint8_t hue = rainbowOffset + ((uint16_t)(position - 1) * 256 / BUTTONS);
    setButton(blueStrip, BLUE_ORDER, position, rainbowColor(blueStrip, hue));
    setButton(orangeStrip, ORANGE_ORDER, position, rainbowColor(orangeStrip, hue + 128));
  }
  blueStrip.show();
  orangeStrip.show();
  rainbowOffset += 2;
}

void handleCommand(String command) {
  command.trim();
  if (command == "HELLO" || command == "PING") {
    Serial.println("LIGHTNING_LED V5.5 READY");
    return;
  }
  if (command == "MODE IDLE" || command == "MODE READY") {
    idleAnimation = true;
    cancelDynamicEffects();
    confirmPosition[0] = confirmPosition[1] = 0;
    lastRainbowFrame = 0;
    Serial.println("OK IDLE");
    return;
  }
  idleAnimation = false;
  if (command.startsWith("COUNTDOWN ")) {
    applyState(0, 0, 0, 0, 0);
  } else if (command.startsWith("MODE GAME ")) {
    cancelDynamicEffects();
    confirmPosition[0] = confirmPosition[1] = 0;
    applyState(0, 0, 0, 0, 0);
  } else if (command == "TEST") {
    testLines();
  } else if (command == "CLEAR" || command == "MODE GAMEOVER") {
    cancelDynamicEffects();
    confirmPosition[0] = confirmPosition[1] = 0;
    applyState(0, 0, 0, 0, 0);
  } else if (command.startsWith("CONFIRM ")) {
    uint8_t player = command.charAt(8) == 'B' ? 0 : 1;
    confirmPosition[player] = (uint8_t)command.substring(10).toInt();
    Adafruit_NeoPixel &strip = player == 0 ? blueStrip : orangeStrip;
    const uint8_t *order = player == 0 ? BLUE_ORDER : ORANGE_ORDER;
    setButton(strip, order, confirmPosition[player], strip.Color(255, 255, 255));
    strip.show();
    Serial.println("OK CONFIRM");
  } else if (command.startsWith("ROUNDWIN ") && command.length() >= 10) {
    flashRoundWinner(command.charAt(9)); Serial.println("OK ROUNDWIN");
  } else if (command.startsWith("OWNERS ") && command.length() >= 22) {
    confirmPosition[0] = confirmPosition[1] = 0;
    applyOwners(command.substring(7, 22)); Serial.println("OK OWNERS");
  } else if (command.startsWith("CATCH2 ")) {
    unsigned int bp, bphase, bmask, op, ophase, omask, interval;
    char payload[48]; command.substring(7).toCharArray(payload, sizeof(payload));
    if (sscanf(payload, "%u %u %x %u %u %x %u", &bp, &bphase, &bmask, &op, &ophase, &omask, &interval) == 7) {
      catchPosition[0] = bp; catchPhase[0] = bphase; catchFilledMask[0] = bmask;
      catchPosition[1] = op; catchPhase[1] = ophase; catchFilledMask[1] = omask;
      catchInterval[0] = catchInterval[1] = interval; catchStartedAt[0] = catchStartedAt[1] = millis();
      catchActive[0] = catchActive[1] = true; lastCatchStep[0] = lastCatchStep[1] = 255;
      showCatch(0); showCatch(1); Serial.println("OK CATCH2");
    }
  } else if (command.startsWith("CATCH ")) {
    char side; unsigned int position, interval, phase, filled;
    char payload[40]; command.substring(6).toCharArray(payload, sizeof(payload));
    if (sscanf(payload, "%c %u %u %u %x", &side, &position, &interval, &phase, &filled) == 5) {
      uint8_t player = side == 'B' ? 0 : 1; catchPosition[player] = position; catchInterval[player] = interval;
      catchPhase[player] = phase; catchFilledMask[player] = filled; catchStartedAt[player] = millis(); catchActive[player] = true; lastCatchStep[player] = 255;
      Serial.println("OK CATCH");
    }
  } else if (command.startsWith("DOTS2 ")) {
    unsigned int b1, b2, o1, o2; char payload[28]; command.substring(6).toCharArray(payload, sizeof(payload));
    if (sscanf(payload, "%u %u %u %u", &b1, &b2, &o1, &o2) == 4) {
      showDots(0, b1, b2); showDots(1, o1, o2); Serial.println("OK DOTS2");
    }
  } else if (command.startsWith("DOTS ")) {
    char side; unsigned int first, second; char payload[24]; command.substring(5).toCharArray(payload, sizeof(payload));
    if (sscanf(payload, "%c %u %u", &side, &first, &second) == 3) showDots(side == 'B' ? 0 : 1, first, second);
  } else if (command.startsWith("PONG ")) {
    int ball; unsigned int bp, op, server, serving, active; char payload[40]; command.substring(5).toCharArray(payload, sizeof(payload));
    if (sscanf(payload, "%d %u %u %u %u %u", &ball, &bp, &op, &server, &serving, &active) == 6) applyPong(ball, bp, op, server, serving, active);
  } else if (command.startsWith("FLASHPOS ")) {
    char side, result; unsigned int position; char payload[24]; command.substring(9).toCharArray(payload, sizeof(payload));
    if (sscanf(payload, "%c %u %c", &side, &position, &result) == 3) startPositionFeedback(side == 'B' ? 0 : 1, position, result == 'G');
  } else if (command.startsWith("COLORS2 ") && command.length() >= 39) {
    cancelDynamicEffects();
    confirmPosition[0] = confirmPosition[1] = 0;
    applyColors(blueStrip, BLUE_ORDER, command.substring(8, 23));
    applyColors(orangeStrip, ORANGE_ORDER, command.substring(24, 39));
    Serial.println("OK COLORS2");
  } else if (command.startsWith("COLORS B ") && command.length() >= 24) {
    catchActive[0] = false; fadeActive[0] = false; panelFlashActive[0] = false; positionFlashActive[0] = false;
    confirmPosition[0] = 0;
    applyColors(blueStrip, BLUE_ORDER, command.substring(9, 24));
    Serial.println("OK COLORS B");
  } else if (command.startsWith("COLORS O ") && command.length() >= 24) {
    catchActive[1] = false; fadeActive[1] = false; panelFlashActive[1] = false; positionFlashActive[1] = false;
    confirmPosition[1] = 0;
    applyColors(orangeStrip, ORANGE_ORDER, command.substring(9, 24));
    Serial.println("OK COLORS O");
  } else if (command.startsWith("FLASH B ")) {
    startPanelFeedback(0, command.endsWith("G"));
    Serial.println("OK FLASH B");
  } else if (command.startsWith("FLASH O ")) {
    startPanelFeedback(1, command.endsWith("G"));
    Serial.println("OK FLASH O");
  } else if (command.startsWith("FEEDBACK ") && command.length() >= 12) {
    startPanelFeedback(0, command.charAt(9) == 'G');
    startPanelFeedback(1, command.charAt(11) == 'G');
    Serial.println("OK FEEDBACK");
  } else if (command.startsWith("FADE B ")) {
    startFade(0, (uint16_t)command.substring(7).toInt()); Serial.println("OK FADE B");
  } else if (command.startsWith("FADE O ")) {
    startFade(1, (uint16_t)command.substring(7).toInt()); Serial.println("OK FADE O");
  } else if (command.startsWith("FADE ")) {
    startFade(0, (uint16_t)command.substring(5).toInt());
    startFade(1, (uint16_t)command.substring(5).toInt());
    Serial.println("OK FADE");
  } else if (command.startsWith("LEDS ")) {
    char payload[42];
    command.substring(5).toCharArray(payload, sizeof(payload));
    unsigned int blueMask, orangeMask, flags, bluePower, orangePower;
    int fields = sscanf(payload, "%x %x %u %u %u",
                        &blueMask, &orangeMask, &flags, &bluePower, &orangePower);
    if (fields == 5) {
      applyState((uint16_t)blueMask, (uint16_t)orangeMask, (uint8_t)flags,
                 (uint8_t)bluePower, (uint8_t)orangePower);
      Serial.println("OK LEDS");
    } else {
      Serial.println("ERR LEDS");
    }
  }
}

void setup() {
  Serial.begin(115200);
  blueStrip.begin();
  orangeStrip.begin();
  blueStrip.setBrightness(90);
  orangeStrip.setBrightness(90);
  applyState(0, 0, 0, 0, 0);
  Serial.println("LIGHTNING_LED V5.5 READY");
  testLines();
  idleAnimation = true;
}

void loop() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n') {
      handleCommand(line);
      line = "";
    } else if (c != '\r' && line.length() < 64) {
      line += c;
    }
  }
  if (!idleAnimation) {
    if (catchActive[0]) showCatch(0);
    if (catchActive[1]) showCatch(1);
  }
  updateIdleAnimation();
  updateFades();
  updatePanelFeedbacks();
}
