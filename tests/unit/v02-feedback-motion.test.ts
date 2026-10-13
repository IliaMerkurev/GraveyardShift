import { describe, expect, it } from 'vitest';
import { Game } from '../../src/game/Simulation';
import { CONFIG } from '../../src/game/config';
import { damageStone } from '../../src/game/commands';
import { getPathLength, samplePath } from '../../src/game/path';
import type { Worker } from '../../src/game/GameState';
const advance = (g: Game, seconds: number) => { for (let i = 0; i < Math.round(seconds * 60); i++) g.tick(1 / 60); };
const head = (g: Game) => Math.max(...g.state.stones.map(s => s.distance));
function quiet(stationary = false) {
  const c = structuredClone(CONFIG);
  if (stationary) { c.stones.speed = 0; c.stones.acceleration = 0; }
  const g = new Game(c), p = g.state.pads[0]!;
  delete g.state.entities[p.entityId!]; p.entityId = null;
  return g;
}
function token(g: Game) {
  const slot = g.state.slots.find(s => g.state.entities[s.entityId!]?.kind === 'barrel')!;
  const barrel = g.state.entities[slot.entityId!]!;
  if (barrel.kind !== 'barrel') throw Error('Expected barrel');
  barrel.content = 'rewind'; g.openBarrel(slot.id); return barrel.id;
}
function ordered(g: Game) { return [...g.state.stones].sort((a, b) => a.distance - b.distance); }
function assertNoOverlap(g: Game) {
  const list = ordered(g);
  for (let i = 1; i < list.length; i++) expect(list[i]!.distance - list[i - 1]!.distance).toBeGreaterThanOrEqual(CONFIG.stones.spacing - 1e-8);
}
function assertConnected(g: Game) {
  const list = ordered(g);
  for (let i = 1; i < list.length; i++) expect(list[i]!.distance - list[i - 1]!.distance).toBeCloseTo(CONFIG.stones.spacing, 8);
}
describe('feedback: perceptible active-time acceleration', () => {
  it('is 50% faster by 10 seconds, twice as fast by 20, and caps at 30', () => {
    const g = quiet(); g.state.stones = [g.state.stones[0]!]; g.state.stones[0]!.distance = -1000;
    const measure = () => { const h = head(g); advance(g, 1/60); return (head(g) - h) * 60; };
    const initial = measure(); advance(g, 10 - 1/60); const ten = measure();
    advance(g, 10 - 1/60); const twenty = measure(); advance(g, 10 - 1/60); const capped = measure();
    expect(ten / initial).toBeGreaterThan(1.49); expect(twenty / initial).toBeGreaterThan(1.99);
    expect(capped).toBeCloseTo(.85, 8); advance(g, 50); expect(measure()).toBeCloseTo(capped, 8);
  });
  it('global pause freezes difficulty while rewind does not reset it', () => {
    const g = quiet(); advance(g, 10); g.setPaused(true); const time = g.state.time; g.tick(1000);
    expect(g.state.time).toBe(time); g.setPaused(false); g.useRewind(token(g)); advance(g, 1.2);
    expect(g.state.time).toBeCloseTo(time + 1.2); const h = head(g); advance(g, 1/60);
    expect((head(g) - h) * 60).toBeGreaterThan(.52); g.reset(); expect(g.state.time).toBe(0);
  });
});
describe('feedback: explosion delay and progressive Zuma closure', () => {
  it('pays once, leaves explosion gap for .35 seconds, retracts gradually and keeps rear anchored', () => {
    const g = quiet(), victim = g.state.stones[20]!, rear = g.state.stones[19]!, front = g.state.stones[21]!;
    const r = rear.distance, f = front.distance, h = head(g), reward = victim.reward;
    expect(damageStone(g, victim.id, 999)).toBe(true); expect(damageStone(g, victim.id, 999)).toBe(false);
    expect(g.state.coins).toBe(reward); expect(head(g)).toBe(h);
    expect(g.state.events.filter(e => e.type === 'destroy')).toHaveLength(1);
    advance(g, .35); expect(front.distance).toBe(f); expect(rear.distance).toBe(r);
    advance(g, 1/60); expect(front.distance).toBeLessThan(f); expect(front.distance).toBeGreaterThan(f - CONFIG.stones.spacing);
    expect(front.distance - head(g)).toBeCloseTo(f - h); expect(rear.distance).toBe(r);
    advance(g, .2); assertConnected(g); expect(head(g)).toBeCloseTo(h - CONFIG.stones.spacing);
    const closedHead = head(g); advance(g, 1/60); expect(head(g)).toBeGreaterThan(closedHead);
  });
  it('actual mining emits destruction before any closure movement', () => {
    const c = structuredClone(CONFIG); c.stones.speed = 0; c.stones.acceleration = 0;
    const g = new Game(c), worker = g.state.entities[g.state.pads[0]!.entityId!] as Worker;
    advance(g, .05); const victim = g.state.stones.find(s => s.id === worker.mining.targetId)!;
    victim.hp = 1; const h = head(g); advance(g, .6);
    expect(g.state.stones.some(s => s.id === victim.id)).toBe(false); expect(head(g)).toBe(h);
    advance(g, .3); expect(head(g)).toBe(h); advance(g, .3); expect(head(g)).toBeCloseTo(h - CONFIG.stones.spacing);
  });
  it('multiple gaps and adjacent repeat damage close without overlaps, snaps or duplicate rewards', () => {
    const g = quiet(true), victims = [g.state.stones[15]!, g.state.stones[16]!, g.state.stones[40]!];
    const h = head(g), rear = g.state.stones[0]!.distance;
    for (const victim of victims) damageStone(g, victim.id, 999);
    advance(g, .35);
    for (let i = 0; i < 90; i++) {
      const before = new Map(g.state.stones.map(s => [s.id, s.distance])); advance(g, 1/60); assertNoOverlap(g);
      for (const s of g.state.stones) { expect(s.distance).toBeLessThanOrEqual(before.get(s.id)! + 1e-9); expect(before.get(s.id)! - s.distance).toBeLessThanOrEqual(CONFIG.stones.retractSpeed / 60 + 1e-9); }
    }
    assertConnected(g); expect(head(g)).toBeCloseTo(h - 3 * CONFIG.stones.spacing);
    expect(g.state.stones[0]!.distance).toBe(rear); expect(g.state.coins).toBe(victims.reduce((n,s) => n+s.reward, 0));
  });
  it('new independent damage delays its front while an older gap continues closing', () => {
    const g = quiet(true); damageStone(g, g.state.stones[20]!.id, 999); advance(g, .45);
    const oldFront=g.state.stones[20]!, oldDistance=oldFront.distance;
    const victim = g.state.stones[30]!; damageStone(g, victim.id, 999);
    const h=head(g); advance(g, .35); expect(head(g)).toBe(h); expect(oldFront.distance).toBeLessThan(oldDistance);
    advance(g, 1); assertConnected(g); assertNoOverlap(g);
  });
  it('repeated boundary destruction cannot indefinitely restart the same gap delay', () => {
    const g=quiet(true), first=g.state.stones[20]!;
    damageStone(g,first.id,999); advance(g,.2);
    const second=g.state.stones[20]!; damageStone(g,second.id,999);
    const h=head(g); advance(g,.15); expect(head(g)).toBe(h);
    advance(g,1/60); expect(head(g)).toBeLessThan(h);
    for(let i=0;i<6;i++) { advance(g,.1); const before=head(g); damageStone(g,g.state.stones[20]!.id,999); advance(g,1/60); expect(head(g)).toBeLessThan(before); assertNoOverlap(g); }
    advance(g,3); assertConnected(g);
  });
  it('bomb captures original victims and rewards exactly once while the front waits then slides', () => {
    const g = quiet(true); g.openBarrel('slot-3'); const id = g.state.slots[3]!.entityId!;
    const target = { kind: 'track' as const, ...samplePath(8) };
    const victims = g.state.stones.filter(s => { const p=samplePath(s.distance); return Math.hypot(p.x-target.x,p.z-target.z)<=CONFIG.bomb.radius; });
    const h = head(g); g.beginDrag(id); expect(g.drop(target)).toBe(true);
    expect(head(g)).toBe(h); expect(g.state.stats.destroyed).toBe(victims.length);
    expect(g.state.coins).toBe(victims.reduce((n,s)=>n+s.reward,0));
    advance(g, .35); expect(head(g)).toBe(h); advance(g, 1/60); expect(head(g)).toBeLessThan(h);
    advance(g, 5); assertConnected(g); expect(head(g)).toBeCloseTo(h-victims.length*CONFIG.stones.spacing);
    for (const s of victims) expect(damageStone(g, s.id, 999)).toBe(false);
  });
  it('pause freezes the delay and partial slide; restart clears both animation states', () => {
    const g=quiet(); damageStone(g,g.state.stones[20]!.id,999); advance(g,.2); g.setPaused(true);
    const state=structuredClone(g.state); g.tick(5); expect(g.state).toEqual(state);
    g.setPaused(false); advance(g,.2); g.setPaused(true); const h=head(g); g.tick(5); expect(head(g)).toBe(h);
    g.reset(); expect(g.state.gapRecoveryRemaining).toBe(0); expect(g.state.rewindTarget).toBeNull();
  });
});
describe('feedback: whole-chain animated rewind', () => {
  it('does not teleport; translates every surviving link over 1.2s to midpoint, preserving IDs and HP', () => {
    const g=quiet(); for(const s of g.state.stones)s.distance+=5;
    const before=g.state.stones.map(s=>({...s})), coins=g.state.coins, h=head(g), id=token(g);
    expect(g.useRewind(id)).toBe(true); expect(head(g)).toBe(h); expect(g.useRewind(id)).toBe(false);
    advance(g,.6); expect(head(g)).toBeCloseTo((h+getPathLength()/2)/2);
    expect(g.state.stones.map(s=>s.id)).toEqual(before.map(s=>s.id));
    for(let i=0;i<before.length;i++) { expect(before[i]!.distance-g.state.stones[i]!.distance).toBeCloseTo((h-getPathLength()/2)/2); expect(g.state.stones[i]!.hp).toBe(before[i]!.hp); }
    advance(g,.6); expect(head(g)).toBeCloseTo(getPathLength()/2); expect(g.state.rewindTarget).toBeNull(); expect(g.state.coins).toBe(coins);
    const end=head(g); advance(g,1/60); expect(head(g)).toBeGreaterThan(end);
  });
  it('earlier head slides near first miner, keeps negative tail spacing, and never rewinds forward', () => {
    const g=quiet(); for(const s of g.state.stones)s.distance-=3;
    const before=ordered(g), h=head(g), tail=before[0]!.distance; g.useRewind(token(g)); advance(g,1.2);
    expect(head(g)).toBeCloseTo(CONFIG.stones.rewindNearStart); expect(ordered(g)[0]!.distance).toBeCloseTo(tail-h+CONFIG.stones.rewindNearStart);
    expect(ordered(g)[0]!.distance).toBeLessThan(0); assertConnected(g);
    for(const s of g.state.stones)s.distance-=1; const earlier=head(g); g.useRewind(token(g)); expect(head(g)).toBe(earlier); expect(g.state.rewindTarget).toBeNull();
  });
  it('rewind during a gap preserves it during travel then closes it without duplicate rewards', () => {
    const g=quiet(true); for(const s of g.state.stones)s.distance+=4;
    const victim=g.state.stones[20]!; damageStone(g,victim.id,999); g.useRewind(token(g));
    const positions=g.state.stones.map(s=>s.distance); advance(g,.5);
    const shift=positions[0]!-g.state.stones[0]!.distance;
    for(let i=0;i<positions.length;i++)expect(positions[i]!-g.state.stones[i]!.distance).toBeCloseTo(shift);
    advance(g,.7); expect(head(g)).toBeCloseTo(getPathLength()/2); advance(g,1); assertConnected(g); assertNoOverlap(g);
    expect(g.state.coins).toBe(victim.reward); expect(g.state.stats.destroyed).toBe(1);
  });
  it('pause midway freezes rewind; repeated pickup retargets continuously without teleport', () => {
    const g=quiet(); for(const s of g.state.stones)s.distance+=5; g.useRewind(token(g)); advance(g,.3);
    g.setPaused(true); const positions=g.state.stones.map(s=>s.distance); g.tick(100); expect(g.state.stones.map(s=>s.distance)).toEqual(positions);
    g.setPaused(false); const h=head(g); g.useRewind(token(g)); expect(head(g)).toBe(h); advance(g,1.2); expect(head(g)).toBeCloseTo(getPathLength()/2);
  });
  it('destroying the head during rewind cannot shift survivors forward', () => {
    const g=quiet(true); for(const s of g.state.stones)s.distance+=.1; g.useRewind(token(g));
    damageStone(g,ordered(g).at(-1)!.id,999); const before=head(g); advance(g,1/60);
    expect(head(g)).toBe(before); expect(g.state.rewindTarget).toBeNull(); assertNoOverlap(g);
  });
});
