import {formatNumber,formatIncome} from './formatNumber';
import {attachAudioMenu} from './AudioMenu';
import type {AudioSettings} from '../audio/AudioSettings';
import type { GameEvent, GameState } from '../game/GameState';
import { workerBarrelRange, workerUpgradePrice } from '../game/commands';
import { CONFIG } from '../game/config';
export class Hud {
  private income:HTMLElement;private coin:HTMLElement;private status:HTMLElement;private toastElement:HTMLElement;private overlay:HTMLElement;
  private pauseButton:HTMLButtonElement;private paused=false;
  private upgrade:HTMLButtonElement;private popTimes=new WeakMap<HTMLElement,number>();
  private toastUntil=0;private goalShown=false;private ended=false;
  private guidanceCounts=new Map<string,number>();
  constructor(private shell:HTMLElement,actions:{guide?:()=>void;restart:()=>void;pause:()=>void;resume:()=>void;upgrade:()=>void;toggleSound?:()=>boolean;audioSettings?:AudioSettings;logo?:string}){
    const ui=document.createElement('div');ui.innerHTML=`<header class="topbar"><div class="wordmark">GRAVEYARD SHIFT<small>UNDEAD MINING CO. · v0.4</small></div><div class="wallet" aria-label="Coins"><span class="coin">●</span><span><span data-coins>0</span><small data-income style="display:block;font-size:10px"></small></span></div><button class="icon-button sound-button" data-sound aria-label="Mute sound effects" aria-pressed="false" title="Mute sound effects">♪</button><button class="icon-button pause-button" data-pause aria-label="Pause game" aria-pressed="false" title="Pause game"><span aria-hidden="true">Ⅱ</span><small>Pause</small></button><button class="icon-button" aria-label="Restart" title="Restart">↻</button></header><footer class="footer"><button class="upgrade-button" data-worker-upgrade></button><span class="belt-status" hidden></span><button class="help-button" aria-label="Help">?</button></footer><div class="toast" role="status"></div><div class="overlay" hidden role="dialog" aria-modal="true" aria-labelledby="modal-title"><section class="card"><h1 id="modal-title"></h1><p></p><button data-guide class="secondary">Restart with guide</button><button data-continue>Keep mining</button><button data-restart class="secondary">Restart</button></section></div>`;
    if(actions.logo){const logo=document.createElement('img');logo.src=actions.logo;logo.alt='Graveyard Shift · Undead Mining Co.';logo.className='hud-logo';ui.querySelector('.wordmark')!.replaceChildren(logo);}
    ui.querySelector('.topbar')!.append(ui.querySelector('.help-button')!);
    shell.append(ui);this.income=ui.querySelector('[data-income]')!;this.coin=ui.querySelector('[data-coins]')!;this.status=ui.querySelector('.belt-status')!;this.toastElement=ui.querySelector('.toast')!;this.overlay=ui.querySelector('.overlay')!;
    const sound=ui.querySelector<HTMLButtonElement>('[data-sound]')!;if(actions.audioSettings)attachAudioMenu(sound,actions.audioSettings);else sound.addEventListener('click',()=>{const muted=actions.toggleSound?.()??false;sound.textContent=muted?'♪̸':'♪';sound.dataset.muted=String(muted);sound.setAttribute('aria-pressed',String(muted));sound.title=muted?'Unmute sound effects':'Mute sound effects';sound.setAttribute('aria-label',sound.title);});
    this.pauseButton=ui.querySelector<HTMLButtonElement>('[data-pause]')!;
    this.pauseButton.addEventListener('click',()=>{if(this.ended||!this.overlay.hidden)return;if(this.paused)actions.resume();else actions.pause();});
    this.upgrade=ui.querySelector<HTMLButtonElement>('[data-worker-upgrade]')!;this.upgrade.addEventListener('click',actions.upgrade);
    ui.querySelector('[aria-label="Restart"]')!.addEventListener('click',actions.restart);
    ui.querySelector('[aria-label="Help"]')!.addEventListener('click',()=>{if(this.ended)return;actions.pause();this.modal('Stop the rock snake','Stop the snake before FINISH. Tap barrels; drag workers onto pads, paying for locked pads. Equal levels merge; stronger workers replace weaker pad workers. Each manual discard or replacement gives +20% rock income this run (numeric limits apply); merges and canceled drops do not. Drag bombs onto rocks. Tap other bonuses or drop them on the field: rewind moves the snake before bend one; pause lasts 5s; ↓20% slows it with a 10% starting-speed floor; ↓50% halves speed without that floor; tail blast destroys half the rocks. Acceleration continues through rewinds. Upgrades raise the spawn range by one; rolls favor lower levels within the latest three. Prices rise 20% per purchase, rounded up: 50, 60, 72, 87. Discards affect only income; upgrades affect only future spawns and prices. Buy storage for bonuses. Belt items exit left; held items are safe; canceled drags return them. Restart resets income to ×1 and upgrades to 50. Guide optional.',false);});
    ui.querySelector('[data-guide]')!.addEventListener('click',()=>actions.guide?.());
    ui.querySelector('[data-continue]')!.addEventListener('click',()=>{if(this.ended)return;this.overlay.hidden=true;actions.resume();});
    ui.querySelector('[data-restart]')!.addEventListener('click',actions.restart);
  }
  private modal(title:string,text:string,defeat:boolean){this.overlay.querySelector('h1')!.textContent=title;this.overlay.querySelector('p')!.textContent=text;const resume=this.overlay.querySelector<HTMLButtonElement>('[data-continue]')!;resume.hidden=defeat;const restart=this.overlay.querySelector<HTMLButtonElement>('[data-restart]')!;restart.classList.toggle('secondary',!defeat);this.overlay.hidden=false;(defeat?restart:resume).focus();}
  goal(){if(this.goalShown||this.ended)return;this.goalShown=true;this.guidance('Level 3! Keep mining','goal');}
  defeat(){if(this.ended)return;this.ended=true;this.toastElement.classList.remove('visible');this.modal('Game over','The head reached the finish. Restart to try again. Mine and bomb rocks to push it back, and tap rewind tokens before they leave the belt.',true);}
  message(text:string,guidance=false){if(this.ended)return;this.toastElement.dataset.guidance=String(guidance);this.toastElement.textContent=text;this.toastUntil=performance.now()+2400;this.toastElement.classList.add('visible');}
  guidance(text:string,key:string){const count=this.guidanceCounts.get(key)??0;if(count>=2||this.ended)return;this.guidanceCounts.set(key,count+1);this.message(text,true);}
  reset(){this.guidanceCounts.clear();this.goalShown=false;this.ended=false;this.overlay.hidden=true;this.toastUntil=0;this.toastElement.classList.remove('visible');}
  private pop(element:HTMLElement){if(typeof element.animate!=='function')return;const now=performance.now();if(now-(this.popTimes.get(element)??-Infinity)<140)return;this.popTimes.set(element,now);for(const animation of element.getAnimations())animation.cancel();const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;element.animate(reduced?[{filter:'brightness(1.35)'},{filter:'brightness(1)'}]:[{transform:'scale(1)'},{transform:'scale(1.11)',offset:.25},{transform:'scale(.98)',offset:.65},{transform:'scale(1)'}],{duration:260,easing:'ease-out'});}
  feedback(events:GameEvent[]){if(events.some(e=>e.type==='coins'||e.type==='purchase'))this.pop(this.coin.parentElement!);}
  upgradeFeedback(){this.pop(this.upgrade);this.pop(this.coin.parentElement!);}
  render(state:GameState){
    if(this.paused!==state.paused){
      this.paused=state.paused;
      this.pauseButton.querySelector('span')!.textContent=this.paused?'▶':'Ⅱ';
      this.pauseButton.querySelector('small')!.textContent=this.paused?'Resume':'Pause';
      this.pauseButton.title=this.paused?'Resume game':'Pause game';
      this.pauseButton.setAttribute('aria-label',this.pauseButton.title);
      this.pauseButton.setAttribute('aria-pressed',String(this.paused));
    }
    this.pauseButton.disabled=state.gameOver||!this.overlay.hidden;
    const price=workerUpgradePrice(state,CONFIG),range=workerBarrelRange(state);
    this.upgrade.disabled=state.paused||state.gameOver||!!state.drag||price===null||state.coins<price;
    const levelRange=range.lowest===range.highest?String(range.lowest):`${range.lowest}–${range.highest}`;
    const action=price===null?'LIMIT':`↑${formatNumber(price)}`;
    this.upgrade.textContent=`LV ${levelRange}\n${action}`;
    this.upgrade.title=`Worker barrels: level ${levelRange}. ${price===null?'Numeric price limit reached.':`Raise spawn range for ${price} coins. Price +20% per purchase; discards affect only income.`}`;
    this.upgrade.setAttribute('aria-label',this.upgrade.title);
    this.upgrade.dataset.boost=String(state.workerDropBoost);this.upgrade.dataset.price=price===null?'':String(price);
    this.upgrade.dataset.ready=String(!this.upgrade.disabled);
    this.coin.textContent=formatNumber(state.coins);
    this.coin.title=String(state.coins);
    this.income.textContent=`Income ×${formatIncome(state.incomeMultiplier)}`;
    this.income.title=`Rock income ×${state.incomeMultiplier}`;
    const slowing=state.slowRemaining>0&&!state.gameOver;
    this.shell.dataset.slow=String(slowing);this.status.dataset.slow=String(slowing);this.status.dataset.remaining=state.slowRemaining.toFixed(3);this.status.style.background=slowing?'#51418fe8':'';this.status.setAttribute('role',slowing?'timer':'status');this.status.setAttribute('aria-label','Snake pause time remaining');
    this.status.hidden=!slowing;this.status.textContent=slowing?`⏸ ${(Math.ceil(state.slowRemaining*10)/10).toFixed(1)}s`:'';
    if(performance.now()>this.toastUntil)this.toastElement.classList.remove('visible');
  }
}
