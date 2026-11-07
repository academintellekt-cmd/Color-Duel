// Standalone Arduino Nano / ATmega328P test. No PC commands required.
// One white comet runs from the first LED to the last on each output.
#include <Adafruit_NeoPixel.h>

const uint8_t LINE_PINS[] = {6, 7, 8, 9, 10, 11, 12, 13, 14, 15};
const uint8_t LINE_COUNT = sizeof(LINE_PINS) / sizeof(LINE_PINS[0]);
const uint16_t LED_COUNT = 60;  // Change to the number of LEDs on each strip.
const uint8_t TAIL_LENGTH = 6;
const uint16_t STEP_MS = 25;
const uint16_t BETWEEN_LINES_MS = 250;

static_assert(A0 == 14 && A1 == 15, "Select Arduino Nano / ATmega328P: A0=14, A1=15");

Adafruit_NeoPixel strip(LED_COUNT, LINE_PINS[0], NEO_GRB + NEO_KHZ800);

void selectLine(uint8_t pin) {
  const int16_t previousPin = strip.getPin();
  if (previousPin != pin) {
    // setPin releases the old output to INPUT; keep it driven LOW instead.
    strip.setPin(pin);
    digitalWrite(previousPin, LOW);
    pinMode(previousPin, OUTPUT);
  }
}

void setup() {
  Serial.begin(115200);
  for (uint8_t line = 0; line < LINE_COUNT; line++) {
    digitalWrite(LINE_PINS[line], LOW);
    pinMode(LINE_PINS[line], OUTPUT);
  }
  strip.begin();
  strip.setBrightness(80);
  for (uint8_t line = 0; line < LINE_COUNT; line++) {
    selectLine(LINE_PINS[line]);
    strip.clear();
    strip.show();
  }
  Serial.println(F("CHASE TEST: 6,7,8,9,10,11,12,13,14(A0),15(A1)"));
}

void loop() {
  for (uint8_t line = 0; line < LINE_COUNT; line++) {
    selectLine(LINE_PINS[line]);
    Serial.print(F("PIN "));
    Serial.println(LINE_PINS[line]);

    // Continue past the last LED until the entire tail has left the strip.
    for (uint16_t head = 0; head < LED_COUNT + TAIL_LENGTH; head++) {
      strip.clear();
      for (uint8_t tail = 0; tail < TAIL_LENGTH; tail++) {
        const int16_t pixel = (int16_t)head - tail;
        if (pixel >= 0 && pixel < LED_COUNT) {
          const uint8_t brightness = 255 / (tail + 1);
          strip.setPixelColor(pixel, brightness, brightness, brightness);
        }
      }
      strip.show();
      delay(STEP_MS);
    }
    strip.clear();
    strip.show();
    delay(BETWEEN_LINES_MS);
  }
}
