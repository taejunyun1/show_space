import type { Point, Wall } from './types';

export interface FloorBoundary {
  /** All accepted loops, retained for outline consumers. */
  polygons: Point[][];
  surfaces: { outer: Point[]; holes: Point[][] }[];
  areaMm2: number;
  invalidComponents: number;
}
const key = (p: Point) => `${p.x},${p.z}`;
const cross = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
function intersects(a: Point, b: Point, c: Point, d: Point) {
  const on = (p: Point, q: Point, r: Point) => cross(p, q, r) === 0 && r.x >= Math.min(p.x, q.x) && r.x <= Math.max(p.x, q.x) && r.z >= Math.min(p.z, q.z) && r.z <= Math.max(p.z, q.z);
  return (Math.sign(cross(a, b, c)) * Math.sign(cross(a, b, d)) < 0 && Math.sign(cross(c, d, a)) * Math.sign(cross(c, d, b)) < 0) || on(a, b, c) || on(a, b, d) || on(c, d, a) || on(c, d, b);
}
function polygonArea(points: Point[]): number {
  return Math.abs(points.reduce((sum, a, i) => {
    const b = points[(i + 1) % points.length];
    return sum + a.x * b.z - b.x * a.z;
  }, 0)) / 2;
}
/** Strict containment is safe after all touching/intersecting loops are rejected. */
function contains(polygon: Point[], point: Point): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.z > point.z) !== (b.z > point.z) && point.x < (b.x - a.x) * (point.z - a.z) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}
/** Exact boundary loops define floors; explicit partitions and visibility never alter them. */
export function deriveFloor(walls: Wall[]): FloorBoundary {
  walls = walls.filter(wall => wall.role !== 'partition');
  const result: FloorBoundary = { polygons: [], surfaces: [], areaMm2: 0, invalidComponents: 0 };
  const adjacency = new Map<string, number[]>();
  walls.forEach((wall, index) => {
    for (const point of [wall.start, wall.end]) {
      const id = key(point);
      adjacency.set(id, [...(adjacency.get(id) ?? []), index]);
    }
  });
  const remaining = new Set(walls.map((_, i) => i));
  while (remaining.size) {
    const seed = remaining.values().next().value!;
    const component = new Set<number>();
    const pending = [seed];
    while (pending.length) {
      const index = pending.pop()!;
      if (component.has(index)) continue;
      component.add(index); remaining.delete(index);
      for (const point of [walls[index].start, walls[index].end]) pending.push(...(adjacency.get(key(point)) ?? []).filter(i => !component.has(i)));
    }
    const valid = component.size >= 3 && [...component].every(index => {
      const wall = walls[index];
      return [wall.start, wall.end].every(p => Number.isFinite(p.x) && Number.isFinite(p.z) && adjacency.get(key(p))?.length === 2) && key(wall.start) !== key(wall.end);
    });
    if (!valid) { result.invalidComponents++; continue; }
    const polygon: Point[] = [];
    let index = seed;
    let point = walls[seed].start;
    const visited = new Set<number>();
    while (!visited.has(index)) {
      visited.add(index); polygon.push({ ...point });
      const wall = walls[index];
      point = key(wall.start) === key(point) ? wall.end : wall.start;
      index = adjacency.get(key(point))!.find(i => i !== index)!;
    }
    let area = 0;
    let selfIntersection = false;
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length];
      area += a.x * b.z - b.x * a.z;
      for (let j = i + 1; j < polygon.length; j++) {
        if (j === i + 1 || (i === 0 && j === polygon.length - 1)) continue;
        if (intersects(a, b, polygon[j], polygon[(j + 1) % polygon.length])) selfIntersection = true;
      }
    }
    if (selfIntersection || Math.abs(area) < 1 || visited.size !== component.size) { result.invalidComponents++; continue; }
    result.polygons.push(area < 0 ? polygon.reverse() : polygon);

  }
  const loops = result.polygons;
  const rejected = new Set<number>();
  for (let i = 0; i < loops.length; i++) {
    for (let j = i + 1; j < loops.length; j++) {
      if (loops[i].some((a, edge) => loops[j].some((c, other) => intersects(a, loops[i][(edge + 1) % loops[i].length], c, loops[j][(other + 1) % loops[j].length])))) {
        rejected.add(i); rejected.add(j);
      }
    }
  }
  // A loop nested in an ambiguous boundary cannot be safely treated as an island.
  let changed = true;
  while (changed) {
    changed = false;
    loops.forEach((loop, i) => {
      if (!rejected.has(i) && [...rejected].some(j => contains(loop, loops[j][0]) || contains(loops[j], loop[0]))) {
        rejected.add(i); changed = true;
      }
    });
  }
  result.invalidComponents += rejected.size;
  result.polygons = loops.filter((_, i) => !rejected.has(i));
  const areas = result.polygons.map(polygonArea);
  const parents = result.polygons.map((loop, i) => {
    let parent = -1;
    result.polygons.forEach((candidate, j) => {
      if (i !== j && areas[j] > areas[i] && contains(candidate, loop[0]) && (parent === -1 || areas[j] < areas[parent])) parent = j;
    });
    return parent;
  });
  const depths = parents.map(parent => {
    let depth = 0;
    while (parent !== -1) { depth++; parent = parents[parent]; }
    return depth;
  });
  result.polygons.forEach((outer, i) => {
    if (depths[i] % 2 !== 0) return;
    const holes = result.polygons.filter((_, j) => parents[j] === i);
    result.surfaces.push({ outer, holes });
    result.areaMm2 += areas[i] - holes.reduce((sum, hole) => sum + polygonArea(hole), 0);
  });
  return result;
}
