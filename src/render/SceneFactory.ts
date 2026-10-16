import * as THREE from 'three';
import { createDungeonRoom, createBeveledStoneGeometry, createGothicArch, createTimberTrack, createConveyorFrame, createConveyorTunnels, conveyorSlotExposed, createConveyorTreadGeometry, createOreGeometry, createOreCrackGeometry, createStoragePlinth, createWorkerPadGeometry, dungeonGlowMaterial, dungeonMaterial } from './dungeon/DungeonKit';
import { ParticleVfx, planBlasts } from './ParticleVfx';
import { StoneDebrisVfx, selectDebrisEvents, STONE_DEBRIS_LIMITS } from './StoneDebrisVfx';
import { TactileMotion, type ImpulseKind } from './TactileMotion';
import type { GameState, DropTarget, GameEvent, Entity } from '../game/GameState';
import { CONFIG } from '../game/config';
import { effectiveForwardSpeed, recoilDistances } from '../game/motion';
import { samplePath, PATH_LENGTH } from '../game/path';
import { createBarrel, createBomb, createRewind, createSlow, createBrake, createHalfSpeed, createTailBlast, disposePrimitive, makeWallGeometry } from './PrimitiveFactory';
import { createWorker, disposeSkeletonWorkerAsset, type WorkerVisual } from './SkeletonWorker';
import { viewConfig, mapPosition, unmapFieldPosition, placeZone, LANDSCAPE_LAYOUT, PORTRAIT_LAYOUT, beltX, fitCamera, type ViewZone, type Point, type ScreenPoint } from './Layout';

export type HitTarget = {kind:'entity'|'pad'|'slot'|'storage';id:string};
type EntityView = {kind:string;group:THREE.Group; worker?:WorkerVisual;label:HTMLDivElement;hit:HTMLDivElement};
type Effect = {active:boolean;age:number;life:number;x:number;y:number;z:number;vx:number;vy:number;vz:number;color:number;size:number;coin:boolean};
const resourceColors=CONFIG.stones.resources.map(r=>r.color);
const overlayTargets='.topbar button,.upgrade-button,.audio-menu:not([hidden]),.overlay:not([hidden]),.toast.visible';
const fieldBonusVisuals:Partial<Record<Entity['kind'],{create:()=>THREE.Group;label:string;color:string;background:string;description:string}>>={
  rewind:{create:createRewind,label:'⏪',color:'#074b5e',background:'#a7fff6',description:'Rewind bonus. Tap or drag onto the field to use.'},
  slow:{create:createSlow,label:'⏸',color:'#33277e',background:'#d7d0ff',description:'Pause snake bonus. Tap or drag onto the field to freeze the snake for five seconds.'},
  brake:{create:createBrake,label:'↓ 20%',color:'#54330b',background:'#ffcf7e',description:'Permanent slowdown: tap or drag onto the field. Current forward speed drops 20 percent, with a minimum speed. Acceleration continues.'},
  halfSpeed:{create:createHalfSpeed,label:'↓ 50%',color:'#164d2a',background:'#9df4aa',description:'Half-speed bonus. Tap or drag onto the field to permanently halve the current forward speed, even below the usual minimum. Future acceleration is unchanged.'},
  tailBlast:{create:createTailBlast,label:'✹ ½',color:'#681e30',background:'#ff9ba5',description:'Tail-half blast. Tap or drag onto the field to destroy half the rocks, rounded up, starting at the tail. The surviving front waits for new rocks to catch up.'},
};

