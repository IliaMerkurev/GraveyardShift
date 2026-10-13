import type { GameState } from '../game/GameState';
export class Hud {
  private coin:HTMLElement;private step:HTMLElement;private instruction:HTMLElement;private detail:HTMLElement;private status:HTMLElement;private toastElement:HTMLElement;private overlay:HTMLElement;
  private toastUntil=0;private goalShown=false;private ended=false;
  constructor(private shell:HTMLElement,actions:{restart:()=>void;pause:()=>void;resume:()=>void}){
    const ui=document.createElement('div');ui.innerHTML=`<header class="topbar"><div class="wordmark">ROCKSNAKE<small>MINING LAB · v0.2</small></div><div class="wallet" aria-label="Coins"><span class="coin">●</span><span data-coins>0</span></div><button class="icon-button" aria-label="Restart" title="Restart">↻</button></header><section class="tutorial" aria-live="polite"><span class="step"></span><div class="instruction"></div><div class="detail"></div></section><footer class="footer"><span class="belt-status">← BELT EXIT = ITEMS LOST</span><button class="help-button" aria-label="Help">?</button></footer><div class="toast" role="status"></div><div class="overlay" hidden role="dialog" aria-modal="true" aria-labelledby="modal-title"><section class="card"><h1 id="modal-title"></h1><p></p><button data-continue>Keep mining</button><button data-restart class="secondary">Restart</button></section></div>`;
    shell.append(ui);this.coin=ui.querySelector('[data-coins]')!;this.step=ui.querySelector('.step')!;this.instruction=ui.querySelector('.instruction')!;this.detail=ui.querySelector('.detail')!;this.status=ui.querySelector('.belt-status')!;this.toastElement=ui.querySelector('.toast')!;this.overlay=ui.querySelector('.overlay')!;
    ui.querySelector('[aria-label="Restart"]')!.addEventListener('click',actions.restart);
    ui.querySelector('[aria-label="Help"]')!.addEventListener('click',()=>{if(this.ended)return;actions.pause();this.modal('Stop the rock snake','The head starts halfway along the track. It speeds up over time. Stop it before it reaches FINISH, or the run ends. Tap barrels, drag workers onto pads, and merge matching levels. Broken rocks pull the front of the snake back. Drag bombs onto the rocks. Tap a cyan rewind token to move the head back to the middle, or toward the first miner if it is already before the middle. Rewind never moves the head forward or resets its speed. Tap a purple clock to slow only the snake for five seconds. Workers and the belt keep their normal speed. Another clock refreshes the timer. Every barrel has a reward. The belt keeps moving, even during a drag: anything that reaches its left exit is lost.',false);});
    ui.querySelector('[data-continue]')!.addEventListener('click',()=>{if(this.ended)return;this.overlay.hidden=true;actions.resume();});
    ui.querySelector('[data-restart]')!.addEventListener('click',actions.restart);
  }
  private modal(title:string,text:string,defeat:boolean){this.overlay.querySelector('h1')!.textContent=title;this.overlay.querySelector('p')!.textContent=text;const resume=this.overlay.querySelector<HTMLButtonElement>('[data-continue]')!;resume.hidden=defeat;const restart=this.overlay.querySelector<HTMLButtonElement>('[data-restart]')!;restart.classList.toggle('secondary',!defeat);this.overlay.hidden=false;(defeat?restart:resume).focus();}
  goal(){if(this.goalShown||this.ended)return;this.goalShown=true;this.message('Level 3 and a new pad! Keep the head away from the finish.');}
  defeat(){if(this.ended)return;this.ended=true;this.toastElement.classList.remove('visible');this.modal('Game over','The head reached the finish. Restart to try again. Mine and bomb rocks to push it back, and tap rewind tokens before they leave the belt.',true);}
  message(text:string){if(this.ended)return;this.toastElement.textContent=text;this.toastUntil=performance.now()+2800;this.toastElement.classList.add('visible');}
  reset(){this.goalShown=false;this.ended=false;this.overlay.hidden=true;this.toastUntil=0;this.toastElement.classList.remove('visible');}
  render(state:GameState){this.coin.textContent=String(state.coins);const t=state.tutorial;let text:string[];
    if(state.gameOver)text=['RUN ENDED','The head reached the finish','Restart to try again'];
    else if(!t.opened)text=['HEAD STARTS HALFWAY','Stop the head before the finish','Tap barrels · Mine rocks to push the snake back'];
    else if(!t.merged)text=['02 · STRONGER TOGETHER','Drag matching workers together','1 + 1 = 2 · Try the occupied pad'];
    else if(!t.bought)text=['03 · ROOM TO GROW','Open a new mining pad','Tap a price tag when you have enough coins'];
    else if(!t.placed)text=['04 · GET TO WORK','Drag a worker onto an open pad','Workers mine rocks and pull the snake back'];
    else if(!t.bombed)text=['05 · MAKE SOME SPACE','Drag a bomb onto the rocks','Tap cyan rewind tokens to push the head back'];
    else text=['STOP THE ROCK SNAKE',state.goalReached?'Keep the head from the finish':'Make a level 3 worker','Mine · Merge · Tap rewind · The snake speeds up'];
    this.step.textContent=text[0];this.instruction.textContent=text[1];this.detail.textContent=text[2];
    const slowing=state.slowRemaining>0&&!state.gameOver;
    this.status.dataset.slow=String(slowing);this.status.dataset.remaining=state.slowRemaining.toFixed(3);this.status.style.background=slowing?'#51418fe8':'';this.status.setAttribute('role',slowing?'timer':'status');
    this.status.textContent=state.gameOver?'HEAD REACHED THE FINISH':slowing?`⏱ SNAKE SLOW · ${(Math.ceil(state.slowRemaining*10)/10).toFixed(1)}s`:state.drag?'BELT MOVES · DROP BEFORE EXIT':'← BELT EXIT = ITEMS LOST';
    if(performance.now()>this.toastUntil)this.toastElement.classList.remove('visible');
    const activeLabel=this.shell.querySelector('.pulse');activeLabel?.classList.remove('pulse');
    if(state.gameOver)return;
    if(!t.opened){const barrel=Object.values(state.entities).find(e=>e.kind==='barrel');if(barrel)this.shell.querySelector(`[data-entity="${barrel.id}"]`)?.classList.add('pulse');}
    else if(t.merged&&!t.bought){const pad=state.pads.find(p=>!p.unlocked&&state.coins>=p.price);if(pad)this.shell.querySelector(`[data-pad="${pad.id}"]`)?.classList.add('pulse');}
  }
}
