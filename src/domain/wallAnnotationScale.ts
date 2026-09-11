import type {Wall} from './types';
import type {PlanLabel} from './planLabels';
import {readPlanNumbers} from './planNumbers';
import {pageUnit} from './planUnits';
/** Adjacent annotations are weaker than witness lines. Require unique placement,
 * three independent walls, both axes, and agreement before deriving one scale. */
export function wallAnnotationScale(walls:Wall[],labels:PlanLabel[]){
 const declared=pageUnit(labels);
 // A T-junction can bound a labelled portion of an otherwise continuous wall.
 // Keep the whole as a competing target: text alone must not choose between both.
 const targets=walls.flatMap(w=>{
  const horizontal=Math.abs(w.start.z-w.end.z)<1e-6,vertical=Math.abs(w.start.x-w.end.x)<1e-6;
  if(!horizontal&&!vertical)return [w];
  const axis=horizontal?'x':'z',cross=horizontal?'z':'x';
  const lo=Math.min(w.start[axis],w.end[axis]),hi=Math.max(w.start[axis],w.end[axis]);
  const cuts=[lo,hi];
  for(const other of walls){
   if(other.id===w.id||Math.abs(other.start[cross]-other.end[cross])<1)continue;
   for(const p of [other.start,other.end])if(Math.abs(p[cross]-w.start[cross])<1e-6&&p[axis]>lo&&p[axis]<hi)cuts.push(p[axis]);
  }
  const sorted=[...new Set(cuts)].sort((a,b)=>a-b);if(sorted.length===2)return [w];
  return [w,...sorted.slice(1).map((to,i)=>({...w,start:{...w.start,[axis]:sorted[i]},end:{...w.end,[axis]:to}}))];
 });
 const matches:{wallId:string;labelId:string;mm:number;lengthPx:number;horizontal:boolean;ratio:number;from:number;to:number}[]=[];
 for(const label of labels){
  if(label.kind!=='dimension'||label.status==='dismissed'||label.numericConflict||(label.source==='ocr'&&(label.confidence??0)<90))continue;
  const numbers=readPlanNumbers(label.correctedText??label.text);
  if(numbers.length!==1||numbers[0].values.length!==1||['height','thickness'].includes(numbers[0].axis??''))continue;
  const n=numbers[0],unit=n.unit??declared.unit;if(!unit||declared.conflict)continue;
  const mm=n.values[0]*({mm:1,cm:10,m:1000}[unit]);if(mm<10||mm>200000)continue;
  const horizontal=label.box.width>label.box.height*1.2,vertical=label.box.height>label.box.width*1.2;if(!horizontal&&!vertical)continue;
  const cx=label.box.x+label.box.width/2,cy=label.box.y+label.box.height/2;
  const candidates=targets.filter(w=>{
   const dx=w.end.x-w.start.x,dy=w.end.z-w.start.z;
   if((horizontal&&Math.abs(dy)>1)||(vertical&&Math.abs(dx)>1))return false;
   const from=horizontal?Math.min(w.start.x,w.end.x):Math.min(w.start.z,w.end.z),to=horizontal?Math.max(w.start.x,w.end.x):Math.max(w.start.z,w.end.z),along=horizontal?cx:cy;
   const cross=Math.abs((horizontal?cy:cx)-(horizontal?w.start.z:w.start.x));
   return to-from>=30&&cross>=8&&cross<=60&&along>from&&along<to&&Math.abs(along-(from+to)/2)<=Math.max((to-from)*.2,(horizontal?label.box.width:label.box.height)/2);
  });
  if(candidates.length!==1)continue;
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
