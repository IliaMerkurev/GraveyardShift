import { describe, expect, it } from 'vitest';
import { Game } from '../../src/game/Simulation';
import { CONFIG, type GameConfig } from '../../src/game/config';
import { damageStone } from '../../src/game/commands';
import { distanceToPath, PATH_LENGTH, samplePath } from '../../src/game/path';
import type { Entity, PlaceRef, Worker } from '../../src/game/GameState';

function config(): GameConfig { return structuredClone(CONFIG); }
function advance(game: Game, seconds: number, dt = 1 / 60): void {
  const frames = Math.round(seconds / dt);
  for (let i = 0; i < frames; i++) game.tick(dt);
}
function openWorker(game: Game, slotIndex = 0): Worker {
  const slot = game.state.slots[slotIndex]!;
  expect(game.openBarrel(slot.id)).toBe(true);
  const entity = game.state.entities[slot.entityId!]!;
  expect(entity.kind).toBe('worker');
  return entity as Worker;
}
function padWorker(game: Game, padIndex = 0): Worker {
  return game.state.entities[game.state.pads[padIndex]!.entityId!] as Worker;
}
function move(game: Game, entity: Entity, target: PlaceRef): boolean {
  expect(game.beginDrag(entity.id)).toBe(true);
  return game.drop(target);
}
function assertOwnership(game: Game): void {
  const owned = new Set<string>();
  const places = [...game.state.slots, ...game.state.pads];
  for (const place of places) {
    if (place.reserved) {
      expect(place.entityId).toBeNull();
      expect(game.state.drag?.source.id).toBe(place.id);
    }
    if (!place.entityId) continue;
    expect(owned.has(place.entityId)).toBe(false);
    owned.add(place.entityId);
    const entity = game.state.entities[place.entityId]!;
    expect(entity).toBeDefined();
    expect(entity.location.kind).not.toBe('drag');
    if (entity.location.kind !== 'drag') expect(entity.location.id).toBe(place.id);
  }
  if (game.state.drag) {
    expect(owned.has(game.state.drag.entityId)).toBe(false);
    owned.add(game.state.drag.entityId);
    expect(game.state.entities[game.state.drag.entityId]?.location.kind).toBe('drag');
  }
  expect([...owned].sort()).toEqual(Object.keys(game.state.entities).sort());
  expect(game.state.coins).toBeGreaterThanOrEqual(0);
}
function workerValue(game: Game): number {
  return Object.values(game.state.entities).reduce((sum, entity) => sum + (entity.kind === 'worker' ? 2 ** (entity.level - 1) : 0), 0);
}

describe('deterministic setup and path', () => {
  it('starts with one working miner, six mixed barrels, zero coins and three priced locks', () => {
    const game = new Game();
    expect(game.state.coins).toBe(0);
    expect(game.state.slots).toHaveLength(6);
    expect(game.state.pads.map((pad) => pad.unlocked)).toEqual([true, false, false, false]);
    expect(game.state.pads.map((pad) => pad.price)).toEqual([0, 50, 150, 300]);
    expect(padWorker(game).level).toBe(1);
    expect(game.state.stones.length).toBe(CONFIG.stones.initialCount);
    expect(game.state.slots.map((slot) => {
      const entity = game.state.entities[slot.entityId!];
      return entity?.kind === 'barrel' ? entity.content : null;
    })).toEqual(['worker', 'worker', 'coins', 'bomb', 'worker', 'worker']);
    assertOwnership(game);
  });

  it('parameterizes straight runs and bends by distance with continuous position and heading', () => {
    const straight = CONFIG.path.right - CONFIG.path.left;
    const boundaries = [straight, straight + Math.PI * CONFIG.path.bendRadius, straight * 2 + Math.PI * CONFIG.path.bendRadius];
    for (const distance of boundaries) {
      const before = samplePath(distance - 0.00001);
      const after = samplePath(distance + 0.00001);
      expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeCloseTo(0.00002, 6);
      expect(Math.abs(Math.sin(after.angle - before.angle))).toBeLessThan(0.0001);
    }
    for (let d = 0; d < PATH_LENGTH - 0.01; d += 0.07) {
      const a = samplePath(d), b = samplePath(d + 0.01);
      expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeCloseTo(0.01, 6);
      expect(distanceToPath(a)).toBeLessThan(1e-9);
    }
    expect(samplePath(-100)).toEqual(samplePath(0));
    expect(samplePath(PATH_LENGTH + 100)).toEqual(samplePath(PATH_LENGTH));
  });




});

