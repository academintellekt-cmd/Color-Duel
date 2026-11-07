#include <Adafruit_NeoPixel.h>
#include <stdlib.h>

const uint8_t LINE_PINS[8] = { 9, 10, 11, 12, 6, 7, A0, A1 };
const uint8_t LEDS = 49, MAX_PULSES = 4;
// Installed strips appear to use B,R,G byte order: GRB keeps red correct,
// but swaps green and blue. Color(r,g,b) still takes logical RGB values.
const neoPixelType LED_TYPE = NEO_BRG + NEO_KHZ800;
Adafruit_NeoPixel strip(LEDS, LINE_PINS[0], LED_TYPE);
struct Pulse {
  bool active;
  uint32_t started;
  uint32_t color;
};
Pulse pulses[8][MAX_PULSES];
uint32_t baseColor[8] = { 0 };
char inputLine[340];
uint16_t inputLength = 0;
bool overflow = false;
bool idleMode = false, watchdogCleared = false;
int8_t calibration = -1;
uint32_t nextIdle = 0, lastFrame = 0;
uint32_t rgb(char c) {
  if (c == 'R') return strip.Color(255, 0, 0);
  if (c == 'G') return strip.Color(0, 255, 0);
  if (c == 'B') return strip.Color(0, 0, 255);
  if (c == 'Y') return strip.Color(255, 200, 0);
  return strip.Color(255, 255, 255);
}
void clearAll() {
  idleMode = false;
  calibration = -1;
  for (uint8_t ch = 0; ch < 8; ch++) {
    baseColor[ch] = 0;
    for (uint8_t p = 0; p < MAX_PULSES; p++) pulses[ch][p].active = false;
  }
}
void startPulse(uint8_t ch, char color) {
  if (ch >= 8) return;
  uint8_t slot = 0;
  for (uint8_t p = 0; p < MAX_PULSES; p++)
    if (!pulses[ch][p].active) {
      slot = p;
      break;
    }
  pulses[ch][slot].active = true;
  pulses[ch][slot].started = millis();
  pulses[ch][slot].color = rgb(color);
}
uint32_t scaleColor(uint32_t color, uint8_t scale) {
  return strip.Color(((uint16_t)(uint8_t)(color >> 16) * scale) / 255, ((uint16_t)(uint8_t)(color >> 8) * scale) / 255, ((uint16_t)(uint8_t)color * scale) / 255);
}
void render() {
  const uint32_t now = millis();
  if (idleMode && (int32_t)(now - nextIdle) >= 0) {
    const char colors[5] = { 'R', 'G', 'B', 'Y', 'W' };
    startPulse(random(8), colors[random(5)]);
    nextIdle = now + random(220, 650);
  }
  for (uint8_t ch = 0; ch < 8; ch++) {
    // NeoPixel::setPin() releases the previous pin to INPUT. Keep every
    // inactive DATA output driven LOW instead of leaving it floating.
    const int16_t previousPin = strip.getPin();
    if (previousPin != LINE_PINS[ch]) {
      strip.setPin(LINE_PINS[ch]);
      if (previousPin >= 0) {
        digitalWrite(previousPin, LOW);
        pinMode(previousPin, OUTPUT);
      }
    }
    strip.clear();
    for (uint8_t pixel = 0; pixel < LEDS; pixel++)
      if (baseColor[ch]) strip.setPixelColor(pixel, baseColor[ch]);
    if (calibration == ch)
      for (uint8_t pixel = 0; pixel < LEDS; pixel++) {
        uint8_t wave = (now / 9 + pixel * 5) % 256;
        uint8_t brightness = 40 + (wave < 128 ? wave : 255 - wave);
        strip.setPixelColor(pixel, brightness, brightness, brightness);
      }
    for (uint8_t p = 0; p < MAX_PULSES; p++) {
      Pulse &pulse = pulses[ch][p];
      if (!pulse.active) continue;
      const int16_t head = (now - pulse.started) / 22;
      if (head >= LEDS + 8) {
        pulse.active = false;
        continue;
      }
      for (int8_t tail = 0; tail < 8; tail++) {
        const int16_t pixel = head - tail;
        if (pixel >= 0 && pixel < LEDS) strip.setPixelColor(pixel, scaleColor(pulse.color, 255 - tail * 28));
      }
    }
    strip.show();
  }
}
void identify() {
  Serial.println(F("COLOR_DUEL_LED READY"));
  Serial.println(F("COLOR_DUEL_LED_V2 READY"));
}
void command(char *text) {
  while (*text == ' ') text++;
  if (!strcmp(text, "CLEAR")) {
    clearAll();
    return;
  }
  if (!strncmp(text, "IDLE ", 5)) {
    idleMode = atoi(text + 5) == 1;
    nextIdle = millis();
    return;
  }
  if (!strncmp(text, "CAL ", 4)) {
    clearAll();
    calibration = atoi(text + 4) - 1;
    if (calibration > 7) calibration = -1;
    return;
  }
  int channel = 0;
  char color = 'W';
  if (sscanf(text, "PULSE %d %c", &channel, &color) == 2) {
    if (channel >= 1 && channel <= 8) startPulse(channel - 1, color);
    return;
  }
  int mask = 0;
  if (sscanf(text, "FILL %d %c", &mask, &color) == 2) {
    for (uint8_t ch = 0; ch < 8; ch++)
      if (mask & (1 << ch)) baseColor[ch] = rgb(color);
    return;
  }
}
void receive(char *text) {
  if (!strcmp(text, "IDENTIFY") || !strcmp(text, "HELLO")) {
    identify();
    return;
  }
  if (strncmp(text, "FRAME ", 6)) return;
  char *commands;
  unsigned long sequence = strtoul(text + 6, &commands, 10);
  char *save = nullptr;
  char *part = strtok_r(commands, ";", &save);
  while (part) {
    command(part);
    part = strtok_r(nullptr, ";", &save);
  }
  lastFrame = millis();
  watchdogCleared = false;
  render();
  // ACK is deliberately AFTER show(): the host can now safely send the next frame.
  Serial.print(F("ACK FRAME "));
  Serial.println(sequence);
}
void setup() {
  Serial.begin(115200);  // Required: game commands and controller identification use USB serial.
  for (uint8_t ch = 0; ch < 8; ch++) {
    digitalWrite(LINE_PINS[ch], LOW);
    pinMode(LINE_PINS[ch], OUTPUT);
  }
  strip.begin();
  strip.setBrightness(255);
  clearAll();
  render();
  randomSeed(analogRead(A2));
  identify();
}
void loop() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\r') continue;
    if (c == '\n') {
      if (!overflow) {
        inputLine[inputLength] = '\0';
        receive(inputLine);
      }
      inputLength = 0;
      overflow = false;
    } else if (inputLength < sizeof(inputLine) - 1) inputLine[inputLength++] = c;
    else overflow = true;
  }
  if (!watchdogCleared && millis() - lastFrame > 2000) {
    clearAll();
    render();
    watchdogCleared = true;
  }
}
