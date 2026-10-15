/** Node 24: npm dependencies already installed. No Blender installation required.
 * node --experimental-strip-types scripts/export-dungeon-kit.mjs
 * Result imports into Blender, Unity, Godot or any glTF 2.0 DCC tool.
 * Editable production source lives in src/render/dungeon/DungeonKit.ts.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import * as K from '../src/render/dungeon/DungeonKit.ts';
globalThis.FileReader=class {
  readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}
  readAsDataURL(blob){blob.arrayBuffer().then(result=>{this.result=`data:${blob.type};base64,${Buffer.from(result).toString('base64')}`;this.onloadend?.();});}
};
const scene=new THREE.Scene();
const stone=new THREE.Group();stone.add(new THREE.Mesh(K.createBeveledStoneGeometry(.8,.35,.45),K.dungeonMaterial));stone.name='wall-stone';
const flag=new THREE.Group();flag.add(new THREE.Mesh(K.createFlagstoneGeometry(.76,.52),K.dungeonMaterial));flag.name='flagstone';
const ore=new THREE.Group();ore.add(new THREE.Mesh(K.createOreGeometry(),K.dungeonMaterial),new THREE.Mesh(K.createOreCrackGeometry(),K.dungeonGlowMaterial));ore.name='green-veined-ore';
const pad=new THREE.Group();pad.add(new THREE.Mesh(K.createWorkerPadGeometry(),K.dungeonMaterial));pad.name='jade-worker-pad';
const models=[stone,flag,K.createGothicArch(),K.createDungeonBarrel(),K.createDungeonCrate(),K.createBrazier(),K.createLantern(),K.createCrystalCart(),ore,pad,K.createStoragePlinth(),K.createTreasureChest(),K.createConveyorFrame(2.5),K.createTimberTrack([{x:-1,z:0},{x:1,z:0}])];
for(let i=0;i<models.length;i++){models[i].position.set((i%4)*2.5,0,Math.floor(i/4)*3);scene.add(models[i]);}
const result=await new GLTFExporter().parseAsync(scene,{binary:true,onlyVisible:true});
await mkdir('art/dungeon',{recursive:true});await writeFile('art/dungeon/dungeon-model-kit.glb',Buffer.from(result));
const report=models.map(g=>{let triangles=0;g.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});return {name:g.name,triangles};});
await writeFile('art/dungeon/model-manifest.json',JSON.stringify({format:'glTF 2.0',runtime:'Procedural TypeScript; GLB is DCC interchange only, not shipped',textureStatus:'Node GLB contains geometry, UVs, vertex colours and PBR materials; browser-painted atlas is not embedded. See browser export utility for matching textured export.',glbBytes:result.byteLength,models:report},null,2)+'\n');
console.log(JSON.stringify({glbBytes:result.byteLength,models:report},null,2));
