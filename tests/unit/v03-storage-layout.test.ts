import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { mapPosition, unmapFieldPosition, placeZone, LANDSCAPE_LAYOUT } from '../../src/render/Layout';
import { SceneView } from '../../src/render/SceneFactory';
import { Game } from '../../src/game/Simulation';
import { CONFIG } from '../../src/game/config';

function viewFor(game:Game){
  const width=844,height=326;
  const camera=new THREE.PerspectiveCamera(38,width/height,.1,100);
  const distance=Math.max(10.4/2/Math.tan(19*Math.PI/180),18/2/Math.tan(19*Math.PI/180)/(width/height))*1.03;
  const target=new THREE.Vector3(0,0,LANDSCAPE_LAYOUT.cameraTargetZ);camera.position.copy(target).addScaledVector(new THREE.Vector3(0,17,12).normalize(),distance);camera.lookAt(target);camera.updateMatrixWorld();
  const view=Object.create(SceneView.prototype) as SceneView;
  Object.assign(view,{camera,state:game.state,landscape:true,lastWidth:width,lastHeight:height,raycaster:new THREE.Raycaster(),plane:new THREE.Plane(new THREE.Vector3(0,1,0),0),
    canvas:{getBoundingClientRect:()=>({left:0,top:0,width,height,right:width,bottom:height})},shell:{querySelectorAll:()=>[]}});
  return view;
}
function heldBonus(game:Game){const slot=game.state.slots[0]!;const barrel=game.state.entities[slot.entityId!]!;if(barrel.kind!=='barrel')throw Error('Expected barrel');barrel.content='rewind';game.openBarrel(slot.id);game.beginDrag(barrel.id);return barrel.id;}

describe('v0.3 separated storage and pit coordinates',()=>{
  it('stacks a centered field, horizontal storage and pit row, then the lower belt',()=>{
    const row=CONFIG.storage.map(p=>mapPosition(p,true,'storage'));
    expect(row.map(p=>p.z)).toEqual([4.7,4.7,4.7]);expect(row[0]!.x).toBeCloseTo(-3.6);expect(row[1]!.x).toBeCloseTo(-1.2);expect(row[2]!.x).toBeCloseTo(1.2);
    expect(row[0]!.z-3.14).toBeGreaterThan(1.5);expect(LANDSCAPE_LAYOUT.beltZ-row[0]!.z).toBeGreaterThan(1.9);expect(LANDSCAPE_LAYOUT.fieldOffsetX).toBe(0);
    expect(mapPosition(CONFIG.discard,true,'discard')).toEqual({x:4.2,z:4.7});
    expect(CONFIG.storage.map(p=>mapPosition(p,false,'storage'))).toEqual(CONFIG.storage);
  });
  it('roundtrips field rays without treating raw drag points as storage coordinates',()=>{
    for(const p of [...CONFIG.storage,CONFIG.discard,{x:2,z:-5}]){
      const roundtrip=unmapFieldPosition(mapPosition(p,true,'field'),true);
      expect(roundtrip.x).toBeCloseTo(p.x);expect(roundtrip.z).toBeCloseTo(p.z);expect(placeZone(p)).toBe('field');
    }
    expect(placeZone({...CONFIG.storage[0]!,id:'storage-0'})).toBe('storage');
  });
  it('picks and drops at every relocated stand, including nearer neighboring halo',()=>{
    const game=new Game(),view=viewFor(game);
    for(const stand of game.state.storage){const p=view.project(stand,.1);expect(view.hit(p.x,p.y)).toEqual({kind:'storage',id:stand.id});}
    heldBonus(game);
    for(const stand of game.state.storage){const p=view.project(stand,.1);expect(view.dropTarget(p.x,p.y)).toEqual({kind:'storage',id:stand.id});}
  });
  it('uses the relocated exact pit and not its former rotated location',()=>{
    const game=new Game(),view=viewFor(game);heldBonus(game);
    const p=view.project(CONFIG.discard,0,false,'discard');expect(view.hit(p.x,p.y)).toBeNull();expect(view.dropTarget(p.x,p.y)).toEqual({kind:'discard'});
    const old=view.project(CONFIG.discard);expect(view.dropTarget(old.x,old.y)).not.toEqual({kind:'discard'});
  });
  it('keeps an occupied pocket collectible at its new position',()=>{
    const game=new Game();game.state.coins=1000;const id=heldBonus(game);expect(game.drop({kind:'storage',id:'storage-2'})).toBe(true);
    const view=viewFor(game),p=view.project(game.state.storage[2]!, .39);expect(view.hit(p.x,p.y)).toEqual({kind:'entity',id});
  });
  it('keeps new belt mapping and bonus rejection aligned',()=>{
    const game=new Game(),view=viewFor(game);heldBonus(game);
    const screen=view.project({x:0,z:CONFIG.conveyor.z},0,true);
    expect(view.dropTarget(screen.x,screen.y)).toBeNull();
    expect(mapPosition({x:0,z:CONFIG.conveyor.z},true,'belt').z).toBe(LANDSCAPE_LAYOUT.beltZ);
    expect(screen.y).toBeLessThan(326);
  });
  it('inverts the centered field under actual perspective rays',()=>{
    const game=new Game(),view=viewFor(game),point={x:.2,z:-4.5},screen=view.project(point);
    const result=view.world(screen.x,screen.y)!;expect(result.x).toBeCloseTo(point.x);expect(result.z).toBeCloseTo(point.z);
  });
});
