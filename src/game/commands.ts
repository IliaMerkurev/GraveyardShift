import type { GameConfig } from './config';
import { nextWorkerLevel } from './progression';
import { recoilDistances, effectiveForwardSpeed } from './motion';
import {
  createMiningState, type DropTarget, type Entity, type GameEvent, type GameState,
  type Pad, type PlaceRef, type Point, type Slot, type Rewind, type Slow, type Brake,
} from './GameState';
import { distanceToPath, samplePath, getPathLength } from './path';

export interface CommandContext {
  state: GameState;
  config: GameConfig;
  emit(event: GameEvent): void;
}

export function getPlace(state: GameState, ref: PlaceRef): Slot | Pad | undefined {
  return (ref.kind === 'slot' ? state.slots : ref.kind === 'storage' ? state.storage : state.pads).find(place => place.id === ref.id);
}

export function getEntityPosition(state: GameState, entity: Entity): Point | null {
  if (entity.location.kind === 'drag') {
    return state.drag?.entityId === entity.id ? getPlace(state, state.drag.source) ?? null : null;
  }
  return getPlace(state, entity.location) ?? null;
}

function samePlace(a: PlaceRef, b: PlaceRef): boolean { return a.kind === b.kind && a.id === b.id; }

function reward(ctx: CommandContext, amount: number, point: Point): void {
  ctx.state.coins += amount;
  ctx.state.stats.coinsEarned += amount;
  ctx.emit({ type: 'coins', x: point.x, z: point.z, amount });
}

export function checkGoal(ctx: CommandContext): void {
  if (!ctx.state.goalReached && ctx.state.stats.purchased > 0 &&
      Object.values(ctx.state.entities).some((entity) => entity.kind === 'worker' && entity.level >= 3)) {
    ctx.state.goalReached = true;
    ctx.emit({ type: 'goal', x: 0, z: 0 });
  }
}

/** Read occupied work pads at reveal time, never belt cargo or a held worker. */
export function workerBarrelRange(state: GameState, boost = state.workerDropBoost): { lowest: number; highest: number } {
  let maxLevel = 1;
  for (const pad of state.pads) {
    if (!pad.unlocked || pad.reserved || !pad.entityId) continue;
    const worker = state.entities[pad.entityId];
    if (worker?.kind !== 'worker' || worker.id !== pad.entityId ||
        worker.location.kind !== 'pad' || worker.location.id !== pad.id ||
        !Number.isSafeInteger(worker.level) || worker.level < 1) continue;
    maxLevel = Math.max(maxLevel, worker.level);
  }
  // Clamp at reveal time too: lifting/removing the strongest worker can lower the cap.
  // Clamp the increment before adding it to avoid safe-integer overflow.
  const addBoost = (level: number) => level + Math.min(boost, maxLevel - level);
  return { lowest: addBoost(Math.max(1, maxLevel - 10)), highest: addBoost(Math.max(1, maxLevel - 1)) };
}

/** A capped upper bound can still leave room to improve the lower bound. */
export function workerUpgradeHasEffect(state: GameState): boolean {
  if (!Number.isSafeInteger(state.workerDropBoost + 1)) return false;
  const current = workerBarrelRange(state);
  const next = workerBarrelRange(state, state.workerDropBoost + 1);
  return next.lowest > current.lowest || next.highest > current.highest;
}

export function workerUpgradePrice(state: GameState, config: GameConfig): number | null {
  const price = config.economy.workerUpgradeBaseCost * 2 ** state.workerDropBoost;
  return Number.isSafeInteger(price) && price > 0 ? price : null;
}

export function buyWorkerUpgrade(ctx: CommandContext): boolean {
  if (ctx.state.paused || ctx.state.gameOver || ctx.state.drag) return false;
  const price = workerUpgradePrice(ctx.state, ctx.config);
  if (price === null || !workerUpgradeHasEffect(ctx.state) || ctx.state.coins < price) return false;
  ctx.state.coins -= price;
  ctx.state.workerDropBoost++;
  return true;
}

