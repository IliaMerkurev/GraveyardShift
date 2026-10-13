import { describe, expect, it } from 'vitest';
import { Game } from '../../src/game/Simulation';
import { CONFIG } from '../../src/game/config';
import { getPathLength } from '../../src/game/path';
const advance = (g: Game, seconds: number) => { for (let i=0; i<Math.round(seconds*60); i++) g.tick(1/60); };
const head = (g: Game) => Math.max(...g.state.stones.map(s=>s.distance));
const tail = (g: Game) => Math.min(...g.state.stones.map(s=>s.distance));
function quietGame() { const g=new Game(); const p=g.state.pads[0]!; delete g.state.entities[p.entityId!]; p.entityId=null; return g; }
function ownership(g: Game) { const ids=[...g.state.pads,...g.state.slots].flatMap(p=>p.entityId?[p.entityId]:[]); if(g.state.drag)ids.push(g.state.drag.entityId); expect(new Set(ids).size).toBe(ids.length); expect(ids.sort()).toEqual(Object.keys(g.state.entities).sort()); expect(g.state.slots.filter(s=>s.reserved).length).toBe(g.state.drag?.source.kind==='slot'?1:0); }

describe('prototype 0.2: bounded snake progression and difficulty',()=>{
 it('starts exactly halfway with a contiguous tail behind and leaves the final half empty',()=>{const g=new Game(); expect(head(g)).toBeCloseTo(getPathLength()/2); expect(tail(g)).toBeGreaterThanOrEqual(0); const stones=[...g.state.stones].sort((a,b)=>a.distance-b.distance); for(let i=1;i<stones.length;i++)expect(stones[i]!.distance-stones[i-1]!.distance).toBeCloseTo(CONFIG.stones.spacing); expect(stones).toHaveLength(65);});
 it('moves gradually rather than filling the remaining path at once',()=>{const g=quietGame(), h=head(g); advance(g,1); expect(head(g)).toBeGreaterThan(h); expect(head(g)-h).toBeLessThan(.35); expect(head(g)).toBeLessThan(getPathLength()*.52);});
 it('accelerates smoothly with active time, never beyond the configured cap',()=>{const g=quietGame(); g.state.stones=[g.state.stones[0]!]; g.state.stones[0]!.distance=-1000; let before=head(g); advance(g,1); const first=head(g)-before; advance(g,20); before=head(g); advance(g,1); expect(head(g)-before).toBeGreaterThan(first); g.state.time=10000; before=head(g); advance(g,1); expect(head(g)-before).toBeCloseTo(CONFIG.stones.maxSpeed,7);});
 it('ends at the finish once, freezes commands and cannot resume without restart',()=>{const g=quietGame(); const shift=getPathLength()-head(g)-.001; for(const s of g.state.stones)s.distance+=shift; advance(g,.1); expect(g.state.gameOver).toBe(true); expect(head(g)).toBeCloseTo(getPathLength()); expect(g.state.events.filter(e=>e.type==='gameover')).toHaveLength(1); const before=structuredClone(g.state); g.setPaused(false); advance(g,5); expect(g.state.time).toBe(before.time); expect(g.openBarrel('slot-0')).toBe(false); expect(g.buyPad('pad-1')).toBe(false); expect(g.beginDrag(Object.keys(g.state.entities)[0]!)).toBe(false); g.reset(); expect(g.state.gameOver).toBe(false); expect(g.state.time).toBe(0); expect(head(g)).toBeCloseTo(getPathLength()/2);});
 it('Help/hidden-style pause preserves elapsed difficulty and discards catch-up time',()=>{const g=quietGame(); advance(g,3); g.setPaused(true); const snapshot=structuredClone(g.state); g.tick(300); expect(g.state).toEqual(snapshot); g.setPaused(false); g.tick(300); expect(g.state.time).toBeCloseTo(3.1);});
});

// Animated closure and rewind coverage moved to v02-feedback-motion.test.ts.

describe('prototype 0.2: moving belt and expiry',()=>{
 it('full belt moves, loses untouched barrels, refills and never pauses',()=>{const g=quietGame(),id=g.state.slots[0]!.entityId!;advance(g,2);expect(g.state.entities[id]).toBeUndefined();expect(g.state.conveyorPaused).toBe(false);expect(g.state.slots[0]!.x).toBeGreaterThan(2);expect(g.state.entities[g.state.slots[0]!.entityId!]?.kind).toBe('barrel');expect(g.state.coins).toBe(0);ownership(g);});
 it.each(['worker','bomb','rewind'] as const)('uncollected %s disappears at exit without reward',kind=>{const g=quietGame(),slot=g.state.slots[0]!,barrel=g.state.entities[slot.entityId!]!;if(barrel.kind!=='barrel')throw Error('barrel');barrel.content=kind;g.openBarrel(slot.id);const id=slot.entityId!;advance(g,2);expect(g.state.entities[id]).toBeUndefined();expect(g.state.coins).toBe(0);expect(g.state.stats.bombsUsed).toBe(0);ownership(g);});
 it('a drag from a pad is not expired by an unrelated belt wrap',()=>{const g=new Game();const id=g.state.pads[0]!.entityId!;g.beginDrag(id);advance(g,3);expect(g.state.drag?.entityId).toBe(id);expect(g.cancelDrag()).toBe(true);expect(g.state.pads[0]!.entityId).toBe(id);ownership(g);});
 it('pause cancels moving-source drag safely, and restart clears expiry and difficulty state',()=>{const g=quietGame();g.openBarrel('slot-0');g.beginDrag(g.state.slots[0]!.entityId!);advance(g,.5);g.setPaused(true);expect(g.state.drag).toBeNull();const x=g.state.slots[0]!.x;advance(g,5);expect(g.state.slots[0]!.x).toBe(x);g.reset();expect(g.state.gameOver).toBe(false);expect(g.state.time).toBe(0);expect(g.state.slots.every(s=>!s.reserved)).toBe(true);ownership(g);});
});
