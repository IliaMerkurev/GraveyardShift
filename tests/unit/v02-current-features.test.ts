import { describe, expect, it } from 'vitest';
import { Game } from '../../src/game/Simulation';
import { CONFIG } from '../../src/game/config';
import { damageStone, openBarrel, workerBarrelRange, workerUpgradePrice } from '../../src/game/commands';
import { effectiveForwardSpeed, forwardSpeed } from '../../src/game/motion';
import type { ContentKind, Worker } from '../../src/game/GameState';

const advance = (g: Game, seconds: number) => { for (let i = 0; i < Math.round(seconds * 60); i++) g.tick(1 / 60); };
function game() { const c = structuredClone(CONFIG); c.mining.radius = 0; return new Game(c); }
function item(g: Game, kind: ContentKind, index = 0) {
  const slot = g.state.slots[index]!;
  const barrel = g.state.entities[slot.entityId!]!;
  if (barrel.kind !== 'barrel') throw Error('Fixture needs unopened barrel');
  barrel.content = kind; expect(g.openBarrel(slot.id)).toBe(true); return barrel.id;
}
const head = (g: Game) => Math.max(...g.state.stones.map(s => s.distance));
const worker = (g: Game) => g.state.entities[g.state.pads[0]!.entityId!] as Worker;
function ownership(g: Game) {
  const owned: string[] = [];
  for (const p of [...g.state.slots, ...g.state.pads, ...g.state.storage]) {
    if (p.entityId) { owned.push(p.entityId); const e = g.state.entities[p.entityId]!; expect(e).toBeDefined(); expect(e.location.kind).not.toBe('drag'); if (e.location.kind !== 'drag') expect(e.location.id).toBe(p.id); }
    if (p.reserved) { expect(p.entityId).toBeNull(); expect(g.state.drag?.source.id).toBe(p.id); }
  }
  if (g.state.drag) { owned.push(g.state.drag.entityId); expect(g.state.entities[g.state.drag.entityId]!.location.kind).toBe('drag'); }
  expect(new Set(owned).size).toBe(owned.length); expect(owned.sort()).toEqual(Object.keys(g.state.entities).sort());
}

