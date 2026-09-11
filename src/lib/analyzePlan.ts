import {detectStairRegions,stableStairRegions,type StairRegion} from '../domain/stairRegions';
import {mergeOrientedPlanLabels} from '../domain/orientedNumbers';
import {buildAutomaticVenue} from '../domain/automaticVenue';
import {venueDraftsAgree} from '../domain/verifyVenueDrafts';
import type {PlanPage} from './planImport';
import type {WallCandidate} from '../domain/wallCandidates';
import {detectPlanLabels} from '../domain/planLabels';
import {readPlanNumbers} from '../domain/planNumbers';
import {readPlanOcr} from './readPlanOcr';
import {detectPlanWalls} from './detectPlanWalls';
export interface PlanAnalysis {stairRegions?:StairRegion[];lines:WallCandidate[];issues:string[];textState:'complete'|'failed';lineState:'complete'|'failed';numericCount:number;selfCheck?:{attempts:number;status:'stable'|'withheld'}}
export async function analyzePlan(page:PlanPage,signal:AbortSignal,onStage:(message:string)=>void=()=>{}):Promise<PlanPage>{
 const abort=()=>{if(signal.aborted)throw new Error('자동 분석을 취소했습니다.');};abort();
 onStage('문자·숫자와 구조 선을 자동 분석하고 있습니다.');
 const reuseText=(page.textSource==='pdf-text'||page.textSource==='ocr')&&(page.labels?.length??0)>0;
 const [textResult,lineResult]=await Promise.allSettled([
  reuseText?Promise.resolve(page.labels??[]):readPlanOcr(page.imageUrl,signal).then(detectPlanLabels),
  detectPlanWalls(page.imageUrl,155,0.008,signal,1,500),
 ]);abort();
 onStage('인식 근거와 구조 검증 결과를 정리하고 있습니다.');
 let labels=textResult.status==='fulfilled'?textResult.value:page.labels??[];
 let lines=lineResult.status==='fulfilled'?lineResult.value:[];
 const issues:string[]=[];
 if(!reuseText){
  for(const rotation of [90,180,270] as const){
   abort();onStage(`회전 숫자를 자동 인식하고 있습니다 (${rotation}°).`);
   try{const texts=await readPlanOcr(page.imageUrl,signal,undefined,'numbers',rotation);abort();labels=mergeOrientedPlanLabels(labels,detectPlanLabels(texts).map(l=>({...l,id:`rotation-${rotation}-${l.id}`})));}
   catch{abort();issues.push(`${rotation}° 숫자 보완 인식을 완료하지 못했습니다.`);}
  }
 }
 const numeric=labels.filter(l=>l.kind==='dimension');
 if(numeric.some(l=>l.numericConflict))issues.push('회전 인식에서 서로 다른 값이 나온 숫자는 자동 치수 적용에서 제외했습니다.');
 if(textResult.status==='rejected')issues.push('문자를 읽지 못했습니다. 현재 입력에서 문자 근거를 확보하지 못했습니다.');
 if(lineResult.status==='rejected')issues.push('구조 선 분석에 실패했습니다. 다른 조건으로 자동 재시도합니다.');
 else if(!lines.length)issues.push('구조 선을 찾지 못했습니다. 원본 또는 다른 페이지가 필요할 수 있습니다.');
 if(numeric.some(l=>readPlanNumbers(l.text).some(n=>n.values.length>1)))issues.push('해석이 여러 개인 숫자는 자동 치수 적용에서 제외했습니다.');
 if(!numeric.length)issues.push('치수 숫자를 찾지 못했습니다. 축척 자동 적용을 보류합니다.');
 issues.push('닫힌 경계와 치수 근거를 확인해 공간 초안 생성 여부를 판단합니다.');
 const result:PlanPage={...page,labels,textSource:textResult.status==='fulfilled'?(reuseText?page.textSource:'ocr'):page.textSource,analysis:{lines,issues,numericCount:numeric.length,textState:textResult.status==='fulfilled'?'complete':'failed',lineState:lineResult.status==='fulfilled'?'complete':'failed'}};
 // Re-run locally under different raster conditions; never ask the user to tune thresholds.
 const candidates:PlanPage[]=[result];
 for(const threshold of [125,190]){
  abort();onStage(`구조를 자체 검증하고 있습니다 (${candidates.length+1}/3).`);
  try{
   lines=await detectPlanWalls(page.imageUrl,threshold,.008,signal,1,500);abort();
   candidates.push({...result,analysis:{...result.analysis!,lines,lineState:'complete'}});
  }catch{abort();candidates.push({...result,analysis:{...result.analysis!,lines:[],lineState:'failed'}});}
 }
 const drafts=candidates.map(p=>buildAutomaticVenue(p).project);
 // Any contradictory successful result vetoes automatic adoption, even if two others agree.
 const successes=drafts.flatMap((p,i)=>p?[{project:p,index:i}]:[]);
 const stable=successes.length>=2&&successes.every(s=>venueDraftsAgree(successes[0].project,s.project));
 const selectedIndex=stable?successes[0].index:0,selected=candidates[selectedIndex];
 const regionPasses=candidates.map(p=>detectStairRegions(labels,p.analysis!.lines));
 const stairRegions=stableStairRegions(regionPasses,selectedIndex);
 const message=stable?'서로 다른 선 검출 조건에서 구조와 축척이 일치했습니다.':'자동 재분석으로 구조·축척을 확정하지 못해 공간 생성을 보류했습니다. 원본과 분석 결과는 유지합니다.';
 return {...selected,analysis:{...selected.analysis!,stairRegions,issues:[...issues.filter(i=>!i.startsWith('닫힌 경계')),message],selfCheck:{attempts:candidates.length,status:stable?'stable':'withheld'}}};
}
