import * as THREE from 'three';
import type { GameState, DropTarget, GameEvent } from '../game/GameState';
import { CONFIG } from '../game/config';
import { effectiveForwardSpeed, recoilDistances } from '../game/motion';
import { samplePath, PATH_LENGTH } from '../game/path';
import { createWorker, createBarrel, createBomb, createRewind, createSlow, createBrake, disposePrimitive, makeWallGeometry, makeBrickTexture, type WorkerVisual } from './PrimitiveFactory';
import { viewConfig, mapPosition, unmapFieldPosition, placeZone, LANDSCAPE_LAYOUT, type ViewZone, type Point, type ScreenPoint } from './Layout';

export type HitTarget = {kind:'entity'|'pad'|'slot'|'storage';id:string};
type EntityView = {kind:string;group:THREE.Group; worker?:WorkerVisual;label:HTMLDivElement;hit:HTMLDivElement};
type Effect = {active:boolean;age:number;life:number;x:number;y:number;z:number;vx:number;vy:number;vz:number;color:number;size:number;coin:boolean};
const resourceColors=CONFIG.stones.resources.map(r=>r.color);
export class SceneView {
  readonly renderer:THREE.WebGLRenderer; readonly scene=new THREE.Scene();
  readonly camera=new THREE.PerspectiveCamera(viewConfig.camera.fov,1,.1,100);
  readonly canvas:HTMLCanvasElement;
  private discardLabel:HTMLDivElement;private finishLabel:HTMLDivElement;private headLabel:HTMLDivElement;
  private labels:HTMLDivElement; private entities=new Map<string,EntityView>(); private pads=new Map<string,{mesh:THREE.Mesh;label:HTMLDivElement}>();
  private storage=new Map<string,{group:THREE.Group;material:THREE.MeshLambertMaterial;label:HTMLDivElement}>();
  private carriers:THREE.InstancedMesh;private slotLabels=new Map<string,HTMLDivElement>();private stones:THREE.InstancedMesh[]=[]; private particles:THREE.InstancedMesh;private coins:THREE.InstancedMesh;private beltPhase=0;private flashes=new Map<string,number>();private effects:Effect[]=[];private effectCursor=0;
  private dummy=new THREE.Object3D();private color=new THREE.Color();private raycaster=new THREE.Raycaster();private plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  private cameraBase=new THREE.Vector3();private shakeRemaining=0;private reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  private ring:THREE.Mesh; private targetRing:THREE.Mesh;private treads:THREE.InstancedMesh;private state:GameState|null=null;private lastWidth=0;private lastHeight=0;
  private pit:THREE.Group;private storageTray:THREE.Mesh;
  private trackPoints:Point[]=[];private landscape=false;private field=new THREE.Group();private floor:THREE.Mesh;private belt=new THREE.Group();
  constructor(readonly shell:HTMLElement,private canDrop:(target:DropTarget)=>boolean=()=>false){
    this.canvas=document.createElement('canvas');this.canvas.setAttribute('aria-label','Stop the rock snake before the finish. Tap barrels, drag workers onto pads, and tap or drag cyan rewind, purple pause, or amber permanent slowdown bonuses onto the field. Drag unwanted workers into the discard pit.');this.canvas.dataset.testid='game-canvas';
    const context=this.canvas.getContext('webgl2',{antialias:true,alpha:false});
    if(!context) throw new Error('WebGL 2 is unavailable. Please open this prototype in a recent browser with graphics acceleration enabled.');
    this.renderer=new THREE.WebGLRenderer({canvas:this.canvas,context,antialias:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,viewConfig.dprLimit));
    this.renderer.setClearColor(0x61556f);this.renderer.outputColorSpace=THREE.SRGBColorSpace;shell.append(this.canvas);
    this.labels=document.createElement('div');this.labels.className='labels';shell.append(this.labels);
    this.scene.add(new THREE.HemisphereLight(0xe9e9ff,0x514059,2.5));const key=new THREE.DirectionalLight(0xffedd5,3);key.position.set(-4,12,8);this.scene.add(key);
    this.scene.add(this.field,this.belt);const floor=new THREE.Mesh(new THREE.BoxGeometry(viewConfig.floor.width,.3,viewConfig.floor.depth),new THREE.MeshLambertMaterial({color:0x86728f}));floor.position.y=-.25;this.floor=floor;this.scene.add(floor);
    const walls=new THREE.Mesh(makeWallGeometry(),new THREE.MeshLambertMaterial({map:makeBrickTexture()}));this.field.add(walls);
    // A subtle route ribbon is a flat strip, never a deforming resource mesh.
    const positions:number[]=[];for(let d=0;d<=PATH_LENGTH;d+=.12)this.trackPoints.push(samplePath(d));
    this.trackPoints.push(samplePath(PATH_LENGTH));
    for(let i=0;i<this.trackPoints.length-1;i++){const a=this.trackPoints[i],b=this.trackPoints[i+1];const dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz);const nx=-dz/l*.34,nz=dx/l*.34;positions.push(a.x+nx,.011,a.z+nz,a.x-nx,.011,a.z-nz,b.x+nx,.011,b.z+nz,b.x+nx,.011,b.z+nz,a.x-nx,.011,a.z-nz,b.x-nx,.011,b.z-nz);}
    const routeGeo=new THREE.BufferGeometry();routeGeo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));routeGeo.computeVertexNormals();
    this.field.add(new THREE.Mesh(routeGeo,new THREE.MeshBasicMaterial({color:0x574a69,side:THREE.DoubleSide})));
    const finish=samplePath(PATH_LENGTH);
    for(let i=0;i<4;i++){const tile=new THREE.Mesh(new THREE.BoxGeometry(.16,.035,.21),new THREE.MeshBasicMaterial({color:i%2?0xff7f83:0xffe4ce}));tile.position.set(finish.x,.045,finish.z+(i-1.5)*.21);this.field.add(tile);}
    this.finishLabel=document.createElement('div');this.finishLabel.className='pad-label';this.finishLabel.dataset.marker='finish';this.finishLabel.textContent='FINISH';this.finishLabel.style.background='#963c51';this.finishLabel.style.fontSize='10px';this.labels.append(this.finishLabel);
    // Storage and its worker-only discard pit have their own view-space bay.
    const pit=new THREE.Group();this.pit=pit;pit.position.set(CONFIG.discard.x,0,CONFIG.discard.z);
    const hole=new THREE.Mesh(new THREE.CircleGeometry(CONFIG.discard.radius,24),new THREE.MeshBasicMaterial({color:0x1c1925,side:THREE.DoubleSide}));hole.rotation.x=-Math.PI/2;hole.position.y=.018;pit.add(hole);
    const rim=new THREE.Mesh(new THREE.RingGeometry(CONFIG.discard.radius,CONFIG.discard.radius+.09,24),new THREE.MeshBasicMaterial({color:0xe08a59,side:THREE.DoubleSide}));rim.rotation.x=-Math.PI/2;rim.position.y=.026;pit.add(rim);this.scene.add(pit);
    this.storageTray=new THREE.Mesh(new THREE.BoxGeometry(6.1,.06,1.35),new THREE.MeshLambertMaterial({color:0x655d79}));this.storageTray.position.y=-.055;this.scene.add(this.storageTray);
    this.discardLabel=document.createElement('div');this.discardLabel.className='pad-label discard-label';this.discardLabel.dataset.marker='discard';this.discardLabel.textContent='🗑︎';this.discardLabel.title='Discard worker';this.discardLabel.setAttribute('aria-label','Discard pit: drag and release unwanted workers here. No coins returned.');this.labels.append(this.discardLabel);
    this.headLabel=document.createElement('div');this.headLabel.className='pad-label';this.headLabel.dataset.marker='head';this.headLabel.textContent='HEAD';this.headLabel.style.background='#3a344b';this.headLabel.style.fontSize='9px';this.labels.append(this.headLabel);
    const belt=new THREE.Mesh(new THREE.BoxGeometry(6.3,.16,1.1),new THREE.MeshLambertMaterial({color:0x324350}));belt.position.set(0,.03,0);this.belt.add(belt);
    for(const z of [-.6,.6]){const rail=new THREE.Mesh(new THREE.BoxGeometry(6.5,.17,.16),new THREE.MeshLambertMaterial({color:0x679dc6}));rail.position.set(0,.10,z);this.belt.add(rail);}
    this.treads=new THREE.InstancedMesh(new THREE.BoxGeometry(.045,.024,.98),new THREE.MeshLambertMaterial({color:0x65818a}),28);this.scene.add(this.treads);this.carriers=new THREE.InstancedMesh(new THREE.BoxGeometry(.68,.024,.82),new THREE.MeshLambertMaterial({color:0x6a9698}),CONFIG.conveyor.count);this.scene.add(this.carriers);
    for(let v=0;v<3;v++){const geometry=v===1?new THREE.DodecahedronGeometry(.25,0):new THREE.IcosahedronGeometry(v===2?.26:.25,v===2?1:0);const mesh=new THREE.InstancedMesh(geometry,new THREE.MeshLambertMaterial({color:0xffffff,flatShading:true}),200);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;this.stones.push(mesh);this.scene.add(mesh);}
    this.particles=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshBasicMaterial({color:0xffffff}),viewConfig.maxEffects);this.particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.particles.frustumCulled=false;this.scene.add(this.particles);this.coins=new THREE.InstancedMesh(new THREE.CylinderGeometry(1,1,.18,10),new THREE.MeshLambertMaterial({color:0xffd66c}),viewConfig.maxEffects);this.coins.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.coins.frustumCulled=false;this.scene.add(this.coins);
    for(let i=0;i<viewConfig.maxEffects;i++)this.effects.push({active:false,age:0,life:0,x:0,y:0,z:0,vx:0,vy:0,vz:0,color:0,size:0,coin:false});
    this.ring=new THREE.Mesh(new THREE.RingGeometry(.98,1,64),new THREE.MeshBasicMaterial({color:0x8effc5,transparent:true,opacity:.8,side:THREE.DoubleSide,depthTest:false}));this.ring.rotation.x=-Math.PI/2;this.ring.visible=false;this.ring.renderOrder=20;this.scene.add(this.ring);
    this.targetRing=new THREE.Mesh(new THREE.RingGeometry(.56,.62,32),new THREE.MeshBasicMaterial({color:0x8effc5,transparent:true,opacity:.95,side:THREE.DoubleSide,depthTest:false}));this.targetRing.rotation.x=-Math.PI/2;this.targetRing.visible=false;this.targetRing.renderOrder=20;this.scene.add(this.targetRing);
    this.resize();
  }
  resize(){const rect=this.canvas.getBoundingClientRect();const w=rect.width,h=rect.height;if(w===this.lastWidth&&h===this.lastHeight)return;this.lastWidth=w;this.lastHeight=h;this.landscape=this.shell.clientWidth>this.shell.clientHeight;this.field.rotation.y=this.landscape?Math.PI/2:0;this.field.position.x=this.landscape?LANDSCAPE_LAYOUT.fieldOffsetX:0;const pitPosition=mapPosition(CONFIG.discard,this.landscape,'discard');this.pit.position.set(pitPosition.x,0,pitPosition.z);this.storageTray.visible=this.landscape;this.storageTray.position.set(LANDSCAPE_LAYOUT.storageCenterX,-.055,LANDSCAPE_LAYOUT.storageZ);this.belt.position.z=this.landscape?LANDSCAPE_LAYOUT.beltZ:CONFIG.conveyor.z;this.belt.scale.x=this.landscape?2:1;this.floor.scale.set(this.landscape?2.18:1,1,this.landscape?.62:.88);this.floor.position.z=this.landscape?1.8:.4;this.reset();this.renderer.setSize(w,h,false);this.camera.aspect=w/h;
    const direction=new THREE.Vector3(...viewConfig.camera.direction).normalize();const vertical=this.landscape?CONFIG.camera.landscapeDepth:CONFIG.camera.frameDepth;const horizontal=this.landscape?CONFIG.camera.landscapeWidth:CONFIG.camera.frameWidth;const fov=THREE.MathUtils.degToRad(viewConfig.camera.fov);const distance=Math.max(vertical/2/Math.tan(fov/2),horizontal/2/Math.tan(fov/2)/this.camera.aspect)*viewConfig.camera.margin;
    if(this.landscape){
      // Preserve zoom; aim farther down the new track → storage → conveyor stack.
      const target=new THREE.Vector3(0,0,LANDSCAPE_LAYOUT.cameraTargetZ);
      this.camera.position.copy(target).addScaledVector(direction,distance);this.camera.lookAt(target);
    }else{
      // Fit playable geometry, not the decorative floor, inside the reserved HUD rails.
      // Perspective constraints account for the nearer belt and the highest workers.
      const bounds=CONFIG.camera.portraitBounds;
      const target=new THREE.Vector3(0,0,bounds.targetZ);
      const right=new THREE.Vector3(1,0,0),up=new THREE.Vector3().crossVectors(direction,right).normalize();
      const tanY=Math.tan(fov/2)*Math.max(.1,1-2*bounds.paddingPx/h);
      const tanX=Math.tan(fov/2)*this.camera.aspect*Math.max(.1,1-2*bounds.paddingPx/w);
      let fit=0;
      for(const x of [bounds.left,bounds.right])for(const y of [0,bounds.height])for(const z of [bounds.back,bounds.front]){
        const point=new THREE.Vector3(x,y,z).sub(target),depth=point.dot(direction);
        fit=Math.max(fit,Math.abs(point.dot(right))/tanX+depth,Math.abs(point.dot(up))/tanY+depth);
      }
      this.camera.position.copy(target).addScaledVector(direction,fit*1.02);this.camera.lookAt(target);
    }
    this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();this.cameraBase.copy(this.camera.position);
  }
  private mapped(point:Point,belt=false,zone?:ViewZone):Point{return mapPosition(point,this.landscape,zone??(belt?'belt':placeZone(point)));}
  project(point:Point,y=0,belt=false,zone?:ViewZone):ScreenPoint{const p=this.mapped(point,belt,zone);const v=new THREE.Vector3(p.x,y,p.z).project(this.camera);return{x:(v.x+1)*this.lastWidth/2,y:(1-v.y)*this.lastHeight/2};}
  world(clientX:number,clientY:number):Point|null{const rect=this.canvas.getBoundingClientRect();this.raycaster.setFromCamera(new THREE.Vector2((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1),this.camera);const v=new THREE.Vector3();return this.raycaster.ray.intersectPlane(this.plane,v)?unmapFieldPosition({x:v.x,z:v.z},this.landscape):null;}
  private insidePit(point:Point):boolean{const ground=this.mapped(point,false,'field'),pit=this.mapped(CONFIG.discard,false,'discard');return Math.hypot(ground.x-pit.x,ground.z-pit.z)<=CONFIG.discard.radius;}
  private location(entityId:string):Point|null{const e=this.state?.entities[entityId];if(!e||!this.state||e.location.kind==='drag')return null;const ref=e.location;return(ref.kind==='pad'?this.state.pads:ref.kind==='storage'?this.state.storage:this.state.slots).find(p=>p.id===ref.id)??null;}
  private overUI(clientX:number,clientY:number):boolean{
    return [...this.shell.querySelectorAll<HTMLElement>('.topbar, .tutorial, .footer, .overlay:not([hidden]), .toast.visible')].some(ui=>{const r=ui.getBoundingClientRect();return clientX>=r.left&&clientX<=r.right&&clientY>=r.top&&clientY<=r.bottom;});
  }
  hit(clientX:number,clientY:number):HitTarget|null{
    if(!this.state||this.overUI(clientX,clientY))return null;
    const rect=this.canvas.getBoundingClientRect(),x=clientX-rect.left,y=clientY-rect.top;
    if(x<0||x>rect.width||y<0||y>rect.height)return null;
    const core:{target:HitTarget,d:number}[]=[],halo:{target:HitTarget,d:number}[]=[];
    for(const e of Object.values(this.state.entities)){
      const loc=this.location(e.id);if(!loc)continue;
      const p=this.project(loc,e.kind==='worker'?.40:e.location.kind==='storage'?.39:.27,e.location.kind==='slot');
      const d=Math.hypot(x-p.x,y-p.y),candidate={target:{kind:'entity' as const,id:e.id},d};
      if(d<=viewConfig.hitRadiusPx)core.push(candidate);
      else if(d<=viewConfig.pickupRadiusPx)halo.push(candidate);
    }
    // Existing pad/storage cores take priority over neighboring pickup halos.
    // Occupied places are represented solely by their entity.
    for(const kind of ['storage','pad'] as const)for(const p of kind==='storage'?this.state.storage:this.state.pads){
      if(p.entityId||p.reserved)continue;
      const screen=this.project(p,.1),d=Math.hypot(x-screen.x,y-screen.y);
      if(d<=viewConfig.hitRadiusPx)core.push({target:{kind,id:p.id},d});
    }
    const nearest=(items:{target:HitTarget,d:number}[])=>items.sort((a,b)=>a.d-b.d)[0]?.target??null;
    // The pit has no click action, and its interior must never grab nearby cargo.
    const point=this.world(clientX,clientY);
    if(point&&this.insidePit(point))return null;
    if(core.length)return nearest(core);
    if(halo.length)return nearest(halo);
    const slots:{target:HitTarget,d:number}[]=[];
    for(const p of this.state.slots){if(p.entityId||p.reserved)continue;const screen=this.project(p,.1,true),d=Math.hypot(x-screen.x,y-screen.y);if(d<=viewConfig.hitRadiusPx)slots.push({target:{kind:'slot',id:p.id},d});}
    return nearest(slots);
  }
  dropTarget(clientX:number,clientY:number):DropTarget{
    if(!this.state?.drag)return null;const bounds=this.canvas.getBoundingClientRect();if(clientX<bounds.left||clientX>bounds.right||clientY<bounds.top||clientY>bounds.bottom)return null;const entity=this.state.entities[this.state.drag.entityId];
    // UI and every storage stand take precedence over bonus activation. In
    // particular, an occupied/unaffordable stand returns an invalid storage
    // target rather than falling through to field/track consumption.
    for(const ui of this.shell.querySelectorAll<HTMLElement>('.topbar, .tutorial, .footer, .overlay:not([hidden]), .toast.visible')){
      const rect=ui.getBoundingClientRect();
      if(clientX>=rect.left&&clientX<=rect.right&&clientY>=rect.top&&clientY<=rect.bottom)return null;
    }
    const groundPoint=this.world(clientX,clientY);
    // No enlarged halo here: deletion requires release inside the visible hole.
    // Invalid items still resolve to the pit, preventing accidental bonus use.
    if(groundPoint&&this.insidePit(groundPoint))return{kind:'discard'};
    // Choose the nearest stand, never the first array entry inside overlapping touch halos.
    const storageCandidates:{id:string;distance:number}[]=[];
    const ground=groundPoint?this.mapped(groundPoint,false,'field'):null;
    for(const stand of this.state.storage){
      const screen=this.project(stand,.1),occupied=this.project(stand,.39),position=this.mapped(stand);
      const distance=Math.hypot(clientX-bounds.left-screen.x,clientY-bounds.top-screen.y);
      const occupiedDistance=stand.entityId?Math.hypot(clientX-bounds.left-occupied.x,clientY-bounds.top-occupied.y):Infinity;
      if(distance<=viewConfig.hitRadiusPx||occupiedDistance<=viewConfig.hitRadiusPx||
         (ground&&Math.abs(ground.x-position.x)<=.48&&Math.abs(ground.z-position.z)<=.4))storageCandidates.push({id:stand.id,distance:Math.min(distance,occupiedDistance)});
    }
    const closestStorage=storageCandidates.sort((a,b)=>a.distance-b.distance)[0];
    if(closestStorage)return{kind:'storage',id:closestStorage.id};
    if(entity?.kind==='rewind'||entity?.kind==='slow'||entity?.kind==='brake'){
      // Pointer capture still delivers releases over HTML controls. Those are
      // never part of the playfield, even if ground lies behind them.
      for(const ui of this.shell.querySelectorAll<HTMLElement>('.topbar, .tutorial, .footer, .overlay:not([hidden]), .toast.visible')){
        const rect=ui.getBoundingClientRect();
        if(clientX>=rect.left&&clientX<=rect.right&&clientY>=rect.top&&clientY<=rect.bottom)return null;
      }
      const rect=this.canvas.getBoundingClientRect();
      for(const pad of this.state.pads){const screen=this.project(pad,.1);if(Math.hypot(clientX-rect.left-screen.x,clientY-rect.top-screen.y)<=viewConfig.hitRadiusPx)return{kind:'pad',id:pad.id};}
      const point=this.world(clientX,clientY);if(!point)return null;
      const ground=this.mapped(point),beltZ=this.landscape?LANDSCAPE_LAYOUT.beltZ:CONFIG.conveyor.z;
      if(Math.abs(ground.x)<=(this.landscape?6.5:3.25)&&Math.abs(ground.z-beltZ)<=.72)return null;
      return{kind:'field',...point};
    }
    if(entity?.kind==='bomb'){const rect=this.canvas.getBoundingClientRect();for(const slot of this.state.slots){const p=this.project(slot,.1,true);if(!slot.entityId&&Math.hypot(clientX-rect.left-p.x,clientY-rect.top-p.y)<=viewConfig.hitRadiusPx)return{kind:'slot',id:slot.id};}const p=this.world(clientX,clientY);return p?{kind:'track',...p}:null;}
    const rect=this.canvas.getBoundingClientRect();const x=clientX-rect.left,y=clientY-rect.top;const candidates:{target:DropTarget,d:number}[]=[];
    for(const kind of ['pad','slot'] as const)for(const p of kind==='pad'?this.state.pads:this.state.slots){const s=this.project(p,p.entityId && this.state.entities[p.entityId]?.kind==='worker' ? .4 : .10,kind==='slot');const d=Math.hypot(x-s.x,y-s.y);if(d<=viewConfig.hitRadiusPx+5)candidates.push({target:{kind,id:p.id},d});}
    return candidates.sort((a,b)=>a.d-b.d)[0]?.target??null;
  }
  showDrop(target:DropTarget,valid:boolean,bombRadius:number){this.ring.visible=false;this.targetRing.visible=false;if(!target)return;
    const color=valid?0x8effb7:0xff8580;if(target.kind==='track'||target.kind==='field'){const p=this.mapped(target);this.ring.position.set(p.x,.08,p.z);this.ring.scale.setScalar(target.kind==='field'?.55:bombRadius);(this.ring.material as THREE.MeshBasicMaterial).color.setHex(color);this.ring.visible=true;}
    else if(target.kind==='discard'){const p=this.mapped(CONFIG.discard,false,'discard');this.targetRing.position.set(p.x,.1,p.z);(this.targetRing.material as THREE.MeshBasicMaterial).color.setHex(color);this.targetRing.visible=true;}
    else {const p=(target.kind==='pad'?this.state?.pads:target.kind==='storage'?this.state?.storage:this.state?.slots)?.find(p=>p.id===target.id);if(p){const m=this.mapped(p,target.kind==='slot');this.targetRing.position.set(m.x,.1,m.z);(this.targetRing.material as THREE.MeshBasicMaterial).color.setHex(color);this.targetRing.visible=true;}}
  }
  burst(x:number,z:number,color:number,count=10,large=false,coin=false){const zone:ViewZone=x===CONFIG.discard.x&&z===CONFIG.discard.z?'discard':CONFIG.storage.some(stand=>stand.x===x&&stand.z===z)?'storage':z===CONFIG.conveyor.z?'belt':'field';const p=this.mapped({x,z},false,zone);x=p.x;z=p.z;for(let i=0;i<count;i++){const e=this.effects[this.effectCursor++%this.effects.length];Object.assign(e,{active:true,age:0,life:large?.65:.42,x,y:.3,z,vx:(Math.random()-.5)*(large?6:2),vy:2+Math.random()*2,vz:(Math.random()-.5)*(large?6:2),color,size:coin?.11:large?.12:.075,coin});}}
  private updateCameraShake(state:GameState,dt:number,events:GameEvent[]){
    // Always rebuild from the settled pose, so repeated bombs cannot accumulate drift.
    this.camera.position.copy(this.cameraBase);
    if(state.paused||state.gameOver||this.reducedMotion.matches){this.shakeRemaining=0;}
    else{
      if(events.some(event=>event.type==='bomb'))this.shakeRemaining=.28;
      if(this.shakeRemaining>0){
        this.shakeRemaining=Math.max(0,this.shakeRemaining-dt);
        const elapsed=.28-this.shakeRemaining,strength=.13*(this.shakeRemaining/.28)**2;
        this.camera.position.x+=Math.sin(elapsed*113)*strength;
        this.camera.position.y+=Math.sin(elapsed*157+.8)*strength*.65;
      }
    }
    // Labels, hit/drop projection and the render all use this same current camera.
    this.camera.updateMatrixWorld();
  }
  clearMergeTargets(){
    for(const view of this.entities.values()){
      view.hit.classList.remove('merge-target');view.label.classList.remove('merge-target-label');
      delete view.hit.dataset.mergeTarget;
    }
  }
  private mergeTargets(state:GameState):Set<string>{
    const targets=new Set<string>();
    const held=state.drag?state.entities[state.drag.entityId]:undefined;
    if(state.paused||state.gameOver||held?.kind!=='worker')return targets;
    for(const kind of ['pad','slot'] as const)for(const place of kind==='pad'?state.pads:state.slots){
      const other=place.entityId?state.entities[place.entityId]:undefined;
      if(place.reserved||!other||other.id===held.id||other.kind!=='worker'||other.level!==held.level)continue;
      if(other.location.kind!==kind||other.location.id!==place.id)continue;
      // Use the command's live legality, including source ownership and pad locks.
      if(this.canDrop({kind,id:place.id}))targets.add(other.id);
    }
    return targets;
  }
  reset(){this.shakeRemaining=0;this.camera.position.copy(this.cameraBase);this.camera.updateMatrixWorld();this.clearMergeTargets();this.beltPhase=0;this.flashes.clear();for(const e of this.effects)e.active=false;this.ring.visible=false;this.targetRing.visible=false;}
  sync(state:GameState,dt:number,dragPosition:Point|null,events:GameEvent[]){this.state=state;this.updateCameraShake(state,dt,events);for(const[id,time]of this.flashes){if(time<=dt)this.flashes.delete(id);else this.flashes.set(id,time-dt);}for(const e of events)if(e.type==='hit'&&e.stoneId)this.flashes.set(e.stoneId,.16);
    // Read-only render mirrors support browser verification without a game-control hook.
    const ordered=[...state.stones].sort((a,b)=>a.distance-b.distance);
    const hasGap=ordered.some((stone,i)=>i>0&&stone.distance-ordered[i-1].distance>CONFIG.stones.spacing+1e-9);
    const motion=state.slowRemaining>0?'frozen':state.rewindTarget!==null?'rewind':hasGap?(state.gapRecoveryRemaining>1e-9?'gap-pause':'gap-retract'):'forward';
    const slowFactor=state.slowRemaining>0?0:1;
    const advancingSpeed=effectiveForwardSpeed(state.difficultyTime,state.permanentSpeedReduction)*slowFactor;
    const speed=state.paused||state.gameOver||state.slowRemaining>0?0:state.headSpeed;
    this.canvas.dataset.speedReduction=String(state.permanentSpeedReduction);this.canvas.dataset.forwardSpeed=String(advancingSpeed);this.canvas.dataset.time=String(state.time);this.canvas.dataset.motion=motion;this.canvas.dataset.speed=String(speed);
    const recoils=recoilDistances(ordered,PATH_LENGTH);const rendered=new Map(ordered.map((s,i)=>[s.id,s.frozenRenderDistance??recoils[i]]));
    const stoneMarkers:{id:string;distance:number;x:number;y:number;bounce:number;renderDistance:number}[]=[];
    const counts=[0,0,0];for(const stone of state.stones){const renderDistance=rendered.get(stone.id)??stone.distance,bounce=renderDistance-stone.distance,path=samplePath(renderDistance),ground=this.project(path,0);stoneMarkers.push({id:stone.id,distance:stone.distance,x:ground.x,y:ground.y,bounce,renderDistance});if(stone.distance<0)continue;const mesh=this.stones[stone.variant%3],i=counts[stone.variant%3]++;const p=this.mapped(path);this.dummy.position.set(p.x,.27+bounce*.2,p.z);this.dummy.rotation.set(.15*Math.sin(stone.distance),path.angle+stone.variant+(this.landscape?Math.PI/2:0),.2);this.dummy.scale.setScalar(1);this.dummy.updateMatrix();mesh.setMatrixAt(i,this.dummy.matrix);this.color.setHex(resourceColors[stone.resource]);if(this.flashes.has(stone.id))this.color.lerp(new THREE.Color(0xffffff),.7);else if(stone.hp<stone.maxHp)this.color.lerp(new THREE.Color(0xffffff),.12);mesh.setColorAt(i,this.color);}
    this.canvas.dataset.stones=JSON.stringify(stoneMarkers);
    for(let i=0;i<3;i++){this.stones[i].count=counts[i];this.stones[i].instanceMatrix.needsUpdate=true;if(this.stones[i].instanceColor)this.stones[i].instanceColor!.needsUpdate=true;}
    const discardScreen=this.project(CONFIG.discard,.04,false,'discard');
    this.discardLabel.style.transform='translate(-50%,-50%)';this.discardLabel.style.left=`${discardScreen.x}px`;this.discardLabel.style.top=`${discardScreen.y}px`;this.discardLabel.classList.toggle('active',state.drag!==null&&state.entities[state.drag.entityId]?.kind==='worker');
    const finish=samplePath(PATH_LENGTH),finishScreen=this.project({x:finish.x+.6,z:finish.z},.25);this.finishLabel.style.left=`${finishScreen.x}px`;this.finishLabel.style.top=`${finishScreen.y}px`;
    const head=state.stones.reduce<(typeof state.stones)[number]|null>((a,b)=>!a||b.distance>a.distance?b:a,null);this.headLabel.dataset.distance=head?String(head.distance):'';this.headLabel.hidden=true;if(head&&head.distance>=0){const screen=this.project(samplePath(head.distance),.95);this.headLabel.style.left=`${screen.x}px`;this.headLabel.style.top=`${screen.y}px`;}
    if(!state.paused&&!state.gameOver)this.beltPhase+=dt*CONFIG.conveyor.speed;for(let i=0;i<28;i++){const x=-3.15+((i*.225-this.beltPhase%6.3+6.3)%6.3),p=this.mapped({x,z:CONFIG.conveyor.z},true);this.dummy.position.set(p.x,.132,p.z);this.dummy.rotation.set(0,0,0);this.dummy.scale.setScalar(1);this.dummy.updateMatrix();this.treads.setMatrixAt(i,this.dummy.matrix);}this.treads.instanceMatrix.needsUpdate=true;
    // A carrier belongs to visible cargo. Vacated slots must not leave a container
    // behind; show their drop affordance only while a worker or bomb is in hand.
    const dragged=state.drag?state.entities[state.drag.entityId]:undefined;
    const showSlotTargets=dragged?.kind==='worker'||dragged?.kind==='bomb';
    let carrierCount=0;
    for(const slot of state.slots){
      const cargo=slot.entityId?state.entities[slot.entityId]:undefined;
      if(cargo?.location.kind==='slot'&&cargo.location.id===slot.id){const p=this.mapped(slot,true);this.dummy.position.set(p.x,.145,p.z);this.dummy.rotation.set(0,0,0);this.dummy.scale.setScalar(1);this.dummy.updateMatrix();this.carriers.setMatrixAt(carrierCount++,this.dummy.matrix);}
      let label=this.slotLabels.get(slot.id);if(!label){label=document.createElement('div');label.className='slot-label';label.dataset.slot=slot.id;label.textContent='＋';label.setAttribute('aria-label','Empty conveyor drop slot');this.labels.append(label);this.slotLabels.set(slot.id,label);}
      label.dataset.entityId=slot.entityId??'';label.dataset.reserved=String(slot.reserved);
      const isSource=state.drag?.source.kind==='slot'&&state.drag.source.id===slot.id;
      label.hidden=!showSlotTargets||!!slot.entityId||(slot.reserved&&!isSource);
      const screen=this.project(slot,.2,true);label.style.left=`${screen.x}px`;label.style.top=`${screen.y}px`;
    }
    this.carriers.count=carrierCount;this.carriers.instanceMatrix.needsUpdate=true;
    for(const [id,view]of this.entities)if(!state.entities[id]||state.entities[id].kind!==view.kind){if(view.worker)view.worker.dispose();else disposePrimitive(view.group);view.label.remove();view.hit.remove();this.entities.delete(id);}
    const mergeTargets=this.mergeTargets(state);
    for(const entity of Object.values(state.entities)){
      let v=this.entities.get(entity.id);if(!v){const worker=entity.kind==='worker'?createWorker():undefined;const group=worker?.group??(entity.kind==='barrel'?createBarrel():entity.kind==='rewind'?createRewind():entity.kind==='slow'?createSlow():entity.kind==='brake'?createBrake():createBomb());const label=document.createElement('div');label.className=entity.kind==='worker'?'entity-label':'barrel-label';const hit=document.createElement('div');hit.className='entity-target';hit.dataset.entity=entity.id;hit.dataset.kind=entity.kind;if(entity.kind==='rewind'||entity.kind==='slow'||entity.kind==='brake'){const slow=entity.kind==='slow',brake=entity.kind==='brake';label.style.color=brake?'#54330b':slow?'#33277e':'#074b5e';label.style.background=brake?'#ffcf7e':slow?'#d7d0ff':'#a7fff6';label.style.borderRadius='7px';label.style.padding='0 3px';label.setAttribute('aria-label',brake?'Permanent slowdown: tap or drag onto the field. Current forward speed drops 20 percent, with a minimum speed. Acceleration continues.':slow?'Pause snake bonus. Tap or drag onto the field to freeze the snake for five seconds.':'Rewind bonus. Tap or drag onto the field to use.');}this.labels.append(label,hit);this.scene.add(group);v={kind:entity.kind,group,worker,label,hit};this.entities.set(entity.id,v);}
      const mergeTarget=mergeTargets.has(entity.id);
      v.hit.classList.toggle('merge-target',mergeTarget);v.label.classList.toggle('merge-target-label',mergeTarget);
      if(mergeTarget)v.hit.dataset.mergeTarget='true';else delete v.hit.dataset.mergeTarget;
      v.hit.dataset.locationKind=entity.location.kind;v.hit.dataset.locationId=entity.location.kind==='drag'?'':entity.location.id;
      const loc=entity.location.kind==='drag'?dragPosition:this.location(entity.id);if(!loc){v.group.visible=false;v.label.hidden=true;v.hit.hidden=true;continue;}v.group.visible=true;v.label.hidden=false;v.hit.hidden=false;const mapped=this.mapped(loc,entity.location.kind==='slot');v.group.position.set(mapped.x,entity.location.kind==='slot'?.14:entity.location.kind==='drag'?.45:entity.location.kind==='storage'?.26:.1,mapped.z);
      if(entity.kind==='worker'){v.worker!.setLevel(entity.level);v.worker!.setAction(entity.location.kind==='pad'?entity.mining.phase:0);v.label.textContent=String(entity.level);v.hit.dataset.level=String(entity.level);const stone=entity.mining.targetId?state.stones.find(s=>s.id===entity.mining.targetId):null;const target=stone?samplePath(stone.distance):null;const aim=target?this.mapped(target):null;v.group.rotation.y=aim?Math.atan2(aim.x-mapped.x,aim.z-mapped.z):0;}
      else if(entity.kind==='barrel'){v.label.textContent=entity.content==='worker'?'✦':'?';}else v.label.textContent=entity.kind==='rewind'?'⏪':entity.kind==='slow'?'⏸':entity.kind==='brake'?'↓ 20%':'';
      const h=this.project(loc,entity.kind==='worker'?.4:entity.location.kind==='storage'?.39:.27,entity.location.kind==='slot');v.hit.style.left=`${h.x}px`;v.hit.style.top=`${h.y}px`;const p=this.project(loc,entity.kind==='worker'?1.27:entity.kind==='barrel'?.80:entity.location.kind==='storage'?1.02:.9,entity.location.kind==='slot');v.label.style.left=`${p.x}px`;v.label.style.top=`${p.y}px`;
    }
    for(const pad of state.pads){let v=this.pads.get(pad.id);if(!v){const mesh=new THREE.Mesh(new THREE.BoxGeometry(.95,.13,.88),new THREE.MeshLambertMaterial({color:0x41394f}));mesh.position.set(pad.x,.025,pad.z);this.scene.add(mesh);const label=document.createElement('div');label.dataset.pad=pad.id;this.labels.append(label);v={mesh,label};this.pads.set(pad.id,v);}const mapped=this.mapped(pad);v.mesh.position.set(mapped.x,.025,mapped.z);const m=v.mesh.material as THREE.MeshLambertMaterial;m.color.setHex(pad.unlocked?0x426e69:0x54415f);v.label.dataset.unlocked=String(pad.unlocked);v.label.dataset.entityId=pad.entityId??'';v.label.dataset.reserved=String(pad.reserved);v.label.className=`pad-label ${pad.unlocked?'open':state.coins>=pad.price?'affordable':''}`;v.label.textContent=pad.unlocked?(pad.entityId?'':'＋ WORK'): `${pad.price} ●`;v.label.hidden=pad.unlocked&&!!pad.entityId;const p=this.project(pad,.19);v.label.style.left=`${p.x}px`;v.label.style.top=`${p.y}px`;}
    for(const stand of state.storage){
      let v=this.storage.get(stand.id);
      if(!v){
        const group=new THREE.Group(),material=new THREE.MeshLambertMaterial({color:0x736084,flatShading:true});
        const base=new THREE.Mesh(new THREE.CylinderGeometry(.44,.49,.19,6),material);base.position.y=.09;group.add(base);
        const inset=new THREE.Mesh(new THREE.CylinderGeometry(.32,.32,.035,6),new THREE.MeshLambertMaterial({color:0x30364b}));inset.position.y=.20;group.add(inset);
        this.scene.add(group);const label=document.createElement('div');label.dataset.storage=stand.id;this.labels.append(label);
        v={group,material,label};this.storage.set(stand.id,v);
      }
      const point=this.mapped(stand);v.group.position.set(point.x,0,point.z);
      const occupied=!!stand.entityId||stand.reserved;
      v.material.color.setHex(stand.unlocked?(occupied?0x68a8b9:0x67b6a3):state.coins>=stand.price?0xc5a35c:0x736084);
      v.label.className=`pad-label storage-label ${stand.unlocked?'open':state.coins>=stand.price?'affordable':''}`;
      v.label.dataset.unlocked=String(stand.unlocked);v.label.dataset.entityId=stand.entityId??'';v.label.dataset.reserved=String(stand.reserved);
      v.label.textContent=stand.unlocked?(occupied?'':'＋'):`${stand.price} ●`;
      v.label.setAttribute('aria-label',stand.unlocked?(occupied?'Occupied bonus storage':'Empty bonus storage'):`Buy bonus storage for ${stand.price} coins`);
      const screen=this.project(stand,.04);v.label.style.left=`${screen.x}px`;v.label.style.top=`${screen.y+17}px`;
    }
    for(const e of events){if(e.type==='coins')this.burst(e.x,e.z,0xffd26a,4,false,true);else if(e.type==='destroy')this.burst(e.x,e.z,0xb9e9df,5);else if(e.type==='hit')this.burst(e.x,e.z,0xb9e9df,3);else if(e.type==='merge'||e.type==='purchase')this.burst(e.x,e.z,0x76ffc9,18,true);else if(e.type==='bomb')this.burst(e.x,e.z,0xffc05d,45,true);else if(e.type==='open')this.burst(e.x,e.z,0xdedbb5,5);else if(e.type==='rewind')this.burst(e.x,e.z,0x74f8f0,24,true);else if(e.type==='slow')this.burst(e.x,e.z,0xaaa1ff,18,true);else if(e.type==='brake')this.burst(e.x,e.z,0xffc260,18,true);else if(e.type==='discard')this.burst(e.x,e.z,0x996b68,5);}
    let count=0,coinCount=0;for(const e of this.effects){if(!e.active)continue;e.age+=dt;if(e.age>=e.life){e.active=false;continue;}e.x+=e.vx*dt;e.y+=e.vy*dt;e.z+=e.vz*dt;e.vy-=8*dt;this.dummy.position.set(e.x,e.y,e.z);this.dummy.scale.setScalar(e.size*(1-e.age/e.life));this.dummy.rotation.set(e.coin?Math.PI/2:e.age*5,e.age*6,e.age*3);this.dummy.updateMatrix();if(e.coin)this.coins.setMatrixAt(coinCount++,this.dummy.matrix);else{this.particles.setMatrixAt(count,this.dummy.matrix);this.particles.setColorAt(count++,this.color.setHex(e.color));}}this.coins.count=coinCount;this.coins.instanceMatrix.needsUpdate=true;this.particles.count=count;this.particles.instanceMatrix.needsUpdate=true;if(this.particles.instanceColor)this.particles.instanceColor.needsUpdate=true;
    this.renderer.render(this.scene,this.camera);
  }
  metrics(){return{calls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures,effects:this.particles.count+this.coins.count};}
}
