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
export const LANDSCAPE_LAYOUT = { fieldOffsetX: 0, storageCenterX: -1.2, storageSpacing: 2.4, storageZ: 4.7, pitX: 4.2, pitZ: 4.7, beltZ: 6.65, cameraTargetZ: 2.2 } as const;
export function mapPosition(point:Point,landscape:boolean,zone:ViewZone='field'):Point{
  if(!landscape)return point;
  if(zone==='belt')return{x:point.x*2,z:LANDSCAPE_LAYOUT.beltZ};
  if(zone==='storage')return{x:LANDSCAPE_LAYOUT.storageCenterX+point.x/1.8*LANDSCAPE_LAYOUT.storageSpacing,z:LANDSCAPE_LAYOUT.storageZ};
  if(zone==='discard')return{x:LANDSCAPE_LAYOUT.pitX,z:LANDSCAPE_LAYOUT.pitZ};
  return{x:point.z+LANDSCAPE_LAYOUT.fieldOffsetX,z:-point.x};
}
export function unmapFieldPosition(point:Point,landscape:boolean):Point{
  return landscape?{x:-point.z,z:point.x-LANDSCAPE_LAYOUT.fieldOffsetX}:point;
}
export function placeZone(point:Point & {id?:string}):ViewZone{
  return 'id' in point&&typeof point.id==='string'&&point.id.startsWith('storage-')?'storage':'field';
}