describe('atomic barrels, buying, and ownership', () => {
  it('opens workers and bombs on their exact carrier with stable entity IDs', () => {
    const game = new Game();
    for (const index of [0, 3]) {
      const slot = game.state.slots[index]!;
      const originalId = slot.entityId;
      expect(game.openBarrel(slot.id)).toBe(true);
      expect(slot.entityId).toBe(originalId);
      expect(game.openBarrel(slot.id)).toBe(false);
    }
    expect(game.state.entities[game.state.slots[0]!.entityId!]!.kind).toBe('worker');
    expect(game.state.entities[game.state.slots[3]!.entityId!]!.kind).toBe('bomb');
    assertOwnership(game);
  });

  it('grants coin content only once and leaves a genuinely empty carrier', () => {
    const game = new Game();
    const slot = game.state.slots[2]!;
    const originalId = slot.entityId!;
    expect(game.openBarrel(slot.id)).toBe(true);
    expect(game.openBarrel(slot.id)).toBe(false);
    expect(game.state.coins).toBe(50);
    expect(game.state.entities[originalId]).toBeUndefined();
    expect(slot.entityId).toBeNull();
    expect(game.state.stats.opened).toBe(1);
    assertOwnership(game);
  });

  it('rejects insufficient funds and charges a successful pad purchase exactly once', () => {
    const game = new Game();
    const pad = game.state.pads[1]!;
    expect(game.buyPad(pad.id)).toBe(false);
    expect(game.state.coins).toBe(0);
    game.openBarrel('slot-2');
    expect(game.buyPad(pad.id)).toBe(true);
    expect(game.buyPad(pad.id)).toBe(false);
    expect(game.buyPad('unknown')).toBe(false);
    expect(game.state.coins).toBe(0);
    expect(pad.unlocked).toBe(true);
    expect(game.state.stats.purchased).toBe(1);
    expect(game.state.tutorial.bought).toBe(true);
  });

  it('reserves the source and rejects reentrant beginDrag without duplicating ownership', () => {
    const game = new Game();
    const worker = openWorker(game);
    const other = openWorker(game, 1);
    expect(game.beginDrag(worker.id)).toBe(true);
    expect(game.beginDrag(worker.id)).toBe(false);
    expect(game.beginDrag(other.id)).toBe(false);
    expect(game.state.slots[0]!.reserved).toBe(true);
    expect(game.state.slots[0]!.entityId).toBeNull();
    expect(worker.location.kind).toBe('drag');
    expect(game.openBarrel('slot-0')).toBe(false);
    assertOwnership(game);
    expect(game.cancelDrag()).toBe(true);
    expect(game.cancelDrag()).toBe(false);
    expect(game.state.slots[0]!.entityId).toBe(worker.id);
    expect(game.state.slots[0]!.reserved).toBe(false);
    assertOwnership(game);
  });

  it('rejects nonexistent entities and barrels as draggable items', () => {
    const game = new Game();
    expect(game.beginDrag('missing')).toBe(false);
    expect(game.beginDrag(game.state.slots[0]!.entityId!)).toBe(false);
    expect(game.drop(null)).toBe(false);
    expect(game.cancelDrag()).toBe(false);
    assertOwnership(game);
  });

  it('returns a worker to its exact source on locked, occupied-barrel and invalid drops', () => {
    const game = new Game();
    const worker = openWorker(game);
    for (const target of [{ kind: 'pad', id: 'pad-1' }, { kind: 'slot', id: 'slot-4' }, { kind: 'slot', id: 'missing' }, null] as const) {
      expect(game.beginDrag(worker.id)).toBe(true);
      expect(game.canDrop(target)).toBe(false);
      expect(game.drop(target)).toBe(false);
      expect(game.state.slots[0]!.entityId).toBe(worker.id);
      expect(game.state.drag).toBeNull();
      assertOwnership(game);
    }
  });

  it('places on bought pads, moves between pads and returns to a free belt carrier', () => {
    const game = new Game();
    const worker = openWorker(game);
    game.openBarrel('slot-2');
    game.buyPad('pad-1');
    expect(move(game, worker, { kind: 'pad', id: 'pad-1' })).toBe(true);
    expect(game.state.tutorial.placed).toBe(true);
    expect(move(game, padWorker(game), { kind: 'slot', id: 'slot-2' })).toBe(true);
    expect(move(game, worker, { kind: 'pad', id: 'pad-0' })).toBe(true);
    expect(game.state.pads[1]!.entityId).toBeNull();
    expect(game.state.pads[0]!.entityId).toBe(worker.id);
    assertOwnership(game);
  });

  it('dropping back onto the reserved source is an exact no-op', () => {
    const game = new Game();
    const worker = openWorker(game);
    const value = workerValue(game);
    expect(move(game, worker, { kind: 'slot', id: 'slot-0' })).toBe(true);
    expect(workerValue(game)).toBe(value);
    expect(game.state.stats.merged).toBe(0);
    expect(game.state.slots[0]!.reserved).toBe(false);
    assertOwnership(game);
  });
});

