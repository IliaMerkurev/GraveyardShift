/** All prototype balance and spatial assumptions live here, not in the renderer. */
export interface GameConfig {
  seed: number;
  simulation: { fixedStep: number; maxDelta: number; maxEvents: number };
  economy: { initialCoins: number; barrelCoins: number };
  path: { left: number; right: number; runs: readonly number[]; bendRadius: number };
  stones: {
    initialCount: number; maxCount: number; speed: number; spacing: number; startFraction: number; rewindFraction: number; rewindNearStart: number; acceleration: number; maxSpeed: number; gapDelay: number; retractSpeed: number; rewindDuration: number;
    resources: readonly { color: number; hp: number; reward: number }[];
  };
  conveyor: {
    count: number; left: number; right: number; z: number; speed: number;
    spawnInterval: number; starter: readonly ('worker' | 'coins' | 'bomb' | 'rewind' | 'slow')[];
    workerWeight: number; coinWeight: number; bombWeight: number; rewindWeight: number;
  };
  pads: readonly { x: number; z: number; price: number }[];
  mining: { radius: number; period: number; impactPhase: number; damageByLevel: readonly number[]; damageGrowth: number };
  slow: { factor: number; duration: number; recovery: number };
  bomb: { radius: number; trackTolerance: number };
  visual: { helmetColors: readonly number[]; stoneRadius: number; maxEffects: number; pixelRatio: number };
  input: { dragThreshold: number; targetRadius: number; touchLift: number; hitRadiusPx: number; touchLiftPx: number };
  camera: { fov: number; near: number; far: number; position: readonly [number, number, number]; target: readonly [number, number, number]; margin:number; frameWidth:number; frameDepth:number; landscapeWidth:number; landscapeDepth:number };
}

export const CONFIG: GameConfig = {
  seed: 0x726f636b,
  simulation: { fixedStep: 1 / 60, maxDelta: 0.1, maxEvents: 256 },
  economy: { initialCoins: 0, barrelCoins: 50 },
  path: { left: -1.3, right: 1.3, runs: [-7, -4, -1, 2, 5], bendRadius: 1.5 },
  stones: {
    initialCount: 65, maxCount: 200, speed: 0.34, spacing: 0.245, startFraction: 0.5, rewindFraction: 0.5, rewindNearStart: 0.8, acceleration: 0.017, maxSpeed: 0.85,
    gapDelay: 0.35, retractSpeed: 1.2, rewindDuration: 1.2,
    resources: [
      { color: 0x76cf9b, hp: 3, reward: 5 },
      { color: 0x60b4e2, hp: 5, reward: 8 },
      { color: 0xd295e9, hp: 8, reward: 12 },
    ],
  },
  conveyor: {
    count: 6, left: -2.9, right: 2.9, z: 7, speed: 0.32,
    spawnInterval: 2.5,
    // Seven guaranteed workers in the starter sequence allow level three without RNG.
    starter: ['worker', 'worker', 'coins', 'bomb', 'worker', 'worker', 'rewind', 'slow', 'worker', 'worker', 'worker'],
    workerWeight: 0.57, coinWeight: 0.13, bombWeight: 0.11, rewindWeight: 0.10,
  },
  pads: [
    { x: -.75, z: -5.5, price: 0 },
    { x: .75, z: -2.5, price: 50 },
    { x: -.75, z: .5, price: 150 },
    { x: .75, z: 3.5, price: 300 },
  ],
  mining: { radius: 1.65, period: 1.2, impactPhase: 0.52, damageByLevel: [2, 5, 11, 24, 50], damageGrowth: 2 },
  slow: { factor: 0.5, duration: 5, recovery: 0.5 },
  bomb: { radius: 1.55, trackTolerance: 0.62 },
  visual: { helmetColors: [0xffcf3f, 0x6dddea, 0xee86ba, 0xb59bff, 0xff9356], stoneRadius: 0.23, maxEffects: 120, pixelRatio: 1.5 },
  input: { dragThreshold: 9, targetRadius: 0.57, touchLift: 0.85, hitRadiusPx:24, touchLiftPx:32 },
  camera: { fov: 38, near: 0.1, far: 80, position: [0, 17, 12], target: [0, 0, -.25], margin:1.03, frameWidth:7.8, frameDepth:17.4, landscapeWidth:18, landscapeDepth:10.4 },
};
