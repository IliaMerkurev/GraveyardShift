import { describe, expect, it, vi } from 'vitest';
import { Game } from '../../src/game/Simulation';
import { CONFIG } from '../../src/game/config';
import { drop } from '../../src/game/commands';
import type { DropTarget, Worker } from '../../src/game/GameState';
import { samplePath } from '../../src/game/path';
import { PointerController } from '../../src/input/PointerController';
import type { SceneView } from '../../src/render/SceneFactory';

function quietGame(): Game {
  const config = structuredClone(CONFIG);
  config.stones.initialCount = 0;
  config.stones.speed = 0;
  config.stones.acceleration = 0;
  config.mining.radius = 0;
  return new Game(config);
}

function openItem(game: Game, kind: 'worker' | 'bomb' = 'worker'): string {
  const slot = game.state.slots[0]!;
  const barrel = game.state.entities[slot.entityId!]!;
  if (barrel.kind !== 'barrel') throw new Error('Expected starter barrel');
  barrel.content = kind;
  expect(game.openBarrel(slot.id)).toBe(true);
  return slot.entityId!;
}

function wrapSource(game: Game): void {
  game.state.slots[0]!.x = game.config.conveyor.left + .001;
  game.tick(game.config.simulation.fixedStep);
  expect(game.state.slots[0]!.x).toBeGreaterThan(game.config.conveyor.right - .01);
}

function assertOwnership(game: Game): void {
  const owners: string[] = [];
  for (const place of [...game.state.slots, ...game.state.pads]) {
    if (place.reserved) {
      expect(place.entityId).toBeNull();
      expect(game.state.drag?.source.id).toBe(place.id);
    }
    if (place.entityId) {
      owners.push(place.entityId);
      const entity = game.state.entities[place.entityId]!;
      expect(entity).toBeDefined();
      expect(entity.location.kind).not.toBe('drag');
      if (entity.location.kind !== 'drag') expect(entity.location.id).toBe(place.id);
    }
  }
  if (game.state.drag) {
    owners.push(game.state.drag.entityId);
    expect(game.state.entities[game.state.drag.entityId]?.location.kind).toBe('drag');
    expect([...game.state.slots, ...game.state.pads].filter(place => place.reserved)).toHaveLength(1);
  }
  expect(new Set(owners).size).toBe(owners.length);
  expect(owners.sort()).toEqual(Object.keys(game.state.entities).sort());
  expect(game.state.coins).toBeGreaterThanOrEqual(0);
}

