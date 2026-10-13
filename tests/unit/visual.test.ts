import { describe,it,expect } from 'vitest';
import { createWorker,helmetColors } from '../../src/render/PrimitiveFactory';
import { Mesh,MeshLambertMaterial } from 'three';
describe('primitive worker visual contract',()=>{
 it('reuses identical geometry and scale at every level; only helmet color changes',()=>{
  const a=createWorker(),b=createWorker();const initial=a.group.children.map(o=>o instanceof Mesh?o.geometry:null);const scale=a.group.scale.clone();
  for(let level=1;level<=5;level++){a.setLevel(level);expect(a.group.children.map(o=>o instanceof Mesh?o.geometry:null)).toEqual(initial);expect(a.group.scale).toEqual(scale);expect((a.helmet.material as MeshLambertMaterial).color.getHex()).toBe(helmetColors[level-1]);}
  expect((a.group.children[0] as Mesh).geometry).toBe((b.group.children[0] as Mesh).geometry);expect(a.helmet.geometry).toBe(b.helmet.geometry);a.dispose();b.dispose();
 });
 it('keeps a feet-origin and animates only the tool pivot',()=>{const worker=createWorker();const position=worker.group.position.clone(),body=worker.group.children[0].matrix.clone();worker.setAction(.52);expect(worker.arm.rotation.x).toBeGreaterThan(0);expect(worker.group.position).toEqual(position);expect(worker.group.children[0].matrix).toEqual(body);worker.dispose();});
});
