import type {Point,Wall} from './types';
import {deriveFloor} from './floor';
const key=(p:Point)=>`${p.x},${p.z}`;
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
 const core=new Set(input.map((_,i)=>i));
 let changed=true;
 while(changed){
  changed=false;
  const degree=new Map<string,number>();
  for(const i of core)for(const p of [input[i].start,input[i].end])degree.set(key(p),(degree.get(key(p))??0)+1);
  for(const i of core)if([input[i].start,input[i].end].some(p=>degree.get(key(p))===1)){core.delete(i);changed=true;}
 }
 const boundaries=input.filter((_,i)=>core.has(i));
 const floor=deriveFloor(boundaries);
 if(!floor.surfaces.length||floor.invalidComponents)return undefined;
 if(input.some((w,i)=>!core.has(i)&&!contained(w,floor.surfaces)))return undefined;
 return input.map((w,i)=>({...w,role:core.has(i)?'boundary':'partition'}));
}
