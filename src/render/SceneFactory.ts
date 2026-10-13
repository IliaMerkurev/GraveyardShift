import * as THREE from 'three';
import type { GameState, DropTarget, GameEvent } from '../game/GameState';
import { CONFIG } from '../game/config';
import { samplePath, PATH_LENGTH } from '../game/path';
import { createWorker, createBarrel, createBomb, disposePrimitive, makeWallGeometry, makeBrickTexture, type WorkerVisual } from './PrimitiveFactory';
import { viewConfig, type Point, type ScreenPoint } from './Layout';

export type HitTarget = {kind:'entity'|'pad'|'slot';id:string};
type EntityView = {kind:string;group:THREE.Group; worker?:WorkerVisual;label:HTMLDivElement;hit:HTMLDivElement};
type Effect = {active:boolean;age:number;life:number;x:number;y:number;z:number;vx:number;vy:number;vz:number;color:number;size:number};
const resourceColors=CONFIG.stones.resources.map(r=>r.color);
export class SceneView {
  readonly renderer:THREE.WebGLRenderer; readonly scene=new THREE.Scene();
  readonly camera=new THREE.PerspectiveCamera(viewConfig.camera.fov,1,.1,100);
  readonly canvas:HTMLCanvasElement;
  private labels:HTMLDivElement; private entities=new Map<string,EntityView>(); private pads=new Map<string,{mesh:THREE.Mesh;label:HTMLDivElement}>();
  private stones:THREE.InstancedMesh[]=[]; private particles:THREE.InstancedMesh;private effects:Effect[]=[];private effectCursor=0;
  private dummy=new THREE.Object3D();private color=new THREE.Color();private raycaster=new THREE.Raycaster();private plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  private ring:THREE.Mesh; private targetRing:THREE.Mesh;private treads:THREE.InstancedMesh;private state:GameState|null=null;private lastWidth=0;private lastHeight=0;
  private trackPoints:Point[]=[];
  constructor(readonly shell:HTMLElement){
    this.canvas=document.createElement('canvas');this.canvas.setAttribute('aria-label','Mining game. Tap barrels and drag workers onto pads.');this.canvas.dataset.testid='game-canvas';
    const context=this.canvas.getContext('webgl2',{antialias:true,alpha:false});
    if(!context) throw new Error('WebGL 2 is unavailable. Please open this prototype in a recent browser with graphics acceleration enabled.');
    this.renderer=new THREE.WebGLRenderer({canvas:this.canvas,context,antialias:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,viewConfig.dprLimit));
    this.renderer.setClearColor(0x61556f);this.renderer.outputColorSpace=THREE.SRGBColorSpace;shell.append(this.canvas);
    this.labels=document.createElement('div');this.labels.className='labels';shell.append(this.labels);
    this.scene.add(new THREE.HemisphereLight(0xe9e9ff,0x514059,2.5));const key=new THREE.DirectionalLight(0xffedd5,3);key.position.set(-4,12,8);this.scene.add(key);
    const floor=new THREE.Mesh(new THREE.BoxGeometry(viewConfig.floor.width,.3,viewConfig.floor.depth),new THREE.MeshLambertMaterial({color:0x86728f}));floor.position.y=-.25;this.scene.add(floor);
    const walls=new THREE.Mesh(makeWallGeometry(),new THREE.MeshLambertMaterial({map:makeBrickTexture()}));this.scene.add(walls);
    // A subtle route ribbon is a flat strip, never a deforming resource mesh.
    const positions:number[]=[];for(let d=0;d<=PATH_LENGTH;d+=.12)this.trackPoints.push(samplePath(d));
    this.trackPoints.push(samplePath(PATH_LENGTH));
    for(let i=0;i<this.trackPoints.length-1;i++){const a=this.trackPoints[i],b=this.trackPoints[i+1];const dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz);const nx=-dz/l*.34,nz=dx/l*.34;positions.push(a.x+nx,.011,a.z+nz,a.x-nx,.011,a.z-nz,b.x+nx,.011,b.z+nz,b.x+nx,.011,b.z+nz,a.x-nx,.011,a.z-nz,b.x-nx,.011,b.z-nz);}
    const routeGeo=new THREE.BufferGeometry();routeGeo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));routeGeo.computeVertexNormals();
    this.scene.add(new THREE.Mesh(routeGeo,new THREE.MeshBasicMaterial({color:0x574a69,side:THREE.DoubleSide})));
    const belt=new THREE.Mesh(new THREE.BoxGeometry(8.35,.16,1.1),new THREE.MeshLambertMaterial({color:0x324350}));belt.position.set(0,.03,5.1);this.scene.add(belt);
    for(const z of [4.5,5.7]){const rail=new THREE.Mesh(new THREE.BoxGeometry(8.7,.17,.16),new THREE.MeshLambertMaterial({color:0x679dc6}));rail.position.set(0,.10,z);this.scene.add(rail);}
    this.treads=new THREE.InstancedMesh(new THREE.BoxGeometry(.045,.024,.98),new THREE.MeshLambertMaterial({color:0x65818a}),28);this.scene.add(this.treads);
    for(let v=0;v<3;v++){const geometry=v===1?new THREE.DodecahedronGeometry(.25,0):new THREE.IcosahedronGeometry(v===2?.26:.25,v===2?1:0);const mesh=new THREE.InstancedMesh(geometry,new THREE.MeshLambertMaterial({color:0xffffff,flatShading:true}),200);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;this.stones.push(mesh);this.scene.add(mesh);}
    this.particles=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshBasicMaterial({color:0xffffff}),viewConfig.maxEffects);this.particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.particles.frustumCulled=false;this.scene.add(this.particles);
    for(let i=0;i<viewConfig.maxEffects;i++)this.effects.push({active:false,age:0,life:0,x:0,y:0,z:0,vx:0,vy:0,vz:0,color:0,size:0});
    this.ring=new THREE.Mesh(new THREE.RingGeometry(.98,1,64),new THREE.MeshBasicMaterial({color:0x8effc5,transparent:true,opacity:.8,side:THREE.DoubleSide,depthTest:false}));this.ring.rotation.x=-Math.PI/2;this.ring.visible=false;this.ring.renderOrder=20;this.scene.add(this.ring);
    this.targetRing=new THREE.Mesh(new THREE.RingGeometry(.56,.62,32),new THREE.MeshBasicMaterial({color:0x8effc5,transparent:true,opacity:.95,side:THREE.DoubleSide,depthTest:false}));this.targetRing.rotation.x=-Math.PI/2;this.targetRing.visible=false;this.targetRing.renderOrder=20;this.scene.add(this.targetRing);
    this.resize();
  }
  resize(){const rect=this.canvas.getBoundingClientRect();const w=rect.width,h=rect.height;if(w===this.lastWidth&&h===this.lastHeight)return;this.lastWidth=w;this.lastHeight=h;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;
    const direction=new THREE.Vector3(...viewConfig.camera.direction).normalize();const vertical=CONFIG.camera.frameDepth;const horizontal=CONFIG.camera.frameWidth;const fov=THREE.MathUtils.degToRad(viewConfig.camera.fov);const distance=Math.max(vertical/2/Math.tan(fov/2),horizontal/2/Math.tan(fov/2)/this.camera.aspect)*viewConfig.camera.margin;
    this.camera.position.copy(direction.multiplyScalar(distance));this.camera.lookAt(0,0,.15);this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();
  }
  project(point:Point,y=0):ScreenPoint{const v=new THREE.Vector3(point.x,y,point.z).project(this.camera);return{x:(v.x+1)*this.lastWidth/2,y:(1-v.y)*this.lastHeight/2};}
  world(clientX:number,clientY:number):Point|null{const rect=this.canvas.getBoundingClientRect();this.raycaster.setFromCamera(new THREE.Vector2((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1),this.camera);const v=new THREE.Vector3();return this.raycaster.ray.intersectPlane(this.plane,v)?{x:v.x,z:v.z}:null;}
  private location(entityId:string):Point|null{const e=this.state?.entities[entityId];if(!e||!this.state||e.location.kind==='drag')return null;const ref=e.location;return(ref.kind==='pad'?this.state.pads:this.state.slots).find(p=>p.id===ref.id)??null;}
  hit(clientX:number,clientY:number):HitTarget|null{
    if(!this.state)return null;const rect=this.canvas.getBoundingClientRect(),x=clientX-rect.left,y=clientY-rect.top;
    const candidates:{target:HitTarget,d:number}[]=[];
    for(const e of Object.values(this.state.entities)){const loc=this.location(e.id);if(!loc)continue;const p=this.project(loc,e.kind==='worker'?.40:.27);const d=Math.hypot(x-p.x,y-p.y);if(d<=viewConfig.hitRadiusPx)candidates.push({target:{kind:'entity',id:e.id},d});}
    if(candidates.length)return candidates.sort((a,b)=>a.d-b.d)[0].target;
    for(const p of this.state.pads){const s=this.project(p,.1);if(Math.hypot(x-s.x,y-s.y)<=viewConfig.hitRadiusPx)return{kind:'pad',id:p.id};}
    for(const p of this.state.slots){const s=this.project(p,.1);if(Math.hypot(x-s.x,y-s.y)<=viewConfig.hitRadiusPx)return{kind:'slot',id:p.id};}
    return null;
  }
  dropTarget(clientX:number,clientY:number):DropTarget{
    if(!this.state?.drag)return null;const entity=this.state.entities[this.state.drag.entityId];
    if(entity?.kind==='bomb'){const p=this.world(clientX,clientY);return p?{kind:'track',...p}:null;}
    const rect=this.canvas.getBoundingClientRect();const x=clientX-rect.left,y=clientY-rect.top;const candidates:{target:DropTarget,d:number}[]=[];
    for(const kind of ['pad','slot'] as const)for(const p of kind==='pad'?this.state.pads:this.state.slots){const s=this.project(p,p.entityId && this.state.entities[p.entityId]?.kind==='worker' ? .4 : .10);const d=Math.hypot(x-s.x,y-s.y);if(d<=viewConfig.hitRadiusPx+5)candidates.push({target:{kind,id:p.id},d});}
    return candidates.sort((a,b)=>a.d-b.d)[0]?.target??null;
  }
  showDrop(target:DropTarget,valid:boolean,bombRadius:number){this.ring.visible=false;this.targetRing.visible=false;if(!target)return;
    const color=valid?0x8effb7:0xff8580;if(target.kind==='track'){this.ring.position.set(target.x,.08,target.z);this.ring.scale.setScalar(bombRadius);(this.ring.material as THREE.MeshBasicMaterial).color.setHex(color);this.ring.visible=true;}
    else {const p=(target.kind==='pad'?this.state?.pads:this.state?.slots)?.find(p=>p.id===target.id);if(p){this.targetRing.position.set(p.x,.1,p.z);(this.targetRing.material as THREE.MeshBasicMaterial).color.setHex(color);this.targetRing.visible=true;}}
  }
  burst(x:number,z:number,color:number,count=10,large=false){for(let i=0;i<count;i++){const e=this.effects[this.effectCursor++%this.effects.length];Object.assign(e,{active:true,age:0,life:large?.65:.42,x,y:.3,z,vx:(Math.random()-.5)*(large?6:2),vy:2+Math.random()*2,vz:(Math.random()-.5)*(large?6:2),color,size:large?.12:.075});}}
  reset(){for(const e of this.effects)e.active=false;this.ring.visible=false;this.targetRing.visible=false;}
  sync(state:GameState,dt:number,dragPosition:Point|null,events:GameEvent[]){this.state=state;
    const counts=[0,0,0];for(const stone of state.stones){const mesh=this.stones[stone.variant%3],i=counts[stone.variant%3]++;const p=samplePath(stone.distance);this.dummy.position.set(p.x,.27,p.z);this.dummy.rotation.set(.15*Math.sin(stone.distance),p.angle+stone.variant,.2);this.dummy.scale.setScalar(1);this.dummy.updateMatrix();mesh.setMatrixAt(i,this.dummy.matrix);this.color.setHex(resourceColors[stone.resource]);if(stone.hp<stone.maxHp)this.color.lerp(new THREE.Color(0xffffff),.18);mesh.setColorAt(i,this.color);}
    for(let i=0;i<3;i++){this.stones[i].count=counts[i];this.stones[i].instanceMatrix.needsUpdate=true;if(this.stones[i].instanceColor)this.stones[i].instanceColor!.needsUpdate=true;}
    for(let i=0;i<28;i++){this.dummy.position.set(-4.1+((i*.3-(state.time*.5)%8.4+8.4)%8.4),.132,5.1);this.dummy.rotation.set(0,0,0);this.dummy.scale.setScalar(1);this.dummy.updateMatrix();this.treads.setMatrixAt(i,this.dummy.matrix);}this.treads.instanceMatrix.needsUpdate=true;
    for(const [id,view]of this.entities)if(!state.entities[id]||state.entities[id].kind!==view.kind){if(view.worker)view.worker.dispose();else disposePrimitive(view.group);view.label.remove();view.hit.remove();this.entities.delete(id);}
    for(const entity of Object.values(state.entities)){
      let v=this.entities.get(entity.id);if(!v){const worker=entity.kind==='worker'?createWorker():undefined;const group=worker?.group??(entity.kind==='barrel'?createBarrel():createBomb());const label=document.createElement('div');label.className=entity.kind==='worker'?'entity-label':'barrel-label';const hit=document.createElement('div');hit.className='entity-target';hit.dataset.entity=entity.id;hit.dataset.kind=entity.kind;this.labels.append(label,hit);this.scene.add(group);v={kind:entity.kind,group,worker,label,hit};this.entities.set(entity.id,v);}
      const loc=entity.location.kind==='drag'?dragPosition:this.location(entity.id);if(!loc){v.group.visible=false;v.label.hidden=true;v.hit.hidden=true;continue;}v.group.visible=true;v.label.hidden=false;v.hit.hidden=false;v.group.position.set(loc.x,entity.location.kind==='slot'?.14:entity.location.kind==='drag'?.45:.1,loc.z);
      if(entity.kind==='worker'){v.worker!.setLevel(entity.level);v.worker!.setAction(entity.location.kind==='pad'?entity.mining.phase:0);v.label.textContent=String(entity.level);v.hit.dataset.level=String(entity.level);v.group.rotation.y=entity.location.kind==='pad'?Math.PI*.8:0;}
      else if(entity.kind==='barrel'){v.label.textContent=entity.content==='worker'?'✦':'?';}else v.label.textContent='';
      const h=this.project(loc,entity.kind==='worker'?.4:.27);v.hit.style.left=`${h.x}px`;v.hit.style.top=`${h.y}px`;const p=this.project(loc,entity.kind==='worker'?1.27:entity.kind==='barrel'?.80:.9);v.label.style.left=`${p.x}px`;v.label.style.top=`${p.y}px`;
    }
    for(const pad of state.pads){let v=this.pads.get(pad.id);if(!v){const mesh=new THREE.Mesh(new THREE.BoxGeometry(.95,.13,.88),new THREE.MeshLambertMaterial({color:0x41394f}));mesh.position.set(pad.x,.025,pad.z);this.scene.add(mesh);const label=document.createElement('div');label.dataset.pad=pad.id;this.labels.append(label);v={mesh,label};this.pads.set(pad.id,v);}const m=v.mesh.material as THREE.MeshLambertMaterial;m.color.setHex(pad.unlocked?0x426e69:0x54415f);v.label.dataset.unlocked=String(pad.unlocked);v.label.className=`pad-label ${pad.unlocked?'open':state.coins>=pad.price?'affordable':''}`;v.label.textContent=pad.unlocked?(pad.entityId?'':'＋ WORK'): `${pad.price} ●`;v.label.hidden=pad.unlocked&&!!pad.entityId;const p=this.project(pad,.19);v.label.style.left=`${p.x}px`;v.label.style.top=`${p.y}px`;}
    for(const e of events){if(e.type==='destroy'||e.type==='coins')this.burst(e.x,e.z,0xffd26a,8);else if(e.type==='hit')this.burst(e.x,e.z,0xb9e9df,3);else if(e.type==='merge'||e.type==='purchase')this.burst(e.x,e.z,0x76ffc9,18,true);else if(e.type==='bomb')this.burst(e.x,e.z,0xffc05d,45,true);else if(e.type==='open')this.burst(e.x,e.z,0xdedbb5,5);}
    let count=0;for(const e of this.effects){if(!e.active)continue;e.age+=dt;if(e.age>=e.life){e.active=false;continue;}e.x+=e.vx*dt;e.y+=e.vy*dt;e.z+=e.vz*dt;e.vy-=8*dt;this.dummy.position.set(e.x,e.y,e.z);this.dummy.scale.setScalar(e.size*(1-e.age/e.life));this.dummy.rotation.set(e.age*5,0,e.age*3);this.dummy.updateMatrix();this.particles.setMatrixAt(count,this.dummy.matrix);this.particles.setColorAt(count++,this.color.setHex(e.color));}this.particles.count=count;this.particles.instanceMatrix.needsUpdate=true;if(this.particles.instanceColor)this.particles.instanceColor.needsUpdate=true;
    this.renderer.render(this.scene,this.camera);
  }
  metrics(){return{calls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures,effects:this.particles.count};}
}