describe('v0.2 feedback: picked-up items own their moving return carrier', () => {
  it.each(['worker', 'bomb'] as const)('keeps a held %s across wraps and never spawns into its reservation', kind => {
    const game = quietGame();
    const id = openItem(game, kind);
    expect(game.beginDrag(id)).toBe(true);
    for (let i = 0; i < 3; i++) {
      wrapSource(game);
      expect(game.state.drag).toEqual({ entityId: id, source: { kind: 'slot', id: 'slot-0' } });
      expect(game.state.entities[id]).toMatchObject({ kind, location: { kind: 'drag' } });
      expect(game.state.slots[0]).toMatchObject({ entityId: null, reserved: true });
      expect(game.state.conveyorPaused).toBe(false);
      expect(game.state.events.some(event => event.type === 'expired' && event.entityId === id)).toBe(false);
      assertOwnership(game);
    }
  });

  it('keeps the belt and unrelated expiry/refills running over two complete held-item laps', () => {
    const game = quietGame();
    const id = openItem(game);
    const untouchedId = game.state.slots[1]!.entityId!;
    game.beginDrag(id);
    const seconds = 2.2 * (game.config.conveyor.right - game.config.conveyor.left) / game.config.conveyor.speed;
    for (let i = 0; i < Math.ceil(seconds * 60); i++) game.tick(1 / 60);
    expect(game.state.drag?.entityId).toBe(id);
    expect(game.state.entities[id]).toBeDefined();
    expect(game.state.entities[untouchedId]).toBeUndefined();
    expect(game.state.slots[0]).toMatchObject({ entityId: null, reserved: true });
    expect(game.state.slots.slice(1).some(slot => slot.entityId !== null)).toBe(true);
    expect(game.state.coins).toBe(0);
    expect(game.state.conveyorPaused).toBe(false);
    assertOwnership(game);
  });

  it.each(['cancel', 'invalid', 'mismatch'] as const)('%s after wrapping restores the same ID exactly once', action => {
    const game = quietGame();
    const id = openItem(game);
    (game.state.entities[game.state.pads[0]!.entityId!] as Worker).level = 2;
    game.beginDrag(id);
    wrapSource(game);
    if (action === 'cancel') expect(game.cancelDrag()).toBe(true);
    else expect(game.drop(action === 'invalid' ? null : { kind: 'pad', id: 'pad-0' })).toBe(false);
    expect(game.state.drag).toBeNull();
    expect(game.state.entities[id]?.location).toEqual({ kind: 'slot', id: 'slot-0' });
    expect(game.state.slots[0]).toMatchObject({ entityId: id, reserved: false });
    expect(game.state.stats.merged).toBe(0);
    const snapshot = structuredClone(game.state);
    expect(game.cancelDrag()).toBe(false);
    expect(game.drop({ kind: 'pad', id: 'pad-0' })).toBe(false);
    expect(game.state).toEqual(snapshot);
    assertOwnership(game);
  });

  it('merges after a wrap, releases its carrier and ignores a repeated drop', () => {
    const game = quietGame();
    const id = openItem(game);
    const destinationId = game.state.pads[0]!.entityId!;
    game.beginDrag(id);
    wrapSource(game);
    expect(game.drop({ kind: 'pad', id: 'pad-0' })).toBe(true);
    expect(game.state.entities[id]).toBeUndefined();
    expect(game.state.entities[destinationId]).toMatchObject({ kind: 'worker', level: 2 });
    expect(game.state.slots[0]).toMatchObject({ entityId: null, reserved: false });
    expect(game.drop({ kind: 'pad', id: 'pad-0' })).toBe(false);
    expect(game.state.stats.merged).toBe(1);
    assertOwnership(game);
  });

  it('can drop back onto its wrapped source, then expires normally on the next unheld exit', () => {
    const game = quietGame();
    const id = openItem(game, 'bomb');
    game.beginDrag(id);
    wrapSource(game);
    expect(game.drop({ kind: 'slot', id: 'slot-0' })).toBe(true);
    expect(game.state.slots[0]).toMatchObject({ entityId: id, reserved: false });
    assertOwnership(game);
    wrapSource(game);
    expect(game.state.entities[id]).toBeUndefined();
    expect(game.state.events.filter(event => event.type === 'expired' && event.entityId === id)).toHaveLength(1);
    expect(game.state.stats.bombsUsed).toBe(0);
    assertOwnership(game);
  });

  it('lets a held bomb hit rocks after wrapping and rewards each victim only once', () => {
    const game = quietGame();
    const id = openItem(game, 'bomb');
    game.beginDrag(id);
    wrapSource(game);
    const target = { kind: 'track' as const, ...samplePath(0, game.config.path) };
    const reward = game.state.stones[0]!.reward;
    expect(game.drop(target)).toBe(true);
    expect(game.state.entities[id]).toBeUndefined();
    expect(game.state.stats.bombsUsed).toBe(1);
    expect(game.state.coins).toBe(reward);
    expect(game.drop(target)).toBe(false);
    expect(game.state.coins).toBe(reward);
    assertOwnership(game);
  });

  it.each(['pause', 'gameover'] as const)('%s cancellation restores a held item even after its carrier wrapped', reason => {
    const game = quietGame();
    const id = openItem(game);
    game.beginDrag(id);
    wrapSource(game);
    if (reason === 'pause') game.setPaused(true);
    else { game.state.gameOver = true; game.cancelDrag(); }
    expect(game.state.entities[id]?.location).toEqual({ kind: 'slot', id: 'slot-0' });
    expect(game.state.slots[0]).toMatchObject({ entityId: id, reserved: false });
    expect(game.state.drag).toBeNull();
    assertOwnership(game);
  });
});

