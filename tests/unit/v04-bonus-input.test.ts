import { describe, expect, it, vi } from 'vitest';
import { Game } from '../../src/game/Simulation';
import { PointerController } from '../../src/input/PointerController';
import type { SceneView } from '../../src/render/SceneFactory';
class Canvas extends EventTarget {
 captured=false;
 setPointerCapture(){this.captured=true;}
 hasPointerCapture(){return this.captured;}
 releasePointerCapture(){this.captured=false;}
}
describe('v0.4 new bonus pointer gestures',()=>{
 for(const kind of ['halfSpeed','tailBlast'] as const) for(const pointerType of ['mouse','touch']){
  it(`${kind} ${pointerType}: cancel restores; tap and final-release drag each activate once`,()=>{
   for(const drag of [false,true]){
    const game=new Game(),canvas=new Canvas(),slot=game.state.slots[0]!,id=slot.entityId!,barrel=game.state.entities[id]!;
    if(barrel.kind!=='barrel')throw Error('fixture');barrel.content=kind;game.openBarrel(slot.id);
    const view={hit:()=>({kind:'entity',id}),world:()=>({x:0,z:-7}),dropTarget:()=>({kind:'field',x:0,z:-7}),showDrop:vi.fn(),clearMergeTargets:vi.fn()} as unknown as SceneView;
    new PointerController(canvas as unknown as HTMLCanvasElement,game,view,vi.fn());
    const send=(type:string,x=100)=>{const e=new Event(type,{cancelable:true});Object.assign(e,{pointerId:1,pointerType,button:0,clientX:x,clientY:100});canvas.dispatchEvent(e);};
    send('pointerdown');send('pointercancel');expect(slot.entityId).toBe(id);expect(canvas.captured).toBe(false);
    send('pointerdown');expect(game.state.drag?.entityId).toBe(id);send('pointerup',drag?140:100);send('pointerup',drag?140:100);
    expect(game.state.entities[id]).toBeUndefined();expect(game.state.events.filter(e=>e.type===kind)).toHaveLength(1);expect(canvas.captured).toBe(false);expect(game.state.drag).toBeNull();
   }
  });
 }
});
