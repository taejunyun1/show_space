import type {PlanLabel} from './planLabels';
import type {WallCandidate} from './wallCandidates';
/** Exact furniture text plus four observed rectangle sides. Shared longer walls
 * are retained; the returned box is observed geometry, not the text footprint. */
export function detectFurnitureOutlines(labels:PlanLabel[],lines:WallCandidate[]){
 const result:{labelId:string;box:{x:number;y:number;width:number;height:number};lineIds:string[]}[]=[];
 const vertical=lines.filter(l=>Math.abs(l.start.x-l.end.x)<1),horizontal=lines.filter(l=>Math.abs(l.start.y-l.end.y)<1);
 for(const label of labels){
  if(label.kind!=='furniture'||label.status==='dismissed'||(label.source==='ocr'&&(label.confidence??0)<90))continue;
  const b=label.box,cx=b.x+b.width/2,cy=b.y+b.height/2,limit=Math.max(b.width,b.height)*6;
  const proposals:typeof result=[];
  for(const left of vertical)for(const right of vertical){
   const x=left.start.x,x2=right.start.x;
   if(x>=b.x||x2<=b.x+b.width||x2-x<20||x2-x>limit)continue;
   const y=Math.min(left.start.y,left.end.y),y2=Math.max(left.start.y,left.end.y);
   if(y>=b.y||y2<=b.y+b.height||y2-y<20||y2-y>limit||Math.abs(Math.min(right.start.y,right.end.y)-y)>4||Math.abs(Math.max(right.start.y,right.end.y)-y2)>4)continue;
   const sides=(at:number)=>horizontal.filter(l=>Math.abs(l.start.y-at)<=4&&Math.min(l.start.x,l.end.x)<=x+4&&Math.max(l.start.x,l.end.x)>=x2-4);
   const top=sides(y),bottom=sides(y2);
   if(top.length!==1||bottom.length!==1||top[0].id===bottom[0].id)continue;
   if(Math.abs(cx-(x+x2)/2)>(x2-x)*.35||Math.abs(cy-(y+y2)/2)>(y2-y)*.35)continue;
   const edges=[left,right,top[0],bottom[0]],ids=new Set(edges.map(l=>l.id));
   // A crossing/attached structural line makes the rectangle ambiguous.
   if(lines.some(l=>!ids.has(l.id)&&Math.max(l.start.x,l.end.x)>x+4&&Math.min(l.start.x,l.end.x)<x2-4&&Math.max(l.start.y,l.end.y)>y+4&&Math.min(l.start.y,l.end.y)<y2-4&&Math.hypot(l.end.x-l.start.x,l.end.y-l.start.y)>Math.min(x2-x,y2-y)))continue;
   const lineIds=edges.filter(l=>[l.start,l.end].every(p=>p.x>=x-4&&p.x<=x2+4&&p.y>=y-4&&p.y<=y2+4)).map(l=>l.id);
   proposals.push({labelId:label.id,box:{x,y,width:x2-x,height:y2-y},lineIds});
  }
  if(proposals.length===1)result.push(proposals[0]);
 }
 return result;
}
