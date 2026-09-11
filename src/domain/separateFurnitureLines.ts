import type {PlanLabel} from './planLabels';
import type {WallCandidate} from './wallCandidates';
import {detectFurnitureOutlines} from './furnitureOutlines';

/** A furniture edge can merge with ink across an adjoining thick wall. Cut
 * only a terminal furniture portion with independent perpendicular support;
 * a wall continuing on both sides of the furniture remains intact. */
export function separateFurnitureLines(labels:PlanLabel[],lines:WallCandidate[]):WallCandidate[]{
 const furniture=detectFurnitureOutlines(labels,lines),removed=new Set(furniture.flatMap(f=>f.lineIds));
 return lines.filter(l=>!removed.has(l.id)).map(line=>{
  const horizontal=Math.abs(line.start.y-line.end.y)<1,vertical=Math.abs(line.start.x-line.end.x)<1;
  if((!horizontal&&!vertical)||line.thicknessPx>4)return line;
  const axis=horizontal?'x':'y',cross=horizontal?'y':'x';
  const start=Math.min(line.start[axis],line.end[axis]),end=Math.max(line.start[axis],line.end[axis]),at=line.start[cross];
  const proposals:{from:number;to:number}[]=[];
  for(const f of furniture){
   const low=horizontal?f.box.x:f.box.y,high=low+(horizontal?f.box.width:f.box.height);
   const crossLow=horizontal?f.box.y:f.box.x,crossHigh=crossLow+(horizontal?f.box.height:f.box.width);
   if(Math.min(Math.abs(at-crossLow),Math.abs(at-crossHigh))>4)continue;
   const before=start<low-4&&Math.abs(end-high)<=4,after=end>high+4&&Math.abs(start-low)<=4;
   if(!before&&!after)continue;
   const cut=before?low:high;
   const supports=lines.filter(w=>{
    if(w.id===line.id||removed.has(w.id)||w.thicknessPx<Math.max(6,line.thicknessPx*3)||Math.abs(w.start[axis]-w.end[axis])>=1)return false;
    const a=Math.min(w.start[cross],w.end[cross]),b=Math.max(w.start[cross],w.end[cross]);
    return at>=a-2&&at<=b+2&&(a<crossLow-12||b>crossHigh+12)&&Math.abs(w.start[axis]-cut)<=w.thicknessPx/2+2&&w.start[axis]>start&&w.start[axis]<end;
   });
   if(supports.length!==1)continue;
   proposals.push(before?{from:start,to:supports[0].start[axis]}:{from:supports[0].start[axis],to:end});
  }
  if(proposals.length!==1)return line;
  const {from,to}=proposals[0],forward=line.start[axis]<line.end[axis];
  return {...line,start:{...line.start,[axis]:forward?from:to},end:{...line.end,[axis]:forward?to:from}};
 });
}
