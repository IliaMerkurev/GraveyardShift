import { describe, expect, it, vi } from 'vitest';
import { Game } from '../../src/game/Simulation';
import { CONFIG } from '../../src/game/config';
import { PointerController } from '../../src/input/PointerController';
import type { DropTarget } from '../../src/game/GameState';
import type { HitTarget, SceneView } from '../../src/render/SceneFactory';

class CanvasStub extends EventTarget {
  captures = new Set<number>();
  setPointerCapture(id: number) { this.captures.add(id); }
  hasPointerCapture(id: number) { return this.captures.has(id); }
  releasePointerCapture(id: number) {
    this.captures.delete(id);
    this.dispatchEvent(pointer('lostpointercapture', { pointerId: id }));
  }
}

function pointer(type: string, properties: Partial<PointerEvent> = {}): PointerEvent {
  const event = new Event(type, { cancelable: true });
  Object.assign(event, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 100, clientY: 200, ...properties });
  return event as PointerEvent;
}

function setup() {
  const game = new Game();
  const canvas = new CanvasStub();
  const firstId = game.state.slots[0]!.entityId!;
  let hit: HitTarget | null = { kind: 'entity', id: firstId };
  let drop: DropTarget = { kind: 'pad', id: 'pad-0' };
  const world = vi.fn((x: number, y: number) => ({ x, z: y }));
  const showDrop = vi.fn();
  const view = {
    hit: vi.fn(() => hit), world, dropTarget: vi.fn(() => drop), showDrop,
  } as unknown as SceneView;
  const feedback = vi.fn();
  const controller = new PointerController(canvas as unknown as HTMLCanvasElement, game, view, feedback);
  const send = (type: string, properties: Partial<PointerEvent> = {}) => canvas.dispatchEvent(pointer(type, properties));
  const openWorker = () => { game.openBarrel('slot-0'); };
  const startDrag = (properties: Partial<PointerEvent> = {}) => {
    send('pointerdown', properties);
    send('pointermove', { clientX: 120, ...properties });
  };
  return { game, canvas, firstId, world, showDrop, feedback, controller, send, openWorker, startDrag,
    setHit(value: HitTarget | null) { hit = value; }, setDrop(value: DropTarget) { drop = value; } };
}

