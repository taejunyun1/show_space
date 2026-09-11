import {detectCornerDoors} from './cornerDoors';
import type {WallCandidate} from './wallCandidates';
import type {PlanLabel} from './planLabels';
function distance(p:{x:number;y:number},line:WallCandidate){
 const dx=line.end.x-line.start.x,dy=line.end.y-line.start.y,den=dx*dx+dy*dy;
 const t=den?Math.max(0,Math.min(1,((p.x-line.start.x)*dx+(p.y-line.start.y)*dy)/den)):0;
 return Math.hypot(p.x-line.start.x-t*dx,p.y-line.start.y-t*dy);
}
/** Keep short connectors only when anchored to the structural network at both ends. */
export function selectStructuralLines(lines:WallCandidate[],longLength:number,labels:PlanLabel[]):WallCandidate[]{
 const eligible=lines.filter(l=>l.thicknessPx>=1&&Math.hypot(l.end.x-l.start.x,l.end.y-l.start.y)>=1&&!labels.some(label=>label.status!=='dismissed'&&[l.start,l.end].every(p=>p.x>=label.box.x-2&&p.x<=label.box.x+label.box.width+2&&p.y>=label.box.y-2&&p.y<=label.box.y+label.box.height+2)));
 const doorEnds=new Set(detectCornerDoors(eligible,labels).flatMap(d=>[d.aId,d.bId]));
 const approaches=new Set(doorEnds);
 for(const id of doorEnds){
  const terminal=eligible.find(l=>l.id===id)!;
  const paths:string[][]=[];
  const visit=(current:WallCandidate,path:string[])=>{
   if(path.length>4||paths.length>1)return;
   if(current.id!==id&&current.thicknessPx>=3&&Math.hypot(current.end.x-current.start.x,current.end.y-current.start.y)>=longLength){paths.push(path);return;}
   for(const next of eligible){
    if(path.includes(next.id)||(![current.start,current.end].some(p=>[next.start,next.end].some(q=>Math.hypot(p.x-q.x,p.y-q.y)<=4))))continue;
    visit(next,[...path,next.id]);
   }
  };
  visit(terminal,[id]);
  if(paths.length===1)paths[0].forEach(lineId=>approaches.add(lineId));
 }
 const thick=eligible.filter(l=>l.thicknessPx>=3);
 // Thin ink is structural only with direct, independent support at both ends.
 // Do not let other thin strokes (such as dimension witnesses) bootstrap it.
 const candidates=eligible.filter(l=>{
  const length=Math.hypot(l.end.x-l.start.x,l.end.y-l.start.y);
  // Corner correction may shorten a real step below the detector's 10px floor.
  // Require two distinct thick supports at 1px, not the general 4px proximity.
  const supported=(tolerance:number)=>thick.some(a=>a.id!==l.id&&distance(l.start,a)<=tolerance&&thick.some(b=>b.id!==l.id&&a.id!==b.id&&distance(l.end,b)<=tolerance));
  if(length<10&&!supported(1))return false;
  return l.thicknessPx>=3||approaches.has(l.id)||(length>=longLength&&supported(4));
 });
 const long=new Set(candidates.flatMap((l,i)=>l.thicknessPx>=3&&Math.hypot(l.end.x-l.start.x,l.end.y-l.start.y)>=longLength?[i]:[]));
 const live=new Set(candidates.map((_,i)=>i));
 const touches=(p:{x:number;y:number},i:number,j:number)=>i!==j&&distance(p,candidates[j])<=4;
 let changed=true;
 while(changed){changed=false;for(const i of live){if(long.has(i)||approaches.has(candidates[i].id))continue;if([candidates[i].start,candidates[i].end].some(p=>![...live].some(j=>touches(p,i,j)))){live.delete(i);changed=true;}}}
 const reached=new Set(long);changed=true;
 while(changed){changed=false;for(const i of live)if(!reached.has(i)&&[...reached].some(j=>[candidates[i].start,candidates[i].end].some(p=>touches(p,i,j))||[candidates[j].start,candidates[j].end].some(p=>touches(p,j,i)))){reached.add(i);changed=true;}}
 return candidates.filter((_,i)=>live.has(i)&&reached.has(i));
}
