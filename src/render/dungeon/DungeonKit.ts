/** Hand-modelled, reusable low-poly dungeon kit. All models use Y-up/metres.
 * No downloaded textures, runtime requests, skeletons, or character geometry.
 * Static parts are baked to one opaque mesh and one emissive mesh per assembly.
 */
import * as THREE from 'three';
import { createDungeonAtlas, atlasUV, createContactTexture, createAmberSpillTexture } from './DungeonAtlas.ts';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const DUNGEON_PALETTE = {
  mortar:0x171a20, stone:0x41434b, stoneLight:0x5e5c60, stoneDark:0x292d35,
  iron:0x242a31, ironEdge:0x555963, bronze:0x926740, bronzeLight:0xbb8b53,
  wood:0x65432d, woodLight:0x8b5c36, jade:0x245a48, emerald:0x36ef8f,
  flame:0xff9a23, flameCore:0xffe6a4,
} as const;
const P=DUNGEON_PALETTE;
const surfaceAtlas=createDungeonAtlas();
export const dungeonMaterial=new THREE.MeshStandardMaterial({vertexColors:true,map:surfaceAtlas,bumpMap:surfaceAtlas,bumpScale:.023,roughness:.92,metalness:.08});
const spillMaterial=new THREE.MeshBasicMaterial({map:createAmberSpillTexture(),transparent:true,depthWrite:false,opacity:.56,blending:THREE.AdditiveBlending});
const contactMaterial=new THREE.MeshBasicMaterial({map:createContactTexture(),transparent:true,depthWrite:false,opacity:.72,color:0x0a1114});
export const dungeonGlowMaterial=new THREE.MeshBasicMaterial({vertexColors:true});
const seeded=(n:number)=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
function tint(hex:number,factor:number){return new THREE.Color(hex).multiplyScalar(factor);}
function paint(g:THREE.BufferGeometry,c:number|THREE.Color):THREE.BufferGeometry {
  const color=typeof c==='number'?new THREE.Color(c):c;
  const data=new Float32Array(g.getAttribute('position').count*3);
  for(let i=0;i<data.length;i+=3)color.toArray(data,i);
  g.setAttribute('color',new THREE.BufferAttribute(data,3));
  const hex=typeof c==='number'?c:c.getHex();
  const tile=[P.wood,P.woodLight].includes(hex as typeof P.wood)?1:[P.iron,P.ironEdge,P.bronze,P.bronzeLight].includes(hex as typeof P.iron)?2:0;
  atlasUV(g,tile);return g;
}
function merge(parts:THREE.BufferGeometry[]):THREE.BufferGeometry {
  if(!parts.length)return new THREE.BufferGeometry();
  const normalized=parts.map(g=>{const n=g.index?g.toNonIndexed():g;if(!n.getAttribute('uv'))atlasUV(n,0);return n;});
  const result=mergeGeometries(normalized,false);
  if(!result)throw new Error('Dungeon geometry attributes do not match');
  for(const g of new Set([...parts,...normalized]))g.dispose();
  result.computeBoundingBox();result.computeBoundingSphere();return result;
}
function mesh(parts:THREE.BufferGeometry[],glow=false){const m=new THREE.Mesh(merge(parts),glow?dungeonGlowMaterial:dungeonMaterial);m.receiveShadow=!glow;return m;}
function assembly(parts:THREE.BufferGeometry[],glows:THREE.BufferGeometry[]=[]){const group=new THREE.Group();if(parts.length)group.add(mesh(parts));if(glows.length)group.add(mesh(glows,true));return group;}
function box(w:number,h:number,d:number,c:number,x=0,y=0,z=0){return paint(new THREE.BoxGeometry(w,h,d),c).translate(x,y,z);}
function cyl(top:number,bottom:number,h:number,sides:number,c:number,x=0,y=0,z=0){return paint(new THREE.CylinderGeometry(top,bottom,h,sides,1),c).translate(x,y,z);}
function beam(a:THREE.Vector3,b:THREE.Vector3,width:number,depth:number,c:number){const g=new THREE.BoxGeometry(width,a.distanceTo(b),depth);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize()));return paint(g,c).translate(...a.clone().add(b).multiplyScalar(.5).toArray());}
/** Eight clipped corners and a bevelled top: deliberate modelling, not rounded boxes. */
export function createBeveledStoneGeometry(w:number,h:number,d:number,color:number=P.stone,bevel=.04):THREE.BufferGeometry {
  const b=Math.min(bevel,w*.18,d*.18,h*.45),x=w/2,z=d/2;
  const outline=[[-x+b,-z],[x-b,-z],[x,-z+b],[x,z-b],[x-b,z],[-x+b,z],[-x,z-b],[-x,-z+b]];
  const rings=[outline.map(p=>[p[0],-h/2,p[1]]),outline.map(p=>[p[0],h/2-b,p[1]]),outline.map(p=>[p[0]*(1-b/x),h/2,p[1]*(1-b/z)])];
  const positions:number[]=[],colors:number[]=[];
  const add=(a:number[],b:number[],c:number[],f:number)=>{positions.push(...a,...b,...c);const t=tint(color,f);for(let i=0;i<3;i++)colors.push(t.r,t.g,t.b);};
  for(let j=0;j<8;j++){const k=(j+1)%8;
    for(let r=0;r<2;r++){const f=r===1?1.12:.78+((j+2)%4)*.055;add(rings[r][j],rings[r+1][j],rings[r][k],f);add(rings[r][k],rings[r+1][j],rings[r+1][k],f);}
    add([0,h/2,0],rings[2][k],rings[2][j],1);
    add([0,-h/2,0],rings[0][j],rings[0][k],.65);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();atlasUV(g,0);return g;
}
/** Floor-only bevelled tile: hidden bottom and vertical faces are intentionally culled. */
export function createFlagstoneGeometry(w:number,d:number,color:number=P.stone):THREE.BufferGeometry {
  const source=createBeveledStoneGeometry(w,.09,d,color,.018),pos=source.getAttribute('position'),normal=source.getAttribute('normal'),colorAttr=source.getAttribute('color');
  const p:number[]=[],n:number[]=[],c:number[]=[];
  for(let i=0;i<pos.count;i+=3)if(normal.getY(i)>.01)for(let j=0;j<3;j++){
    p.push(pos.getX(i+j),pos.getY(i+j),pos.getZ(i+j));n.push(normal.getX(i+j),normal.getY(i+j),normal.getZ(i+j));c.push(colorAttr.getX(i+j),colorAttr.getY(i+j),colorAttr.getZ(i+j));
  }
  const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.Float32BufferAttribute(p,3));result.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));result.setAttribute('color',new THREE.Float32BufferAttribute(c,3));source.dispose();atlasUV(result,0);return result;
}
const stone=(w:number,h:number,d:number,c:number,x=0,y=0,z=0,b=.04)=>createBeveledStoneGeometry(w,h,d,c,b).translate(x,y,z);

