import type {Wall} from './types';
import type {PlanLabel} from './planLabels';
/** A labelled inset window can be drawn as a parallel frame and two short caps,
 * leaving no free endpoints for ordinary gap detection. */
export function detectFramedWindows(walls:Wall[],labels:PlanLabel[],maxGap:number){
 const proposals:{wall:Wall;kind:'window';labelId:string;frameIds:string[]}[]=[];
 const same=(a:Wall['start'],b:Wall['start'])=>Math.hypot(a.x-b.x,a.z-b.z)<1;
 const crosses=(a:Wall,b:Wall)=>{
  const ax=a.end.x-a.start.x,az=a.end.z-a.start.z,bx=b.end.x-b.start.x,bz=b.end.z-b.start.z,den=ax*bz-az*bx;
  if(Math.abs(den)<1e-8)return false;
  const px=b.start.x-a.start.x,pz=b.start.z-a.start.z,t=(px*bz-pz*bx)/den,u=(px*az-pz*ax)/den;
  return t>=0&&t<=1&&u>=0&&u<=1;
 };
 const ends=walls.flatMap(w=>[{wall:w,point:w.start,other:w.end},{wall:w,point:w.end,other:w.start}]);
 for(const label of labels){
  if(label.kind!=='window'||label.status==='dismissed'||(label.source==='ocr'&&(label.confidence??0)<90))continue;
  const matches:typeof proposals=[];
  for(let i=0;i<ends.length;i++)for(let j=i+1;j<ends.length;j++){
   const a=ends[i],b=ends[j],dx=b.point.x-a.point.x,dz=b.point.z-a.point.z,length=Math.hypot(dx,dz);
   if(a.wall.id===b.wall.id||length<30||length>maxGap)continue;
   const across=(p:Wall['start'])=>Math.abs(dx*(p.z-a.point.z)-dz*(p.x-a.point.x))/length;
   if(across(a.other)>2||across(b.other)>2||dx*(a.other.x-a.point.x)+dz*(a.other.z-a.point.z)>=0||dx*(b.other.x-b.point.x)+dz*(b.other.z-b.point.z)<=0)continue;
   const center={x:label.box.x+label.box.width/2,z:label.box.y+label.box.height/2},t=((center.x-a.point.x)*dx+(center.z-a.point.z)*dz)/(length*length);
   if(t<=0||t>=1||across(center)>60)continue;
   const first=walls.filter(w=>w.id!==a.wall.id&&w.id!==b.wall.id&&(same(w.start,a.point)||same(w.end,a.point)));
   for(const capA of first){
    const p=same(capA.start,a.point)?capA.end:capA.start;
    if(Math.hypot(p.x-a.point.x,p.z-a.point.z)>30||across(p)<2)continue;
    for(const frame of walls){
     if([a.wall.id,b.wall.id,capA.id].includes(frame.id)||(!same(frame.start,p)&&!same(frame.end,p)))continue;
     const q=same(frame.start,p)?frame.end:frame.start;
     if(Math.abs((q.x-p.x)*dz-(q.z-p.z)*dx)/length>2||Math.abs(Math.hypot(q.x-p.x,q.z-p.z)-length)>2)continue;
     const caps=walls.filter(w=>![a.wall.id,b.wall.id,capA.id,frame.id].includes(w.id)&&((same(w.start,q)&&same(w.end,b.point))||(same(w.end,q)&&same(w.start,b.point))));
     if(caps.length!==1||Math.hypot(q.x-b.point.x,q.z-b.point.z)>30)continue;
     const ids=[capA.id,frame.id,caps[0].id];
     // Frame junctions must not carry another wall or branching structure.
     if(walls.some(w=>![...ids,a.wall.id,b.wall.id].includes(w.id)&&([p,q].some(point=>same(w.start,point)||same(w.end,point))||[capA,frame,caps[0]].some(segment=>crosses(segment,w)))))continue;
     matches.push({wall:{...a.wall,id:`opening-gap:${label.id}`,name:'창문 개구부',start:a.point,end:b.point,role:'boundary',note:`${label.text} 표기와 평행 창틀·양끝 연결선으로 검출. 창턱 높이는 미확인.`},kind:'window',labelId:label.id,frameIds:ids});
    }
   }
  }
  if(matches.length===1)proposals.push(matches[0]);
 }
 return proposals.filter((p,i)=>!proposals.some((q,j)=>i!==j&&(p.frameIds.some(id=>q.frameIds.includes(id))||[p.wall.start,p.wall.end].some(a=>[q.wall.start,q.wall.end].some(b=>same(a,b))))));
}
