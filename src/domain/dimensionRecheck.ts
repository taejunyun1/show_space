import type {PlanLabel,PlanText} from './planLabels';
import type {WallDimensionConstraint} from './dimensionConstraints';
import {readPlanNumbers} from './planNumbers';

export interface DimensionRecheckTarget {labelId:string;text:string;box:PlanText['box'];region:PlanText['box'];rotations:(0|90|180|270)[]}
export interface DimensionRecheckResult {labelId:string;status:'reading-confirmed'|'reading-disagrees'|'unreadable'|'failed';readings:PlanText[]}

/** Both ends of a contradictory assignment need re-reading, not just the edge
 * reported by graph traversal. A matching re-read does not validate its wall binding. */
export function conflictingDimensionLabels(matches:WallDimensionConstraint[]):string[]{
 return [...new Set(matches.filter((a,i)=>matches.some((b,j)=>i!==j&&a.wallId===b.wallId&&a.horizontal===b.horizontal&&a.from===b.from&&a.to===b.to&&a.mm!==b.mm)).map(a=>a.labelId))];
}
export function dimensionRecheckTargets(labels:PlanLabel[],width:number,height:number,conflicts:string[]=[]):DimensionRecheckTarget[]{
 if(![width,height].every(n=>Number.isFinite(n)&&n>0))return [];
 const wanted=new Set(conflicts);
 return labels.filter(l=>l.kind==='dimension'&&l.status!=='dismissed'&&!l.correctedText&&(l.numericConflict||wanted.has(l.id))).flatMap(l=>{
  const b=l.box;
  if(![b.x,b.y,b.width,b.height].every(Number.isFinite)||b.x<0||b.y<0||b.width<=0||b.height<=0||b.x+b.width>width||b.y+b.height>height)return [];
  const margin=Math.max(12,Math.min(b.width,b.height)*.6),x=Math.max(0,b.x-margin),y=Math.max(0,b.y-margin);
  return [{labelId:l.id,text:l.text,box:{...b},region:{x,y,width:Math.min(width,b.x+b.width+margin)-x,height:Math.min(height,b.y+b.height+margin)-y},rotations:(b.height>b.width?[90,270]:[0,180]) as DimensionRecheckTarget['rotations']}];
 }).slice(0,8);
}

/** OCR coordinates must overlap this number, not a neighbouring dimension that
 * happens to fall inside the crop. Keep alternatives; never majority-vote digits. */
export function assessDimensionRecheck(target:DimensionRecheckTarget,passes:PlanText[][],failed=false):DimensionRecheckResult{
 const readings=passes.flat().filter(t=>{
  const b=t.box,a=target.box;
  if(t.source!=='ocr'||(t.confidence??0)<90||![b.x,b.y,b.width,b.height].every(Number.isFinite)||b.width<=0||b.height<=0)return false;
  const overlap=Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
  return overlap/Math.max(a.width*a.height,b.width*b.height)>.5&&readPlanNumbers(t.text).length>0;
 }).map(t=>({...t,box:{...t.box}}));
 const original=readPlanNumbers(target.text);
 const same=(t:PlanText)=>{
  const next=readPlanNumbers(t.text);
  return next.length===original.length&&original.every((n,i)=>n.values.length===1&&next[i].values.length===1&&n.values[0]===next[i].values[0]&&(!n.unit||!next[i].unit||n.unit===next[i].unit)&&(!n.axis||!next[i].axis||n.axis===next[i].axis));
 };
 const status=readings.some(t=>!same(t))?'reading-disagrees':failed?'failed':readings.length?'reading-confirmed':'unreadable';
 return {labelId:target.labelId,status,readings};
}

export async function recheckDimensionReadings(targets:DimensionRecheckTarget[],signal:AbortSignal,read:(region:PlanText['box'],rotation:0|90|180|270)=>Promise<PlanText[]>,onStage:(message:string)=>void=()=>{}):Promise<DimensionRecheckResult[]>{
 const results:DimensionRecheckResult[]=[];
 const abort=()=>{if(signal.aborted)throw new Error('치수 재인식을 취소했습니다.');};
 for(const target of targets.slice(0,8)){
  abort();onStage(`충돌한 치수 표기를 확대 재인식하고 있습니다 (${results.length+1}/${Math.min(targets.length,8)}).`);
  const passes:PlanText[][]=[];let failed=false;
  for(const rotation of target.rotations){
   abort();try{passes.push(await read(target.region,rotation));abort();}catch{abort();failed=true;}
  }
  results.push(assessDimensionRecheck(target,passes,failed));
 }
 abort();return results;
}