describe('PointerController event contract (DOM-free unit tests)', () => {
  it('opens one barrel on completed tap, not on down, click or repeated pointerup', () => {
    const s = setup();
    s.send('pointerdown');
    expect(s.game.state.stats.opened).toBe(0);
    expect(s.canvas.hasPointerCapture(1)).toBe(true);
    s.send('pointerup');
    s.canvas.dispatchEvent(new Event('click'));
    s.send('pointerup');
    expect(s.game.state.stats.opened).toBe(1);
    expect(s.controller.activePointerId).toBeNull();
    expect(s.canvas.captures.size).toBe(0);
  });

  it('keeps sub-threshold movement as a tap but does not open a dragged barrel', () => {
    const s = setup();
    s.send('pointerdown');
    s.send('pointermove', { clientX: 104, clientY: 202 });
    s.send('pointerup');
    expect(s.game.state.stats.opened).toBe(1);
    const t = setup();
    t.startDrag();
    t.send('pointerup', { clientX: 120 });
    expect(t.game.state.stats.opened).toBe(0);
    expect(t.game.state.drag).toBeNull();
  });

  it('ignores right mouse button without capture or action', () => {
    const s = setup();
    s.send('pointerdown', { button: 2 });
    s.send('pointerup', { button: 2 });
    expect(s.canvas.captures.size).toBe(0);
    expect(s.game.state.stats.opened).toBe(0);
    expect(s.controller.activePointerId).toBeNull();
  });

  it('reserves the source once and atomically merges only once', () => {
    const s = setup();
    s.openWorker();
    s.startDrag();
    expect(s.game.state.drag?.entityId).toBe(s.firstId);
    expect(s.game.state.slots[0]).toMatchObject({ reserved: true, entityId: null });
    s.send('pointermove', { clientX: 150 });
    s.send('pointerup', { clientX: 150 });
    s.send('pointerup', { clientX: 150 });
    expect(s.game.state.stats.merged).toBe(1);
    expect(s.game.state.entities[s.firstId]).toBeUndefined();
    expect(s.game.state.slots[0]).toMatchObject({ reserved: false, entityId: null });
    expect(s.game.state.entities[s.game.state.pads[0]!.entityId!]!).toMatchObject({ kind: 'worker', level: 2 });
  });

  it.each(['pointercancel', 'lostpointercapture'])('%s restores the source and clears all input state', event => {
    const s = setup();
    s.openWorker();
    s.startDrag();
    s.send(event);
    expect(s.game.state.drag).toBeNull();
    expect(s.game.state.slots[0]).toMatchObject({ reserved: false, entityId: s.firstId });
    expect(s.game.state.entities[s.firstId]!.location).toEqual({ kind: 'slot', id: 'slot-0' });
    expect(s.controller.activePointerId).toBeNull();
    expect(s.controller.dragPosition).toBeNull();
    expect(s.canvas.captures.size).toBe(0);
    s.send('pointerup');
    expect(s.game.state.stats.merged).toBe(0);
  });

  it('secondary contacts cannot start, move, cancel or release primary drag', () => {
    const s = setup();
    s.openWorker();
    s.startDrag({ pointerType: 'touch', pointerId: 7 });
    const drag = structuredClone(s.game.state.drag);
    for (const event of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']) {
      s.send(event, { pointerType: 'touch', pointerId: 8, clientX: 300 });
      expect(s.controller.activePointerId).toBe(7);
      expect(s.game.state.drag).toEqual(drag);
    }
    s.send('pointerup', { pointerType: 'touch', pointerId: 7, clientX: 150 });
    expect(s.game.state.stats.merged).toBe(1);
  });

  it('lifts touch visuals but leaves the logical drop coordinates under the finger', () => {
    const s = setup();
    s.openWorker();
    s.startDrag({ pointerType: 'touch', clientY: 250 });
    expect(s.world).toHaveBeenLastCalledWith(120, 218);
    expect(s.controller.dragPosition).toEqual({ x: 120, z: 218 });
    s.send('pointerup', { pointerType: 'touch', clientX: 120, clientY: 250 });
    expect(s.game.state.stats.merged).toBe(1);
  });

  it('invalid drop restores the source without reducing worker count or issuing a merge', () => {
    const s = setup();
    s.openWorker();
    s.setDrop(null);
    const count = Object.keys(s.game.state.entities).length;
    s.startDrag();
    s.send('pointerup', { clientX: 500 });
    expect(s.game.state.entities[s.firstId]!.location).toEqual({ kind: 'slot', id: 'slot-0' });
    expect(s.game.state.slots[0]!.reserved).toBe(false);
    expect(Object.keys(s.game.state.entities)).toHaveLength(count);
    expect(s.game.state.stats.merged).toBe(0);
    expect(s.feedback).toHaveBeenCalledWith('Not a match. Returned safely.');
  });

  it('external cancel is idempotent and safely releases active capture', () => {
    const s = setup();
    s.openWorker();
    s.startDrag();
    s.controller.cancel();
    s.controller.cancel();
    expect(s.game.state.drag).toBeNull();
    expect(s.game.state.slots[0]!.entityId).toBe(s.firstId);
    expect(s.canvas.captures.size).toBe(0);
  });

  it('cannot start actions while paused', () => {
    const s = setup();
    s.game.setPaused(true);
    s.send('pointerdown');
    s.send('pointermove', { clientX: 200 });
    s.send('pointerup');
    expect(s.game.state.stats.opened).toBe(0);
    expect(s.game.state.drag).toBeNull();
    expect(s.controller.activePointerId).toBeNull();
  });

  it('tap on an affordable locked pad spends once, double tap does not spend twice', () => {
    const s = setup();
    s.game.openBarrel('slot-2');
    s.setHit({ kind: 'pad', id: 'pad-1' });
    for (let i = 0; i < 2; i++) { s.send('pointerdown'); s.send('pointerup'); }
    expect(s.game.state.pads[1]!.unlocked).toBe(true);
    expect(s.game.state.coins).toBe(0);
    expect(s.game.state.stats.purchased).toBe(1);
  });
});


