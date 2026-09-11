import type {WallCandidate} from './wallCandidates';
import type {PlanLabel} from './planLabels';
function distance(p:{x:number;y:number},line:WallCandidate){
 const dx=line.end.x-line.start.x,dy=line.end.y-line.start.y,den=dx*dx+dy*dy;
 const t=den?Math.max(0,Math.min(1,((p.x-line.start.x)*dx+(p.y-line.start.y)*dy)/den)):0;
 return Math.hypot(p.x-line.start.x-t*dx,p.y-line.start.y-t*dy);
}
/** Keep short connectors only when anchored to the structural network at both ends. */
export function selectStructuralLines(lines:WallCandidate[],longLength:number,labels:PlanLabel[]):WallCandidate[]{
 const candidates=lines.filter(l=>l.thicknessPx>=3&&Math.hypot(l.end.x-l.start.x,l.end.y-l.start.y)>=10&&!labels.some(label=>label.status!=='dismissed'&&[l.start,l.end].every(p=>p.x>=label.box.x-2&&p.x<=label.box.x+label.box.width+2&&p.y>=label.box.y-2&&p.y<=label.box.y+label.box.height+2)));
 const long=new Set(candidates.flatMap((l,i)=>Math.hypot(l.end.x-l.start.x,l.end.y-l.start.y)>=longLength?[i]:[]));
 const live=new Set(candidates.map((_,i)=>i));
 const touches=(p:{x:number;y:number},i:number,j:number)=>i!==j&&distance(p,candidates[j])<=4;
 let changed=true;
 while(changed){changed=false;for(const i of live){if(long.has(i))continue;if([candidates[i].start,candidates[i].end].some(p=>![...live].some(j=>touches(p,i,j)))){live.delete(i);changed=true;}}}
 const reached=new Set(long);changed=true;
 while(changed){changed=false;for(const i of live)if(!reached.has(i)&&[...reached].some(j=>[candidates[i].start,candidates[i].end].some(p=>touches(p,i,j))||[candidates[j].start,candidates[j].end].some(p=>touches(p,j,i)))){reached.add(i);changed=true;}}
 return candidates.filter((_,i)=>live.has(i)&&reached.has(i));
}
