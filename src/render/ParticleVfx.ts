import * as THREE from 'three';
import type { GameEvent } from '../game/GameState';
import type { Point } from './Layout';

export const VFX_LIMITS={particles:224,ambient:44,blastCenters:4} as const;
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
type Particle={active:boolean;age:number;life:number;x:number;y:number;z:number;vx:number;vy:number;vz:number;size:number;growth:number;opacity:number;rotation:number;spin:number;tile:number;color:number;glow:boolean;gravity:number;delay:number};
const blank=():Particle=>({active:false,age:0,life:0,x:0,y:0,z:0,vx:0,vy:0,vz:0,size:0,growth:0,opacity:1,rotation:0,spin:0,tile:0,color:0xffffff,glow:false,gravity:0,delay:0});
/** Original canvas artwork, not a copied image. Five shared atlas cells, no network assets. */
function makeAtlas(){
  const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=256;const c=canvas.getContext('2d')!;
  const disc=(x:number,y:number,r:number,color:string)=>{c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=color;c.fill();};
  const gradient=c.createRadialGradient(128,128,0,128,128,124);gradient.addColorStop(0,'rgba(255,255,255,1)');gradient.addColorStop(.12,'rgba(255,255,255,.9)');gradient.addColorStop(.38,'rgba(255,255,255,.26)');gradient.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=gradient;c.fillRect(0,0,256,256);
  c.save();c.translate(256,0);
  for(let i=0;i<9;i++){const a=i*Math.PI*2/9;disc(128+Math.cos(a)*56,128+Math.sin(a)*48,48,'#d84a12');}
  for(let i=0;i<9;i++){const a=i*Math.PI*2/9;disc(128+Math.cos(a)*54,126+Math.sin(a)*46,40,'#ffab16');}
  disc(128,123,67,'#ffd64a');disc(117,108,48,'#ffe979');c.restore();
  c.save();c.translate(512,0);
  const burst=(scale:number,color:string)=>{c.beginPath();for(let i=0;i<36;i++){const a=i*Math.PI/18,r=(i%2?49+(i%5)*3:108+(i%3)*5)*scale,x=128+Math.cos(a)*r,y=128+Math.sin(a)*r*(.79+.07*Math.sin(i));i?c.lineTo(x,y):c.moveTo(x,y);}c.closePath();c.fillStyle=color;c.fill();};
  burst(1,'#951d2d');burst(.92,'#ef3e26');burst(.71,'#ff9823');burst(.46,'#ffe778');c.restore();
  c.save();c.translate(768,0);c.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?44:110,x=128+Math.cos(a)*r,y=128+Math.sin(a)*r;i?c.lineTo(x,y):c.moveTo(x,y);}c.closePath();c.fillStyle='#ffdd55';c.strokeStyle='#eb7420';c.lineWidth=17;c.lineJoin='round';c.fill();c.stroke();c.restore();
  c.save();c.translate(1152,128);c.rotate(-.12);c.font='italic 900 65px sans-serif';c.textAlign='center';c.textBaseline='middle';c.lineJoin='round';c.strokeStyle='#ffe976';c.lineWidth=15;c.strokeText('BOOM!',0,0,221);c.strokeStyle='#65202a';c.lineWidth=7;c.strokeText('BOOM!',0,0,221);c.fillStyle='#f44329';c.fillText('BOOM!',0,0,221);c.restore();
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
/** One instanced draw call per blend mode, including ambient effects. */
class SpriteBatch{
  readonly mesh:THREE.InstancedMesh;count=0;
  private opacity:THREE.InstancedBufferAttribute;private tile:THREE.InstancedBufferAttribute;private tint:THREE.InstancedBufferAttribute;
  private dummy=new THREE.Object3D();private color=new THREE.Color();
  constructor(texture:THREE.Texture,capacity:number,additive:boolean){
    const geometry=new THREE.PlaneGeometry(1,1);
    this.opacity=new THREE.InstancedBufferAttribute(new Float32Array(capacity),1).setUsage(THREE.DynamicDrawUsage);this.tile=new THREE.InstancedBufferAttribute(new Float32Array(capacity),1).setUsage(THREE.DynamicDrawUsage);this.tint=new THREE.InstancedBufferAttribute(new Float32Array(capacity*3),3).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('vfxOpacity',this.opacity);geometry.setAttribute('vfxTile',this.tile);geometry.setAttribute('vfxTint',this.tint);
    const material=new THREE.ShaderMaterial({uniforms:{atlas:{value:texture}},transparent:true,depthWrite:false,depthTest:true,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending,toneMapped:false,
      vertexShader:`attribute float vfxOpacity;attribute float vfxTile;attribute vec3 vfxTint;varying vec2 spriteUv;varying float alpha;varying vec3 tint;void main(){spriteUv=vec2((uv.x+vfxTile)/5.0,uv.y);alpha=vfxOpacity;tint=vfxTint;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0);}`,
      fragmentShader:`uniform sampler2D atlas;varying vec2 spriteUv;varying float alpha;varying vec3 tint;void main(){vec4 texel=texture2D(atlas,spriteUv);gl_FragColor=vec4(texel.rgb*tint,texel.a*alpha);if(gl_FragColor.a<.002)discard;
      #include <colorspace_fragment>
      }`});
    this.mesh=new THREE.InstancedMesh(geometry,material,capacity);this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.mesh.frustumCulled=false;this.mesh.count=0;this.mesh.renderOrder=additive?7:6;
  }
  add(camera:THREE.Camera,x:number,y:number,z:number,size:number,aspect:number,rotation:number,opacity:number,tile:number,color:number){
    const i=this.count++;this.dummy.position.set(x,y,z);this.dummy.quaternion.copy(camera.quaternion);this.dummy.rotateZ(rotation);this.dummy.scale.set(size*aspect,size,1);this.dummy.updateMatrix();this.mesh.setMatrixAt(i,this.dummy.matrix);this.opacity.setX(i,opacity);this.tile.setX(i,tile);this.color.setHex(color);this.tint.setXYZ(i,this.color.r,this.color.g,this.color.b);
  }
  flush(){this.mesh.count=this.count;this.mesh.instanceMatrix.needsUpdate=true;this.opacity.needsUpdate=true;this.tile.needsUpdate=true;this.tint.needsUpdate=true;}
  dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();(this.mesh.material as THREE.Material).dispose();}
}

