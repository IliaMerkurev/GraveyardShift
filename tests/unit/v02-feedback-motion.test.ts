import { describe, expect, it } from 'vitest';
import { Game } from '../../src/game/Simulation';
import { CONFIG } from '../../src/game/config';
import { damageStone } from '../../src/game/commands';
import { getPathLength } from '../../src/game/path';
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
    expect(head(g)).toBeCloseTo(0); expect(ordered(g)[0]!.distance).toBeCloseTo(tail-h+0);
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
