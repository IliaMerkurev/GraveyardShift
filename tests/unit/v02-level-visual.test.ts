import { describe, expect, it } from 'vitest';
import { Mesh, MeshLambertMaterial } from 'three';
import { createWorker, helmetColors } from '../../src/render/PrimitiveFactory';

const extendedLevels = [5, 6, 7, 1_000_000, Number.MAX_SAFE_INTEGER];

describe('v0.2 uncapped worker-level visual contract', () => {
  it('preserves all five original helmet colors', () => {
    const worker = createWorker();
    try {
      for (let level = 1; level <= 5; level++) {
        worker.setLevel(level);
        expect((worker.helmet.material as MeshLambertMaterial).color.getHex()).toBe(helmetColors[level - 1]);
      }
    } finally {
      worker.dispose();
    }
  });

  it.each(extendedLevels)('renders level %s with finite color and unchanged shared geometry', level => {
    const worker = createWorker(), other = createWorker();
    try {
      const meshes: Mesh[] = [];
      worker.group.traverse(object => { if (object instanceof Mesh) meshes.push(object); });
      const geometry = meshes.map(mesh => mesh.geometry);
      const positions = meshes.map(mesh => mesh.position.toArray());
      const scales = meshes.map(mesh => mesh.scale.toArray());
      const bodyMaterial = meshes[0].material;
      worker.setLevel(level);
      const color = (worker.helmet.material as MeshLambertMaterial).color;
      for (const component of color.toArray()) {
        expect(Number.isFinite(component)).toBe(true);
        expect(component).toBeGreaterThanOrEqual(0);
        expect(component).toBeLessThanOrEqual(1);
      }
      expect(meshes.map(mesh => mesh.geometry)).toEqual(geometry);
      expect(meshes.map(mesh => mesh.position.toArray())).toEqual(positions);
      expect(meshes.map(mesh => mesh.scale.toArray())).toEqual(scales);
      expect(worker.group.scale.toArray()).toEqual([1, 1, 1]);
      expect(meshes[0].material).toBe(bodyMaterial);
      expect((worker.group.children[0] as Mesh).geometry).toBe((other.group.children[0] as Mesh).geometry);
      expect(worker.helmet.geometry).toBe(other.helmet.geometry);
      expect((worker.arm.children[0] as Mesh).geometry).toBe((other.arm.children[0] as Mesh).geometry);
      if (level > 5) expect(color.getHex()).not.toBe(helmetColors[0]);
    } finally {
      worker.dispose();
      other.dispose();
    }
  });

  it('computes repeatable extended colors with distinct levels six and seven', () => {
    const worker = createWorker(), other = createWorker();
    try {
      const colors = new Map<number, number[]>();
      for (const level of extendedLevels) {
        worker.setLevel(level);
        other.setLevel(level);
        const color = (worker.helmet.material as MeshLambertMaterial).color.toArray();
        colors.set(level, color);
        expect((other.helmet.material as MeshLambertMaterial).color.toArray()).toEqual(color);
      }
      for (const level of [...extendedLevels].reverse()) {
        worker.setLevel(level);
        expect((worker.helmet.material as MeshLambertMaterial).color.toArray()).toEqual(colors.get(level));
      }
      expect(colors.get(6)).not.toEqual(colors.get(7));
    } finally {
      worker.dispose();
      other.dispose();
    }
  });

  it('safely falls back for non-finite or invalid levels after an extended level', () => {
    const worker = createWorker();
    try {
      for (const level of [NaN, Infinity, -Infinity, 0, -1, 1.5]) {
        worker.setLevel(Number.MAX_SAFE_INTEGER);
        worker.setLevel(level);
        const color = (worker.helmet.material as MeshLambertMaterial).color;
        expect(color.getHex()).toBe(helmetColors[0]);
        expect(color.toArray().every(Number.isFinite)).toBe(true);
      }
    } finally {
      worker.dispose();
    }
  });
});
