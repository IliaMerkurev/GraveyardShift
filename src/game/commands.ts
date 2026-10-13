import type { GameConfig } from './config';
import { nextWorkerLevel } from './progression';
import {
  createMiningState, type DropTarget, type Entity, type GameEvent, type GameState,
  type Pad, type PlaceRef, type Point, type Slot,
} from './GameState';
import { distanceToPath, samplePath, getPathLength } from './path';

export interface CommandContext {
  state: GameState;
  config: GameConfig;
  emit(event: GameEvent): void;
}

export function getPlace(state: GameState, ref: PlaceRef): Slot | Pad | undefined {
  return ref.kind === 'slot' ? state.slots.find((slot) => slot.id === ref.id) : state.pads.find((pad) => pad.id === ref.id);
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

export function openBarrel(ctx: CommandContext, slotId: string): boolean {
  if (ctx.state.paused || ctx.state.gameOver) return false;
  const slot = ctx.state.slots.find((candidate) => candidate.id === slotId);
  if (!slot || slot.reserved || !slot.entityId) return false;
  const barrel = ctx.state.entities[slot.entityId];
  if (!barrel || barrel.kind !== 'barrel') return false;
  if (barrel.content === 'worker') {
    ctx.state.entities[barrel.id] = { id: barrel.id, kind: 'worker', location: { kind: 'slot', id: slot.id }, level: 1, mining: createMiningState() };
  } else if (barrel.content === 'bomb' || barrel.content === 'rewind' || barrel.content === 'slow') {
    ctx.state.entities[barrel.id] = { id: barrel.id, kind: barrel.content, location: { kind: 'slot', id: slot.id } };
  } else {
    delete ctx.state.entities[barrel.id];
    slot.entityId = null;
    reward(ctx, ctx.config.economy.barrelCoins, slot);
  }
  ctx.state.stats.opened++;
  ctx.state.tutorial.opened = true;
  ctx.emit({ type: 'open', x: slot.x, z: slot.z, entityId: barrel.id });
  return true;
}

/** Snake-only time bonus; repeated collection refreshes, never stacks. */
export function useSlow(ctx: CommandContext, entityId: string): boolean {
  if (ctx.state.paused || ctx.state.gameOver) return false;
  const entity = ctx.state.entities[entityId];
  if (!entity || entity.kind !== 'slow' || entity.location.kind !== 'slot') return false;
  const slot = getPlace(ctx.state, entity.location);
  if (!slot || slot.reserved || slot.entityId !== entityId) return false;
  ctx.state.slowRemaining = ctx.config.slow.duration;
  delete ctx.state.entities[entityId];
  slot.entityId = null;
  ctx.emit({ type: 'slow', x: slot.x, z: slot.z, entityId, amount: ctx.config.slow.duration });
  return true;
}

/** Tap a revealed rewind token. Preserve IDs/HP and never advance the head. */
export function useRewind(ctx: CommandContext, entityId: string): boolean {
  if (ctx.state.paused || ctx.state.gameOver) return false;
  const entity = ctx.state.entities[entityId];
  if (!entity || entity.kind !== 'rewind' || entity.location.kind !== 'slot') return false;
  const slot = getPlace(ctx.state, entity.location);
  if (!slot || slot.reserved || slot.entityId !== entityId) return false;
  const head = ctx.state.stones.reduce((max, stone) => Math.max(max, stone.distance), 0);
  const midpoint = getPathLength(ctx.config.path) * ctx.config.stones.rewindFraction;
  const target = head < midpoint ? ctx.config.stones.rewindNearStart : midpoint;
  const shift = Math.max(0, head - target);
  // Simulation owns the motion; token consumption never teleports the chain.
  ctx.state.rewindTarget = shift > 0 ? target : null;
  ctx.state.rewindSpeed = shift / ctx.config.stones.rewindDuration;
  delete ctx.state.entities[entityId];
  slot.entityId = null;
  ctx.emit({ type: 'rewind', x: slot.x, z: slot.z, entityId, amount: shift });
  return true;
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

export function beginDrag(ctx: CommandContext, entityId: string): boolean {
  if (ctx.state.paused || ctx.state.gameOver || ctx.state.drag) return false;
  const entity = ctx.state.entities[entityId];
  if (!entity || entity.kind === 'barrel' || entity.kind === 'rewind' || entity.kind === 'slow' || entity.location.kind === 'drag') return false;
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
  if (!entity) return false;
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
  if (target.kind === 'track') {
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