describe('v0.2 continuous belt, rewind and defeat pointer rules', () => {
  it('keeps the belt moving during a captured drag and clears every stale input on source expiry', () => {
    const s = setup();
    s.openWorker();
    s.startDrag();
    const oldX = s.game.state.slots[0]!.x;
    s.game.tick(1 / 60);
    expect(s.game.state.slots[0]!.x).toBeLessThan(oldX);
    expect(s.game.state.drag?.entityId).toBe(s.firstId);
    s.game.state.slots[0]!.x = CONFIG.conveyor.left + .001;
    s.game.tick(1 / 60);
    expect(s.game.state.entities[s.firstId]).toBeUndefined();
    expect(s.game.state.drag).toBeNull();
    s.controller.refreshDrop();
    expect(s.controller.activePointerId).toBeNull();
    expect(s.controller.dragPosition).toBeNull();
    expect(s.canvas.captures.size).toBe(0);
    expect(s.showDrop).toHaveBeenLastCalledWith(null, false, CONFIG.bomb.radius);
    expect(s.feedback).toHaveBeenCalledExactlyOnceWith('That item left the belt.');
    const snapshot = structuredClone(s.game.state);
    s.send('pointermove', { clientX: 180 });
    s.send('pointerup', { clientX: 180 });
    s.send('pointercancel');
    expect(s.game.state).toEqual(snapshot);
  });

  it('rechecks expiry at pointerup before any frame has refreshed the gesture', () => {
    const s = setup();
    s.openWorker();
    s.startDrag();
    s.game.state.slots[0]!.x = CONFIG.conveyor.left + .001;
    s.game.tick(1 / 60);
    const drop = vi.spyOn(s.game, 'drop');
    s.send('pointerup');
    expect(drop).not.toHaveBeenCalled();
    expect(s.game.state.stats.merged).toBe(0);
    expect(s.controller.activePointerId).toBeNull();
    expect(s.canvas.captures.size).toBe(0);
    expect(s.showDrop).toHaveBeenLastCalledWith(null, false, CONFIG.bomb.radius);
  });

  it('does not open a replacement barrel when the originally pressed barrel leaves the belt', () => {
    const s = setup();
    s.send('pointerdown');
    s.game.state.slots[0]!.x = CONFIG.conveyor.left + .001;
    s.game.tick(1 / 60);
    expect(s.game.state.slots[0]!.entityId).not.toBe(s.firstId);
    s.send('pointerup');
    expect(s.game.state.stats.opened).toBe(0);
    expect(s.controller.activePointerId).toBeNull();
    expect(s.canvas.captures.size).toBe(0);
  });

  it('reveals a rewind without activating it, then uses it exactly once on a completed tap', () => {
    const s = setup();
    const barrel = s.game.state.entities[s.firstId]!;
    if (barrel.kind !== 'barrel') throw new Error('Expected starter barrel');
    barrel.content = 'rewind';
    const use = vi.spyOn(s.game, 'useRewind');
    s.send('pointerdown');
    s.send('pointerup');
    expect(s.game.state.entities[s.firstId]?.kind).toBe('rewind');
    expect(use).not.toHaveBeenCalled();
    s.send('pointerdown');
    expect(use).not.toHaveBeenCalled();
    s.send('pointerup');
    s.send('pointerup');
    s.canvas.dispatchEvent(new Event('click'));
    expect(use).toHaveBeenCalledExactlyOnceWith(s.firstId);
    expect(s.game.state.entities[s.firstId]).toBeUndefined();
    expect(s.game.state.events.filter(event => event.type === 'rewind')).toHaveLength(1);
    expect(s.canvas.captures.size).toBe(0);
  });

  it('does not drag or activate a rewind when the gesture moves past the drag threshold', () => {
    const s = setup();
    s.game.state.entities[s.firstId] = { id: s.firstId, kind: 'rewind', location: { kind: 'slot', id: 'slot-0' } };
    const use = vi.spyOn(s.game, 'useRewind');
    s.startDrag({ pointerType: 'touch' });
    expect(s.game.state.drag).toBeNull();
    expect(s.game.state.slots[0]!.reserved).toBe(false);
    s.send('pointerup', { pointerType: 'touch' });
    expect(use).not.toHaveBeenCalled();
    expect(s.game.state.entities[s.firstId]?.kind).toBe('rewind');
    s.send('pointerdown', { pointerType: 'touch' });
    s.send('pointerup', { pointerType: 'touch' });
    expect(use).toHaveBeenCalledExactlyOnceWith(s.firstId);
  });

  it('clears an in-progress gesture when defeat arrives and rejects fresh taps', () => {
    const s = setup();
    s.openWorker();
    s.startDrag();
    s.game.state.gameOver = true;
    s.controller.refreshDrop();
    expect(s.controller.activePointerId).toBeNull();
    expect(s.controller.dragPosition).toBeNull();
    expect(s.canvas.captures.size).toBe(0);
    expect(s.showDrop).toHaveBeenLastCalledWith(null, false, CONFIG.bomb.radius);
    const snapshot = structuredClone(s.game.state);
    s.send('pointerup');
    s.send('pointerdown');
    s.send('pointermove', { clientX: 200 });
    s.send('pointerup');
    expect(s.game.state).toEqual(snapshot);
    expect(s.controller.activePointerId).toBeNull();
    expect(s.feedback).not.toHaveBeenCalled();
  });
});


