/** Numeric readings are evidence, never a wall measurement until linked and checked. */
export interface PlanNumber { raw:string; values:number[]; unit:'mm'|'cm'|'m'|null; axis:'length'|'height'|'thickness'|null }
export function readPlanNumbers(input:string):PlanNumber[]{
 const text=input.normalize('NFKC').trim();
 // Drawing IDs, scales, dates, levels and angles must not become lengths.
 if(/\d\s*[:/°%]|\d\s*[-–]\s*\d|\b(?:FL|EL|LEVEL|SCALE|NO)\b/i.test(text)||/^[+-]/.test(text))return [];
 const axis=/\bH\s*=|높이|\bHEIGHT\b/i.test(text)?'height':/\bT\s*=|두께|\bTHICKNESS\b/i.test(text)?'thickness':/\b[WL]\s*=|길이|\bLENGTH\b/i.test(text)?'length':null;
 const numericOnly=/^[\d\s.,x×]+$/i.test(text);
 const results:PlanNumber[]=[];
 const pattern=/(?<![\p{L}\p{N}])\d+(?:[.,]\d+)*(?:\s*(mm|cm|m)(?![\p{L}\p{N}]))?/giu;
 for(const match of text.matchAll(pattern)){
  if(!numericOnly&&!axis&&!match[1])continue;
  const raw=match[0].trim(),token=raw.replace(/\s*(mm|cm|m)$/i,'');
  let values:number[]=[];
  if(/^\d+$/.test(token)||/^\d+\.\d+$/.test(token))values=[Number(token)];
  else if(/^\d{1,3}(,\d{3})+$/.test(token)){
   values=[Number(token.replaceAll(',',''))];
   // A single comma can be either a decimal separator or a thousands separator.
   if(token.split(',').length===2)values.push(Number(token.replace(',','.')));
  }else if(/^\d+,\d{1,2}$/.test(token))values=[Number(token.replace(',','.'))];
  values=[...new Set(values)].filter(n=>Number.isFinite(n)&&n>0&&n<=10000000);
  if(values.length)results.push({raw,values,unit:(match[1]?.toLowerCase() as PlanNumber['unit'])??null,axis});
 }
 return results.slice(0,50);
}
export function numberWarnings(text:string,confidence?:number):string[]{
 const numbers=readPlanNumbers(text),warnings:string[]=[];
 if(numbers.some(n=>!n.unit))warnings.push('단위 미확인 · mm로 가정하지 않습니다.');
 if(numbers.some(n=>n.values.length>1))warnings.push('쉼표가 천 단위인지 소수점인지 확인하세요.');
 if(numbers.length>1)warnings.push('여러 숫자 표기 · 각각의 대상 치수 확인 필요');
 if(confidence!==undefined&&confidence<80)warnings.push('OCR 점수가 낮습니다. 원본 숫자를 확인하세요.');
 if(!numbers.length)warnings.push('숫자를 확정하지 못했습니다. 원본을 확인하세요.');
 return warnings;
}
