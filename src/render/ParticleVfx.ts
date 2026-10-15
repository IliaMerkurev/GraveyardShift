import * as THREE from 'three';
import type { GameEvent } from '../game/GameState';
import type { Point } from './Layout';

export const VFX_LIMITS={particles:224,ambient:130,blastCenters:4,wordMarks:16} as const;
const WHITE=new THREE.Color(0xffffff);
/** Victim events precede their aggregate. Keep each action separate and bound all centers. */
export function planBlasts(events:GameEvent[],previous:ReadonlyMap<string,Point>){
  const result:{point:Point;strength:number;secondary:boolean}[]=[];
  const extras:Point[]=[];let pending:GameEvent[]=[];
  for(const event of events){
    if(event.type==='destroy')pending.push(event);
    if(event.type!=='bomb'&&event.type!=='tailBlast')continue;
    const count=Math.max(0,Math.floor(event.amount??0));
    const victims=count?pending.slice(-count):[];pending=[];
    const sites=victims.map(v=>v.stoneId?previous.get(v.stoneId):undefined).filter((p):p is Point=>!!p);
    const primary=event.type==='tailBlast'&&sites.length?sites[Math.floor(sites.length/2)]:event;
    if(result.length<VFX_LIMITS.blastCenters)result.push({point:primary,strength:Math.min(1.3,.85+Math.sqrt(count)*.07),secondary:false});
    if(event.type==='tailBlast')for(let i=0;i<Math.min(3,sites.length);i++){const point=sites[Math.floor(i*sites.length/Math.min(3,sites.length))];if(Math.hypot(point.x-primary.x,point.z-primary.z)>=1)extras.push(point);}
  }
  for(const point of extras){if(result.length>=VFX_LIMITS.blastCenters)break;result.push({point,strength:.7,secondary:true});}
  return result;
}
type Particle={active:boolean;age:number;life:number;x:number;y:number;z:number;vx:number;vy:number;vz:number;size:number;growth:number;opacity:number;rotation:number;spin:number;tile:number;color:number;glow:boolean;spark:boolean;gravity:number;delay:number};
const blank=():Particle=>({active:false,age:0,life:0,x:0,y:0,z:0,vx:0,vy:0,vz:0,size:0,growth:0,opacity:1,rotation:0,spin:0,tile:0,color:0xffffff,glow:false,spark:false,gravity:0,delay:0});
/** Original canvas artwork, not a copied image. Six shared atlas cells, no network assets. */
function makeAtlas(){
  const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=256;const c=canvas.getContext('2d')!;
  const disc=(x:number,y:number,r:number,color:string)=>{c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=color;c.fill();};
  const gradient=c.createRadialGradient(128,128,0,128,128,124);gradient.addColorStop(0,'rgba(255,255,255,1)');gradient.addColorStop(.2,'rgba(255,255,255,.98)');gradient.addColorStop(.42,'rgba(255,255,255,.58)');gradient.addColorStop(.72,'rgba(255,255,255,.13)');gradient.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=gradient;c.fillRect(0,0,256,256);
  c.save();c.translate(256,0);
  for(let i=0;i<9;i++){const a=i*Math.PI*2/9;disc(128+Math.cos(a)*56,128+Math.sin(a)*48,48,'#d84a12');}
  for(let i=0;i<9;i++){const a=i*Math.PI*2/9;disc(128+Math.cos(a)*54,126+Math.sin(a)*46,40,'#ffab16');}
  disc(128,123,67,'#ffd64a');disc(117,108,48,'#ffe979');c.restore();
  c.save();c.translate(512,0);
  const burst=(scale:number,color:string)=>{c.beginPath();for(let i=0;i<36;i++){const a=i*Math.PI/18,r=(i%2?49+(i%5)*3:108+(i%3)*5)*scale,x=128+Math.cos(a)*r,y=128+Math.sin(a)*r*(.79+.07*Math.sin(i));i?c.lineTo(x,y):c.moveTo(x,y);}c.closePath();c.fillStyle=color;c.fill();};
  burst(1,'#951d2d');burst(.92,'#ef3e26');burst(.71,'#ff9823');burst(.46,'#ffe778');c.restore();
  c.save();c.translate(768,0);c.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?44:110,x=128+Math.cos(a)*r,y=128+Math.sin(a)*r;i?c.lineTo(x,y):c.moveTo(x,y);}c.closePath();c.fillStyle='#ffdd55';c.strokeStyle='#eb7420';c.lineWidth=17;c.lineJoin='round';c.fill();c.stroke();c.restore();
  c.save();c.translate(1152,128);c.rotate(-.12);c.font='italic 900 65px sans-serif';c.textAlign='center';c.textBaseline='middle';c.lineJoin='round';c.strokeStyle='#ffe976';c.lineWidth=15;c.strokeText('BOOM!',0,0,221);c.strokeStyle='#65202a';c.lineWidth=7;c.strokeText('BOOM!',0,0,221);c.fillStyle='#f44329';c.fillText('BOOM!',0,0,221);c.restore();
  // A dedicated feathered fractal cloud, not a glow disc. Deterministic and shared.
  const cloud=c.createImageData(256,256);
  const hash=(x:number,y:number)=>{const n=Math.sin(x*127.1+y*311.7+19.3)*43758.5453;return n-Math.floor(n);};
  const noise=(x:number,y:number)=>{const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix,iy),hash(ix+1,iy),u),THREE.MathUtils.lerp(hash(ix,iy+1),hash(ix+1,iy+1),u),v);};
  for(let y=0;y<256;y++)for(let x=0;x<256;x++){
    const dx=(x-128)/120,dy=(y-128)/115,edge=Math.max(0,1-dx*dx-dy*dy);
    const billow=noise(x/55,y/55)*.55+noise(x/26+7,y/26+3)*.28+noise(x/12+11,y/12+19)*.12+noise(x/5,y/5)*.05;
    const density=Math.min(1,Math.max(0,(billow-.22)*2)),i=(y*256+x)*4;
    cloud.data[i]=226;cloud.data[i+1]=220;cloud.data[i+2]=207;cloud.data[i+3]=Math.round(255*edge*edge*density*.92);
  }
  c.putImageData(cloud,1280,0);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