describe('merge invariants and progression', () => {
  it.each([1, 2, 3, 4])('supports the legal level %i upgrade while conserving worker value', (level) => {
    const game = new Game();
    const source = openWorker(game), destination = padWorker(game);
    source.level = destination.level = level;
    const value = workerValue(game);
    expect(move(game, source, { kind: 'pad', id: 'pad-0' })).toBe(true);
    expect(destination.level).toBe(level + 1);
    expect(workerValue(game)).toBe(value);
    assertOwnership(game);
  });

  it('merges on belt, preserves the target ID and rejects repeated drop', () => {
    const game = new Game();
    const source = openWorker(game), destination = openWorker(game, 1);
    const value = workerValue(game);
    expect(move(game, source, { kind: 'slot', id: 'slot-1' })).toBe(true);
    expect(destination.level).toBe(2);
    expect(game.state.entities[source.id]).toBeUndefined();
    expect(game.state.slots[1]!.entityId).toBe(destination.id);
    expect(game.state.slots[0]!.entityId).toBeNull();
    expect(game.drop({ kind: 'slot', id: 'slot-1' })).toBe(false);
    expect(workerValue(game)).toBe(value);
    expect(game.state.stats.merged).toBe(1);
    assertOwnership(game);
  });

  it('merges into a mining worker, resets its swing and keeps the destination occupied', () => {
    const game = new Game();
    advance(game, 0.2);
    const source = openWorker(game), destination = padWorker(game);
    expect(destination.mining.phase).toBeGreaterThan(0);
    expect(move(game, source, { kind: 'pad', id: 'pad-0' })).toBe(true);
    expect(destination.level).toBe(2);
    expect(destination.mining).toEqual({ phase: 0, targetId: null, hit: false });
    expect(game.state.pads[0]!.entityId).toBe(destination.id);
    assertOwnership(game);
  });

  it('does not swap or lose workers with unequal levels', () => {
    const game = new Game();
    const source = openWorker(game), destination = openWorker(game, 1);
    destination.level = 2;
    const value = workerValue(game);
    expect(move(game, source, { kind: 'slot', id: 'slot-1' })).toBe(false);
    expect(source.level).toBe(1);
    expect(destination.level).toBe(2);
    expect(workerValue(game)).toBe(value);
    expect(game.state.slots[0]!.entityId).toBe(source.id);
    assertOwnership(game);
  });



  it('achieves the goal via real barrels/merges and purchase, only once, without ending play', () => {
    const game = new Game();
    const a = openWorker(game, 0), b = openWorker(game, 1), c = openWorker(game, 4);
    expect(move(game, a, { kind: 'pad', id: 'pad-0' })).toBe(true);
    expect(move(game, b, { kind: 'slot', id: 'slot-4' })).toBe(true);
    expect(move(game, c, { kind: 'pad', id: 'pad-0' })).toBe(true);
    expect(padWorker(game).level).toBe(3);
    expect(game.state.goalReached).toBe(false);
    game.openBarrel('slot-2');
    game.buyPad('pad-1');
    expect(game.state.goalReached).toBe(true);
    expect(game.state.events.filter((event) => event.type === 'goal')).toHaveLength(1);
    const before = game.state.time;
    advance(game, 1);
    expect(game.state.time).toBeGreaterThan(before);
    expect(game.state.paused).toBe(false);
    assertOwnership(game);
  });
});

