import { describe, expect, it } from 'vitest';
import { deriveFloor } from './floor';
import type { Point, Wall } from './types';
function loop(points: Point[]): Wall[] {
  return points.map((start, i) => ({ id: `w${i}`, name: '', start, end: points[(i + 1) % points.length], heightMm: 3000, thicknessMm: 160, color: '#fff', visible: true, locked: false, note: '' }));
}
const rectangle = loop([{ x: 0, z: 0 }, { x: 6000, z: 0 }, { x: 6000, z: 4000 }, { x: 0, z: 4000 }]);
describe('deriveFloor', () => {
  it('orders shuffled walls regardless of their directions', () => {
    const walls = [rectangle[2], { ...rectangle[0], start: rectangle[0].end, end: rectangle[0].start }, rectangle[3], rectangle[1]];
    const floor = deriveFloor(walls);
    expect(floor.polygons).toHaveLength(1);
    expect(floor.polygons[0]).toHaveLength(4);
    expect(floor.areaMm2).toBe(24_000_000);
    expect(floor.invalidComponents).toBe(0);
  });
  it('preserves a concave room without filling its missing corner', () => {
    const floor = deriveFloor(loop([{ x: 0, z: 0 }, { x: 6000, z: 0 }, { x: 6000, z: 2000 }, { x: 3000, z: 2000 }, { x: 3000, z: 4000 }, { x: 0, z: 4000 }]));
    expect(floor.polygons[0]).toHaveLength(6);
    expect(floor.areaMm2).toBe(18_000_000);
  });
  it('does not invent a floor for an open boundary', () => {
    expect(deriveFloor(rectangle.slice(0, 3))).toEqual({ polygons: [], surfaces: [], areaMm2: 0, invalidComponents: 1 });
  });
  it('does not bridge disconnected boundary segments', () => {
    const broken = rectangle.map(w => ({ ...w, end: { x: w.end.x + 1, z: w.end.z } }));
    expect(deriveFloor(broken).polygons).toEqual([]);
  });
  it('rejects a self-intersecting closed loop', () => {
    const bow = loop([{ x: 0, z: 0 }, { x: 4000, z: 4000 }, { x: 0, z: 4000 }, { x: 4000, z: 0 }]);
    expect(deriveFloor(bow).polygons).toEqual([]);
  });
  it('keeps a room floor while separate open partition walls are present', () => {
    const floor = deriveFloor([...rectangle, { ...rectangle[0], id: 'partition', start: { x: 1000, z: 1000 }, end: { x: 3000, z: 1000 } }]);
    expect(floor.areaMm2).toBe(24_000_000);
    expect(floor.invalidComponents).toBe(1);
  });
  it('renders separated closed rooms independently', () => {
    const second = rectangle.map(w => ({ ...w, id: `${w.id}-second`, start: { x: w.start.x + 10000, z: w.start.z }, end: { x: w.end.x + 10000, z: w.end.z } }));
    const floor = deriveFloor([...rectangle, ...second]);
    expect(floor.polygons).toHaveLength(2);
    expect(floor.areaMm2).toBe(48_000_000);
  });
  it('rejects crossings even when signed area is nonzero', () => {
    const crossing = loop([{ x: 0, z: 0 }, { x: 5000, z: 4000 }, { x: 0, z: 3000 }, { x: 4000, z: 0 }]);
    expect(deriveFloor(crossing).polygons).toEqual([]);
  });
  it('keeps floor when a boundary wall is hidden for viewing', () => {
    expect(deriveFloor(rectangle.map(w => ({ ...w, visible: false }))).areaMm2).toBe(24_000_000);
  });
  it('rejects a branching boundary and zero length edges', () => {
    expect(deriveFloor([...rectangle, { ...rectangle[0], id: 'branch', end: { x: 1000, z: 1000 } }]).polygons).toEqual([]);
    expect(deriveFloor([{ ...rectangle[0], end: rectangle[0].start }]).polygons).toEqual([]);
  });
});

describe('venue floor surfaces', () => {
  const box = (x: number, z: number, width: number, depth: number) => loop([{ x, z }, { x: x + width, z }, { x: x + width, z: z + depth }, { x, z: z + depth }]);
  it('ignores explicit partitions meeting a boundary vertex or edge', () => {
    const partitions = [
      { ...rectangle[0], role: 'partition' as const, start: { x: 0, z: 0 }, end: { x: 3000, z: 2000 } },
      { ...rectangle[0], role: 'partition' as const, start: { x: 3000, z: 0 }, end: { x: 3000, z: 4000 } },
    ];
    const floor = deriveFloor([...rectangle, ...partitions]);
    expect(floor.areaMm2).toBe(24_000_000);
    expect(floor.invalidComponents).toBe(0);
    expect(floor.surfaces).toHaveLength(1);
  });
  it('subtracts courtyards regardless of wall winding or ordering', () => {
    const courtyard = box(1000, 1000, 2000, 1000).map(w => ({ ...w, start: w.end, end: w.start })).reverse();
    const floor = deriveFloor([...courtyard, ...rectangle]);
    expect(floor.surfaces).toHaveLength(1);
    expect(floor.surfaces[0].holes).toHaveLength(1);
    expect(floor.polygons).toHaveLength(2);
    expect(floor.areaMm2).toBe(22_000_000);
  });
  it('keeps an island within a courtyard as another surface', () => {
    const floor = deriveFloor([...box(0, 0, 10000, 10000), ...box(1000, 1000, 8000, 8000), ...box(2000, 2000, 2000, 2000)]);
    expect(floor.surfaces).toHaveLength(2);
    expect(floor.surfaces.map(s => s.holes.length).sort()).toEqual([0, 1]);
    expect(floor.areaMm2).toBe(40_000_000);
  });
  it('rejects overlapping independent loops instead of overlapping floors', () => {
    const floor = deriveFloor([...rectangle, ...box(3000, 2000, 6000, 4000)]);
    expect(floor.surfaces).toEqual([]);
    expect(floor.areaMm2).toBe(0);
    expect(floor.invalidComponents).toBe(2);
  });
  it('rejects loops that touch an edge without a shared endpoint', () => {
    const floor = deriveFloor([...rectangle, ...box(1000, 0, 2000, 1000)]);
    expect(floor.surfaces).toEqual([]);
    expect(floor.invalidComponents).toBe(2);
  });
  it('keeps unrelated valid rooms when overlapping boundaries are rejected', () => {
    const floor = deriveFloor([...rectangle, ...box(3000, 2000, 6000, 4000), ...box(20000, 0, 1000, 1000)]);
    expect(floor.surfaces).toHaveLength(1);
    expect(floor.areaMm2).toBe(1_000_000);
  });
  it('does not cut a hole for a closed partition enclosure', () => {
    const partitions = box(1000, 1000, 2000, 1000).map(w => ({ ...w, role: 'partition' as const }));
    const floor = deriveFloor([...rectangle, ...partitions]);
    expect(floor.surfaces[0].holes).toHaveLength(0);
    expect(floor.areaMm2).toBe(24_000_000);
  });
  it('does not invent an island inside an ambiguous overlapping boundary', () => {
    const floor = deriveFloor([...rectangle, ...box(3000, 2000, 6000, 4000), ...box(500, 500, 500, 500)]);
    expect(floor.surfaces).toEqual([]);
    expect(floor.invalidComponents).toBe(3);
  });

});
