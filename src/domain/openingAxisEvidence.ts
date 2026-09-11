import type {Wall} from './types';
export interface AxisEquality {axis:'x'|'z';from:number;to:number;sourceId:string}
/** Opposing parallel jamb walls identify a common axis across an already detected opening.
 * Nearness alone, corner doors and diagonal walls are not equality evidence. */
export function openingAxisEvidence(walls:Wall[],openings:{wall:Wall}[]):AxisEquality[]{
 const result:AxisEquality[]=[];
 for(const {wall:gap} of openings)for(const axis of ['x','z'] as const){
  const along=axis==='x'?'z':'x',a=gap.start,b=gap.end;
  if(Math.abs(a[axis]-b[axis])>2||Math.abs(a[along]-b[along])<30)continue;
  const ends=[a,b].map(p=>walls.filter(w=>Math.abs(w.start[axis]-w.end[axis])<1e-6&&Math.abs(w.start[along]-w.end[along])>=30&&[w.start,w.end].some(q=>Math.hypot(p.x-q.x,p.z-q.z)<1e-6)));
  if(ends.some(ws=>ws.length!==1)||ends[0][0].id===ends[1][0].id)continue;
  const other=(w:Wall,p:typeof a)=>Math.hypot(w.start.x-p.x,w.start.z-p.z)<1e-6?w.end:w.start;
  if((other(ends[0][0],a)[along]-a[along])*(b[along]-a[along])>=0||(other(ends[1][0],b)[along]-b[along])*(a[along]-b[along])>=0)continue;
  if(Math.abs(a[axis]-b[axis])>1e-6)result.push({axis,from:a[axis],to:b[axis],sourceId:gap.id});
 }
 return result;
}
