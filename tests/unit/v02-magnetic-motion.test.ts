import { describe, expect, it } from 'vitest';
import { Game } from '../../src/game/Simulation';
import { CONFIG } from '../../src/game/config';
import { damageStone } from '../../src/game/commands';
import { attractionSpeed, contactBounce, forwardSpeed, recoilDistances } from '../../src/game/motion';
import { createMiningState } from '../../src/game/GameState';
import { getPathLength, samplePath } from '../../src/game/path';
const advance = (g: Game, seconds: number) => { for(let i=0;i<Math.round(seconds*60)&&!g.state.gameOver;i++) g.tick(1/60); };
const ordered = (g: Game) => [...g.state.stones].sort((a,b)=>a.distance-b.distance);
const head = (g: Game) => ordered(g).at(-1)!.distance;
function quiet() { const g=new Game(); for(const p of g.state.pads){if(p.entityId)delete g.state.entities[p.entityId];p.entityId=null;} return g; }
function integrity(g: Game) { const a=ordered(g);expect(new Set(a.map(s=>s.id)).size).toBe(a.length);for(let i=1;i<a.length;i++)expect(a[i]!.distance-a[i-1]!.distance).toBeGreaterThanOrEqual(CONFIG.stones.spacing-1e-8);for(const s of a)expect(Number.isFinite(s.distance)).toBe(true); }
function gap(g: Game) { return ordered(g).some((s,i,a)=>i>0&&s.distance-a[i-1]!.distance>CONFIG.stones.spacing+1e-8); }

