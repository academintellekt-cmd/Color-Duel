const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

let now=0,frames=[];
class FakeAudio{
  constructor(src=''){this.src=src;this.volume=0;this.paused=true;this.ended=false;this.currentTime=0;this.listeners={}}
  play(){this.paused=false;return Promise.resolve()}
  pause(){this.paused=true}
  load(){}
  addEventListener(name,fn){this.listeners[name]=fn}
  cloneNode(){return new FakeAudio(this.src)}
}
const context={Audio:FakeAudio,performance:{now:()=>now},requestAnimationFrame:fn=>{frames.push(fn)},setTimeout,console};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','public','audio-manager.js'),'utf8')+';globalThis.Exported=LightningAudio;',context);
const audio=new context.Exported({enabled:true,menu:'menu.mp3',game:'game.mp3',end:'end.mp3',musicVolume:.4,fadeMs:100});

audio.crossfade('menu',100);
now=20;for(const frame of frames.splice(0))frame(now);
audio.playGame('classic');
now=40;for(const frame of frames.splice(0))frame(now);
audio.crossfade('menu',100);
for(now=60;now<=180;now+=20)for(const frame of frames.splice(0))frame(now);

assert.strictEqual(audio.current,'menu');
assert.strictEqual(audio.music.menu.paused,false,'menu must remain playing after interrupted transitions');
assert.strictEqual(audio.music.game.paused,true,'game music must stop after returning to menu');
assert(Math.abs(audio.music.menu.volume-.4)<.001,'menu must reach configured volume');
console.log('Audio transition race test passed.');
