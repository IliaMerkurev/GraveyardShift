import { CONFIG, type GameConfig } from './config';
import { createMiningState, type DropTarget, type Entity, type GameEvent, type GameState, type Stone, type Worker } from './GameState';
import * as commands from './commands';
import { miningDamage, miningPeriod } from './progression';
import { effectiveForwardSpeed, attractionSpeed } from './motion';
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
        c.stones.spacing <= 0 || c.stones.startFraction <= 0 || c.stones.startFraction >= 1 ||
        c.slow.duration <= 0 ||
        !Number.isFinite(c.brake.reductionFraction) || c.brake.reductionFraction <= 0 || c.brake.reductionFraction >= 1 ||
        !Number.isFinite(c.brake.minimumBaseFraction) || c.brake.minimumBaseFraction <= 0 || c.brake.minimumBaseFraction > 1 ||
        !Number.isFinite(c.discard.x) || !Number.isFinite(c.discard.z) || !Number.isFinite(c.discard.radius) || c.discard.radius <= 0 ||
        c.stones.gapDelay < 0.25 || c.stones.gapDelay > 0.5 || c.stones.retractSpeed <= 0 || c.stones.rewindDuration <= 0 ||
        !Number.isFinite(c.stones.rewindBeforeFirstBend) || c.stones.rewindBeforeFirstBend < 0 ||
        c.stones.rewindBeforeFirstBend > c.path.right - c.path.left ||
        c.stones.accelerationGrowth < 0 || c.stones.attraction < 0 || c.stones.bounceDuration <= 0 || c.stones.bounceDistance < 0 ||
        c.stones.acceleration < 0 || c.stones.maxSpeed < c.stones.speed ||
        c.stones.speed < 0 || c.stones.resources.length === 0 ||
        c.conveyor.count < 1 || c.conveyor.right <= c.conveyor.left || c.conveyor.speed < 0 ||
        (c.conveyor.initialLeft!==undefined&&(!Number.isFinite(c.conveyor.initialLeft)||c.conveyor.initialLeft<c.conveyor.left||c.conveyor.initialLeft>=c.conveyor.right)) ||
        !Number.isFinite(c.mining.period) || c.mining.period <= 0 ||
        !Number.isFinite(c.mining.speedGrowth) || c.mining.speedGrowth < 1 ||
        !Number.isFinite(c.mining.minPeriod) || c.mining.minPeriod < c.simulation.fixedStep * 6 || c.mining.minPeriod > c.mining.period ||
        c.mining.impactPhase <= 0 || c.mining.impactPhase >= 1 ||
        c.simulation.fixedStep <= 0 || c.simulation.maxDelta < c.simulation.fixedStep ||
        c.pads.length === 0 || c.mining.damageByLevel.length === 0 || !Number.isFinite(c.mining.damageGrowth) || c.mining.damageGrowth < 1 ||
        c.mining.damageByLevel.some(damage => !Number.isFinite(damage) || damage <= 0 || damage > Number.MAX_SAFE_INTEGER)) {
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
    this.barrelCooldown = 0;
    const c = this.config;
    const slotSpacing = (c.conveyor.right - c.conveyor.left) / c.conveyor.count;
    this.state = {
      time: 0, difficultyTime: 0, coins: c.economy.initialCoins, workerDropBoost: 0, entities: {},
      slots: Array.from({ length: c.conveyor.count }, (_, i) => ({
        id: `slot-${i}`, x: c.conveyor.left + (((c.conveyor.initialLeft??c.conveyor.left)-c.conveyor.left+slotSpacing*(i+.5))%(c.conveyor.right-c.conveyor.left)), z: c.conveyor.z, entityId: null, reserved: false,
      })),
      pads: c.pads.map((pad, i) => ({ ...pad, id: `pad-${i}`, unlocked: i === 0, entityId: null, reserved: false })),
      storage: c.storage.map((stand, i) => ({ ...stand, id: `storage-${i}`, unlocked: false, entityId: null, reserved: false })),
      stones: [], drag: null, events: [], paused: false, conveyorPaused: false, goalReached: false, gameOver: false, slowRemaining: 0,
      headSpeed: 0, permanentSpeedReduction: 0, minimumForwardSpeed: c.stones.speed * c.brake.minimumBaseFraction, tailWaitingIds: [], gapRecoveryRemaining: 0, gapReadyAt: {}, rewindTarget: null, rewindSpeed: 0,
      tutorial: { opened: false, placed: false, merged: false, bought: false, bombed: false },
      stats: { opened: 0, merged: 0, purchased: 0, destroyed: 0, bombsUsed: 0, coinsEarned: 0 },
    };
    const pad = this.state.pads[0]!;
    const worker: Worker = { id: this.entityId(), kind: 'worker', location: { kind: 'pad', id: pad.id }, level: 1, mining: createMiningState() };
    this.state.entities[worker.id] = worker;
    pad.entityId = worker.id;
    // Keep the six original starter positions/order; preload incoming transit only.
    // Outgoing hidden slots start empty, so no rewards are discarded at reset.
    for (const slot of this.state.slots) if(slot.x >= (c.conveyor.initialLeft??c.conveyor.left)) this.spawnBarrel(slot.id);
    const head = getPathLength(c.path) * c.stones.startFraction;
    for (let i = 0; i < c.stones.initialCount; i++) this.spawnStone(head - (c.stones.initialCount - 1 - i) * c.stones.spacing);
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
      roll < this.config.conveyor.workerWeight + this.config.conveyor.bombWeight ? 'bomb' :
      roll < this.config.conveyor.workerWeight + this.config.conveyor.bombWeight + this.config.conveyor.rewindWeight ? 'rewind' :
      roll < this.config.conveyor.workerWeight + this.config.conveyor.bombWeight + this.config.conveyor.rewindWeight + this.config.conveyor.brakeWeight ? 'brake' :
      roll < this.config.conveyor.workerWeight + this.config.conveyor.bombWeight + this.config.conveyor.rewindWeight + this.config.conveyor.brakeWeight + this.config.conveyor.halfSpeedWeight ? 'halfSpeed' :
      roll < this.config.conveyor.workerWeight + this.config.conveyor.bombWeight + this.config.conveyor.rewindWeight + this.config.conveyor.brakeWeight + this.config.conveyor.halfSpeedWeight + this.config.conveyor.tailBlastWeight ? 'tailBlast' : 'slow');
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
    const result = commands.openBarrel(this, slotId, () => this.random()); this.updateConveyorPaused(); return result;
  }
  useHalfSpeed(entityId: string): boolean { return commands.useHalfSpeed(this, entityId); }
  useTailBlast(entityId: string): boolean { return commands.useTailBlast(this, entityId); }
  useBrake(entityId: string): boolean { return commands.useBrake(this, entityId); }
  useSlow(entityId: string): boolean { return commands.useSlow(this, entityId); }
  useRewind(entityId: string): boolean { return commands.useRewind(this, entityId); }
  buyPad(padId: string): boolean { return commands.buyPad(this, padId); }
  buyWorkerUpgrade(): boolean { return commands.buyWorkerUpgrade(this); }
  buyStorage(standId: string): boolean { return commands.buyStorage(this, standId); }
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
    if (this.state.paused || this.state.gameOver || !Number.isFinite(dt) || dt <= 0) return;
    this.accumulator += Math.min(dt, this.config.simulation.maxDelta);
    const fixed = this.config.simulation.fixedStep;
    while (this.accumulator + 1e-10 >= fixed) {
      this.accumulator = Math.max(0, this.accumulator - fixed);
      this.step(fixed);
      if (this.state.gameOver) { this.accumulator = 0; break; }
    }
  }

  private step(dt: number): void {
    this.state.time += dt;
    // Count only the unfrozen part of this step, including a fractional expiry.
    // Global pause skips step(); rewind and gap recovery still age difficulty.
    this.state.difficultyTime += dt - Math.min(dt, this.state.slowRemaining);
    this.tickStones(dt);
    if (this.state.gameOver) return;
    this.tickConveyor(dt);
    this.tickMining(dt);
    this.state.slowRemaining = this.state.slowRemaining - dt > 1e-9 ? this.state.slowRemaining - dt : 0;
  }

  private tickStones(dt: number): void {
    const c = this.config.stones;
    // Freeze every snake motion, including recoil and pending rewind. Mining,
    // conveyor and effects still run; difficulty excludes the same frozen interval.
    const frozenDt = Math.min(dt, this.state.slowRemaining);
    if (frozenDt > 0) {
      for (const id of Object.keys(this.state.gapReadyAt)) this.state.gapReadyAt[id]! += frozenDt;
      this.state.headSpeed = 0;
      dt -= frozenDt;
      if (dt <= 1e-9) return;
    }
    for (const stone of this.state.stones) delete stone.frozenRenderDistance;
    const speed = effectiveForwardSpeed(this.state.difficultyTime, this.state.permanentSpeedReduction, this.config, this.state.minimumForwardSpeed);
    const travel = speed * dt;
    const end = getPathLength(this.config.path);
    const ordered = [...this.state.stones].sort((a, b) => a.distance - b.distance);
    const previousHead = ordered.at(-1)?.distance ?? 0;
    for (const stone of ordered) stone.bounceRemaining = Math.max(0, (stone.bounceRemaining ?? 0) - dt);
    if (this.state.rewindTarget !== null) {
      const head = ordered.at(-1)?.distance ?? this.state.rewindTarget;
      const shift = Math.min(Math.max(0, head - this.state.rewindTarget), this.state.rewindSpeed * dt);
      for (const stone of ordered) { stone.distance -= shift; stone.bounceRemaining = 0; }
      this.state.headSpeed = -shift / dt;
      if (head - shift <= this.state.rewindTarget + 1e-9) {
        this.state.rewindTarget = null;
        this.state.rewindSpeed = 0;
      }
      // Keep the entire surviving chain/IDs intact while it travels backward.
      // Gap recovery and tail supply resume after the rewind has finished.
      return;
    }
    const held = new Set(this.state.tailWaitingIds);
    const survivingHeld = ordered.filter(stone => held.has(stone.id));
    this.state.tailWaitingIds = survivingHeld.map(stone => stone.id);
    if (survivingHeld.length) {
      const waitingTail = survivingHeld[0]!;
      const rear = ordered.filter(stone => !held.has(stone.id));
      const rearHead = rear.at(-1);
      const rearTravel = rearHead ? Math.min(travel, Math.max(0, waitingTail.distance - c.spacing - rearHead.distance)) : 0;
      const rearSections: Stone[][] = [];
      for (const [i, stone] of rear.entries()) {
        if (i === 0 || stone.distance - rear[i - 1]!.distance > c.spacing + 1e-9) rearSections.push([]);
        rearSections.at(-1)!.push(stone);
      }
      for (const [i, section] of rearSections.entries()) {
        let shift = rearTravel;
        if (i > 0) {
          const front = section[0]!;
          const gap = front.distance - rearSections[i - 1]!.at(-1)!.distance - c.spacing;
          const readyAt = this.state.gapReadyAt[front.id] ?? 0;
          shift = Math.max(-gap, this.state.time <= readyAt + 1e-9 ? 0 : -attractionSpeed(gap, c) * dt);
          if (gap + shift <= 1e-9) delete this.state.gapReadyAt[front.id];
        }
        shift = Math.min(shift, Math.max(0, waitingTail.distance - c.spacing - section.at(-1)!.distance));
        for (const stone of section) stone.distance += shift;
      }
      this.state.headSpeed = 0;
      if (rearHead && waitingTail.distance - rearHead.distance <= c.spacing + 1e-9) {
        this.state.tailWaitingIds = [];
        for (const stone of survivingHeld) { delete stone.waitingRenderDistance; stone.bounceRemaining = 0; }
      }
      // Seed only at the entrance. Never refill the blasted half immediately.
      let tail = rear[0]?.distance;
      if (tail === undefined) this.spawnStone(Math.min(0, waitingTail.distance - c.spacing));
      else while (tail >= c.spacing && this.state.stones.length < c.maxCount) {
        tail -= c.spacing;
        this.spawnStone(tail);
      }
      return;
    }
    // Snapshot rigid sections BEFORE moving. Moving the rear must never hide a
    // boundary or change which survivors belong to a paused/pulling section.
    const sections: Stone[][] = [];
    for (let i = 0; i < ordered.length; i++) {
      if (i === 0 || ordered[i]!.distance - ordered[i - 1]!.distance > c.spacing + 1e-9) sections.push([]);
      sections.at(-1)!.push(ordered[i]!);
    }
    for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
      const section = sections[sectionIndex]!;
      let shift = travel;
      if (sectionIndex > 0) {
        const front = section[0]!;
        const rear = sections[sectionIndex - 1]!.at(-1)!;
        // rear already moved this tick. Swept contact prevents crossings, even
        // when the moving rear reaches the front before its pause has elapsed.
        const gap = front.distance - rear.distance - c.spacing;
        const readyAt = this.state.gapReadyAt[front.id] ?? 0;
        const pull = this.state.time <= readyAt + 1e-9 ? 0 : attractionSpeed(gap, c) * dt;
        shift = Math.max(-gap, -pull);
        if (gap + shift <= 1e-9) {
          for (const stone of section) stone.bounceRemaining = c.bounceDuration;
          delete this.state.gapReadyAt[front.id];
        }
      }
      for (const stone of section) stone.distance += shift;
    }
    const open = ordered.filter((stone, i) => i > 0 && stone.distance - ordered[i - 1]!.distance > c.spacing + 1e-9);
    const openIds = new Set(open.map(s => s.id));
    for (const id of Object.keys(this.state.gapReadyAt)) if (!openIds.has(id)) delete this.state.gapReadyAt[id];
    this.state.gapRecoveryRemaining = open.length ? Math.max(0, Math.min(...open.map(s => (this.state.gapReadyAt[s.id] ?? 0) - this.state.time))) : 0;
    this.state.headSpeed = ((ordered.at(-1)?.distance ?? previousHead) - previousHead) / dt;
    const head = this.state.stones.reduce((max, stone) => Math.max(max, stone.distance), -Infinity);
    if (head >= end) {
      // Clamp the complete chain by the final fractional step; no survivors disappear.
      for (const stone of this.state.stones) stone.distance -= head - end;
      this.cancelDrag();
      this.state.gameOver = true;
      this.updateConveyorPaused();
      this.emit({ type: 'gameover', ...samplePath(end, this.config.path) });
      return;
    }
    // Supply the tail only at the entrance, never ahead of the existing head.
    let tail = this.state.stones.reduce((min, stone) => Math.min(min, stone.distance), Infinity);
    if (!Number.isFinite(tail)) { this.spawnStone(0); return; }
    while (tail >= this.config.stones.spacing && this.state.stones.length < this.config.stones.maxCount) {
      tail -= this.config.stones.spacing;
      this.spawnStone(tail);
    }
  }

  private updateConveyorPaused(): void {
    this.state.conveyorPaused = this.state.paused || this.state.gameOver;
  }

  private tickConveyor(dt: number): void {
    const c = this.config.conveyor;
    this.barrelCooldown = Math.max(0, this.barrelCooldown - dt);
    this.updateConveyorPaused();
    if (this.state.conveyorPaused) return;
    const width = c.right - c.left;
    const spacing = width / c.count;
    for (const slot of this.state.slots) {
      slot.x -= c.speed * dt;
      if (slot.x <= c.left) {
        const drag = this.state.drag;
        const carriesDrag = drag?.source.kind === 'slot' && drag.source.id === slot.id;
        // A picked-up item belongs to the gesture. Its empty, reserved carrier
        // keeps moving and wrapping so cancellation always has a safe return.
        if (!carriesDrag) {
          if (slot.entityId) {
            delete this.state.entities[slot.entityId];
            this.emit({ type: 'expired', x: c.left, z: slot.z, entityId: slot.entityId });
          }
          slot.entityId = null;
          slot.reserved = false;
        }
        // Carry fractional overrun through wrapping; never freeze a full belt.
        slot.x = c.left + ((slot.x - c.left) % width + width) % width;
        if (slot.x === c.left) slot.x = c.right;
      }
    }
    if (this.barrelCooldown <= 0) {
      const entrance = this.state.slots.find((slot) => !slot.entityId && !slot.reserved && slot.x >= c.right - spacing * 0.5);
      if (entrance) { this.spawnBarrel(entrance.id); this.barrelCooldown = c.spawnInterval; }
    }
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
        const point = previous && previous.distance >= 0 ? samplePath(previous.distance, this.config.path) : null;
        if (!point || Math.hypot(point.x - pad.x, point.z - pad.z) > c.radius) cycle.targetId = null;
      }
      if (!cycle.targetId && cycle.phase === 0) {
        let nearest: Stone | undefined;
        let closest = c.radius;
        for (const stone of this.state.stones) {
          if (stone.distance < 0) continue;
          const point = samplePath(stone.distance, this.config.path);
          const distance = Math.hypot(point.x - pad.x, point.z - pad.z);
          if (distance < closest) { nearest = stone; closest = distance; }
        }
        if (!nearest) continue;
        cycle.targetId = nearest.id;
        cycle.hit = false;
      }
      // The renderer reads this same normalized phase, so the whole swing speeds up.
      cycle.phase += dt / miningPeriod(worker.level, c);
      if (!cycle.hit && cycle.phase >= c.impactPhase) {
        cycle.hit = true;
        const stone = this.state.stones.find((candidate) => candidate.id === cycle.targetId);
        if (stone && stone.distance >= 0) {
          const point = samplePath(stone.distance, this.config.path);
          if (Math.hypot(point.x - pad.x, point.z - pad.z) <= c.radius) {
            const damage = miningDamage(worker.level, c);
            this.emit({ type: 'hit', x: point.x, z: point.z, entityId: worker.id, stoneId: stone.id, amount: damage });
            commands.damageStone(this, stone.id, damage);
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