describe('current new gameplay features only', () => {
  it('snake pause freezes rewind, recoil and difficulty while belt runs; refresh does not stack; global pause freezes everything', () => {
    const g = game(); g.useRewind(item(g, 'rewind')); advance(g, .2);
    g.state.stones[0]!.bounceRemaining = .1;
    g.useSlow(item(g, 'slow', 1)); const positions = g.state.stones.map(s => s.distance), difficulty = g.state.difficultyTime, belt = g.state.slots[0]!.x;
    advance(g, 1); expect(g.state.stones.map(s => s.distance)).toEqual(positions); expect(g.state.stones[0]!.bounceRemaining).toBe(.1); expect(g.state.difficultyTime).toBeCloseTo(difficulty); expect(g.state.slots[0]!.x).not.toBe(belt);
    g.useSlow(item(g, 'slow', 2)); expect(g.state.slowRemaining).toBe(CONFIG.slow.duration);
    g.setPaused(true); const paused = structuredClone(g.state); g.tick(100); expect(g.state).toEqual(paused); g.setPaused(false);
    advance(g, CONFIG.slow.duration); expect(g.state.difficultyTime).toBeCloseTo(difficulty); expect(g.state.stones.map(s => s.distance)).toEqual(positions);
    advance(g, 1 / 60); expect(head(g)).toBeLessThan(Math.max(...positions)); expect(g.state.difficultyTime).toBeGreaterThan(difficulty);
  });
  it('pause keeps gap recovery and rendered poses frozen even when a stone is removed', () => {
    const g = game(); const victim = g.state.stones[20]!; damageStone(g, victim.id, 99999);
    g.useSlow(item(g, 'slow')); const removedWhileFrozen = g.state.stones[30]!.id; damageStone(g, removedWhileFrozen, 99999);
    const positions = g.state.stones.map(s => [s.id, s.distance, s.frozenRenderDistance]); const wait = g.state.gapRecoveryRemaining;
    advance(g, .5); expect(g.state.stones.map(s => [s.id, s.distance, s.frozenRenderDistance])).toEqual(positions); expect(g.state.gapRecoveryRemaining).toBe(wait);
  });
  it('rewind smoothly reaches 2.35 before the first bend without teleport, loss or forward rewind', () => {
    const g = game(); const start = head(g), ids = g.state.stones.map(s => s.id), hp = g.state.stones.map(s => s.hp);
    expect(g.useRewind(item(g, 'rewind'))).toBe(true); expect(head(g)).toBe(start); expect(g.state.rewindTarget).toBeCloseTo(2.35);
    advance(g, CONFIG.stones.rewindDuration / 2); expect(head(g)).toBeCloseTo((start + 2.35) / 2);
    advance(g, CONFIG.stones.rewindDuration / 2); expect(head(g)).toBeCloseTo(2.35); expect(g.state.stones.map(s => s.id)).toEqual(ids); expect(g.state.stones.map(s => s.hp)).toEqual(hp);
    for (const s of g.state.stones) s.distance -= 1; const earlier = head(g); g.useRewind(item(g, 'rewind', 1)); expect(head(g)).toBe(earlier); expect(g.state.rewindTarget).toBeNull();
  });
  it('brake subtracts 20% of current speed permanently and preserves future acceleration', () => {
    const g = game(); g.state.difficultyTime = 30; const before = effectiveForwardSpeed(30, 0, g.config); const id = item(g, 'brake');
    expect(g.useBrake(id)).toBe(true); expect(g.useBrake(id)).toBe(false); const offset = g.state.permanentSpeedReduction;
    expect(offset).toBeCloseTo(before * .2); expect(effectiveForwardSpeed(30, offset, g.config)).toBeCloseTo(before * .8);
    expect(effectiveForwardSpeed(40, offset, g.config) - effectiveForwardSpeed(30, offset, g.config)).toBeCloseTo(forwardSpeed(40, g.config.stones) - forwardSpeed(30, g.config.stones));
    g.useBrake(item(g, 'brake', 1)); expect(g.state.permanentSpeedReduction).toBeCloseTo(offset + before * .8 * .2); ownership(g);
  });
  it('adaptive worker rolls favor lows, use pad workers at reveal time, and clamp when strongest worker is held', () => {
    const g = game(); worker(g).level = 20; expect(workerBarrelRange(g.state)).toEqual({ lowest: 10, highest: 19 });
    for (const [i, roll, level] of [[0, 0, 10], [1, .5, 12], [2, .999999, 19]]) {
      const slot = g.state.slots[i!]!, barrel = g.state.entities[slot.entityId!]!; if (barrel.kind !== 'barrel') throw Error('barrel'); barrel.content = 'worker';
      expect(openBarrel(g, slot.id, () => roll!)).toBe(true); expect((g.state.entities[barrel.id] as Worker).level).toBe(level);
    }
    g.state.workerDropBoost = 5; expect(g.beginDrag(worker(g).id)).toBe(true); expect(workerBarrelRange(g.state)).toEqual({ lowest: 1, highest: 1 }); g.cancelDrag(); ownership(g);
  });
  it('paid upgrades double cost, improve lower range after upper cap, then reject without charging', () => {
    const g = game(); g.state.coins = 1_000_000; expect(g.buyWorkerUpgrade()).toBe(false); expect(g.state.coins).toBe(1_000_000);
    worker(g).level = 4; const first = workerUpgradePrice(g.state, g.config)!;
    expect(g.buyWorkerUpgrade()).toBe(true); expect(workerUpgradePrice(g.state, g.config)).toBe(first * 2); expect(workerBarrelRange(g.state)).toEqual({ lowest: 2, highest: 4 });
    expect(g.buyWorkerUpgrade()).toBe(true); expect(workerBarrelRange(g.state)).toEqual({ lowest: 3, highest: 4 }); expect(g.buyWorkerUpgrade()).toBe(true);
    const coins = g.state.coins; expect(workerBarrelRange(g.state)).toEqual({ lowest: 4, highest: 4 }); expect(g.buyWorkerUpgrade()).toBe(false); expect(g.state.coins).toBe(coins);
    const poor = game(); worker(poor).level = 4; poor.state.coins = first - 1; expect(poor.buyWorkerUpgrade()).toBe(false); expect(poor.state.workerDropBoost).toBe(0); expect(poor.state.coins).toBe(first - 1);
  });
  it('three storage stands support click and atomic drop purchase, reservations, cancellation and stored use', () => {
    const g = game(); expect(g.state.storage.map(s => s.price)).toEqual([50, 150, 300]); g.state.coins = 500;
    expect(g.buyStorage('storage-0')).toBe(true); expect(g.buyStorage('storage-0')).toBe(false); const id = item(g, 'brake'); g.beginDrag(id);
    expect(g.drop({ kind: 'storage', id: 'storage-1' })).toBe(true); expect(g.state.coins).toBe(300); expect(g.state.stats.purchased).toBe(0);
    expect(g.beginDrag(id)).toBe(true); expect(g.state.storage[1]).toMatchObject({ reserved: true, entityId: null }); expect(g.useBrake(id)).toBe(false); expect(g.cancelDrag()).toBe(true); ownership(g);
    expect(g.useBrake(id)).toBe(true); expect(g.state.storage[1]!.entityId).toBeNull(); expect(g.useBrake(id)).toBe(false); ownership(g);
  });
  it('storage rejects worker and unaffordable bonus without charge or lost ownership', () => {
    const g = game(); g.state.coins = 49; const id = item(g, 'slow'); g.beginDrag(id); expect(g.drop({ kind: 'storage', id: 'storage-0' })).toBe(false); expect(g.state.coins).toBe(49); expect(g.state.storage[0]!.unlocked).toBe(false); ownership(g);
    g.state.coins = 500; g.beginDrag(worker(g).id); expect(g.drop({ kind: 'storage', id: 'storage-0' })).toBe(false); expect(g.state.coins).toBe(500); ownership(g);
  });
  it('worker pit discard releases ownership once without rewards; bonuses cannot be discarded', () => {
    const g = game(), id = worker(g).id; const coins = g.state.coins; g.beginDrag(id); expect(g.drop({ kind: 'discard' })).toBe(true); expect(g.state.entities[id]).toBeUndefined(); expect(g.state.pads[0]).toMatchObject({ reserved: false, entityId: null }); expect(g.state.coins).toBe(coins); expect(g.state.stats.merged).toBe(0); expect(g.drop({ kind: 'discard' })).toBe(false);
    const bonus = item(g, 'brake'); g.beginDrag(bonus); expect(g.drop({ kind: 'discard' })).toBe(false); expect(g.state.entities[bonus]).toBeDefined(); ownership(g);
  });
  it('50/50 odds split the bonus half equally across six bonuses, with no coin content', () => {
    const c = structuredClone(CONFIG); c.conveyor.starter = []; const g = new Game(c);
    expect(c.conveyor.workerWeight).toBe(.5); expect(c.conveyor.bombWeight).toBeCloseTo(.5 / 6); expect(c.conveyor.rewindWeight).toBeCloseTo(.5 / 6); expect(c.conveyor.brakeWeight).toBeCloseTo(.5 / 6); expect(c.conveyor.halfSpeedWeight).toBeCloseTo(.5 / 6); expect(c.conveyor.tailBlastWeight).toBeCloseTo(.5 / 6);
    const harness = g as unknown as { random: () => number; spawnBarrel: (id: string) => void }; const slot = g.state.slots[0]!;
    for (const [roll, kind] of [[0, 'worker'], [.499999, 'worker'], [.5, 'bomb'], [.583333, 'bomb'], [.583334, 'rewind'], [.666667, 'brake'], [.750001, 'halfSpeed'], [.833334, 'tailBlast'], [.916667, 'slow'], [.999999, 'slow']] as const) {
      delete g.state.entities[slot.entityId!]; slot.entityId = null; harness.random = () => roll; harness.spawnBarrel(slot.id); expect(g.state.entities[slot.entityId!]).toMatchObject({ kind: 'barrel', content: kind });
    }
    expect(g.state.coins).toBe(c.economy.initialCoins);
  });
  it('held bonus survives belt expiry, cancels to its reserved carrier, then activates by field drop exactly once', () => {
    const g = game(), id = item(g, 'slow'); g.beginDrag(id); g.state.slots[0]!.x = g.config.conveyor.left + .001; g.tick(g.config.simulation.fixedStep);
    expect(g.state.drag?.entityId).toBe(id); expect(g.state.entities[id]).toBeDefined(); expect(g.useSlow(id)).toBe(false); ownership(g);
    expect(g.cancelDrag()).toBe(true); expect(g.state.slots[0]!.entityId).toBe(id); g.beginDrag(id);
    expect(g.drop({ kind: 'field', x: 0, z: -4 })).toBe(true); expect(g.state.slowRemaining).toBe(g.config.slow.duration); expect(g.state.entities[id]).toBeUndefined(); expect(g.drop({ kind: 'field', x: 0, z: -4 })).toBe(false); ownership(g);
    const unheld = item(g, 'brake', 1); g.state.slots[1]!.x = g.config.conveyor.left + .001; g.tick(g.config.simulation.fixedStep); expect(g.state.entities[unheld]).toBeUndefined(); expect(g.useBrake(unheld)).toBe(false); ownership(g);
  });
});