describe('conveyor capacity and drag interruptions', () => {








  it('safe pause cancels a drag and discards hidden time', () => {
    const game = new Game();
    const worker = openWorker(game);
    game.beginDrag(worker.id);
    game.setPaused(true);
    expect(game.state.drag).toBeNull();
    expect(game.state.slots[0]!.reserved).toBe(false);
    expect(game.state.slots[0]!.entityId).toBe(worker.id);
    const before = structuredClone(game.state);
    game.tick(300);
    expect(game.state).toEqual(before);
    expect(game.beginDrag(worker.id)).toBe(false);
    expect(game.buyPad('pad-1')).toBe(false);
    expect(game.openBarrel('slot-2')).toBe(false);
    game.setPaused(false);
    game.tick(300);
    expect(game.state.time).toBeCloseTo(CONFIG.simulation.maxDelta);
    assertOwnership(game);
  });
});

describe('mining impact, rewards and bombs', () => {
  it('earns from the starting level-one miner and levels make a measurable difference', () => {
    const levelOne = new Game();
    const levelTwo = new Game();
    padWorker(levelTwo).level = 2;
    advance(levelOne, 30);
    advance(levelTwo, 30);
    expect(levelOne.state.coins).toBeGreaterThan(0);
    expect(levelTwo.state.coins).toBeGreaterThan(levelOne.state.coins);
    expect(levelOne.state.stats.destroyed).toBeGreaterThan(0);
  });

  it('applies mining damage only at the visible swing impact phase', () => {
    const c = config(); c.stones.speed = 0; c.stones.acceleration = 0;
    const game = new Game(c);
    advance(game, 0.5);
    expect(game.state.events.filter((event) => event.type === 'hit')).toHaveLength(0);
    const targetId = padWorker(game).mining.targetId!;
    const target = game.state.stones.find((stone) => stone.id === targetId)!;
    const hp = target.hp;
    advance(game, 0.15);
    expect(game.state.events.filter((event) => event.type === 'hit')).toHaveLength(1);
    expect(target.hp).toBe(Math.max(0, hp - CONFIG.mining.damageByLevel[0]!));
    advance(game, 0.4);
    expect(game.state.events.filter((event) => event.type === 'hit')).toHaveLength(1);
  });

  it('workers on the belt and in drag never mine', () => {
    const game = new Game();
    const worker = padWorker(game);
    game.openBarrel('slot-2');
    expect(move(game, worker, { kind: 'slot', id: 'slot-2' })).toBe(true);
    advance(game, 5);
    expect(game.state.events.filter((event) => event.type === 'hit')).toHaveLength(0);
    game.beginDrag(worker.id);
    advance(game, 5);
    expect(game.state.events.filter((event) => event.type === 'hit')).toHaveLength(0);
    expect(game.state.coins).toBe(50);
    assertOwnership(game);
  });

  it('awards exactly once when two miners reach a lethal impact together', () => {
    const c = config(); c.stones.speed = 0; c.stones.acceleration = 0;
    const game = new Game(c);
    const worker = openWorker(game);
    game.openBarrel('slot-2'); game.buyPad('pad-1');
    move(game, worker, { kind: 'pad', id: 'pad-1' });
    const firstPad = game.state.pads[0]!, secondPad = game.state.pads[1]!;
    secondPad.x = firstPad.x; secondPad.z = firstPad.z;
    const stone = game.state.stones[0]!;
    stone.distance = firstPad.x - CONFIG.path.left;
    stone.hp = 2; stone.reward = 17;
    game.state.stones = [stone];
    game.drainEvents();
    advance(game, 0.7);
    expect(game.state.coins).toBe(17);
    expect(game.state.stats.destroyed).toBe(1);
    expect(game.state.events.filter((event) => event.type === 'destroy')).toHaveLength(1);
    expect(damageStone(game, stone.id, 100)).toBe(false);
    expect(game.state.coins).toBe(17);
  });

  it('centralizes rewards so repeated lethal damage and visual events cannot award twice', () => {
    const game = new Game();
    const stone = game.state.stones[0]!;
    expect(damageStone(game, stone.id, 100)).toBe(true);
    expect(damageStone(game, stone.id, 100)).toBe(false);
    const coins = game.state.coins;
    expect(coins).toBe(stone.reward);
    expect(game.drainEvents()).toHaveLength(2);
    expect(game.drainEvents()).toHaveLength(0);
    expect(game.state.coins).toBe(coins);
    expect(damageStone(game, 'missing', 100)).toBe(false);
    expect(damageStone(game, game.state.stones[0]!.id, -1)).toBe(false);
    expect(damageStone(game, game.state.stones[0]!.id, Number.NaN)).toBe(false);
  });

  it('applies a bomb only on a live valid track area, pays exact rewards and consumes it once', () => {
    const game = new Game();
    game.openBarrel('slot-3');
    const bombId = game.state.slots[3]!.entityId!;
    const target = { kind: 'track' as const, ...samplePath(5) };
    const expected = game.state.stones.filter((stone) => {
      const p = samplePath(stone.distance);
      return Math.hypot(p.x - target.x, p.z - target.z) <= CONFIG.bomb.radius;
    });
    expect(game.beginDrag(bombId)).toBe(true);
    expect(game.canDrop(target)).toBe(true);
    expect(game.drop(target)).toBe(true);
    expect(game.state.coins).toBe(expected.reduce((sum, stone) => sum + stone.reward, 0));
    expect(game.state.stats.destroyed).toBe(expected.length);
    expect(game.state.stats.bombsUsed).toBe(1);
    expect(game.state.entities[bombId]).toBeUndefined();
    expect(game.state.slots[3]!.entityId).toBeNull();
    expect(game.drop(target)).toBe(false);
    expect(game.state.tutorial.bombed).toBe(true);
    for (const victim of expected) expect(damageStone(game, victim.id, 100)).toBe(false);
    assertOwnership(game);
  });

  it('does not repay a stone bombed just before the miner impact', () => {
    const game = new Game();
    advance(game, 0.5);
    const targetId = padWorker(game).mining.targetId!;
    const stone = game.state.stones.find((candidate) => candidate.id === targetId)!;
    game.openBarrel('slot-3');
    const bombId = game.state.slots[3]!.entityId!;
    game.beginDrag(bombId);
    expect(game.drop({ kind: 'track', ...samplePath(stone.distance) })).toBe(true);
    const coins = game.state.coins;
    const destroyed = game.state.stats.destroyed;
    advance(game, 0.2);
    expect(game.state.coins).toBe(coins);
    expect(game.state.stats.destroyed).toBe(destroyed);
    expect(game.state.events.filter((event) => event.type === 'destroy' && event.stoneId === targetId)).toHaveLength(1);
  });

  it('returns invalid, empty-area, non-finite and off-track bomb drops without loss', () => {
    const game = new Game();
    game.openBarrel('slot-3');
    const bombId = game.state.slots[3]!.entityId!;
    for (const target of [
      { kind: 'track', x: 0, z: CONFIG.path.runs[0]! + CONFIG.path.bendRadius }, { kind: 'track', x: 0, z: 100 },
      { kind: 'track', x: Number.NaN, z: CONFIG.path.runs[0]! }, { kind: 'pad', id: 'pad-0' },
    ] as const) {
      expect(game.beginDrag(bombId)).toBe(true);
      expect(game.canDrop(target)).toBe(false);
      expect(game.drop(target)).toBe(false);
      expect(game.state.slots[3]!.entityId).toBe(bombId);
    }
    game.state.stones = [];
    game.beginDrag(bombId);
    expect(game.drop({ kind: 'track', x: 0, z: CONFIG.path.runs[0]! })).toBe(false);
    expect(game.state.coins).toBe(0);
    expect(game.state.stats.bombsUsed).toBe(0);
    assertOwnership(game);
  });

  it('can return a bomb to another empty belt carrier but never merge it', () => {
    const game = new Game();
    game.openBarrel('slot-3'); game.openBarrel('slot-2');
    const bomb = game.state.entities[game.state.slots[3]!.entityId!]!;
    expect(move(game, bomb, { kind: 'slot', id: 'slot-2' })).toBe(true);
    expect(move(game, bomb, { kind: 'slot', id: 'slot-0' })).toBe(false);
    expect(game.state.slots[2]!.entityId).toBe(bomb.id);
    assertOwnership(game);
  });
});

