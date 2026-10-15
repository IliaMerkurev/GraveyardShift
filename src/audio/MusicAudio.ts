/** One soundtrack instance spans the intro, transitions, pauses and restarts. */
export class MusicAudio {
  private audio:HTMLAudioElement;
  private started=false;
  private enabled=true;
  private background=document.hidden;
  private visibility=()=>{this.background=document.hidden;this.sync();};
  constructor(source:string){
    this.audio=new Audio(source);this.audio.loop=true;this.audio.preload='auto';this.audio.volume=.65;
    document.addEventListener('visibilitychange',this.visibility);
  }
  start():Promise<void>{
    this.started=true;
    if(!this.enabled||this.background)return Promise.resolve();
    return this.audio.play();
  }
  cancelStart(){this.started=false;this.audio.pause();this.audio.currentTime=0;}
  setEnabled(enabled:boolean){this.enabled=enabled;this.sync();}
  private sync(){if(!this.enabled||this.background||!this.started)this.audio.pause();else void this.audio.play().catch(()=>{});}
  destroy(){document.removeEventListener('visibilitychange',this.visibility);this.audio.pause();this.audio.removeAttribute('src');this.audio.load();}
}
