/** Presentation-only, bounded impulses. Never changes simulation or hit positions. */
export type ImpulseKind = 'press' | 'pickup' | 'drop' | 'return' | 'open' | 'merge' | 'hit' | 'purchase';
export const impulseDuration:Record<ImpulseKind,number>={press:.16,pickup:.28,drop:.32,return:.25,open:.38,merge:.52,hit:.18,purchase:.36};
export function tactilePose(kind:ImpulseKind,age:number,reduced=false){
  const duration=impulseDuration[kind],t=Math.min(1,Math.max(0,age/duration));
  if(reduced||t>=1)return{x:1,y:1,lift:0,tilt:0};
  const settle=Math.sin(t*Math.PI*2)*Math.pow(1-t,2);
  const strength={press:-.09,pickup:.13,drop:-.20,return:-.10,open:.23,merge:.28,hit:-.07,purchase:-.12}[kind];
  const squeeze=strength*(Math.cos(t*Math.PI*3)*Math.pow(1-t,3));
  const hop=kind==='merge'?.20:kind==='open'?.11:kind==='pickup'?.06:0;
  return{x:1-squeeze*.48,y:1+squeeze,lift:Math.sin(t*Math.PI)*hop,tilt:settle*(kind==='return'?.12:kind==='merge'?.09:.035)};
}
export class TactileMotion {
  private impulses=new Map<string,{kind:ImpulseKind;age:number}>();
  trigger(id:string,kind:ImpulseKind){this.impulses.set(id,{kind,age:0});}
  tick(dt:number){for(const[id,p]of this.impulses){p.age+=Math.max(0,dt);if(p.age>=impulseDuration[p.kind])this.impulses.delete(id);}}
  pose(id:string,reduced=false){const p=this.impulses.get(id);return p?tactilePose(p.kind,p.age,reduced):{x:1,y:1,lift:0,tilt:0};}
  kind(id:string){return this.impulses.get(id)?.kind;}
  clear(){this.impulses.clear();}
}