function barrelWorkerLevel(state: GameState, random: () => number): number {
  const { lowest, highest } = workerBarrelRange(state);
  const count = highest - lowest + 1;
  if (count === 1) return lowest;
  const roll = random();
  // Squared uniform roll favors low levels without an exponentially rare top tier.
  // The rolling window stays at most ten levels wide, even at safe-integer limits.
  return Math.min(highest, lowest + Math.floor(count * roll * roll));
}

export function openBarrel(ctx: CommandContext, slotId: string, random: () => number): boolean {
  if (ctx.state.paused || ctx.state.gameOver) return false;
  const slot = ctx.state.slots.find((candidate) => candidate.id === slotId);
  if (!slot || slot.reserved || !slot.entityId) return false;
  const barrel = ctx.state.entities[slot.entityId];
  if (!barrel || barrel.kind !== 'barrel') return false;
  if (barrel.content === 'worker') {
    const level = barrelWorkerLevel(ctx.state, random);
    ctx.state.entities[barrel.id] = { id: barrel.id, kind: 'worker', location: { kind: 'slot', id: slot.id }, level, mining: createMiningState() };
  } else if (barrel.content === 'bomb' || barrel.content === 'rewind' || barrel.content === 'slow' || barrel.content === 'brake') {
    ctx.state.entities[barrel.id] = { id: barrel.id, kind: barrel.content, location: { kind: 'slot', id: slot.id } };
  } else {
    // Unknown content cannot manufacture a reward or consume a barrel.
    return false;
  }
  ctx.state.stats.opened++;
  ctx.state.tutorial.opened = true;
  ctx.emit({ type: 'open', x: slot.x, z: slot.z, entityId: barrel.id });
  return true;
}

/** Both gestures share one consumption/effect gate. Call only after ownership validation. */
function activateBonus(ctx: CommandContext, entity: Rewind | Slow | Brake, point: Point): void {
  delete ctx.state.entities[entity.id];
  if (entity.kind === 'brake') {
    const speed = effectiveForwardSpeed(ctx.state.difficultyTime, ctx.state.permanentSpeedReduction, ctx.config);
    const floor = ctx.config.stones.speed * ctx.config.brake.minimumBaseFraction;
    const reduction = Math.min(speed * ctx.config.brake.reductionFraction, Math.max(0, speed - floor));
    ctx.state.permanentSpeedReduction += reduction;
    ctx.emit({ type: 'brake', ...point, entityId: entity.id, amount: reduction });
    return;
  }
  if (entity.kind === 'slow') {
    // Preserve impact poses too, even if mining removes a neighboring constraint.
    const ordered = [...ctx.state.stones].sort((a, b) => a.distance - b.distance);
    const rendered = recoilDistances(ordered, getPathLength(ctx.config.path), ctx.config.stones);
    for (const [i, stone] of ordered.entries()) stone.frozenRenderDistance ??= rendered[i];
    ctx.state.headSpeed = 0;
    // Snake-only full pause; repeated collection refreshes, never stacks.
    ctx.state.slowRemaining = ctx.config.slow.duration;
    ctx.emit({ type: 'slow', ...point, entityId: entity.id, amount: ctx.config.slow.duration });
    return;
  }
  const head = ctx.state.stones.reduce((max, stone) => Math.max(max, stone.distance), 0);
  // The screenshot mark is just before the first bend, on the first straight.
  const target = ctx.config.path.right - ctx.config.path.left - ctx.config.stones.rewindBeforeFirstBend;
  const shift = Math.max(0, head - target);
  // Simulation owns the motion; token consumption never teleports the chain.
  ctx.state.rewindTarget = shift > 0 ? target : null;
  ctx.state.rewindSpeed = shift / ctx.config.stones.rewindDuration;
  ctx.emit({ type: 'rewind', ...point, entityId: entity.id, amount: shift });
}

