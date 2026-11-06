// Exercise the actual main/preload/renderers. No installer or real hardware.
const { app, BrowserWindow, ipcMain } = require('electron');
app.disableHardwareAcceleration();
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const root = path.join(__dirname, '..'), output = path.join(root, 'visual-check');
fs.mkdirSync(output, { recursive: true });
app.setPath('appData', fs.mkdtempSync(path.join(app.getPath('temp'), 'color-duel-preview-')));
process.env.COLOR_DUEL_DESIGN_MODE = 'true';
const originalHandle = ipcMain.handle.bind(ipcMain);
let actualConfig, captureDefaults = false;
const normalWindows = new Set();
ipcMain.handle = (channel, handler) => originalHandle(channel, async (...args) => {
  const value = await handler(...args);
  if (channel !== 'get-config') return value;
  if (normalWindows.has(args[0].sender.id)) return { ...value, interfaceTestMode: false, designMode: false, audio: { ...value.audio, enabled: false } };
  actualConfig = value;
  if (captureDefaults) return { ...value, audio: { ...value.audio, enabled: false } };
  // Fast real rounds; only this test process receives the shortened timings.
  return { ...value, audio: { ...value.audio, enabled: false }, durationOptionsMinutes: [.03, 1, 2], countdownSeconds: 1, gameOverSeconds: .15, resultSeconds: .15, leaderboardSeconds: .15 };
});
let latest, control, player;
const states = [], errors = [];
ipcMain.on('state-update', (_e, state) => { latest = state; states.push(state); });
app.on('web-contents-created', (_e, wc) => {
  wc.on('console-message', event => { if (event.level === 'error' && !event.message.includes('ERR_FILE_NOT_FOUND')) errors.push(event.message); });
  wc.on('render-process-gone', (_event, details) => errors.push(JSON.stringify(details)));
});
app.on('browser-window-created', (_e, w) => { w.hide(); w.webContents.setBackgroundThrottling(false); });
require('../main');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, label) {
  for (let i = 0; i < 400; i++) { if (await fn()) return; await pause(25); }
  throw Error(`Timed out: ${label}; phase=${latest?.phase}`);
}
const run = code => control.webContents.executeJavaScript(code);
const click = selector => run(`document.querySelector(${JSON.stringify(selector)}).click();true`);
async function key(w, keyCode) {
  w.webContents.sendInputEvent({ type: 'keyDown', keyCode });
  w.webContents.sendInputEvent({ type: 'keyUp', keyCode });
  await pause(25);
}
async function bracelet(w, code) { for (const digit of code) await key(w, digit); await key(w, 'Return'); }
async function capture(name, w) { await pause(90); fs.writeFileSync(path.join(output, `${name}.png`), (await w.webContents.capturePage()).toPNG()); }
const timeout = setTimeout(() => { console.error('Preview check timed out', errors); app.exit(1); }, 60000);
app.whenReady().then(async () => {
  try {
    await until(() => latest && BrowserWindow.getAllWindows().length === 2, 'windows');
    control = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().endsWith('control.html'));
    player = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().endsWith('player.html'));
    await until(() => player.webContents.executeJavaScript(`!!document.querySelector('.preview-badge')`), 'player loaded');
    assert(actualConfig.designMode && actualConfig.interfaceTestMode && actualConfig.strivex.demoLobby);
    assert.equal(actualConfig.ledSerial.enabled, false); assert.equal(actualConfig.sensorSerial.enabled, false);
    assert(!control.isKiosk() && !control.isFullScreen());
    control.setContentSize(440, 850); player.setContentSize(960, 540);
    await click('[data-collapse]');
    await run(`window.previewTestPad={index:0,id:'Preview test USB',connected:true,buttons:Array.from({length:8},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{value:()=>[window.previewTestPad],configurable:true});true`);
    await until(()=>run(`document.querySelector('[data-gamepad-status]')?.textContent.includes('Preview test USB')`),'preview gamepad detected');
    await bracelet(control, '111'); await bracelet(player, '222');
    await until(() => latest.lobbyPlayers.length === 2, 'bracelets in both windows');
    assert.deepEqual(latest.lobbyPlayers.map(p => p.uid), ['DEMO-111', 'DEMO-222']);
    assert.equal(await run(`!!document.querySelector('.lobby-tap')`), false);
    assert.equal(await run(`!!document.querySelector('.lobby-choice')`), false);
    assert((await run(`document.querySelector('.lobby-cols').innerText`)).includes('Уровни'));
    const startTop = await run(`document.querySelector('[data-lobby-start]').getBoundingClientRect().top`);
    await capture('lobby-control', control);
    await click('[data-lobby-remove="DEMO-222"]'); await click('[data-lobby-confirm="yes"]');
    await until(() => latest.lobbyPlayers.length === 1, 'remove player');
    assert.equal(await run(`!!document.querySelector('.lobby-tap')`), true);
    assert(Math.abs(startTop - await run(`document.querySelector('[data-lobby-start]').getBoundingClientRect().top`)) < 2, 'start does not move');
    await bracelet(player, '222');
    await until(() => latest.lobbyPlayers.length === 2, 'rescan');
    for (const mode of ['combination', 'rhythm', 'pingPong', 'colorRing']) {
      if (latest.lobbyPlayers.length !== 2) { await bracelet(control, '111'); await bracelet(player, '222'); }
      await click(`[data-lobby-mode="${mode}"]`);
      const before = states.length;
      await click('[data-lobby-start]');
      await until(() => latest.phase === 'countdown', `${mode} countdown`);
      assert.equal(await run(`!!document.querySelector('[data-lobby-enter],.ready,[data-action="quit"]')`), false);
      await until(() => latest.phase === 'game', `${mode} game`);
      assert(!states.slice(before).some(s => s.phase === 'ready'), 'preview skips wait-for-button');
      assert((await run(`document.querySelector('.timer').innerText`)).startsWith('00:0'), 'round time instead of 5-minute paid session');
      if(mode==='combination'){
        const colorIndex=['red','green','blue','yellow'].indexOf(latest.target[0]);
        await run(`window.previewTestPad.buttons[${colorIndex}].pressed=true;window.previewTestPad.buttons[${colorIndex+4}].pressed=true;true`);
        await until(()=>latest.inputs[0].length===1&&latest.inputs[1].length===1,'both players hit through one gamepad');
        await pause(100);
        assert.deepEqual(latest.inputs.map(x=>x.length),[1,1],'held gamepad buttons never repeat');
        await run(`window.previewTestPad.buttons.forEach(b=>b.pressed=false);true`);
      }
      await key(player, 'Q'); await key(control, 'U');
      await capture(`${mode}-player`, player);
      await until(() => latest.phase === 'lobby', `${mode} complete cycle`);
      assert.equal(latest.lobbyPlayers.length, 0); assert.equal(latest.sessionId, null);
    }
    await click('.preview-toggle');
    for (const phase of ['ready', 'countdown', 'gameover', 'results', 'leaderboard', 'rules', 'lobby']) {
      await click(`[data-preview="${phase}"]`);
      assert.equal(latest.phase, phase === 'rules' ? 'lobby' : phase);
      if (phase === 'results' || phase === 'leaderboard') {
        await click('[data-collapse]'); await capture(`${phase}-control`, control); await capture(`${phase}-player`, player); await click('.preview-toggle');
      }
      if (phase === 'leaderboard') assert.equal(await run(`!!document.querySelector('.language-widget,[data-action="leaders-back"]')`), false);
    }
    await click('[data-preview="run"]');
    await until(() => latest.phase === 'game', 'panel full round');
    control.webContents.reloadIgnoringCache();
    await until(() => latest.phase === 'lobby' && !latest.sessionId, 'reload clears running demo');
    await bracelet(player, '111'); await bracelet(control, '222');
    await until(() => latest.lobbyPlayers.length === 2, 'bracelets after reload');
    // CSS refresh must keep the live lobby and preserve stylesheet cascade order.
    const cssPath = path.join(root, 'public', 'preview.css');
    const css = fs.readFileSync(cssPath);
    fs.writeFileSync(cssPath, css);
    await until(() => run(`!!document.querySelector('link[href*="designRefresh"]')`), 'live CSS refresh');
    assert.equal(latest.lobbyPlayers.length, 2);
    assert.equal(await run(`localStorage.getItem('color-duel.leaderboard')`), null, 'preview never writes the normal leaderboard');
    // Normal renderer keeps its old lobby and start flow without preview UI.
    const normal = new BrowserWindow({ show: false, width: 540, height: 960, webPreferences: { preload: path.join(root, 'preload.js'), contextIsolation: true, nodeIntegration: false } });
    normalWindows.add(normal.webContents.id);
    await normal.loadFile(path.join(root, 'public', 'control.html'));
    await until(() => normal.webContents.executeJavaScript(`!!document.querySelector('[data-lobby-start]')`), 'normal renderer');
    assert.equal(await normal.webContents.executeJavaScript(`!!document.querySelector('.visual-preview,.preview-tools')`), false);
    assert((await normal.webContents.executeJavaScript(`document.body.innerText`)).includes('Настройки'));
    normal.webContents.send('strivex-event', { type: 'unlock', users: [{ uid: 'A', name: 'A' }, { uid: 'B', name: 'B' }], session_id: 'normal-check', paid_seconds: 120 });
    await until(() => normal.webContents.executeJavaScript(`!!document.querySelector('[data-lobby-enter]')`), 'normal enter call remains');
    normal.destroy();
    captureDefaults = true;
    control.webContents.reloadIgnoringCache();
    await until(() => run(`document.querySelector('[data-lobby-duration="3"]') !== null`), 'actual default preview config');
    await bracelet(control, '111'); await bracelet(player, '222');
    await until(() => latest.lobbyPlayers.length === 2, 'final lobby');
    await capture('preview-panel', control);
    await click('[data-collapse]');
    for (const [width, height] of [[360, 640], [440, 850], [1080, 1920]]) {
      control.setContentSize(width, height); await pause(100);
      assert(await run(`['.lobby-cols','.lobby-duel','[data-lobby-start]'].every(sel=>{const r=document.querySelector(sel).getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth})`), `lobby fits ${width}x${height}`);
      await capture(`lobby-${width}x${height}`, control);
    }
    assert.deepEqual(errors, [], 'renderer errors');
    console.log('PASS: real preview main; isolated data; no COM; both-window bracelets and hits; one USB gamepad for both players, no hold repeats; four full game cycles; screen panel; fixed START; cleared pairs; reload recovery; live CSS; 3 portrait sizes; normal renderer unchanged.');
    clearTimeout(timeout); app.quit();
  } catch (error) { console.error(error, errors); clearTimeout(timeout); app.exit(1); }
});
