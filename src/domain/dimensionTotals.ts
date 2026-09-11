import type {PlanLabel} from './planLabels';
import {readPlanNumbers} from './planNumbers';
import {pageUnit} from './planUnits';
export interface DimensionTotalCheck {group:string;partLabelIds:string[];totalLabelId?:string;sumMm:number;totalMm?:number;status:'matched'|'unmatched'|'ambiguous'|'incomplete';}
/** Matches numbered length sets against explicitly named totals. This is arithmetic
 * evidence only: neither wall association nor room geometry follows from equality. */
export function checkDimensionTotals(labels:PlanLabel[]):DimensionTotalCheck[]{
 const declared=pageUnit(labels);if(declared.conflict)return [];
 const readable=labels.filter(l=>l.kind==='dimension'&&l.status!=='dismissed'&&!l.numericConflict&&(l.source!=='ocr'||(l.confidence??0)>=90));
 const mm=(text:string)=>{const ns=readPlanNumbers(text);if(ns.length!==1||ns[0].values.length!==1||['height','thickness'].includes(ns[0].axis??''))return undefined;const unit=ns[0].unit??declared.unit;if(!unit)return undefined;return ns[0].values[0]*({mm:1,cm:10,m:1000}[unit]);};
 const groups=new Map<string,{index:number;mm:number;id:string}[]>(),totals:{id:string;mm:number}[]=[];
 for(const label of readable){const text=label.correctedText??label.text,part=/^([A-Z]{1,4})([1-9]\d{0,2})\s*=\s*(.+)$/i.exec(text.trim());
  if(part){const value=mm(part[3]);if(value===undefined)continue;const key=part[1].toUpperCase();groups.set(key,[...(groups.get(key)??[]),{index:Number(part[2]),mm:value,id:label.id}]);}
  else if(/^(?:Hanging\s+Space|Total\s+(?:Wall\s+)?Length|총\s*(?:전시\s*)?길이)\s*[:=]/i.test(text.trim())){const value=mm(text);if(value!==undefined)totals.push({id:label.id,mm:value});}
 }
 if(!totals.length)return [];
 const checks:DimensionTotalCheck[]=[];
 for(const [group,parts] of groups){
  if(parts.length<2)continue;
  const indices=[...new Set(parts.map(p=>p.index))].sort((a,b)=>a-b);
  // Repeated readings of one ID are not independent lengths. Conflicting copies veto.
  const conflict=indices.some(i=>new Set(parts.filter(p=>p.index===i).map(p=>p.mm)).size>1);
  const sumMm=indices.reduce((sum,i)=>sum+parts.find(p=>p.index===i)!.mm,0),partLabelIds=parts.map(p=>p.id);
  if(conflict){checks.push({group,partLabelIds,sumMm,status:'ambiguous'});continue;}
  if(indices.some((n,i)=>n!==i+1)){checks.push({group,partLabelIds,sumMm,status:'incomplete'});continue;}
  const matches=totals.filter(t=>Math.abs(t.mm-sumMm)<=1);
  checks.push({group,partLabelIds,sumMm,...(matches.length===1?{totalLabelId:matches[0].id,totalMm:matches[0].mm}:{}),status:matches.length===1?'matched':matches.length?'ambiguous':'unmatched'});
 }
 // A single total cannot validate two groups, even if the sums happen to match.
 return checks.map(c=>c.totalLabelId&&checks.filter(o=>o.totalLabelId===c.totalLabelId).length>1?{...c,status:'ambiguous'}:c);
}