function usePlacedBonus(ctx: CommandContext, entityId: string, kind: 'rewind' | 'slow' | 'brake'): boolean {
  if (ctx.state.paused || ctx.state.gameOver) return false;
  const entity = ctx.state.entities[entityId];
  if (!entity || (entity.kind !== 'rewind' && entity.kind !== 'slow' && entity.kind !== 'brake') || entity.kind !== kind || (entity.location.kind !== 'slot' && entity.location.kind !== 'storage')) return false;
  const slot = getPlace(ctx.state, entity.location);
  if (!slot || slot.reserved || slot.entityId !== entityId) return false;
  slot.entityId = null;
  activateBonus(ctx, entity, { x: slot.x, z: slot.z });
  return true;
}

export function useBrake(ctx: CommandContext, entityId: string): boolean { return usePlacedBonus(ctx, entityId, 'brake'); }
export function useSlow(ctx: CommandContext, entityId: string): boolean { return usePlacedBonus(ctx, entityId, 'slow'); }
export function useRewind(ctx: CommandContext, entityId: string): boolean { return usePlacedBonus(ctx, entityId, 'rewind'); }

/** Route-and-ground footprint in field coordinates, excluding worker/purchase pads.
 * The conveyor and UI are rejected separately by the pointer view. */
export function isBonusFieldPoint(point: Point, config: GameConfig): boolean {
  const { path } = config;
  return Number.isFinite(point.x) && Number.isFinite(point.z) &&
    point.x >= path.left - path.bendRadius - .5 && point.x <= path.right + path.bendRadius + .5 &&
    point.z >= Math.min(...path.runs) - .5 && point.z <= Math.max(...path.runs) + .5 &&
    ![...config.pads, ...config.storage].some(pad => Math.abs(point.x - pad.x) <= .62 && Math.abs(point.z - pad.z) <= .57);
}

function canBuyPad(ctx: CommandContext, pad: Pad | undefined): pad is Pad {
  return !!pad && !pad.unlocked && !pad.entityId && !pad.reserved && ctx.state.coins >= pad.price;
}

function purchasePad(ctx: CommandContext, pad: Pad): void {
  ctx.state.coins -= pad.price;
  pad.unlocked = true;
  ctx.state.stats.purchased++;
  ctx.state.tutorial.bought = true;
}

export function buyPad(ctx: CommandContext, padId: string): boolean {
  if (ctx.state.paused || ctx.state.gameOver) return false;
  const pad = ctx.state.pads.find((candidate) => candidate.id === padId);
  if (!canBuyPad(ctx, pad)) return false;
  purchasePad(ctx, pad);
  ctx.emit({ type: 'purchase', x: pad.x, z: pad.z, amount: pad.price });
  checkGoal(ctx);
  return true;
}

/** Storage purchases never count as work-pad/tutorial progress. */
export function buyStorage(ctx: CommandContext, standId: string): boolean {
  if (ctx.state.paused || ctx.state.gameOver) return false;
  const stand = ctx.state.storage.find(candidate => candidate.id === standId);
  if (!canBuyPad(ctx, stand)) return false;
  ctx.state.coins -= stand.price;
  stand.unlocked = true;
  ctx.emit({ type: 'purchase', x: stand.x, z: stand.z, amount: stand.price });
  return true;
}

export function beginDrag(ctx: CommandContext, entityId: string): boolean {
  if (ctx.state.paused || ctx.state.gameOver || ctx.state.drag) return false;
  const entity = ctx.state.entities[entityId];
  if (!entity || entity.kind === 'barrel' || entity.location.kind === 'drag') return false;
  const source = getPlace(ctx.state, entity.location);
  if (!source || source.reserved || source.entityId !== entityId) return false;
  const ref: PlaceRef = { ...entity.location };
  source.reserved = true;
  source.entityId = null;
  entity.location = { kind: 'drag' };
  if (entity.kind === 'worker') entity.mining = createMiningState();
  ctx.state.drag = { entityId, source: ref };
  return true;
}

