export interface Segment {start:{x:number;y:number};end:{x:number;y:number}}
export interface TruthSegment extends Segment {id:string;description:string}
/** Coverage is the union of supported intervals, not a count of candidate lines.
 * Offset is measured in source pixels; this is not physical dimensional accuracy. */
export function scorePlanSegments(truth:TruthSegment[],candidates:Segment[],tolerancePx:number){
 return truth.map(target=>{
  const dx=target.end.x-target.start.x,dy=target.end.y-target.start.y,length=Math.hypot(dx,dy);
  if(!length||!Number.isFinite(tolerancePx)||tolerancePx<0)throw new Error('Invalid segment benchmark');
  const intervals:{from:number;to:number}[]=[];
  for(const line of candidates){
   const lx=line.end.x-line.start.x,ly=line.end.y-line.start.y,ll=Math.hypot(lx,ly);
   if(!ll||Math.abs(dx*lx+dy*ly)/(length*ll)<.995)continue;
   const points=[line.start,line.end].map(p=>({along:((p.x-target.start.x)*dx+(p.y-target.start.y)*dy)/length,across:Math.abs((p.x-target.start.x)*dy-(p.y-target.start.y)*dx)/length}));
   if(points.some(p=>p.across>tolerancePx))continue;
   const from=Math.max(0,Math.min(...points.map(p=>p.along))),to=Math.min(length,Math.max(...points.map(p=>p.along)));
   if(to>from)intervals.push({from,to});
  }
  intervals.sort((a,b)=>a.from-b.from);
  let covered=0,end=0;
  for(const interval of intervals){covered+=Math.max(0,interval.to-Math.max(end,interval.from));end=Math.max(end,interval.to);}
  const coverage=covered/length;
  return {id:target.id,description:target.description,lengthPx:length,coveredPx:covered,coverage,matched:coverage>=.95};
 });
}
