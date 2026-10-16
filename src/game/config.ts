/** All prototype balance and spatial assumptions live here, not in the renderer. */
export interface GameConfig {
  seed: number;
  simulation: { fixedStep: number; maxDelta: number; maxEvents: number };
  economy: { initialCoins: number; workerUpgradeBaseCost: number };
  path: { left: number; right: number; runs: readonly number[]; bendRadius: number };
  stones: {
    initialCount: number; maxCount: number; speed: number; spacing: number; startFraction: number; acceleration: number; accelerationGrowth: number; maxSpeed: number; gapDelay: number; retractSpeed: number; attraction: number; bounceDuration: number; bounceDistance: number; rewindDuration: number; rewindBeforeFirstBend: number;
    resources: readonly { color: number; hp: number; reward: number }[];
  };
  conveyor: {
    count: number; left: number; right: number; z: number; speed: number; initialLeft?:number;
    spawnInterval: number; starter: readonly ('worker' | 'bomb' | 'rewind' | 'slow' | 'brake' | 'halfSpeed' | 'tailBlast')[];
    workerWeight: number; bombWeight: number; rewindWeight: number; brakeWeight: number; halfSpeedWeight: number; tailBlastWeight: number;
  };
  pads: readonly { x: number; z: number; price: number }[];
  storage: readonly { x: number; z: number; price: number }[];
  mining: { radius: number; period: number; speedGrowth: number; minPeriod: number; impactPhase: number; damageByLevel: readonly number[]; damageGrowth: number };
  slow: { duration: number };
  brake: { reductionFraction: number; minimumBaseFraction: number };
  discard: { x: number; z: number; radius: number };
  bomb: { radius: number; trackTolerance: number };
  visual: { helmetColors: readonly number[]; stoneRadius: number; maxEffects: number; pixelRatio: number };
  input: { dragThreshold: number; targetRadius: number; touchLift: number; hitRadiusPx: number; pickupRadiusPx: number; touchLiftPx: number };
  camera: { fov: number; near: number; far: number; position: readonly [number, number, number]; target: readonly [number, number, number]; margin:number; frameWidth:number; frameDepth:number; landscapeWidth:number; landscapeDepth:number; portraitBounds: { left:number; right:number; back:number; front:number; height:number; targetZ:number; paddingPx:number } };
}

export const CONFIG: GameConfig = {
  seed: 0x726f636b,
  simulation: { fixedStep: 1 / 60, maxDelta: 0.1, maxEvents: 256 },
  economy: { initialCoins: 0, workerUpgradeBaseCost: 50 },
  path: { left: -1.3, right: 1.3, runs: [-7, -4, -1, 2, 5], bendRadius: 1.5 },
  stones: {
    initialCount: 65, maxCount: 200, speed: 0.34, spacing: 0.245, startFraction: 0.5, acceleration: 0.00125, accelerationGrowth: 0.15, maxSpeed: 1_000_000,
    gapDelay: 0.35, retractSpeed: 3, attraction: 5, bounceDuration: 0.24, bounceDistance: 0.1, rewindDuration: 1.2,
    // Owner-marked point: 0.25 path units before the first bend (distance 2.35).
    rewindBeforeFirstBend: 0.25,
    resources: [
      { color: 0x76cf9b, hp: 3, reward: 5 },
      { color: 0x60b4e2, hp: 5, reward: 8 },
      { color: 0xd295e9, hp: 8, reward: 12 },
    ],
  },
  conveyor: {
    // Four extra slots live in the extended end transit; original spacing/speed stay exact.
    count: 10, left: -2.9*5/3, right: 2.9*5/3, initialLeft: -2.9, z: 8, speed: 0.32,
    spawnInterval: 2.5,
    // Seven guaranteed workers in the starter sequence allow level three without RNG.
    starter: ['worker', 'worker', 'rewind', 'bomb', 'worker', 'worker', 'rewind', 'slow', 'worker', 'worker', 'worker', 'brake', 'halfSpeed', 'tailBlast'],
    // Six bonuses share half the pool equally; pause uses the remaining sixth.
    workerWeight: 0.50, bombWeight: 0.5 / 6, rewindWeight: 0.5 / 6, brakeWeight: 0.5 / 6, halfSpeedWeight: 0.5 / 6, tailBlastWeight: 0.5 / 6,
  },
  pads: [
    { x: -.75, z: -5.5, price: 0 },
    { x: .75, z: -2.5, price: 50 },
    { x: -.75, z: .5, price: 150 },
    { x: .75, z: 3.5, price: 300 },
  ],
  storage: [
    { x: -1.8, z: 6.05, price: 50 },
    { x: 0, z: 6.05, price: 150 },
    { x: 1.8, z: 6.05, price: 300 },
  ],
  mining: { radius: 1.65, period: 1.2, speedGrowth: 1.2, minPeriod: 0.1, impactPhase: 0.52, damageByLevel: [2, 5, 11, 24, 50], damageGrowth: 2 },
  slow: { duration: 5 },
  brake: { reductionFraction: 0.2, minimumBaseFraction: 0.1 },
  discard: { x: 3.05, z: 6.6, radius: 0.42 },
  bomb: { radius: 1.55, trackTolerance: 0.62 },
  visual: { helmetColors: [0xffcf3f, 0x6dddea, 0xee86ba, 0xb59bff, 0xff9356], stoneRadius: 0.23, maxEffects: 120, pixelRatio: 1.5 },
  input: { dragThreshold: 9, targetRadius: 0.57, touchLift: 0.85, hitRadiusPx:24, pickupRadiusPx:34, touchLiftPx:32 },
  camera: { fov: 38, near: 0.1, far: 80, position: [0, 17, 12], target: [0, 0, -.25], margin:1.03, frameWidth:7.8, frameDepth:21.2, landscapeWidth:18, landscapeDepth:10.4, portraitBounds:{left:-3.6,right:3.6,back:-7.6,front:8.7,height:1.3,targetZ:1.75,paddingPx:12} },
};
