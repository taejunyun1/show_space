import type {WallCandidate} from './wallCandidates';
import type {PlanLabel} from './planLabels';
export interface StairShapeCandidate {box:{x:number;y:number;width:number;height:number};lineIds:string[];railIds:string[]}
/** Ladder-like geometry is a stair candidate, not semantic proof. Require two
 * observed rails, five regular treads, and no internal cross-grid or furniture. */
export function detectUnlabelledStairCandidates(lines:WallCandidate[],labels:PlanLabel[]=[]):StairShapeCandidate[]{
 const candidates:StairShapeCandidate[]=[];
 for(const seed of lines){
  const horizontal=Math.abs(seed.start.y-seed.end.y)<.01;
  if(!horizontal&&Math.abs(seed.start.x-seed.end.x)>=.01)continue;
  const along=(p:{x:number;y:number})=>horizontal?p.x:p.y,across=(p:{x:number;y:number})=>horizontal?p.y:p.x;
  const from=Math.min(along(seed.start),along(seed.end)),to=Math.max(along(seed.start),along(seed.end)),length=to-from;
  if(length<30||length>500||seed.thicknessPx>Math.max(3,length*.03))continue;
  const family=lines.filter(l=>l.thicknessPx<=Math.max(3,length*.03)&&Math.abs(across(l.start)-across(l.end))<.01&&Math.abs(Math.min(along(l.start),along(l.end))-from)<=4&&Math.abs(Math.max(along(l.start),along(l.end))-to)<=4).sort((a,b)=>across(a.start)-across(b.start));
  if(family.length<5||family.length>30)continue;
  const spaces=family.slice(1).map((l,i)=>across(l.start)-across(family[i].start)),mean=spaces.reduce((a,b)=>a+b,0)/spaces.length;
  if(mean<6||mean>50||spaces.some(s=>Math.abs(s/mean-1)>.3))continue;
  const low=across(family[0].start),high=across(family.at(-1)!.start);
  const crossLines=lines.filter(l=>Math.abs(along(l.start)-along(l.end))<.01&&Math.min(across(l.start),across(l.end))<=low+4&&Math.max(across(l.start),across(l.end))>=high-4);
  const rails=[from,to].map(edge=>crossLines.filter(l=>Math.abs(along(l.start)-edge)<=4));
  if(rails.some(r=>r.length!==1)||crossLines.some(l=>along(l.start)>from+4&&along(l.start)<to-4))continue;
  const box=horizontal?{x:from,y:low,width:length,height:high-low}:{x:low,y:from,width:high-low,height:length};
  if(labels.some(l=>l.status!=='dismissed'&&['furniture','stairs'].includes(l.kind)&&l.box.x+l.box.width/2>=box.x&&l.box.x+l.box.width/2<=box.x+box.width&&l.box.y+l.box.height/2>=box.y&&l.box.y+l.box.height/2<=box.y+box.height))continue;
  if(candidates.some(c=>c.lineIds.some(id=>family.some(l=>l.id===id))))continue;
  candidates.push({box,lineIds:family.map(l=>l.id),railIds:rails.flatMap(r=>r.map(l=>l.id))});
 }
 return candidates;
}
