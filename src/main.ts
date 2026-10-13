import './style.css';
import { Game } from './game/Simulation';
import { SceneView } from './render/SceneFactory';
import { PointerController } from './input/PointerController';
import { Hud } from './ui/Hud';
import { PlayableBridge } from './platform/PlayableBridge';

const app=document.querySelector<HTMLElement>('#app')!;
const shell=document.createElement('div');shell.className='game-shell';app.append(shell);
try {
  const game=new Game();const view=new SceneView(shell);const bridge=new PlayableBridge();let modalPaused=false;let lostFocus=false;
  const pause=()=>{input.cancel();game.setPaused(true);bridge.pause();};
  const resume=()=>{modalPaused=false;lostFocus=false;game.setPaused(document.hidden);if(!document.hidden)bridge.resume();lastTime=performance.now();};
  const restart=()=>{input.cancel();game.reset();view.reset();hud.reset();modalPaused=false;lostFocus=false;bridge.start();lastTime=performance.now();};
  const hud=new Hud(shell,{restart,pause:()=>{modalPaused=true;pause();},resume,cta:()=>bridge.cta(text=>hud.message(text))});
  const input=new PointerController(view.canvas,game,view,text=>hud.message(text));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();else if(!modalPaused)resume();});
  window.addEventListener('blur',()=>{lostFocus=true;pause();});
  window.addEventListener('focus',()=>{if(lostFocus&&!modalPaused)resume();});
  window.addEventListener('resize',()=>{input.cancel();view.resize();});
  let lastTime=performance.now(),frames=0,fps=0,fpsAt=lastTime;let diagnostics:HTMLElement|null=null;
  if(import.meta.env.DEV&&new URLSearchParams(location.search).has('debug')){diagnostics=document.createElement('div');diagnostics.className='diagnostics';shell.append(diagnostics);}
  bridge.ready();
  const frame=(now:number)=>{const dt=Math.min(.1,Math.max(0,(now-lastTime)/1000));lastTime=now;game.tick(dt);const events=game.drainEvents();
    view.sync(game.state,game.state.paused?0:dt,input.dragPosition,events);hud.render(game.state);
    if(events.some(e=>e.type==='goal')){hud.goal();modalPaused=true;pause();bridge.end();}
    frames++;if(now-fpsAt>=1000){fps=frames*1000/(now-fpsAt);frames=0;fpsAt=now;}
    if(diagnostics){const m=view.metrics();diagnostics.textContent=`${fps.toFixed(1)} fps · ${m.calls} calls · ${m.triangles} tris\n${game.state.stones.length} rocks · ${m.effects} effects`;}
    requestAnimationFrame(frame);
  };requestAnimationFrame(frame);
  if(import.meta.env.DEV){
    const api={snapshot:()=>structuredClone(game.state),metrics:()=>({...view.metrics(),fps}),screenFor:(id:string)=>{const entity=game.state.entities[id];const ref=entity?.location;const place=ref&&ref.kind!=='drag'?(ref.kind==='pad'?game.state.pads:game.state.slots).find(p=>p.id===ref.id):[...game.state.pads,...game.state.slots].find(p=>p.id===id);if(!place)return null;const p=view.project(place,entity?.kind==='worker'?.4:entity?.kind==='barrel'?.27:.1),r=view.canvas.getBoundingClientRect();return{x:p.x+r.left,y:p.y+r.top};},point:(x:number,z:number)=>{const p=view.project({x,z}),r=view.canvas.getBoundingClientRect();return{x:p.x+r.left,y:p.y+r.top};}};
    Object.defineProperty(window,'__rocksnake',{value:Object.freeze(api),writable:false});
  }
} catch(error){shell.innerHTML='';const message=document.createElement('div');message.className='fatal';message.setAttribute('role','alert');message.textContent=error instanceof Error?error.message:'This browser could not initialize the playable.';shell.append(message);}