export function cancelDrag(ctx: CommandContext): boolean {
  const drag = ctx.state.drag;
  if (!drag) return false;
  const source = getPlace(ctx.state, drag.source);
  const entity = ctx.state.entities[drag.entityId];
  // Every successful beginDrag reserves an empty source. No other command can claim it.
  if (!source || !entity || source.entityId !== null) return false;
  source.entityId = entity.id;
  source.reserved = false;
  entity.location = { ...drag.source };
  ctx.state.drag = null;
  return true;
}

export function canDrop(ctx: CommandContext, target: DropTarget): boolean {
  if (ctx.state.paused || ctx.state.gameOver || !ctx.state.drag || !target) return false;
  const drag = ctx.state.drag;
  const entity = ctx.state.entities[drag.entityId];
  const source = getPlace(ctx.state, drag.source);
  if (!entity || entity.location.kind !== 'drag' || !source?.reserved || source.entityId !== null) return false;
  if (target.kind === 'discard') return entity.kind === 'worker';
  if (target.kind === 'field') return (entity.kind === 'rewind' || entity.kind === 'slow' || entity.kind === 'brake') && isBonusFieldPoint(target, ctx.config);
  if (target.kind === 'track') {
    if (entity.kind !== 'bomb' || !Number.isFinite(target.x) || !Number.isFinite(target.z)) return false;
    if (distanceToPath(target, ctx.config.path) > ctx.config.bomb.trackTolerance) return false;
    return ctx.state.stones.some((stone) => {
      const point = samplePath(stone.distance, ctx.config.path);
      return stone.distance >= 0 && stone.hp > 0 && Math.hypot(point.x - target.x, point.z - target.z) <= ctx.config.bomb.radius;
    });
  }
  const place = getPlace(ctx.state, target);
  if (!place) return false;
  if (place.reserved && !samePlace(target, drag.source)) return false;
  if (target.kind === 'storage') {
    if (entity.kind !== 'bomb' && entity.kind !== 'rewind' && entity.kind !== 'slow' && entity.kind !== 'brake') return false;
    return (place as Pad).unlocked ? place.entityId === null : canBuyPad(ctx, place as Pad);
  }
  if (entity.kind === 'bomb') return target.kind === 'slot' && place.entityId === null;
  if (entity.kind !== 'worker') return false;
  // Highlight affordable empty locked pads as valid without spending until drop.
  if (target.kind === 'pad' && !(place as Pad).unlocked) return canBuyPad(ctx, place as Pad);
  if (!place.entityId) return true;
  const other = ctx.state.entities[place.entityId];
  return other?.kind === 'worker' && other.level === entity.level;
}

/** Single reward gate for mining and bombs. Removing the ID makes repeated damage inert. */
export function damageStone(ctx: CommandContext, stoneId: string, damage: number): boolean {
  if (!Number.isFinite(damage) || damage <= 0) return false;
  const index = ctx.state.stones.findIndex((stone) => stone.id === stoneId);
  if (index < 0) return false;
  const stone = ctx.state.stones[index]!;
  if (stone.hp <= 0) return false;
  stone.hp = Math.max(0, stone.hp - damage);
  if (stone.hp > 0) return false;
  const point = samplePath(stone.distance, ctx.config.path);
  ctx.state.stones.splice(index, 1);
  // Keep the explosion gap visible. Delay only this boundary: unrelated gaps
  // keep closing even when miners destroy stones in staggered cycles.
  const previousReadyAt = ctx.state.gapReadyAt[stone.id];
  delete ctx.state.gapReadyAt[stone.id];
  const front = ctx.state.stones.filter(s => s.distance > stone.distance).sort((a, b) => a.distance - b.distance)[0];
  const hasRear = ctx.state.stones.some(s => s.distance < stone.distance);
  if (front && hasRear) {
    const readyAt = Math.min(previousReadyAt ?? Infinity, ctx.state.gapReadyAt[front.id] ?? Infinity, ctx.state.time + ctx.config.stones.gapDelay);
    ctx.state.gapReadyAt[front.id] = readyAt;
    ctx.state.gapRecoveryRemaining = Math.max(0, readyAt - ctx.state.time);
  }
  ctx.state.stats.destroyed++;
  reward(ctx, stone.reward, point);
  ctx.emit({ type: 'destroy', x: point.x, z: point.z, stoneId: stone.id, amount: stone.reward });
  return true;
}

