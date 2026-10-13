import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Group, InstancedMesh, Matrix4, Mesh, Vector3 } from 'three';
import { Game } from '../../src/game/Simulation';
import { CONFIG } from '../../src/game/config';
import type { Barrel } from '../../src/game/GameState';
import { samplePath } from '../../src/game/path';
import { SceneView } from '../../src/render/SceneFactory';

// Keep the real scene graph and geometries: only the GPU and browser DOM are
// substituted, so these checks exercise SceneView's actual reconciliation.
vi.mock('three', async importOriginal => {
  const original = await importOriginal<typeof import('three')>();
  return {
    ...original,
    WebGLRenderer: class {
      outputColorSpace = '';
      setPixelRatio() {}
      setClearColor() {}
      setSize() {}
      render() {}
    },
  };
});

class TestElement {
  children: TestElement[] = [];
  parent: TestElement | null = null;
  style: Record<string, string> = {};
  dataset: Record<string, string> = {};
  attributes: Record<string, string> = {};
  className = '';
  textContent = '';
  hidden = false;
  removed = false;
  width = 0;
  height = 0;
  append(...elements: TestElement[]) {
    for (const element of elements) { element.parent = this; this.children.push(element); }
  }
  remove() {
    if (this.parent) this.parent.children = this.parent.children.filter(element => element !== this);
    this.parent = null;
    this.removed = true;
  }
  setAttribute(name: string, value: string) { this.attributes[name] = value; }
  getBoundingClientRect() { return { width: 390, height: 844, left: 0, top: 0, right: 390, bottom: 844 }; }
  getContext(type: string) {
    return type === '2d'
      ? { fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {} }
      : {};
  }
}

type EntityVisual = { kind: string; group: Group; label: TestElement; hit: TestElement };
type SceneInternals = {
  entities: Map<string, EntityVisual>;
  carriers: InstancedMesh;
  slotLabels: Map<string, TestElement>;
  headLabel: TestElement;
  pads: Map<string, { label: TestElement }>;
};

function setup() {
  const game = new Game();
  const view = new SceneView(new TestElement() as unknown as HTMLElement);
  const visuals = view as unknown as SceneInternals;
  const sync = () => view.sync(game.state, 0, { x: 0, z: 0 }, game.drainEvents());
  sync();
  return { game, view, visuals, sync };
}

function carrierPositions(carriers: InstancedMesh) {
  const matrix = new Matrix4();
  return Array.from({ length: carriers.count }, (_, index) => {
    carriers.getMatrixAt(index, matrix);
    const position = new Vector3().setFromMatrixPosition(matrix);
    return { x: position.x, z: position.z };
  });
}

