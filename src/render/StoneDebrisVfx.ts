import * as THREE from 'three';
import { dungeonMaterial, DUNGEON_PALETTE } from './dungeon/DungeonKit';
import { atlasUV } from './dungeon/DungeonAtlas';
import type { GameEvent } from '../game/GameState';

export const STONE_DEBRIS_LIMITS={chunks:240,sites:20} as const;
/** Spread a multi-destroy's budget across the whole broken run, not just its head. */
export function selectDebrisEvents(events:GameEvent[],visible:ReadonlyMap<string,unknown>):GameEvent[]{
  // Offscreen queued tail stones have clamped event coordinates at the entrance.
  // They must neither create entrance rubble nor consume visible victims' budget.
  const victims=events.filter(e=>e.type==='destroy'&&!!e.stoneId&&visible.has(e.stoneId));
  if(victims.length<=STONE_DEBRIS_LIMITS.sites)return victims;
  return Array.from({length:STONE_DEBRIS_LIMITS.sites},(_,i)=>victims[Math.round(i*(victims.length-1)/(STONE_DEBRIS_LIMITS.sites-1))]);
}
type Chunk={active:boolean;age:number;life:number;x:number;y:number;z:number;vx:number;vy:number;vz:number;rx:number;ry:number;rz:number;sx:number;sy:number;sz:number;spinX:number;spinY:number;spinZ:number;color:number;bounces:number};
const blank=():Chunk=>({active:false,age:0,life:0,x:0,y:0,z:0,vx:0,vy:0,vz:0,rx:0,ry:0,rz:0,sx:0,sy:0,sz:0,spinX:0,spinY:0,spinZ:0,color:0xffffff,bounces:0});
function shardGeometry(){
  // Twenty broad cut faces, textured and shaded like the parent ore, not emissive sprites.
  const g=new THREE.IcosahedronGeometry(.225,0),p=g.getAttribute('position');
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),warp=1+.17*Math.sin(x*23+y*17+z*31);p.setXYZ(i,x*warp,y*warp*.85,z*warp);}
  g.computeVertexNormals();const colors=new Float32Array(p.count*3),color=new THREE.Color();
  for(let i=0;i<p.count;i+=3){color.setHex(DUNGEON_PALETTE.stoneLight).multiplyScalar(.78+((i*17)%11)/25);for(let j=0;j<3;j++)color.toArray(colors,(i+j)*3);}
  g.setAttribute('color',new THREE.BufferAttribute(colors,3));atlasUV(g,3);return g;
}
/** Cosmetic only: one fixed pool / draw call, with no scene or gameplay collision objects. */
export class StoneDebrisVfx{
  private chunks=Array.from({length:STONE_DEBRIS_LIMITS.chunks},blank);private cursor=0;private disposed=false;
  private mesh:THREE.InstancedMesh;private dummy=new THREE.Object3D();private color=new THREE.Color();private white=new THREE.Color(0xffffff);
  constructor(scene:THREE.Scene){
    this.mesh=new THREE.InstancedMesh(shardGeometry(),dungeonMaterial.clone(),STONE_DEBRIS_LIMITS.chunks);
    this.mesh.name='stone-destruction-debris';this.mesh.count=0;this.mesh.frustumCulled=false;this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Receive existing light/shadows without adding another shadow-map draw pass.
    this.mesh.receiveShadow=true;scene.add(this.mesh);
  }
  crumble(x:number,z:number,resourceColor:number,blast=false,budget=16){
    if(this.disposed)return;
    const count=Math.max(0,Math.min(blast?12:16,Math.floor(budget))),phase=Math.random()*Math.PI*2;
    for(let i=0;i<count;i++){
      const p=this.chunks[this.cursor++%this.chunks.length],angle=phase+i*2.399963,size=i<4?.40+Math.random()*.12:i<9?.24+Math.random()*.1:.12+Math.random()*.1;
      const speed=(.45+Math.random()*.7)*(blast?1.45:1),offset=.035+Math.random()*.12;
      Object.assign(p,{active:true,age:0,life:1.05+Math.random()*.4,x:x+Math.cos(angle)*offset,y:.19+Math.random()*.19,z:z+Math.sin(angle)*offset,
        vx:Math.cos(angle)*speed,vy:.95+Math.random()*1.35,vz:Math.sin(angle)*speed,
        rx:Math.random()*6,ry:angle,rz:Math.random()*6,sx:size*(.7+Math.random()*.4),sy:size*(.65+Math.random()*.55),sz:size*(.75+Math.random()*.6),
        spinX:(Math.random()-.5)*13,spinY:(Math.random()-.5)*15,spinZ:(Math.random()-.5)*13,color:resourceColor,bounces:0});
    }
  }
  update(dt:number,reducedMotion:boolean,paused:boolean){
    if(this.disposed)return;if(reducedMotion){this.reset();return;}
    const step=paused?0:Math.min(.1,Math.max(0,dt));let count=0;
    for(const p of this.chunks){
      if(!p.active)continue;p.age+=step;if(p.age>=p.life){p.active=false;continue;}
      // Small bounded substeps keep landing stable across frame rates and resumed tabs.
      const steps=Math.max(1,Math.ceil(step/.016)),h=step/steps;
      for(let i=0;i<steps;i++){
        p.vy-=6.8*h;p.x+=p.vx*h;p.y+=p.vy*h;p.z+=p.vz*h;
        const floor=.035+Math.max(p.sx,p.sy,p.sz)*.16;
        if(p.y<floor){p.y=floor;if(p.vy<-.35&&p.bounces<2){p.vy=-p.vy*.31;p.bounces++;}else p.vy=0;
          const friction=Math.exp(-12*h);p.vx*=friction;p.vz*=friction;p.spinX*=friction;p.spinY*=friction;p.spinZ*=friction;
        }
        p.rx+=p.spinX*h;p.ry+=p.spinY*h;p.rz+=p.spinZ*h;
      }
      // Keep a solid silhouette during flight, then ease down into tiny rubble and disappear.
      const t=THREE.MathUtils.clamp((p.age/p.life-.58)/.42,0,1),shrink=1-t*t*(3-2*t);
      this.dummy.position.set(p.x,p.y,p.z);this.dummy.rotation.set(p.rx,p.ry,p.rz);this.dummy.scale.set(p.sx*shrink,p.sy*shrink,p.sz*shrink);this.dummy.updateMatrix();
      this.mesh.setMatrixAt(count,this.dummy.matrix);this.mesh.setColorAt(count++,this.color.setHex(p.color).lerp(this.white,.8));
    }
    this.mesh.count=count;this.mesh.instanceMatrix.needsUpdate=true;if(this.mesh.instanceColor)this.mesh.instanceColor.needsUpdate=true;
  }
  reset(){for(const p of this.chunks)p.active=false;this.cursor=0;this.mesh.count=0;}
  metrics(){return{stoneDebris:this.mesh.count};}
  dispose(){if(this.disposed)return;this.reset();this.mesh.removeFromParent();this.mesh.geometry.dispose();(this.mesh.material as THREE.Material).dispose();this.disposed=true;}
}
