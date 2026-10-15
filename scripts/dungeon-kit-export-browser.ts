/** Dev-only: cloud-build a self-contained browser utility for exact textured GLB export. */
import * as THREE from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import * as K from '../src/render/dungeon/DungeonKit';
const scene=new THREE.Scene();
const stone=new THREE.Group();stone.add(new THREE.Mesh(K.createBeveledStoneGeometry(.8,.35,.45),K.dungeonMaterial));stone.name='wall-stone';
const flag=new THREE.Group();flag.add(new THREE.Mesh(K.createFlagstoneGeometry(.76,.52),K.dungeonMaterial));flag.name='flagstone';
const ore=new THREE.Group();ore.add(new THREE.Mesh(K.createOreGeometry(),K.dungeonMaterial),new THREE.Mesh(K.createOreCrackGeometry(),K.dungeonGlowMaterial));ore.name='green-veined-ore';
const pad=new THREE.Group();pad.add(new THREE.Mesh(K.createWorkerPadGeometry(),K.dungeonMaterial));pad.name='jade-worker-pad';
const models=[stone,flag,K.createGothicArch(),K.createDungeonBarrel(),K.createDungeonCrate(),K.createBrazier(),K.createLantern(),K.createCrystalCart(),ore,pad,K.createStoragePlinth(),K.createTreasureChest(),K.createConveyorFrame(2.5),K.createTimberTrack([{x:-1,z:0},{x:1,z:0}])];
models.forEach((g,i)=>{g.position.set(i%4*2.5,0,Math.floor(i/4)*3);scene.add(g);});
function download(blob:Blob,name:string){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),10000);}
document.querySelector('#glb')!.addEventListener('click',async()=>{const data=await new GLTFExporter().parseAsync(scene,{binary:true});download(new Blob([data as ArrayBuffer],{type:'model/gltf-binary'}),'dungeon-model-kit-textured.glb');});
document.querySelector('#atlas')!.addEventListener('click',()=>{const canvas=K.dungeonMaterial.map!.image as HTMLCanvasElement;canvas.toBlob(b=>{if(b)download(b,'dungeon-painted-atlas.png');});});
