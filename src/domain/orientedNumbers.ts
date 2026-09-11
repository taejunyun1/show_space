import type {PlanText,PlanLabel} from './planLabels';
import {readPlanNumbers} from './planNumbers';
export function unrotateTextBox(box:PlanText['box'],width:number,height:number,rotation:0|90|180|270):PlanText['box']{
 const points=[[box.x,box.y],[box.x+box.width,box.y],[box.x,box.y+box.height],[box.x+box.width,box.y+box.height]].map(([x,y])=>rotation===90?[y,height-x]:rotation===180?[width-x,height-y]:rotation===270?[width-y,x]:[x,y]);
 const x=Math.min(...points.map(p=>p[0])),y=Math.min(...points.map(p=>p[1]));return {x,y,width:Math.max(...points.map(p=>p[0]))-x,height:Math.max(...points.map(p=>p[1]))-y};
}
function overlaps(a:PlanText['box'],b:PlanText['box']){
 const area=Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
 return area/Math.min(a.width*a.height,b.width*b.height)>.5;
}
function reading(label:PlanLabel){return readPlanNumbers(label.correctedText??label.text).map(n=>({values:n.values,unit:n.unit,axis:n.axis}));}
function sameReading(a:PlanLabel,b:PlanLabel){
 const x=reading(a),y=reading(b);return x.length===y.length&&x.every((n,i)=>JSON.stringify(n.values)===JSON.stringify(y[i].values)&&(!n.unit||!y[i].unit||n.unit===y[i].unit)&&(!n.axis||!y[i].axis||n.axis===y[i].axis));
}
/** Keep conflicting readings as evidence, but prevent automatic dimensional application. */
export function mergeOrientedNumbers(base:PlanLabel[],extra:PlanLabel[]):PlanLabel[]{
 const result=base.map(l=>({...l,box:{...l.box}}));
 for(const label of extra){
  if(label.kind!=='dimension'||(label.confidence??0)<90||!reading(label).length)continue;
  const matches=result.filter(l=>l.kind==='dimension'&&l.status!=='dismissed'&&overlaps(l.box,label.box));
  if(matches.length&&matches.every(m=>sameReading(m,label)))continue;
  const next={...label,box:{...label.box}};
  if(matches.length){for(const match of matches)match.numericConflict=true;next.numericConflict=true;}
  result.push(next);
 }
 return result.slice(0,500);
}
/** Preserve semantic labels discovered during the same rotated passes, not just their digits. */
export function mergeOrientedPlanLabels(base:PlanLabel[],extra:PlanLabel[]):PlanLabel[]{
 const result=mergeOrientedNumbers(base,extra);
 for(const label of extra){
  if(label.kind==='dimension'||(label.confidence??0)<90)continue;
  if(result.some(l=>l.kind===label.kind&&l.status!=='dismissed'&&overlaps(l.box,label.box)))continue;
  result.push({...label,box:{...label.box}});
 }
 return result.slice(0,500);
}
