import { describe, expect, it } from 'vitest';
import { Group } from 'three';
import type { Wall } from '../domain/types';
import { applyWallVisibility } from './wallVisibility3d';

function wall(id: string, overrides: Partial<Wall> = {}): Wall {
  return {
    id, name: id, start: { x: 0, z: 0 }, end: { x: 4000, z: 0 },
    heightMm: 3000, thicknessMm: 150, color: '#fff',
    visible: true, locked: false, note: '', ...overrides,
  };
}

describe('applyWallVisibility', () => {
  it('hides a boundary wall only when the camera moves behind its face', () => {
    const group = new Group();
    const groups = new Map([['a', group]]);
    const walls = [wall('a')];
    applyWallVisibility(walls, groups, { x: 0, z: -1 }, true);
    expect(group.visible).toBe(false);
    applyWallVisibility(walls, groups, { x: 0, z: 1 }, true);
    expect(group.visible).toBe(true);
  });

  it('keeps partitions visible with cutaway enabled while respecting a hidden wall', () => {
    const partition = new Group(), hidden = new Group();
    applyWallVisibility(
      [wall('partition', { role: 'partition' }), wall('hidden', { visible: false })],
      new Map([['partition', partition], ['hidden', hidden]]),
      { x: 0, z: -1 }, true,
    );
    expect(partition.visible).toBe(true);
    expect(hidden.visible).toBe(false);
  });

  it('shows a visible boundary regardless of camera side when cutaway is off', () => {
    const group = new Group();
    applyWallVisibility([wall('a')], new Map([['a', group]]), { x: 0, z: -1 }, false);
    expect(group.visible).toBe(true);
  });
});
