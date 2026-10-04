import {addWall,parseProject,updateWall} from './model';
import type {Point,Project,Wall} from './types';

export type SnapKind='endpoint'|'axis'|'grid';

/** Keep the picked direction; an explicit length must never be re-snapped. */
export function wallEndAtLength(start:Point,direction:Point,length:number):Point{
 if(![start.x,start.z,direction.x,direction.z].every(Number.isFinite))throw new Error('벽 좌표가 올바르지 않습니다.');
 if(!Number.isFinite(length)||length<1)throw new Error('벽 길이는 1 이상인 숫자를 입력하세요.');
 const dx=direction.x-start.x,dz=direction.z-start.z,distance=Math.hypot(dx,dz);
 if(!Number.isFinite(distance)||distance<1)throw new Error('두 번째 점을 다른 위치에서 선택해 주세요.');
 const end={x:start.x+dx/distance*length,z:start.z+dz/distance*length};
 if(![end.x,end.z].every(Number.isFinite))throw new Error('벽 좌표가 올바르지 않습니다.');
 return end;
}

export function addWallBetween(project:Project,start:Point,end:Point):Project{
 if(![start.x,start.z,end.x,end.z].every(Number.isFinite))throw new Error('벽 좌표가 올바르지 않습니다.');
 if(Math.hypot(end.x-start.x,end.z-start.z)<1)throw new Error('벽 길이는 0보다 커야 합니다.');
 const next=addWall(project);
 const walls=next.walls.map((wall,index)=>index===next.walls.length-1?{...wall,start:{...start},end:{...end}}:wall);
 return parseProject({...next,walls});
}

export function updateWallEndpoint(project:Project,id:string,endpoint:'start'|'end',point:Point,connected:boolean):Project{
 if(connected)return updateWall(project,id,{[endpoint]:point});
 const wall=project.walls.find(item=>item.id===id);
 if(!wall)throw new Error('벽을 찾을 수 없습니다.');
 if(wall.locked)throw new Error('잠긴 벽은 변경할 수 없습니다.');
 return parseProject({...project,walls:project.walls.map(item=>item.id===id?{...item,[endpoint]:{...point}}:item)});
}

/** Snap distance is supplied in model millimetres from a screen-space radius. */
export function snapPlanPoint(raw:Point,walls:Wall[],anchor?:Point,toleranceMm=100):{point:Point;kind:SnapKind}{
 if(![raw.x,raw.z,toleranceMm].every(Number.isFinite)||toleranceMm<0)throw new Error('스냅 좌표가 올바르지 않습니다.');
 let closest:Point|undefined,minimum=toleranceMm;
 for(const wall of walls)for(const point of [wall.start,wall.end]){
  const distance=Math.hypot(raw.x-point.x,raw.z-point.z);
  if(distance<=minimum){minimum=distance;closest=point;}
 }
 if(closest)return {point:{...closest},kind:'endpoint'};
 if(anchor){
  const x=Math.abs(raw.x-anchor.x)<=toleranceMm?anchor.x:Math.round(raw.x/100)*100;
  const z=Math.abs(raw.z-anchor.z)<=toleranceMm?anchor.z:Math.round(raw.z/100)*100;
  if(x===anchor.x||z===anchor.z)return {point:{x,z},kind:'axis'};
 }
 return {point:{x:Math.round(raw.x/100)*100,z:Math.round(raw.z/100)*100},kind:'grid'};
}
