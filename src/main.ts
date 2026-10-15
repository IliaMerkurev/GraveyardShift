import soundtrack from './assets/GraveyardShift.mp3?inline';
import {MusicAudio} from './audio/MusicAudio';
import {AudioSettings} from './audio/AudioSettings';
import './style.css';
import { showVideoIntro } from './ui/VideoIntro';
import { loadSkeletonWorker } from './render/SkeletonWorker';
import { createRockSnakeAudio } from './audio/OrganicAudio';
import { soundForEvents } from './audio/eventSounds';
import { Game } from './game/Simulation';
import { SceneView } from './render/SceneFactory';
import { PointerController } from './input/PointerController';
import { Hud } from './ui/Hud';
import { PlayableBridge } from './platform/PlayableBridge';

const app=document.querySelector<HTMLElement>('#app')!;
const shell=document.createElement('div');shell.className='game-shell';app.append(shell);
const audioSettings=new AudioSettings();const music=new MusicAudio(soundtrack);
audioSettings.subscribe(value=>music.setEnabled(value.music));
// Register audio unlock before asynchronous model loading or the intro gesture.
const sfx=createRockSnakeAudio();
audioSettings.subscribe(value=>sfx.setMuted(!value.sounds));
async function prepareGame(shell:HTMLElement):Promise<()=>void> {
  await loadSkeletonWorker();
  shell.addEventListener('click',event=>{if((event.target as HTMLElement).closest('button'))sfx.play('ui',.35);});
  const game=new Game();const view=new SceneView(shell,target=>game.canDrop(target));const bridge=new PlayableBridge();let modalPaused=false;let lostFocus=false;let active=false;
  const pause=()=>{sfx.setPaused(true);input.cancel();if(game.state.gameOver)return;game.setPaused(true);bridge.pause();};
  const resume=()=>{if(!active||game.state.gameOver)return;modalPaused=false;lostFocus=false;game.setPaused(document.hidden);sfx.setPaused(document.hidden);if(!document.hidden)bridge.resume();lastTime=performance.now();};
  const restart=()=>{sfx.setPaused(true);input.cancel();game.reset();view.reset();hud.reset();modalPaused=false;lostFocus=false;sfx.setPaused(document.hidden);bridge.start();lastTime=performance.now();};
  const hud=new Hud(shell,{restart,pause:()=>{modalPaused=true;pause();},resume,upgrade:()=>{if(game.buyWorkerUpgrade()){sfx.play('purchase');hud.upgradeFeedback();}},audioSettings});
  const input=new PointerController(view.canvas,game,view,text=>{if(text.startsWith('Drag '))hud.guidance(text,text);else hud.message(text);},event=>sfx.play(event));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();else if(!modalPaused)resume();});
  window.addEventListener('blur',()=>{lostFocus=true;pause();});
  window.addEventListener('focus',()=>{if(lostFocus&&!modalPaused)resume();});
  window.addEventListener('resize',()=>{input.cancel();view.resize();if(!active){view.sync(game.state,0,null,[]);hud.render(game.state);}});
  let lastTime=performance.now(),frames=0,fps=0,fpsAt=lastTime;let diagnostics:HTMLElement|null=null;
  if(import.meta.env.DEV&&new URLSearchParams(location.search).has('debug')){diagnostics=document.createElement('div');diagnostics.className='diagnostics';shell.append(diagnostics);}
  view.sync(game.state,0,null,[]);hud.render(game.state);
  const frame=(now:number)=>{const dt=Math.min(.1,Math.max(0,(now-lastTime)/1000));lastTime=now;game.tick(dt);input.refreshDrop();const events=game.drainEvents();
    view.sync(game.state,game.state.paused||game.state.gameOver?0:dt,input.dragPosition,events);hud.render(game.state);hud.feedback(events);const sound=soundForEvents(events);if(sound)sfx.play(sound,sound==='hit'?.45:1);
    if(events.some(e=>e.type==='goal'))hud.goal();
    const brake=events.find(e=>e.type==='brake');if(brake)hud.guidance(brake.amount?'Speed reduced · acceleration continues':'Minimum speed reached','brake');
    if(events.some(e=>e.type==='halfSpeed'))hud.guidance('Speed halved · acceleration continues','halfSpeed');
    const tailBlast=events.find(e=>e.type==='tailBlast');if(tailBlast)hud.guidance(tailBlast.amount?(game.state.tailWaitingIds.length>0?'Tail half blasted · front waits for new rocks':'Tail half blasted · new rocks are coming'):'No rocks to blast','tailBlast');
    if(events.some(e=>e.type==='discard'))hud.guidance('Worker discarded · no coins','discard');
    const rewind=events.find(e=>e.type==='rewind');if(rewind)hud.guidance(rewind.amount?(game.state.slowRemaining>0?'Rewind queued until pause ends':'Rewound to the first bend'):'Already before the rewind point','rewind');
    if(events.some(e=>e.type==='gameover')){input.cancel();hud.defeat();modalPaused=true;bridge.end();}
    frames++;if(now-fpsAt>=1000){fps=frames*1000/(now-fpsAt);frames=0;fpsAt=now;}
    if(diagnostics){const m=view.metrics();diagnostics.textContent=`${fps.toFixed(1)} fps · ${m.calls} calls · ${m.triangles} tris\n${game.state.stones.length} rocks · ${m.effects} effects`;}
    requestAnimationFrame(frame);
  };
  if(import.meta.env.DEV){
    const api={snapshot:()=>structuredClone(game.state),metrics:()=>({...view.metrics(),fps}),screenFor:(id:string)=>{const entity=game.state.entities[id];const ref=entity?.location;const place=ref&&ref.kind!=='drag'?(ref.kind==='pad'?game.state.pads:ref.kind==='storage'?game.state.storage:game.state.slots).find(p=>p.id===ref.id):[...game.state.pads,...game.state.storage,...game.state.slots].find(p=>p.id===id);if(!place)return null;const p=view.project(place,entity?(entity.kind==='worker'?.4:ref?.kind==='storage'?.39:.27):.1,ref?.kind==='slot'||id.startsWith('slot-')),r=view.canvas.getBoundingClientRect();return{x:p.x+r.left,y:p.y+r.top};},point:(x:number,z:number)=>{const p=view.project({x,z}),r=view.canvas.getBoundingClientRect();return{x:p.x+r.left,y:p.y+r.top};}};
    Object.defineProperty(window,'__rocksnake',{value:Object.freeze(api),writable:false});
  }
  return ()=>{active=true;shell.inert=false;game.setPaused(document.hidden);sfx.setPaused(document.hidden);lastTime=performance.now();fpsAt=lastTime;bridge.ready();requestAnimationFrame(frame);};
}
async function start(){
  const stage=document.createElement('div');stage.className='game-stage';stage.inert=true;shell.append(stage);
  try{await showVideoIntro(shell,prepareGame(stage),{music,sounds:()=>audioSettings.value.sounds,unlockSounds:sfx.unlock});}
  catch(error){shell.innerHTML='';const message=document.createElement('div');message.className='fatal';message.setAttribute('role','alert');message.textContent=error instanceof Error?error.message:'This browser could not initialize the playable.';shell.append(message);}
}
void start();
