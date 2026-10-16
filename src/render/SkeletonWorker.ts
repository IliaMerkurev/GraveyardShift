import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import skeletonData from '../assets/SkeletonMiner_Animated.glb?url&inline';
import { CONFIG } from '../game/config';

// The supplied GLB stays byte-for-byte intact. Only its render instances are tinted.
export const WORKER_SCALE = .55;
export const MINING_CONTACT_SECONDS = .9;
let template: GLTF | undefined;
let loading: Promise<void> | undefined;

/** Weld UV seams before selecting the disconnected, highest helmet shell. */
export function helmetMask(geometry: THREE.BufferGeometry): THREE.BufferAttribute {
  const position = geometry.getAttribute('position');
  const parent = Array.from({length: position.count}, (_, i) => i);
  const root = (i: number): number => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const union = (a: number, b: number) => { parent[root(a)] = root(b); };
  const welded = new Map<string, number>();
  for (let i = 0; i < position.count; i++) {
    const key = [position.getX(i), position.getY(i), position.getZ(i)].map(v => Math.round(v * 1e5)).join(',');
    const previous = welded.get(key);
    if (previous === undefined) welded.set(key, i); else union(i, previous);
  }
  const index = geometry.index;
  for (let i = 0; i < (index?.count ?? position.count); i += 3) {
    const a = index ? index.getX(i) : i;
    union(a, index ? index.getX(i + 1) : i + 1);
    union(a, index ? index.getX(i + 2) : i + 2);
  }
  let highest = -Infinity, shell = -1;
  for (let i = 0; i < position.count; i++) if (position.getY(i) > highest) { highest = position.getY(i); shell = root(i); }
  const mask = new Float32Array(position.count);
  for (let i = 0; i < position.count; i++) mask[i] = root(i) === shell ? 1 : 0;
  return new THREE.BufferAttribute(mask, 1);
}

export function loadSkeletonWorker(): Promise<void> {
  return loading ??= (async () => {
    const bytes = Uint8Array.from(atob(skeletonData.slice(skeletonData.indexOf(',') + 1)), c => c.charCodeAt(0));
    const loader = new GLTFLoader();
    // ImageBitmapLoader fetches blob URLs, forbidden by the standalone connect-src
    // policy. TextureLoader uses HTML images allowed by img-src blob:, offline.
    loader.register(parser => {
      parser.textureLoader = new THREE.TextureLoader(parser.options.manager);
      return {name: 'OFFLINE_IMAGE_LOADER'};
    });
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let gltf: GLTF;
    try {
      gltf = await Promise.race([
        loader.parseAsync(bytes.buffer, ''),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(() => reject(new Error('The skeleton worker could not load. Please reload the playable.')), 15000);
        })
      ]);
    } finally { clearTimeout(timeout); }
    gltf.scene.traverse(object => {
      if (object instanceof THREE.SkinnedMesh) object.geometry.setAttribute('helmetMask', helmetMask(object.geometry));
    });
    if (!gltf.animations.some(c => c.name === 'Idle') || !gltf.animations.some(c => c.name === 'Mining')) throw new Error('Skeleton animations are missing.');
    template = gltf;
  })();
}

/** Called only when the whole scene is torn down, after its instances. */
export function disposeSkeletonWorkerAsset(): void {
  if (!template) return;
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  template.scene.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
  template = undefined; loading = undefined;
}

export function miningClipTime(phase: number, duration: number): number {
  const p = THREE.MathUtils.clamp(phase, 0, 1), hit = CONFIG.mining.impactPhase;
  return p <= hit ? p / hit * MINING_CONTACT_SECONDS : MINING_CONTACT_SECONDS + (p - hit) / (1 - hit) * (duration - MINING_CONTACT_SECONDS);
}

export function helmetColor(level: number, color = new THREE.Color()): THREE.Color {
  const safe = Number.isSafeInteger(level) && level > 0 ? level : 1;
  if (safe <= CONFIG.visual.helmetColors.length) return color.setHex(CONFIG.visual.helmetColors[safe - 1]);
  return color.setHSL(((safe % 360) * 137.508 % 360) / 360, .7, .62);
}

export interface WorkerVisual {
  group: THREE.Group;
  setLevel(level: number): void;
  setAction(phase: number, working: boolean, dt: number, reducedMotion: boolean): void;
  dispose(): void;
}

export function createWorker(): WorkerVisual {
  if (!template) throw new Error('Skeleton worker has not loaded.');
  const model = clone(template.scene), group = new THREE.Group();
  group.name = 'animated-skeleton-worker';
  model.scale.setScalar(WORKER_SCALE);
  // The authored soles are at y=0. Avoid per-frame bounds normalization, which
  // would cancel the natural knee/body motion and move the ground contact.
  group.add(model);
  const tint = {value: helmetColor(1)};
  const ownedMaterials: THREE.Material[] = [];
  model.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = true; object.receiveShadow = true;
    if (!(object instanceof THREE.SkinnedMesh)) return;
    // Animated bounds exceed the bind pose; avoid incorrect edge culling.
    object.frustumCulled = false;
    const source = object.material as THREE.MeshStandardMaterial;
    const material = source.clone(); ownedMaterials.push(material); object.material = material;
    material.onBeforeCompile = shader => {
      shader.uniforms.workerHelmetColor = tint;
      shader.vertexShader = 'attribute float helmetMask; varying float vHelmetMask;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvHelmetMask = helmetMask;');
      shader.fragmentShader = 'uniform vec3 workerHelmetColor; varying float vHelmetMask;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        float sourceLuminance = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        float tintLuminance = max(0.08, dot(workerHelmetColor, vec3(0.2126, 0.7152, 0.0722)));
        diffuseColor.rgb = mix(diffuseColor.rgb, workerHelmetColor * sourceLuminance / tintLuminance, vHelmetMask);`);
    };
    material.customProgramCacheKey = () => 'skeleton-helmet-shell-v1';
  });
  const mixer = new THREE.AnimationMixer(model);
  const idle = mixer.clipAction(template.animations.find(c => c.name === 'Idle')!);
  const mining = mixer.clipAction(template.animations.find(c => c.name === 'Mining')!);
  idle.play(); mining.play(); mining.setEffectiveWeight(0);
  let idleTime = 0, disposed = false;
  return {
    group,
    setLevel(level) { helmetColor(level, tint.value); },
    setAction(phase, working, dt, reducedMotion) {
      if (disposed) return;
      const active = working && !reducedMotion;
      if (!active && !reducedMotion) idleTime = (idleTime + Math.max(0, dt)) % idle.getClip().duration;
      idle.setEffectiveWeight(active ? 0 : 1); mining.setEffectiveWeight(active ? 1 : 0);
      idle.time = reducedMotion ? 0 : idleTime;
      mining.time = miningClipTime(phase, mining.getClip().duration);
      mixer.update(0);
    },
    dispose() {
      if (disposed) return; disposed = true;
      mixer.stopAllAction(); mixer.uncacheRoot(model);
      model.traverse(object => { if (object instanceof THREE.SkinnedMesh) object.skeleton.dispose(); });
      ownedMaterials.forEach(material => material.dispose());
      group.removeFromParent();
    }
  };
}
