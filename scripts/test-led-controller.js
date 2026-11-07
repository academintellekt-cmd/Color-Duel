const {LedSerial}=require('../lib/led-serial');
const config=require('../config.json').ledSerial;
const device=new LedSerial({...config,port:'auto'});
const commands=Array.from({length:8},(_v,i)=>`PULSE ${i+1} ${'RGBY'[i%4]}`);
let started=false;
device.on('status',status=>{
  console.log(status.connected?`LED controller found: ${status.path}`:`LED controller: ${status.error}`);
  if(status.connected&&!started){started=true;console.log('LED V2 test');device.send('CLEAR');commands.forEach((command,index)=>setTimeout(()=>{console.log('SEND',command);device.send(command)},2200+index*900));setTimeout(async()=>{await device.stop();process.exit(0)},commands.length*900+4200)}
});
device.on('line',line=>console.log('RECV',line));
device.start();
setTimeout(async()=>{if(!started){console.error('LED controller was not found');await device.stop();process.exit(1)}},12000);
