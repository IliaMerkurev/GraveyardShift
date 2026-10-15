export type AudioPreferences={sounds:boolean;music:boolean};
const key='rocksnake.audio.v1';
export class AudioSettings {
  readonly value:AudioPreferences={sounds:true,music:true};
  private listeners=new Set<(value:AudioPreferences)=>void>();
  constructor(){try{const saved=JSON.parse(localStorage.getItem(key)??'null');for(const k of ['sounds','music'] as const)if(typeof saved?.[k]==='boolean')this.value[k]=saved[k];}catch{/* Private browsing/storage may be unavailable. */}}
  set(keyName:keyof AudioPreferences,enabled:boolean){this.value[keyName]=enabled;try{localStorage.setItem(key,JSON.stringify(this.value));}catch{}for(const fn of this.listeners)fn(this.value);}
  subscribe(fn:(value:AudioPreferences)=>void){this.listeners.add(fn);fn(this.value);return()=>{this.listeners.delete(fn);};}
}
