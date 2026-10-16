import type { GameConfig } from './config';
import { nextWorkerLevel } from './progression';
import { recoilDistances, effectiveForwardSpeed } from './motion';
import {
  createMiningState, type DropTarget, type Entity, type GameEvent, type GameState,
  type Pad, type PlaceRef, type Point, type Slot, type Rewind, type Slow, type Brake, type HalfSpeed, type TailBlast,
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
  ctx.state.stats.coinsEarned = Math.min(Number.MAX_SAFE_INTEGER,ctx.state.stats.coinsEarned+amount);
  ctx.emit({ type: 'coins', x: point.x, z: point.z, amount });
}

function discardWorker(ctx:CommandContext,id:string){
  if(ctx.state.drag?.source.kind==='pad')ctx.state.tutorial.discarded=true;
  ctx.state.incomeMultiplier=Math.min(Number.MAX_SAFE_INTEGER,ctx.state.incomeMultiplier*1.2);
  delete ctx.state.entities[id];
  ctx.emit({type:'discard',x:ctx.config.discard.x,z:ctx.config.discard.z,entityId:id,amount:ctx.state.incomeMultiplier});
}

export function checkGoal(ctx: CommandContext): void {
  if (!ctx.state.goalReached && ctx.state.stats.purchased > 0 &&
      Object.values(ctx.state.entities).some((entity) => entity.kind === 'worker' && entity.level >= 3)) {
    ctx.state.goalReached = true;
    ctx.emit({ type: 'goal', x: 0, z: 0 });
  }
}

/** Future worker levels depend only on purchased upgrades, never deployed heroes. */
export function workerBarrelRange(state: GameState, boost = state.workerDropBoost): { lowest: number; highest: number } {
  const level = 1 + Math.min(boost, Number.MAX_SAFE_INTEGER - 1);
  return { lowest: Math.max(1, level - 2), highest: level };
}

export function workerUpgradePrice(state: GameState, config: GameConfig): number | null {
  const price = Math.ceil(config.economy.workerUpgradeBaseCost * 1.2 ** state.workerDropBoost);
  return Number.isSafeInteger(price) && price > 0 ? price : null;
}

export function workerUpgradeEligible(state: GameState): boolean {
  return state.pads.some(p => {
    const e = p.entityId && state.entities[p.entityId];
    return p.unlocked && !p.reserved && e && e.kind === 'worker' && e.location.kind === 'pad' && e.location.id === p.id && e.level >= 2 + state.workerDropBoost;
  });
}

export function buyWorkerUpgrade(ctx: CommandContext): boolean {
  if (ctx.state.paused || ctx.state.gameOver || ctx.state.drag || !workerUpgradeEligible(ctx.state)) return false;
  const price = workerUpgradePrice(ctx.state, ctx.config);
  if (price === null || ctx.state.coins < price) return false;
  ctx.state.coins -= price;
  ctx.state.workerDropBoost++;
  return true;
}

