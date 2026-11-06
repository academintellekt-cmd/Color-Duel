// Standalone test: no game, Gateway, channel mapping or COM commands required.
// D8 is the reference output; D6 and A1 are the outputs under investigation.
// All three controllers use FIXED pins and independent pixel buffers.
#include <Adafruit_NeoPixel.h>

const uint16_t LEDS=60;
Adafruit_NeoPixel reference(LEDS,8,NEO_GRB+NEO_KHZ800);
Adafruit_NeoPixel testD6(LEDS,6,NEO_GRB+NEO_KHZ800);
Adafruit_NeoPixel testA1(LEDS,A1,NEO_GRB+NEO_KHZ800);
Adafruit_NeoPixel* const strips[3]={&reference,&testD6,&testA1};
uint8_t phase=0;
uint32_t nextChange=0;

void setup(){
  Serial.begin(115200);
  // Hold the remaining wired DATA outputs LOW as well.
  const uint8_t pins[8]={8,9,10,11,6,7,A0,A1};
  for(uint8_t i=0;i<8;i++){digitalWrite(pins[i],LOW);pinMode(pins[i],OUTPUT);}
  for(uint8_t i=0;i<3;i++){strips[i]->begin();strips[i]->setBrightness(32);strips[i]->clear();strips[i]->show();}
  Serial.println(F("STANDALONE LED PIN TEST: D8, D6, A1"));
}
void loop(){
  const uint32_t now=millis();if((int32_t)(now-nextChange)<0)return;nextChange=now+2000;
  uint32_t color=0;
  if(phase==0){color=reference.Color(255,0,0);Serial.println(F("RED"));}
  else if(phase==1){color=reference.Color(0,255,0);Serial.println(F("GREEN"));}
  else if(phase==2){color=reference.Color(0,0,255);Serial.println(F("BLUE"));}
  else if(phase==3){color=reference.Color(255,255,255);Serial.println(F("WHITE"));}
  else Serial.println(F("OFF"));
  for(uint8_t i=0;i<3;i++){for(uint16_t pixel=0;pixel<LEDS;pixel++)strips[i]->setPixelColor(pixel,color);strips[i]->show();}
  phase=(phase+1)%5;
}