/** Segmented pointed arch, voussoirs, piers and capstones. Opening faces +Z. */
export function createGothicArch(width=1.35,height=1.9):THREE.Group {
  const p:THREE.BufferGeometry[]=[],thick=width*.18, spring=height*.57,depth=width*.3;
  for(const side of [-1,1]){
    for(let row=0;row<4;row++)p.push(stone(thick,spring/4-.015,depth,P.stone,side*(width/2+thick/2),(row+.5)*spring/4,0));
    p.push(stone(thick*1.5,.15,depth*1.22,P.stoneLight,side*(width/2+thick/2),.075,0));
    p.push(stone(thick*1.25,.11,depth*1.12,P.stoneLight,side*(width/2+thick/2),spring,0));
    for(let i=0;i<6;i++){
      const t0=i/6,t1=(i+1)/6, xm=(1-(t0+t1)/2)*width/2;
      const y0=spring+Math.sin(t0*Math.PI*.38)/Math.sin(Math.PI*.38)*(height-spring),y1=spring+Math.sin(t1*Math.PI*.38)/Math.sin(Math.PI*.38)*(height-spring);
      const a=new THREE.Vector3(side*(1-t0)*width/2,y0,0),b=new THREE.Vector3(side*(1-t1)*width/2,y1,0);
      const g=stone(thick,a.distanceTo(b)+.025,depth,i%2?P.stone:P.stoneLight);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize()));g.translate(side*xm,(y0+y1)/2,0);p.push(g);
    }
  }
  p.push(stone(thick*.9,.27,depth*1.16,P.stoneLight,0,height-.035,0));
  const result=assembly(p);result.name='gothic-pointed-stone-arch';return result;
}

