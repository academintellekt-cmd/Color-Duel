const test=require('node:test');const assert=require('node:assert/strict');
const{scanRoute}=require('../lib/scan-route');
const denied=reason=>({type:'scan',state:'denied',reason}),checking={type:'scan',state:'checking'};
test('session active: a denied tap is a note, never a modal or an overlay change',()=>{
  for(const overlayType of[undefined,'profile','denied','checking'])for(const reason of['busy','reserved','unregistered','expired','offline','blocked',undefined]){
    const r=scanRoute(denied(reason),{session:true,queue:null,overlayType});
    assert.deepEqual(r,{note:reason||'unregistered'},`${overlayType}/${reason}`);
  }
});
test('session active: checking never opens the overlay',()=>{
  for(const overlayType of[undefined,'profile','denied','checking'])assert.equal(scanRoute(checking,{session:true,queue:null,overlayType}),null,String(overlayType));
});
test('busy while a queue exists reads as reserved',()=>{
  assert.deepEqual(scanRoute(denied('busy'),{session:true,queue:{state:'waiting'}}),{note:'reserved'});
  assert.deepEqual(scanRoute(denied('busy'),{session:false,queue:{state:'reserved'}}),{overlay:{type:'denied',reason:'reserved'},autoCloseMs:5000});
  assert.deepEqual(scanRoute(denied('busy'),{session:true,queue:null}),{note:'busy'},'no queue: busy stays busy');
});
test('no session: denial opens the denied modal for 5 s; checking only over nothing/checking',()=>{
  assert.deepEqual(scanRoute(denied('expired'),{session:false,queue:null,overlayType:'rules'}),{overlay:{type:'denied',reason:'expired'},autoCloseMs:5000});
  assert.deepEqual(scanRoute(denied(),{session:false,queue:null}),{overlay:{type:'denied',reason:'unregistered'},autoCloseMs:5000});
  for(const overlayType of[undefined,'checking'])assert.deepEqual(scanRoute(checking,{session:false,queue:null,overlayType}),{overlay:{type:'checking'},autoCloseMs:5000});
  for(const overlayType of['rules','profile','denied','idle'])assert.equal(scanRoute(checking,{session:false,queue:null,overlayType}),null,overlayType);
});
test('no session, any phase: the screen phase is not an input',()=>{
  for(const phase of['lobby','ready','countdown','game','gameover','results','leaderboard']){
    assert.deepEqual(scanRoute(denied('expired'),{session:false,queue:null,phase}),scanRoute(denied('expired'),{session:false,queue:null}),phase);
    assert.deepEqual(scanRoute(denied('expired'),{session:true,queue:null,phase}),{note:'expired'},phase);
  }
});
test('other scan states and unknown input route nowhere',()=>{assert.equal(scanRoute({type:'scan',state:'ok'},{session:false,queue:null}),null)});
