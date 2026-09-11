import type {WallCandidate} from './wallCandidates';
/** Resolve a subpixel-offset thin trace overlapping a thick stripe. Preserve
 * the thick extent and thin tails; never promote the full thin trace to a wall. */
export function separateCoincidentStrokes(input:WallCandidate[]):WallCandidate[]{
 const proposals:{thin:number;thick:number;horizontal:boolean;cross:number;lo:number;hi:number}[]=[];
 for(let i=0;i<input.length;i++)for(let j=0;j<input.length;j++){
  const a=input[i],b=input[j];if(a.thicknessPx>=3||b.thicknessPx<3)continue;
  const horizontal=Math.abs(a.start.y-a.end.y)<.01,along=(p:typeof a.start)=>horizontal?p.x:p.y,across=(p:typeof a.start)=>horizontal?p.y:p.x;
  if(Math.abs(across(a.start)-across(a.end))>.01||Math.abs(across(b.start)-across(b.end))>.01||Math.abs(across(a.start)-across(b.start))>1)continue;
  const a0=Math.min(along(a.start),along(a.end)),a1=Math.max(along(a.start),along(a.end)),b0=Math.min(along(b.start),along(b.end)),b1=Math.max(along(b.start),along(b.end));
  const lo=Math.max(a0,b0),hi=Math.min(a1,b1);
  if(hi-lo<30||(lo-a0<10&&a1-hi<10))continue;
  proposals.push({thin:i,thick:j,horizontal,cross:across(a.start),lo,hi});
 }
 const accepted=proposals.filter(p=>proposals.filter(q=>q.thin===p.thin||q.thick===p.thick).length===1);
 const result=input.map(l=>({...l,start:{...l.start},end:{...l.end}}));
 const tails=new Map<number,WallCandidate[]>();
 for(const p of accepted){
  const a=result[p.thin],b=result[p.thick],along=(q:typeof a.start)=>p.horizontal?q.x:q.y,point=(t:number)=>p.horizontal?{x:t,y:p.cross}:{x:p.cross,y:t};
  if(p.horizontal)b.start.y=b.end.y=p.cross;else b.start.x=b.end.x=p.cross;
  const lo=Math.min(along(a.start),along(a.end)),hi=Math.max(along(a.start),along(a.end));
  tails.set(p.thin,[[lo,p.lo],[p.hi,hi]].flatMap(([from,to],i)=>to-from>=1?[{...a,id:`${a.id}:tail-${i}`,start:point(from),end:point(to)}]:[]));
 }
 return result.flatMap((l,i)=>tails.get(i)??[l]);
}
