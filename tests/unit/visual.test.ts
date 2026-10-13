import { describe,it,expect } from 'vitest';
import { createWorker,createRewind,createSlow,disposePrimitive,helmetColors } from '../../src/render/PrimitiveFactory';
import { Mesh,MeshLambertMaterial } from 'three';
describe('primitive worker visual contract',()=>{
 it('reuses identical geometry and scale at every level; only helmet color changes',()=>{
  const a=createWorker(),b=createWorker();const initial=a.group.children.map(o=>o instanceof Mesh?o.geometry:null);const scale=a.group.scale.clone();
  for(let level=1;level<=5;level++){a.setLevel(level);expect(a.group.children.map(o=>o instanceof Mesh?o.geometry:null)).toEqual(initial);expect(a.group.scale).toEqual(scale);expect((a.helmet.material as MeshLambertMaterial).color.getHex()).toBe(helmetColors[level-1]);}
  expect((a.group.children[0] as Mesh).geometry).toBe((b.group.children[0] as Mesh).geometry);expect(a.helmet.geometry).toBe(b.helmet.geometry);a.dispose();b.dispose();
 });
 it('keeps a feet-origin and animates only the tool pivot',()=>{const worker=createWorker();const position=worker.group.position.clone(),body=worker.group.children[0].matrix.clone();worker.setAction(.52);expect(worker.arm.rotation.x).toBeGreaterThan(0);expect(worker.group.position).toEqual(position);expect(worker.group.children[0].matrix).toEqual(body);worker.dispose();});
});

describe('v0.2 rewind primitive visual contract',()=>{
 it('uses a cyan low-poly token with no worker or external assets',()=>{
  const token=createRewind();
  expect(token.children).toHaveLength(2);
  const [rim,face]=token.children as Mesh[];
  expect(rim.geometry.type).toBe('CylinderGeometry');
  expect(face.geometry.type).toBe('CylinderGeometry');
  expect((face.material as MeshLambertMaterial).color.getHex()).toBe(0x74f8f0);
  expect((face.material as MeshLambertMaterial).map).toBeNull();
  expect(token.scale.toArray()).toEqual([1,1,1]);
  let disposed=0;
  for(const mesh of [rim,face]){
   expect(mesh.geometry.getAttribute('position').count).toBeLessThan(160);
   mesh.geometry.addEventListener('dispose',()=>disposed++);
   (mesh.material as MeshLambertMaterial).addEventListener('dispose',()=>disposed++);
  }
  disposePrimitive(token);
  expect(disposed).toBe(4);
 });
});

describe('v0.2 slow-token primitive visual contract',()=>{
 it('uses a purple clock face with two solid hands and no external assets',()=>{
  const token=createSlow();
  expect(token.children).toHaveLength(4);
  const [rim,face,minute,hour]=token.children as Mesh[];
  expect(rim.geometry.type).toBe('CylinderGeometry');
  expect(face.geometry.type).toBe('CylinderGeometry');
  expect((face.material as MeshLambertMaterial).color.getHex()).toBe(0xaaa1ff);
  expect((face.material as MeshLambertMaterial).map).toBeNull();
  expect([minute.geometry.type,hour.geometry.type]).toEqual(['BoxGeometry','BoxGeometry']);
  expect(minute.position.y).toBeGreaterThan(face.position.y);
  expect(hour.position.y).toBeGreaterThan(face.position.y);
  expect(token.scale.toArray()).toEqual([1,1,1]);
  disposePrimitive(token);
 });
});
