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
    setLevel(level) {
      const safeLevel = Number.isSafeInteger(level) && level > 0 ? level : 1;
      if (safeLevel <= helmetColors.length) {
        helmetMaterial.color.setHex(helmetColors[safeLevel-1]);
      } else {
        // Reduce before multiplying so even the largest safe level retains a finite hue.
        const hue = ((safeLevel % 360) * 137.508 % 360) / 360;
        helmetMaterial.color.setHSL(hue, .7, .62);
      }
    },
    setAction(phase) { const hit=CONFIG.mining.impactPhase;arm.rotation.x=phase<=0?-.16:phase<hit*.58?-.16-2*(phase/(hit*.58)):phase<hit?-2.16+2.66*((phase-hit*.58)/(hit*.42)):.5-.66*((phase-hit)/(1-hit)); },
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
export function createRewind(): THREE.Group {
  const group=new THREE.Group();
  const rim=new THREE.Mesh(new THREE.CylinderGeometry(.32,.32,.13,12),new THREE.MeshLambertMaterial({color:0x167b91}));rim.position.y=.22;
  const face=new THREE.Mesh(new THREE.CylinderGeometry(.28,.28,.045,12),new THREE.MeshLambertMaterial({color:0x74f8f0}));face.position.y=.31;
  group.add(rim,face);return group;
}
export function createSlow(): THREE.Group {
  const group=new THREE.Group();
  const rim=new THREE.Mesh(new THREE.CylinderGeometry(.32,.32,.13,12),new THREE.MeshLambertMaterial({color:0x5149a8}));rim.position.y=.22;
  const face=new THREE.Mesh(new THREE.CylinderGeometry(.28,.28,.045,12),new THREE.MeshLambertMaterial({color:0xaaa1ff}));face.position.y=.31;
  const handMaterial=new THREE.MeshBasicMaterial({color:0xf9f6ff});
  const minute=new THREE.Mesh(new THREE.BoxGeometry(.04,.018,.18),handMaterial);minute.position.set(-.075,.344,0);
  const hour=new THREE.Mesh(new THREE.BoxGeometry(.04,.018,.18),handMaterial.clone());hour.position.set(.075,.344,0);
  group.add(rim,face,minute,hour);return group;
}
/** Amber down-arrow token is distinct from cyan rewind and purple pause. */
export function createBrake(): THREE.Group {
  const group=new THREE.Group();
  const rim=new THREE.Mesh(new THREE.CylinderGeometry(.32,.32,.13,12),new THREE.MeshLambertMaterial({color:0x996321}));rim.position.y=.22;
  const face=new THREE.Mesh(new THREE.CylinderGeometry(.28,.28,.045,12),new THREE.MeshLambertMaterial({color:0xffc260}));face.position.y=.31;
  const material=new THREE.MeshBasicMaterial({color:0x54330b});
  const stem=new THREE.Mesh(new THREE.BoxGeometry(.055,.018,.18),material);stem.position.set(0,.344,-.025);
  group.add(rim,face,stem);
  for(const direction of [-1,1]){const tip=new THREE.Mesh(new THREE.BoxGeometry(.05,.018,.15),material.clone());tip.rotation.y=direction*Math.PI/4;tip.position.set(direction*.045,.344,.06);group.add(tip);}
  return group;
}
/** Green half-speed token has a split face and a solid down arrow. */
export function createHalfSpeed(): THREE.Group {
  const group=new THREE.Group();
  const rim=new THREE.Mesh(new THREE.CylinderGeometry(.32,.32,.13,12),new THREE.MeshLambertMaterial({color:0x257945}));rim.position.y=.22;
  const face=new THREE.Mesh(new THREE.CylinderGeometry(.28,.28,.045,12),new THREE.MeshLambertMaterial({color:0x83ec94}));face.position.y=.31;
  const half=new THREE.Mesh(new THREE.CircleGeometry(.25,12,0,Math.PI),new THREE.MeshBasicMaterial({color:0x43b968,side:THREE.DoubleSide}));half.rotation.x=-Math.PI/2;half.position.y=.337;
  const stem=new THREE.Mesh(new THREE.BoxGeometry(.055,.018,.20),new THREE.MeshBasicMaterial({color:0x164d2a}));stem.position.set(0,.351,-.03);
  group.add(rim,face,half,stem);
  for(const direction of [-1,1]){const tip=new THREE.Mesh(new THREE.BoxGeometry(.05,.018,.15),new THREE.MeshBasicMaterial({color:0x164d2a}));tip.rotation.y=direction*Math.PI/4;tip.position.set(direction*.045,.351,.065);group.add(tip);}
  return group;
}
/** Red tail-blast token depicts a surviving front and a burst at the tail. */
export function createTailBlast(): THREE.Group {
  const group=new THREE.Group();
  const rim=new THREE.Mesh(new THREE.CylinderGeometry(.32,.32,.13,12),new THREE.MeshLambertMaterial({color:0x922f42}));rim.position.y=.22;
  const face=new THREE.Mesh(new THREE.CylinderGeometry(.28,.28,.045,12),new THREE.MeshLambertMaterial({color:0xff7d87}));face.position.y=.31;
  group.add(rim,face);
  for(const x of [-.16,-.045]){const rock=new THREE.Mesh(new THREE.IcosahedronGeometry(.06,0),new THREE.MeshLambertMaterial({color:0x682b3c}));rock.position.set(x,.365,0);group.add(rock);}
  const shape=new THREE.Shape();
  for(let i=0;i<16;i++){const angle=i*Math.PI/8,radius=i%2?.065:.14,x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;if(i===0)shape.moveTo(x,z);else shape.lineTo(x,z);}
  shape.closePath();
  const blast=new THREE.Mesh(new THREE.ShapeGeometry(shape),new THREE.MeshBasicMaterial({color:0xfff0b0,side:THREE.DoubleSide}));blast.rotation.x=-Math.PI/2;blast.position.set(.115,.38,0);group.add(blast);
  return group;
}
export function makeWallGeometry(): THREE.BufferGeometry {
  const pieces:THREE.BufferGeometry[]=[];for(const run of CONFIG.path.runs.slice(0,-1)){const z=run+CONFIG.path.bendRadius;let spans:[[number,number]]|[number,number][]=[[CONFIG.path.left+.15,CONFIG.path.right-.15]];for(const pad of CONFIG.pads.filter(p=>Math.abs(p.z-z)<.1)){spans=spans.flatMap(([a,b])=>{const result:[number,number][]=[];if(a<pad.x-.62)result.push([a,Math.min(b,pad.x-.62)]);if(b>pad.x+.62)result.push([Math.max(a,pad.x+.62),b]);return result;});}for(const[a,b]of spans)if(b-a>.05)pieces.push(box(b-a,.32,.20,0xffffff,(a+b)/2,.16,z));}return join(pieces);
}
export function makeBrickTexture(): THREE.CanvasTexture {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d')!;
  c.fillStyle='#82728b';c.fillRect(0,0,128,128);c.strokeStyle='#554963';c.lineWidth=3;
  for(let y=0;y<4;y++){c.beginPath();c.moveTo(0,y*32);c.lineTo(128,y*32);c.stroke();for(let x=-1;x<3;x++){c.beginPath();c.moveTo(x*64+(y%2)*32,y*32);c.lineTo(x*64+(y%2)*32,y*32+32);c.stroke();}}
  const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(4,1);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}

export function disposePrimitive(group:THREE.Group){group.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();const materials=Array.isArray(o.material)?o.material:[o.material];for(const m of materials)if(m!==solid)m.dispose();}});group.removeFromParent();}
