import type {PlanLabel} from './planLabels';
import {readPlanNumbers} from './planNumbers';
import {pageUnit} from './planUnits';
/** Only unqualified whole-page ceiling declarations, not door or equipment heights. */
export function readCeilingHeight(labels:PlanLabel[]){
 const declared=pageUnit(labels),evidence:{labelId:string;mm:number}[]=[];
 let unresolved=false;
 for(const label of labels){
  if(label.status==='dismissed')continue;
  const text=(label.correctedText??label.text).normalize('NFKC').trim();
  const match=text.match(/^(?:ceiling\s+height|천장\s*높이|층고)\s*[:=]?\s*(\d[\d.,]*\s*(?:mm|cm|m)?)\s*$/i);
  if(!match)continue;
  if(label.numericConflict||(label.source==='ocr'&&(label.confidence??0)<90)){unresolved=true;continue;}
  const numbers=readPlanNumbers(match[1]);
  if(numbers.length!==1||numbers[0].values.length!==1){unresolved=true;continue;}
  const n=numbers[0],unit=n.unit??(!declared.conflict?declared.unit:undefined);
  if(!unit){unresolved=true;continue;}
  const mm=n.values[0]*({mm:1,cm:10,m:1000}[unit]);
  if(mm<1000||mm>20000){unresolved=true;continue;}
  evidence.push({labelId:label.id,mm});
 }
 const conflict=new Set(evidence.map(e=>e.mm)).size>1;
 return {heightMm:!conflict&&!unresolved?evidence[0]?.mm:undefined,evidence,conflict,unresolved};
}
