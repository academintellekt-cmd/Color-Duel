#include <Adafruit_NeoPixel.h>

const uint8_t LINE_PINS[8]={2,3,4,5,6,7,8,9};
const uint8_t LEDS=60,MAX_PULSES=6;
Adafruit_NeoPixel strip(LEDS,LINE_PINS[0],NEO_GRB+NEO_KHZ800);
struct Pulse{bool active;uint32_t started;uint32_t color;};
Pulse pulses[8][MAX_PULSES];
uint32_t baseColor[8]={0},flashColor[8]={0},flashUntil[8]={0};
String line;

uint32_t rgb(char c){if(c=='R')return strip.Color(255,0,0);if(c=='G')return strip.Color(0,255,50);if(c=='B')return strip.Color(0,80,255);if(c=='Y')return strip.Color(255,180,0);return strip.Color(255,255,255);}
void setPulse(Pulse &pulse,char color){pulse.active=true;pulse.started=millis();pulse.color=rgb(color);}
void startPulse(uint8_t player,char color){if(player<1||player>2||String("RGBY").indexOf(color)<0)return;uint8_t channel=(player-1)*4+(color=='R'?0:color=='G'?1:color=='B'?2:3);for(uint8_t i=0;i<MAX_PULSES;i++){if(!pulses[channel][i].active){setPulse(pulses[channel][i],color);return;}}setPulse(pulses[channel][0],color);}
void flashPlayer(uint8_t player,char color,uint16_t duration){if(player<1||player>2)return;for(uint8_t c=0;c<4;c++){uint8_t ch=(player-1)*4+c;flashColor[ch]=rgb(color);flashUntil[ch]=millis()+duration;}}
void render(){uint32_t now=millis();for(uint8_t ch=0;ch<8;ch++){strip.setPin(LINE_PINS[ch]);strip.clear();if(baseColor[ch])for(uint8_t i=0;i<LEDS;i++)strip.setPixelColor(i,baseColor[ch]);if((int32_t)(flashUntil[ch]-now)>0)for(uint8_t i=0;i<LEDS;i++)strip.setPixelColor(i,flashColor[ch]);for(uint8_t n=0;n<MAX_PULSES;n++){Pulse&p=pulses[ch][n];if(!p.active)continue;uint32_t age=now-p.started;int16_t head=age/22;if(head>=LEDS+8){p.active=false;continue;}for(int8_t tail=0;tail<8;tail++){int16_t pos=head-tail;if(pos>=0&&pos<LEDS){uint8_t scale=255-tail*28,r=(uint8_t)(p.color>>16),g=(uint8_t)(p.color>>8),b=(uint8_t)p.color;strip.setPixelColor(pos,(r*scale)/255,(g*scale)/255,(b*scale)/255);}}}strip.show();}}
void clearAll(){for(uint8_t i=0;i<8;i++){baseColor[i]=0;flashUntil[i]=0;for(uint8_t n=0;n<MAX_PULSES;n++)pulses[i][n].active=false;}}
void selfTest(){const char colors[4]={'R','G','B','Y'};for(uint8_t ch=0;ch<8;ch++){strip.setPin(LINE_PINS[ch]);strip.clear();for(uint8_t i=0;i<LEDS;i++)strip.setPixelColor(i,rgb(colors[ch%4]));strip.show();delay(80);strip.clear();strip.show();}clearAll();Serial.println("SELFTEST OK");}
void command(String s){s.trim();if(s=="IDENTIFY"||s=="HELLO"){Serial.println("COLOR_DUEL_LED READY");return;}if(s=="TEST"){selfTest();return;}if(s.startsWith("CHASE ")&&s.length()>=9){uint8_t player=s.charAt(6)-'0';char color=s.charAt(8);Serial.print("ACK CHASE ");Serial.print(player);Serial.print(' ');Serial.println(color);Serial.flush();startPulse(player,color);return;}if(s.startsWith("FLASH ")){flashPlayer(s.charAt(6)-'0','R',300);return;}if(s.startsWith("ROUND_WIN ")){flashPlayer(s.charAt(10)-'0','G',450);return;}if(s.startsWith("PATTERN ")){for(uint8_t i=0;i<8;i++)baseColor[i]=0;return;}if(s.startsWith("SOLO ")){String colors=s.substring(5);for(uint8_t p=0;p<2;p++)for(uint8_t c=0;c<4;c++)baseColor[p*4+c]=colors.indexOf("RGBY"[c])>=0?rgb("RGBY"[c]):0;return;}if(s.startsWith("MODE ")){clearAll();return;}}
void setup(){Serial.begin(9600);strip.begin();strip.setBrightness(110);strip.show();Serial.println("COLOR_DUEL_LED READY");delay(500);selfTest();}
void loop(){while(Serial.available()){char c=Serial.read();if(c=='\n'){command(line);line="";}else if(c!='\r'&&line.length()<80)line+=c;}render();}
