import {pageUnit} from './planUnits';
import {readPlanNumbers} from './planNumbers';
import type {Project,Wall} from './types';
import type {PlanLabel} from './planLabels';
import type {WallCandidate} from './wallCandidates';
import {labelGapLines,matchDimensionLines} from './dimensionLineEvidence';
export interface DimensionSpan {id:string;horizontal:boolean;cross:number;from:number;to:number;wallIds:string[]}
/** Build dimension targets from continuously covered wall spans, never across missing walls. */
export function matchDimensionSpans(project:Project,label:PlanLabel,lines:WallCandidate[]):DimensionSpan[]{
 const ref=project.planReference;if(!ref?.calibrated||label.numericConflict)return [];
 const spans:DimensionSpan[]=[],targets:Wall[]=[];
 const groups:{horizontal:boolean;cross:number;segments:{from:number;to:number;wall:Wall}[]}[]=[];
 for(const wall of project.walls){
  if(!wall.visible)continue;
  const a={x:(wall.start.x-ref.origin.x)/ref.mmPerPixel,y:(wall.start.z-ref.origin.z)/ref.mmPerPixel},b={x:(wall.end.x-ref.origin.x)/ref.mmPerPixel,y:(wall.end.z-ref.origin.z)/ref.mmPerPixel};
  const horizontal=Math.abs(a.y-b.y)<1;if(!horizontal&&Math.abs(a.x-b.x)>=1)continue;
  const cross=horizontal?(a.y+b.y)/2:(a.x+b.x)/2,from=horizontal?Math.min(a.x,b.x):Math.min(a.y,b.y),to=horizontal?Math.max(a.x,b.x):Math.max(a.y,b.y);
  let group=groups.find(g=>g.horizontal===horizontal&&Math.abs(g.cross-cross)<1);
  if(!group){group={horizontal,cross,segments:[]};groups.push(group);}group.segments.push({from,to,wall});
 }
 const supports=labelGapLines(lines,label);
 for(const group of groups){
  const along=(p:{x:number;y:number})=>group.horizontal?p.x:p.y,across=(p:{x:number;y:number})=>group.horizontal?p.y:p.x;
  const center={x:label.box.x+label.box.width/2,y:label.box.y+label.box.height/2};
  for(const {line} of supports){
   if(Math.abs(across(line.start)-across(line.end))>=1)continue;
   const snapEndpoint=(value:number)=>{
    const endpoints=[...new Set(group.segments.flatMap(s=>[s.from,s.to]))].filter(p=>Math.abs(p-value)<=1);
    return endpoints.length===1?endpoints[0]:value;
   };
   const from=snapEndpoint(Math.min(along(line.start),along(line.end))),to=snapEndpoint(Math.max(along(line.start),along(line.end)));
   if(to-from<10||along(center)<from||along(center)>to||Math.abs(across(center)-across(line.start))>Math.max(25,Math.min(60,2*(group.horizontal?label.box.height:label.box.width))))continue;
   const segments=group.segments.filter(s=>s.to>from&&s.from<to).sort((a,b)=>a.from-b.from);
   let covered=from;const used:string[]=[];
   for(const segment of segments){if(segment.from>covered+1)break;if(segment.to>covered){covered=segment.to;used.push(segment.wall.id);}}
   if(covered<to-1||!used.length)continue;
   const id=`span:${group.horizontal?'h':'v'}:${group.cross.toFixed(3)}:${from.toFixed(3)}:${to.toFixed(3)}`;
   if(spans.some(s=>s.id===id))continue;
   const point=(n:number)=>group.horizontal?{x:ref.origin.x+n*ref.mmPerPixel,z:ref.origin.z+group.cross*ref.mmPerPixel}:{x:ref.origin.x+group.cross*ref.mmPerPixel,z:ref.origin.z+n*ref.mmPerPixel};
   spans.push({id,horizontal:group.horizontal,cross:group.cross,from,to,wallIds:used});targets.push({...segments[0].wall,id,start:point(from),end:point(to)});
  }
 }
 const matches=matchDimensionLines({...project,walls:targets},label,lines);
 return matches.flatMap(m=>{const span=spans.find(s=>s.id===m.wallId);return span?[span]:[];});
}
export interface MeasuredSpan extends DimensionSpan {mm:number;labelId:string}
/** Compare every fully tiled chain of adjacent parts to its whole dimension. */
export function checkDimensionSums(measurements:MeasuredSpan[]):{checked:number;conflict:boolean}{
 let checked=0;
 for(const whole of measurements){
  const parts=measurements.filter(p=>p.id!==whole.id&&p.horizontal===whole.horizontal&&Math.abs(p.cross-whole.cross)<1&&p.from>=whole.from-1&&p.to<=whole.to+1&&(p.to-p.from)<whole.to-whole.from-1).sort((a,b)=>a.from-b.from);
  let cursor=whole.from,sum=0,count=0;
  while(cursor<whole.to-1){
   const next=parts.filter(p=>Math.abs(p.from-cursor)<1&&p.to>cursor+1);
   // Overlapping or alternative chains are not independent additive evidence.
   if(next.length!==1)break;
   sum+=next[0].mm;cursor=next[0].to;count++;
  }
  if(count>=2&&Math.abs(cursor-whole.to)<1){checked++;if(Math.abs(sum/whole.mm-1)>.02)return {checked,conflict:true};}
 }
 return {checked,conflict:false};
}

/** Collect only unique, unit-bearing, sufficiently confident witness-supported spans. */
export function readMeasuredSpans(project:Project,labels:PlanLabel[],lines:WallCandidate[]):MeasuredSpan[]{
 const declared=pageUnit(labels);if(declared.conflict)return [];
 return labels.flatMap(label=>{
  if(label.numericConflict||label.status==='dismissed'||(label.source==='ocr'&&(label.confidence??0)<90))return [];
  const numbers=readPlanNumbers(label.correctedText??label.text);
  if(numbers.length!==1||numbers[0].values.length!==1)return [];
  const n=numbers[0],unit=n.unit??declared.unit;if(!unit)return [];
  const mm=n.values[0]*({mm:1,cm:10,m:1000}[unit]);if(!Number.isFinite(mm)||mm<=0||mm>200000)return [];
  const matches=matchDimensionSpans(project,label,lines);
  return matches.length===1?[{...matches[0],mm,labelId:label.id}]:[];
 });
}
