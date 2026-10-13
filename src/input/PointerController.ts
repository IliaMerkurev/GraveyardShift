import type { Game } from '../game/Simulation';
import type { SceneView, HitTarget } from '../render/SceneFactory';
import { viewConfig, type Point } from '../render/Layout';
import { CONFIG } from '../game/config';

export class PointerController {
  activePointerId:number|null=null;
  dragPosition:Point|null=null;
  private start:{x:number;y:number;target:HitTarget|null}|null=null;
  private moved=false;
  private touch=false;
  constructor(private canvas:HTMLCanvasElement,private game:Game,private view:SceneView,private feedback:(text:string)=>void){
    canvas.addEventListener('pointerdown',this.down);
    canvas.addEventListener('pointermove',this.move);
    canvas.addEventListener('pointerup',this.up);
    canvas.addEventListener('pointercancel',this.pointerCancel);
    canvas.addEventListener('lostpointercapture',this.pointerCancel);
    canvas.addEventListener('contextmenu',event=>event.preventDefault());
    canvas.addEventListener('dragstart',event=>event.preventDefault());
  }
  private down=(event:PointerEvent)=>{
    if(this.activePointerId!==null||this.game.state.paused||event.button!==0)return;
    event.preventDefault();this.activePointerId=event.pointerId;this.touch=event.pointerType==='touch';this.moved=false;
    this.start={x:event.clientX,y:event.clientY,target:this.view.hit(event.clientX,event.clientY)};
    this.canvas.setPointerCapture(event.pointerId);
  };
  private move=(event:PointerEvent)=>{
    if(event.pointerId!==this.activePointerId||!this.start)return;event.preventDefault();
    if(!this.moved&&Math.hypot(event.clientX-this.start.x,event.clientY-this.start.y)>=viewConfig.dragThresholdPx){
      this.moved=true;const target=this.start.target;if(target?.kind==='entity')this.game.beginDrag(target.id);
    }
    if(this.game.state.drag){this.dragPosition=this.view.world(event.clientX,event.clientY-(this.touch?viewConfig.touchLiftPx:0));const target=this.view.dropTarget(event.clientX,event.clientY);this.view.showDrop(target,this.game.canDrop(target),CONFIG.bomb.radius);}
  };
  private up=(event:PointerEvent)=>{
    if(event.pointerId!==this.activePointerId||!this.start)return;event.preventDefault();
    if(this.game.state.drag){const target=this.view.dropTarget(event.clientX,event.clientY);if(!this.game.drop(target))this.feedback('Not a match. Returned safely.');}
    else if(!this.moved){const target=this.start.target;
      if(target?.kind==='entity'){const entity=this.game.state.entities[target.id];if(entity?.kind==='barrel'&&entity.location.kind==='slot')this.game.openBarrel(entity.location.id);else if(entity?.kind==='worker')this.feedback('Drag this worker onto a pad or matching level.');else if(entity?.kind==='bomb')this.feedback('Drag the bomb onto the rock stream.');}
      else if(target?.kind==='pad'){const pad=this.game.state.pads.find(p=>p.id===target.id);if(pad&&!pad.unlocked&&!this.game.buyPad(pad.id))this.feedback(`Need ${Math.max(0,pad.price-this.game.state.coins)} more coins.`);}
    }
    this.finish();
  };
  private pointerCancel=(event:PointerEvent)=>{if(event.pointerId===this.activePointerId)this.cancel();};
  private finish(){const id=this.activePointerId;this.activePointerId=null;this.start=null;this.moved=false;this.dragPosition=null;this.view.showDrop(null,false,CONFIG.bomb.radius);if(id!==null&&this.canvas.hasPointerCapture(id))this.canvas.releasePointerCapture(id);}
  cancel(){this.game.cancelDrag();this.finish();}
}
