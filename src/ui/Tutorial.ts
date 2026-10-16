import type {GameState,Entity,Worker} from '../game/GameState';
import {getEntityPosition,workerUpgradePrice} from '../game/commands';
import {CONFIG} from '../game/config';
import {samplePath} from '../game/path';
import type {SceneView} from '../render/SceneFactory';

/** Live, optional hints. They never own input or stop simulation. */
export class Tutorial {
  private svg:SVGSVGElement;
  private done=false;
  private discarded=false;
  private swapped=false;
  constructor(private shell:HTMLElement,private view:SceneView){
    try{this.done=localStorage.getItem('graveyard-guide')==='storage';this.discarded=localStorage.getItem('graveyard-field-income')==='done';this.swapped=localStorage.getItem('graveyard-swap')==='done';}catch{}
    this.svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    this.svg.classList.add('live-guide');this.svg.setAttribute('aria-hidden','true');
    this.svg.innerHTML='<path class="guide-trail"/><circle r="17" class="guide-ring"/><path class="guide-arrow" d="M -8 -36 L 8 -36 L 8 -17 L 19 -17 L 0 3 L -19 -17 L -8 -17 Z"/><text class="guide-label" text-anchor="middle"/>';
    shell.append(this.svg);
  }
  reset(){this.done=this.discarded=this.swapped=false;try{localStorage.removeItem('graveyard-guide');localStorage.removeItem('graveyard-field-income');localStorage.removeItem('graveyard-swap');}catch{}}
  render(s:GameState){
    if(s.tutorial.discarded&&!this.discarded){this.discarded=true;try{localStorage.setItem('graveyard-field-income','done');}catch{}}
    if(s.tutorial.swapped&&!this.swapped){this.swapped=true;try{localStorage.setItem('graveyard-swap','done');}catch{}}
    s.tutorial.finished=this.done;
    this.svg.style.display='none';
    if(this.done&&this.discarded&&this.swapped||s.paused||s.gameOver||s.drag||this.shell.querySelector('.audio-menu:not([hidden])'))return;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rect=this.view.canvas.getBoundingClientRect(),shell=this.shell.getBoundingClientRect();
    const project=(p:Parameters<SceneView['project']>[0],y:number,belt=false,zone?:Parameters<SceneView['project']>[3])=>{const v=this.view.project(p,y,belt,zone);return{x:v.x+rect.left-shell.left,y:v.y+rect.top-shell.top};};
    const entities=Object.values(s.entities),t=s.tutorial;
    const visible=(e:Entity)=>e.location.kind!=='slot'||(getEntityPosition(s,e)!.x>=-2.7&&getEntityPosition(s,e)!.x<=2.7);
    const position=(e:Entity)=>{const p=getEntityPosition(s,e);return p?project(p,e.kind==='worker'?.7:.65,e.location.kind==='slot'):null;};
    const find=(kind:string)=>entities.find(e=>e.kind===kind&&visible(e));
    let from:{x:number;y:number}|null=null,to:{x:number;y:number}|null=null,label='TAP';
    const barrel=(kind:string)=>{const e=entities.find(e=>e.kind==='barrel'&&e.content===kind&&visible(e));if(e)from=position(e);};
    const field=entities.filter((e):e is Worker=>e.kind==='worker'&&s.pads.some(p=>p.unlocked&&!p.reserved&&p.entityId===e.id&&e.location.kind==='pad'&&p.id===e.location.id));
    const core=this.done||t.merged&&t.rewound&&t.bombed,first=field.find(e=>e.id===s.pads[0].entityId),swap=!this.swapped&&core&&first&&field.find(e=>e.level>first.level);
    const spare=!this.discarded&&core&&s.pads.every(p=>!p.unlocked||field.some(e=>e.id===p.entityId))&&field.sort((a,b)=>a.level-b.level)[0];
    if(swap&&first){from=position(swap);to=position(first);label='SWAP';}
    else if(spare&&entities.some(e=>e.kind==='worker'&&e.level>spare.level&&e.location.kind==='slot'&&s.slots.some(p=>p.id===(e.location as {id:string}).id&&p.entityId===e.id&&!p.reserved)&&visible(e))){from=position(spare);to=project(CONFIG.discard,.1,false,'discard');label='Income +20%';}
    else if(this.done)return;
    else if(!t.merged){
      const workers=entities.filter(e=>e.kind==='worker').sort((a,b)=>Number(a.location.kind==='pad')-Number(b.location.kind==='pad'));
      for(const a of workers){if(!visible(a))continue;const b=workers.find(b=>b.id!==a.id&&b.kind==='worker'&&a.kind==='worker'&&b.level===a.level&&visible(b));if(b){from=position(a);to=position(b);label='MERGE';break;}}
      if(!from)barrel('worker');
    }else if(!t.rewound){const e=find('rewind');if(e){from=position(e);label='REWIND';}else barrel('rewind');}
    else if(!t.bombed){const e=find('bomb'),rock=s.stones.find(r=>r.distance>=0);if(e&&rock){from=position(e);to=project(samplePath(rock.frozenRenderDistance??rock.waitingRenderDistance??rock.distance),.3);label='DROP BOMB';}else barrel('bomb');}
    else if(!s.workerDropBoost){const price=workerUpgradePrice(s,CONFIG);if(price!==null&&s.coins>=price){const b=this.shell.querySelector('[data-worker-upgrade]')!.getBoundingClientRect(),r=this.shell.getBoundingClientRect();from={x:b.left+b.width/2-r.left,y:b.top-r.top};label='UPGRADE';}}
    else if(!t.bought){const pad=s.pads.find(p=>!p.unlocked&&!p.entityId&&!p.reserved&&s.coins>=p.price);if(pad){from=project(pad,.3);label='BUY';}}
    else if(!s.storage.some(p=>p.unlocked)){const pocket=s.storage.find(p=>!p.entityId&&!p.reserved&&s.coins>=p.price);if(pocket){from=project(pocket,.3);label='BUY';}}
    else if(!t.storageUsed){
      const saved=entities.find(e=>e.location.kind==='storage');
      if(saved){from=position(saved);label='USE';if(saved.kind==='bomb'){const rock=s.stones.find(r=>r.distance>=0);if(rock){to=project(samplePath(rock.distance),.3);label='DROP BOMB';}else from=null;}}
      else{const pocket=s.storage.find(p=>p.unlocked&&!p.entityId&&!p.reserved),bonus=entities.find(e=>e.kind!=='worker'&&e.kind!=='barrel'&&visible(e));
        if(pocket&&bonus){from=position(bonus);to=project(pocket,.3);label='STORE';}
        else{const b=entities.find(e=>e.kind==='barrel'&&e.content!=='worker'&&visible(e));if(b)from=position(b);}
      }
    }
    else{this.done=true;s.tutorial.finished=true;try{localStorage.setItem('graveyard-guide','storage');}catch{}return;}
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
    text.setAttribute('x',String(Math.max(72,Math.min(this.shell.clientWidth-72,x))));text.setAttribute('y',String(Math.max(22,Math.min(this.shell.clientHeight-12,y-48))));text.textContent=label;
  }
}
