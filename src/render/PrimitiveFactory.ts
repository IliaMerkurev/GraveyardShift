import * as THREE from 'three';
import { CONFIG } from '../game/config';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function colored(g: THREE.BufferGeometry, color: number, x = 0, y = 0, z = 0): THREE.BufferGeometry {
  const c = new THREE.Color(color); const count = g.attributes.position.count;
  const data = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) c.toArray(data, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(data, 3));
  return g.translate(x, y, z);
}
function join(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const geometry = mergeGeometries(parts.map(g => { const n = g.toNonIndexed(); g.dispose(); return n; }), false);
  if (!geometry) throw new Error('Could not construct primitive geometry');
  return geometry;
}
const box = (x: number, y: number, z: number, color: number, px = 0, py = 0, pz = 0) => colored(new THREE.BoxGeometry(x,y,z),color,px,py,pz);
const solid = new THREE.MeshLambertMaterial({ vertexColors: true });
const bodyGeometry = join([
  box(.30,.35,.20,0xddd9e3,0,.48), box(.11,.26,.12,0x314864,-.095,.19), box(.11,.26,.12,0x314864,.095,.19),
  box(.14,.09,.23,0x283649,-.095,.055,.035), box(.14,.09,.23,0x283649,.095,.055,.035),
  colored(new THREE.SphereGeometry(.135,8,6),0xf3be8e,0,.77), box(.08,.26,.09,0xd0cbd6,-.205,.46),
  box(.32,.06,.22,0xee9b34,0,.39), box(.07,.04,.012,0x30364a,-.05,.78,.127), box(.07,.04,.012,0x30364a,.05,.78,.127)
]);
const helmetGeometry = join([
  colored(new THREE.SphereGeometry(.157,10,5,0,Math.PI*2,0,Math.PI/2),0xffffff,0,.82),
  box(.36,.04,.32,0xffffff,0,.82,.025),box(.08,.045,.16,0xffffff,0,.953)
]);
const toolGeometry = join([
  box(.095,.28,.10,0xd0cbd6,0,-.09),box(.06,.55,.06,0x865a3d,0,-.22,.11),box(.42,.075,.07,0x91b6c5,0,-.48,.11)
]);
export const helmetColors = CONFIG.visual.helmetColors;
export interface WorkerVisual {
  group: THREE.Group; helmet: THREE.Mesh; arm: THREE.Group;
  setLevel(level: number): void; setAction(phase: number): void; dispose(): void;
}
export function createWorker(): WorkerVisual {
  const group = new THREE.Group(); const body = new THREE.Mesh(bodyGeometry,solid); group.add(body);
  const helmetMaterial = new THREE.MeshLambertMaterial({color:helmetColors[0]});
  const helmet = new THREE.Mesh(helmetGeometry,helmetMaterial); group.add(helmet);
  const arm = new THREE.Group(); arm.position.set(.215,.61,.02); arm.add(new THREE.Mesh(toolGeometry,solid)); group.add(arm);
  return {group,helmet,arm,
    setLevel(level) { helmetMaterial.color.setHex(helmetColors[level-1] ?? helmetColors[0]); },
    setAction(phase) { arm.rotation.x = phase > 0 ? -Math.sin(phase * Math.PI) * 2.2 : -.16; },
    dispose(){helmetMaterial.dispose();group.removeFromParent();}
  };
}
export function createBarrel(): THREE.Group {
  const g = new THREE.Group();
  const body = colored(new THREE.CylinderGeometry(.31,.30,.57,10),0x369b91,0,.32);
  const ringA = colored(new THREE.CylinderGeometry(.328,.328,.055,10),0xe7bb71,0,.12);
  const ringB = colored(new THREE.CylinderGeometry(.328,.328,.055,10),0xe7bb71,0,.54);
  const geometry = join([body,ringA,ringB]); g.add(new THREE.Mesh(geometry,solid));
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(.30,.30,.045,10),new THREE.MeshLambertMaterial({color:0xded1a4}));
  lid.position.y=.63;g.add(lid);return g;
}
export function createBomb(): THREE.Group {
  const group=new THREE.Group();
  const body=new THREE.Mesh(new THREE.IcosahedronGeometry(.27,1),new THREE.MeshLambertMaterial({color:0x263044}));body.position.y=.31;
  const fuse=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,.15,5),new THREE.MeshBasicMaterial({color:0xffba4b}));fuse.position.set(.05,.64,0);fuse.rotation.z=-.3;
  group.add(body,fuse);return group;
}
export function makeWallGeometry(): THREE.BufferGeometry {
  return join([box(5.7,.32,.20,0xffffff,0,.16,-3.85),box(5.7,.32,.20,0xffffff,0,.16,-1.15),box(5.7,.32,.20,0xffffff,0,.16,1.55)]);
}
export function makeBrickTexture(): THREE.CanvasTexture {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d')!;
  c.fillStyle='#82728b';c.fillRect(0,0,128,128);c.strokeStyle='#554963';c.lineWidth=3;
  for(let y=0;y<4;y++){c.beginPath();c.moveTo(0,y*32);c.lineTo(128,y*32);c.stroke();for(let x=-1;x<3;x++){c.beginPath();c.moveTo(x*64+(y%2)*32,y*32);c.lineTo(x*64+(y%2)*32,y*32+32);c.stroke();}}
  const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(4,1);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}

export function disposePrimitive(group:THREE.Group){group.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();const materials=Array.isArray(o.material)?o.material:[o.material];for(const m of materials)if(m!==solid)m.dispose();}});group.removeFromParent();}
