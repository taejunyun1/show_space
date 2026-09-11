import type {Opening,Project,Wall} from './types';
import {deriveFloor} from './floor';
/** Openings connect floor boundaries only; they are never installation surfaces. */
export function openingSegments(project:Pick<Project,'walls'|'openings'>){
 return (project.openings??[]).flatMap(opening=>{
  const a=project.walls.find(w=>w.id===opening.start.wallId),b=project.walls.find(w=>w.id===opening.end.wallId);
  if(!a||!b)return [];
  return [{...opening,start:a[opening.start.endpoint],end:b[opening.end.endpoint]}];
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
  if(!o||typeof o.id!=='string'||!o.id||o.id.length>200||ids.has(o.id)||!['door','window'].includes(o.kind)||!['boundary','partition'].includes(o.role)||typeof o.note!=='string'||o.note.length>2000)throw new Error('개구부 정보가 올바르지 않습니다.');ids.add(o.id);
  for(const ref of [o.start,o.end])if(!ref||!['start','end'].includes(ref.endpoint)||!walls.some(w=>w.id===ref.wallId))throw new Error('개구부 벽 연결이 올바르지 않습니다.');
  const a=walls.find(w=>w.id===o.start.wallId)![o.start.endpoint as 'start'|'end'],b=walls.find(w=>w.id===o.end.wallId)![o.end.endpoint as 'start'|'end'];
  if(Math.hypot(a.x-b.x,a.z-b.z)<1)throw new Error('개구부 길이는 0보다 커야 합니다.');
 }
}