describe('v0.2 slow-token pointer rules', () => {
  it('reveals a clock without activating it, then activates exactly once on a completed tap', () => {
    const s = setup();
    const barrel = s.game.state.entities[s.firstId]!;
    if (barrel.kind !== 'barrel') throw new Error('Expected starter barrel');
    barrel.content = 'slow';
    const use = vi.spyOn(s.game, 'useSlow');
    s.send('pointerdown');
    s.send('pointerup');
    expect(s.game.state.entities[s.firstId]?.kind).toBe('slow');
    expect(s.game.state.slowRemaining).toBe(0);
    expect(use).not.toHaveBeenCalled();
    s.send('pointerdown');
    expect(use).not.toHaveBeenCalled();
    s.send('pointerup');
    s.send('pointerup');
    s.canvas.dispatchEvent(new Event('click'));
    expect(use).toHaveBeenCalledExactlyOnceWith(s.firstId);
    expect(s.game.state.slowRemaining).toBe(5);
    expect(s.game.state.entities[s.firstId]).toBeUndefined();
    expect(s.canvas.captures.size).toBe(0);
  });

  it('does not drag a clock; a subsequent touch tap activates it', () => {
    const s = setup();
    s.game.state.entities[s.firstId] = { id: s.firstId, kind: 'slow', location: { kind: 'slot', id: 'slot-0' } };
    const use = vi.spyOn(s.game, 'useSlow');
    s.startDrag({ pointerType: 'touch', pointerId: 4 });
    expect(s.game.state.drag).toBeNull();
    expect(s.game.state.slots[0]!.reserved).toBe(false);
    s.send('pointerup', { pointerType: 'touch', pointerId: 4 });
    expect(use).not.toHaveBeenCalled();
    expect(s.game.state.entities[s.firstId]?.kind).toBe('slow');
    s.send('pointerdown', { pointerType: 'touch', pointerId: 4 });
    s.send('pointerup', { pointerType: 'touch', pointerId: 4 });
    expect(use).toHaveBeenCalledExactlyOnceWith(s.firstId);
    expect(s.game.state.slowRemaining).toBe(5);
  });

  it('cannot activate a held clock after it leaves the belt', () => {
    const s = setup();
    s.game.state.entities[s.firstId] = { id: s.firstId, kind: 'slow', location: { kind: 'slot', id: 'slot-0' } };
    const use = vi.spyOn(s.game, 'useSlow');
    s.send('pointerdown');
    s.game.state.slots[0]!.x = CONFIG.conveyor.left + .001;
    s.game.tick(1 / 60);
    s.send('pointerup');
    expect(use).not.toHaveBeenCalled();
    expect(s.game.state.slowRemaining).toBe(0);
    expect(s.game.state.entities[s.firstId]).toBeUndefined();
    expect(s.controller.activePointerId).toBeNull();
    expect(s.canvas.captures.size).toBe(0);
  });
});