/** Thick coopered wood staves, raised hoops, inset lid and rivets. */
export function createDungeonBarrel():THREE.Group {
  const p:THREE.BufferGeometry[]=[];
  for(let i=0;i<12;i++){
    const a=i*Math.PI/6;const shape=new THREE.LatheGeometry([new THREE.Vector2(.255,.045),new THREE.Vector2(.30,.16),new THREE.Vector2(.32,.32),new THREE.Vector2(.30,.50),new THREE.Vector2(.255,.60)],1,a+.015,Math.PI/6-.03);
    p.push(paint(shape,i%3===0?P.woodLight:P.wood));
  }
  for(const y of [.12,.51]){p.push(cyl(.309,.309,.055,12,P.ironEdge,0,y));for(let i=0;i<6;i++){const a=i*Math.PI/3;p.push(paint(new THREE.IcosahedronGeometry(.018,0),P.bronzeLight).translate(Math.sin(a)*.313,y,Math.cos(a)*.313));}}
  p.push(cyl(.255,.255,.035,12,P.woodLight,0,.607));
  for(const x of [-.12,0,.12])p.push(box(.008,.007,Math.sqrt(.255**2-x*x)*2,P.wood,x,.629));
  p.push(cyl(.043,.043,.014,8,P.bronze,0,.638));const g=assembly(p);g.name='coopered-ironbound-barrel';return g;
}
export function createDungeonCrate(size=.72):THREE.Group {
  const p:THREE.BufferGeometry[]=[],s=size;
  p.push(box(s*.93,s*.9,s*.93,P.wood,0,s*.48));
  for(const side of [-1,1])for(let i=0;i<4;i++){
    p.push(box(s*.23,s*.82,.015,i%2?P.wood:P.woodLight,(i-1.5)*s*.24,s*.48,side*s*.48));
    p.push(box(.015,s*.82,s*.23,i%2?P.woodLight:P.wood,side*s*.48,s*.48,(i-1.5)*s*.24));
  }
  for(const y of [.1,.85])for(const side of [-1,1])p.push(box(s,s*.12,s*.08,P.woodLight,0,s*y,side*s*.49),box(s*.08,s*.12,s,P.woodLight,side*s*.49,s*y));
  for(const side of [-1,1])p.push(beam(new THREE.Vector3(-s*.4,s*.17,side*s*.53),new THREE.Vector3(s*.4,s*.77,side*s*.53),s*.10,s*.045,P.woodLight));
  for(const x of [-1,1])for(const z of [-1,1])p.push(box(s*.10,s*.98,s*.10,P.iron,x*s*.45,s*.48,z*s*.45));
  const g=assembly(p);g.name='braced-timber-crate';return g;
}
export function createBrazier(height=1):THREE.Group {
  const p:THREE.BufferGeometry[]=[],e:THREE.BufferGeometry[]=[];
  p.push(stone(.47,.20,.47,P.stone,0,.1),cyl(.10,.15,height*.55,8,P.iron,0,height*.34),cyl(.26,.09,height*.22,10,P.bronze,0,height*.69));
  for(let i=0;i<6;i++){const a=i*Math.PI/3;p.push(beam(new THREE.Vector3(Math.sin(a)*.11,height*.6,Math.cos(a)*.11),new THREE.Vector3(Math.sin(a)*.29,height*.87,Math.cos(a)*.29),.035,.035,P.iron));}
  e.push(paint(new THREE.ConeGeometry(.15,height*.46,5),P.flame).translate(0,height*.98,0),paint(new THREE.ConeGeometry(.085,height*.31,5),P.flameCore).translate(.025,height*.94,.035));
  for(let i=0;i<5;i++){
    const a=i*2.4,r=.05+i*.015,h=height*(.25+seeded(i+42)*.27);
    const tongue=paint(new THREE.ConeGeometry(.055,h,5),i%2?0xffc04e:0xff761b);tongue.rotateZ((i-2)*.16).translate(Math.cos(a)*r,height*.9+h*.3,Math.sin(a)*r);e.push(tongue);
  }
  p.push(cyl(.245,.245,.035,10,P.iron,0,height*.79));
  const g=assembly(p,e);g.name='iron-crown-fire-brazier';return g;
}
export function createLantern():THREE.Group {
  const p:THREE.BufferGeometry[]=[],e:THREE.BufferGeometry[]=[];
  p.push(cyl(.19,.18,.045,4,P.bronze,0,.055),paint(new THREE.ConeGeometry(.23,.14,4),P.bronze).translate(0,.39,0));
  for(const x of [-.11,.11])for(const z of [-.11,.11])p.push(box(.022,.28,.022,P.iron,x,.20,z));
  e.push(box(.15,.22,.15,P.flame,0,.20),box(.055,.19,.16,P.flameCore,0,.20));
  const loop=paint(new THREE.TorusGeometry(.055,.012,4,8),P.iron).translate(0,.49,0);p.push(loop);
  const g=assembly(p,e);g.name='caged-amber-lantern';return g;
}
export function createCrystalCart():THREE.Group {
  const p:THREE.BufferGeometry[]=[],e:THREE.BufferGeometry[]=[];
  p.push(box(.9,.1,.6,P.wood,0,.31));
  for(const side of [-1,1]){
    for(let row=0;row<3;row++)p.push(box(.92,.10,.055,row%2?P.wood:P.woodLight,0,.41+row*.10,side*.32),box(.055,.10,.65,row%2?P.woodLight:P.wood,side*.46,.41+row*.10));
    for(const x of [-.31,.31]){const wheel=cyl(.17,.17,.07,8,P.iron);wheel.rotateX(Math.PI/2).translate(x,.19,side*.40);p.push(wheel);const hub=cyl(.055,.055,.085,8,P.bronze);hub.rotateX(Math.PI/2).translate(x,.19,side*.405);p.push(hub);}
  }
  for(let i=0;i<7;i++){
    const x=(seeded(i+1)-.5)*.7,z=(seeded(i+9)-.5)*.42,h=.22+seeded(i+21)*.36;
    const crystal=paint(new THREE.ConeGeometry(.09,h,5),i%2?P.emerald:0x95ffd0);crystal.rotateZ((seeded(i+31)-.5)*.8).translate(x,.62+h*.3,z);e.push(crystal);
  }
  p.push(beam(new THREE.Vector3(.4,.32,0),new THREE.Vector3(.95,.17,0),.055,.055,P.wood));const g=assembly(p,e);g.name='emerald-mine-cart';return g;
}
/** Brass-trimmed treasure chest with open lid and physically stacked coins. */
export function createTreasureChest():THREE.Group {
  const p:THREE.BufferGeometry[]=[],e:THREE.BufferGeometry[]=[];
  p.push(box(.70,.32,.48,P.wood,0,.22),box(.60,.04,.39,P.iron,0,.40));
  for(const x of [-.27,.27])p.push(box(.055,.36,.51,P.bronze,x,.22));
  const lid=stone(.72,.09,.51,P.woodLight,0,0,0,.018);atlasUV(lid,1);lid.rotateX(-.7).translate(0,.59,-.13);p.push(lid);
  p.push(box(.10,.16,.045,P.bronzeLight,0,.30,.27));
  for(let i=0;i<18;i++){
    const x=(seeded(i+81)-.5)*.52,z=(seeded(i+11)-.5)*.32;
    p.push(cyl(.052,.052,.016,10,0xd6a340,x,.43+seeded(i+9)*.07,z));
  }
  for(let i=0;i<9;i++)p.push(cyl(.06,.06,.02,10,0xc99432,.2+seeded(i+4)*.40,.022+i%3*.02,.35+seeded(i+17)*.2));
  for(let i=0;i<3;i++){
    const x=.47+i*.09,h=.18+i*.055;p.push(cyl(.027,.033,h,7,0xdbc391,x,h/2,.03));e.push(paint(new THREE.ConeGeometry(.019,.085,5),P.flameCore).translate(x,h+.035,.03));
  }
  const g=assembly(p,e);g.name='brass-treasure-and-candles';return g;
}
/** The stone remains centred, matching the game's instanced rigid-body transforms. */
export function createOreGeometry(variant=0):THREE.BufferGeometry {
  const g=new THREE.IcosahedronGeometry(.225,1),a=g.getAttribute('position');
  for(let i=0;i<a.count;i++){const x=a.getX(i),y=a.getY(i),z=a.getZ(i);const noise=1+.13*Math.sin(x*23+y*17+z*31+variant*2);a.setXYZ(i,x*noise,y*noise*.93,z*noise);}
  g.computeVertexNormals();const colors=new Float32Array(a.count*3);
  for(let i=0;i<a.count;i+=3){const f=.72+seeded(i+variant*17)*.48,c=tint(P.stoneLight,f);for(let j=0;j<3;j++)c.toArray(colors,(i+j)*3);}
  g.setAttribute('color',new THREE.BufferAttribute(colors,3));atlasUV(g,3);return g;
}
/** Fine jagged mineral seams follow selected actual edges, never float above the ore. */
export function createOreCrackGeometry(variant=0):THREE.BufferGeometry {
  const body=createOreGeometry(variant),a=body.getAttribute('position'),parts:THREE.BufferGeometry[]=[];
  // Two thin geological fissures follow intersections of real facets, not every edge.
  for(let seam=0;seam<2;seam++)for(let i=0;i<a.count;i+=3){
    const verts=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(a,i+j));
    if(verts.reduce((sum,v)=>sum+v.z,0)<-.22)continue;
    if(seam===1&&verts.reduce((sum,v)=>sum+v.y,0)<.1)continue;
    const signed=(v:THREE.Vector3)=>seam===0?v.x-v.y*.36-.025*Math.sin(variant+1):v.y+v.x*.65-.075;
    const hits:THREE.Vector3[]=[];
    for(let j=0;j<3;j++){const v=verts[j],w=verts[(j+1)%3],sv=signed(v),sw=signed(w);if(sv*sw<0)hits.push(v.clone().lerp(w,sv/(sv-sw)).multiplyScalar(1.009));}
    if(hits.length!==2)continue;const [v,w]=hits;
    const fissure=new THREE.CylinderGeometry(.0035,.005,v.distanceTo(w),3);fissure.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),w.clone().sub(v).normalize()));fissure.translate(...v.add(w).multiplyScalar(.5).toArray());parts.push(paint(fissure,seam?0x35d476:0x63ffab));
  }body.dispose();return merge(parts);
}
export function createWorkerPadGeometry():THREE.BufferGeometry {
  const p=[stone(.94,.13,.87,P.jade,0,0,0,.045)];
  for(const x of [-.40,.40])for(const z of [-.365,.365])p.push(cyl(.028,.028,.013,6,P.bronzeLight,x,.074,z));return merge(p);
}
export function createStoragePlinth():THREE.Group {
  const p=[cyl(.44,.49,.16,8,P.stoneLight,0,.08),cyl(.37,.42,.06,8,P.bronze,0,.18),cyl(.35,.35,.025,8,P.iron,0,.22)];const g=assembly(p);g.name='octagonal-storage-plinth';return g;
}

