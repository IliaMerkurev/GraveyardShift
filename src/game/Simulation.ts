import { CONFIG, type GameConfig } from './config';
import { createMiningState, type DropTarget, type Entity, type GameEvent, type GameState, type Stone, type Worker } from './GameState';
import * as commands from './commands';
import { getPathLength, samplePath } from './path';

/** State and command facade. No rendering, DOM, timers, random globals or WebGL. */
export class Game {
  state!: GameState;
  readonly config: GameConfig;
  private accumulator = 0;
  private randomState = 0;
  private nextEntity = 0;
  private nextStone = 0;
  private barrelIndex = 0;
  private generation = 0;
  private stoneTravel = 0;
  private barrelCooldown = 0;

  constructor(config: GameConfig = CONFIG) {
    this.config = config;
    this.validateConfig();
    this.reset();
  }

  private validateConfig(): void {
    const c = this.config;
    if (c.path.runs.length < 2 || c.path.right <= c.path.left || c.path.bendRadius <= 0 ||
        c.stones.maxCount > 200 || c.stones.initialCount < 0 || c.stones.initialCount > c.stones.maxCount ||
        c.stones.spacing <= 0 || c.stones.speed < 0 || c.stones.resources.length === 0 ||
        c.conveyor.count < 1 || c.conveyor.right <= c.conveyor.left || c.conveyor.speed < 0 ||
        c.mining.period <= 0 || c.mining.impactPhase <= 0 || c.mining.impactPhase >= 1 ||
        c.simulation.fixedStep <= 0 || c.simulation.maxDelta < c.simulation.fixedStep ||
        c.pads.length === 0 || c.economy.maxLevel > c.mining.damageByLevel.length) {
      throw new Error('Invalid game configuration');
    }
    for (let i = 1; i < c.path.runs.length; i++) {
      if (Math.abs(c.path.runs[i]! - c.path.runs[i - 1]! - c.path.bendRadius * 2) > 0.00001) {
        throw new Error('Path runs must be separated by twice the bend radius');
      }
    }
  }

  reset(): void {
    this.generation++;
    this.accumulator = 0;
    this.randomState = this.config.seed >>> 0;
    this.nextEntity = 0;
    this.nextStone = 0;
    this.barrelIndex = 0;
    this.stoneTravel = 0;
    this.barrelCooldown = 0;
    const c = this.config;
    const slotSpacing = (c.conveyor.right - c.conveyor.left) / c.conveyor.count;
    this.state = {
      time: 0, coins: c.economy.initialCoins, entities: {},
      slots: Array.from({ length: c.conveyor.count }, (_, i) => ({
        id: `slot-${i}`, x: c.conveyor.left + slotSpacing * (i + 0.5), z: c.conveyor.z, entityId: null, reserved: false,
      })),
      pads: c.pads.map((pad, i) => ({ ...pad, id: `pad-${i}`, unlocked: i === 0, entityId: null, reserved: false })),
      stones: [], drag: null, events: [], paused: false, conveyorPaused: false, goalReached: false,
      tutorial: { opened: false, placed: false, merged: false, bought: false, bombed: false },
      stats: { opened: 0, merged: 0, purchased: 0, destroyed: 0, bombsUsed: 0, coinsEarned: 0 },
    };
    const pad = this.state.pads[0]!;
    const worker: Worker = { id: this.entityId(), kind: 'worker', location: { kind: 'pad', id: pad.id }, level: 1, mining: createMiningState() };
    this.state.entities[worker.id] = worker;
    pad.entityId = worker.id;
    for (const slot of this.state.slots) this.spawnBarrel(slot.id);
    const spacing = Math.min(c.stones.spacing, getPathLength(c.path) / Math.max(1, c.stones.initialCount));
    for (let i = 0; i < c.stones.initialCount; i++) this.spawnStone(i * spacing);
  }

  private entityId(): string { return `entity-${this.generation}-${this.nextEntity++}`; }

  private random(): number {
    // Explicit seeded LCG, reproducible across browsers and reset.
    this.randomState = (Math.imul(1664525, this.randomState) + 1013904223) >>> 0;
    return this.randomState / 4294967296;
  }

  private spawnBarrel(slotId: string): void {
    const slot = this.state.slots.find((candidate) => candidate.id === slotId);
    if (!slot || slot.reserved || slot.entityId) return;
    const starter = this.config.conveyor.starter[this.barrelIndex++];
    const roll = starter ? 0 : this.random();
    const content = starter ?? (roll < this.config.conveyor.workerWeight ? 'worker' :
      roll < this.config.conveyor.workerWeight + this.config.conveyor.coinWeight ? 'coins' : 'bomb');
    const entity: Entity = { id: this.entityId(), kind: 'barrel', content, location: { kind: 'slot', id: slot.id } };
    this.state.entities[entity.id] = entity;
    slot.entityId = entity.id;
  }

  private spawnStone(distance: number): void {
    if (this.state.stones.length >= this.config.stones.maxCount) return;
    const index = this.nextStone++;
    const resource = index % this.config.stones.resources.length;
    const material = this.config.stones.resources[resource]!;
    const stone: Stone = {
      id: `stone-${this.generation}-${index}`, distance, resource,
      hp: material.hp, maxHp: material.hp, reward: material.reward, variant: index % 3,
    };
    this.state.stones.push(stone);
  }

  emit = (event: GameEvent): void => {
    if (this.state.events.length >= this.config.simulation.maxEvents) this.state.events.shift();
    this.state.events.push(event);
  };

  drainEvents(): GameEvent[] { return this.state.events.splice(0); }

