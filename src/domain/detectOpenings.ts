import type {Wall} from './types';
import type {PlanLabel} from './planLabels';
/** Text locates a gap; only real wall endpoints determine its width. */
export function detectOpeningGaps(walls:Wall[],labels:PlanLabel[],maxGap:number){
 const endpoints=walls.flatMap(w=>[w.start,w.end].map((point,i)=>({wall:w,point,other:i?w.start:w.end}))).filter(e=>walls.flatMap(w=>[w.start,w.end]).filter(p=>Math.hypot(p.x-e.point.x,p.z-e.point.z)<1).length===1);
 const proposals:{wall:Wall;kind:'door'|'window';labelId:string}[]=[];
 for(const label of labels){
  if(!['entrance','door','window'].includes(label.kind)||label.status==='dismissed'||(label.source==='ocr'&&(label.confidence??0)<90))continue;
  const matches:Wall[]=[];
  for(let i=0;i<endpoints.length;i++)for(let j=i+1;j<endpoints.length;j++){
   const a=endpoints[i],b=endpoints[j],dx=b.point.x-a.point.x,dz=b.point.z-a.point.z,length=Math.hypot(dx,dz);
   if(a.wall.id===b.wall.id||length<10||length>maxGap)continue;
   const cross=(x:number,z:number)=>Math.abs(dx*z-dz*x)/length;
   if(cross(a.other.x-a.point.x,a.other.z-a.point.z)>1||cross(b.other.x-b.point.x,b.other.z-b.point.z)>1)continue;
   if(dx*(a.other.x-a.point.x)+dz*(a.other.z-a.point.z)>=0||dx*(b.other.x-b.point.x)+dz*(b.other.z-b.point.z)<=0)continue;
   const cx=label.box.x+label.box.width/2-a.point.x,cz=label.box.y+label.box.height/2-a.point.z,t=(cx*dx+cz*dz)/(length*length);
   if(t<=0||t>=1||cross(cx,cz)>Math.max(25,Math.min(60,Math.max(label.box.width,label.box.height)/2)))continue;
   matches.push({...a.wall,id:`opening-gap:${label.id}`,name:'개구부',start:a.point,end:b.point,role:'boundary',note:`${label.text} 표기와 벽 끝점 사이 틈으로 검출. 높이·문짝 형태는 미확인.`});
  }
  if(matches.length===1)proposals.push({wall:matches[0],kind:label.kind==='window'?'window':'door',labelId:label.id});
 }
 // Competing labels for the same endpoint make the interpretation ambiguous.
 return proposals.filter((p,i)=>!proposals.some((q,j)=>i!==j&&[p.wall.start,p.wall.end].some(a=>[q.wall.start,q.wall.end].some(b=>Math.hypot(a.x-b.x,a.z-b.z)<1))));
}
