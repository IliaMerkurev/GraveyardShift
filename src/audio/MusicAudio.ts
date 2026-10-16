/** Web Audio keeps the soundtrack independent of the intro video's media focus. */
export class MusicAudio {
  private audio:HTMLAudioElement|null=null;
  private context:AudioContext|null=null;
  private gain:GainNode|null=null;
  private source:AudioBufferSourceNode|null=null;
  private decoded:Promise<AudioBuffer>|null=null;
  private started=false;
  private enabled=true;
  private dead=false;
  private background=document.hidden;
  private recoveryAttempted=false;
  private recover=()=>{if(this.started&&!this.dead&&!document.hidden){this.background=false;this.sync();}};
  private stateChanged=()=>{
    const state=this.context?.state;
    if(state==='running'){this.recoveryAttempted=false;return;}
    if(state!=='closed'&&!this.recoveryAttempted&&this.started&&this.enabled&&!this.background&&!document.hidden){this.recoveryAttempted=true;this.recover();}
  };
  private visibility=()=>{this.background=document.hidden;this.sync();};
  constructor(source:string){
    const C=window.AudioContext||(window as Window&{webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
    if(C){
      try{
        let ctx:AudioContext;try{ctx=new C({sampleRate:32000});}catch{ctx=new C();}
        this.context=ctx;ctx.onstatechange=this.stateChanged;this.gain=ctx.createGain();this.gain.gain.value=.65;this.gain.connect(ctx.destination);
        // Decode before PLAY where possible; resume is still called in the actual gesture.
        const raw=atob(source.slice(source.indexOf(',')+1)),bytes=new Uint8Array(raw.length);
        for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
        this.decoded=ctx.decodeAudioData(bytes.buffer);
        void this.decoded.catch(()=>{}); // start() exposes decoding failures without an unhandled rejection.
      }catch{void this.context?.close().catch(()=>{});this.context=null;this.gain=null;}
    }
    if(!this.context){this.audio=new Audio(source);this.audio.loop=true;this.audio.preload='auto';this.audio.volume=.65;}
    document.addEventListener('visibilitychange',this.visibility);window.addEventListener('pageshow',this.recover);
  }
  start():Promise<void>{
    if(this.dead)return Promise.resolve();
    this.started=true;
    if(!this.enabled||this.background)return Promise.resolve();
    if(this.audio)return this.audio.paused?this.audio.play():Promise.resolve();
    const ctx=this.context!;
    // Never await decode before resume: that would lose mobile user activation.
    const resumed=ctx.state==='running'?Promise.resolve():ctx.resume();
    return Promise.all([resumed,this.decoded!]).then(([,buffer])=>{
      if(this.dead||!this.started||!this.enabled||this.background||this.source)return;
      const node=ctx.createBufferSource();node.buffer=buffer;node.loop=true;node.connect(this.gain!);this.source=node;node.start();
    });
  }
  cancelStart(){this.started=false;if(this.audio){this.audio.pause();this.audio.currentTime=0;}if(this.source){this.source.stop();this.source.disconnect();this.source.buffer=null;this.source=null;}}
  setEnabled(enabled:boolean){this.enabled=enabled;this.sync();}
  private sync(){
    if(this.dead)return;
    if(this.gain)this.gain.gain.value=this.enabled?.65:0;
    if(this.background){this.audio?.pause();if(this.context?.state==='running')void this.context.suspend().catch(()=>{});return;}
    if(!this.enabled){this.audio?.pause();return;}
    if(this.started)void this.start().catch(()=>{});
  }
  destroy(){this.dead=true;document.removeEventListener('visibilitychange',this.visibility);window.removeEventListener('pageshow',this.recover);if(this.context)this.context.onstatechange=null;this.cancelStart();if(this.audio){this.audio.removeAttribute('src');this.audio.load();}this.decoded=null;void this.context?.close().catch(()=>{});}
}
