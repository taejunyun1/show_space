import type {Project} from './types';
import type {PlanLabel} from './planLabels';
import type {WallCandidate} from './wallCandidates';
import type {WallSuggestion} from './dimensionSuggestions';
import {readPlanNumbers} from './planNumbers';
export interface DimensionLineMatch extends WallSuggestion {evidence:WallCandidate[];gap?:WallCandidate}
interface SupportedLine {line:WallCandidate;parts:WallCandidate[];gap?:WallCandidate}
function labelGapLines(lines:WallCandidate[],label:PlanLabel):SupportedLine[]{
 const result:SupportedLine[]=lines.map(line=>({line,parts:[line]}));
 for(const horizontal of [true,false]){
  const along=(p:{x:number;y:number})=>horizontal?p.x:p.y,across=(p:{x:number;y:number})=>horizontal?p.y:p.x;
  const near=horizontal?label.box.x:label.box.y,far=near+(horizontal?label.box.width:label.box.height);
  const crossMin=horizontal?label.box.y:label.box.x,crossMax=crossMin+(horizontal?label.box.height:label.box.width);
  const margin=Math.max(6,Math.min(20,(far-near)*0.15));
  const parallel=lines.filter(l=>Math.abs(across(l.start)-across(l.end))<=1).map(l=>({source:l,start:along(l.start)<along(l.end)?l.start:l.end,end:along(l.start)<along(l.end)?l.end:l.start}));
  for(const left of parallel)for(const right of parallel){
   const x1=along(left.end),x2=along(right.start),cross=across(left.end);
   if(x2<=x1||Math.abs(cross-across(right.start))>1||cross<crossMin-3||cross>crossMax+3)continue;
   if(Math.abs(x1-near)>margin||Math.abs(x2-far)>margin||along(left.start)>=near-margin||along(right.end)<=far+margin)continue;
   const gap:WallCandidate={id:`gap:${left.source.id}:${right.source.id}`,start:left.end,end:right.start,thicknessPx:Math.max(left.source.thicknessPx,right.source.thicknessPx)};
   result.push({line:{...gap,start:left.start,end:right.end},parts:[left.source,right.source],gap});
  }
 }
 return result;
}
/** Requires a parallel line plus two perpendicular witnesses joining its ends to a wall. */
export function matchDimensionLines(project:Project,label:PlanLabel,lines:WallCandidate[]):DimensionLineMatch[]{
 const r=project.planReference,number=readPlanNumbers(label.correctedText??label.text);
 if(!r?.calibrated||label.kind!=='dimension'||label.status==='dismissed'||number.length!==1||number[0].values.length!==1||number[0].axis==='height'||number[0].axis==='thickness'||/\d\s*[x×]\s*\d/i.test(label.correctedText??label.text))return [];
 const px={x:label.box.x+label.box.width/2,y:label.box.y+label.box.height/2};
 const valid=lines.filter(l=>[l.start,l.end].every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.y>=0&&p.x<=r.widthPx&&p.y<=r.heightPx));
 const supported=labelGapLines(valid,label);
 const matches:DimensionLineMatch[]=[];
 for(const wall of project.walls){
  if(!wall.visible)continue;
  const start={x:(wall.start.x-r.origin.x)/r.mmPerPixel,y:(wall.start.z-r.origin.z)/r.mmPerPixel},end={x:(wall.end.x-r.origin.x)/r.mmPerPixel,y:(wall.end.z-r.origin.z)/r.mmPerPixel};
  if(![start,end].every(p=>p.x>=0&&p.y>=0&&p.x<=r.widthPx&&p.y<=r.heightPx))continue;
  const horizontal=Math.abs(start.y-end.y)<1,vertical=Math.abs(start.x-end.x)<1;
  if(!horizontal&&!vertical)continue;
  const along=(p:{x:number;y:number})=>horizontal?p.x:p.y,across=(p:{x:number;y:number})=>horizontal?p.y:p.x;
  const a=Math.min(along(start),along(end)),b=Math.max(along(start),along(end)),wallCross=across(start);
  const tolerance=Math.max(4,Math.min(12,(b-a)*0.025));
  for(const support of supported){
   const line=support.line;
   if(Math.abs(across(line.start)-across(line.end))>1)continue;
   const low=Math.min(along(line.start),along(line.end)),high=Math.max(along(line.start),along(line.end)),cross=across(line.start);
   const distance=Math.abs(across(px)-cross);
   if(Math.abs(low-a)>tolerance||Math.abs(high-b)>tolerance||Math.abs(cross-wallCross)<8||Math.abs(cross-wallCross)>250||along(px)<low||along(px)>high||distance>Math.max(25,horizontal?label.box.height:label.box.width))continue;
   const witnesses=[a,b].map(position=>valid.find(l=>Math.abs(along(l.start)-along(l.end))<=1&&Math.abs(along(l.start)-position)<=tolerance&&Math.min(across(l.start),across(l.end))<=Math.min(cross,wallCross)+tolerance&&Math.max(across(l.start),across(l.end))>=Math.max(cross,wallCross)-tolerance));
   if(witnesses[0]&&witnesses[1]&&witnesses[0].id!==witnesses[1].id)matches.push({wallId:wall.id,start,end,distancePx:distance,evidence:[...support.parts,witnesses[0],witnesses[1]],...(support.gap?{gap:support.gap}:{})});
  }
 }
 return matches.sort((a,b)=>Number(!!a.gap)-Number(!!b.gap)||a.distancePx-b.distancePx).filter((m,i,all)=>all.findIndex(n=>n.wallId===m.wallId)===i).slice(0,3);
}