describe('time, reset and adversarial command sequences', () => {
  it('simulates identical outcomes at 30/60/120 FPS', () => {
    const sixty = new Game(), thirty = new Game(), oneTwenty = new Game();
    advance(sixty, 15, 1 / 60); advance(thirty, 15, 1 / 30); advance(oneTwenty, 15, 1 / 120);
    expect(thirty.state).toEqual(sixty.state);
    expect(oneTwenty.state).toEqual(sixty.state);
  });

  it('ignores non-finite/nonpositive dt and bounds events without bounding logical rewards', () => {
    const game = new Game();
    for (const dt of [0, -1, NaN, Infinity]) game.tick(dt);
    expect(game.state.time).toBe(0);
    const reward = game.state.stones.reduce((sum, stone) => sum + stone.reward, 0);
    for (const stone of [...game.state.stones]) damageStone(game, stone.id, 100);
    expect(game.state.events.length).toBeLessThanOrEqual(CONFIG.simulation.maxEvents);
    expect(game.state.coins).toBe(reward);
    expect(game.state.stats.destroyed).toBe(CONFIG.stones.initialCount);
  });

  it('resets money, drag, reservations, tutorial, events, cooldowns and entity generations', () => {
    const game = new Game();
    const worker = openWorker(game);
    game.openBarrel('slot-2'); game.buyPad('pad-1');
    advance(game, 2);
    game.beginDrag(worker.id);
    const oldEntity = worker.id;
    for (let reset = 0; reset < 5; reset++) game.reset();
    expect(game.state.time).toBe(0);
    expect(game.state.coins).toBe(0);
    expect(game.state.drag).toBeNull();
    expect(game.state.events).toHaveLength(0);
    expect(game.state.goalReached).toBe(false);
    expect(Object.values(game.state.tutorial).every((value) => !value)).toBe(true);
    expect(game.state.slots.every((slot) => !slot.reserved)).toBe(true);
    expect(game.beginDrag(oldEntity)).toBe(false);
    expect(game.drop({ kind: 'pad', id: 'pad-0' })).toBe(false);
    const pristine = new Game();
    advance(game, 10); advance(pristine, 10);
    expect(game.state.coins).toBe(pristine.state.coins);
    expect(game.state.stats).toEqual(pristine.state.stats);
    expect(game.state.stones.map((stone) => [stone.distance, stone.hp])).toEqual(pristine.state.stones.map((stone) => [stone.distance, stone.hp]));
    assertOwnership(game);
  });

  it('conserves unique ownership under thousands of interrupted and repeated commands', () => {
    const game = new Game();
    let seed = 321;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 2400; i++) {
      const action = Math.floor(random() * 9);
      const slot = game.state.slots[Math.floor(random() * game.state.slots.length)]!;
      const pad = game.state.pads[Math.floor(random() * game.state.pads.length)]!;
      const entities = Object.values(game.state.entities);
      if (action === 0) game.openBarrel(slot.id);
      if (action === 1) game.beginDrag(entities[Math.floor(random() * entities.length)]!.id);
      if (action === 2) game.drop({ kind: 'slot', id: slot.id });
      if (action === 3) game.drop({ kind: 'pad', id: pad.id });
      if (action === 4) game.drop({ kind: 'track', ...samplePath(random() * PATH_LENGTH) });
      if (action === 5) game.cancelDrag();
      if (action === 6) game.buyPad(pad.id);
      if (action === 7) { game.setPaused(true); game.setPaused(false); }
      game.tick(1 / 30);
      assertOwnership(game);
      expect(game.state.stones.length).toBeLessThanOrEqual(200);
    }
  });
});
