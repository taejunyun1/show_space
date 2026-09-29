import type { Group, Object3D } from 'three';
import type { Wall } from '../domain/types';

export function applyWallVisibility(walls: readonly Wall[], groups: ReadonlyMap<string, Group>, camera: { x: number; z: number }, cutaway: boolean): void {
  for (const wall of walls) {
    const group = groups.get(wall.id);
    if (!group) continue;
    const dx = wall.end.x - wall.start.x;
    const dz = wall.end.z - wall.start.z;
    const midX = (wall.start.x + wall.end.x) / 2000;
    const midZ = (wall.start.z + wall.end.z) / 2000;
    group.visible = wall.visible && (!cutaway || wall.role === 'partition' || -dz * (camera.x - midX) + dx * (camera.z - midZ) > 0);
  }
}

export function isObjectVisible(object:Object3D):boolean {
  for(let node:Object3D|null=object;node;node=node.parent)if(!node.visible)return false;
  return true;
}