/** Re-sample the route by distance so plank density is independent of input sampling. */
export function createTimberTrack(points:readonly {x:number;z:number}[],width=.72):THREE.Group {
  const p:THREE.BufferGeometry[]=[],spaced:{x:number;z:number;angle:number}[]=[];let carry=0;
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);if(len<.00001)continue;
    for(let d=carry;d<len;d+=.14)spaced.push({x:a.x+dx*d/len,z:a.z+dz*d/len,angle:Math.atan2(dx,dz)});
    carry=(carry-len)% .14;if(carry<0)carry+=.14;
    for(const side of [-1,1]){const nx=dz/len*width*.51*side,nz=-dx/len*width*.51*side;p.push(beam(new THREE.Vector3(a.x+nx,.055,a.z+nz),new THREE.Vector3(b.x+nx,.055,b.z+nz),.066,.065,P.bronze));}
  }
  for(let i=0;i<spaced.length;i++){const s=spaced[i],g=box(width,.06,.129,i%4===0?0x67513e:0x493b32);atlasUV(g,1);g.rotateY(s.angle).translate(s.x,-.006,s.z);p.push(g);
    if(i%3===0){const tie=box(width+.16,.045,.055,P.woodLight);tie.rotateY(s.angle).translate(s.x,-.012,s.z);p.push(tie);}
  }const g=assembly(p);g.name='bronze-railed-snake-track';return g;
}
export function createConveyorTreadGeometry(width=.21,depth=.98):THREE.BufferGeometry {
  const g=createBeveledStoneGeometry(width,.024,depth,P.woodLight,.006);atlasUV(g,1);return g;
}
export function createConveyorFrame(width=6.4,depth=.95):THREE.Group {
  const p:THREE.BufferGeometry[]=[box(width,.12,depth,P.iron,0,-.045)];
  for(const side of [-1,1]){
    p.push(stone(width,.10,.105,P.bronze,0,.16,side*depth*.5,.022));
    for(let x=-width/2+.2;x<width/2;x+=.52){const roller=cyl(.11,.11,depth+.14,8,P.ironEdge);roller.rotateX(Math.PI/2).translate(x,.045,0);if(side===-1)p.push(roller);else roller.dispose();const hub=cyl(.04,.04,.035,8,P.bronzeLight);hub.rotateX(Math.PI/2).translate(x,.045,side*(depth*.5+.09));p.push(hub);}
  }
  for(let x=-width/2+.18;x<width/2;x+=1.1)p.push(box(.16,.23,depth*1.13,P.wood,x,-.15));
  const g=assembly(p);g.name='iron-timber-conveyor-chassis';return g;
}