/** Shared instanced sprite renderer; lettering uses a final normal-blend pass. */
class SpriteBatch{
  readonly mesh:THREE.InstancedMesh;count=0;
  private opacity:THREE.InstancedBufferAttribute;private tile:THREE.InstancedBufferAttribute;private tint:THREE.InstancedBufferAttribute;
  private dummy=new THREE.Object3D();private color=new THREE.Color();
  constructor(texture:THREE.Texture,capacity:number,additive:boolean){
    const geometry=new THREE.PlaneGeometry(1,1);
    this.opacity=new THREE.InstancedBufferAttribute(new Float32Array(capacity),1).setUsage(THREE.DynamicDrawUsage);this.tile=new THREE.InstancedBufferAttribute(new Float32Array(capacity),1).setUsage(THREE.DynamicDrawUsage);this.tint=new THREE.InstancedBufferAttribute(new Float32Array(capacity*3),3).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('vfxOpacity',this.opacity);geometry.setAttribute('vfxTile',this.tile);geometry.setAttribute('vfxTint',this.tint);
    const material=new THREE.ShaderMaterial({uniforms:{atlas:{value:texture}},transparent:true,depthWrite:false,depthTest:true,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending,toneMapped:false,
      vertexShader:`attribute float vfxOpacity;attribute float vfxTile;attribute vec3 vfxTint;varying vec2 spriteUv;varying float alpha;varying vec3 tint;void main(){spriteUv=vec2((uv.x+vfxTile)/6.0,uv.y);alpha=vfxOpacity;tint=vfxTint;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0);}`,
      fragmentShader:`uniform sampler2D atlas;varying vec2 spriteUv;varying float alpha;varying vec3 tint;void main(){vec4 texel=texture2D(atlas,spriteUv);gl_FragColor=vec4(texel.rgb*tint,texel.a*alpha);if(gl_FragColor.a<.002)discard;
      #include <colorspace_fragment>
      }`});
    this.mesh=new THREE.InstancedMesh(geometry,material,capacity);this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.mesh.frustumCulled=false;this.mesh.count=0;this.mesh.renderOrder=additive?7:6;
  }
  add(camera:THREE.Camera,x:number,y:number,z:number,size:number,aspect:number,rotation:number,opacity:number,tile:number,color:number,intensity=1,whiteMix=0){
    const i=this.count++;this.dummy.position.set(x,y,z);this.dummy.quaternion.copy(camera.quaternion);this.dummy.rotateZ(rotation);this.dummy.scale.set(size*aspect,size,1);this.dummy.updateMatrix();this.mesh.setMatrixAt(i,this.dummy.matrix);this.opacity.setX(i,opacity);this.tile.setX(i,tile);this.color.setHex(color).lerp(WHITE,whiteMix).multiplyScalar(intensity);this.tint.setXYZ(i,this.color.r,this.color.g,this.color.b);
  }
  flush(){this.mesh.count=this.count;this.mesh.instanceMatrix.needsUpdate=true;this.opacity.needsUpdate=true;this.tile.needsUpdate=true;this.tint.needsUpdate=true;}
  dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();(this.mesh.material as THREE.Material).dispose();}
}

