import * as THREE from 'three';
import { CONFIG } from '../game/config';
// Camera and input settings are prototype assumptions, not measurements of the reference.
export const viewConfig = {
  camera: { fov: CONFIG.camera.fov, target:CONFIG.camera.target, direction:CONFIG.camera.position, margin:CONFIG.camera.margin },
  dprLimit: CONFIG.visual.pixelRatio, dragThresholdPx:CONFIG.input.dragThreshold, hitRadiusPx:CONFIG.input.hitRadiusPx, pickupRadiusPx:CONFIG.input.pickupRadiusPx, touchLiftPx:CONFIG.input.touchLiftPx,
  floor: { width: 7.8, depth: 19.8 }, maxEffects: CONFIG.visual.maxEffects
} as const;
export interface Point {x:number;z:number}
export interface ScreenPoint {x:number;y:number}

/** Scene placement is independent of game-state coordinates. Drag points always use field space. */
export type ViewZone = 'field' | 'belt' | 'storage' | 'discard';
export const LANDSCAPE_LAYOUT = { fieldOffsetX: 0, storageCenterX: -1.2, storageSpacing: 2.4, storageZ: 4.25, pitX: 4.2, pitZ: 4.25, beltZ: 5.85, cameraTargetZ: 2.2 } as const;
export const PORTRAIT_LAYOUT = { fieldWidthScale:.9, fieldDepthScale:.6, storageCenterX:-.65, storageSpacing:1.3, storageZ:4.4, pitX:2.15, pitZ:4.4, beltZ:6.15 } as const;
/** Compress only the covered transit, keeping the working belt spacing generous. */
export function beltX(x:number,landscape:boolean):number{
  const a=Math.abs(x),inner=landscape?3.7:2.664,outer=landscape?4.5:3.4;
  return Math.sign(x)*(a<=3.7?a*inner/3.7:inner+(a-3.7)*(outer-inner)/1.48)*(landscape?1.65:1);
}
export function fitCamera(camera:THREE.PerspectiveCamera,width:number,height:number,landscape:boolean){
  const direction=new THREE.Vector3(...(landscape?CONFIG.camera.position:[0,20,12] as const)).normalize();
  const target=new THREE.Vector3(0,0,landscape?2.2:1);
  const right=new THREE.Vector3(1,0,0),up=new THREE.Vector3().crossVectors(direction,right).normalize();
  // A flatter perspective uses the back of the room without shrinking its targets.
  const fov=14,padding=10,tan=Math.tan(THREE.MathUtils.degToRad(fov)/2);
  const tanY=tan*Math.max(.1,1-2*padding/height),tanX=tan*width/height*Math.max(.1,1-2*padding/width);
  // Separate boxes avoid the empty upper corners of a full-room bounding box.
  const boxes=landscape?[
    [-7.5,5.5,-3.25,3.25,.65],[-4.3,4.75,3.65,4.9,1.7],[-7.6,7.6,5.05,6.65,1.65]
  ]:[[-2.95,2.95,-4.6,3.4,.65],[-2.55,2.7,3.75,5.05,1.7],[-3.5,3.5,5.35,6.95,1.65]];
  for(const pad of CONFIG.pads){const p=mapPosition(pad,landscape);boxes.push([p.x-.5,p.x+.5,p.z-.5,p.z+.5,1.7]);}
  let fit=0;
  for(const [left,rightX,back,front,top] of boxes)for(const x of [left,rightX])for(const y of [0,top])for(const z of [back,front]){
    const p=new THREE.Vector3(x,y,z).sub(target),depth=p.dot(direction);
    fit=Math.max(fit,Math.abs(p.dot(right))/tanX+depth,Math.abs(p.dot(up))/tanY+depth);
  }
  camera.fov=fov;camera.far=Math.max(100,fit+30);camera.aspect=width/height;camera.position.copy(target).addScaledVector(direction,fit);camera.lookAt(target);camera.updateProjectionMatrix();camera.updateMatrixWorld();
}
export function mapPosition(point:Point,landscape:boolean,zone:ViewZone='field'):Point{
  if(zone==='belt')return{x:beltX(point.x,landscape),z:landscape?LANDSCAPE_LAYOUT.beltZ:PORTRAIT_LAYOUT.beltZ};
  if(!landscape){
    if(zone==='storage')return{x:PORTRAIT_LAYOUT.storageCenterX+point.x/1.8*PORTRAIT_LAYOUT.storageSpacing,z:PORTRAIT_LAYOUT.storageZ};
    if(zone==='discard')return{x:PORTRAIT_LAYOUT.pitX,z:PORTRAIT_LAYOUT.pitZ};
    return{x:point.x*PORTRAIT_LAYOUT.fieldWidthScale,z:point.z*PORTRAIT_LAYOUT.fieldDepthScale};
  }
  if(zone==='storage')return{x:LANDSCAPE_LAYOUT.storageCenterX+point.x/1.8*LANDSCAPE_LAYOUT.storageSpacing,z:LANDSCAPE_LAYOUT.storageZ};
  if(zone==='discard')return{x:LANDSCAPE_LAYOUT.pitX,z:LANDSCAPE_LAYOUT.pitZ};
  return{x:point.z+LANDSCAPE_LAYOUT.fieldOffsetX,z:-point.x};
}
export function unmapFieldPosition(point:Point,landscape:boolean):Point{
  return landscape?{x:-point.z,z:point.x-LANDSCAPE_LAYOUT.fieldOffsetX}:{x:point.x/PORTRAIT_LAYOUT.fieldWidthScale,z:point.z/PORTRAIT_LAYOUT.fieldDepthScale};
}
export function placeZone(point:Point & {id?:string}):ViewZone{
  return 'id' in point&&typeof point.id==='string'&&point.id.startsWith('storage-')?'storage':'field';
}
