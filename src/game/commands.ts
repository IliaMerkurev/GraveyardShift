import type { GameConfig } from './config';
import {
  createMiningState, type DropTarget, type Entity, type GameEvent, type GameState,
  type Pad, type PlaceRef, type Point, type Slot,
} from './GameState';
import { distanceToPath, samplePath } from './path';

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
  if (ctx.state.paused) return false;
  const slot = ctx.state.slots.find((candidate) => candidate.id === slotId);
  if (!slot || slot.reserved || !slot.entityId) return false;
  const barrel = ctx.state.entities[slot.entityId];
  if (!barrel || barrel.kind !== 'barrel') return false;
  if (barrel.content === 'worker') {
    ctx.state.entities[barrel.id] = { id: barrel.id, kind: 'worker', location: { kind: 'slot', id: slot.id }, level: 1, mining: createMiningState() };
  } else if (barrel.content === 'bomb') {
    ctx.state.entities[barrel.id] = { id: barrel.id, kind: 'bomb', location: { kind: 'slot', id: slot.id } };
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

export function buyPad(ctx: CommandContext, padId: string): boolean {
  if (ctx.state.paused) return false;
  const pad = ctx.state.pads.find((candidate) => candidate.id === padId);
  if (!pad || pad.unlocked || ctx.state.coins < pad.price) return false;
  ctx.state.coins -= pad.price;
  pad.unlocked = true;
  ctx.state.stats.purchased++;
  ctx.state.tutorial.bought = true;
  ctx.emit({ type: 'purchase', x: pad.x, z: pad.z, amount: pad.price });
  checkGoal(ctx);
  return true;
}

export function beginDrag(ctx: CommandContext, entityId: string): boolean {
  if (ctx.state.paused || ctx.state.drag) return false;
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
  ctx.state.conveyorPaused = true;
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
  if (ctx.state.paused || !ctx.state.drag || !target) return false;
  const drag = ctx.state.drag;
  const entity = ctx.state.entities[drag.entityId];
  if (!entity) return false;
  if (target.kind === 'track') {
    if (entity.kind !== 'bomb' || !Number.isFinite(target.x) || !Number.isFinite(target.z)) return false;
    if (distanceToPath(target, ctx.config.path) > ctx.config.bomb.trackTolerance) return false;
    return ctx.state.stones.some((stone) => {
      const point = samplePath(stone.distance, ctx.config.path);
      return stone.hp > 0 && Math.hypot(point.x - target.x, point.z - target.z) <= ctx.config.bomb.radius;
    });
  }
  const place = getPlace(ctx.state, target);
  if (!place || (target.kind === 'pad' && !(place as Pad).unlocked)) return false;
  if (place.reserved && !samePlace(target, drag.source)) return false;
  if (entity.kind === 'bomb') return target.kind === 'slot' && place.entityId === null;
  if (entity.kind !== 'worker') return false;
  if (!place.entityId) return true;
  const other = ctx.state.entities[place.entityId];
  return other?.kind === 'worker' && other.level === entity.level && entity.level < ctx.config.economy.maxLevel;
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
  if (target.kind === 'track') {
    // Snapshot IDs before removals; an ID can pass through the reward gate only once.
    const victims = ctx.state.stones.filter((stone) => {
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
    const occupant = destination.entityId ? ctx.state.entities[destination.entityId] : undefined;
    if (occupant?.kind === 'worker' && entity.kind === 'worker') {
      occupant.level++;
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
  checkGoal(ctx);
  return true;
}
