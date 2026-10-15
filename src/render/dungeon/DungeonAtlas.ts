import * as THREE from 'three';
/** Original painted surface atlas, synthesised once. No image download or dependencies.
 * Four individually UV-mapped swatches: weathered stone, timber, iron, mineral ore. */
export function createDungeonAtlas():THREE.CanvasTexture|null {
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;
  const c=canvas.getContext('2d')!;let seed=19427;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const S=512;
  for(let tile=0;tile<4;tile++){
    const ox=(tile%2)*S,oy=Math.floor(tile/2)*S;c.save();c.beginPath();c.rect(ox,oy,S,S);c.clip();c.translate(ox,oy);
    c.fillStyle=tile===1?'#c3b19b':tile===2?'#9d9d9b':'#b6b4b2';c.fillRect(0,0,S,S);
    // Uneven hand-stippled mineral/wood pores at multiple scales.
    for(let i=0;i<12000;i++){
      const x=random()*S,y=random()*S,r=random()*2.4+.3,l=75+random()*150;
      c.fillStyle=`rgba(${l},${l},${l},${.03+random()*.16})`;c.fillRect(x,y,r,tile===1?r*4:r);
    }
    for(let i=0;i<180;i++){
      const x=random()*S,y=random()*S,r=8+random()*60;const grad=c.createRadialGradient(x,y,0,x,y,r);
      grad.addColorStop(0,random()>.5?'#ffffff12':'#1515121c');grad.addColorStop(1,'#88888800');c.fillStyle=grad;c.fillRect(x-r,y-r,r*2,r*2);
    }
    if(tile===1){
      for(let i=0;i<100;i++){
        const x=random()*S;c.beginPath();c.moveTo(x,-10);
        for(let y=0;y<S+20;y+=12)c.lineTo(x+Math.sin(y*.014+i)*4+Math.sin(y*.039+i*.3)*1.6,y);
        c.strokeStyle=i%3?'#3828193d':'#fbe5b242';c.lineWidth=.5+random()*2.3;c.stroke();
      }
      for(let i=0;i<5;i++){const x=random()*S,y=random()*S;for(let j=1;j<7;j++){c.beginPath();c.ellipse(x,y,j*2.1,j*8,.1,0,Math.PI*2);c.strokeStyle='#49342044';c.lineWidth=1.4;c.stroke();}}
      for(let i=0;i<14;i++){const x=random()*S,y=random()*S;c.beginPath();c.moveTo(x,y);c.lineTo(x+2,y+25+random()*70);c.strokeStyle='#2d211552';c.lineWidth=1;c.stroke();}
    }else if(tile===2){
      for(let i=0;i<180;i++){const x=random()*S,y=random()*S;c.strokeStyle=i%3?'#fff4d429':'#211d2455';c.lineWidth=.5+random();c.beginPath();c.moveTo(x,y);c.lineTo(x+random()*50,y+random()*10);c.stroke();}
      for(let i=0;i<65;i++){c.fillStyle='#bb7a3e22';c.beginPath();c.arc(random()*S,random()*S,random()*12,0,Math.PI*2);c.fill();}
    }else{
      for(let i=0;i<(tile===3?13:7);i++){
        let x=random()*S,y=random()*S;c.beginPath();c.moveTo(x,y);
        for(let j=0;j<6;j++){x+=(random()-.45)*35;y+=(random()-.3)*25;c.lineTo(x,y);}
        c.strokeStyle='#24232b75';c.lineWidth=1.5+random()*1.7;c.stroke();
        c.save();c.translate(1.8,1);c.strokeStyle='#e7ded45c';c.lineWidth=.8;c.stroke();c.restore();
      }
      for(let i=0;i<180;i++){const x=random()*S,y=random()*S;c.fillStyle=i%2?'#dedbd631':'#34343a28';c.beginPath();c.moveTo(x,y);c.lineTo(x+3+random()*9,y+2);c.lineTo(x+random()*8,y+4+random()*7);c.closePath();c.fill();}
    }
    // Directional edge abrasion is actual paint, amplified by geometry bevels.
    const edge=c.createLinearGradient(0,0,0,S);edge.addColorStop(0,'#faf1d95c');edge.addColorStop(.025,'#ffffff00');edge.addColorStop(.94,'#05070c00');edge.addColorStop(1,'#080b1545');c.fillStyle=edge;c.fillRect(0,0,S,S);
    c.restore();
  }
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;map.name='painted-dungeon-stone-timber-iron-ore-atlas';return map;
}
/** Assign each triangle a planar face projection inside one atlas cell. */
export function atlasUV(geometry:THREE.BufferGeometry,tile=0):void {
  const p=geometry.getAttribute('position'),n=geometry.getAttribute('normal');
  geometry.computeBoundingBox();const b=geometry.boundingBox!,size=new THREE.Vector3();b.getSize(size);
  const uv=new Float32Array(p.count*2),ox=(tile%2)*.5,oy=tile<2?.5:0;
  for(let i=0;i<p.count;i++){
    const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i)),nz=Math.abs(n.getZ(i));let u:number,v:number;
    if(ny>=nx&&ny>=nz){u=(p.getX(i)-b.min.x)/(size.x||1);v=(p.getZ(i)-b.min.z)/(size.z||1);}
    else if(nx>nz){u=(p.getZ(i)-b.min.z)/(size.z||1);v=(p.getY(i)-b.min.y)/(size.y||1);}
    else {u=(p.getX(i)-b.min.x)/(size.x||1);v=(p.getY(i)-b.min.y)/(size.y||1);}
    uv[i*2]=ox+.006+u*.488;uv[i*2+1]=oy+.006+v*.488;
  }
  geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
}
export function createContactTexture():THREE.CanvasTexture|null {
  if(typeof document==='undefined')return null;const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const c=canvas.getContext('2d')!;
  const g=c.createRadialGradient(32,32,2,32,32,31);g.addColorStop(0,'#000000b0');g.addColorStop(.4,'#00000062');g.addColorStop(1,'#00000000');c.fillStyle=g;c.fillRect(0,0,64,64);return new THREE.CanvasTexture(canvas);
}
/** Soft amber reflected light, used on the ground only. */
export function createAmberSpillTexture():THREE.CanvasTexture|null {
  if(typeof document==='undefined')return null;const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d')!;
  const g=c.createRadialGradient(64,64,0,64,64,62);g.addColorStop(0,'#ffc56888');g.addColorStop(.32,'#ff9b363b');g.addColorStop(1,'#ff7a0000');c.fillStyle=g;c.fillRect(0,0,128,128);const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;return t;
}
