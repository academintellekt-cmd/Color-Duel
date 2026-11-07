const{DeviceSerial}=require('./device-serial');
// The Nano renders only after a complete frame and ACKs after all eight strips.
// Nothing is transmitted while NeoPixel temporarily disables UART interrupts.
class LedSerial extends DeviceSerial{
  constructor(config,exclude){super({...config,identity:'COLOR_DUEL_LED_V2',baudRate:115200},exclude);this.frameId=0;this.awaiting=null;this.frameTimer=null;this.ackTimer=null;
    this.on('line',line=>{if(line===`ACK FRAME ${this.awaiting}`){this.awaiting=null;clearTimeout(this.ackTimer);this.ackTimer=null}});
  }
  async start(){if(this.config.enabled===false)return;this.frameTimer=setInterval(()=>this.flush(),20);await super.start()}
  send(value){value=String(value||'').trim();if(!value||value.includes(';')||/[\r\n]/.test(value))return;if(value==='CLEAR')this.queue.length=0;this.queue.push(value);if(this.queue.length>128)this.queue.shift()}
  flush(){
    if(this.awaiting!==null||this.sending||!this.port?.isOpen)return;
    const commands=[];let length=0;
    while(this.queue.length&&length+this.queue[0].length<300){const command=this.queue.shift();commands.push(command);length+=command.length+1}
    const id=++this.frameId,port=this.port,generation=this.generation;this.awaiting=id;
    this.ackTimer=setTimeout(()=>this.lost('LED frame acknowledgement timed out',port,generation),1500);
    try{port.write(`FRAME ${id} ${commands.join(';')}\n`,error=>{if(error)this.lost(error.message,port,generation)})}catch(error){this.lost(error.message,port,generation)}
  }
  async lost(error,port,generation){if(generation!==this.generation)return;clearTimeout(this.ackTimer);this.ackTimer=null;this.awaiting=null;await super.lost(error,port,generation)}
  async stop(){clearInterval(this.frameTimer);this.frameTimer=null;clearTimeout(this.ackTimer);this.ackTimer=null;this.awaiting=null;await super.stop()}
}
module.exports={LedSerial};
