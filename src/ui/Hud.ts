import type { GameState } from '../game/GameState';
export class Hud {
  private coin:HTMLElement;private step:HTMLElement;private instruction:HTMLElement;private detail:HTMLElement;private status:HTMLElement;private toastElement:HTMLElement;private overlay:HTMLElement;
  private toastUntil=0;private goalShown=false;
  constructor(private shell:HTMLElement,actions:{restart:()=>void;pause:()=>void;resume:()=>void;cta:()=>void}){
    const ui=document.createElement('div');ui.innerHTML=`<header class="topbar"><div class="wordmark">ROCKSNAKE<small>MINING LAB · v0.1</small></div><div class="wallet" aria-label="Coins"><span class="coin">●</span><span data-coins>0</span></div><button class="icon-button" aria-label="Restart" title="Restart">↻</button></header><section class="tutorial" aria-live="polite"><span class="step"></span><div class="instruction"></div><div class="detail"></div></section><footer class="footer"><span class="belt-status">← OPEN A BARREL</span><button class="help-button" aria-label="Help">?</button></footer><div class="toast" role="status"></div><div class="overlay" hidden><section class="card"><h1></h1><p></p><button data-continue>Keep mining</button><button data-restart class="secondary">Restart</button><button data-cta class="secondary" hidden>Store preview</button></section></div>`;
    shell.append(ui);this.coin=ui.querySelector('[data-coins]')!;this.step=ui.querySelector('.step')!;this.instruction=ui.querySelector('.instruction')!;this.detail=ui.querySelector('.detail')!;this.status=ui.querySelector('.belt-status')!;this.toastElement=ui.querySelector('.toast')!;this.overlay=ui.querySelector('.overlay')!;
    ui.querySelector('[aria-label="Restart"]')!.addEventListener('click',actions.restart);
    ui.querySelector('[aria-label="Help"]')!.addEventListener('click',()=>{actions.pause();this.modal('A little mining lab','Tap a barrel. Drag workers onto open pads to mine. Merge two matching levels, on pads or on the belt. Spend coins to open more pads. Drag a bomb onto the rocks. Everything can be played with a mouse or a finger.',false);});
    ui.querySelector('[data-continue]')!.addEventListener('click',()=>{this.overlay.hidden=true;actions.resume();});
    ui.querySelector('[data-restart]')!.addEventListener('click',actions.restart);
    ui.querySelector('[data-cta]')!.addEventListener('click',actions.cta);
  }
  private modal(title:string,text:string,goal:boolean){this.overlay.querySelector('h1')!.textContent=title;this.overlay.querySelector('p')!.textContent=text;(this.overlay.querySelector('[data-cta]')! as HTMLElement).hidden=!goal;this.overlay.hidden=false;}
  goal(){if(this.goalShown)return;this.goalShown=true;this.modal('A rock-solid start!','Level 3 and a new mining pad. Prototype goal reached. Keep experimenting or start a fresh run.',true);}
  message(text:string){this.toastElement.textContent=text;this.toastUntil=performance.now()+2300;this.toastElement.classList.add('visible');}
  reset(){this.goalShown=false;this.overlay.hidden=true;this.toastUntil=0;this.toastElement.classList.remove('visible');}
  render(state:GameState){this.coin.textContent=String(state.coins);const t=state.tutorial;let text:string[];
    if(!t.opened)text=['01 · A NEW DELIVERY','Tap a barrel','Workers, coins & a little surprise'];
    else if(!t.merged)text=['02 · STRONGER TOGETHER','Drag matching workers together','1 + 1 = 2 · Try the occupied pad'];
    else if(!t.bought)text=['03 · ROOM TO GROW','Open a new mining pad','Tap a price tag when you have enough coins'];
    else if(!t.placed)text=['04 · GET TO WORK','Drag a worker onto an open pad','Workers on pads mine automatically'];
    else if(!t.bombed)text=['05 · MAKE SOME SPACE','Drag a bomb onto the rocks','The ring shows exactly what it will hit'];
    else text=['YOUR LITTLE MINING EMPIRE',state.goalReached?'Keep the good work flowing':'Make a level 3 worker','Match levels · Mine rocks · Open more pads'];
    this.step.textContent=text[0];this.instruction.textContent=text[1];this.detail.textContent=text[2];
    this.status.textContent=state.drag?'DROP ON A HIGHLIGHTED TARGET':state.conveyorPaused?'BELT FULL · OPEN OR MOVE ITEMS':'← DELIVERIES IN MOTION';
    if(performance.now()>this.toastUntil)this.toastElement.classList.remove('visible');
    const activeLabel=this.shell.querySelector('.pulse');activeLabel?.classList.remove('pulse');
    if(!t.opened){const barrel=Object.values(state.entities).find(e=>e.kind==='barrel');if(barrel)this.shell.querySelector(`[data-entity="${barrel.id}"]`)?.classList.add('pulse');}
    else if(t.merged&&!t.bought){const pad=state.pads.find(p=>!p.unlocked&&state.coins>=p.price);if(pad)this.shell.querySelector(`[data-pad="${pad.id}"]`)?.classList.add('pulse');}
  }
}
