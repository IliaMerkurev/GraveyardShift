import { CONFIG } from '../game/config';
// Camera and input settings are prototype assumptions, not measurements of the reference.
export const viewConfig = {
  camera: { fov: CONFIG.camera.fov, target:CONFIG.camera.target, direction:CONFIG.camera.position, margin:CONFIG.camera.margin },
  dprLimit: CONFIG.visual.pixelRatio, dragThresholdPx:CONFIG.input.dragThreshold, hitRadiusPx:CONFIG.input.hitRadiusPx, touchLiftPx:CONFIG.input.touchLiftPx,
  floor: { width: 10.2, depth: 14.1 }, maxEffects: CONFIG.visual.maxEffects
} as const;
export interface Point {x:number;z:number}
export interface ScreenPoint {x:number;y:number}
