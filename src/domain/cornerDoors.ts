import type {WallCandidate} from './wallCandidates';
import type {PlanLabel} from './planLabels';
/** Corner doors may terminate a perpendicular return wall on one side and a
 * collinear wall on the other. Both observed endpoints bound the labelled gap. */
export function detectCornerDoors(lines:WallCandidate[],labels:PlanLabel[]){
 const proposals:{aId:string;bId:string;start:WallCandidate['start'];end:WallCandidate['end'];labelId:string}[]=[];
 const ends=lines.filter(l=>l.thicknessPx>=1&&Math.hypot(l.end.x-l.start.x,l.end.y-l.start.y)>=30).flatMap(l=>[{id:l.id,p:l.start,q:l.end},{id:l.id,p:l.end,q:l.start}]);
 for(const label of labels){
  if(!['door','entrance'].includes(label.kind)||label.status==='dismissed'||(label.source==='ocr'&&(label.confidence??0)<90))continue;
  const matches:typeof proposals=[];
  for(let i=0;i<ends.length;i++)for(let j=i+1;j<ends.length;j++){
   const a=ends[i],b=ends[j],dx=b.p.x-a.p.x,dy=b.p.y-a.p.y,length=Math.hypot(dx,dy);
   if(a.id===b.id||length<30||length>Math.max(label.box.width,label.box.height)*2+60||Math.min(Math.abs(dx),Math.abs(dy))>2)continue;
   const projection=(p:typeof a.p)=>((p.x-a.p.x)*dx+(p.y-a.p.y)*dy)/length;
   const ad=projection(a.q),bd=projection(b.q)-length;
   const cross=(p:typeof a.p)=>Math.abs((p.x-a.p.x)*dy-(p.y-a.p.y)*dx)/length;
   const aParallel=cross(a.q)<=2,bParallel=cross(b.q)<=2;
   if(aParallel===bParallel||ad>2||bd< -2||(!aParallel&&Math.abs(ad)>2)||(!bParallel&&Math.abs(bd)>2))continue;
   const center={x:label.box.x+label.box.width/2,y:label.box.y+label.box.height/2};
   if(projection(center)<=0||projection(center)>=length||cross(center)>60)continue;
   // An observed segment along the proposed opening means this is not a gap.
   if(lines.some(l=>![a.id,b.id].includes(l.id)&&cross(l.start)<=2&&cross(l.end)<=2&&Math.min(length,Math.max(projection(l.start),projection(l.end)))-Math.max(0,Math.min(projection(l.start),projection(l.end)))>=10))continue;
   matches.push({aId:a.id,bId:b.id,start:a.p,end:b.p,labelId:label.id});
  }
  if(matches.length===1)proposals.push(matches[0]);
 }
 return proposals.filter((p,i)=>!proposals.some((q,j)=>i!==j&&[p.start,p.end].some(a=>[q.start,q.end].some(b=>Math.hypot(a.x-b.x,a.y-b.y)<2))));
}
