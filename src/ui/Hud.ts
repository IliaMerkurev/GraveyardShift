import type { GameState } from '../game/GameState';
import { workerBarrelRange, workerUpgradePrice } from '../game/commands';
import { CONFIG } from '../game/config';
export class Hud {
  private coin:HTMLElement;private step:HTMLElement;private instruction:HTMLElement;private detail:HTMLElement;private status:HTMLElement;private toastElement:HTMLElement;private overlay:HTMLElement;
  private upgrade:HTMLButtonElement;
  private toastUntil=0;private goalShown=false;private ended=false;
  constructor(private shell:HTMLElement,actions:{restart:()=>void;pause:()=>void;resume:()=>void;upgrade:()=>void}){
    const ui=document.createElement('div');ui.innerHTML=`<header class="topbar"><div class="wordmark">ROCKSNAKE<small>MINING LAB · v0.2</small></div><div class="wallet" aria-label="Coins"><span class="coin">●</span><span data-coins>0</span></div><button class="icon-button" aria-label="Restart" title="Restart">↻</button></header><section class="tutorial" aria-live="polite"><span class="step"></span><div class="instruction"></div><div class="detail"></div></section><footer class="footer"><button class="upgrade-button" data-worker-upgrade></button><span class="belt-status">← BELT EXIT = ITEMS LOST</span><button class="help-button" aria-label="Help">?</button></footer><div class="toast" role="status"></div><div class="overlay" hidden role="dialog" aria-modal="true" aria-labelledby="modal-title"><section class="card"><h1 id="modal-title"></h1><p></p><button data-continue>Keep mining</button><button data-restart class="secondary">Restart</button></section></div>`;
    shell.append(ui);this.coin=ui.querySelector('[data-coins]')!;this.step=ui.querySelector('.step')!;this.instruction=ui.querySelector('.instruction')!;this.detail=ui.querySelector('.detail')!;this.status=ui.querySelector('.belt-status')!;this.toastElement=ui.querySelector('.toast')!;this.overlay=ui.querySelector('.overlay')!;
    this.upgrade=ui.querySelector<HTMLButtonElement>('[data-worker-upgrade]')!;this.upgrade.addEventListener('click',actions.upgrade);
    ui.querySelector('[aria-label="Restart"]')!.addEventListener('click',actions.restart);
    ui.querySelector('[aria-label="Help"]')!.addEventListener('click',()=>{if(this.ended)return;actions.pause();this.modal('Stop the rock snake','The head starts halfway along the track. It speeds up over time. Stop it before it reaches FINISH, or the run ends. Tap barrels, drag workers onto pads, and merge matching levels. Drop a worker onto an affordable locked pad to buy it and place the worker together. After rocks break, the front pauses briefly, then snaps back magnetically toward the continuously moving rear. Larger gaps pull faster; contact gives a small recoil. Drag bombs onto the rocks. Tap a cyan rewind token or drag it onto the field to move the head back to just before the first bend. Rewind never moves the head forward or resets its speed. Tap a purple pause token or drag it onto the field to freeze all snake motion for five full seconds, including recoil and rewind. Pending rewind resumes afterward. Workers and the belt keep their normal speed. Another pause token refreshes the timer. Every barrel reveals an item. Coin barrels also grant 50 coins and reveal rewind. The belt keeps moving. Uncollected items are lost at the left exit. Picked-up workers, bombs, and bonuses stay safe while held; canceled or invalid drops return them to their source. Buy the three bonus storage stands for 50, 150 and 300 coins by tapping or dropping a bonus when you can afford it. Each holds one bomb, rewind or pause indefinitely. Drag a stored bonus onto the field to use it; rewind and pause also work by tapping. Workers and barrels cannot be stored. WORKER DROP upgrades cost 50, then 100, then 200 coins and keep doubling. Every purchase adds one to both ends of the current worker barrel level range, on top of your deployed workers. Only future reveals change. Restart clears storage purchases and upgrades.',false);});
    ui.querySelector('[data-continue]')!.addEventListener('click',()=>{if(this.ended)return;this.overlay.hidden=true;actions.resume();});
    ui.querySelector('[data-restart]')!.addEventListener('click',actions.restart);
  }
  private modal(title:string,text:string,defeat:boolean){this.overlay.querySelector('h1')!.textContent=title;this.overlay.querySelector('p')!.textContent=text;const resume=this.overlay.querySelector<HTMLButtonElement>('[data-continue]')!;resume.hidden=defeat;const restart=this.overlay.querySelector<HTMLButtonElement>('[data-restart]')!;restart.classList.toggle('secondary',!defeat);this.overlay.hidden=false;(defeat?restart:resume).focus();}
  goal(){if(this.goalShown||this.ended)return;this.goalShown=true;this.message('Level 3 and a new pad! Keep the head away from the finish.');}
  defeat(){if(this.ended)return;this.ended=true;this.toastElement.classList.remove('visible');this.modal('Game over','The head reached the finish. Restart to try again. Mine and bomb rocks to push it back, and tap rewind tokens before they leave the belt.',true);}
  message(text:string){if(this.ended)return;this.toastElement.textContent=text;this.toastUntil=performance.now()+2800;this.toastElement.classList.add('visible');}
  reset(){this.goalShown=false;this.ended=false;this.overlay.hidden=true;this.toastUntil=0;this.toastElement.classList.remove('visible');}
  render(state:GameState){
    const price=workerUpgradePrice(state,CONFIG),range=workerBarrelRange(state);
    this.upgrade.disabled=state.paused||state.gameOver||!!state.drag||price===null||state.coins<price;
    this.upgrade.textContent=`WORKER DROP +${state.workerDropBoost}\n${price===null?'LIMIT':`UPGRADE · ${price.toLocaleString('en-US')} ●`}`;
    this.upgrade.title=`Current worker barrel range: ${range.lowest}–${range.highest}. Each upgrade adds +1 to both limits. Next price doubles.`;
    this.upgrade.setAttribute('aria-label',`Worker drop boost ${state.workerDropBoost}. Current range ${range.lowest} to ${range.highest}. ${price===null?'Numeric price limit reached.':`Upgrade for ${price} coins.`}`);
    this.upgrade.dataset.boost=String(state.workerDropBoost);this.upgrade.dataset.price=price===null?'':String(price);
    this.coin.textContent=String(state.coins);const t=state.tutorial;let text:string[];
    if(state.gameOver)text=['RUN ENDED','The head reached the finish','Restart to try again'];
    else if(!t.opened)text=['HEAD STARTS HALFWAY','Stop the head before the finish','Tap barrels · Mine rocks to push the snake back'];
    else if(!t.merged)text=['02 · STRONGER TOGETHER','Drag matching workers together','1 + 1 = 2 · Try the occupied pad'];
    else if(!t.bought)text=['03 · ROOM TO GROW','Open a new mining pad','Tap a price tag or drop a worker when you can afford it'];
    else if(!t.placed)text=['04 · GET TO WORK','Drag a worker onto an open pad','Workers mine rocks and pull the snake back'];
    else if(!t.bombed)text=['05 · MAKE SOME SPACE','Drag a bomb onto the rocks','Tap or drag cyan rewind onto the field'];
    else text=['STOP THE ROCK SNAKE',state.goalReached?'Keep the head from the finish':'Make a level 3 worker','Mine · Merge · Tap or drag bonuses'];
    this.step.textContent=text[0];this.instruction.textContent=text[1];this.detail.textContent=text[2];
    const slowing=state.slowRemaining>0&&!state.gameOver;
    this.status.dataset.slow=String(slowing);this.status.dataset.remaining=state.slowRemaining.toFixed(3);this.status.style.background=slowing?'#51418fe8':'';this.status.setAttribute('role',slowing?'timer':'status');
    this.status.textContent=state.gameOver?'HEAD REACHED THE FINISH':slowing?`⏸ SNAKE PAUSED · ${(Math.ceil(state.slowRemaining*10)/10).toFixed(1)}s`:state.drag?'BELT MOVES · HELD ITEM SAFE':'← BELT EXIT = ITEMS LOST';
    if(performance.now()>this.toastUntil)this.toastElement.classList.remove('visible');
    const activeLabel=this.shell.querySelector('.pulse');activeLabel?.classList.remove('pulse');
    if(state.gameOver)return;
    if(!t.opened){const barrel=Object.values(state.entities).find(e=>e.kind==='barrel');if(barrel)this.shell.querySelector(`[data-entity="${barrel.id}"]`)?.classList.add('pulse');}
    else if(t.merged&&!t.bought){const pad=state.pads.find(p=>!p.unlocked&&state.coins>=p.price);if(pad)this.shell.querySelector(`[data-pad="${pad.id}"]`)?.classList.add('pulse');}
  }
}