describe('v0.2 feedback: atomic locked-pad purchase and placement', () => {
  it('previews an affordable pad without spending and publishes purchase only after complete placement', () => {
    const game = quietGame();
    const id = openItem(game);
    const pad = game.state.pads[1]!;
    const target = { kind: 'pad' as const, id: pad.id };
    game.state.coins = pad.price + 7;
    game.beginDrag(id);
    wrapSource(game);
    const before = structuredClone(game.state);
    expect(game.canDrop(target)).toBe(true);
    expect(game.canDrop(target)).toBe(true);
    expect(game.state).toEqual(before);
    const emit = vi.fn((event: Parameters<Game['emit']>[0]) => {
      if (event.type === 'purchase') {
        expect(pad).toMatchObject({ unlocked: true, entityId: id });
        expect(game.state.drag).toBeNull();
        expect(game.state.slots[0]!.reserved).toBe(false);
        assertOwnership(game);
      }
      game.emit(event);
    });
    expect(drop({ state: game.state, config: game.config, emit }, target)).toBe(true);
    expect(game.state.coins).toBe(7);
    expect(game.state.entities[id]?.location).toEqual(target);
    expect(game.state.stats.purchased).toBe(1);
    expect(game.state.tutorial).toMatchObject({ bought: true, placed: true });
    expect(emit.mock.calls.filter(([event]) => event.type === 'purchase')).toHaveLength(1);
    expect(game.drop(target)).toBe(false);
    expect(game.buyPad(pad.id)).toBe(false);
    expect(game.state.coins).toBe(7);
    assertOwnership(game);
  });

  it.each(['insufficient', 'funds-changed'] as const)('%s drop neither purchases nor loses the worker', reason => {
    const game = quietGame();
    const id = openItem(game);
    const pad = game.state.pads[1]!;
    const target = { kind: 'pad' as const, id: pad.id };
    game.state.coins = reason === 'funds-changed' ? pad.price : pad.price - 1;
    game.beginDrag(id);
    expect(game.canDrop(target)).toBe(reason === 'funds-changed');
    game.state.coins = pad.price - 1;
    wrapSource(game);
    expect(game.drop(target)).toBe(false);
    expect(pad).toMatchObject({ unlocked: false, entityId: null });
    expect(game.state.coins).toBe(pad.price - 1);
    expect(game.state.stats.purchased).toBe(0);
    expect(game.state.events.filter(event => event.type === 'purchase')).toHaveLength(0);
    expect(game.state.slots[0]).toMatchObject({ entityId: id, reserved: false });
    assertOwnership(game);
  });

  it('does not charge again when a pad was purchased between preview and drop', () => {
    const game = quietGame();
    const id = openItem(game);
    const pad = game.state.pads[1]!;
    const target = { kind: 'pad' as const, id: pad.id };
    game.state.coins = pad.price;
    game.beginDrag(id);
    expect(game.canDrop(target)).toBe(true);
    expect(game.buyPad(pad.id)).toBe(true);
    expect(game.drop(target)).toBe(true);
    expect(pad.entityId).toBe(id);
    expect(game.state.coins).toBe(0);
    expect(game.state.stats.purchased).toBe(1);
    assertOwnership(game);
  });

  it('never buys a locked pad for a bomb, even when affordable', () => {
    const game = quietGame();
    const id = openItem(game, 'bomb');
    const pad = game.state.pads[1]!;
    game.state.coins = pad.price;
    game.beginDrag(id);
    wrapSource(game);
    expect(game.canDrop({ kind: 'pad', id: pad.id })).toBe(false);
    expect(game.drop({ kind: 'pad', id: pad.id })).toBe(false);
    expect(pad.unlocked).toBe(false);
    expect(game.state.coins).toBe(pad.price);
    expect(game.state.slots[0]!.entityId).toBe(id);
    assertOwnership(game);
  });
});

class CanvasStub extends EventTarget {
  captures = new Set<number>();
  setPointerCapture(id: number): void { this.captures.add(id); }
  hasPointerCapture(id: number): boolean { return this.captures.has(id); }
  releasePointerCapture(id: number): void { this.captures.delete(id); this.dispatchEvent(pointer('lostpointercapture', { pointerId: id })); }
}

function pointer(type: string, properties: Partial<PointerEvent> = {}): PointerEvent {
  const event = new Event(type, { cancelable: true });
  Object.assign(event, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 100, clientY: 200, ...properties });
  return event as PointerEvent;
}

function pointerSetup(kind: 'worker' | 'bomb' = 'worker') {
  const game = quietGame();
  const id = openItem(game, kind);
  const canvas = new CanvasStub();
  let target: DropTarget = { kind: 'pad', id: 'pad-1' };
  const showDrop = vi.fn();
  const feedback = vi.fn();
  const view = { hit: () => ({ kind: 'entity', id }), world: (x: number, y: number) => ({ x, z: y }), dropTarget: () => target, showDrop } as unknown as SceneView;
  const controller = new PointerController(canvas as unknown as HTMLCanvasElement, game, view, feedback);
  return { game, id, canvas, showDrop, feedback, controller, setTarget(value: DropTarget) { target = value; },
    send(type: string, properties: Partial<PointerEvent> = {}) { canvas.dispatchEvent(pointer(type, properties)); } };
}

