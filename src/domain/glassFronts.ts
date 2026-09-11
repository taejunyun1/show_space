import type {Wall} from './types';
import type {WallCandidate} from './wallCandidates';
import type {PlanLabel} from './planLabels';
/** Narrow case: explicitly labelled glazing drawn as one thin stroke,
 * terminating at a labelled door on one end and a heavier return on the other.
 * This does not infer a window's extent from a label on an ordinary solid wall. */
export function detectGlassFronts(walls:Wall[],labels:PlanLabel[],lines:WallCandidate[],doors:{kind:string;wall:Wall}[]){
 const proposals:{wall:Wall;kind:'window';labelId:string;frameIds:string[]}[]=[];
 const same=(a:Wall['start'],b:Wall['start'])=>Math.hypot(a.x-b.x,a.z-b.z)<.001;
 for(const label of labels){
  if(label.kind!=='window'||label.status==='dismissed'||!(/\bglass\b/i.test(label.text)||/유리/.test(label.text))||(label.source==='ocr'&&(label.confidence??0)<90))continue;
  const matches:typeof proposals=[];
  for(const wall of walls){
   const dx=wall.end.x-wall.start.x,dz=wall.end.z-wall.start.z,length=Math.hypot(dx,dz);
   if(length<40||Math.min(Math.abs(dx),Math.abs(dz))>2)continue;
   const along=(p:Wall['start'])=>((p.x-wall.start.x)*dx+(p.z-wall.start.z)*dz)/length;
   const across=(p:Wall['start'])=>Math.abs((p.x-wall.start.x)*dz-(p.z-wall.start.z)*dx)/length;
   const corners=[{x:label.box.x,z:label.box.y},{x:label.box.x+label.box.width,z:label.box.y+label.box.height}];
   const values=corners.map(along),lo=Math.min(...values),hi=Math.max(...values);
   if(lo<0||hi>length||hi-lo<length*.45||Math.abs((lo+hi)/2-length/2)>length*.15||corners.some(p=>across(p)>60))continue;
   const evidence=lines.filter(l=>{
    const a={x:l.start.x,z:l.start.y},b={x:l.end.x,z:l.end.y};
    return across(a)<=4&&across(b)<=4&&Math.min(Math.abs(along(a)),Math.abs(along(b)))<=4&&Math.min(Math.abs(along(a)-length),Math.abs(along(b)-length))<=4;
   });
   if(!evidence.length||evidence.some(l=>Math.max(l.thicknessPx,l.solidSupportThicknessPx??0)>6))continue;
   const thickness=Math.max(...evidence.map(l=>l.thicknessPx));
   const doorEnds=[wall.start,wall.end].filter(p=>doors.some(d=>d.kind==='door'&&[d.wall.start,d.wall.end].some(q=>same(p,q))));
   if(doorEnds.length!==1)continue;
   const far=same(doorEnds[0],wall.start)?wall.end:wall.start;
   // No interior branch may be silently removed with this stroke.
   if(walls.some(w=>w.id!==wall.id&&[w.start,w.end].some(p=>across(p)<4&&along(p)>4&&along(p)<length-4)))continue;
   const returns=walls.filter(w=>w.id!==wall.id&&[w.start,w.end].some(p=>same(p,far))&&Math.abs((w.end.x-w.start.x)*dx+(w.end.z-w.start.z)*dz)<Math.hypot(w.end.x-w.start.x,w.end.z-w.start.z)*length*.1);
   if(!returns.some(w=>lines.some(l=>{
    if(Math.max(l.thicknessPx,l.solidSupportThicknessPx??0)<thickness*2)return false;
    const a={x:l.start.x,z:l.start.y},b={x:l.end.x,z:l.end.y};
    return Math.min(Math.hypot(a.x-far.x,a.z-far.z),Math.hypot(b.x-far.x,b.z-far.z))<8&&Math.abs((b.x-a.x)*dx+(b.z-a.z)*dz)<Math.hypot(b.x-a.x,b.z-a.z)*length*.1&&Math.hypot(b.x-a.x,b.z-a.z)>30&&[w.start,w.end].some(p=>Math.min(Math.hypot(p.x-a.x,p.z-a.z),Math.hypot(p.x-b.x,p.z-b.z))<8);
   })))continue;
   matches.push({wall:{...wall,id:`opening-gap:${label.id}`,name:'유리창 개구부',note:`${label.text} 표기·얇은 전체 선·출입구 접점·두꺼운 끝벽으로 검출. 창턱 및 창 높이는 미확인.`},kind:'window',labelId:label.id,frameIds:[wall.id]});
  }
  if(matches.length===1)proposals.push(matches[0]);
 }
 return proposals.filter((p,i)=>!proposals.some((q,j)=>i!==j&&q.frameIds[0]===p.frameIds[0]));
}
