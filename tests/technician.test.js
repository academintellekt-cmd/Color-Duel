const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path'),{EventEmitter}=require('events');
const{Technician,Lighting}=require('../lib/technician');
const{LedSerial}=require('../lib/led-serial');
const staff={employee_id:'tech-1',role:'technician',name:'Technician'};
test('settings require a technician, persist on disk and keep button bindings unique',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'color-tech-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'settings.json'),tech=new Technician({file,preview:true});
  assert.throws(()=>tech.command({type:'capture',slot:0}),/bracelet/);
  tech.gateway({staff});tech.command({type:'capture',slot:0});tech.rawButtons([7]);
  assert.deepEqual(tech.settings.buttons,[7,1,2,3,4,5,6,0]);
  tech.command({type:'port',port:'COM17'});tech.command({type:'language',language:'de'});
  const restored=new Technician({file,preview:true});assert.deepEqual(restored.settings,tech.settings);
  assert.throws(()=>tech.command({type:'port',port:'../bad'}));assert.equal(tech.settings.ledPort,'COM17');
});
test('technician counters wrap after 15 and capture accepts buttons beyond the first eight',()=>{
  const tech=new Technician({preview:true});tech.gateway({staff});
  tech.command({type:'capture',slot:4});tech.rawButtons([23]);assert.equal(tech.settings.buttons[4],23);assert.equal(tech.capture,null);
  for(let i=0;i<15;i++)tech.rawButtons([23]);assert.equal(tech.counters[4],15);
  tech.rawButtons([23]);assert.equal(tech.counters[4],0);
  tech.rawButtons([23]);assert.equal(tech.counters[4],1);
  const hits=[];tech.on('hit',(...hit)=>hits.push(hit));tech.gateway({staff:null});tech.rawButtons([23,0]);
  assert.deepEqual(hits,[[1,'red'],[0,'red']]);
  tech.gateway({staff:null,blocked:true});tech.rawButtons([23]);assert.equal(hits.length,2);
});
test('calibration commits exactly eight distinct corners and cancellation keeps old mapping',()=>{
  const tech=new Technician({preview:true}),channels=[];tech.on('calibrate',n=>channels.push(n));tech.gateway({staff});
  assert.throws(()=>tech.command({type:'calibrate'}),/LED_NOT_CONNECTED/);
  tech.led={connected:true};tech.command({type:'calibrate'});tech.command({type:'corner',slot:7});
  assert.throws(()=>tech.command({type:'corner',slot:7}),/CORNER_USED/);
  assert.deepEqual(tech.settings.channels,[0,1,2,3,4,5,6,7]);
  tech.command({type:'cancel'});assert.equal(tech.calibration,null);
  tech.command({type:'calibrate'});for(let channel=0;channel<8;channel++)tech.command({type:'corner',slot:7-channel});
  assert.deepEqual(tech.settings.channels,[7,6,5,4,3,2,1,0]);assert.equal(tech.calibration,null);assert.equal(channels.at(-1),-1);
});
test('lighting uses physical channel assignments and holds winner/loser colors through results',()=>{
  const tech=new Technician({preview:true}),sent=[],light=new Lighting(c=>sent.push(c),tech);
  tech.save({channels:[7,6,5,4,3,2,1,0]});light.pulse(0,'red');light.pulse(4,'green');
  assert.deepEqual(sent,['PULSE 8 R','PULSE 4 G']);
  light.update({phase:'gameover',mode:'combination',scores:[2,1]});
  assert.deepEqual(sent.slice(-3),['CLEAR','FILL 240 G','FILL 15 R']);const length=sent.length;
  light.update({phase:'results',mode:'combination',scores:[2,1]});light.update({phase:'leaderboard',mode:'combination',scores:[2,1]});assert.equal(sent.length,length);
  tech.gateway({staff:null,blocked:false});assert.equal(sent.length,length,'heartbeat must not clear result lighting');
  light.update({phase:'lobby'});assert.deepEqual(sent.slice(-2),['CLEAR','IDLE 1']);
  tech.gateway({staff,blocked:true});assert.equal(light.phase,'technician');assert.equal(sent.at(-1),'IDLE 0');
});
test('rhythm winner prefers accuracy, then score; a draw lights both players white',()=>{
  const tech=new Technician(),sent=[],light=new Lighting(c=>sent.push(c),tech);
  light.update({phase:'results',mode:'rhythm',accuracy:[.9,.95],scores:[99,10]});assert.deepEqual(sent.slice(-2),['FILL 15 R','FILL 240 G']);
  light.update({phase:'results',mode:'rhythm',accuracy:[.9,.9],scores:[11,10]});assert.deepEqual(sent.slice(-2),['FILL 15 G','FILL 240 R']);
  light.update({phase:'results',mode:'rhythm',accuracy:[.9,.9],scores:[10,10]});assert.deepEqual(sent.slice(-2),['FILL 15 W','FILL 240 W']);
});
test('LED transport batches simultaneous pulses and waits for the matching frame ACK',async()=>{
  const led=new LedSerial({enabled:false}),writes=[],port=new EventEmitter();port.isOpen=true;port.write=(value,cb)=>{writes.push(value);cb()};port.close=cb=>{port.isOpen=false;cb()};led.port=port;
  for(let i=1;i<=8;i++)led.send(`PULSE ${i} R`);led.flush();
  assert.equal(writes.length,1);assert(writes[0].includes('PULSE 1 R;PULSE 2 R'));assert(writes[0].includes('PULSE 8 R'));
  led.send('PULSE 1 G');led.flush();assert.equal(writes.length,1);
  led.emit('line','ACK FRAME 999');led.flush();assert.equal(writes.length,1);
  led.emit('line','ACK FRAME 1');led.flush();assert.equal(writes.length,2);assert(writes[1].startsWith('FRAME 2 PULSE 1 G'));
  await led.stop();
});
