import type {Wall} from './types';
import type {PlanLabel} from './planLabels';
import {readPlanNumbers} from './planNumbers';
import {pageUnit} from './planUnits';
/** Adjacent annotations are weaker than witness lines. Require unique placement,
 * three independent walls, both axes, and agreement before deriving one scale. */
export function wallAnnotationScale(walls:Wall[],labels:PlanLabel[],occludingWalls:Wall[]=walls,uprightWallIds:ReadonlySet<string>=new Set()){
 const declared=pageUnit(labels);
 // A T-junction can bound a labelled portion of an otherwise continuous wall.
 // Keep the whole as a competing target: text alone must not choose between both.
 const targets:(Wall&{uncertain?:boolean})[]=walls.flatMap(w=>{
  const horizontal=Math.abs(w.start.z-w.end.z)<1e-6,vertical=Math.abs(w.start.x-w.end.x)<1e-6;
  if(!horizontal&&!vertical)return [w];
  const axis=horizontal?'x':'z',cross=horizontal?'z':'x';
  const lo=Math.min(w.start[axis],w.end[axis]),hi=Math.max(w.start[axis],w.end[axis]);
  const cuts=[lo,hi],nearCuts:number[]=[];
  for(const other of walls){
   const otherLength=Math.hypot(other.end.x-other.start.x,other.end.z-other.start.z);
   // Raster drift on a parallel wall face is not a return or T-junction.
   if(other.id===w.id||otherLength===0||Math.abs(other.start[cross]-other.end[cross])/otherLength<.3)continue;
   for(const p of [other.start,other.end])if(p[axis]>lo&&p[axis]<hi){
    const gap=Math.abs(p[cross]-w.start[cross]);
    if(gap<1e-6)cuts.push(p[axis]);else if(gap<=8)nearCuts.push(p[axis]);
   }
  }
  const unresolved=nearCuts.filter(value=>!cuts.includes(value));
  const sorted=[...new Set(cuts)].sort((a,b)=>a-b),possible=[...new Set([...cuts,...unresolved])].sort((a,b)=>a-b);
  const segment=(from:number,to:number)=>({...w,start:{...w.start,[axis]:from},end:{...w.end,[axis]:to}});
  // Nearby but disconnected ends can veto a false whole-wall assignment. They
  // cannot supply a measured interval until the actual junction is recovered.
  return [w,...(sorted.length>2?sorted.slice(1).map((to,i)=>segment(sorted[i],to)):[]),...possible.slice(1).flatMap((to,i)=>unresolved.includes(possible[i])||unresolved.includes(to)?[{...segment(possible[i],to),uncertain:true}]:[])];
 });
 const matches:{wallId:string;labelId:string;mm:number;lengthPx:number;horizontal:boolean;ratio:number;from:number;to:number}[]=[];
 for(const label of labels){
  if(label.kind!=='dimension'||label.status==='dismissed'||label.numericConflict||(label.source==='ocr'&&(label.confidence??0)<90))continue;
  const numbers=readPlanNumbers(label.correctedText??label.text);
  if(numbers.length!==1||numbers[0].values.length!==1||['height','thickness'].includes(numbers[0].axis??''))continue;
  const n=numbers[0],unit=n.unit??declared.unit;if(!unit||declared.conflict)continue;
  const mm=n.values[0]*({mm:1,cm:10,m:1000}[unit]);if(mm<10||mm>200000)continue;
  let horizontal=label.box.width>label.box.height*1.2;const vertical=label.box.height>label.box.width*1.2;if(!horizontal&&!vertical)continue;
  const cx=label.box.x+label.box.width/2,cy=label.box.y+label.box.height/2;
  let candidates=targets.filter(w=>{
   const dx=w.end.x-w.start.x,dy=w.end.z-w.start.z;
   const length=Math.hypot(dx,dy),drift=Math.min(2,length*.005);
   if((horizontal&&Math.abs(dy)>drift)||(vertical&&Math.abs(dx)>drift))return false;
   const from=horizontal?Math.min(w.start.x,w.end.x):Math.min(w.start.z,w.end.z),to=horizontal?Math.max(w.start.x,w.end.x):Math.max(w.start.z,w.end.z),along=horizontal?cx:cy;
   const wallAlongStart=horizontal?w.start.x:w.start.z,wallAlongEnd=horizontal?w.end.x:w.end.z;
   const crossAt=(horizontal?w.start.z:w.start.x)+((horizontal?w.end.z:w.end.x)-(horizontal?w.start.z:w.start.x))*(along-wallAlongStart)/(wallAlongEnd-wallAlongStart);
   const labelCross=horizontal?cy:cx,cross=Math.abs(labelCross-crossAt);
   const obscured=occludingWalls.some(other=>{
    if(other.id===w.id)return false;
    const a=horizontal?other.start.x:other.start.z,b=horizontal?other.end.x:other.end.z;
    const c=horizontal?other.start.z:other.start.x,d=horizontal?other.end.z:other.end.x;
    if(along<=Math.min(a,b)||along>=Math.max(a,b)||Math.abs(d-c)>Math.min(2,Math.abs(b-a)*.005))return false;
    const position=c+(d-c)*(along-a)/(b-a);
    return position>Math.min(labelCross,crossAt)+.001&&position<Math.max(labelCross,crossAt)-.001;
   });
   if(obscured)return false;
   return to-from>=30&&cross>=8&&cross<=60&&along>from&&along<to&&Math.abs(along-(from+to)/2)<=Math.max((to-from)*.2,(horizontal?label.box.width:label.box.height)/2);
  });
  // Upright identifier labels may name vertical wall spans. Only use this
  // fallback on spans explicitly split at an observed door; never on the
  // original continuous wall that would include the doorway itself.
  if(!candidates.length&&horizontal&&/^[A-Z]{1,4}[1-9]\d{0,2}\s*=/i.test(label.correctedText??label.text)){
   candidates=targets.filter(w=>{
    if(!uprightWallIds.has(w.id)||Math.abs(w.start.x-w.end.x)>1e-6)return false;
    const from=Math.min(w.start.z,w.end.z),to=Math.max(w.start.z,w.end.z),x=w.start.x;
    const edge=x<label.box.x?label.box.x:x>label.box.x+label.box.width?label.box.x+label.box.width:undefined;
    if(edge===undefined||Math.abs(x-edge)<8||Math.abs(x-edge)>60||label.box.y<=from||label.box.y+label.box.height>=to)return false;
    const sourceWall=walls.find(original=>original.id===w.id)!;
    if(occludingWalls.some(other=>{
     if(other.id===w.id||Math.abs(other.end.x-other.start.x)<2)return false;
     const t=(x-other.start.x)/(other.end.x-other.start.x),z=other.start.z+t*(other.end.z-other.start.z);
     return t>=0&&t<=1&&z>Math.min(sourceWall.start.z,sourceWall.end.z)+1e-6&&z<Math.max(sourceWall.start.z,sourceWall.end.z)-1e-6;
    }))return false;
    return !occludingWalls.some(other=>other.id!==w.id&&Math.abs(other.end.x-other.start.x)<2&&cy>Math.min(other.start.z,other.end.z)&&cy<Math.max(other.start.z,other.end.z)&&other.start.x>Math.min(edge,x)&&other.start.x<Math.max(edge,x));
   });
   if(candidates.length)horizontal=false;
  }
  if(candidates.length!==1||candidates[0].uncertain)continue;
  const wall=candidates[0],lengthPx=Math.hypot(wall.end.x-wall.start.x,wall.end.z-wall.start.z);
  const from=horizontal?Math.min(wall.start.x,wall.end.x):Math.min(wall.start.z,wall.end.z),to=horizontal?Math.max(wall.start.x,wall.end.x):Math.max(wall.start.z,wall.end.z);
  matches.push({wallId:wall.id,labelId:label.id,mm,lengthPx,horizontal,ratio:mm/lengthPx,from,to});
 }
 const conflictingWall=matches.some((m,i)=>matches.some((n,j)=>i!==j&&m.wallId===n.wallId&&m.from===n.from&&m.to===n.to&&m.mm!==n.mm));
 const unique=matches.filter((m,i)=>matches.findIndex(n=>n.wallId===m.wallId&&n.from===m.from&&n.to===m.to)===i);
 const enough=new Set(unique.map(m=>m.wallId)).size>=3&&unique.some(m=>m.horizontal)&&unique.some(m=>!m.horizontal);
 const ratios=unique.map(m=>m.ratio).sort((a,b)=>a-b),median=ratios[Math.floor(ratios.length/2)];
 const conflict=conflictingWall||(enough&&ratios.some(r=>Math.abs(r/median-1)>.02));
 return {matches:unique,allMatches:matches,conflict,scale:enough&&!conflict?median:undefined};
}