beforeEach(() => {
  vi.stubGlobal('document', { createElement: () => new TestElement() });
  vi.stubGlobal('devicePixelRatio', 1);
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('v0.2 feedback: no empty barrel visuals', () => {
  it.each(['worker', 'coins', 'bomb', 'rewind', 'slow'] as const)(
    'opening %s removes the barrel mesh and gives exactly one real payload', content => {
      const { game, visuals, sync } = setup();
      const slot = game.state.slots[2];
      const id = slot.entityId!;
      (game.state.entities[id] as Barrel).content = content;
      const barrelVisual = visuals.entities.get(id)!;
      const disposeGeometry = vi.fn();
      barrelVisual.group.traverse(object => {
        if (object instanceof Mesh) object.geometry.addEventListener('dispose', disposeGeometry);
      });
      const initialCoins = game.state.coins;
      expect(game.openBarrel(slot.id)).toBe(true);
      sync();
      expect(barrelVisual.group.parent).toBeNull();
      expect(barrelVisual.label.removed).toBe(true);
      expect(barrelVisual.hit.removed).toBe(true);
      expect(disposeGeometry).toHaveBeenCalledTimes(2);
      expect(game.state.stats.opened).toBe(1);
      expect(game.openBarrel(slot.id)).toBe(false);
      if (content === 'coins') {
        expect(game.state.coins).toBe(initialCoins + CONFIG.economy.barrelCoins);
        expect(slot.entityId).toBeNull();
        expect(visuals.entities.has(id)).toBe(false);
        expect(visuals.carriers.count).toBe(game.state.slots.length - 1);
        expect(visuals.slotLabels.get(slot.id)!.hidden).toBe(true);
        expect(carrierPositions(visuals.carriers).some(position => Math.abs(position.x - slot.x) < 1e-5)).toBe(false);
      } else {
        expect(game.state.coins).toBe(initialCoins);
        expect(game.state.entities[id].kind).toBe(content);
        expect(visuals.entities.get(id)!.kind).toBe(content);
        expect(visuals.entities.get(id)!.group).not.toBe(barrelVisual.group);
        expect(visuals.carriers.count).toBe(game.state.slots.length);
      }
    },
  );

  it.each(['rewind', 'slow'] as const)('consuming %s clears its token, carrier and idle slot marker', content => {
    const { game, visuals, sync } = setup();
    const slot = game.state.slots[2];
    const id = slot.entityId!;
    (game.state.entities[id] as Barrel).content = content;
    game.openBarrel(slot.id);
    sync();
    const tokenVisual = visuals.entities.get(id)!;
    const consume = () => content === 'rewind' ? game.useRewind(id) : game.useSlow(id);
    expect(consume()).toBe(true);
    sync();
    expect(consume()).toBe(false);
    expect(tokenVisual.group.parent).toBeNull();
    expect(tokenVisual.hit.removed).toBe(true);
    expect(visuals.entities.has(id)).toBe(false);
    expect(visuals.carriers.count).toBe(game.state.slots.length - 1);
    expect(visuals.slotLabels.get(slot.id)!.hidden).toBe(true);
  });

  it('shows drop markers only during a drag, without drawing empty or reserved carriers', () => {
    const { game, view, visuals, sync } = setup();
    const source = game.state.slots[0], empty = game.state.slots[2];
    game.openBarrel(empty.id);
    game.openBarrel(source.id);
    const id = source.entityId!;
    sync();
    expect(visuals.carriers.count).toBe(game.state.slots.length - 1);
    expect(visuals.slotLabels.get(empty.id)!.hidden).toBe(true);
    expect(game.beginDrag(id)).toBe(true);
    sync();
    expect(visuals.carriers.count).toBe(game.state.slots.length - 2);
    expect(visuals.slotLabels.get(empty.id)!.hidden).toBe(false);
    expect(visuals.slotLabels.get(source.id)!.hidden).toBe(false);
    expect(visuals.slotLabels.get(game.state.slots[1].id)!.hidden).toBe(true);
    const targetPoint = view.project(empty, .1, true);
    expect(view.dropTarget(targetPoint.x, targetPoint.y)).toEqual({ kind: 'slot', id: empty.id });
    expect(game.drop({ kind: 'slot', id: empty.id })).toBe(true);
    sync();
    expect(visuals.carriers.count).toBe(game.state.slots.length - 1);
    expect([...visuals.slotLabels.values()].every(label => label.hidden)).toBe(true);
    expect(visuals.entities.get(id)!.group.position.x).toBeCloseTo(empty.x);
  });

  it('does not leave a carrier after placing a worker on a pad, and restores it on canceled pickup', () => {
    const { game, visuals, sync } = setup();
    const source = game.state.slots[0];
    game.openBarrel(source.id);
    const id = source.entityId!;
    sync();
    game.beginDrag(id);
    sync();
    expect(visuals.carriers.count).toBe(game.state.slots.length - 1);
    expect(game.drop(null)).toBe(false);
    sync();
    expect(visuals.carriers.count).toBe(game.state.slots.length);
    expect(source.entityId).toBe(id);
    expect(visuals.entities.get(id)!.kind).toBe('worker');
    game.state.coins = 50;
    game.buyPad('pad-1');
    game.beginDrag(id);
    expect(game.drop({ kind: 'pad', id: 'pad-1' })).toBe(true);
    sync();
    expect(visuals.carriers.count).toBe(game.state.slots.length - 1);
    expect(source.entityId).toBeNull();
    expect(visuals.slotLabels.get(source.id)!.hidden).toBe(true);
    expect(visuals.entities.get(id)!.group.position.x).toBe(game.state.pads[1].x);
  });

  it('clears a used bomb and leaves no container at its conveyor source', () => {
    const { game, visuals, sync } = setup();
    const source = game.state.slots[3];
    const id = source.entityId!;
    game.openBarrel(source.id);
    sync();
    const bombVisual = visuals.entities.get(id)!;
    game.beginDrag(id);
    expect(game.drop({ kind: 'track', ...samplePath(game.state.stones[20].distance) })).toBe(true);
    sync();
    expect(bombVisual.group.parent).toBeNull();
    expect(visuals.entities.has(id)).toBe(false);
    expect(visuals.carriers.count).toBe(game.state.slots.length - 1);
    expect(visuals.slotLabels.get(source.id)!.hidden).toBe(true);
  });

  it('rebuilds a real barrel carrier when an emptied slot refills, with no duplicate scene objects', () => {
    const { game, visuals, sync } = setup();
    const source = game.state.slots[2];
    const oldId = source.entityId!;
    game.openBarrel(source.id);
    sync();
    expect(visuals.carriers.count).toBe(game.state.slots.length - 1);
    source.x = CONFIG.conveyor.left;
    game.tick(CONFIG.simulation.fixedStep);
    sync();
    expect(source.entityId).not.toBeNull();
    expect(source.entityId).not.toBe(oldId);
    expect(game.state.entities[source.entityId!].kind).toBe('barrel');
    expect(visuals.entities.has(oldId)).toBe(false);
    expect(visuals.entities.get(source.entityId!)!.kind).toBe('barrel');
    expect(visuals.carriers.count).toBe(game.state.slots.length);
    expect(visuals.entities.size).toBe(Object.keys(game.state.entities).length);
    game.reset();
    sync();
    expect(visuals.carriers.count).toBe(game.state.slots.length);
    expect(visuals.entities.size).toBe(Object.keys(game.state.entities).length);
    expect([...visuals.slotLabels.values()].every(label => label.hidden)).toBe(true);
  });

  it('every generated unopened barrel has a real payload, including beyond the starter sequence', () => {
    const { game, sync } = setup();
    const seen = new Set<string>();
    const contents = new Set<string>();
    for (let index = 0; index < 60; index++) {
      for (const entity of Object.values(game.state.entities)) {
        if (entity.kind !== 'barrel' || seen.has(entity.id)) continue;
        seen.add(entity.id);
        contents.add(entity.content);
        expect(['worker', 'coins', 'bomb', 'rewind', 'slow']).toContain(entity.content);
      }
      const source = game.state.slots[index % game.state.slots.length];
      source.x = CONFIG.conveyor.left;
      // Let the normal conveyor cooldown elapse, with the live snake kept in bounds.
      game.state.stones = [];
      for (let frame = 0; frame < 160; frame++) game.tick(CONFIG.simulation.fixedStep);
      sync();
    }
    expect(seen.size).toBeGreaterThan(CONFIG.conveyor.starter.length);
    expect(contents).toEqual(new Set(['worker', 'coins', 'bomb', 'rewind', 'slow']));
  });
});


describe('v0.2 feedback: read-only browser render mirrors', () => {
  it('mirrors all stone IDs/distances and ground projections without changing simulation state', () => {
    const { game, view, visuals } = setup();
    game.state.stones[0].distance = -3;
    const before = structuredClone(game.state);
    view.sync(game.state, 0, null, []);
    const markers = JSON.parse(view.canvas.dataset.stones!) as { id: string; distance: number; x: number; y: number }[];
    expect(markers).toHaveLength(game.state.stones.length);
    for (const [index, marker] of markers.entries()) {
      const stone = game.state.stones[index];
      const point = view.project(samplePath(stone.distance), 0);
      expect(marker).toEqual({ id: stone.id, distance: stone.distance, x: point.x, y: point.y });
    }
    expect(Number(visuals.headLabel.dataset.distance)).toBe(Math.max(...game.state.stones.map(stone => stone.distance)));
    expect(Number(view.canvas.dataset.time)).toBe(game.state.time);
    expect(game.state).toEqual(before);
  });

  it.each(['forward', 'gap-pause', 'gap-retract', 'rewind'] as const)('exposes the %s phase and a signed movement rate', motion => {
    const { game, view } = setup();
    game.state.time = 12;
    if (motion !== 'forward') game.state.stones.splice(20, 1);
    if (motion === 'gap-pause') game.state.gapRecoveryRemaining = CONFIG.stones.gapDelay;
    if (motion === 'rewind') {
      game.state.gapRecoveryRemaining = CONFIG.stones.gapDelay;
      game.state.rewindTarget = 0;
      game.state.rewindSpeed = 10;
    }
    view.sync(game.state, 0, null, []);
    expect(view.canvas.dataset.motion).toBe(motion);
    const speed = Number(view.canvas.dataset.speed);
    if (motion === 'forward') expect(speed).toBeCloseTo(CONFIG.stones.speed + CONFIG.stones.acceleration * 12);
    if (motion === 'gap-pause') expect(speed).toBe(0);
    if (motion === 'gap-retract') expect(speed).toBe(-CONFIG.stones.retractSpeed);
    if (motion === 'rewind') expect(speed).toBe(-10);
    game.state.paused = true;
    view.sync(game.state, 0, null, []);
    expect(Number(view.canvas.dataset.speed)).toBe(0);
  });

  it('keeps hidden slot/pad ownership and entity location mirrors current across pickup and placement', () => {
    const { game, visuals, sync } = setup();
    const source = game.state.slots[0];
    const id = source.entityId!;
    game.openBarrel(source.id);
    sync();
    const worker = visuals.entities.get(id)!;
    const sourceLabel = visuals.slotLabels.get(source.id)!;
    expect(sourceLabel.dataset.entityId).toBe(id);
    expect(sourceLabel.dataset.reserved).toBe('false');
    expect(worker.hit.dataset.locationKind).toBe('slot');
    expect(worker.hit.dataset.locationId).toBe(source.id);
    game.beginDrag(id);
    sync();
    expect(sourceLabel.dataset.entityId).toBe('');
    expect(sourceLabel.dataset.reserved).toBe('true');
    expect(worker.hit.dataset.locationKind).toBe('drag');
    expect(worker.hit.dataset.locationId).toBe('');
    game.state.coins = 50;
    game.buyPad('pad-1');
    game.drop({ kind: 'pad', id: 'pad-1' });
    sync();
    expect(sourceLabel.hidden).toBe(true);
    expect(sourceLabel.dataset.entityId).toBe('');
    expect(sourceLabel.dataset.reserved).toBe('false');
    expect(worker.hit.dataset.locationKind).toBe('pad');
    expect(worker.hit.dataset.locationId).toBe('pad-1');
    const padLabel = visuals.pads.get('pad-1')!.label;
    expect(padLabel.hidden).toBe(true);
    expect(padLabel.dataset.entityId).toBe(id);
    expect(padLabel.dataset.reserved).toBe('false');
  });
});
