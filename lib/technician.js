const fs=require('fs'),path=require('path'),{EventEmitter}=require('events');
const LANGUAGES=['ru','en','de','fr','zh','ja'];
const COLORS=['red','green','blue','yellow'];
class Technician extends EventEmitter{
  constructor({file,preview=false,language='ru',ledPort}={}){
    super();this.file=file;this.settings={buttons:[0,1,2,3,4,5,6,7],channels:[0,1,2,3,4,5,6,7],ledPort:ledPort??(preview?'off':'auto'),language};
    this.staff=null;this.blocked=false;this.counters=Array(8).fill(0);this.capture=null;this.calibration=null;this.error='';this.ports=[];this.led={connected:false};
    if(file&&fs.existsSync(file)){const saved=JSON.parse(fs.readFileSync(file,'utf8'));this.validate({...this.settings,...saved});this.settings={...this.settings,...saved}}
  }
  validate(s){
    if(!Array.isArray(s.buttons)||s.buttons.length!==8||new Set(s.buttons).size!==8||s.buttons.some(n=>!Number.isInteger(n)||n<0||n>127))throw Error('Invalid button mapping');
    if(!Array.isArray(s.channels)||s.channels.length!==8||new Set(s.channels).size!==8||s.channels.some(n=>!Number.isInteger(n)||n<0||n>7))throw Error('Invalid LED mapping');
    if(!/^(off|auto|COM[1-9]\d*)$/i.test(s.ledPort)||!LANGUAGES.includes(s.language))throw Error('Invalid settings');
  }
  save(patch){
    const next={...this.settings,...patch};this.validate(next);
    if(this.file){fs.mkdirSync(path.dirname(this.file),{recursive:true});const tmp=this.file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(next,null,2)+'\n');fs.renameSync(tmp,this.file)}
    this.settings=next;this.emit('settings',next);
  }
  snapshot(){return{staff:this.staff,blocked:this.blocked,settings:this.settings,counters:[...this.counters],capture:this.capture,calibration:this.calibration,error:this.error,ports:this.ports,led:this.led}}
  publish(){this.emit('change',this.snapshot())}
  gateway({staff=null,blocked=false,error=''}){
    const wasActive=!!this.staff;this.staff=staff?.role==='technician'?staff:null;this.blocked=!!blocked;this.error=error;
    if(this.staff&&!wasActive){this.counters.fill(0);this.emit('enter')}
    if(!this.staff){this.capture=null;this.calibration=null;if(wasActive)this.emit('calibrate',-1)}
    this.publish();
  }
  rawButtons(indices){
    const valid=[...new Set(indices)].filter(n=>Number.isInteger(n)&&n>=0&&n<128);
    if(this.staff&&this.capture!==null&&valid.length){
      const buttons=[...this.settings.buttons],target=this.capture,source=buttons.indexOf(valid[0]),old=buttons[target];
      buttons[target]=valid[0];if(source>=0&&source!==target)buttons[source]=old;
      this.save({buttons});this.capture=null;this.publish();return;
    }
    for(const button of valid){const slot=this.settings.buttons.indexOf(button);if(slot<0)continue;
      if(this.staff){this.counters[slot]=(this.counters[slot]+1)%16;this.emit('pulse',slot,COLORS[slot%4])}
      else if(!this.blocked)this.emit('hit',Math.floor(slot/4),COLORS[slot%4]);
    }
    if(this.staff)this.publish();
  }
  command(x){
    if(!this.staff)throw Error('Technician bracelet required');this.error='';
    if(x.type==='capture'){if(!Number.isInteger(x.slot)||x.slot<0||x.slot>7)throw Error('Invalid slot');this.capture=x.slot}
    else if(x.type==='cancel'){this.capture=null;this.calibration=null;this.emit('calibrate',-1)}
    else if(x.type==='port'){this.save({ledPort:String(x.port).toUpperCase().replace(/^OFF$/,'off').replace(/^AUTO$/,'auto')});this.calibration=null;this.emit('calibrate',-1);this.emit('port',this.settings.ledPort)}
    else if(x.type==='language')this.save({language:x.language});
    else if(x.type==='calibrate'){
      if(!this.led.connected)throw Error('LED_NOT_CONNECTED');
      this.capture=null;this.calibration={channel:0,assignments:Array(8).fill(null)};this.emit('calibrate',0);
    }else if(x.type==='corner'){
      if(!Number.isInteger(x.slot)||x.slot<0||x.slot>7)throw Error('Invalid slot');
      if(this.calibration){
        if(!this.led.connected)throw Error('LED_NOT_CONNECTED');
        const draft=this.calibration;if(draft.assignments[x.slot]!==null)throw Error('CORNER_USED');
        const assignments=[...draft.assignments];assignments[x.slot]=draft.channel;
        if(draft.channel===7){this.save({channels:assignments});this.calibration=null;this.emit('calibrate',-1)}
        else{this.calibration={channel:draft.channel+1,assignments};this.emit('calibrate',draft.channel+1)}
      }else this.emit('pulse',x.slot,'white');
    }else if(['close','block','unblock'].includes(x.type))this.emit('gateway-command',x.type);
    else if(x.type==='ports')this.emit('ports');
    else throw Error('Unknown technician command');
    this.publish();return this.snapshot();
  }
}
class Lighting{
  constructor(send,technician){this.send=send;this.technician=technician;this.phase=null;
    technician.on('pulse',(slot,color)=>this.pulse(slot,color));
    technician.on('calibrate',channel=>this.send(`CAL ${channel+1}`));
    technician.on('change',()=>this.update(this.state||{phase:'lobby'}));
  }
  pulse(slot,color){const code={red:'R',green:'G',blue:'B',yellow:'Y',white:'W'}[color];if(code&&Number.isInteger(slot)&&slot>=0&&slot<8)this.send(`PULSE ${this.technician.settings.channels[slot]+1} ${code}`)}
  update(state,force=false){
    this.state=state;const tech=this.technician;
    let phase=tech.staff?'technician':tech.blocked?'blocked':state.phase;
    if(['gameover','results','leaderboard'].includes(phase)){
      const scores=state.mode==='rhythm'?state.accuracy:state.scores;
      const winner=scores?.[0]===scores?.[1]?(state.mode==='rhythm'&&state.scores[0]!==state.scores[1]?(state.scores[0]>state.scores[1]?0:1):2):(scores?.[0]>scores?.[1]?0:1);
      phase=`result-${winner}`;
    }
    if(!force&&phase===this.phase)return;this.phase=phase;this.send('CLEAR');
    if(phase.startsWith('result-')){
      const winner=Number(phase.slice(-1));
      for(let p=0;p<2;p++){const mask=tech.settings.channels.slice(p*4,p*4+4).reduce((m,c)=>m|(1<<c),0);this.send(`FILL ${mask} ${winner===2?'W':winner===p?'G':'R'}`)}
    }else this.send(`IDLE ${['lobby','ready'].includes(phase)?1:0}`);
    if(phase==='technician'&&tech.calibration)this.send(`CAL ${tech.calibration.channel+1}`);
  }
}
module.exports={Technician,Lighting};
