import {readUnitDeclaration} from './planUnits';
import {readPlanNumbers} from './planNumbers';
/** Text boxes locate annotations, never physical equipment footprints or safe clearances. */
export interface PlanText {
 text:string;
 box:{x:number;y:number;width:number;height:number};
 source:'pdf-text'|'ocr';
 confidence?:number;
}
export interface PlanLabel extends PlanText {
 id:string;
 kind:'entrance'|'door'|'window'|'air-conditioner'|'fire-hydrant'|'fire-extinguisher'|'stairs'|'column'|'dimension'|'unit'|'furniture';
 status:'unreviewed'|'confirmed'|'dismissed';
 note:string;
 correctedText?:string;
 numericConflict?:boolean;
}
const kinds:PlanLabel['kind'][]=['entrance','door','window','air-conditioner','fire-hydrant','fire-extinguisher','stairs','column','dimension','unit','furniture'];
const rules:{kind:PlanLabel['kind'];pattern:RegExp}[]=[
 {kind:'unit',pattern:/a^/},
 {kind:'furniture',pattern:/^(?:BAR|COUNTER|DESK|TABLE|CHAIR|CABINET|카운터|책상|테이블|의자|캐비닛)$/iu},
 {kind:'window',pattern:/\bWINDOW\b|창문|창호/iu},
 {kind:'entrance',pattern:/\b(?:ENTRY|ENTRANCE|EXIT)\b|출입구|비상구/iu},
 {kind:'door',pattern:/\bDOOR\b|출입문|방화문|자동문/iu},
 {kind:'air-conditioner',pattern:/\bAIR[\s-]*CONDITION(?:ER|ING)\b|(?:^|[^\p{L}\p{N}])A\.?C\.?(?=$|[^\p{L}\p{N}])|에어컨|냉난방기/iu},
 {kind:'fire-hydrant',pattern:/\b(?:FIRE[\s-]*)?HYDRANT\b|소화전/iu},
 {kind:'fire-extinguisher',pattern:/\b(?:FIRE[\s-]*)?EXTINGUISHER\b|소화기/iu},
 {kind:'stairs',pattern:/\b(?:STAIRS?|STAIRCASE)\b|계단|^(?:UP|DN)$/iu},
 {kind:'column',pattern:/\bCOLUMN\b|기둥/iu},
 {kind:'dimension',pattern:/(?:^|[^\p{L}\p{N}])\d+(?:[.,]\d+)?\s*(?:mm|cm|m|ft|in)(?=$|[^\p{L}\p{N}])|(?:^|[^\p{L}\p{N}])\d+(?:\.\d+)?\s*['′]\s*(?:\d+(?:\.\d+)?\s*["″])?/iu},
];
export function detectPlanLabels(texts:PlanText[]):PlanLabel[] {
 const labels:PlanLabel[]=[];
 for(const item of texts) {
  if(!item || typeof item.text!=='string' || item.text.length>2000 || !validBox(item.box) || !['pdf-text','ocr'].includes(item.source)) continue;
  if(item.confidence!==undefined && (!Number.isFinite(item.confidence)||item.confidence<0||item.confidence>100)) continue;
  const value=item.text.trim();
  if(!value) continue;
  // A single annotation can name more than one facility; each remains a review candidate.
  for(const rule of rules) {
   if(!rule.pattern.test(value)&&!(rule.kind==='dimension'&&readPlanNumbers(value).length)&&!(rule.kind==='unit'&&readUnitDeclaration(value))) continue;
   labels.push({...item,text:value,box:{...item.box},id:`label-${labels.length+1}`,kind:rule.kind,status:'unreviewed',note:rule.kind==='unit'?'페이지 전체 단위 선언입니다. 서로 충돌하지 않는 명시된 단위만 자동 치수 해석에 사용합니다.':rule.kind==='dimension'
    ?'문자 위치의 치수 후보입니다. 단위와 대상 벽을 확인해야 하며 벽 길이·높이·두께로 자동 적용하지 않습니다.'
    :'문자 위치의 설비·구조 후보입니다. 실제 점유 범위·문 열림 방향·접근 여유 공간은 확인이 필요합니다.'});
   if(labels.length===500) return labels;
  }
 }
 return labels;
}
function validBox(box:PlanText['box']):boolean {
 return !!box && [box.x,box.y,box.width,box.height].every(Number.isFinite) && box.x>=0 && box.y>=0 && box.width>0 && box.height>0;
}
function validSize(width:number,height:number) {
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||width>10000||height>10000) throw new Error('도면 크기가 올바르지 않습니다.');
}
export function validatePlanLabels(value:unknown,width:number,height:number):PlanLabel[] {
 validSize(width,height);
 const fail=()=>{throw new Error('도면 문자 인식 정보가 올바르지 않습니다.');};
 if(!Array.isArray(value)||value.length>500) return fail();
 const ids=new Set<string>();
 return value.map(raw=>{
  if(!raw||typeof raw!=='object') return fail();
  const p=raw as PlanLabel;
  if(typeof p.id!=='string'||!p.id.trim()||p.id.length>200||ids.has(p.id)||!kinds.includes(p.kind)||!['unreviewed','confirmed','dismissed'].includes(p.status)||!['pdf-text','ocr'].includes(p.source)||typeof p.text!=='string'||!p.text.trim()||p.text.length>2000||typeof p.note!=='string'||p.note.length>2000||!validBox(p.box)||p.box.x+p.box.width>width+1e-6||p.box.y+p.box.height>height+1e-6||(p.confidence!==undefined&&(!Number.isFinite(p.confidence)||p.confidence<0||p.confidence>100))) return fail();
  if(p.correctedText!==undefined&&(typeof p.correctedText!=='string'||!p.correctedText.trim()||p.correctedText.length>2000))return fail();
  if(p.numericConflict!==undefined&&typeof p.numericConflict!=='boolean')return fail();
  ids.add(p.id);
  return {...(p.numericConflict===undefined?{}:{numericConflict:p.numericConflict}),id:p.id,kind:p.kind,text:p.text,box:{...p.box},source:p.source,...(p.confidence===undefined?{}:{confidence:p.confidence}),status:p.status,note:p.note,...(p.correctedText===undefined?{}:{correctedText:p.correctedText})};
 });
}
/** Clockwise rotation, followed by a crop in rotated pixels. Partial text is excluded. */
export function transformPlanLabels(labels:PlanLabel[],width:number,height:number,rotation:0|90|180|270,crop?:PlanText['box']):PlanLabel[] {
 const checked=validatePlanLabels(labels,width,height);
 if(![0,90,180,270].includes(rotation)) throw new Error('도면 회전 각도가 올바르지 않습니다.');
 const rotatedWidth=rotation%180===0?width:height;
 const rotatedHeight=rotation%180===0?height:width;
 if(crop&&(!validBox(crop)||crop.x+crop.width>rotatedWidth||crop.y+crop.height>rotatedHeight)) throw new Error('도면 자르기 영역이 올바르지 않습니다.');
 return checked.flatMap(label=>{
  const b=label.box;
  const box=rotation===90?{x:height-b.y-b.height,y:b.x,width:b.height,height:b.width}:
   rotation===180?{x:width-b.x-b.width,y:height-b.y-b.height,width:b.width,height:b.height}:
   rotation===270?{x:b.y,y:width-b.x-b.width,width:b.height,height:b.width}:{...b};
  if(crop) {
   if(box.x<crop.x||box.y<crop.y||box.x+box.width>crop.x+crop.width||box.y+box.height>crop.y+crop.height) return [];
   box.x-=crop.x;box.y-=crop.y;
  }
  return [{...label,box}];
 });
}
