import {detectPlanLabels,type PlanLabel,type PlanText} from './planLabels';
import {mergeOrientedPlanLabels} from './orientedNumbers';
/** A valid PDF text layer can coexist with raster signs. Supplemental facility
 * OCR must not replace native dimensions, units, or confirmed annotations. */
export function mergePdfFacilityOcr(native:PlanLabel[],texts:PlanText[]):PlanLabel[]{
 const used=new Set(native.map(l=>l.id));
 const extra=detectPlanLabels(texts).filter(l=>l.source==='ocr'&&(l.confidence??0)>=90&&!['dimension','unit'].includes(l.kind)).filter(l=>!native.some(n=>{
  if(n.kind!==l.kind||n.status!=='dismissed')return false;
  const a=n.box,b=l.box,overlap=Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
  return overlap/Math.min(a.width*a.height,b.width*b.height)>.5;
 })).map(l=>{const base=`pdf-facility:${l.id}`;let id=base,suffix=1;while(used.has(id))id=`${base}:${suffix++}`;used.add(id);return {...l,id};});
 return mergeOrientedPlanLabels(native,extra);
}
