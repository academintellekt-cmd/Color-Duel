const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path'), fs = require('fs');
const { pathToFileURL } = require('url');
const { DeviceSerial } = require('./lib/device-serial');
const { StrivexSession } = require('./lib/strivex-session');
const { DemoGateway } = require('./lib/demo-gateway');
const { Technician, Lighting } = require('./lib/technician');
const { LedSerial } = require('./lib/led-serial');
const { SerialPort } = require('serialport');
const enabled = name => /^(1|true|yes|on)$/i.test(process.env[name] || '');
const designMode = !app.isPackaged && enabled('COLOR_DUEL_DESIGN_MODE');
const previewMode = designMode || enabled('COLOR_DUEL_INTERFACE_TEST');
// Preview records, language and instance lock are independent of the real game.
if (previewMode) app.setPath('userData', path.join(app.getPath('appData'), 'Color-Duel-Preview'));
let controlWindow, playerWindow, ledDevice, sensorDevice, strivex, runtimeConfig, stopDesignWatch, lastState, technician, lighting;
let ledChange=Promise.resolve();
if (!app.requestSingleInstanceLock()) app.quit();
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
function audioFiles(root, folder) {
  try { return fs.readdirSync(path.resolve(root, folder), { withFileTypes: true }).filter(e => e.isFile() && /\.(mp3|wav|ogg|m4a|aac)$/i.test(e.name)).map(e => pathToFileURL(path.resolve(root, folder, e.name)).href); } catch { return []; }
}
function loadConfig() {
  const base = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
  const root = app.isPackaged ? path.dirname(process.execPath) : __dirname;
  const external = path.join(root, 'config.json');
  const custom = app.isPackaged && fs.existsSync(external) ? JSON.parse(fs.readFileSync(external, 'utf8')) : {};
  const c = { ...base, ...custom };
  for (const key of ['ledSerial', 'sensorSerial', 'strivex', 'audio']) c[key] = { ...base[key], ...custom[key] };
  c.interfaceTestMode = previewMode;
  c.designMode = designMode;
  if (previewMode) {
    c.sensorSerial.enabled = false; c.ledSerial.enabled = false;
    c.strivex = { ...c.strivex, enabled: true, developmentMode: true, demoLobby: true };
  }
  c.audio.menuPlaylist = audioFiles(root, c.audio.menuPlaylistFolder);
  c.audio.gamePlaylist = audioFiles(root, c.audio.gamePlaylistFolder);
  c.audio.gamePlaylists = {};
  for (const [mode, folder] of Object.entries(c.audio.gamePlaylistFolders || {})) c.audio.gamePlaylists[mode] = audioFiles(root, folder);
  c.audio.colorRingLaunches = {};
  for (const [player, folder] of Object.entries(c.audio.colorRingLaunchFolders || {})) c.audio.colorRingLaunches[player] = audioFiles(root, folder);
  c.audio.colorRingRemovals = audioFiles(root, c.audio.colorRingRemovalFolder);
  for (const key of ['button', 'bonus', 'pingPongHit', 'pingPongMiss', 'countdown', 'startCountdown', 'end']) if (c.audio[key]) c.audio[key] = pathToFileURL(path.resolve(root, c.audio[key])).href;
  for (const [key, value] of Object.entries(c.audio.colors || {})) c.audio.colors[key] = pathToFileURL(path.resolve(root, value)).href;
  return c;
}
function pickDisplays(c) {
  const all = screen.getAllDisplays(), primary = screen.getPrimaryDisplay(), secondary = all.find(x => x.id !== primary.id) || primary;
  return { control: c.controlDisplayIndex === 'primary' ? primary : all[c.controlDisplayIndex] || primary, player: c.playerDisplayIndex === 'secondary' ? secondary : all[c.playerDisplayIndex] || secondary };
}
function windowAt(display, file, c) {
  const bounds = designMode ? require('./lib/design-mode').designBounds(screen.getPrimaryDisplay().workArea, file === 'control.html') : display.bounds;
  const w = new BrowserWindow({
    ...bounds, frame: designMode, resizable: true, fullscreen: !designMode && !!c.kiosk, kiosk: !designMode && !!c.kiosk,
    title: `Color Duel${designMode ? ' — Preview' : ''} — ${file === 'control.html' ? 'Control' : 'Player'}`,
    autoHideMenuBar: true, backgroundColor: '#07101a',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
  });
  if (previewMode) {
    let bracelet = '';
    const keys = { Q: [0, 'red'], W: [0, 'green'], E: [0, 'blue'], R: [0, 'yellow'], U: [1, 'red'], I: [1, 'green'], O: [1, 'blue'], P: [1, 'yellow'] };
    w.webContents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown' || input.isAutoRepeat) return;
      if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
        event.preventDefault(); w.webContents.toggleDevTools(); return;
      }
      if (input.control || input.alt || input.meta) return;
      if(technician?.staff)return;
      const hit = keys[input.key.toUpperCase()];
      if (hit) { event.preventDefault(); emit('test-hit', hit); return; }
      if (/^[0-9]$/.test(input.key)) bracelet = (bracelet + input.key).slice(-6);
      else if (input.key === 'Enter' && bracelet) { strivex.tap?.(bracelet); bracelet = ''; }
      else if (input.key === 'Backspace') bracelet = bracelet.slice(0, -1);
      else if (input.key === 'Escape') bracelet = '';
    });
    if (file === 'control.html') w.webContents.on('did-start-loading', () => { lastState = null; strivex.resetPreview?.(); });
  }
  if (designMode) w.on('close', () => setImmediate(() => app.quit()));
  w.webContents.on('did-finish-load', () => {
    if (file === 'player.html' && lastState) w.webContents.send('state-update', lastState);
    if(technician)w.webContents.send('tech-state',technician.snapshot());
  });
  w.loadFile(path.join(__dirname, 'public', file));
  return w;
}
function emit(channel, data) { controlWindow?.webContents.send(channel, data); }
function setupStrivex(c) {
  const demo = !!(c.strivex.demoLobby && c.strivex.developmentMode);
  strivex = demo ? new DemoGateway({ paidSeconds: 300 }) : new StrivexSession({ host: '127.0.0.1', port: c.strivex.wsPort || 4210, game: 'color-duel', version: app.getVersion(), protocol: 1 });
  for (const type of ['unlock', 'lock', 'expired', 'lobby', 'scan']) strivex.on(type, x => emit('strivex-event', { type, ...x }));
  strivex.on('tick', remainingMs => emit('strivex-event', { type: 'tick', remainingMs }));
  strivex.on('start-denied', x => emit('strivex-event', { type: 'start_denied', ...x }));
  strivex.on('connection', x => emit('strivex-status', { ...strivex.snapshot(), ...x }));
  strivex.on('listening', () => emit('strivex-status', strivex.snapshot()));
  strivex.on('error', e => emit('strivex-status', { ...strivex.snapshot(), error: e.message }));
  strivex.on('technician',message=>technician.gateway(message));
  strivex.on('profile',x=>emit('strivex-event',{type:'profile',...x}));strivex.on('avatar-saved',x=>emit('strivex-event',{type:'avatar_saved',...x}));strivex.start();
  ipcMain.handle('strivex-snapshot', () => ({ ...strivex.snapshot(), enabled: c.strivex.enabled, developmentMode: c.strivex.developmentMode }));
  ipcMain.on('strivex-final', (_e, x) => strivex.reportResult(Number(x.number) || 0, x.status || 'completed', x.meta || {}));
  ipcMain.on('strivex-lobby', (_e, x) => {
    if (x?.type === 'start') strivex.lobbyStart({ mode: x.mode, variant: x.variant, difficulty: x.difficulty, durationMinutes: x.durationMinutes });
    else if (x?.type === 'remove') strivex.lobbyRemove(String(x.uid || ''));
    else if (x?.type === 'reset') strivex.lobbyReset();
    else if (x?.type === 'demo-reset' && previewMode) strivex.resetPreview?.();
    else if(x?.type==='profile'&&typeof strivex.requestProfile==='function')strivex.requestProfile(String(x.uid||''));else if(x?.type==='avatar_save'&&typeof strivex.saveAvatar==='function')strivex.saveAvatar(String(x.uid||''),x.avatar);else if(x?.type==='demo-tap' && demo) strivex.tap(String(x.code || ''));
  });
  ipcMain.on('strivex-simulate', (_e, x) => {
    if (c.strivex.developmentMode && x.type === 'start') strivex.unlock?.({ session_id: `SIM-${Date.now()}`, user: { uid: 'SIM', name: 'Test Player' }, paid_seconds: x.paid_seconds || 300 });
  });
}
app.whenReady().then(async () => {
  runtimeConfig = loadConfig();
  technician=new Technician({file:path.join(app.getPath('userData'),'technician-settings.json'),preview:previewMode,language:runtimeConfig.language,ledPort:previewMode||runtimeConfig.ledSerial.enabled===false?'off':runtimeConfig.ledSerial.port||'auto'});
  lighting=new Lighting(command=>ledDevice?.send(command),technician);
  technician.on('change',snapshot=>{for(const w of[controlWindow,playerWindow])w?.webContents.send('tech-state',snapshot)});
  technician.on('enter',()=>emit('technician-enter',{}));
  technician.on('settings',()=>lighting.update(lastState||{phase:'lobby'},true));
  technician.on('hit',(player,color)=>emit('test-hit',[player,color]));
  technician.on('port',port=>{ledChange=ledChange.then(()=>configureLed(port)).catch(error=>{technician.error=error.message;technician.publish()})});
  technician.on('ports',()=>refreshPorts());
  technician.on('gateway-command',action=>{if(!strivex.technicianCommand(action))throw Error('GATEWAY_OFFLINE')});
  const d = pickDisplays(runtimeConfig);
  setupStrivex(runtimeConfig);
  const used = () => [ledDevice?.path, sensorDevice?.path];
  sensorDevice = new DeviceSerial(runtimeConfig.sensorSerial, used);
  sensorDevice.on('status', s => emit('device-status', { device: 'sensor', ...s }));
  sensorDevice.on('line', line => emit('sensor-line', line));
  ipcMain.handle('get-config', () => runtimeConfig);
  ipcMain.on('state-update', (event, s) => {
    if (event.sender !== controlWindow?.webContents) return;
    lastState = s; playerWindow?.webContents.send('state-update', s);lighting.update(s);
  });
  ipcMain.on('led-command', (event,x)=>{
    if(event.sender!==controlWindow?.webContents||technician.staff||technician.blocked)return;
    const match=String(x).match(/^CHASE ([12]) ([RGBY])$/);if(match)lighting.pulse((Number(match[1])-1)*4+'RGBY'.indexOf(match[2]),({R:'red',G:'green',B:'blue',Y:'yellow'})[match[2]]);
  });
  ipcMain.handle('tech-snapshot',()=>technician.snapshot());
  ipcMain.handle('tech-command',(_event,command)=>{try{return technician.command(command)}catch(error){technician.error=error.message;technician.publish();return technician.snapshot()}});
  ipcMain.on('gamepad-buttons',(event,indices)=>{if(event.sender!==controlWindow?.webContents||!Array.isArray(indices)||indices.length>128)return;try{technician.rawButtons(indices)}catch(error){technician.error=error.message;technician.publish()}});
  controlWindow = windowAt(d.control, 'control.html', runtimeConfig); playerWindow = windowAt(d.player, 'player.html', runtimeConfig);
  if (designMode) stopDesignWatch = require('./lib/design-mode').watchDesign(__dirname, () => [controlWindow, playerWindow]);
  await configureLed(technician.settings.ledPort);await sensorDevice.start();await refreshPorts();
});
async function refreshPorts(){try{technician.ports=(await SerialPort.list()).map(p=>p.path);technician.publish()}catch(error){technician.error=error.message;technician.publish()}}
async function configureLed(port){
  await ledDevice?.stop();
  ledDevice=new LedSerial({...runtimeConfig.ledSerial,enabled:port!=='off',port},()=>[sensorDevice?.path]);
  technician.led={connected:false,path:port};technician.publish();
  ledDevice.on('status',status=>{technician.led=status;technician.publish();emit('device-status',{device:'led',...status});if(status.connected)lighting.update(lastState||{phase:'lobby'},true)});
  await ledDevice.start();
}
app.on('second-instance', () => { if (controlWindow) { if (controlWindow.isMinimized()) controlWindow.restore(); controlWindow.focus(); } });
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { stopDesignWatch?.(); ledDevice?.stop(); sensorDevice?.stop(); strivex?.stop(); });