export class ParticleVfx{
  private atlas=makeAtlas();private normal=new SpriteBatch(this.atlas,VFX_LIMITS.particles+VFX_LIMITS.ambient,false);private glow=new SpriteBatch(this.atlas,VFX_LIMITS.particles,true);
  private particles=Array.from({length:VFX_LIMITS.particles},blank);private cursor=0;private time=0;private disposed=false;
  constructor(scene:THREE.Scene){scene.add(this.normal.mesh,this.glow.mesh);}
  private emit(values:Partial<Particle>){if(this.disposed)return;const p=this.particles[this.cursor++%this.particles.length];Object.assign(p,blank(),values,{active:true});}
  /** Glow accompanies physical chips and coins, retaining their readable silhouettes. */
  sparkle(x:number,z:number,color:number,count:number,large=false,coin=false){for(let i=0;i<Math.min(count,large?12:5);i++)this.emit({x,y:.32,z,life:large?.65:.45,size:coin?.23:large?.3:.19,vx:(Math.random()-.5)*(large?2.1:1.2),vy:1+Math.random(),vz:(Math.random()-.5)*(large?2.1:1.2),gravity:4,color,glow:true,opacity:.7});}
  explosion(x:number,z:number,strength=1,secondary=false){
    const s=Math.max(.65,Math.min(1.35,strength));
    this.emit({x,y:.5,z,life:.55,size:1.85*s,growth:.45,tile:2,opacity:.96,rotation:(Math.random()-.5)*.3});
    this.emit({x,y:.6,z:z+.02,life:.2,size:.9*s,growth:.7,color:0xffd754,glow:true,opacity:.7});
    const n=secondary?4:7;for(let i=0;i<n;i++){const a=i/n*Math.PI*2;this.emit({x:x+Math.cos(a)*.16,y:.5+Math.sin(a)*.1,z,life:.62+Math.random()*.12,delay:.025+Math.random()*.04,size:.55*s,growth:.55,tile:1,vx:Math.cos(a)*.7*s,vy:.4+Math.sin(a)*.35,vz:Math.sin(a)*.55*s,rotation:a*.2,spin:(i%2?1:-1)*.2});}
    for(let i=0;i<(secondary?4:7);i++){const a=i/7*Math.PI*2;this.emit({x,y:.7,z,life:.58+Math.random()*.18,size:.18+Math.random()*.09,tile:3,vx:Math.cos(a)*2.1*s,vy:1.2+Math.random(),vz:Math.sin(a)*1.7*s,gravity:3,spin:(i%2?1:-1)*3,rotation:a});}
    if(!secondary)this.emit({x,y:.95,z:z+.22,life:.53,delay:.045,size:1.45*s,growth:.1,tile:4});
    this.sparkle(x,z,0xffb93f,secondary?5:10,true);
  }
  reset(){for(const p of this.particles)p.active=false;this.cursor=0;this.time=0;this.normal.count=0;this.glow.count=0;this.normal.flush();this.glow.flush();}
  update(dt:number,camera:THREE.Camera,landscape:boolean,reducedMotion:boolean,paused:boolean){
    if(this.disposed)return;const step=paused?0:Math.min(.1,Math.max(0,dt));this.time+=reducedMotion?0:step;this.normal.count=0;this.glow.count=0;
    if(reducedMotion)for(const p of this.particles)p.active=false;
    // Low, feathered, perimeter-only mist. Never a full-field fog overlay.
    const halfWidth=landscape?8.1:3.65,back=landscape?-3.9:-7.9,depth=landscape?11.4:16.2;
    for(let i=0;i<12;i++){const side=i%2?1:-1,phase=i*2.399;this.normal.add(camera,side*(halfWidth-.08)+Math.sin(this.time*.12+phase)*.1,.13,back+(i/12)*depth,.8,2.1,0,.055,0,0x9ab8ad);}
    if(!reducedMotion)for(let i=0;i<32;i++){const phase=i*2.399,t=this.time*.14+phase,x=(i%2?1:-1)*(halfWidth-.3-Math.sin(phase)*.24)+Math.sin(t)*.12,z=back+((i*.61803398875)%1)*depth+Math.sin(t*.7)*.12;this.normal.add(camera,x,.4+((i*.381966)%1)*1.5+Math.sin(t)*.16,z,.045+(i%3)*.012,1,0,.15+.08*Math.sin(t),0,0xffe5b0);}
    for(const p of this.particles){if(!p.active)continue;p.age+=step;if(p.age>=p.life+p.delay){p.active=false;continue;}if(p.age<p.delay)continue;p.x+=p.vx*step;p.y+=p.vy*step;p.z+=p.vz*step;p.vy-=p.gravity*step;const t=(p.age-p.delay)/p.life,fade=1-t*t,size=p.size*(p.growth?(.65+Math.min(1,t*5)*.35+p.growth*t):1-t*.65);if(p.glow)this.glow.add(camera,p.x,p.y,p.z,size,1,p.rotation+p.spin*t,fade*p.opacity,p.tile,p.color);}
    // Stable painter order survives ring-buffer wrap: ink burst, puffs, stars, then lettering.
    for(const tile of [0,2,1,3,4])for(const p of this.particles){
      if(!p.active||p.glow||p.tile!==tile||p.age<p.delay)continue;
      const t=(p.age-p.delay)/p.life,size=p.size*(p.growth?(.65+Math.min(1,t*5)*.35+p.growth*t):1-t*.65);
      this.normal.add(camera,p.x,p.y,p.z,size,1,p.rotation+p.spin*t,(1-t*t)*p.opacity,p.tile,p.color);
    }
    this.normal.flush();this.glow.flush();
  }
  metrics(){return{vfxParticles:this.particles.filter(p=>p.active).length,vfxSprites:this.normal.mesh.count+this.glow.mesh.count};}
  dispose(){if(this.disposed)return;this.reset();this.normal.dispose();this.glow.dispose();this.atlas.dispose();this.disposed=true;}
}
