import type {GameState,Entity} from '../game/GameState';
import {getEntityPosition,workerUpgradePrice} from '../game/commands';
import {CONFIG} from '../game/config';
import {samplePath} from '../game/path';
import type {SceneView} from '../render/SceneFactory';

/** Live, optional hints. They never own input or stop simulation. */
export class Tutorial {
  private svg:SVGSVGElement;
  private done=false;
  constructor(private shell:HTMLElement,private view:SceneView){
    try{this.done=localStorage.getItem('graveyard-guide')==='done';}catch{}
    this.svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    this.svg.classList.add('live-guide');this.svg.setAttribute('aria-hidden','true');
    this.svg.innerHTML='<path class="guide-trail"/><circle r="17" class="guide-ring"/><path class="guide-arrow" d="M -8 -36 L 8 -36 L 8 -17 L 19 -17 L 0 3 L -19 -17 L -8 -17 Z"/><text class="guide-label" text-anchor="middle"/>';
    shell.append(this.svg);
  }
  reset(){this.done=false;try{localStorage.removeItem('graveyard-guide');}catch{}}
  render(s:GameState){
    s.tutorial.finished=this.done;
    this.svg.style.display='none';
    if(this.done||s.paused||s.gameOver||s.drag||this.shell.querySelector('.audio-menu:not([hidden])'))return;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rect=this.view.canvas.getBoundingClientRect(),shell=this.shell.getBoundingClientRect();
    const project=(p:Parameters<SceneView['project']>[0],y:number,belt=false)=>{const v=this.view.project(p,y,belt);return{x:v.x+rect.left-shell.left,y:v.y+rect.top-shell.top};};
    const entities=Object.values(s.entities),t=s.tutorial;
    const visible=(e:Entity)=>e.location.kind!=='slot'||(getEntityPosition(s,e)!.x>=-2.7&&getEntityPosition(s,e)!.x<=2.7);
    const position=(e:Entity)=>{const p=getEntityPosition(s,e);return p?project(p,e.kind==='worker'?.7:.65,e.location.kind==='slot'):null;};
    const find=(kind:string)=>entities.find(e=>e.kind===kind&&visible(e));
    let from:{x:number;y:number}|null=null,to:{x:number;y:number}|null=null,label='Tap';
    const barrel=(kind:string)=>{const e=entities.find(e=>e.kind==='barrel'&&e.content===kind&&visible(e));if(e)from=position(e);};
    if(!t.merged){
      const workers=entities.filter(e=>e.kind==='worker').sort((a,b)=>Number(a.location.kind==='pad')-Number(b.location.kind==='pad'));
      for(const a of workers){if(!visible(a))continue;const b=workers.find(b=>b.id!==a.id&&b.kind==='worker'&&a.kind==='worker'&&b.level===a.level&&visible(b));if(b){from=position(a);to=position(b);label='Drag to merge';break;}}
      if(!from)barrel('worker');
    }else if(!t.rewound){const e=find('rewind');if(e){from=position(e);label='Tap to rewind';}else barrel('rewind');}
    else if(!t.bombed){const e=find('bomb'),rock=s.stones.find(r=>r.distance>=0);if(e&&rock){from=position(e);to=project(samplePath(rock.frozenRenderDistance??rock.waitingRenderDistance??rock.distance),.3);label='Drag onto rocks';}else barrel('bomb');}
    else if(!s.workerDropBoost){const price=workerUpgradePrice(s,CONFIG);if(price!==null&&s.coins>=price){const b=this.shell.querySelector('[data-worker-upgrade]')!.getBoundingClientRect(),r=this.shell.getBoundingClientRect();from={x:b.left+b.width/2-r.left,y:b.top-r.top};label='Upgrade workers';}}
    else if(!t.bought){const pad=s.pads.find(p=>!p.unlocked&&s.coins>=p.price);if(pad){from=project(pad,.3);label='Add a work pad';}}
    else{this.done=true;s.tutorial.finished=true;try{localStorage.setItem('graveyard-guide','done');}catch{}return;}
    if(!from)return;
    this.svg.style.display='';
    const a=from as unknown as {x:number;y:number},b=to as unknown as {x:number;y:number}|null;
    const phase=reduced?.5:s.time%2.4/2.4,trail=this.svg.children[0]!,ring=this.svg.children[1]!,arrow=this.svg.children[2]!,text=this.svg.children[3]!;
    let x=a.x,y=a.y-9-(reduced?0:Math.sin(s.time*5)*6);
    trail.setAttribute('d','');
    if(b){const cx=(a.x+b.x)/2+Math.min(65,Math.abs(a.y-b.y)*.2),cy=(a.y+b.y)/2-30;
      trail.setAttribute('d',`M${a.x} ${a.y} Q${cx} ${cy} ${b.x} ${b.y}`);
      const q=Math.min(1,phase*1.3),v=1-q;x=v*v*a.x+2*v*q*cx+q*q*b.x;y=v*v*a.y+2*v*q*cy+q*q*b.y;
      ring.setAttribute('cx',String(b.x));ring.setAttribute('cy',String(b.y));
    }else{ring.setAttribute('cx',String(a.x));ring.setAttribute('cy',String(a.y));}
    arrow.setAttribute('transform',`translate(${x} ${y})`);
    text.setAttribute('x',String(Math.max(72,Math.min(this.shell.clientWidth-72,a.x))));text.setAttribute('y',String(Math.max(22,a.y-60)));text.textContent=label;
  }
}
