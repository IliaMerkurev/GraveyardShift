import { CONFIG, type GameConfig } from './config';
import type { Stone } from './GameState';

/** Active-time quadratic pressure. The remote safety guard is not a playable cap. */
export function forwardSpeed(time: number, c: GameConfig['stones'] = CONFIG.stones): number {
  const t = Math.min(1_000_000, Math.max(0, Number.isFinite(time) ? time : 1_000_000));
  return Math.min(c.maxSpeed, c.speed + c.acceleration * t * (1 + c.accelerationGrowth * t));
}
/** A permanent subtraction, never a multiplier on future acceleration.
 * Pause/rewind do not change this underlying forward speed. */
export function effectiveForwardSpeed(time: number, reduction: number, config: GameConfig = CONFIG): number {
  return Math.max(config.stones.speed * config.brake.minimumBaseFraction, forwardSpeed(time, config.stones) - reduction);
}
export function attractionSpeed(gap: number, c: GameConfig['stones'] = CONFIG.stones): number {
  return c.retractSpeed + c.attraction * Math.max(0, gap);
}
/** Forward contact recoil: the front rebounds away from its moving rear. */
export function contactBounce(remaining: number, c: GameConfig['stones'] = CONFIG.stones): number {
  if (remaining <= 0) return 0;
  const progress = 1 - Math.min(1, remaining / c.bounceDuration);
  return c.bounceDistance * Math.sin(Math.PI * progress);
}

/** Tail-to-head ordering in; head-to-tail constraint pass prevents visual overlap.
 * Rendering cannot cross FINISH or a less-recoiling section in front. */
export function recoilDistances(ordered: readonly Stone[], end: number, c: GameConfig['stones'] = CONFIG.stones): number[] {
  const result: number[] = new Array(ordered.length);
  for (let i = ordered.length - 1; i >= 0; i--) {
    const stone = ordered[i]!;
    const limit = i === ordered.length - 1 ? end : result[i + 1]! - c.spacing;
    result[i] = Math.max(stone.distance, Math.min(stone.distance + contactBounce(stone.bounceRemaining ?? 0, c), limit));
  }
  return result;
}