/** Flat-roof housings sit beyond the complete original working belt domain. */
export const CONVEYOR_TUNNEL_MOUTH = 3.7;
export function conveyorSlotExposed(x:number):boolean { return Math.abs(x)<CONVEYOR_TUNNEL_MOUTH-.12; }

/** Two real, opaque tunnel housings. Openings face along X, never toward the camera.
 * Roof and camera-facing masonry occlude cargo before its spawn/wrap boundary.
 * Keep these in the belt group so the existing landscape X mapping also applies.
 */
export function createConveyorTunnels():THREE.Group {
  const tunnels=new THREE.Group();tunnels.name='conveyor-end-tunnels';
  const inner=CONVEYOR_TUNNEL_MOUTH,outer=5.18,length=outer-inner,center=(inner+outer)/2;
  for(const side of [-1,1]){
    const p:THREE.BufferGeometry[]=[];
    // Closed outer end, solid side walls and timber ceiling: no sightline to wrapping cargo.
    p.push(box(length,.17,1.48,P.wood,side*center,1.39));
    p.push(box(.16,1.31,1.48,P.stoneDark,side*(outer-.08),.735));
    for(const z of [-.66,.66]){
      p.push(box(length,1.24,.20,P.mortar,side*center,.73,z));
      for(let row=0;row<4;row++)for(let col=0;col<3;col++){
        const x=inner+(col+.5)*length/3;
        p.push(stone(length/3-.018,.29,.23,(row+col)%3?P.stone:P.stoneLight,side*x,.27+row*.30,z,.025));
      }
      p.push(stone(length+.05,.11,.29,P.stoneLight,side*center,1.33,z,.018));
    }
    for(let i=0;i<6;i++)p.push(box(length,.045,.215,i%2?P.wood:P.woodLight,side*center,1.495,(i-2.5)*.235));
    for(const x of [inner+.16,outer-.16]){
      p.push(box(.09,.055,1.50,P.ironEdge,side*x,1.535));
      for(const z of [-.58,.58])p.push(cyl(.025,.025,.018,6,P.bronzeLight,side*x,1.572,z));
    }
    const housing=assembly(p);housing.name=side===1?'conveyor-entrance-tunnel':'conveyor-exit-tunnel';
    // Pointed masonry mouth, seated above the moving wooden slats.
    const arch=createGothicArch(1.05,1.12);arch.rotation.y=side*Math.PI/2;arch.position.set(side*inner,.17,0);housing.add(arch);
    tunnels.add(housing);
  }
  return tunnels;
}

