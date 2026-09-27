import type {MeasurementAnchor,Project,SavedDimension,WorldPoint} from './types';

function finitePoint(point:WorldPoint){return [point.x,point.y,point.z].every(Number.isFinite);}
export function fixedAnchor(point:WorldPoint):MeasurementAnchor{
 if(!finitePoint(point))throw new Error('치수 좌표가 올바르지 않습니다.');
 return {kind:'fixed',fallback:{...point}};
}

export function wallAnchor(project:Project,wallId:string,point:WorldPoint):MeasurementAnchor{
 if(!finitePoint(point))throw new Error('치수 좌표가 올바르지 않습니다.');
 const wall=project.walls.find(item=>item.id===wallId);
 if(!wall)throw new Error('치수 기준 벽을 찾을 수 없습니다.');
 const dx=wall.end.x-wall.start.x,dz=wall.end.z-wall.start.z,length=Math.hypot(dx,dz);
 const x=point.x-wall.start.x,z=point.z-wall.start.z;
 const t=Math.max(0,Math.min(1,(x*dx+z*dz)/(length*length)));
 const offsetMm=(-x*dz+z*dx)/length;
 return {kind:'wall',wallId,t,heightRatio:Math.max(0,Math.min(1,point.y/wall.heightMm)),offsetMm,fallback:{...point}};
}

export function resolveAnchor(project:Project,anchor:MeasurementAnchor):{point:WorldPoint;detached:boolean}{
 if(anchor.kind==='fixed')return {point:{...anchor.fallback},detached:false};
 const wall=project.walls.find(item=>item.id===anchor.wallId);
 if(!wall)return {point:{...anchor.fallback},detached:true};
 const dx=wall.end.x-wall.start.x,dz=wall.end.z-wall.start.z,length=Math.hypot(dx,dz);
 return {point:{x:wall.start.x+dx*anchor.t-dz/length*anchor.offsetMm,y:wall.heightMm*anchor.heightRatio,z:wall.start.z+dz*anchor.t+dx/length*anchor.offsetMm},detached:false};
}

export function measureDistance(a:WorldPoint,b:WorldPoint):number{
 return Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z);
}

export function resolveMeasurement(project:Project,dimension:SavedDimension){
 const start=resolveAnchor(project,dimension.start),end=resolveAnchor(project,dimension.end);
 return {start:start.point,end:end.point,distanceMm:measureDistance(start.point,end.point),detached:start.detached||end.detached};
}

export function addMeasurement(project:Project,view:SavedDimension['view'],start:MeasurementAnchor,end:MeasurementAnchor,elevationWallId?:string):Project{
 const first=resolveAnchor(project,start),last=resolveAnchor(project,end);
 if(measureDistance(first.point,last.point)<1)throw new Error('치수선 길이는 0보다 커야 합니다.');
 const used=new Set((project.dimensions??[]).map(item=>item.id));let number=1;while(used.has(`dimension-${number}`))number++;
 const dimension:SavedDimension={id:`dimension-${number}`,view,start,end,offsetMm:180,...(view==='elevation'&&elevationWallId?{elevationWallId}:{})};
 const next={...project,dimensions:[...(project.dimensions??[]),dimension]};
 validateDimensions(next.dimensions);
 return next;
}

export function validateDimensions(value:unknown):asserts value is SavedDimension[]{
 if(!Array.isArray(value)||value.length>500)throw new Error('치수선 목록이 올바르지 않습니다.');
 const ids=new Set<string>();
 for(const item of value){
  if(!item||typeof item!=='object'||typeof item.id!=='string'||item.id.length<1||item.id.length>100||ids.has(item.id)||!['plan','elevation','3d'].includes(item.view)||!Number.isFinite(item.offsetMm)||Math.abs(item.offsetMm)>1e6)throw new Error('치수선 정보가 올바르지 않습니다.');
  ids.add(item.id);
  if(item.elevationWallId!==undefined&&(typeof item.elevationWallId!=='string'||item.elevationWallId.length>100))throw new Error('치수선 벽 정보가 올바르지 않습니다.');
  for(const anchor of [item.start,item.end]){
   if(!anchor||!['fixed','wall'].includes(anchor.kind)||!anchor.fallback||!finitePoint(anchor.fallback))throw new Error('치수선 좌표가 올바르지 않습니다.');
   if(anchor.kind==='wall'&&(typeof anchor.wallId!=='string'||anchor.wallId.length<1||anchor.wallId.length>100||!Number.isFinite(anchor.t)||anchor.t<0||anchor.t>1||!Number.isFinite(anchor.heightRatio)||anchor.heightRatio<0||anchor.heightRatio>1||!Number.isFinite(anchor.offsetMm)))throw new Error('치수선 벽 좌표가 올바르지 않습니다.');
  }
 }
}