describe('v0.2 feedback: pointer owns the picked-up belt item', () => {
  it.each(['mouse', 'touch'] as const)('%s owns the item on first contact before the drag threshold', pointerType => {
    const s = pointerSetup();
    s.game.state.coins = s.game.state.pads[1]!.price;
    s.send('pointerdown', { pointerType });
    expect(s.game.state.drag?.entityId).toBe(s.id);
    wrapSource(s.game);
    s.controller.refreshDrop();
    expect(s.controller.activePointerId).toBe(1);
    expect(s.canvas.hasPointerCapture(1)).toBe(true);
    s.send('pointermove', { pointerType, clientX: 130 });
    expect(s.showDrop).toHaveBeenLastCalledWith({ kind: 'pad', id: 'pad-1' }, true, CONFIG.bomb.radius);
    s.send('pointerup', { pointerType, clientX: 130 });
    s.send('pointerup', { pointerType, clientX: 130 });
    expect(s.game.state.pads[1]).toMatchObject({ unlocked: true, entityId: s.id });
    expect(s.game.state.stats.purchased).toBe(1);
    expect(s.game.state.coins).toBe(0);
    expect(s.canvas.captures.size).toBe(0);
    expect(s.controller.dragPosition).toBeNull();
    assertOwnership(s.game);
  });

  it.each(['worker', 'bomb'] as const)('a held %s tap returns safely after a wrap and keeps its usage hint', kind => {
    const s = pointerSetup(kind);
    s.game.state.coins = 100;
    s.send('pointerdown');
    s.send('pointermove', { clientX: 103 });
    wrapSource(s.game);
    s.send('pointerup');
    expect(s.game.state.slots[0]).toMatchObject({ entityId: s.id, reserved: false });
    expect(s.game.state.drag).toBeNull();
    expect(s.game.state.coins).toBe(100);
    expect(s.game.state.pads[1]!.unlocked).toBe(false);
    expect(s.feedback).toHaveBeenCalledExactlyOnceWith(kind === 'worker' ? 'Drag this worker onto a pad or matching level.' : 'Drag the bomb onto the rock stream.');
    expect(s.canvas.captures.size).toBe(0);
    assertOwnership(s.game);
  });

  it.each(['pointercancel', 'lostpointercapture', 'invalid-drop'] as const)('%s after wrap returns the item and leaves late pointerup inert', action => {
    const s = pointerSetup();
    s.game.state.coins = 100;
    s.send('pointerdown', { pointerType: 'touch' });
    s.send('pointermove', { pointerType: 'touch', clientX: 130 });
    wrapSource(s.game);
    if (action === 'invalid-drop') { s.setTarget(null); s.send('pointerup', { pointerType: 'touch', clientX: 130 }); }
    else s.send(action, { pointerType: 'touch' });
    expect(s.game.state.slots[0]).toMatchObject({ entityId: s.id, reserved: false });
    expect(s.game.state.drag).toBeNull();
    expect(s.controller.activePointerId).toBeNull();
    expect(s.controller.dragPosition).toBeNull();
    expect(s.canvas.captures.size).toBe(0);
    expect(s.showDrop).toHaveBeenLastCalledWith(null, false, CONFIG.bomb.radius);
    const snapshot = structuredClone(s.game.state);
    s.send('pointerup', { pointerType: 'touch', clientX: 130 });
    expect(s.game.state).toEqual(snapshot);
    assertOwnership(s.game);
  });

  it('revalidates affordability at release and returns the held worker after a wrap', () => {
    const s = pointerSetup();
    s.game.state.coins = 50;
    s.send('pointerdown');
    s.send('pointermove', { clientX: 130 });
    expect(s.showDrop).toHaveBeenLastCalledWith({ kind: 'pad', id: 'pad-1' }, true, CONFIG.bomb.radius);
    wrapSource(s.game);
    s.game.state.coins = 49;
    s.controller.refreshDrop();
    expect(s.showDrop).toHaveBeenLastCalledWith({ kind: 'pad', id: 'pad-1' }, false, CONFIG.bomb.radius);
    s.send('pointerup', { clientX: 130 });
    expect(s.game.state.pads[1]!.unlocked).toBe(false);
    expect(s.game.state.coins).toBe(49);
    expect(s.game.state.slots[0]!.entityId).toBe(s.id);
    assertOwnership(s.game);
  });
});
