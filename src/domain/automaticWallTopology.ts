import {splitWallJunctions,peelOpenBranches,exteriorWallEdges} from './planarWalls';
import type {Point,Wall} from './types';
import {deriveFloor} from './floor';
const cross=(a:Point,b:Point)=>a.x*b.z-a.z*b.x;
const sub=(a:Point,b:Point):Point=>({x:a.x-b.x,z:a.z-b.z});
function inside(p:Point,loop:Point[]):boolean{
 let result=false;
 for(let i=0,j=loop.length-1;i<loop.length;j=i++){
  const a=loop[j],b=loop[i];
  if(Math.abs(cross(sub(b,a),sub(p,a)))<1e-6&&p.x>=Math.min(a.x,b.x)&&p.x<=Math.max(a.x,b.x)&&p.z>=Math.min(a.z,b.z)&&p.z<=Math.max(a.z,b.z))return true;
  if((a.z>p.z)!==(b.z>p.z)&&p.x<(b.x-a.x)*(p.z-a.z)/(b.z-a.z)+a.x)result=!result;
 }
 return result;
}
/** Check every interval cut by a boundary, including concave outlines and holes. */
function contained(wall:Wall,surfaces:ReturnType<typeof deriveFloor>['surfaces']):boolean{
 const direction=sub(wall.end,wall.start),cuts=[0,1];
 for(const surface of surfaces)for(const loop of [surface.outer,...surface.holes])for(let i=0;i<loop.length;i++){
  const a=loop[i],edge=sub(loop[(i+1)%loop.length],a),den=cross(direction,edge);
  if(Math.abs(den)<1e-8)continue;
  const delta=sub(a,wall.start),t=cross(delta,edge)/den,u=cross(delta,direction)/den;
  if(t>0&&t<1&&u>=0&&u<=1)cuts.push(t);
 }
 cuts.sort((a,b)=>a-b);
 return cuts.slice(1).every((end,i)=>{
  const t=(cuts[i]+end)/2,p={x:wall.start.x+direction.x*t,z:wall.start.z+direction.z*t};
  return surfaces.some(s=>inside(p,s.outer)&&!s.holes.some(h=>inside(p,h)));
 });
}
/** Peel open branches, retain verified loops, and classify only contained branches as partitions. */
export function classifyAutomaticWalls(input:Wall[]):Wall[]|undefined{
 // Preserve established outlines as a guard against external branches crossing concave bays or courtyards.
 const initialCore=peelOpenBranches(input),initialFloor=deriveFloor(input.filter((_,i)=>initialCore.has(i)));
 if(initialFloor.surfaces.length&&!initialFloor.invalidComponents&&input.some((w,i)=>!initialCore.has(i)&&!contained(w,initialFloor.surfaces)))return undefined;
 const split=splitWallJunctions(input);if(!split)return undefined;
 const boundary=exteriorWallEdges(split);if(!boundary)return undefined;
 const floor=deriveFloor(split.filter((_,i)=>boundary.has(i)));
 if(!floor.surfaces.length||floor.invalidComponents)return undefined;
 if(split.some((w,i)=>!boundary.has(i)&&!contained(w,floor.surfaces)))return undefined;
 return split.map((w,i)=>({...w,role:boundary.has(i)?'boundary':'partition'}));
}