export class SceneView {
  readonly renderer:THREE.WebGLRenderer; readonly scene=new THREE.Scene();
  readonly camera=new THREE.PerspectiveCamera(viewConfig.camera.fov,1,.1,100);
  readonly canvas:HTMLCanvasElement;
  private discardLabel:HTMLDivElement;private finishLabel:HTMLDivElement;private headLabel:HTMLDivElement;
  private labels:HTMLDivElement; private entities=new Map<string,EntityView>(); private pads=new Map<string,{mesh:THREE.Mesh;label:HTMLDivElement}>();
  private storage=new Map<string,{group:THREE.Group;material:THREE.MeshLambertMaterial;label:HTMLDivElement}>();
  private oreCracks:THREE.InstancedMesh[]=[];private rooms:THREE.Group[]=[];private carriers:THREE.InstancedMesh;private slotLabels=new Map<string,HTMLDivElement>();private stones:THREE.InstancedMesh[]=[]; private particles:THREE.InstancedMesh;private coins:THREE.InstancedMesh;private beltPhase=0;private flashes=new Map<string,number>();private effects:Effect[]=[];private effectCursor=0;
  private dummy=new THREE.Object3D();private color=new THREE.Color();private raycaster=new THREE.Raycaster();private plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  private vfx:ParticleVfx;private stoneDebris:StoneDebrisVfx;private previousStonePositions=new Map<string,Point & {resource:number}>();
  private dropPreview:DropTarget=null;
  private flights:{view:EntityView;from:THREE.Vector3;scale:THREE.Vector3;age:number}[]=[];
  private tactile=new TactileMotion();private pressed:HitTarget|null=null;
  private ripples:{mesh:THREE.Mesh;age:number;life:number}[]=[];private rippleCursor=0;
  private cameraBase=new THREE.Vector3();private shakeRemaining=0;private reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  private ring:THREE.Mesh; private targetRing:THREE.Mesh;private treads:THREE.InstancedMesh;private state:GameState|null=null;private lastWidth=0;private lastHeight=0;
  private pit:THREE.Group;private storageTray:THREE.Mesh;
  private trackPoints:Point[]=[];private landscape=false;private field=new THREE.Group();private belt=new THREE.Group();
  constructor(readonly shell:HTMLElement,private canDrop:(target:DropTarget)=>boolean=()=>false){
    this.canvas=document.createElement('canvas');this.canvas.setAttribute('aria-label','Stop the rock snake before the finish. Tap barrels, drag workers onto pads, and tap or drag cyan rewind, purple pause, amber 20% slowdown, green 50% slowdown, or red tail-half blast bonuses onto the field. Drag unwanted workers into the discard pit.');this.canvas.dataset.testid='game-canvas';
    const context=this.canvas.getContext('webgl2',{antialias:true,alpha:false});
    if(!context) throw new Error('WebGL 2 is unavailable. Please open this prototype in a recent browser with graphics acceleration enabled.');
    this.renderer=new THREE.WebGLRenderer({canvas:this.canvas,context,antialias:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,viewConfig.dprLimit));
    this.renderer.setClearColor(0x171c1c);this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.4;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;shell.append(this.canvas);
    this.labels=document.createElement('div');this.labels.className='labels';shell.append(this.labels);
    this.scene.add(new THREE.HemisphereLight(0xa9c9c1,0x21170e,.9));const key=new THREE.DirectionalLight(0xffc891,2.3);key.position.set(-5,12,6);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-11;key.shadow.camera.right=11;key.shadow.camera.top=12;key.shadow.camera.bottom=-12;key.shadow.camera.near=.5;key.shadow.camera.far=35;key.shadow.normalBias=.025;key.shadow.bias=-.0002;key.shadow.radius=2;this.scene.add(key);
    this.scene.add(this.field,this.belt);this.vfx=new ParticleVfx(this.scene);this.stoneDebris=new StoneDebrisVfx(this.scene);
    this.rooms=[createDungeonRoom({width:7.2,depth:12.7,centerZ:1.05,backZ:-5.3}),createDungeonRoom({width:17.004,depth:12.276,centerZ:1.8,backZ:-4.338})];
    // Local amber pools and cold green niches complement one bounded directional shadow map.
    this.rooms.forEach((room,i)=>{for(const side of [-1,1]){const glow=new THREE.PointLight(0xff932f,5,4.5,1);glow.position.set(side*(i?17.004:7.2)*.47,1.2,(i?-4.338:-5.3)+.64);room.add(glow);}const recess=new THREE.PointLight(0x37d996,2.8,4,1);recess.position.set(0,1,(i?-4.338:-5.3)+.4);room.add(recess);});
    this.rooms.forEach(room=>room.traverse(object=>{if(object instanceof THREE.Mesh&&object.material===dungeonMaterial){object.castShadow=true;object.receiveShadow=true;}}));
    this.scene.add(...this.rooms);
    const walls=new THREE.Mesh(makeWallGeometry(),dungeonMaterial);walls.castShadow=true;walls.receiveShadow=true;this.field.add(walls);
    // Physical timber sleepers and bronze rails follow the unchanged gameplay path.
    for(let d=0;d<=PATH_LENGTH;d+=.12)this.trackPoints.push(samplePath(d));
    this.trackPoints.push(samplePath(PATH_LENGTH));
    this.field.add(createTimberTrack(this.trackPoints,.72));
    const finish=samplePath(PATH_LENGTH);
    const portal=createGothicArch(1.05,.82);portal.position.set(finish.x+.22,0,finish.z);portal.rotation.y=Math.PI/2;this.field.add(portal);this.field.traverse(object=>{if(object instanceof THREE.Mesh){object.castShadow=true;object.receiveShadow=true;}});
    this.finishLabel=document.createElement('div');this.finishLabel.className='pad-label';this.finishLabel.dataset.marker='finish';this.finishLabel.textContent='FINISH';this.finishLabel.style.background='#624126';this.finishLabel.style.fontSize='10px';this.labels.append(this.finishLabel);
    // Storage and its worker-only discard pit have their own view-space bay.
    const pit=new THREE.Group();this.pit=pit;pit.position.set(CONFIG.discard.x,0,CONFIG.discard.z);
    const hole=new THREE.Mesh(new THREE.CircleGeometry(CONFIG.discard.radius,24),new THREE.MeshBasicMaterial({color:0x070d0a,side:THREE.DoubleSide}));hole.rotation.x=-Math.PI/2;hole.position.y=.018;pit.add(hole);
    const rim=new THREE.Mesh(new THREE.TorusGeometry(CONFIG.discard.radius+.045,.045,5,24),new THREE.MeshStandardMaterial({color:0xa5753e,metalness:.65,roughness:.55}));rim.rotation.x=-Math.PI/2;rim.position.y=.026;pit.add(rim);this.scene.add(pit);
    this.storageTray=new THREE.Mesh(createBeveledStoneGeometry(6.1,.06,1.35,0x45453f,.025),dungeonMaterial);this.storageTray.receiveShadow=true;this.storageTray.position.y=-.02;this.scene.add(this.storageTray);
    this.discardLabel=document.createElement('div');this.discardLabel.className='pad-label discard-label';this.discardLabel.dataset.marker='discard';this.discardLabel.innerHTML='<span aria-hidden="true"><span class="coin">●</span> ↑</span><small>Income +20%</small>';this.discardLabel.title='Discard or replace a worker: +20% rock income this run';this.discardLabel.setAttribute('aria-label',this.discardLabel.title);this.labels.append(this.discardLabel);
    this.headLabel=document.createElement('div');this.headLabel.className='pad-label';this.headLabel.dataset.marker='head';this.headLabel.textContent='HEAD';this.headLabel.style.background='#3a344b';this.headLabel.style.fontSize='9px';this.labels.append(this.headLabel);
    for(const landscape of [false,true]){const group=new THREE.Group();group.add(createConveyorFrame(landscape?9.1:6.9,1.1),createConveyorTunnels(landscape?3.7:2.664,landscape?4.5:3.4));this.belt.add(group);}this.belt.traverse(object=>{if(object instanceof THREE.Mesh){object.castShadow=true;object.receiveShadow=true;}});
    this.treads=new THREE.InstancedMesh(createConveyorTreadGeometry(.21,.98),dungeonMaterial,46);this.treads.receiveShadow=true;this.scene.add(this.treads);this.carriers=new THREE.InstancedMesh(new THREE.BoxGeometry(.68,.024,.82),new THREE.MeshLambertMaterial({color:0x31564a}),CONFIG.conveyor.count);this.carriers.receiveShadow=true;this.scene.add(this.carriers);
    for(let v=0;v<3;v++){const geometry=createOreGeometry(v);const mesh=new THREE.InstancedMesh(geometry,dungeonMaterial.clone(),200);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;this.stones.push(mesh);this.scene.add(mesh);const cracks=new THREE.InstancedMesh(createOreCrackGeometry(v),dungeonGlowMaterial,200);cracks.instanceMatrix=mesh.instanceMatrix;cracks.frustumCulled=false;this.oreCracks.push(cracks);this.scene.add(cracks);}
    this.particles=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshBasicMaterial({color:0xffffff}),viewConfig.maxEffects);this.particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.particles.frustumCulled=false;this.scene.add(this.particles);this.coins=new THREE.InstancedMesh(new THREE.CylinderGeometry(1,1,.18,10),new THREE.MeshLambertMaterial({color:0xffd66c}),viewConfig.maxEffects);this.coins.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.coins.frustumCulled=false;this.scene.add(this.coins);
    for(let i=0;i<viewConfig.maxEffects;i++)this.effects.push({active:false,age:0,life:0,x:0,y:0,z:0,vx:0,vy:0,vz:0,color:0,size:0,coin:false});
    this.ring=new THREE.Mesh(new THREE.RingGeometry(.98,1,64),new THREE.MeshBasicMaterial({color:0x8effc5,transparent:true,opacity:.8,side:THREE.DoubleSide,depthTest:false}));this.ring.rotation.x=-Math.PI/2;this.ring.visible=false;this.ring.renderOrder=20;this.scene.add(this.ring);
    this.targetRing=new THREE.Mesh(new THREE.RingGeometry(.56,.62,32),new THREE.MeshBasicMaterial({color:0x8effc5,transparent:true,opacity:.95,side:THREE.DoubleSide,depthTest:false}));this.targetRing.rotation.x=-Math.PI/2;this.targetRing.visible=false;this.targetRing.renderOrder=20;this.scene.add(this.targetRing);
    const rippleGeometry=new THREE.RingGeometry(.42,.47,32);
    for(let i=0;i<10;i++){const mesh=new THREE.Mesh(rippleGeometry,new THREE.MeshBasicMaterial({color:0x9effd4,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));mesh.rotation.x=-Math.PI/2;mesh.visible=false;this.scene.add(mesh);this.ripples.push({mesh,age:0,life:.4});}
    this.resize();
  }
  resize(){
    const rect=this.canvas.getBoundingClientRect(),w=rect.width,h=rect.height;
    if(w===this.lastWidth&&h===this.lastHeight)return;
    this.lastWidth=w;this.lastHeight=h;this.landscape=this.shell.clientWidth>this.shell.clientHeight;
    fitCamera(this.camera,w,h,this.landscape);this.cameraBase.copy(this.camera.position);
    this.field.rotation.y=this.landscape?Math.PI/2:0;this.field.scale.set(this.landscape?1:PORTRAIT_LAYOUT.fieldWidthScale,1,this.landscape?1:PORTRAIT_LAYOUT.fieldDepthScale);
    this.field.position.z=this.landscape?0:PORTRAIT_LAYOUT.fieldOffsetZ;
    this.field.position.x=this.landscape?LANDSCAPE_LAYOUT.fieldOffsetX:0;
    const layout=this.landscape?LANDSCAPE_LAYOUT:PORTRAIT_LAYOUT,pit=mapPosition(CONFIG.discard,this.landscape,'discard');
    this.pit.position.set(pit.x,0,pit.z);this.pit.scale.setScalar(this.landscape?1:1.25);this.storageTray.position.set(layout.storageCenterX,-.02,layout.storageZ);this.storageTray.scale.x=this.landscape?1:.68;
    this.belt.position.z=layout.beltZ;this.belt.scale.x=this.landscape?1.65:1;
    this.belt.children[0].visible=!this.landscape;this.belt.children[1].visible=this.landscape;
    this.rooms[0].visible=!this.landscape;this.rooms[1].visible=this.landscape;this.reset();this.renderer.setSize(w,h,false);
  }
  private mapped(point:Point,belt=false,zone?:ViewZone):Point{return mapPosition(point,this.landscape,zone??(belt?'belt':placeZone(point)));}
  project(point:Point,y=0,belt=false,zone?:ViewZone):ScreenPoint{const p=this.mapped(point,belt,zone);const v=new THREE.Vector3(p.x,y,p.z).project(this.camera);return{x:(v.x+1)*this.lastWidth/2,y:(1-v.y)*this.lastHeight/2};}
  world(clientX:number,clientY:number):Point|null{const rect=this.canvas.getBoundingClientRect();this.raycaster.setFromCamera(new THREE.Vector2((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1),this.camera);const v=new THREE.Vector3();return this.raycaster.ray.intersectPlane(this.plane,v)?unmapFieldPosition({x:v.x,z:v.z},this.landscape):null;}
  private insidePit(point:Point):boolean{const ground=this.mapped(point,false,'field'),pit=this.mapped(CONFIG.discard,false,'discard');return Math.hypot(ground.x-pit.x,ground.z-pit.z)<=CONFIG.discard.radius*(this.landscape?1:1.25);}
  private location(entityId:string):Point|null{const e=this.state?.entities[entityId];if(!e||!this.state||e.location.kind==='drag')return null;const ref=e.location;return(ref.kind==='pad'?this.state.pads:ref.kind==='storage'?this.state.storage:this.state.slots).find(p=>p.id===ref.id)??null;}
  private overUI(clientX:number,clientY:number):boolean{
    return [...this.shell.querySelectorAll<HTMLElement>(overlayTargets)].some(ui=>{const r=ui.getBoundingClientRect();return clientX>=r.left&&clientX<=r.right&&clientY>=r.top&&clientY<=r.bottom;});
  }
  // Screen-space capsule follows the whole figure, including its animated lift.
  private figureDistance(x:number,y:number,loc:Point,entity:Entity):number{
    const belt=entity.location.kind==='slot',view=this.entities.get(entity.id);
    const bottom=this.project(loc,view?.group.position.y??.14,belt);
    const top=this.project(loc,(view?.group.position.y??.14)+1.38*(view?.group.scale.y??(this.landscape?1:viewConfig.portraitHeroScale)),belt);
    const dx=top.x-bottom.x,dy=top.y-bottom.y,t=Math.max(0,Math.min(1,((x-bottom.x)*dx+(y-bottom.y)*dy)/(dx*dx+dy*dy||1)));
    return Math.hypot(x-bottom.x-t*dx,y-bottom.y-t*dy);
  }
  hit(clientX:number,clientY:number):HitTarget|null{
    if(!this.state||this.overUI(clientX,clientY))return null;
    const rect=this.canvas.getBoundingClientRect(),x=clientX-rect.left,y=clientY-rect.top;
    if(x<0||x>rect.width||y<0||y>rect.height)return null;
    const core:{target:HitTarget,d:number}[]=[],halo:{target:HitTarget,d:number}[]=[];
    for(const e of Object.values(this.state.entities)){
      const loc=this.location(e.id);if(!loc||(e.location.kind==='slot'&&!conveyorSlotExposed(loc.x)))continue;
      const p=this.project(loc,e.kind==='worker'?.40:e.location.kind==='storage'?.39:.27,e.location.kind==='slot');
      const d=e.kind==='worker'?this.figureDistance(x,y,loc,e):Math.hypot(x-p.x,y-p.y),candidate={target:{kind:'entity' as const,id:e.id},d};
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
    for(const p of this.state.slots){if(p.entityId||p.reserved||!conveyorSlotExposed(p.x))continue;const screen=this.project(p,.1,true),d=Math.hypot(x-screen.x,y-screen.y);if(d<=viewConfig.hitRadiusPx)slots.push({target:{kind:'slot',id:p.id},d});}
    return nearest(slots);
  }
  dropTarget(clientX:number,clientY:number,_touch=false):DropTarget{
    if(!this.state?.drag)return null;const bounds=this.canvas.getBoundingClientRect();if(clientX<bounds.left||clientX>bounds.right||clientY<bounds.top||clientY>bounds.bottom)return null;const entity=this.state.entities[this.state.drag.entityId];
    // UI and every storage stand take precedence over bonus activation. In
    // particular, an occupied/unaffordable stand returns an invalid storage
    // target rather than falling through to field/track consumption.
    for(const ui of this.shell.querySelectorAll<HTMLElement>(overlayTargets)){
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
    if(entity&&fieldBonusVisuals[entity.kind]){
      const rect=this.canvas.getBoundingClientRect();
      for(const pad of this.state.pads){const screen=this.project(pad,.1);if(Math.hypot(clientX-rect.left-screen.x,clientY-rect.top-screen.y)<=viewConfig.hitRadiusPx)return{kind:'pad',id:pad.id};}
      const point=this.world(clientX,clientY);if(!point)return null;
      const ground=this.mapped(point),beltZ=this.landscape?LANDSCAPE_LAYOUT.beltZ:PORTRAIT_LAYOUT.beltZ;
      if(Math.abs(ground.x)<=(this.landscape?7.6:3.5)&&Math.abs(ground.z-beltZ)<=.72)return null;
      return{kind:'field',...point};
    }
    if(entity?.kind==='bomb'){const rect=this.canvas.getBoundingClientRect();for(const slot of this.state.slots){if(!conveyorSlotExposed(slot.x))continue;const p=this.project(slot,.1,true);if(!slot.entityId&&Math.hypot(clientX-rect.left-p.x,clientY-rect.top-p.y)<=viewConfig.hitRadiusPx)return{kind:'slot',id:slot.id};}const p=this.world(clientX,clientY);return p?{kind:'track',...p}:null;}
    const rect=this.canvas.getBoundingClientRect();const x=clientX-rect.left,y=clientY-rect.top;const candidates:{target:DropTarget,d:number}[]=[],direct:typeof candidates=[];
    for(const kind of ['pad','slot'] as const)for(const p of kind==='pad'?this.state.pads:this.state.slots){
      if(kind==='slot'&&!conveyorSlotExposed(p.x))continue;
      const target={kind,id:p.id},other=p.entityId?this.state.entities[p.entityId]:null;
      const s=this.project(p,.1,kind==='slot');
      const d=other?.kind==='worker'?this.figureDistance(x,y,p,other):Math.hypot(x-s.x,y-s.y);
      // Purchase targets keep their original small core. Magnetism never spends coins.
      if(d<=viewConfig.hitRadiusPx+5)direct.push({target,d});
      if('unlocked' in p&&!p.unlocked)continue;
      if(d<=viewConfig.dropRadiusPx&&this.canDrop(target))candidates.push({target,d});
    }
    return (direct.length?direct:candidates).sort((a,b)=>a.d-b.d)[0]?.target??null;
  }
  private dropAction(entity?:Entity){
    const held=this.state?.drag?this.state.entities[this.state.drag.entityId]:null;
    if(held?.kind!=='worker'||entity?.kind!=='worker'||entity.location.kind==='drag'||!this.canDrop(entity.location))return '';
    return held.level===entity.level?'MERGE':entity.location.kind==='pad'&&held.level>entity.level?'REPLACE':'';
  }
  private emptyTargets(target:DropTarget,clear=false){
    for(const kind of ['pad','storage'] as const)for(const [id,v] of kind==='pad'?this.pads:this.storage){
      const p=(kind==='pad'?this.state?.pads:this.state?.storage)?.find(p=>p.id===id);
      const eligible=!clear&&!!p&&!p.entityId&&!p.reserved&&this.canDrop({kind,id});
      if(eligible)v.label.dataset.emptyTarget=target?.kind===kind&&target.id===id?'active':'ready';else delete v.label.dataset.emptyTarget;
    }
  }
  showDrop(target:DropTarget,valid:boolean,bombRadius:number){
    this.dropPreview=valid?target:null;this.emptyTargets(this.dropPreview);
    for(const [id,v] of this.entities){const e=this.state?.entities[id];v.hit.dataset.action=v.label.dataset.action=this.dropAction(e);v.hit.classList.toggle('merge-ready',!!(valid&&target&&'id' in target&&e?.kind==='worker'&&e.location.kind===target.kind&&e.location.id===target.id&&this.state?.drag&&this.state.entities[this.state.drag.entityId]?.kind==='worker'));}
    this.ring.visible=false;this.targetRing.visible=false;if(!target)return;
    const replacing=target.kind==='pad'&&this.dropAction(this.state?.entities[this.state.pads.find(p=>p.id===target.id)?.entityId??''])==='REPLACE';
    const color=valid?(replacing?0xffa544:0x8effb7):0xff8580;if(target.kind==='track'||target.kind==='field'){const p=this.mapped(target);this.ring.position.set(p.x,.08,p.z);const radius=target.kind==='field'?.55:bombRadius;this.ring.scale.set(radius*(this.landscape?1:PORTRAIT_LAYOUT.fieldWidthScale),radius*(this.landscape?1:PORTRAIT_LAYOUT.fieldDepthScale),1);(this.ring.material as THREE.MeshBasicMaterial).color.setHex(color);this.ring.visible=true;}
    else if(target.kind==='discard'){const p=this.mapped(CONFIG.discard,false,'discard');this.targetRing.position.set(p.x,.1,p.z);(this.targetRing.material as THREE.MeshBasicMaterial).color.setHex(color);this.targetRing.visible=true;}
    else {const p=(target.kind==='pad'?this.state?.pads:target.kind==='storage'?this.state?.storage:this.state?.slots)?.find(p=>p.id===target.id);if(p){const m=this.mapped(p,target.kind==='slot');this.targetRing.position.set(m.x,.1,m.z);(this.targetRing.material as THREE.MeshBasicMaterial).color.setHex(valid&&!p.entityId?0x6ccaff:color);this.targetRing.visible=true;}}
  }
  press(target:HitTarget|null){this.pressed=target;if(target)this.tactile.trigger(target.id,'press');}
  release(){this.pressed=null;}
  impulse(id:string,kind:ImpulseKind){this.tactile.trigger(id,kind);}
  private ripple(point:Point,color:number,life=.4){const r=this.ripples[this.rippleCursor++%this.ripples.length],p=this.mapped(point);r.age=0;r.life=life;r.mesh.position.set(p.x,.055,p.z);r.mesh.visible=true;(r.mesh.material as THREE.MeshBasicMaterial).color.setHex(color);}
  burst(x:number,z:number,color:number,count=10,large=false,coin=false){if(this.reducedMotion.matches)return;const zone:ViewZone=x===CONFIG.discard.x&&z===CONFIG.discard.z?'discard':CONFIG.storage.some(stand=>stand.x===x&&stand.z===z)?'storage':z===CONFIG.conveyor.z?'belt':'field';const p=this.mapped({x,z},false,zone);x=p.x;z=p.z;this.vfx.sparkle(x,z,color,count,large,coin);for(let i=0;i<count;i++){const e=this.effects[this.effectCursor++%this.effects.length];Object.assign(e,{active:true,age:0,life:large?.65:.42,x,y:.3,z,vx:(Math.random()-.5)*(large?3:1.5),vy:this.reducedMotion.matches?.5:1.4+Math.random()*1.4,vz:(Math.random()-.5)*(large?3:1.5),color,size:coin?.11:large?.12:.075,coin});}}
  private updateCameraShake(state:GameState,dt:number,events:GameEvent[]){
    // Always rebuild from the settled pose, so repeated bombs cannot accumulate drift.
    this.camera.position.copy(this.cameraBase);
    if(state.paused||state.gameOver||this.reducedMotion.matches){this.shakeRemaining=0;}
    else{
      if(events.some(event=>event.type==='bomb'||event.type==='tailBlast'))this.shakeRemaining=.28;
      if(this.shakeRemaining>0){
        this.shakeRemaining=Math.max(0,this.shakeRemaining-dt);
        const elapsed=.28-this.shakeRemaining,strength=.169*(this.shakeRemaining/.28)**2;
        this.camera.position.x+=Math.sin(elapsed*113)*strength;
        this.camera.position.y+=Math.sin(elapsed*157+.8)*strength*.65;
      }
    }
    // Labels, hit/drop projection and the render all use this same current camera.
    this.camera.updateMatrixWorld();
  }
  clearMergeTargets(){
    this.dropPreview=null;this.emptyTargets(null,true);
    for(const view of this.entities.values()){
      view.hit.classList.remove('merge-target','merge-ready');view.label.classList.remove('merge-target-label');
      delete view.hit.dataset.mergeTarget;delete view.hit.dataset.action;delete view.label.dataset.action;
    }
  }
  private mergeTargets(state:GameState):Set<string>{
    const targets=new Set<string>();
    const held=state.drag?state.entities[state.drag.entityId]:undefined;
    if(state.paused||state.gameOver||held?.kind!=='worker')return targets;
    for(const kind of ['pad','slot'] as const)for(const place of kind==='pad'?state.pads:state.slots){
      const other=place.entityId?state.entities[place.entityId]:undefined;
      if(place.reserved||!other||other.id===held.id||other.kind!=='worker')continue;
      if(other.location.kind!==kind||other.location.id!==place.id)continue;
      // Use the command's live legality, including source ownership and pad locks.
      if(this.canDrop({kind,id:place.id}))targets.add(other.id);
    }
    return targets;
  }
  private updateFlights(dt:number){
    const pit=this.mapped(CONFIG.discard,false,'discard');
    this.flights=this.flights.filter(f=>{
      f.age+=dt;const t=Math.min(1,f.age/(this.reducedMotion.matches?.15:.75)),g=f.view.group;
      g.position.set(f.from.x+(pit.x-f.from.x)*t,f.from.y*(1-t)+(this.reducedMotion.matches?0:Math.sin(t*Math.PI)*2),f.from.z+(pit.z-f.from.z)*t);
      g.scale.copy(f.scale).multiplyScalar(1-t*t);if(!this.reducedMotion.matches)g.rotation.z=t*Math.PI*2;
      if(t<1)return true;f.view.worker!.dispose();return false;
    });
  }
  private clearWorkers(){this.updateFlights(1);for(const [id,view] of this.entities)if(view.worker){view.worker.dispose();view.label.remove();view.hit.remove();this.entities.delete(id);}}
  reset(){this.clearWorkers();this.vfx.reset();this.stoneDebris.reset();this.previousStonePositions.clear();this.tactile.clear();this.pressed=null;for(const r of this.ripples)r.mesh.visible=false;this.shakeRemaining=0;this.camera.position.copy(this.cameraBase);this.camera.updateMatrixWorld();this.clearMergeTargets();this.beltPhase=0;this.flashes.clear();for(const e of this.effects)e.active=false;this.ring.visible=false;this.targetRing.visible=false;}
  sync(state:GameState,dt:number,dragPosition:Point|null,events:GameEvent[]){this.state=state;this.tactile.tick(dt);
    for(const e of events){
      if(e.replaced&&e.entityId){const v=this.entities.get(e.entityId);if(v?.worker){this.flights.push({view:v,from:v.group.position.clone(),scale:v.group.scale.clone(),age:0});v.label.remove();v.hit.remove();this.entities.delete(e.entityId);}}
      if((e.type==='open'||e.type==='merge')&&e.entityId)this.tactile.trigger(e.entityId,e.type);
      if(e.type==='hit'&&e.entityId)this.tactile.trigger(e.entityId,'hit');
      if(e.type==='purchase'){const place=[...state.pads,...state.storage].find(p=>p.x===e.x&&p.z===e.z);if(place)this.tactile.trigger(place.id,'purchase');}
      const colors:Partial<Record<GameEvent['type'],number>>={merge:0x8effc5,purchase:0xffd26a,bomb:0xffc05d,rewind:0x74f8f0,slow:0xaaa1ff,brake:0xffc260,halfSpeed:0x83ec94,tailBlast:0xff667b};
      if(colors[e.type])this.ripple(e,colors[e.type]!,e.type==='merge'?.5:.4);
    }
    this.updateFlights(dt);this.updateCameraShake(state,dt,events);for(const[id,time]of this.flashes){if(time<=dt)this.flashes.delete(id);else this.flashes.set(id,time-dt);}for(const e of events)if(e.type==='hit'&&e.stoneId)this.flashes.set(e.stoneId,.16);
    // Read-only render mirrors support browser verification without a game-control hook.
    const ordered=[...state.stones].sort((a,b)=>a.distance-b.distance);
    const hasGap=ordered.some((stone,i)=>i>0&&stone.distance-ordered[i-1].distance>CONFIG.stones.spacing+1e-9);
    const motion=state.slowRemaining>0?'frozen':state.rewindTarget!==null?'rewind':state.tailWaitingIds.length>0?'tail-wait':hasGap?(state.gapRecoveryRemaining>1e-9?'gap-pause':'gap-retract'):'forward';
    const slowFactor=state.slowRemaining>0?0:1;
    const advancingSpeed=effectiveForwardSpeed(state.difficultyTime,state.permanentSpeedReduction,CONFIG,state.minimumForwardSpeed)*slowFactor;
    const speed=state.paused||state.gameOver||state.slowRemaining>0?0:state.headSpeed;
    this.canvas.dataset.speedReduction=String(state.permanentSpeedReduction);this.canvas.dataset.forwardSpeed=String(advancingSpeed);this.canvas.dataset.time=String(state.time);this.canvas.dataset.motion=motion;this.canvas.dataset.speed=String(speed);
    const recoils=recoilDistances(ordered,PATH_LENGTH);const rendered=new Map(ordered.map((s,i)=>[s.id,s.frozenRenderDistance??s.waitingRenderDistance??recoils[i]]));
    const stoneMarkers:{id:string;distance:number;x:number;y:number;bounce:number;renderDistance:number}[]=[];
    const counts=[0,0,0];for(const stone of state.stones){const renderDistance=rendered.get(stone.id)??stone.distance,bounce=renderDistance-stone.distance,path=samplePath(renderDistance),ground=this.project(path,0);stoneMarkers.push({id:stone.id,distance:stone.distance,x:ground.x,y:ground.y,bounce,renderDistance});if(stone.distance<0)continue;const mesh=this.stones[stone.variant%3],i=counts[stone.variant%3]++;const p=this.mapped(path);this.dummy.position.set(p.x,.27+bounce*.2,p.z);const impact=this.reducedMotion.matches||state.slowRemaining>0?0:(this.flashes.get(stone.id)??0)/.16;this.dummy.position.y+=Math.sin(impact*Math.PI)*.035;this.dummy.rotation.set(.15*Math.sin(stone.distance)+Math.sin(impact*Math.PI*2)*.13,path.angle+stone.variant+(this.landscape?Math.PI/2:0),.2);this.dummy.scale.setScalar(1);this.dummy.updateMatrix();mesh.setMatrixAt(i,this.dummy.matrix);this.color.setHex(resourceColors[stone.resource]).lerp(new THREE.Color(0xffffff),.8);if(this.flashes.has(stone.id))this.color.lerp(new THREE.Color(0xffffff),.7);else if(stone.hp<stone.maxHp)this.color.lerp(new THREE.Color(0xffffff),.12);mesh.setColorAt(i,this.color);}
    this.canvas.dataset.stones=JSON.stringify(stoneMarkers);
    for(let i=0;i<3;i++){this.stones[i].count=counts[i];this.oreCracks[i].count=counts[i];this.stones[i].instanceMatrix.needsUpdate=true;if(this.stones[i].instanceColor)this.stones[i].instanceColor!.needsUpdate=true;}
    // The upgrade belongs to the storage bay, so its hit box follows the camera.
    const upgrade=this.shell.querySelector<HTMLElement>('[data-worker-upgrade]');
    if(upgrade){
      const x=this.landscape?2.7:1.3,z=this.landscape?LANDSCAPE_LAYOUT.storageZ:PORTRAIT_LAYOUT.storageZ;
      const p=this.project(unmapFieldPosition({x,z},this.landscape),.1),edge=this.project(unmapFieldPosition({x:x+.5,z},this.landscape),.1);
      upgrade.style.left=`${p.x+this.canvas.offsetLeft}px`;upgrade.style.top=`${p.y+this.canvas.offsetTop}px`;upgrade.style.setProperty('--size',`${Math.max(44,Math.min(84,2*(edge.x-p.x)))}px`);
    }
    const discardScreen=this.project(CONFIG.discard,.04,false,'discard');
    this.discardLabel.style.transform='translate(-50%,-50%)';this.discardLabel.style.left=`${discardScreen.x}px`;this.discardLabel.style.top=`${discardScreen.y}px`;this.discardLabel.classList.toggle('active',state.drag!==null&&state.entities[state.drag.entityId]?.kind==='worker');
    const finish=samplePath(PATH_LENGTH),finishScreen=this.project({x:finish.x+.6,z:finish.z},.25);this.finishLabel.style.left=`${finishScreen.x}px`;this.finishLabel.style.top=`${finishScreen.y}px`;
    const head=state.stones.reduce<(typeof state.stones)[number]|null>((a,b)=>!a||b.distance>a.distance?b:a,null);this.headLabel.dataset.distance=head?String(head.distance):'';this.headLabel.hidden=true;if(head&&head.distance>=0){const screen=this.project(samplePath(head.distance),.95);this.headLabel.style.left=`${screen.x}px`;this.headLabel.style.top=`${screen.y}px`;}
    if(!state.paused&&!state.gameOver)this.beltPhase+=dt*CONFIG.conveyor.speed;for(let i=0;i<46;i++){const x=-5.175+((i*.225-this.beltPhase%10.35+10.35)%10.35),p=this.mapped({x,z:CONFIG.conveyor.z},true);this.dummy.position.set(p.x,.132,p.z);this.dummy.rotation.set(0,0,0);this.dummy.scale.set((beltX(x+.1,this.landscape)-beltX(x-.1,this.landscape))/.2,1,1);this.dummy.updateMatrix();this.treads.setMatrixAt(i,this.dummy.matrix);}this.treads.instanceMatrix.needsUpdate=true;
    // A carrier belongs to visible cargo. Vacated slots must not leave a container
    // behind; show their drop affordance only while a worker or bomb is in hand.
    const dragged=state.drag?state.entities[state.drag.entityId]:undefined;
    const showSlotTargets=dragged?.kind==='worker'||dragged?.kind==='bomb';
    let carrierCount=0;
    for(const slot of state.slots){
      const cargo=slot.entityId?state.entities[slot.entityId]:undefined;
      if(cargo?.location.kind==='slot'&&cargo.location.id===slot.id&&Math.abs(slot.x)<4.4){const p=this.mapped(slot,true);this.dummy.position.set(p.x,.145,p.z);this.dummy.rotation.set(0,0,0);this.dummy.scale.setScalar(1);this.dummy.updateMatrix();this.carriers.setMatrixAt(carrierCount++,this.dummy.matrix);}
      let label=this.slotLabels.get(slot.id);if(!label){label=document.createElement('div');label.className='slot-label';label.dataset.slot=slot.id;label.textContent='＋';label.setAttribute('aria-label','Empty conveyor drop slot');this.labels.append(label);this.slotLabels.set(slot.id,label);}
      label.dataset.entityId=slot.entityId??'';label.dataset.reserved=String(slot.reserved);
      const isSource=state.drag?.source.kind==='slot'&&state.drag.source.id===slot.id;
      label.hidden=!conveyorSlotExposed(slot.x)||!showSlotTargets||!!slot.entityId||(slot.reserved&&!isSource);
      const screen=this.project(slot,.2,true);label.style.left=`${screen.x}px`;label.style.top=`${screen.y}px`;
    }
    this.carriers.count=carrierCount;this.carriers.instanceMatrix.needsUpdate=true;
    for(const [id,view]of this.entities)if(!state.entities[id]||state.entities[id].kind!==view.kind){if(view.worker)view.worker.dispose();else disposePrimitive(view.group);view.label.remove();view.hit.remove();this.entities.delete(id);}
    const mergeTargets=this.mergeTargets(state);
    for(const entity of Object.values(state.entities)){
      const bonus=fieldBonusVisuals[entity.kind];
      let v=this.entities.get(entity.id);
      if(!v){
        const worker=entity.kind==='worker'?createWorker():undefined;
        const group=worker?.group??bonus?.create()??(entity.kind==='barrel'?createBarrel():createBomb());
        group.traverse(object=>{if(object instanceof THREE.Mesh){object.castShadow=true;object.receiveShadow=true;}});
        const label=document.createElement('div');label.className=entity.kind==='worker'?'entity-label':'barrel-label';
        const hit=document.createElement('div');hit.className='entity-target';hit.dataset.entity=entity.id;hit.dataset.kind=entity.kind;
        if(bonus){label.style.color=bonus.color;label.style.background=bonus.background;label.style.borderRadius='7px';label.style.padding='0 3px';label.setAttribute('aria-label',bonus.description);label.title=bonus.description;hit.setAttribute('aria-label',bonus.description);}
        this.labels.append(label,hit);this.scene.add(group);v={kind:entity.kind,group,worker,label,hit};this.entities.set(entity.id,v);
      }
      const mergeTarget=mergeTargets.has(entity.id);
      v.hit.dataset.action=v.label.dataset.action=this.dropAction(entity);
      v.hit.classList.toggle('merge-target',mergeTarget);v.label.classList.toggle('merge-target-label',mergeTarget);
      if(mergeTarget)v.hit.dataset.mergeTarget='true';else delete v.hit.dataset.mergeTarget;
      v.hit.dataset.locationKind=entity.location.kind;v.hit.dataset.locationId=entity.location.kind==='drag'?'':entity.location.id;
      const loc=entity.location.kind==='drag'?dragPosition:this.location(entity.id);if(!loc){v.group.visible=false;v.label.hidden=true;v.hit.hidden=true;continue;}v.group.visible=entity.location.kind!=='slot'||Math.abs(loc.x)<4.4;const covered=entity.location.kind==='slot'&&!conveyorSlotExposed(loc.x);v.label.hidden=covered;v.hit.hidden=covered;const mapped=this.mapped(loc,entity.location.kind==='slot');v.group.position.set(mapped.x,entity.location.kind==='slot'?.14:entity.location.kind==='drag'?.45:entity.location.kind==='storage'?.26:.1,mapped.z);
      if(entity.kind==='worker'){v.worker!.setLevel(entity.level);v.worker!.setAction(entity.mining.phase,entity.location.kind==='pad'&&(entity.mining.phase>0||entity.mining.targetId!==null),dt,this.reducedMotion.matches);v.label.textContent=String(entity.level);v.hit.dataset.level=String(entity.level);const stone=entity.mining.targetId?state.stones.find(s=>s.id===entity.mining.targetId):null;const target=stone?samplePath(stone.distance):null;const aim=target?this.mapped(target):null;v.group.rotation.y=aim?Math.atan2(aim.x-mapped.x,aim.z-mapped.z):0;}
      else if(entity.kind==='barrel'){v.label.textContent=entity.content==='worker'?'✦':'?';}else v.label.textContent=bonus?.label??'';
      const pose=this.tactile.pose(entity.id,this.reducedMotion.matches),held=entity.location.kind==='drag',pressed=this.pressed?.id===entity.id&&!held;
      const holdScale=(held?1.09:1)*(entity.kind==='worker'&&!this.landscape?viewConfig.portraitHeroScale:1);v.group.scale.set(pose.x*holdScale,pose.y*holdScale*(pressed&&!this.reducedMotion.matches?.94:1),pose.x*holdScale);
      v.group.position.y+=pose.lift;v.group.rotation.z=pose.tilt;
      v.hit.dataset.feedback=this.tactile.kind(entity.id)??(held?'held':'');
      // Keep worker level badges above the helmet through pickup scale and drag lift.
      const h=this.project(loc,entity.kind==='worker'?.4:entity.location.kind==='storage'?.39:.27,entity.location.kind==='slot');v.hit.style.left=`${h.x}px`;v.hit.style.top=`${h.y}px`;const p=this.project(loc,entity.kind==='worker'?v.group.position.y+1.38*v.group.scale.y:entity.kind==='barrel'?.80:entity.location.kind==='storage'?1.02:.9,entity.location.kind==='slot');v.label.style.left=`${p.x}px`;const stagger=!this.landscape&&bonus&&entity.location.kind==='slot'&&Number(entity.location.id.split('-').pop())%2?18:0;v.label.style.top=`${p.y-stagger}px`;
    }
    for(const pad of state.pads){let v=this.pads.get(pad.id);if(!v){const mesh=new THREE.Mesh(createWorkerPadGeometry(),dungeonMaterial.clone());mesh.position.set(pad.x,.025,pad.z);mesh.castShadow=true;mesh.receiveShadow=true;this.scene.add(mesh);const label=document.createElement('div');label.dataset.pad=pad.id;this.labels.append(label);v={mesh,label};this.pads.set(pad.id,v);}const mapped=this.mapped(pad);v.mesh.position.set(mapped.x,.025,mapped.z);const pose=this.tactile.pose(pad.id,this.reducedMotion.matches);v.mesh.scale.set(pose.x,pose.y,pose.x);const m=v.mesh.material as THREE.MeshStandardMaterial;m.color.setHex(pad.unlocked?0xffffff:0x989184);v.label.dataset.unlocked=String(pad.unlocked);v.label.dataset.entityId=pad.entityId??'';v.label.dataset.reserved=String(pad.reserved);v.label.className=`pad-label ${pad.unlocked?'open':state.coins>=pad.price?'affordable':''}`;v.label.textContent=pad.unlocked?(pad.entityId?'':'＋ WORK'): `${pad.price} ●`;v.label.hidden=pad.unlocked&&!!pad.entityId;const p=this.project(pad,.19);v.label.style.left=`${p.x}px`;v.label.style.top=`${p.y}px`;}
    for(const stand of state.storage){
      let v=this.storage.get(stand.id);
      if(!v){
        const group=createStoragePlinth(),material=new THREE.MeshLambertMaterial({color:0x736447,flatShading:true});
        const base=new THREE.Mesh(new THREE.CylinderGeometry(.35,.35,.018,8),material);base.position.y=.237;group.add(base);

        group.traverse(object=>{if(object instanceof THREE.Mesh){object.castShadow=true;object.receiveShadow=true;}});this.scene.add(group);const label=document.createElement('div');label.dataset.storage=stand.id;this.labels.append(label);
        v={group,material,label};this.storage.set(stand.id,v);
      }
      const point=this.mapped(stand);v.group.position.set(point.x,0,point.z);
      const pose=this.tactile.pose(stand.id,this.reducedMotion.matches);v.group.scale.set(pose.x,pose.y,pose.x);
      const occupied=!!stand.entityId||stand.reserved;
      v.material.color.setHex(stand.unlocked?(occupied?0x436c55:0x51886a):state.coins>=stand.price?0xc5a35c:0x514c42);
      v.label.className=`pad-label storage-label ${stand.unlocked?'open':state.coins>=stand.price?'affordable':''}`;
      v.label.dataset.unlocked=String(stand.unlocked);v.label.dataset.entityId=stand.entityId??'';v.label.dataset.reserved=String(stand.reserved);
      v.label.textContent=stand.unlocked?(occupied?'':'＋'):`${stand.price} ●`;
      v.label.setAttribute('aria-label',stand.unlocked?(occupied?'Occupied bonus storage':'Empty bonus storage'):`Buy bonus storage for ${stand.price} coins`);
      const screen=this.project(stand,.04);v.label.style.left=`${screen.x}px`;v.label.style.top=`${screen.y+17}px`;
    }
    this.emptyTargets(this.dropPreview);
    const blast=events.find(event=>event.type==='bomb'||event.type==='tailBlast');
    if(!this.reducedMotion.matches&&!state.paused&&!state.gameOver&&!document.hidden){
      for(const effect of planBlasts(events,this.previousStonePositions)){const p=this.mapped(effect.point);this.vfx.explosion(p.x,p.z,effect.strength,effect.secondary);}
    }
    if(!this.reducedMotion.matches&&!state.paused&&!state.gameOver&&!document.hidden){
      const debrisEvents=selectDebrisEvents(events,this.previousStonePositions),budget=Math.floor(STONE_DEBRIS_LIMITS.chunks/Math.max(1,debrisEvents.length));
      for(const e of debrisEvents){
        const previous=this.previousStonePositions.get(e.stoneId!)!;
        const p=this.mapped(previous,false,'field');
        this.stoneDebris.crumble(p.x,p.z,resourceColors[previous.resource],!!blast,budget);
      }
    }
    for(const e of events){
      if(state.paused||state.gameOver||document.hidden)break;
      // Destruction uses material-colored solid rubble; coins and hit feedback stay separate.
      if(e.type==='hit'&&!this.reducedMotion.matches){const p=this.mapped(e,false,'field');this.vfx.oreSparks(p.x,p.z,3);}
      else if(e.type==='merge')this.burst(e.x,e.z,0x76ffc9,18,true);
      else if(e.type==='open')this.burst(e.x,e.z,0xdedbb5,5);
      else if(e.type==='rewind')this.burst(e.x,e.z,0x74f8f0,24,true);
      else if(e.type==='slow')this.burst(e.x,e.z,0xaaa1ff,18,true);
      else if(e.type==='brake')this.burst(e.x,e.z,0xffc260,18,true);
      else if(e.type==='halfSpeed')this.burst(e.x,e.z,0x83ec94,24,true);
      else if(e.type==='discard')this.burst(e.x,e.z,0x996b68,5);
    }
    this.previousStonePositions.clear();for(const stone of state.stones){const distance=rendered.get(stone.id)??stone.distance;if(stone.distance>=0)this.previousStonePositions.set(stone.id,{...samplePath(distance),resource:stone.resource});}
    this.stoneDebris.update(dt,this.reducedMotion.matches,state.paused||state.gameOver||document.hidden);
    this.canvas.dataset.stoneDebris=String(this.stoneDebris.metrics().stoneDebris);
    this.vfx.update(dt,this.camera,this.landscape,this.reducedMotion.matches,state.paused||state.gameOver||document.hidden);
    this.canvas.dataset.vfxParticles=String(this.vfx.metrics().vfxParticles);
    if(this.reducedMotion.matches)for(const e of this.effects)e.active=false;
    let count=0,coinCount=0;for(const e of this.effects){if(!e.active)continue;e.age+=dt;if(e.age>=e.life){e.active=false;continue;}e.x+=e.vx*dt;e.y+=e.vy*dt;e.z+=e.vz*dt;e.vy-=8*dt;this.dummy.position.set(e.x,e.y,e.z);this.dummy.scale.setScalar(e.size*(1-e.age/e.life));this.dummy.rotation.set(e.coin?Math.PI/2:e.age*5,e.age*6,e.age*3);this.dummy.updateMatrix();if(e.coin)this.coins.setMatrixAt(coinCount++,this.dummy.matrix);else{this.particles.setMatrixAt(count,this.dummy.matrix);this.particles.setColorAt(count++,this.color.setHex(e.color));}}this.coins.count=coinCount;this.coins.instanceMatrix.needsUpdate=true;this.particles.count=count;this.particles.instanceMatrix.needsUpdate=true;if(this.particles.instanceColor)this.particles.instanceColor.needsUpdate=true;
    for(const r of this.ripples){if(!r.mesh.visible)continue;r.age+=dt;const t=Math.min(1,r.age/r.life);r.mesh.visible=t<1;r.mesh.scale.setScalar(this.reducedMotion.matches?1:1+t*1.3);(r.mesh.material as THREE.MeshBasicMaterial).opacity=(1-t)*.65;}
    this.renderer.render(this.scene,this.camera);
  }
  coinTransferPoint(event:GameEvent){const p=event.type==='destroy'&&event.stoneId?this.previousStonePositions.get(event.stoneId)??event:event;return this.project(p,event.type==='destroy'?.4:.15,false,event.type==='destroy'?'field':CONFIG.storage.some(s=>s.x===event.x&&s.z===event.z)?'storage':'field');}
  dispose(){this.clearWorkers();disposeSkeletonWorkerAsset();this.vfx.dispose();this.stoneDebris.dispose();}
  metrics(){return{...this.vfx.metrics(),...this.stoneDebris.metrics(),calls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures,effects:this.particles.count+this.coins.count};}
}
