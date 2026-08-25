const {DeviceSerial}=require('../lib/device-serial');
const config=require('../config.json').ledSerial;
const device=new DeviceSerial({...config,port:'auto'});
const commands=['CHASE 1 R','CHASE 1 G','CHASE 1 B','CHASE 1 Y','CHASE 2 R','CHASE 2 G','CHASE 2 B','CHASE 2 Y'];
let started=false;
device.on('status',status=>{
  console.log(status.connected?`LED controller found: ${status.path}`:`LED controller: ${status.error}`);
  if(status.connected&&!started){started=true;console.log('SEND TEST');device.send('TEST');commands.forEach((command,index)=>setTimeout(()=>{console.log('SEND',command);device.send(command)},2200+index*900));setTimeout(async()=>{await device.stop();process.exit(0)},commands.length*900+4200)}
});
device.on('line',line=>console.log('RECV',line));
device.start();
setTimeout(async()=>{if(!started){console.error('LED controller was not found');await device.stop();process.exit(1)}},12000);
