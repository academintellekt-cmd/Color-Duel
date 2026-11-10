const assert=require('assert');const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'public','app.js'),'utf8');
const control=fs.readFileSync(path.join(root,'public','control.html'),'utf8');
const player=fs.readFileSync(path.join(root,'public','player.html'),'utf8');
assert(app.includes("phase:'lobby'"),'boots into the duel lobby');
assert(app.includes('ColorDuelLobby.html(lobbyView())'),'lobby phase renders the lobby screen');
assert(app.includes("api.striveXLobby({type:'start'"),'START asks the Gateway to commit');
assert((app.match(/lobbySelection[:=]LobbyOptions\.defaultSelection\(/g)||[]).length>=2,'selection resets between pairs');
assert(app.includes("status:'failed'")&&app.includes('not_enough_players'),'short unlock answers failed');
assert(!/state\.phase==='(modes|info|difficulty|duration|locked)'/.test(app),'old screens removed');
assert(app.includes('finishToken')&&app.includes('if(token!==countdownToken)return;startGame()'),'timer races fixed');
assert(!app.includes('${state.names[')&&!app.includes('${r.name}'),'names are escaped');
assert(control.includes('lobby.css')&&control.includes('../lib/lobby-options.js')&&control.includes('lobby.js'));
assert(player.includes('../lib/lobby-options.js'));
const esBody=app.split(/\r?\n/).find(l=>l.startsWith('function endSession('))||'';
assert(esBody.includes('clearTimeout(roundTimer)')&&esBody.includes("audio?.crossfade('menu')"),'endSession stops round timer and music');
assert(/if\(state\.sessionId\)\s*\{?\s*api\.strivexFinal/.test(esBody),'final report guarded by sessionId');
assert(app.split("state.scores=[0,0];state.errors=[0,0];state.accuracy=[0,0];state.phase='ready'").length-1>=2,'ready starts from a clean score');
assert(app.includes("if(cfg.interfaceTestMode)beginCountdown();else showEnterCall()"),'preview starts countdown directly; normal launch keeps the enter call');
assert(app.includes('syncEnterCall();'),'render closes the enter call once the phase moves on');
assert(app.includes('ENTER_CALL_MS=10000')&&app.includes('setTimeout(hideEnterCall,ENTER_CALL_MS)'),'enter call lasts 10 s');
assert(app.includes("action==='leaders'){state.manualLeaders=true;state.phase='leaderboard'}"),'Records opens the leaderboard from the lobby');
assert(app.includes("action==='leaders-back'){state.manualLeaders=false;state.phase='lobby'}"),'back returns to the lobby');
assert(control.includes('../lib/session-records.js'),'control page loads session-records');
assert(app.includes("records:SessionRecords.bestRecords(state.userIds,sessionRounds,'color-duel',"),'session end reports XP records');
assert(app.includes("setLobbyOverlay({type:'profile',uid:profile,state:'loading'},CABINET_IDLE_MS);api.striveXLobby({type:'profile',uid:profile})"),'tapping a card asks for the profile');
assert(app.includes("else if(e.type==='profile'){if(lobbyOverlay?.type==='profile'&&lobbyOverlay.uid===e.uid)"),'only the open profile is filled in');
assert(app.indexOf('data-lobby-profile-remove')<app.indexOf("if(at('data-lobby-dismiss')&&"),'remove inside the profile window is handled before its backdrop closes it');
const main=fs.readFileSync(path.join(root,'main.js'),'utf8');
assert(main.includes("strivex.on('profile',x=>emit('strivex-event',{type:'profile',...x}))")&&main.includes("x?.type==='profile'&&typeof strivex.requestProfile==='function'"),'main forwards profile requests and answers');
assert(main.includes("strivex.on('avatar-saved',x=>emit('strivex-event',{type:'avatar_saved',...x}))")&&main.includes("x?.type==='avatar_save'&&typeof strivex.saveAvatar==='function'"),'main forwards avatar saves and answers');
assert(app.indexOf('StrivexCabinet.click(e.target,lobbyOverlay)')<app.indexOf("const idle=at('data-lobby-idle')")&&app.includes("api.striveXLobby({type:'avatar_save',uid:r.save.uid,avatar:r.save.avatar})"),'cabinet taps are handled first and saves go to the Gateway');
console.log('lobby wiring tests passed');
const test=require('node:test');
const appHead=app.slice(0,app.indexOf('const esc='));
test('main forwards queue events and commands',()=>{
  assert(main.includes("['unlock', 'lock', 'expired', 'lobby', 'scan', 'queue']")&&main.includes("strivex.on(type, x => emit('strivex-event', { type, ...x }))"),'queue event reaches the control screen');
  for(const[type,method]of[['queue_open','queueOpen'],['queue_done','queueDone'],['queue_cancel','queueCancel']])assert(main.includes(`x?.type === '${type}' && typeof strivex.${method} === 'function') strivex.${method}()`),`${type} -> strivex.${method}()`);
});
test('snapshot carries the last queue state',()=>{
  assert(main.includes("strivex.on('queue', x => { lastQueue = x; })"),'main keeps the last queue message');
  assert(main.includes("strivex.on('connection', x => { if (!x.connected) lastQueue = null; })"),'cleared when the Gateway connection drops');
  assert(main.includes('developmentMode: c.strivex.developmentMode, queue: lastQueue }'),'strivex-snapshot returns it');
  assert(app.includes("if(s?.queue&&!queueSeen){queueSeen=true;setQueue(s.queue.state==='none'?null:s.queue)}"),'a reloaded control window picks it up once, if no live queue message came first');
});
test('control screen renders the queue bar outside the lobby',()=>{
  assert(/function queueBar\(\)\{[^\n]*ColorDuelLobby\.queue\(queueView\(\)\)/.test(app),'queueBar renders ColorDuelLobby.queue');
  const render=app.slice(app.indexOf('function renderScreen(){'),app.indexOf('function colorRingScreen('));
  assert(/function renderScreen\(\)\{renderPhase\(\);if\(state\.phase!=='lobby'\)mountQueueBar\(\)\}/.test(render),'every non-lobby phase (ready, countdown, game, gameover, results, leaderboard) gets the bar');
  assert(/function mountQueueBar\(\)\{[^\n]*queueBar\(\)[^\n]*style\.paddingBottom=/.test(app),'the screen content keeps clear of the strip');
  assert(app.includes('queue:queueShown()?{...queueView(),note:queueNote}:null'),'session lobby embeds the bar');
  assert(app.includes('remainingSec:queue?.expires_at==null?null:Math.max(0,Math.ceil((queue.expires_at-Date.now())/1000))'),'queueView remaining seconds');
  assert(!/function queueBar\(\)\{[^\n]*role/.test(app)&&/function queueShown\(\)\{if\(role!=='control'/.test(app),'only the control window draws the strip');
});
test('strip is hidden under the technician layer and follows the session/reserved rule',()=>{
  assert(/function queueShown\(\)\{if\(role!=='control'\|\|technicianOpen\(\)\)return false;return!!state\.sessionId\|\|state\.phase==='lobby'&&queue\?\.state==='reserved'\}/.test(app),'session: all phases; no session: only reserved on the lobby; never under the technician layer');
  assert(app.includes('function technicianOpen(){return!!(technicianState.staff||technicianState.blocked)}'),'same condition that shows the technician layer (settings, calibration, blocked screen)');
  assert(app.includes('api.onTechnician(snapshot=>{const was=technicianOpen();technicianState=snapshot;technicianView.update(snapshot);if(technicianOpen()!==was)render()})'),'the strip hides and returns with the layer, with the last queue state');
});
test('queue buttons send their commands',()=>{
  assert(app.includes("const QUEUE_ACTIONS={'queue-open':'queue_open','queue-done':'queue_done','queue-cancel':'queue_cancel'}"),'button -> command map');
  assert(app.includes('else if(QUEUE_ACTIONS[b.dataset.action])api.striveXLobby({type:QUEUE_ACTIONS[b.dataset.action]})'),'queue buttons go to the Gateway');
  assert(app.indexOf('QUEUE_ACTIONS[b.dataset.action]')<app.indexOf("b.dataset.action==='quit'"),'checked before the quit/end handlers');
});
test('queue view is cleared when the Gateway connection drops',()=>{
  assert(app.includes("setQueue(e.state==='none'?null:e)}else if(e.type==='scan')"),"queue 'none' clears the view");
  assert(app.includes('if(!gatewayConnected){queueSeen=false;setQueue(null)}'),'disconnect clears the view and the queue announcement');
  assert(/function setQueue\(next\)\{queue=next;clearTimeout\(queueNoteTimer\);queueNote='';clearInterval\(queueTimer\);queueTimer=null;if\(queue\?\.expires_at!=null\)queueTimer=setInterval\(render,1000\);render\(\)\}/.test(app),'one 1 s redraw interval, only while the queue has expires_at, stopped by setQueue(null)');
});
test('join is offered only after the Gateway announced the queue on this connection',()=>{
  assert(/[,;]queueSeen=false[,;]/.test(appHead),'(a) no queue message yet -> queueSeen false');
  assert(app.includes("canOpen:!!state.sessionId&&queueSeen&&(queue?.state||'none')==='none'"),'(b) the button needs a session, the announcement and no queue');
  assert(app.includes("queueSeen=true;setQueue(e.state==='none'?null:e)"),'(c) any queue message (state none included) turns it on');
  assert(app.includes('if(!gatewayConnected){queueSeen=false;'),'(d) disconnect turns it off again');
});
test('scan goes through ScanRoute with the session flag',()=>{
  assert(app.includes('ScanRoute.scanRoute(e,{session:!!state.sessionId,queue,overlayType:lobbyOverlay?.type})'),'decision lives in lib/scan-route.js, fed by the session flag');
  assert(app.includes('if(r?.note)setQueueNote(r.note);else if(r?.overlay)setLobbyOverlay(r.overlay,r.autoCloseMs)'),'a note goes to the strip, an overlay to the lobby');
  assert(app.includes("if(lobbyOverlay?.type==='checking'){clearTimeout(lobbyOverlayTimer);lobbyOverlay=null}queueSeen=true"),'a queue message closes the checking window only');
  assert(control.includes('../lib/scan-route.js')&&control.indexOf('scan-route.js')<control.indexOf('app.js'),'control page loads scan-route before app.js');
});
test('player screen is untouched',()=>{
  assert(!player.includes('queue')&&!player.includes('scan-route'),'player.html knows nothing about the queue');
  assert(!app.includes('state.queue'),'the queue is not published to the player window');
});
