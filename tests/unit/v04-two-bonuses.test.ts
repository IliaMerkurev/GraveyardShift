import { describe, expect, it } from 'vitest';
import { Game } from '../../src/game/Simulation';
import { CONFIG } from '../../src/game/config';
import type { ContentKind } from '../../src/game/GameState';
import { damageStone } from '../../src/game/commands';
import { effectiveForwardSpeed, forwardSpeed } from '../../src/game/motion';
const advance = (g: Game, seconds: number) => { for (let i=0;i<Math.round(seconds*60);i++) g.tick(1/60); };
function game() { const c=structuredClone(CONFIG);c.mining.radius=0;return new Game(c); }
let serial=0;
function token(g:Game,kind:ContentKind) {
 const slot=g.state.slots[0]!; if(slot.entityId) delete g.state.entities[slot.entityId];
 const id=`fixture-${serial++}`;slot.entityId=id;g.state.entities[id]={id,kind:'barrel',content:kind,location:{kind:'slot',id:slot.id}};
 expect(g.openBarrel(slot.id)).toBe(true);return id;
}
const speed=(g:Game)=>effectiveForwardSpeed(g.state.difficultyTime,g.state.permanentSpeedReduction,g.config,g.state.minimumForwardSpeed);
const pose=(g:Game)=>g.state.stones.filter(s=>g.state.tailWaitingIds.includes(s.id)).map(s=>[s.id,s.distance,s.waitingRenderDistance]);
describe('v0.4 two additional bonuses',()=>{
 it('halves exactly repeatedly below the old floor; future acceleration is unchanged and brake never raises speed',()=>{
  const g=game();for(let i=0;i<12;i++){const before=speed(g);expect(g.useHalfSpeed(token(g,'halfSpeed'))).toBe(true);expect(speed(g)).toBeCloseTo(before/2,13);}
  expect(speed(g)).toBeLessThan(CONFIG.stones.speed*CONFIG.brake.minimumBaseFraction);
  const before=speed(g);g.useBrake(token(g,'brake'));expect(speed(g)).toBeCloseTo(before,13);
  const time=g.state.difficultyTime;advance(g,1);expect(speed(g)-before).toBeCloseTo(forwardSpeed(g.state.difficultyTime)-forwardSpeed(time),13);
  g.reset();expect(g.state.minimumForwardSpeed).toBe(CONFIG.stones.speed*CONFIG.brake.minimumBaseFraction);expect(g.state.permanentSpeedReduction).toBe(0);
 });
 it('halves underlying forward speed during pause and rewind without shortening pause or changing rewind',()=>{
  const g=game();g.useRewind(token(g,'rewind'));const rewind=g.state.rewindTarget;
  g.useSlow(token(g,'slow'));const before=speed(g);g.useHalfSpeed(token(g,'halfSpeed'));expect(speed(g)).toBeCloseTo(before/2);expect(g.state.rewindTarget).toBe(rewind);expect(g.state.slowRemaining).toBe(5);
 });
 it('destroys the tail half, rewards each once and leaves all survivors fixed while new rear arrives only from entrance',()=>{
  const g=game(),ordered=[...g.state.stones].sort((a,b)=>a.distance-b.distance),count=Math.ceil(ordered.length/2);
  const survivors=ordered.slice(count).map(s=>[s.id,s.distance]);const rewards=ordered.slice(0,count).reduce((n,s)=>n+s.reward,0);
  const id=token(g,'tailBlast');expect(g.useTailBlast(id)).toBe(true);expect(g.useTailBlast(id)).toBe(false);
  expect(g.state.stones.map(s=>[s.id,s.distance])).toEqual(survivors);expect(g.state.coins).toBe(rewards);expect(g.state.stats.destroyed).toBe(count);
  const held=pose(g);advance(g,1/60);expect(g.state.stones).toHaveLength(survivors.length+1);expect(g.state.stones.at(-1)!.distance).toBe(0);
  advance(g,1);expect(pose(g)).toEqual(held);expect(g.state.headSpeed).toBe(0);expect(g.state.tailWaitingIds).toHaveLength(survivors.length);
 });
 it('waits through old internal gaps, mining boundary destruction and pause without visual drift',()=>{
  const g=game();g.state.stones.at(-1)!.bounceRemaining=.12;damageStone(g,g.state.stones[50]!.id,99999);
  g.useTailBlast(token(g,'tailBlast'));advance(g,1);damageStone(g,g.state.tailWaitingIds[0]!,99999);advance(g,1/60);const held=pose(g);
  g.useSlow(token(g,'slow'));for(const s of g.state.stones.filter(s=>g.state.tailWaitingIds.includes(s.id)))expect(s.frozenRenderDistance).toBe(s.waitingRenderDistance);
  const positions=g.state.stones.map(s=>s.distance),difficulty=g.state.difficultyTime;advance(g,5);expect(g.state.stones.map(s=>s.distance)).toEqual(positions);expect(g.state.difficultyTime).toBeCloseTo(difficulty);advance(g,.1);expect(pose(g)).toEqual(held);
 });
 it('releases only on swept rear contact, then resumes and clears waiting on rewind including a no-op rewind',()=>{
  const g=game();g.state.stones=g.state.stones.slice(0,4);g.state.stones.forEach((s,i)=>s.distance=i*.245);
  g.useTailBlast(token(g,'tailBlast'));const held=pose(g);advance(g,.5);expect(pose(g)).toEqual(held);advance(g,1);expect(g.state.tailWaitingIds).toEqual([]);
  expect(g.state.stones.at(-1)).toBeDefined();g.useTailBlast(token(g,'tailBlast'));expect(g.state.tailWaitingIds.length).toBeGreaterThan(0);g.useRewind(token(g,'rewind'));expect(g.state.tailWaitingIds).toEqual([]);expect(g.state.rewindTarget).toBeNull();expect(g.state.stones.every(s=>s.waitingRenderDistance===undefined)).toBe(true);
 });
 it('rewind clears waiting immediately even while paused, and a newer blast supersedes queued rewind',()=>{
  const g=game();g.useTailBlast(token(g,'tailBlast'));g.useSlow(token(g,'slow'));g.useRewind(token(g,'rewind'));expect(g.state.tailWaitingIds).toEqual([]);expect(g.state.rewindTarget).not.toBeNull();const target=g.state.rewindTarget;
  g.useTailBlast(token(g,'tailBlast'));expect(g.state.rewindTarget).toBeNull();expect(g.state.tailWaitingIds.length).toBeGreaterThan(0);expect(target).not.toBeNull();
 });
 it('high-speed rear sections cannot overlap while catching a held front',()=>{
  const g=game();g.config.stones.speed=100;g.state.stones=g.state.stones.slice(0,3);
  const [a,b,held]=g.state.stones;a!.distance=8;b!.distance=9.5;held!.distance=10;
  g.state.tailWaitingIds=[held!.id];held!.waitingRenderDistance=10;advance(g,1/60);
  const ordered=[...g.state.stones].sort((x,y)=>x.distance-y.distance);
  ordered.slice(1).forEach((s,i)=>expect(s.distance-ordered[i]!.distance).toBeGreaterThanOrEqual(g.config.stones.spacing-1e-9));expect(held!.distance).toBe(10);
 });
 it('repeated blasts re-snapshot survivors, and zero/one/odd counts safely regenerate',()=>{
  for(const count of [0,1,3]){const g=game();g.state.stones=g.state.stones.slice(0,count);g.useTailBlast(token(g,'tailBlast'));expect(g.state.stones).toHaveLength(Math.floor(count/2));advance(g,1/60);expect(g.state.stones.length).toBeGreaterThan(0);g.useTailBlast(token(g,'tailBlast'));advance(g,1);expect(g.state.stones.every(s=>Number.isFinite(s.distance))).toBe(true);}
 });
 it.each(['halfSpeed','tailBlast'] as const)('%s supports storage, cancel, invalid drop and single field activation',kind=>{
  const g=game(),id=token(g,kind),stand=g.state.storage[0]!;g.state.coins=100;
  expect(g.beginDrag(id)).toBe(true);expect(g.drop({kind:'storage',id:stand.id})).toBe(true);expect(stand.entityId).toBe(id);expect(g.state.coins).toBe(50);
  expect(g.beginDrag(id)).toBe(true);expect(g.drop({kind:'field',x:100,z:100})).toBe(false);expect(stand.entityId).toBe(id);
  g.beginDrag(id);g.cancelDrag();expect(stand.entityId).toBe(id);
  g.beginDrag(id);expect(g.drop({kind:'field',x:0,z:-7})).toBe(true);expect(stand.entityId).toBeNull();expect(g.state.entities[id]).toBeUndefined();expect(g.drop({kind:'field',x:0,z:-7})).toBe(false);
 });
 it('all six bonuses occupy equal 1/12 intervals; workers occupy half and every reveal contains an item',()=>{
  const c=structuredClone(CONFIG);c.conveyor.starter=[];c.mining.radius=0;const g=new Game(c);
  const internal=g as unknown as {random:()=>number;spawnBarrel:(id:string)=>void};const kinds:ContentKind[]=['worker','worker','worker','worker','worker','worker','bomb','rewind','brake','halfSpeed','tailBlast','slow'];
  kinds.forEach((kind,i)=>{const slot=g.state.slots[0]!;if(slot.entityId)delete g.state.entities[slot.entityId];slot.entityId=null;internal.random=()=>(i+.5)/12;internal.spawnBarrel(slot.id);const id=slot.entityId!;expect(g.openBarrel(slot.id)).toBe(true);expect(g.state.entities[id]!.kind).toBe(kind);});expect(g.state.coins).toBe(0);
 });
});
