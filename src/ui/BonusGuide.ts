import {getEntityPosition} from '../game/commands';
import type {SceneView} from '../render/SceneFactory';
import type {GameEvent,GameState} from '../game/GameState';
export const BONUS_HELP:Record<string,string>={
  bomb:'💣 Bomb — Drag onto rocks to blast nearby stones.',
  rewind:'⏪ Rewind — Return to just before the first bend; speed stays unchanged.',
  slow:'Ⅱ Pause — Stop the snake for 5s (refreshes); miners and belt keep moving.',
  brake:'↓20% Brake — Permanently cut current speed by 20%, down to 10% of starting speed; acceleration continues.',
  halfSpeed:'↓50% Half speed — Permanently halve current speed, even below the normal minimum; acceleration continues.',
  tailBlast:'✹½ Tail blast — Destroy the rear half; the front waits for new rocks to catch up.'
};
export const BONUS_TIP:Record<string,string>={bomb:'💣 Blast nearby rocks',rewind:'⏪ Rewind to first turn',slow:'Ⅱ Freeze · 5s',brake:'↓ Speed −20%',halfSpeed:'½ Speed ÷2',tailBlast:'✹ Destroy ½ tail'};
/** One passive explanation at a time; timers advance only while readable. */
export class BonusGuide{
  private seen:string[]=[];private queue:{id:string;kind:string}[]=[];private left=0;private tip:HTMLElement;
  constructor(private shell:HTMLElement,private view:SceneView){
    try{const saved=JSON.parse(localStorage.getItem('graveyard-bonuses')||'[]');if(Array.isArray(saved))this.seen=saved.filter(k=>typeof k==='string'&&Object.hasOwn(BONUS_HELP,k));}catch{}
    this.tip=document.createElement('aside');this.tip.className='bonus-tip';this.tip.setAttribute('role','status');this.tip.hidden=true;shell.append(this.tip);
  }
  reset(forget=false){this.queue=[];this.left=0;this.tip.hidden=true;if(forget){this.seen=[];try{localStorage.removeItem('graveyard-bonuses');}catch{}}}
  render(s:GameState,events:GameEvent[],dt:number){
    for(const e of events){const kind=e.type==='open'&&e.entityId?s.entities[e.entityId]?.kind:'';if(kind&&Object.hasOwn(BONUS_HELP,kind)&&!this.seen.includes(kind)&&!this.queue.some(q=>q.kind===kind))this.queue.push({kind,id:e.entityId!});}
    while(this.queue.length&&s.entities[this.queue[0].id]?.kind!==this.queue[0].kind){this.queue.shift();this.left=0;}
    const blocked=s.paused||s.gameOver||!!s.drag||!!this.shell.querySelector('.audio-menu:not([hidden]),.overlay:not([hidden])');
    this.tip.hidden=blocked||!this.queue.length;
    if(this.tip.hidden)return;
    const {kind,id}=this.queue[0],entity=s.entities[id],point=getEntityPosition(s,entity);
    if(!point){this.tip.hidden=true;return;}
    const p=this.view.project(point,.9,entity.location.kind==='slot'),canvas=this.view.canvas.getBoundingClientRect(),box=this.shell.getBoundingClientRect();
    const x=p.x+canvas.left-box.left,y=p.y+canvas.top-box.top;
    if(x<0||x>box.width||y<0||y>box.height){this.tip.hidden=true;return;}
    if(!this.left){this.left=7;this.tip.textContent=BONUS_TIP[kind];this.seen.push(kind);try{localStorage.setItem('graveyard-bonuses',JSON.stringify(this.seen));}catch{}}
    const w=this.tip.offsetWidth,h=this.tip.offsetHeight,clamp=(v:number,max:number)=>Math.max(8,Math.min(v,max));
    const left=clamp(x-w/2,box.width-w-8),above=y-h-32,below=y+38;
    const obstacles=[...this.shell.querySelectorAll('.topbar button,.wallet,.upgrade-button')].map(e=>e.getBoundingClientRect());
    const clear=(top:number)=>top>=8&&top+h<=box.height-8&&!obstacles.some(r=>left+box.left<r.right&&left+w+box.left>r.left&&top+box.top<r.bottom&&top+h+box.top>r.top);
    const down=!clear(above)&&clear(below),top=clamp(down?below:above,box.height-h-8);
    this.tip.style.left=`${left}px`;this.tip.style.top=`${top}px`;this.tip.dataset.below=String(down);
    this.tip.style.setProperty('--tip-x',`${Math.max(12,Math.min(w-12,x-left))}px`);
    this.left=Math.max(0,this.left-dt);this.tip.style.opacity=String(Math.min(1,this.left/.4));
    if(!this.left){this.queue.shift();this.tip.hidden=true;}
  }
}
