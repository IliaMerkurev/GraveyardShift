import { CONFIG, type GameConfig } from './config';
import type { Point } from './GameState';

export interface PathSample extends Point { angle: number }

export function getPathLength(path: GameConfig['path'] = CONFIG.path): number {
  return path.runs.length * (path.right - path.left) + (path.runs.length - 1) * Math.PI * path.bendRadius;
}
export const PATH_LENGTH = getPathLength();

/** Exact arc-length parameterization: a stone covers equal distance on runs and bends. */
export function samplePath(distance: number, path: GameConfig['path'] = CONFIG.path): PathSample {
  let remaining = Math.max(0, Math.min(getPathLength(path), distance));
  const straight = path.right - path.left;
  const arcLength = Math.PI * path.bendRadius;
  for (let run = 0; run < path.runs.length; run++) {
    const z = path.runs[run]!;
    const forward = run % 2 === 0;
    if (remaining <= straight || run === path.runs.length - 1) {
      return { x: forward ? path.left + remaining : path.right - remaining, z, angle: forward ? Math.PI / 2 : -Math.PI / 2 };
    }
    remaining -= straight;
    if (remaining <= arcLength) {
      const theta = -Math.PI / 2 + remaining / path.bendRadius;
      const side = forward ? 1 : -1;
      return {
        x: (forward ? path.right : path.left) + side * path.bendRadius * Math.cos(theta),
        z: z + path.bendRadius + path.bendRadius * Math.sin(theta),
        angle: Math.atan2(-side * Math.sin(theta), Math.cos(theta)),
      };
    }
    remaining -= arcLength;
  }
  return { x: path.left, z: path.runs[path.runs.length - 1]!, angle: -Math.PI / 2 };
}

/** Exact distance to the union of horizontal runs and semicircular connectors. */
export function distanceToPath(point: Point, path: GameConfig['path'] = CONFIG.path): number {
  let minimum = Infinity;
  for (let run = 0; run < path.runs.length; run++) {
    const z = path.runs[run]!;
    const x = Math.max(path.left, Math.min(path.right, point.x));
    minimum = Math.min(minimum, Math.hypot(point.x - x, point.z - z));
    if (run >= path.runs.length - 1) continue;
    const side = run % 2 === 0 ? 1 : -1;
    const centerX = side === 1 ? path.right : path.left;
    const centerZ = z + path.bendRadius;
    const theta = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, Math.atan2(point.z - centerZ, side * (point.x - centerX))));
    const arcX = centerX + side * path.bendRadius * Math.cos(theta);
    const arcZ = centerZ + path.bendRadius * Math.sin(theta);
    minimum = Math.min(minimum, Math.hypot(point.x - arcX, point.z - arcZ));
  }
  return minimum;
}