export function drop(ctx: CommandContext, target: DropTarget): boolean {
  const drag = ctx.state.drag;
  if (!drag) return false;
  if (!canDrop(ctx, target) || !target) { cancelDrag(ctx); return false; }
  const entity = ctx.state.entities[drag.entityId]!;
  const source = getPlace(ctx.state, drag.source)!;
  let purchasedPad: Pad | undefined;
  if (target.kind === 'discard') {
    // Only an owned drag can reach this branch. Never reward or merge a discard.
    if (entity.kind !== 'worker') { cancelDrag(ctx); return false; }
    entity.mining = createMiningState();
    delete ctx.state.entities[entity.id];
    ctx.emit({ type: 'discard', x: ctx.config.discard.x, z: ctx.config.discard.z, entityId: entity.id });
  } else if (target.kind === 'field') {
    if (entity.kind !== 'rewind' && entity.kind !== 'slow' && entity.kind !== 'brake') { cancelDrag(ctx); return false; }
    activateBonus(ctx, entity, { x: target.x, z: target.z });
  } else if (target.kind === 'track') {
    // Snapshot IDs before removals; an ID can pass through the reward gate only once.
    const victims = ctx.state.stones.filter((stone) => {
      if (stone.distance < 0) return false;
      const point = samplePath(stone.distance, ctx.config.path);
      return Math.hypot(point.x - target.x, point.z - target.z) <= ctx.config.bomb.radius;
    }).map((stone) => stone.id);
    for (const id of victims) damageStone(ctx, id, Number.MAX_VALUE);
    delete ctx.state.entities[entity.id];
    ctx.state.stats.bombsUsed++;
    ctx.state.tutorial.bombed = true;
    ctx.emit({ type: 'bomb', x: target.x, z: target.z, entityId: entity.id, amount: victims.length });
  } else {
    const destination = getPlace(ctx.state, target)!;
    if (target.kind === 'storage' && !(destination as Pad).unlocked) {
      // Validity and purchase are committed within this single drop command.
      purchasedPad = destination as Pad;
      ctx.state.coins -= purchasedPad.price;
      purchasedPad.unlocked = true;
    }
    if (target.kind === 'pad' && !(destination as Pad).unlocked) {
      // canDrop has validated the funds and empty destination in this command.
      // Commit purchase and placement together before publishing the event.
      purchasedPad = destination as Pad;
      purchasePad(ctx, purchasedPad);
    }
    const occupant = destination.entityId ? ctx.state.entities[destination.entityId] : undefined;
    if (occupant?.kind === 'worker' && entity.kind === 'worker') {
      occupant.level = nextWorkerLevel(occupant.level);
      occupant.mining = createMiningState();
      delete ctx.state.entities[entity.id];
      ctx.state.stats.merged++;
      ctx.state.tutorial.merged = true;
      ctx.emit({ type: 'merge', x: destination.x, z: destination.z, entityId: occupant.id, level: occupant.level });
    } else {
      destination.entityId = entity.id;
      entity.location = { ...target };
      if (target.kind === 'pad' && entity.kind === 'worker') ctx.state.tutorial.placed = true;
    }
  }
  source.reserved = false;
  ctx.state.drag = null;
  if (purchasedPad) ctx.emit({ type: 'purchase', x: purchasedPad.x, z: purchasedPad.z, amount: purchasedPad.price });
  checkGoal(ctx);
  return true;
}
