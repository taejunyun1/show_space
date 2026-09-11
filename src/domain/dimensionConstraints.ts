import type {Wall} from './types';

export interface WallDimensionConstraint {wallId:string;labelId:string;mm:number;horizontal:boolean}
interface Coordinate {pixel:number;component:number;mm:number}
/** Relative coordinates only: each disconnected component has its own origin.
 * Never interpolate unmeasured gaps or apply these coordinates to a scalar image reference. */
export function solveDimensionConstraints(walls:Wall[], constraints:WallDimensionConstraint[]) {
 const rejected:string[]=[];
 const axes=(['x','z'] as const).map(axis=>{
  const key=(n:number)=>Math.round(n*1e6)/1e6;
  const pixels=[...new Set(walls.flatMap(w=>[key(w.start[axis]),key(w.end[axis])]))].sort((a,b)=>a-b);
  const edges=new Map<number,{to:number;delta:number;labelId:string}[]>(pixels.map(p=>[p,[]]));
  for(const c of constraints.filter(c=>c.horizontal===(axis==='x'))){
   const w=walls.find(w=>w.id===c.wallId),cross=axis==='x'?'z':'x';
   if(!w||!Number.isFinite(c.mm)||c.mm<=0||Math.abs(w.start[cross]-w.end[cross])>1e-6||key(w.start[axis])===key(w.end[axis])){rejected.push(c.labelId);continue;}
   const a=Math.min(key(w.start[axis]),key(w.end[axis])),b=Math.max(key(w.start[axis]),key(w.end[axis]));
   edges.get(a)!.push({to:b,delta:c.mm,labelId:c.labelId});
   edges.get(b)!.push({to:a,delta:-c.mm,labelId:c.labelId});
  }
  const coordinates=new Map<number,Coordinate>();
  const conflicts:{labelId:string;residualMm:number}[]=[];
  const conflictLabels=new Set<string>();
  let components=0;
  for(const pixel of pixels){
   if(coordinates.has(pixel))continue;
   const component=components++;
   coordinates.set(pixel,{pixel,component,mm:0});
   const queue=[pixel];
   for(let i=0;i<queue.length;i++){
    const from=coordinates.get(queue[i])!;
    for(const edge of edges.get(from.pixel)!){
     const expected=from.mm+edge.delta,existing=coordinates.get(edge.to);
     if(!existing){coordinates.set(edge.to,{pixel:edge.to,component,mm:expected});queue.push(edge.to);}
     else if(Math.abs(existing.mm-expected)>.001&&!conflictLabels.has(edge.labelId)){
      conflicts.push({labelId:edge.labelId,residualMm:Math.abs(existing.mm-expected)});conflictLabels.add(edge.labelId);
     }
    }
   }
  }
  const nodes=pixels.map(p=>coordinates.get(p)!);
  // A consistent equation graph can still reverse physical coordinate order.
  const reversed=nodes.some((n,i)=>nodes.slice(i+1).some(m=>m.component===n.component&&m.mm<=n.mm));
  return {axis,status:conflicts.length||reversed?'conflict' as const:components===1?'determined' as const:'underdetermined' as const,
   components,unresolvedOffsets:Math.max(0,components-1),coordinates:nodes,conflicts,reversed};
 });
 return {status:rejected.length||axes.some(a=>a.status==='conflict')?'conflict' as const:axes.every(a=>a.status==='determined')?'determined' as const:'underdetermined' as const,axes,rejected};
}