/** Each mote gets independent, repeatable coordinates and drift, sampled only once. */
function createDustMotes(){
  let seed=0x5baf7391;
  const random=()=>{seed+=0x6d2b79f5;let n=seed;n=Math.imul(n^(n>>>15),n|1);n^=n+Math.imul(n^(n>>>7),n|61);return((n^(n>>>14))>>>0)/4294967296;};
  return Array.from({length:48},()=>({
    x:(random()*2-1)*.88,z:.035+random()*.93,y:.55+random()*1.55,
    phaseX:random()*Math.PI*2,phaseY:random()*Math.PI*2,phaseZ:random()*Math.PI*2,
    speedX:.08+random()*.14,speedY:.07+random()*.12,speedZ:.06+random()*.13,
    driftX:.28+random()*.45,driftY:.1+random()*.18,driftZ:.2+random()*.48,
    size:.065+random()*.045,alpha:.19+random()*.15,
  }));
}

export class ParticleVfx{
  private atlas=makeAtlas();private normal=new SpriteBatch(this.atlas,VFX_LIMITS.particles+VFX_LIMITS.ambient,false);private glow=new SpriteBatch(this.atlas,VFX_LIMITS.particles*2+96,true);
  private dust=createDustMotes();
  private words=new SpriteBatch(this.atlas,VFX_LIMITS.wordMarks,false);
  private particles=Array.from({length:VFX_LIMITS.particles},blank);private cursor=0;private time=0;private disposed=false;
  constructor(scene:THREE.Scene){this.words.mesh.renderOrder=8;scene.add(this.normal.mesh,this.glow.mesh,this.words.mesh);}
  private emit(values:Partial<Particle>){if(this.disposed)return;const p=this.particles[this.cursor++%this.particles.length];Object.assign(p,blank(),values,{active:true});}
  /** Short thin warm sparks keep rock silhouettes and physical coin rewards readable. */
  oreSparks(x:number,z:number,count=3,reward=false){
    // Mining gets 6–8 readable streaks. Coin accents stay fewer and smaller.
    for(let i=0;i<Math.min(reward?count:count*2,reward?4:8);i++){
      const angle=Math.random()*Math.PI*2,speed=reward?.8+Math.random()*.8:1.1+Math.random();
      this.emit({x,y:.34,z,life:reward?.17+Math.random()*.1:.26+Math.random()*.14,size:reward?.12+Math.random()*.08:(.25+Math.random()*.15)*1.35,rotation:angle,vx:Math.cos(angle)*speed,vy:.6+Math.random()*.6,vz:Math.sin(angle)*speed,gravity:3,color:i%2?0xffd16b:0xffa943,glow:true,spark:true,opacity:reward?.78:.9});
    }
  }
  /** Bonus glow stays rich; mining rewards use small sparks rather than stacked white halos. */
  sparkle(x:number,z:number,color:number,count:number,large=false,coin=false){
    if(coin){this.oreSparks(x,z,Math.min(count,4),true);return;}
    for(let i=0;i<Math.min(count,large?12:5);i++)this.emit({x,y:.32,z,life:large?.65:.45,size:large?.85:.55,vx:(Math.random()-.5)*(large?2.1:1.2),vy:1+Math.random(),vz:(Math.random()-.5)*(large?2.1:1.2),gravity:4,color,glow:true,opacity:.92});
  }
  explosion(x:number,z:number,strength=1,secondary=false){
    const s=Math.max(.65,Math.min(1.35,strength))*1.5;
    this.emit({x,y:.5,z,life:.55,size:1.85*s,growth:.45,tile:2,opacity:.96,rotation:(Math.random()-.5)*.3});
    this.emit({x,y:.6,z:z+.02,life:.2,size:.9*s,growth:.7,color:0xffd754,glow:true,opacity:.7});
    const n=secondary?4:7;for(let i=0;i<n;i++){const a=i/n*Math.PI*2;this.emit({x:x+Math.cos(a)*.16,y:.5+Math.sin(a)*.1,z,life:.62+Math.random()*.12,delay:.025+Math.random()*.04,size:.55*s,growth:.55,tile:1,vx:Math.cos(a)*.7*s,vy:.4+Math.sin(a)*.35,vz:Math.sin(a)*.55*s,rotation:a*.2,spin:(i%2?1:-1)*.2});}
    for(let i=0;i<(secondary?4:7);i++){const a=i/7*Math.PI*2;this.emit({x,y:.7,z,life:.58+Math.random()*.18,size:(.18+Math.random()*.09)*1.5,tile:3,vx:Math.cos(a)*2.1*s,vy:1.2+Math.random(),vz:Math.sin(a)*1.7*s,gravity:3,spin:(i%2?1:-1)*3,rotation:a});}
    if(!secondary)this.emit({x,y:.95,z:z+.22,life:.53,delay:.045,size:1.45*s,growth:.1,tile:4});
    this.sparkle(x,z,0xffb93f,secondary?5:10,true);
  }
  reset(){for(const p of this.particles)p.active=false;this.cursor=0;this.time=0;this.normal.count=0;this.glow.count=0;this.words.count=0;this.normal.flush();this.glow.flush();this.words.flush();}
  update(dt:number,camera:THREE.Camera,landscape:boolean,reducedMotion:boolean,paused:boolean){
    if(this.disposed)return;const step=paused?0:Math.min(.1,Math.max(0,dt));this.time+=reducedMotion?0:step;this.normal.count=0;this.glow.count=0;this.words.count=0;
    if(reducedMotion)for(const p of this.particles)p.active=false;
    // Layered warm-grey clouds at the perimeter and near edge; faint broken floor wisps.
    // Dust is distributed through the room, not hidden outside the camera's playable bounds.
    const halfWidth=landscape?8.1:3.65,back=landscape?-3.9:-7.9,depth=landscape?11.4:16.2;
    if(landscape){
      for(let i=0;i<16;i++){
        const side=i%2?1:-1,phase=i*2.399,z=back+((Math.floor(i/2)+.35)/8)*depth;
        this.normal.add(camera,side*(halfWidth-.4)+Math.sin(this.time*.1+phase)*.2,.38,z+Math.cos(this.time*.08+phase)*.17,1.9,1.9,Math.sin(phase)*.5,.38,5,i%3?0xc4c5bc:0xe6c99e);
      }
      for(let i=0;i<8;i++)this.normal.add(camera,((i+.5)/8*2-1)*halfWidth,.25,back+depth-.2+Math.sin(this.time*.1+i)*.12,1.5,2.2,Math.sin(i*2.4)*.25,.34,5,0xd0c5af);
      for(let i=0;i<4;i++)this.normal.add(camera,((i+.5)/4*2-1)*halfWidth,.2,back+.4,1.3,2.8,0,.19,5,0xd8c29d);
      for(let i=0;i<6;i++){
        const phase=i*2.399,x=Math.sin(phase)*halfWidth*.6+Math.sin(this.time*.06+phase)*.25,z=back+(.2+i*.11)*depth;
        this.normal.add(camera,x,.13,z,1.2,2.6,phase,.075,5,0xb9bdb2);
      }
    }else{
      // The wide landscape billboards overlapped into bright horizontal bands in
      // portrait. Keep narrower, dimmer wisps outside the track and stop before
      // the storage/conveyor; no foreground curtain or clouds across the floor.
      for(let i=0;i<12;i++){
        const side=i%2?1:-1,phase=i*2.399;
        const z=-6.6+Math.floor(i/2)*2.25+Math.sin(phase)*.38;
        this.normal.add(camera,side*(3.95+Math.sin(this.time*.07+phase)*.1),.32,z+Math.cos(this.time*.06+phase)*.12,1.65,1,Math.sin(phase)*.12,.21,5,0xb9bdb2);
      }
      for(let i=0;i<4;i++)this.normal.add(camera,((i+.5)/4*2-1)*3.4,.2,-7.5,1,1.7,0,.12,5,0xc4c5bc);
    }
    if(!reducedMotion)for(const mote of this.dust){
      // Continuous bounded drift: no wrapping, respawning or shared marching phase.
      const x=mote.x*halfWidth+Math.sin(this.time*mote.speedX+mote.phaseX)*mote.driftX;
      const y=mote.y+Math.sin(this.time*mote.speedY+mote.phaseY)*mote.driftY;
      const z=back+mote.z*depth+Math.sin(this.time*mote.speedZ+mote.phaseZ)*mote.driftZ;
      this.glow.add(camera,x,y,z,mote.size*3,1,0,mote.alpha*.2,0,0xffdb96,1);
      this.glow.add(camera,x,y,z,mote.size,1,0,mote.alpha,0,0xffe7b6,1.05,.1);
    }
    for(const p of this.particles){if(!p.active)continue;p.age+=step;if(p.age>=p.life+p.delay){p.active=false;continue;}if(p.age<p.delay)continue;p.x+=p.vx*step;p.y+=p.vy*step;p.z+=p.vz*step;p.vy-=p.gravity*step;const t=(p.age-p.delay)/p.life,fade=1-t*t,size=p.size*(p.growth?(.65+Math.min(1,t*5)*.35+p.growth*t):1-t*.65);if(p.glow){
      if(p.spark){this.glow.add(camera,p.x,p.y,p.z,size,.18,p.rotation,fade*p.opacity,p.tile,p.color,1.2);continue;}
      // Two co-moving sprites make the bloom legible even on a small viewport.
      // Both stay in the same bounded additive batch; no extra lights or postprocessing.
      this.glow.add(camera,p.x,p.y,p.z,size,1,p.rotation+p.spin*t,fade*p.opacity,p.tile,p.color,1.35);
      this.glow.add(camera,p.x,p.y,p.z,size*.3,1,p.rotation+p.spin*t,fade*Math.min(1,p.opacity+.1),p.tile,p.color,2,.6);
    }}
    // Stable painter order survives ring-buffer wrap. Lettering draws AFTER the additive
    // core/halo batch so bright glow cannot wash out its ink and red fill.
    for(const tile of [0,2,1,3,4])for(const p of this.particles){
      if(!p.active||p.glow||p.tile!==tile||p.age<p.delay)continue;
      const t=(p.age-p.delay)/p.life,size=p.size*(p.growth?(.65+Math.min(1,t*5)*.35+p.growth*t):1-t*.65);
      if(tile===4&&this.words.count>=VFX_LIMITS.wordMarks)continue;
      (tile===4?this.words:this.normal).add(camera,p.x,p.y,p.z,size,1,p.rotation+p.spin*t,(1-t*t)*p.opacity,p.tile,p.color);
    }
    this.normal.flush();this.glow.flush();this.words.flush();
  }
  metrics(){return{vfxParticles:this.particles.filter(p=>p.active).length,vfxSprites:this.normal.mesh.count+this.glow.mesh.count+this.words.mesh.count};}
  dispose(){if(this.disposed)return;this.reset();this.normal.dispose();this.glow.dispose();this.words.dispose();this.atlas.dispose();this.disposed=true;}
}
