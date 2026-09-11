import type {Opening,OpeningAnchor,Point,Wall} from './types';
/** Prefer moving wall endpoints. Only a shared, observed opening endpoint may be fixed. */
export function anchorOpeningPoint(point:Point,walls:Wall[],gaps:{wall:Wall}[],scale=1):OpeningAnchor|undefined{
 for(const wall of walls)for(const endpoint of ['start','end'] as const)if(Math.hypot(wall[endpoint].x-point.x,wall[endpoint].z-point.z)<.001)return {wallId:wall.id,endpoint};
 const touching=gaps.filter(g=>[g.wall.start,g.wall.end].some(p=>p.x===point.x&&p.z===point.z));
 return touching.length===2?{point:{x:point.x*scale,z:point.z*scale}}:undefined;
}
/** Removing one anchor also removes its now-dangling chain of adjacent openings. */
export function removeWallOpenings(openings:Opening[]|undefined,wallId:string){
 if(!openings)return undefined;
 let kept=openings.filter(o=>o.start.wallId!==wallId&&o.end.wallId!==wallId);
 for(let i=0;i<openings.length;i++){
  const next=kept.filter(o=>[o.start,o.end].every(ref=>!ref.point||kept.some(other=>other.id!==o.id&&[other.start,other.end].some(r=>r.point?.x===ref.point!.x&&r.point?.z===ref.point!.z))));
  if(next.length===kept.length)return kept;kept=next;
 }
 return kept;
}
