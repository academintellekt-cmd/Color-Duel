const test=require('node:test'),assert=require('node:assert/strict');
const{PreviewGamepad}=require('../lib/preview-gamepad');
const pad=(index=0)=>({index,id:`USB ${index}`,connected:true,buttons:Array.from({length:10},()=>({pressed:false,value:0}))});
test('one gamepad maps buttons 0–3 to player 1 and 4–7 to player 2',()=>{
  const hits=[],input=new PreviewGamepad({onHit:(...hit)=>hits.push(hit)}),controller=pad(2);
  input.poll([null,null,controller]);
  for(let i=0;i<10;i++){controller.buttons[i].pressed=true;input.poll([controller]);controller.buttons[i].pressed=false;input.poll([controller])}
  assert.deepEqual(hits,[[0,'red'],[0,'green'],[0,'blue'],[0,'yellow'],[1,'red'],[1,'green'],[1,'blue'],[1,'yellow']]);
});
test('holding a button produces one hit; release and press produces the next',()=>{
  const hits=[],input=new PreviewGamepad({onHit:(...hit)=>hits.push(hit)}),controller=pad();
  input.poll([controller]);controller.buttons[0].pressed=true;
  for(let frame=0;frame<120;frame++)input.poll([controller]);
  assert.equal(hits.length,1);
  controller.buttons[0].pressed=false;input.poll([controller]);
  controller.buttons[0].value=.8;input.poll([controller]);
  assert.deepEqual(hits,[[0,'red'],[0,'red']]);
});
test('simultaneous buttons work for both players without duplicate hits',()=>{
  const hits=[],input=new PreviewGamepad({onHit:(...hit)=>hits.push(hit)}),controller=pad();
  input.poll([controller]);
  for(const i of[1,3,4,6])controller.buttons[i].pressed=true;
  input.poll([controller]);input.poll([controller]);
  assert.deepEqual(hits,[[0,'green'],[0,'yellow'],[1,'red'],[1,'blue']]);
});
test('a second controller is ignored while the selected one stays connected',()=>{
  const hits=[],input=new PreviewGamepad({onHit:(...hit)=>hits.push(hit)}),first=pad(2),second=pad(0);
  input.poll([first]);second.buttons[0].pressed=true;
  input.poll([second,first]);assert.equal(hits.length,0);
  first.buttons[4].pressed=true;input.poll([second,first]);
  assert.deepEqual(hits,[[1,'red']]);
});
test('disconnect and reconnect with a held button do not invent a new press',()=>{
  const hits=[],statuses=[],input=new PreviewGamepad({onHit:(...hit)=>hits.push(hit),onStatus:s=>statuses.push(s)}),controller=pad();
  controller.buttons[7].pressed=true;input.poll([controller]);assert.equal(hits.length,0);
  input.poll([]);input.poll([controller]);assert.equal(hits.length,0);
  controller.buttons[7].pressed=false;input.poll([controller]);
  controller.buttons[7].pressed=true;input.poll([controller]);
  assert.deepEqual(hits,[[1,'yellow']]);
  assert.deepEqual(statuses.map(s=>s.connected),[true,false,true]);
});
test('missing controllers and fewer than eight buttons are handled safely',()=>{
  const hits=[],input=new PreviewGamepad({onHit:(...hit)=>hits.push(hit)}),controller=pad();
  input.poll(null);input.poll([null]);controller.buttons.length=2;
  input.poll([controller]);controller.buttons[1].pressed=true;input.poll([controller]);
  assert.deepEqual(hits,[[0,'green']]);
});
test('assignment can capture the first button that reveals a newly connected gamepad',()=>{
  const presses=[],input=new PreviewGamepad({onButtons:indices=>presses.push(indices),acceptInitialPresses:()=>true}),controller=pad();
  controller.buttons[9].pressed=true;input.poll([controller]);input.poll([controller]);
  assert.deepEqual(presses,[[9]]);
});
