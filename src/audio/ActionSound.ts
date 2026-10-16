/** Compact original mechanical/organic cues; no external samples. */
export const actionKinds=['rewind','freeze','brake','halfSpeed','upgrade','store','withdraw','discard','reject'] as const;
export type ActionKind=typeof actionKinds[number];
export function synthesizeAction(kind:ActionKind,rate:number):Float32Array {
  const duration={rewind:.82,freeze:.42,brake:.38,halfSpeed:.52,upgrade:.46,store:.18,withdraw:.16,discard:.38,reject:.14}[kind];
  const out=new Float32Array(Math.ceil(rate*duration));let seed=761,phase=0,low=0;
  for(let i=0;i<out.length;i++){
    const t=i/rate,u=t/duration;seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const noise=seed/2147483648-1;low+=(noise-low)*.16;
    let value=0;
    switch(kind){
      case 'rewind': { // Spooling tape: rising motor, irregular flutter, rhythmic tape-head chatter.
        phase+=2*Math.PI*(210+720*u+35*Math.sin(t*37))/rate;
        const flutter=.55+.45*Math.sin(2*Math.PI*(15*t+9*t*t));
        value=(Math.sin(phase)*.27+Math.sin(phase*2.01)*.09+(noise-low)*.18)*flutter*Math.sin(Math.PI*u)**.45;break;
      }
      case 'freeze':value=(Math.sin(2*Math.PI*1120*t)*.22+Math.sin(2*Math.PI*1680*t)*.13)*Math.exp(-t*12)+low*.5*Math.exp(-t*30);break;
      case 'brake':phase+=2*Math.PI*(90+470*(1-u)**2)/rate;value=(Math.sin(phase)*.35+(noise-low)*.12)*Math.sin(Math.PI*u)**.5;break;
      case 'halfSpeed':phase+=2*Math.PI*(75+340*(1-u))/rate;value=Math.sin(phase)*.4*Math.exp(-t*4)*(.65+.35*Math.cos(2*Math.PI*8*t));break;
      case 'upgrade':for(let j=0;j<3;j++){const d=t-j*.095;if(d>=0)value+=Math.sin(2*Math.PI*[440,660,880][j]*d)*.24*Math.exp(-d*20);}break;
      case 'store':value=Math.sin(2*Math.PI*190*t)*.45*Math.exp(-t*32)+low*.4*Math.exp(-t*60);break;
      case 'withdraw':phase+=2*Math.PI*(260+900*u)/rate;value=Math.sin(phase)*.3*Math.exp(-t*20)+low*.25*Math.exp(-t*50);break;
      case 'discard':phase+=2*Math.PI*(55+340*(1-u)**3)/rate;value=(Math.sin(phase)*.4+low*.4)*Math.exp(-t*7);break;
      case 'reject':value=(Math.sin(2*Math.PI*135*t)+Math.sin(2*Math.PI*155*t))*.17*Math.exp(-t*25);break;
    }
    out[i]=Math.tanh(value)*Math.min(1,t/.003,(duration-t)/.015);
  }
  return out;
}
