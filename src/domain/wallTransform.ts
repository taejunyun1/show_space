import type {Project,Point} from './types';

export type WallTransform = {kind:'move';dx:number;dz:number}|{kind:'rotate';radians:number};

/** Snap a whole-wall drag to a free endpoint, then fall back to 100 mm steps. */
export function snapWallTranslation(project:Project,ids:string[],offset:Point,linkedCorners:boolean,toleranceMm=120):Point{
 if(![offset.x,offset.z,toleranceMm].every(Number.isFinite)||toleranceMm<0)throw new Error('벽 스냅 좌표가 올바르지 않습니다.');
 const selected=new Set(ids);
 const moving=project.walls.filter(w=>selected.has(w.id)).flatMap(w=>[w.start,w.end]);
 if(!moving.length)throw new Error('이동할 벽을 찾을 수 없습니다.');
 const shared=new Set(moving.map(point=>`${point.x},${point.z}`));
 let nearest:{offset:Point;distance:number}|null=null;
 for(const wall of project.walls){
  if(selected.has(wall.id))continue;
  for(const target of [wall.start,wall.end]){
   if(linkedCorners&&shared.has(`${target.x},${target.z}`))continue;
   for(const source of moving){
    const distance=Math.hypot(source.x+offset.x-target.x,source.z+offset.z-target.z);
    if(distance<=toleranceMm&&(!nearest||distance<nearest.distance))nearest={offset:{x:target.x-source.x,z:target.z-source.z},distance};
   }
  }
 }
 return nearest?.offset??{x:Math.round(offset.x/100)*100,z:Math.round(offset.z/100)*100};
}

/** A wall moves independently; attached artwork follows through its wall-relative coordinates. */
export function transformWall(project:Project,id:string,transform:WallTransform):Project{
 return transformWalls(project,[id],transform);
}

/** All selected walls share one pivot, preserving their joints and attached artwork. */
export function transformWalls(project:Project,ids:string[],transform:WallTransform,linkedCorners=false):Project{
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
 const linked=new Map<string,Point>();
 if(linkedCorners)for(const wall of walls)for(const point of [wall.start,wall.end])linked.set(`${point.x},${point.z}`,apply(point));
 const nextWalls=project.walls.map(w=>{
  if(selected.has(w.id))return {...w,start:apply(w.start),end:apply(w.end)};
  const start=linked.get(`${w.start.x},${w.start.z}`),end=linked.get(`${w.end.x},${w.end.z}`);
  if(!start&&!end)return w;
  if(w.locked)throw new Error('연결된 잠긴 벽은 함께 수정할 수 없습니다.');
  return {...w,start:start??w.start,end:end??w.end};
 });
 return {...project,walls:nextWalls};
}
