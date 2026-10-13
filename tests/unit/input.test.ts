import { describe, expect, it, vi } from 'vitest';
import { Game } from '../../src/game/Simulation';
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