export function openBarrel(ctx: CommandContext, slotId: string, random: () => number): boolean {
  if (ctx.state.paused || ctx.state.gameOver) return false;
  const slot = ctx.state.slots.find((candidate) => candidate.id === slotId);
  if (!slot || slot.reserved || !slot.entityId) return false;
  const barrel = ctx.state.entities[slot.entityId];
  if (!barrel || barrel.kind !== 'barrel') return false;
  if (barrel.content === 'worker') {
    const { lowest, highest } = workerBarrelRange(ctx.state);
    const roll = lowest === highest ? 0 : random();
    const level = Math.min(highest, lowest + Math.floor((highest - lowest + 1) * roll * roll));
    ctx.state.entities[barrel.id] = { id: barrel.id, kind: 'worker', location: { kind: 'slot', id: slot.id }, level, mining: createMiningState() };
  } else if (barrel.content === 'bomb' || barrel.content === 'rewind' || barrel.content === 'slow' || barrel.content === 'brake' || barrel.content === 'halfSpeed' || barrel.content === 'tailBlast') {
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
function activateBonus(ctx: CommandContext, entity: Rewind | Slow | Brake | HalfSpeed | TailBlast, point: Point): void {
  if(entity.location.kind==='storage'||entity.location.kind==='drag'&&ctx.state.drag?.source.kind==='storage')ctx.state.tutorial.storageUsed=true;
  delete ctx.state.entities[entity.id];
  if (entity.kind === 'tailBlast') {
    const ordered = [...ctx.state.stones].sort((a, b) => a.distance - b.distance);
    const rendered = recoilDistances(ordered, getPathLength(ctx.config.path), ctx.config.stones);
    const victims = ordered.slice(0, Math.ceil(ordered.length / 2));
    const survivors = ordered.slice(victims.length);
    // Snapshot visible poses before removals change recoil constraints.
    for (const [i, stone] of ordered.entries()) {
      stone.waitingRenderDistance = stone.frozenRenderDistance ?? stone.waitingRenderDistance ?? rendered[i];
    }
    for (const stone of victims) damageStone(ctx, stone.id, Number.MAX_VALUE);
    ctx.state.tailWaitingIds = survivors.map(stone => stone.id);
    ctx.state.rewindTarget = null;
    ctx.state.rewindSpeed = 0;
    ctx.state.headSpeed = 0;
    ctx.emit({ type: 'tailBlast', ...point, entityId: entity.id, amount: victims.length });
    return;
  }
  if (entity.kind === 'halfSpeed') {
    const speed = effectiveForwardSpeed(ctx.state.difficultyTime, ctx.state.permanentSpeedReduction, ctx.config, ctx.state.minimumForwardSpeed);
    ctx.state.minimumForwardSpeed = Math.min(ctx.state.minimumForwardSpeed, speed / 2);
    ctx.state.permanentSpeedReduction += speed / 2;
    ctx.emit({ type: 'halfSpeed', ...point, entityId: entity.id, amount: speed / 2 });
    return;
  }
  if (entity.kind === 'brake') {
    const speed = effectiveForwardSpeed(ctx.state.difficultyTime, ctx.state.permanentSpeedReduction, ctx.config, ctx.state.minimumForwardSpeed);
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
    for (const [i, stone] of ordered.entries()) stone.frozenRenderDistance ??= stone.waitingRenderDistance ?? rendered[i];
    ctx.state.headSpeed = 0;
    // Snake-only full pause; repeated collection refreshes, never stacks.
    ctx.state.slowRemaining = ctx.config.slow.duration;
    ctx.emit({ type: 'slow', ...point, entityId: entity.id, amount: ctx.config.slow.duration });
    return;
  }
  ctx.state.tailWaitingIds = [];
  for (const stone of ctx.state.stones) delete stone.waitingRenderDistance;
  const head = ctx.state.stones.reduce((max, stone) => Math.max(max, stone.distance), 0);
  // The screenshot mark is just before the first bend, on the first straight.
  const target = ctx.config.path.right - ctx.config.path.left - ctx.config.stones.rewindBeforeFirstBend;
  const shift = Math.max(0, head - target);
  // Simulation owns the motion; token consumption never teleports the chain.
  ctx.state.rewindTarget = shift > 0 ? target : null;
  ctx.state.rewindSpeed = shift / ctx.config.stones.rewindDuration;
  ctx.emit({ type: 'rewind', ...point, entityId: entity.id, amount: shift });
}

function usePlacedBonus(ctx: CommandContext, entityId: string, kind: 'rewind' | 'slow' | 'brake' | 'halfSpeed' | 'tailBlast'): boolean {
  if (ctx.state.paused || ctx.state.gameOver) return false;
  const entity = ctx.state.entities[entityId];
  if (!entity || (entity.kind !== 'rewind' && entity.kind !== 'slow' && entity.kind !== 'brake' && entity.kind !== 'halfSpeed' && entity.kind !== 'tailBlast') || entity.kind !== kind || (entity.location.kind !== 'slot' && entity.location.kind !== 'storage')) return false;
  const slot = getPlace(ctx.state, entity.location);
  if (!slot || slot.reserved || slot.entityId !== entityId) return false;
  slot.entityId = null;
  activateBonus(ctx, entity, { x: slot.x, z: slot.z });
  return true;
}

export function useHalfSpeed(ctx: CommandContext, entityId: string): boolean { return usePlacedBonus(ctx, entityId, 'halfSpeed'); }
export function useTailBlast(ctx: CommandContext, entityId: string): boolean { return usePlacedBonus(ctx, entityId, 'tailBlast'); }
export function useBrake(ctx: CommandContext, entityId: string): boolean { return usePlacedBonus(ctx, entityId, 'brake'); }
export function useSlow(ctx: CommandContext, entityId: string): boolean { return usePlacedBonus(ctx, entityId, 'slow'); }
export function useRewind(ctx: CommandContext, entityId: string): boolean { return usePlacedBonus(ctx, entityId, 'rewind'); }

/** Pointer routing excludes the conveyor; all other finite releases activate. */
export function isBonusFieldPoint(point: Point, _config: GameConfig): boolean {
  return Number.isFinite(point.x)&&Number.isFinite(point.z);
}
export function bombTarget(state:GameState,point:Point,config:GameConfig):DropTarget{
  const rocks=state.stones.filter(s=>s.distance>=0&&s.hp>0).map(s=>samplePath(s.distance,config.path));
  rocks.sort((a,b)=>Math.hypot(a.x-point.x,a.z-point.z)-Math.hypot(b.x-point.x,b.z-point.z));
  return rocks[0]?{kind:'track',x:rocks[0].x,z:rocks[0].z}:null;
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
  if (target.kind === 'field') return (entity.kind === 'rewind' || entity.kind === 'slow' || entity.kind === 'brake' || entity.kind === 'halfSpeed' || entity.kind === 'tailBlast') && isBonusFieldPoint(target, ctx.config);
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
    if (entity.kind !== 'bomb' && entity.kind !== 'rewind' && entity.kind !== 'slow' && entity.kind !== 'brake' && entity.kind !== 'halfSpeed' && entity.kind !== 'tailBlast') return false;
    return (place as Pad).unlocked ? place.entityId === null : canBuyPad(ctx, place as Pad);
  }
  if (entity.kind === 'bomb') return target.kind === 'slot' && place.entityId === null;
  if (entity.kind !== 'worker') return false;
  // Highlight affordable empty locked pads as valid without spending until drop.
  if (target.kind === 'pad' && !(place as Pad).unlocked) return canBuyPad(ctx, place as Pad);
  if (!place.entityId) return true;
  const other = ctx.state.entities[place.entityId];
  return other?.kind === 'worker' && (other.level === entity.level || target.kind === 'pad' && drag.source.kind === 'pad');
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
  const total=Math.min(Number.MAX_SAFE_INTEGER-ctx.state.coins,stone.reward*ctx.state.incomeMultiplier+ctx.state.incomeRemainder);
  const amount=Math.floor(total+1e-9);
  ctx.state.incomeRemainder=Math.max(0,total-amount);
  reward(ctx, amount, point);
  ctx.emit({ type: 'destroy', x: point.x, z: point.z, stoneId: stone.id, amount });
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
    // Only a completed, owned discard raises income; it pays no coins immediately.
    if (entity.kind !== 'worker') { cancelDrag(ctx); return false; }
    discardWorker(ctx,entity.id);
  } else if (target.kind === 'field') {
    if (entity.kind !== 'rewind' && entity.kind !== 'slow' && entity.kind !== 'brake' && entity.kind !== 'halfSpeed' && entity.kind !== 'tailBlast') { cancelDrag(ctx); return false; }
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
    if(drag.source.kind==='storage')ctx.state.tutorial.storageUsed=true;
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
    if (occupant?.kind === 'worker' && entity.kind === 'worker' && occupant.level === entity.level) {
      occupant.level = nextWorkerLevel(occupant.level);
      occupant.mining = createMiningState();
      delete ctx.state.entities[entity.id];
      ctx.state.stats.merged++;
      ctx.state.tutorial.merged = true;
      ctx.emit({ type: 'merge', x: destination.x, z: destination.z, entityId: occupant.id, level: occupant.level });
    } else {
      if(occupant?.kind==='worker'){
        if(target.kind==='pad'&&target.id===ctx.state.pads[0]?.id&&drag.source.kind==='pad'&&entity.kind==='worker'&&entity.level>occupant.level)ctx.state.tutorial.swapped=true;
        source.entityId=occupant.id;occupant.location={...drag.source};occupant.mining=createMiningState();
      }
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
