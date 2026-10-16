import type {GameEvent,GameState} from '../game/GameState';
export const BONUS_HELP:Record<string,string>={
  bomb:'💣 Bomb — Drag onto rocks to blast nearby stones.',
  rewind:'⏪ Rewind — Return to just before the first bend; speed stays unchanged.',
  slow:'Ⅱ Pause — Stop the snake for 5s (refreshes); miners and belt keep moving.',
  brake:'↓20% Brake — Permanently cut current speed by 20%, down to 10% of starting speed; acceleration continues.',
  halfSpeed:'↓50% Half speed — Permanently halve current speed, even below the normal minimum; acceleration continues.',
  tailBlast:'✹½ Tail blast — Destroy the rear half; the front waits for new rocks to catch up.'
};
/** One passive explanation at a time; timers advance only while readable. */
export class BonusGuide{
  private seen:string[]=[];private queue:string[]=[];private left=0;private tip:HTMLElement;
  constructor(private shell:HTMLElement){
    try{const saved=JSON.parse(localStorage.getItem('graveyard-bonuses')||'[]');if(Array.isArray(saved))this.seen=saved.filter(k=>typeof k==='string'&&Object.hasOwn(BONUS_HELP,k));}catch{}
    this.tip=document.createElement('aside');this.tip.className='bonus-tip';this.tip.setAttribute('role','status');this.tip.hidden=true;shell.append(this.tip);
  }
  reset(forget=false){this.queue=[];this.left=0;this.tip.hidden=true;if(forget){this.seen=[];try{localStorage.removeItem('graveyard-bonuses');}catch{}}}
  render(s:GameState,events:GameEvent[],dt:number){
    for(const e of events){const kind=e.type==='open'&&e.entityId?s.entities[e.entityId]?.kind:'';if(kind&&Object.hasOwn(BONUS_HELP,kind)&&!this.seen.includes(kind)&&!this.queue.includes(kind))this.queue.push(kind);}
    const blocked=s.paused||s.gameOver||!!s.drag||!!this.shell.querySelector('.audio-menu:not([hidden]),.overlay:not([hidden])');
    this.tip.hidden=blocked||!this.queue.length;
    if(this.tip.hidden)return;
    const kind=this.queue[0];
    if(!this.left){this.left=7;this.tip.textContent=BONUS_HELP[kind];this.seen.push(kind);try{localStorage.setItem('graveyard-bonuses',JSON.stringify(this.seen));}catch{}}
    this.left=Math.max(0,this.left-dt);this.tip.style.opacity=String(Math.min(1,this.left/.4));
    if(!this.left){this.queue.shift();this.tip.hidden=true;}
  }
}
