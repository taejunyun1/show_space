import type {PlanPage} from './planImport';
import type {WallCandidate} from '../domain/wallCandidates';
import {detectPlanLabels} from '../domain/planLabels';
import {readPlanNumbers} from '../domain/planNumbers';
import {readPlanOcr} from './readPlanOcr';
import {detectPlanWalls} from './detectPlanWalls';
export interface PlanAnalysis {lines:WallCandidate[];issues:string[];textState:'complete'|'failed';lineState:'complete'|'failed';numericCount:number}
export async function analyzePlan(page:PlanPage,signal:AbortSignal,onStage:(message:string)=>void=()=>{}):Promise<PlanPage>{
 const abort=()=>{if(signal.aborted)throw new Error('자동 분석을 취소했습니다.');};abort();
 onStage('문자·숫자와 구조 선을 자동 분석하고 있습니다.');
 const [textResult,lineResult]=await Promise.allSettled([
  page.textSource==='pdf-text'||page.textSource==='ocr'?Promise.resolve(page.labels??[]):readPlanOcr(page.imageUrl,signal).then(detectPlanLabels),
  detectPlanWalls(page.imageUrl,155,0.008,signal,1),
 ]);abort();
 onStage('분석 결과와 확인이 필요한 정보를 정리하고 있습니다.');
 const labels=textResult.status==='fulfilled'?textResult.value:page.labels??[];
 const lines=lineResult.status==='fulfilled'?lineResult.value:[];
 const numeric=labels.filter(l=>l.kind==='dimension');
 const issues:string[]=[];
 if(textResult.status==='rejected')issues.push('문자를 읽지 못했습니다. 원본 해상도나 선택 영역을 확인하세요.');
 if(lineResult.status==='rejected')issues.push('구조 선 분석에 실패했습니다. 다시 분석하거나 영역을 줄여주세요.');
 else if(!lines.length)issues.push('구조 선을 찾지 못했습니다. 원본 또는 다른 페이지가 필요할 수 있습니다.');
 if(numeric.some(l=>readPlanNumbers(l.text).some(n=>n.values.length>1)))issues.push('해석이 여러 개인 숫자가 있습니다. 치수 자동 적용 전 해소가 필요합니다.');
 if(!numeric.length)issues.push('치수 숫자를 찾지 못했습니다. 실제 길이 기준이 필요합니다.');
 issues.push('닫힌 경계와 치수 근거를 확인해 공간 초안 생성 여부를 판단합니다.');
 return {...page,labels,textSource:textResult.status==='fulfilled'?(page.textSource==='pdf-text'?'pdf-text':'ocr'):page.textSource,analysis:{lines,issues,numericCount:numeric.length,textState:textResult.status==='fulfilled'?'complete':'failed',lineState:lineResult.status==='fulfilled'?'complete':'failed'}};
}
