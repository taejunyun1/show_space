import type {Opening,OpeningAnchor,Project,Wall} from './types';
import {deriveFloor} from './floor';
export function openingAnchorPoint(anchor:OpeningAnchor,walls:Wall[]){
 return anchor.point??walls.find(w=>w.id===anchor.wallId)?.[anchor.endpoint!];
}
/** Openings connect floor boundaries only; they are never installation surfaces. */
export function openingSegments(project:Pick<Project,'walls'|'openings'>){
 return (project.openings??[]).flatMap(opening=>{
  const start=openingAnchorPoint(opening.start,project.walls),end=openingAnchorPoint(opening.end,project.walls);
  return start&&end?[{...opening,start,end}]:[];
 });
}
export function floorWithOpenings(project:Pick<Project,'walls'|'openings'>){
 const virtual:Wall[]=openingSegments(project).map(o=>({id:`floor-opening:${o.id}`,name:'개구부 경계',start:o.start,end:o.end,role:o.role,heightMm:1,thicknessMm:1,color:'#000',note:'',visible:false,locked:true}));
 return deriveFloor([...project.walls,...virtual]);
}
export function validateOpenings(value:unknown,walls:Wall[]):asserts value is Opening[]{
 if(!Array.isArray(value)||value.length>100)throw new Error('개구부 목록이 올바르지 않습니다.');
 const ids=new Set(walls.map(w=>w.id));
 for(const o of value){
  if(!o||typeof o.id!=='string'||!o.id||o.id.length>200||ids.has(o.id)||!['door','window','stair-access'].includes(o.kind)||!['boundary','partition'].includes(o.role)||typeof o.note!=='string'||o.note.length>2000)throw new Error('개구부 정보가 올바르지 않습니다.');ids.add(o.id);
  for(const ref of [o.start,o.end]){
   if(!ref)throw new Error('개구부 벽 연결이 올바르지 않습니다.');
   if(ref.point!==undefined){
    if(ref.wallId!==undefined||ref.endpoint!==undefined||!ref.point||!Number.isFinite(ref.point.x)||!Number.isFinite(ref.point.z)||Math.max(Math.abs(ref.point.x),Math.abs(ref.point.z))>1e7)throw new Error('개구부 접점이 올바르지 않습니다.');
   }else if(!['start','end'].includes(ref.endpoint)||!walls.some(w=>w.id===ref.wallId))throw new Error('개구부 벽 연결이 올바르지 않습니다.');
  }
  const a=openingAnchorPoint(o.start,walls)!,b=openingAnchorPoint(o.end,walls)!;
  if(Math.hypot(a.x-b.x,a.z-b.z)<1)throw new Error('개구부 길이는 0보다 커야 합니다.');
 }
 const openings=value as Opening[],key=(p:{x:number;z:number})=>`${p.x},${p.z}`;
 const junctions=new Map<string,Opening[]>();
 for(const o of openings)for(const ref of [o.start,o.end])if(ref.point){const k=key(ref.point);junctions.set(k,[...(junctions.get(k)??[]),o]);}
 for(const group of junctions.values())if(group.length!==2||group[0].id===group[1].id)throw new Error('개구부 접점은 두 개구부를 연결해야 합니다.');
 const reached=new Set(openings.filter(o=>o.start.wallId!==undefined||o.end.wallId!==undefined).map(o=>o.id));
 for(let i=0;i<openings.length;i++)for(const group of junctions.values())if(group.some(o=>reached.has(o.id)))for(const o of group)reached.add(o.id);
 if(reached.size!==openings.length)throw new Error('개구부 연결은 벽에 연결되어야 합니다.');
}
