import type {GameEvent} from '../game/GameState';

type Point={x:number;y:number};
export const COIN_TRANSFER_LIMIT=18;
/** Aggregate mass destruction across the path rather than hiding it under a coin cloud. */
export function coinTransferEvents(events:GameEvent[]){
  const rewards=events.filter(e=>e.type==='destroy'&&(e.amount??0)>0),count=Math.min(3,rewards.length);
  return [...events.filter(e=>e.type==='purchase'&&(e.amount??0)>0).slice(0,3),...Array.from({length:count},(_,i)=>rewards[Math.floor(i*rewards.length/count)])];
}
export function coinFlight(from:Point,to:Point,t:number,lane:number){
  if(t>=1)return to;
  const u=t*t*(3-2*t),arc=Math.sin(Math.PI*t);
  return {x:from.x+(to.x-from.x)*u+arc*lane*8,y:from.y+(to.y-from.y)*u-arc*Math.min(55,18+Math.abs(to.y-from.y)*.12)};
}
type Flight={node:HTMLElement;from:Point;to:Point;age:number;lane:number;ring:boolean};
/** Visual only: the committed simulation remains the sole owner of every coin. */
export class CoinTransfers {
  private layer:HTMLElement;private flights:Flight[]=[];
  private reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  constructor(private shell:HTMLElement){
    this.layer=document.createElement('div');this.layer.className='coin-transfers';this.layer.setAttribute('aria-hidden','true');shell.append(this.layer);
  }
  private center(selector:string){const a=this.shell.querySelector(selector)!.getBoundingClientRect(),b=this.shell.getBoundingClientRect();return{x:a.left+a.width/2-b.left,y:a.top+a.height/2-b.top};}
  events(events:GameEvent[],project:(event:GameEvent)=>Point){
    for(const e of coinTransferEvents(events)){const wallet=this.center('.wallet .coin'),point=project(e);this.emit(e.type==='purchase'?wallet:point,e.type==='purchase'?point:wallet,e.type==='purchase');}
  }
  upgrade(){this.emit(this.center('.wallet .coin'),this.center('[data-worker-upgrade]'),true);}
  private emit(from:Point,to:Point,priority=false){
    if(document.hidden)return;
    const reduced=this.reduced.matches,count=reduced?1:3;
    if(priority)while(this.flights.length>COIN_TRANSFER_LIMIT-count)this.flights.shift()!.node.remove();
    for(let i=0;i<count&&this.flights.length<COIN_TRANSFER_LIMIT;i++){
      const node=document.createElement('i');node.className='transfer-coin';node.style.opacity='0';this.layer.append(node);
      this.flights.push({node,from,to,age:reduced?.58:-i*.045,lane:i-1,ring:reduced||i===count-1});
    }
  }
  tick(dt:number,blocked=false){
    if(blocked||document.hidden){this.clear();return;}
    this.flights=this.flights.filter(f=>{
      // A live accessibility change also stops travel immediately.
      if(this.reduced.matches&&f.age<.58)f.age=.58;
      f.age+=dt;if(f.age<0)return true;
      if(f.age>=.76||f.age>=.58&&!f.ring){f.node.remove();return false;}
      const arrived=f.age>=.58,t=Math.min(1,f.age/.58),p=coinFlight(f.from,f.to,t,f.lane);
      f.node.classList.toggle('transfer-arrival',arrived);
      f.node.style.opacity=String(arrived?(1-(f.age-.58)/.18)*.65:Math.min(1,t*8));
      f.node.style.transform=`translate(${p.x}px,${p.y}px) translate(-50%,-50%) scale(${arrived?1:1-.25*t},${arrived?1:.75+.25*Math.abs(Math.cos(t*9))})`;
      return true;
    });
  }
  clear(){for(const f of this.flights)f.node.remove();this.flights=[];}
}
