import type {Project,Point} from './types';

export type WallTransform = {kind:'move';dx:number;dz:number}|{kind:'rotate';radians:number};

/** A wall moves independently; attached artwork follows through its wall-relative coordinates. */
export function transformWall(project:Project,id:string,transform:WallTransform):Project{
 const wall=project.walls.find(w=>w.id===id);
 if(!wall)throw new Error('벽을 찾을 수 없습니다.');
 if(wall.locked)throw new Error('잠긴 벽은 이동하거나 회전할 수 없습니다.');
 const values=transform.kind==='move'?[transform.dx,transform.dz]:[transform.radians];
 if(!values.every(Number.isFinite))throw new Error('이동 거리 또는 각도가 올바르지 않습니다.');
 const midpoint:Point={x:(wall.start.x+wall.end.x)/2,z:(wall.start.z+wall.end.z)/2};
 function apply(p:Point):Point{
  if(transform.kind==='move')return {x:p.x+transform.dx,z:p.z+transform.dz};
  const x=p.x-midpoint.x,z=p.z-midpoint.z,c=Math.cos(transform.radians),s=Math.sin(transform.radians);
  return {x:midpoint.x+x*c-z*s,z:midpoint.z+x*s+z*c};
 }
 return {...project,walls:project.walls.map(w=>w.id===id?{...w,start:apply(w.start),end:apply(w.end)}:w)};
}
