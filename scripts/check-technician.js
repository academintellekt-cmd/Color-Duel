const{app,BrowserWindow,ipcMain}=require('electron');
const{EventEmitter}=require('events'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
app.disableHardwareAcceleration();
const root=path.join(__dirname,'..'),out=path.join(root,'visual-check');fs.mkdirSync(out,{recursive:true});
app.setPath('appData',fs.mkdtempSync(path.join(app.getPath('temp'),'color-tech-ui-')));process.env.COLOR_DUEL_DESIGN_MODE='true';
const commands=[],errors=[];let latest,control,player;
class TestLed extends EventEmitter{
  constructor(config){super();this.config=config;this.path=config.port}
  async start(){if(this.config.enabled)this.emit('status',{connected:true,path:this.path,identity:'COLOR_DUEL_LED_V2'})}
  async stop(){}
  send(command){commands.push(command)}
}
require('../lib/led-serial');require.cache[require.resolve('../lib/led-serial')].exports={LedSerial:TestLed};
require('../lib/design-mode').watchDesign=()=>()=>{};
const original=ipcMain.handle.bind(ipcMain);
ipcMain.handle=(channel,handler)=>original(channel,async(...args)=>{const value=await handler(...args);return channel==='get-config'?{...value,audio:{...value.audio,enabled:false},durationOptionsMinutes:[.06],countdownSeconds:1,gameOverSeconds:.2,resultSeconds:.3,leaderboardSeconds:.3}:value});
ipcMain.on('state-update',(_e,state)=>{latest=state});
app.on('web-contents-created',(_e,wc)=>wc.on('console-message',e=>{if(e.level==='error'&&!e.message.includes('ERR_FILE_NOT_FOUND'))errors.push(e.message)}));
app.on('browser-window-created',(_e,w)=>{w.hide();w.webContents.setBackgroundThrottling(false)});
require('../main');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<400;i++){if(await fn())return;await pause(20)}throw Error('Timed out: '+label)}
const run=(code,w=control)=>w.webContents.executeJavaScript(code);
const click=(selector,w=control)=>run(`document.querySelector(${JSON.stringify(selector)}).click();true`,w);
const snapshot=()=>run('window.colorDuel.getTechnician()');
async function key(w,keyCode){w.webContents.sendInputEvent({type:'keyDown',keyCode});w.webContents.sendInputEvent({type:'keyUp',keyCode});await pause(25)}
async function scan(code,w=control){for(const digit of code)await key(w,digit);await key(w,'Return')}
async function press(indices,release=true){await run(`window.testPad.buttons.forEach((b,i)=>b.pressed=${JSON.stringify(indices)}.includes(i));true`);await pause(40);if(release){await run('window.testPad.buttons.forEach(b=>b.pressed=false);true');await pause(35)}}
async function capture(file,w){await pause(100);fs.writeFileSync(path.join(out,file+'.png'),(await w.webContents.capturePage()).toPNG())}
const timeout=setTimeout(()=>{console.error('Technician UI timed out',errors);app.exit(1)},65000);
app.whenReady().then(async()=>{try{
  await until(()=>latest&&BrowserWindow.getAllWindows().length===2,'loaded');
  control=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('control.html'));
  player=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('player.html'));
  control.setContentSize(440,1000);player.setContentSize(1280,720);
  await run(`window.testPad={index:0,id:'USB technician test',connected:true,buttons:Array.from({length:24},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{value:()=>[window.testPad],configurable:true});true`);
  await pause(80);await scan('111');await scan('222',player);await click('[data-lobby-start]');await until(()=>latest.phase==='game','running game');
  await scan('777',player);await until(async()=>(await snapshot()).staff&&latest.phase==='lobby'&&!latest.sessionId,'tech interrupts game');
  assert.equal(await run(`document.querySelector('.tech-screen').innerText`),await run(`document.querySelector('.tech-screen').innerText`,player),'same information on both screens');
  await click('[data-tech="capture"][data-slot="0"]',player);
  assert.equal(await run(`!!document.querySelector('.tech-modal')`),true);
  await press([15]);await until(async()=>(await snapshot()).settings.buttons[0]===15,'capture button 16');
  assert.equal((await snapshot()).capture,null);
  await press([15],false);await pause(100);assert.equal((await snapshot()).counters[0],1,'holding does not repeat');await press([]);
  for(let i=0;i<14;i++)await press([15]);assert.equal((await snapshot()).counters[0],15);
  await press([15]);assert.equal((await snapshot()).counters[0],0);
  await run(`document.querySelector('[data-port]').value='COM99';true`);await click('[data-tech="port"]');
  await until(async()=>(await snapshot()).led.connected,'test LED connected');
  await click('[data-tech="calibrate"]');assert.equal(commands.at(-1),'CAL 1');
  for(let channel=0;channel<8;channel++)await click(`[data-tech="corner"][data-slot="${7-channel}"]`,channel%2?player:control);
  await until(async()=>(await snapshot()).calibration===null,'calibration completed');
  assert.deepEqual((await snapshot()).settings.channels,[7,6,5,4,3,2,1,0]);
  await click('[data-tech="corner"][data-slot="3"]');assert(commands.includes('PULSE 5 W'),'click tests the assigned physical strip');
  await press([15,4]);assert(commands.includes('PULSE 8 R')&&commands.includes('PULSE 4 R'),'mapped button LEDs');
  await run(`const select=document.querySelector('[data-tech-language]');select.value='en';select.dispatchEvent(new Event('change',{bubbles:true}));true`,player);
  await until(()=>run(`document.querySelector('.tech-header h1').textContent==='Technician mode'`),'language sync');
  await run(`const select=document.querySelector('[data-tech-language]');select.value='ru';select.dispatchEvent(new Event('change',{bubbles:true}));true`);
  await until(()=>run(`document.querySelector('.tech-header h1').textContent==='Режим техника'`),'Russian restored');
  await capture('technician-portrait',control);await capture('technician-landscape',player);
  await click('[data-tech="calibrate"]');await capture('technician-calibration',player);await click('[data-tech="cancel"]');
  await click('[data-tech="capture"][data-slot="6"]');await capture('technician-button-capture',control);await click('[data-tech="cancel"]');
  await click('[data-tech="block"]');await until(async()=>(await snapshot()).blocked,'block');
  await click('[data-tech="close"]',player);await until(()=>run(`!!document.querySelector('.tech-blocked')`),'blocked screen');
  await scan('777');await until(async()=>(await snapshot()).staff,'entry when blocked');await click('[data-tech="unblock"]');
  await until(async()=>!(await snapshot()).blocked,'unblocked');
  const saved=(await snapshot()).settings;
  const disk=JSON.parse(fs.readFileSync(path.join(app.getPath('userData'),'technician-settings.json')));assert.deepEqual(disk,saved);
  control.webContents.reloadIgnoringCache();await until(()=>run(`!!document.querySelector('.tech-screen')`),'tech survives renderer reload');
  assert.deepEqual((await snapshot()).settings,saved);
  await run(`window.testPad={index:0,id:'USB technician test',connected:true,buttons:Array.from({length:24},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{value:()=>[window.testPad],configurable:true});true`);await pause(70);
  await click('[data-tech="close"]');await until(async()=>!(await snapshot()).staff,'closed');
  await scan('111');await scan('222');await click('[data-lobby-start]');await until(()=>latest.phase==='game','next round');
  let target=[...latest.target];for(const color of target){const slot=['red','green','blue','yellow'].indexOf(color);await press([saved.buttons[slot]])}
  assert.equal(latest.scores[0],1,'assigned buttons work in a real round');
  await until(()=>latest.phase==='results','results');
  assert(commands.includes('FILL 240 G')&&commands.includes('FILL 15 R'),'winner green, loser red on remapped channels');
  await until(()=>latest.phase==='lobby','back to idle');assert.equal(commands.at(-1),'IDLE 1');
  assert.deepEqual(errors,[]);
  console.log('PASS: tech bracelet during game; both windows; capture any USB button; hold/duplicate counters 0–15; port change; eight-channel calibration and pulse test; languages; block/unblock and entry while blocked; persistence; assigned game buttons; result and idle lighting.');
  clearTimeout(timeout);app.quit();
}catch(error){console.error(error,errors);clearTimeout(timeout);app.exit(1)}});
