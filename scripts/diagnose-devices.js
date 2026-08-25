const{SerialPort}=require('serialport');
const{ReadlineParser}=require('@serialport/parser-readline');

const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function inspect(info){
  if(/bluetooth|BTHENUM/i.test(`${info.manufacturer||''} ${info.friendlyName||''} ${info.pnpId||''}`))return{path:info.path,skipped:'Bluetooth'};
  const report={path:info.path,name:info.friendlyName||info.manufacturer||'',lines:[]};
  const port=new SerialPort({path:info.path,baudRate:115200,autoOpen:false});
  port.on('error',error=>report.error=error.message);
  try{
    await new Promise((resolve,reject)=>port.open(error=>error?reject(error):resolve()));
    const parser=port.pipe(new ReadlineParser({delimiter:'\n'}));parser.on('data',line=>report.lines.push(String(line).trim()));parser.on('error',error=>report.error=error.message);
    await wait(1700);
    await new Promise((resolve,reject)=>port.write('IDENTIFY\n',error=>error?reject(error):resolve()));
    await wait(1500);
  }catch(error){report.error=error.message}
  if(port.isOpen)await new Promise(resolve=>port.close(()=>resolve()));
  return report;
}
(async()=>{const ports=await SerialPort.list();console.log('Detected ports:',ports.map(p=>p.path).join(', ')||'none');for(const port of ports)console.log(JSON.stringify(await inspect(port)));})().catch(error=>{console.error(error);process.exitCode=1});