export interface DungeonRoomOptions {width:number;depth:number;centerX?:number;centerZ?:number;backZ?:number}
/** A shallow, open-front theatrical room. Tall detail stays exclusively behind play. */
export function createDungeonRoom(options:DungeonRoomOptions):THREE.Group {
  const {width,depth}=options,cx=options.centerX??0,cz=options.centerZ??0,back=options.backZ??cz-depth/2;
  const p:THREE.BufferGeometry[]=[],e:THREE.BufferGeometry[]=[],shadows:THREE.BufferGeometry[]=[],spills:THREE.BufferGeometry[]=[];
  const absorb=(g:THREE.Group,x:number,y:number,z:number,ry=0,scale=1)=>{
    g.position.set(x,y,z);g.rotation.y=ry;g.scale.setScalar(scale);g.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(g),extent=new THREE.Vector3(),center=new THREE.Vector3();bounds.getSize(extent);bounds.getCenter(center);
    const shadow=new THREE.PlaneGeometry(Math.max(.45,extent.x*1.5),Math.max(.5,extent.z*1.7));shadow.rotateX(-Math.PI/2).translate(center.x,.009,center.z);paint(shadow,0xffffff);shadow.setAttribute('uv',new THREE.Float32BufferAttribute([0,1,1,1,0,0,1,0],2));shadows.push(shadow);
    if(g.name.includes('brazier')||g.name.includes('lantern')){
      const spill=new THREE.PlaneGeometry(2.5,2.5);spill.rotateX(-Math.PI/2).translate(x,.013,z);paint(spill,0xffffff);spill.setAttribute('uv',new THREE.Float32BufferAttribute([0,1,1,1,0,0,1,0],2));spills.push(spill);
    }
    g.traverse(o=>{if(o instanceof THREE.Mesh){const geometry=o.geometry.clone().applyMatrix4(o.matrixWorld);(o.material===dungeonGlowMaterial?e:p).push(geometry);o.geometry.dispose();}});
  };
  p.push(box(width+.3,.19,depth+.3,P.mortar,cx,-.18,cz));
  const rows=Math.ceil(depth/.56),cols=Math.ceil(width/.78);
  for(let r=0;r<rows;r++){
    const tileD=depth/rows,z=cz-depth/2+(r+.5)*tileD;let left=cx-width/2,c=0;
    while(left<cx+width/2-.01){
      const desired=(width/cols)*(c===0&&r%2?.48:.75+seeded(r*74+c*19)*.6),tileW=Math.min(desired,cx+width/2-left),x=left+tileW/2;
      if(tileW>.04){
        const tone=tint(P.stone,.70+seeded(r*cols+c)*.47).getHex(),tile=createFlagstoneGeometry(tileW-.024,tileD-.022,tone),a=tile.getAttribute('position');
        for(let i=0;i<a.count;i++){const vx=a.getX(i),vz=a.getZ(i);a.setXYZ(i,vx+Math.sin(vx*73+vz*37+r*14+c)*.006,a.getY(i),vz+Math.sin(vz*83+vx*19+r+c*7)*.006);}
        tile.translate(x,-.053+seeded(r*41+c)*.009,z);p.push(tile);
      }
      left+=tileW;c++;
    }
  }
  // Backdrop: alternating masonry courses, three green recesses, buttresses.
  const wallH=2.35,archWidth=Math.min(1.5,width*.16),archXs=[cx-width*.29,cx,cx+width*.29];
  for(let r=0;r<7;r++)for(let c=0;c<Math.ceil(width/.61);c++){
    const x=cx-width/2+(c+.5)*.61+(r%2?.24:0);if(x>cx+width/2)continue;
    const y=(r+.5)*wallH/7;
    if(archXs.some(ax=>Math.abs(x-ax)<archWidth*.57&&y<1.88))continue;
    p.push(stone(.59,wallH/7-.02,.29,r%3?P.stoneDark:P.stone,x,y,back,.028));
  }
  for(let i=0;i<Math.ceil(width/.8);i++){
    const x=cx-width/2+(i+.5)*.8;
    p.push(stone(.78,.16,.43,P.stone,x,2.38,back+.025),stone(.76,.10,.36,P.stoneLight,x,2.27,back+.04));
  }
  for(const x of archXs){
    p.push(box(archWidth*1.22,1.95,.06,0x102c29,x,.98,back-.15));
    const recess=new THREE.PlaneGeometry(archWidth*1.13,1.92,4,6),recessPositions=recess.getAttribute('position'),recessColors=new Float32Array(recessPositions.count*3);
    for(let i=0;i<recessPositions.count;i++){
      const xNorm=Math.abs(recessPositions.getX(i))/(archWidth*.57),yNorm=(recessPositions.getY(i)+.96)/1.92;
      const light=Math.max(0,1-xNorm*.65)*Math.sin(yNorm*Math.PI)*.85+.05;
      new THREE.Color(0x071b19).lerp(new THREE.Color(0x3a9478),light).toArray(recessColors,i*3);
    }
    recess.setAttribute('color',new THREE.BufferAttribute(recessColors,3));recess.translate(x,.97,back-.105);e.push(recess);
    // Layered silhouettes of receding crypt buildings inside the green recess.
    for(let j=0;j<3;j++){
      const tx=x+(j-1)*archWidth*.24,h=.75+(j%2)*.42;
      p.push(box(archWidth*.19,h,.06,j%2?0x203d37:0x1b332f,tx,h/2,back-.07));
      const roof=paint(new THREE.ConeGeometry(archWidth*.16,.36,4),0x1b3531);roof.rotateY(Math.PI/4).translate(tx,h+.14,back-.07);p.push(roof);
      p.push(box(.06,h*.42,.025,0x0b201c,tx,h*.55,back-.025));
    }
    // Inner receding masonry keeps recesses architectural rather than blank holes.
    for(const side of [-1,1])p.push(box(.09,1.6,.09,0x245348,x+side*archWidth*.37,.8,back-.09));
    e.push(paint(new THREE.ConeGeometry(.035,.45,4),0x1c7f59).translate(x,1.03,back-.065));
    absorb(createGothicArch(archWidth,2.08),x,0,back+.04);
    for(let i=0;i<5;i++)p.push(box(.025,.53,.025,P.iron,x+(i-2)*archWidth*.19,.30,back+.22));
    p.push(box(archWidth,.035,.035,P.bronze,x,.52,back+.22));
  }
  for(const fraction of [-.47,-.145,.145,.47]){
    const x=cx+width*fraction;
    for(let r=0;r<6;r++)p.push(stone(.43,.37,.55,r%2?P.stone:P.stoneDark,x,.185+r*.38,back+.10));
    p.push(stone(.67,.24,.76,P.stoneLight,x,.12,back+.10),stone(.55,.13,.64,P.stone,x,.305,back+.10));
    if(Math.abs(fraction)>.2)absorb(createBrazier(.83),x,.24,back+.64);
  }
  // Only low rubble and props flank the playable footprint; front edge remains clear.
  for(const side of [-1,1]){
    for(let i=0;i<10;i++){const x=cx+side*(width*.5-.12),z=back+.7+i*Math.min(depth*.07,.64);p.push(stone(.30,.18+seeded(i)*.16,.44,P.stoneDark,x,.12,z));}
    absorb(createDungeonCrate(.62),cx+side*(width*.5-.55),0,back+1.4,.13*side);
    absorb(createLantern(),cx+side*(width*.5-.45),0,cz+depth*.33,0,1.1);
    absorb(createDungeonBarrel(),cx+side*(width*.5-.38),0,cz+depth*.20,0,.9);
  }
  for(const side of [-1,1])for(let i=0;i<12;i++){
    const x=cx+side*(width*.5-.13-seeded(i+92)*.17),z=back+.5+seeded(i+side*43)*depth*.72;
    const rubble=createOreGeometry(i%3);rubble.scale(.6+seeded(i)*.5,.6,.6).translate(x,.08,z);p.push(rubble);
  }
  absorb(createCrystalCart(),cx-width*.5+.65,0,back+2.55,.12);
  absorb(createTreasureChest(),cx+width*.5-.64,0,cz+depth*.06,-.20);
  absorb(createDungeonCrate(.53),cx+width*.5-.5,0,back+2.25,-.18);
  const g=assembly(p,e);if(shadows.length)g.add(new THREE.Mesh(merge(shadows),contactMaterial));if(spills.length)g.add(new THREE.Mesh(merge(spills),spillMaterial));g.name='gothic-dungeon-room-batched';return g;
}