describe('magnetic motion delta',()=>{
  it('keeps rear moving throughout front pause and pulls front backward to moving contact with bounce',()=>{
    const g=quiet(), rear=g.state.stones[19]!, front=g.state.stones[21]!, h=head(g), r=rear.distance,f=front.distance;
    const victim=g.state.stones[20]!;damageStone(g,victim.id,999);expect(damageStone(g,victim.id,999)).toBe(false);
    advance(g,.35);expect(front.distance).toBe(f);expect(head(g)).toBe(h);expect(rear.distance).toBeGreaterThan(r+.11);
    const rearPause=rear.distance;advance(g,1/60);expect(front.distance).toBeLessThan(f);expect(rear.distance).toBeGreaterThan(rearPause);expect(g.state.headSpeed).toBeLessThan(0);
    for(let i=0;i<60&&gap(g);i++){g.tick(1/60);integrity(g);}expect(gap(g)).toBe(false);expect(front.bounceRemaining).toBeGreaterThan(0);
    const contact=head(g);advance(g,.1);expect(head(g)).toBeGreaterThan(contact);expect(contactBounce(front.bounceRemaining!)).toBeGreaterThan(.08);
    advance(g,.2);expect(contactBounce(front.bounceRemaining!)).toBe(0);expect(g.state.coins).toBe(victim.reward);
  });
  it('large bomb gaps attract faster than small gaps, progressively and within a second after pause',()=>{
    const rates:number[]=[];
    for(const count of [1,8]){
      const g=quiet(),victims=g.state.stones.slice(20,20+count),rear=g.state.stones[19]!;
      for(const v of victims)damageStone(g,v.id,999);
      advance(g,.35);const h=head(g),r=rear.distance;g.tick(1/60);rates.push((h-head(g))*60);expect(rear.distance).toBeGreaterThan(r);
      const before=new Map(g.state.stones.map(s=>[s.id,s.distance]));let sawBounce=false;
      for(let i=0;i<60;i++){const old=ordered(g);const maxGap=Math.max(...old.slice(1).map((s,j)=>s.distance-old[j]!.distance-CONFIG.stones.spacing),0);g.tick(1/60);integrity(g);sawBounce ||= g.state.stones.some(s=>(s.bounceRemaining??0)>0);for(const s of g.state.stones){const prev=before.get(s.id);if(prev!==undefined)expect(prev-s.distance).toBeLessThanOrEqual(attractionSpeed(maxGap)/60+1e-8);before.set(s.id,s.distance);}}
      expect(gap(g)).toBe(false);expect(sawBounce).toBe(true);expect(g.state.stats.destroyed).toBe(count);
    }
    expect(rates[1]).toBeGreaterThan(10);expect(rates[1]!).toBeGreaterThan(rates[0]!*3);
  });
  it('snapshots multiple sections, survives adjacent/repeated damage without overlap or delay restart',()=>{
    const g=quiet();for(const v of [...g.state.stones.slice(15,20)])damageStone(g,v.id,999);damageStone(g,g.state.stones[35]!.id,999);
    advance(g,.2);const boundary=g.state.stones.find(s=>s.id==='stone-1-20')!;const deadline=g.state.gapReadyAt[boundary.id];damageStone(g,boundary.id,999);
    expect(g.state.gapReadyAt['stone-1-21']).toBe(deadline);
    let previousRear=ordered(g)[0]!.distance;
    for(let i=0;i<120;i++){if(i===18||i===30)damageStone(g,ordered(g)[15]!.id,999);g.tick(1/60);integrity(g);const rear=g.state.stones.find(s=>s.id==='stone-1-0')!;expect(rear.distance).toBeGreaterThan(previousRear);previousRear=rear.distance;}
    expect(gap(g)).toBe(false);expect(Object.keys(g.state.gapReadyAt)).toHaveLength(0);
  });
  it('longitudinal render recoil moves away from rear and cannot cross another section or finish',()=>{
    const g=quiet(),list=ordered(g);for(const stone of list)stone.bounceRemaining=.12;list[30]!.bounceRemaining=0;
    const rendered=recoilDistances(list,getPathLength());expect(rendered.at(-1)!).toBeGreaterThan(list.at(-1)!.distance+.09);
    for(let i=1;i<list.length;i++)expect(rendered[i]!-rendered[i-1]!).toBeGreaterThanOrEqual(CONFIG.stones.spacing-1e-8);
    expect(rendered[29]).toBeCloseTo(list[29]!.distance);const shift=getPathLength()-list.at(-1)!.distance;for(const s of list)s.distance+=shift;expect(recoilDistances(list,getPathLength()).at(-1)).toBeCloseTo(getPathLength());
  });
  it('moving rear safely pushes front when it catches a small gap before pause ends',()=>{
    const g=quiet();g.state.time=40;const rear=g.state.stones[19]!,front=g.state.stones[21]!;damageStone(g,g.state.stones[20]!.id,999);
    const r=rear.distance,f=front.distance;advance(g,.15);expect(rear.distance).toBeGreaterThan(r+forwardSpeed(40)*.14);expect(front.distance).toBeGreaterThan(f);expect(gap(g)).toBe(false);integrity(g);
  });
  it('tail supplies and finish remains terminal while another gap is still paused',()=>{
    const g=quiet();g.state.stones=g.state.stones.slice(0,3);const list=g.state.stones;list[0]!.distance=1;list[1]!.distance=1+CONFIG.stones.spacing;list[2]!.distance=getPathLength()-.0001;g.state.gapReadyAt[list[2]!.id]=1;
    g.tick(1/60);expect(g.state.stones.length).toBeGreaterThan(3);expect(g.state.gameOver).toBe(false);
    // Rear is already at finish contact, so a paused front is pushed across it.
    g.state.stones=list.slice(0,2);g.state.stones[0]!.distance=getPathLength()-.245-.001;g.state.stones[1]!.distance=getPathLength()-.0001;g.state.time=40;
    g.tick(1/60);expect(g.state.gameOver).toBe(true);expect(head(g)).toBeCloseTo(getPathLength());expect(g.state.events.filter(e=>e.type==='gameover')).toHaveLength(1);integrity(g);
  });
  it('pause freezes bounce and difficulty; reset and rewind clear recoil',()=>{
    const g=quiet();damageStone(g,g.state.stones[20]!.id,999);advance(g,.4);g.setPaused(true);const state=structuredClone(g.state);g.tick(10);expect(g.state).toEqual(state);g.setPaused(false);
    g.state.rewindTarget=head(g)-1;g.state.rewindSpeed=1;g.tick(1/60);expect(g.state.stones.every(s=>s.bounceRemaining===0)).toBe(true);g.reset();expect(g.state.time).toBe(0);expect(g.state.stones.every(s=>!s.bounceRemaining)).toBe(true);
  });
  it('slow scales actual rear and attraction, while active-time pressure keeps growing',()=>{
    const normal=quiet(),slow=quiet();slow.state.slowRemaining=5;for(const g of [normal,slow]){for(const v of g.state.stones.slice(20,28))damageStone(g,v.id,999);advance(g,.35);}
    const n=normal.state.stones[0]!.distance,s=slow.state.stones[0]!.distance;normal.tick(1/60);slow.tick(1/60);expect((slow.state.stones[0]!.distance-s)/(normal.state.stones[0]!.distance-n)).toBeCloseTo(.5);expect(normal.state.time).toBeCloseTo(slow.state.time);expect(head(slow)).toBeGreaterThan(head(normal));
  });
});
describe('strong active-time pressure delta',()=>{
  it('measures actual 20/40/60 second travel and remains finite at extreme time',()=>{
    for(const [t,speed] of [[20,.54],[40,1.04],[60,1.84]]) expect(forwardSpeed(t!)).toBeCloseTo(speed!,8);
    for(const t of [20,40,60]){const g=quiet();g.state.stones=[g.state.stones[0]!];g.state.stones[0]!.distance=-10000;g.state.time=t;const h=head(g);g.tick(1/60);expect((head(g)-h)*60).toBeCloseTo(forwardSpeed(t+1/60),7);}
    expect(forwardSpeed(0)).toBe(.34);for(const t of [10,20,40,60,120])expect(forwardSpeed(t)-.34).toBeCloseTo((.010*t+.0015*t*t)/4,9);
    expect(Number.isFinite(forwardSpeed(Number.MAX_VALUE))).toBe(true);expect(forwardSpeed(120)).toBeGreaterThan(forwardSpeed(60)*2);
  });
  it('ordinary starter miner and four fully staffed miners still reach natural finite defeat',()=>{
    const outcomes=[];
    for(const staffed of [false,true]){const g=new Game();if(staffed){for(const [i,p]of g.state.pads.entries()){p.unlocked=true;const id=p.entityId??`test-worker-${i}`;p.entityId=id;g.state.entities[id]={id,kind:'worker',level:3,location:{kind:'pad',id:p.id},mining:createMiningState()};}}
      const start=head(g);let rearTravel=0;for(let i=0;i<60*90&&!g.state.gameOver;i++){const rear=ordered(g)[0]!,r=rear.distance;g.tick(1/60);rearTravel+=rear.distance-r;integrity(g);}
      expect(g.state.gameOver).toBe(true);expect(g.state.time).toBeGreaterThan(15);expect(g.state.time).toBeLessThan(90);expect(head(g)).toBeCloseTo(getPathLength());expect(g.state.stats.destroyed).toBeGreaterThan(0);expect(rearTravel).toBeGreaterThan(head(g)-start);outcomes.push({staffed,time:g.state.time,destroyed:g.state.stats.destroyed,rearTravel});
    }
    console.log('Natural pressure evidence',JSON.stringify(outcomes));
  });
  it('real starter mining creates a delayed front gap while unchanged rear advances',()=>{
    const g=new Game();while(!g.state.stats.destroyed&&g.state.time<22)g.tick(1/60);
    expect(g.state.stats.destroyed).toBe(1);const a=ordered(g),index=a.findIndex((s,i)=>i>0&&s.distance-a[i-1]!.distance>CONFIG.stones.spacing+1e-8);
    expect(index).toBeGreaterThan(0);const rear=a[index-1]!,front=a[index]!,r=rear.distance,f=front.distance,killTime=g.state.time;advance(g,.1);
    expect(front.distance).toBe(f);expect(rear.distance).toBeGreaterThan(r);advance(g,.3);expect(gap(g)).toBe(false);integrity(g);
    console.log('First natural mined contact',JSON.stringify({killTime,time:g.state.time,frontMovement:front.distance-f,rearMovement:rear.distance-r}));
  });
  it('constant .34 baseline measures starter mining without difficulty growth',()=>{const c=structuredClone(CONFIG);c.stones.acceleration=0;const g=new Game(c);advance(g,30);console.log('Constant opening baseline',JSON.stringify({time:g.state.time,destroyed:g.state.stats.destroyed,head:head(g)}));expect(g.state.stats.destroyed).toBeGreaterThan(0);});
  it('actual bomb command removes only original victims and recovers with moving rear',()=>{
    const g=quiet();g.openBarrel('slot-3');const id=g.state.slots[3]!.entityId!;const target={kind:'track' as const,...samplePath(8)};g.beginDrag(id);expect(g.drop(target)).toBe(true);const h=head(g);advance(g,.35);expect(head(g)).toBe(h);advance(g,1);expect(gap(g)).toBe(false);integrity(g);
  });
});
