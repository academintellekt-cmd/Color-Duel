#include <HX711.h>

const uint8_t DOUT[8]={2,4,6,8,10,12,A0,A2};
const uint8_t SCK_PINS[8]={3,5,7,9,11,13,A1,A3};
const char COLORS[4]={'R','G','B','Y'};
HX711 scales[8];long baseline[8];long threshold[8]={12000,12000,12000,12000,12000,12000,12000,12000};bool latched[8];uint32_t lastHit[8];String line;
void calibrate(){
  for(uint8_t i=0;i<8;i++){
    long sum=0;uint8_t samples=0;
    for(uint8_t k=0;k<10;k++){
      if(scales[i].wait_ready_timeout(25)){sum+=scales[i].read();samples++;}
    }
    baseline[i]=samples?sum/samples:0;
  }
}
void command(String s){s.trim();if(s=="IDENTIFY"||s=="HELLO")Serial.println("COLOR_DUEL_SENSORS READY");else if(s=="TARE"){calibrate();Serial.println("TARE OK");}else if(s.startsWith("THRESHOLD ")){int ch,val;if(sscanf(s.c_str(),"THRESHOLD %d %d",&ch,&val)==2&&ch>=1&&ch<=8)threshold[ch-1]=val;}}
void setup(){
  Serial.begin(115200);
  for(uint8_t i=0;i<8;i++){
    scales[i].begin(DOUT[i],SCK_PINS[i]);
    pinMode(DOUT[i],INPUT_PULLUP); // disconnected HX711 stays safely NOT READY
  }
  Serial.println("COLOR_DUEL_SENSORS READY");
  delay(200);
  calibrate();
  Serial.println("COLOR_DUEL_SENSORS READY");
}
void loop(){while(Serial.available()){char c=Serial.read();if(c=='\n'){command(line);line="";}else if(c!='\r'&&line.length()<60)line+=c;}uint32_t now=millis();for(uint8_t i=0;i<8;i++){if(!scales[i].is_ready())continue;long force=labs(scales[i].read()-baseline[i]);if(force>threshold[i]&&!latched[i]&&now-lastHit[i]>90){latched[i]=true;lastHit[i]=now;Serial.print("HIT ");Serial.print(i<4?1:2);Serial.print(' ');Serial.print(COLORS[i%4]);Serial.print(' ');Serial.println(force);}else if(force<threshold[i]/3)latched[i]=false;}}
