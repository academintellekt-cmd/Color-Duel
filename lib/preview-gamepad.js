// One USB controller for both players. Poll in the control window only.
(function(root){
  const colors=['red','green','blue','yellow'];
  class PreviewGamepad{
    constructor({onHit=()=>{},onStatus=()=>{},onButtons=()=>{},acceptInitialPresses=()=>false}={}){
      this.onHit=onHit;this.onStatus=onStatus;this.onButtons=onButtons;this.acceptInitialPresses=acceptInitialPresses;this.padIndex=null;this.padId=null;
      this.previous=Array(8).fill(false);this.statusKey=null;
    }
    poll(pads){
      const connected=Array.from(pads||[]).filter(p=>p&&p.connected!==false);
      const pad=connected.find(p=>p.index===this.padIndex)||connected[0]||null;
      const changed=this.padIndex!==(pad?.index??null)||this.padId!==(pad?.id??null);
      this.padIndex=pad?.index??null;this.padId=pad?.id??null;
      const pressed=Array.from({length:Math.min(128,pad?.buttons.length||0)},(_v,i)=>!!pad?.buttons[i]&&(pad.buttons[i].pressed||pad.buttons[i].value>.5));
      const status={connected:!!pad,index:this.padIndex,id:this.padId,buttonCount:pad?.buttons.length||0};
      const statusKey=JSON.stringify(status);
      if(statusKey!==this.statusKey){this.statusKey=statusKey;this.onStatus(status)}
      // Seed edges on connect/reconnect: an already held button is not a new hit.
      const previous=changed?(this.acceptInitialPresses()?[]:pressed):this.previous;
      this.previous=pressed;
      const edges=[];for(let i=0;i<pressed.length;i++)if(pressed[i]&&!previous[i])edges.push(i);
      if(edges.length)this.onButtons(edges);
      for(const i of edges)if(i<8)this.onHit(Math.floor(i/4),colors[i%4]);
    }
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={PreviewGamepad};
  else root.ColorDuelGamepad=PreviewGamepad;
})(typeof window!=='undefined'?window:globalThis);