  openBarrel(slotId: string): boolean {
    const result = commands.openBarrel(this, slotId); this.updateConveyorPaused(); return result;
  }
  buyPad(padId: string): boolean { return commands.buyPad(this, padId); }
  beginDrag(entityId: string): boolean { return commands.beginDrag(this, entityId); }
  canDrop(target: DropTarget): boolean { return commands.canDrop(this, target); }
  drop(target: DropTarget): boolean {
    const result = commands.drop(this, target); this.updateConveyorPaused(); return result;
  }
  cancelDrag(): boolean {
    const result = commands.cancelDrag(this); this.updateConveyorPaused(); return result;
  }

  setPaused(paused: boolean): void {
    if (paused) this.cancelDrag();
    this.state.paused = paused;
    this.accumulator = 0;
    this.updateConveyorPaused();
  }

  /** Call from one requestAnimationFrame loop. Long gaps are clamped, never replayed. */
  tick(dt: number): void {
    if (this.state.paused || !Number.isFinite(dt) || dt <= 0) return;
    this.accumulator += Math.min(dt, this.config.simulation.maxDelta);
    const fixed = this.config.simulation.fixedStep;
    while (this.accumulator + 1e-10 >= fixed) {
      this.accumulator = Math.max(0, this.accumulator - fixed);
      this.step(fixed);
    }
  }

  private step(dt: number): void {
    this.state.time += dt;
    this.tickStones(dt);
    this.tickConveyor(dt);
    this.tickMining(dt);
  }

  private tickStones(dt: number): void {
    const travel = this.config.stones.speed * dt;
    const end = getPathLength(this.config.path);
    for (const stone of this.state.stones) stone.distance += travel;
    // Surviving stones leave without reward. Destroyed gaps stay empty and keep moving.
    this.state.stones = this.state.stones.filter((stone) => stone.distance <= end);
    this.stoneTravel += travel;
    while (this.stoneTravel + 1e-10 >= this.config.stones.spacing) {
      this.stoneTravel = Math.max(0, this.stoneTravel - this.config.stones.spacing);
      this.spawnStone(0);
    }
  }

  private updateConveyorPaused(): void {
    const c = this.config.conveyor;
    this.state.conveyorPaused = this.state.paused || this.state.drag !== null ||
      this.state.slots.some((slot) => (slot.entityId !== null || slot.reserved) && slot.x <= c.left + 1e-8);
  }

  private tickConveyor(dt: number): void {
    const c = this.config.conveyor;
    this.barrelCooldown = Math.max(0, this.barrelCooldown - dt);
    this.updateConveyorPaused();
    if (this.state.conveyorPaused) return;
    let travel = c.speed * dt;
    for (const slot of this.state.slots) {
      if (slot.entityId || slot.reserved) travel = Math.min(travel, Math.max(0, slot.x - c.left));
    }
    const width = c.right - c.left;
    const spacing = width / c.count;
    for (const slot of this.state.slots) {
      slot.x -= travel;
      if (slot.x <= c.left + 1e-8 && !slot.entityId && !slot.reserved) slot.x += width;
    }
    // Refill only at the right-hand entrance. A reserved source can never be filled.
    if (this.barrelCooldown <= 0) {
      const entrance = this.state.slots.find((slot) => !slot.entityId && !slot.reserved && slot.x >= c.right - spacing * 0.5);
      if (entrance) { this.spawnBarrel(entrance.id); this.barrelCooldown = c.spawnInterval; }
    }
    this.updateConveyorPaused();
  }

  private tickMining(dt: number): void {
    const c = this.config.mining;
    for (const pad of this.state.pads) {
      if (!pad.unlocked || !pad.entityId || pad.reserved) continue;
      const worker = this.state.entities[pad.entityId];
      if (!worker || worker.kind !== 'worker' || worker.location.kind !== 'pad') continue;
      const cycle = worker.mining;
      if (cycle.phase === 0 && cycle.targetId) {
        const previous = this.state.stones.find((stone) => stone.id === cycle.targetId);
        const point = previous ? samplePath(previous.distance, this.config.path) : null;
        if (!point || Math.hypot(point.x - pad.x, point.z - pad.z) > c.radius) cycle.targetId = null;
      }
      if (!cycle.targetId && cycle.phase === 0) {
        let nearest: Stone | undefined;
        let closest = c.radius;
        for (const stone of this.state.stones) {
          const point = samplePath(stone.distance, this.config.path);
          const distance = Math.hypot(point.x - pad.x, point.z - pad.z);
          if (distance < closest) { nearest = stone; closest = distance; }
        }
        if (!nearest) continue;
        cycle.targetId = nearest.id;
        cycle.hit = false;
      }
      cycle.phase += dt / c.period;
      if (!cycle.hit && cycle.phase >= c.impactPhase) {
        cycle.hit = true;
        const stone = this.state.stones.find((candidate) => candidate.id === cycle.targetId);
        if (stone) {
          const point = samplePath(stone.distance, this.config.path);
          if (Math.hypot(point.x - pad.x, point.z - pad.z) <= c.radius) {
            this.emit({ type: 'hit', x: point.x, z: point.z, entityId: worker.id, stoneId: stone.id, amount: c.damageByLevel[worker.level - 1]! });
            commands.damageStone(this, stone.id, c.damageByLevel[worker.level - 1]!);
          }
        }
      }
      if (cycle.phase + 1e-10 >= 1) {
        // Keep working a live target across swings; nearest-only reacquisition would
        // chip a different moving stone every time and starve level-one earnings.
        worker.mining = { phase: 0, targetId: cycle.targetId, hit: false };
      }
    }
  }
}
