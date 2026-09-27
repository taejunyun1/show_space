import type {Project,Point} from './types';

export type WallTransform = {kind:'move';dx:number;dz:number}|{kind:'rotate';radians:number};

/** A wall moves independently; attached artwork follows through its wall-relative coordinates. */
export function transformWall(project:Project,id:string,transform:WallTransform):Project{
 return transformWalls(project,[id],transform);
}

/** All selected walls share one pivot, preserving their joints and attached artwork. */
export function transformWalls(project:Project,ids:string[],transform:WallTransform):Project{
 const selected=new Set(ids);
 if(!selected.size)throw new Error('이동할 벽을 선택해 주세요.');
 const walls=project.walls.filter(w=>selected.has(w.id));
 if(walls.length!==selected.size)throw new Error('벽을 찾을 수 없습니다.');
 if(walls.some(w=>w.locked))throw new Error('잠긴 벽은 이동하거나 회전할 수 없습니다.');
 const values=transform.kind==='move'?[transform.dx,transform.dz]:[transform.radians];
 if(!values.every(Number.isFinite))throw new Error('이동 거리 또는 각도가 올바르지 않습니다.');
 const points=walls.flatMap(w=>[w.start,w.end]);
 const midpoint:Point={x:(Math.min(...points.map(p=>p.x))+Math.max(...points.map(p=>p.x)))/2,z:(Math.min(...points.map(p=>p.z))+Math.max(...points.map(p=>p.z)))/2};
 function apply(p:Point):Point{
  if(transform.kind==='move')return {x:p.x+transform.dx,z:p.z+transform.dz};
  const x=p.x-midpoint.x,z=p.z-midpoint.z,c=Math.cos(transform.radians),s=Math.sin(transform.radians);
  return {x:midpoint.x+x*c-z*s,z:midpoint.z+x*s+z*c};
 }
 return {...project,walls:project.walls.map(w=>selected.has(w.id)?{...w,start:apply(w.start),end:apply(w.end)}:w)};
}
