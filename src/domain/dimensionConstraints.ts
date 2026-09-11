import type {AxisEquality} from './openingAxisEvidence';
import type {Wall} from './types';
import type {MeasuredSpan} from './dimensionSpans';

export interface WallDimensionConstraint {wallId:string;labelId:string;mm:number;horizontal:boolean;from?:number;to?:number}
interface Coordinate {pixel:number;component:number;mm:number}
/** Relative coordinates only: each disconnected component has its own origin.
 * Never interpolate unmeasured gaps or apply these coordinates to a scalar image reference. */
export function solveDimensionConstraints(walls:Wall[], constraints:WallDimensionConstraint[], spans:MeasuredSpan[]=[],equalities:AxisEquality[]=[]) {
 const rejected:string[]=[];
 const axes=(['x','z'] as const).map(axis=>{
  const round=(n:number)=>Math.round(n*1e6)/1e6;
  const aliases=new Map<number,number>();
  const key=(n:number):number=>{const p=round(n);return aliases.has(p)?key(aliases.get(p)!):p;};
  const appliedEqualities:AxisEquality[]=[];
  for(const e of equalities.filter(e=>e.axis===axis)){
   if(![e.from,e.to].every(Number.isFinite)||Math.abs(e.from-e.to)>2){rejected.push(e.sourceId);continue;}
   const a=key(e.from),b=key(e.to);if(a===b)continue;
   // Prevent a chain of small adjustments from joining axes farther than 2 px.
   const members=[...aliases.keys(),a,b,e.from,e.to].filter(p=>key(p)===a||key(p)===b);
   if(Math.max(...members)-Math.min(...members)>2){rejected.push(e.sourceId);continue;}
   aliases.set(Math.max(a,b),Math.min(a,b));appliedEqualities.push(e);
  }
  const validSpans=spans.filter(s=>s.horizontal===(axis==='x')).filter(s=>{
   const valid=[s.from,s.to,s.mm].every(Number.isFinite)&&s.to>s.from&&s.mm>0;
   if(!valid)rejected.push(s.labelId);return valid;
  });
  const intervals=constraints.filter(c=>c.horizontal===(axis==='x')&&Number.isFinite(c.from)&&Number.isFinite(c.to));
  const pixels=[...new Set([...intervals.flatMap(c=>[key(c.from!),key(c.to!)]),...walls.flatMap(w=>[key(w.start[axis]),key(w.end[axis])]),...validSpans.flatMap(s=>[key(s.from),key(s.to)])])].sort((a,b)=>a-b);
  const edges=new Map<number,{to:number;delta:number;labelId:string}[]>(pixels.map(p=>[p,[]]));
  for(const c of constraints.filter(c=>c.horizontal===(axis==='x'))){
   const w=walls.find(w=>w.id===c.wallId),cross=axis==='x'?'z':'x';
   if(!w||!Number.isFinite(c.mm)||c.mm<=0||Math.abs(w.start[cross]-w.end[cross])>1e-6||key(w.start[axis])===key(w.end[axis])){rejected.push(c.labelId);continue;}
   const low=Math.min(key(w.start[axis]),key(w.end[axis])),high=Math.max(key(w.start[axis]),key(w.end[axis]));
   const a=key(c.from??low),b=key(c.to??high);
   if(!Number.isFinite(a)||!Number.isFinite(b)||a<low||b>high||a>=b){rejected.push(c.labelId);continue;}
   edges.get(a)!.push({to:b,delta:c.mm,labelId:c.labelId});
   edges.get(b)!.push({to:a,delta:-c.mm,labelId:c.labelId});
  }
  for(const span of validSpans){
   const a=key(span.from),b=key(span.to);
   if(a===b){rejected.push(span.labelId);continue;}
   edges.get(a)!.push({to:b,delta:span.mm,labelId:span.labelId});
   edges.get(b)!.push({to:a,delta:-span.mm,labelId:span.labelId});
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
   appliedEqualities,components,unresolvedOffsets:Math.max(0,components-1),coordinates:nodes,conflicts,reversed};
 });
 return {status:rejected.length||axes.some(a=>a.status==='conflict')?'conflict' as const:axes.every(a=>a.status==='determined')?'determined' as const:'underdetermined' as const,axes,rejected};
}
