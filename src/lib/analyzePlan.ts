import {mergePdfFacilityOcr} from '../domain/hybridPlanLabels';
import {conflictingDimensionLabels,dimensionRecheckTargets,recheckDimensionReadings} from '../domain/dimensionRecheck';
import {extractStructuralWalls} from '../domain/automaticVenue';
import {resolvePlanOpenings} from '../domain/planOpenings';
import {venueDimensions} from '../domain/venueDimensions';
import {shapeLabelRegions} from '../domain/shapeLabelRegions';
import {prepareConstrainedVenue} from '../domain/constrainedVenue';
import {renderMappedPlan} from './renderMappedPlan';
import {numericOcrRegions} from '../domain/ocrRegions';
import {detectStairRegions,stableStairRegions,type StairRegion} from '../domain/stairRegions';
import {mergeOrientedPlanLabels} from '../domain/orientedNumbers';
import {buildAutomaticVenue,planEvidenceKey} from '../domain/automaticVenue';
import {venueDraftsAgree} from '../domain/verifyVenueDrafts';
import type {PlanPage} from './planImport';
import type {WallCandidate} from '../domain/wallCandidates';
import {detectPlanLabels} from '../domain/planLabels';
import {readPlanNumbers} from '../domain/planNumbers';
import {readPlanOcr} from './readPlanOcr';
import {detectPlanWalls} from './detectPlanWalls';
export interface PlanAnalysis {stairRegions?:StairRegion[];lines:WallCandidate[];issues:string[];textState:'complete'|'failed';lineState:'complete'|'failed';numericCount:number;selfCheck?:{attempts:number;status:'stable'|'withheld'}}
export async function analyzePlan(page:PlanPage,signal:AbortSignal,onStage:(message:string)=>void=()=>{}):Promise<PlanPage>{
 page={...page,resolvedVenue:undefined,dimensionRechecks:undefined};
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
 if(reuseText&&page.textSource==='pdf-text'){
  onStage('PDF 이미지에 포함된 설비 표기를 추가 인식하고 있습니다.');
  try{const extra=await readPlanOcr(page.imageUrl,signal);abort();labels=mergePdfFacilityOcr(labels,extra);}
  catch{abort();issues.push('이미지 설비 표기 보완 인식을 완료하지 못했습니다. PDF 문자 근거는 보존했습니다.');}
  const regions=numericOcrRegions(page.widthPx,page.heightPx);
  for(let i=0;i<regions.length;i++){
   onStage(`이미지 속 설비 표기를 확대 인식하고 있습니다 (${i+1}/${regions.length}).`);abort();
   try{const extra=await readPlanOcr(page.imageUrl,signal,undefined,'facilities',0,regions[i]);abort();labels=mergePdfFacilityOcr(labels,extra);}
   catch{abort();issues.push(`구역 ${i+1}의 설비 보완 인식을 완료하지 못했습니다.`);}
  }
 }
 if(!reuseText){
  for(const rotation of [90,180,270] as const){
   abort();onStage(`회전 숫자를 자동 인식하고 있습니다 (${rotation}°).`);
   try{const texts=await readPlanOcr(page.imageUrl,signal,undefined,'numbers',rotation);abort();labels=mergeOrientedPlanLabels(labels,detectPlanLabels(texts).map(l=>({...l,id:`rotation-${rotation}-${l.id}`})));}
   catch{abort();issues.push(`${rotation}° 숫자 보완 인식을 완료하지 못했습니다.`);}
  }
 }
 if(!reuseText){
  const regions=numericOcrRegions(page.widthPx,page.heightPx);
  for(let i=0;i<regions.length;i++)for(const rotation of [0,90] as const){
   abort();onStage(`누락 숫자를 구역별로 확대 인식하고 있습니다 (${i+1}/${regions.length}, ${rotation}°).`);
   try{
    const texts=await readPlanOcr(page.imageUrl,signal,undefined,'numbers',rotation,regions[i]);abort();
    const extra=detectPlanLabels(texts).filter(l=>l.kind==='dimension'||l.kind==='furniture').map(l=>({...l,id:`region-${i}-${rotation}-${l.id}`}));
    labels=mergeOrientedPlanLabels(labels,extra);
   }catch{abort();issues.push(`구역 ${i+1}의 ${rotation}° 숫자 보완 인식을 완료하지 못했습니다.`);}
  }
 }
 if(!reuseText){
  const regions=shapeLabelRegions(lines,page.widthPx,page.heightPx);
  for(let i=0;i<regions.length;i++)for(const rotation of regions[i].rotations){
   abort();onStage(`도형 안의 가구 표기를 확대 인식하고 있습니다 (${i+1}/${regions.length}).`);
   try{
    const texts=await readPlanOcr(page.imageUrl,signal,undefined,'numbers',rotation,regions[i]);abort();
    labels=mergeOrientedPlanLabels(labels,detectPlanLabels(texts).filter(l=>l.kind==='furniture').map(l=>({...l,id:`shape-${i}-${rotation}-${l.id}`})));
   }catch{abort();issues.push(`도형 ${i+1} 표기 보완 인식을 완료하지 못했습니다.`);}
  }
 }
 const signOcr=new Map<string,Awaited<ReturnType<typeof readPlanOcr>>>();
 for(const sign of page.embeddedSigns??[]){
  abort();onStage('PDF 원본 표지 이미지에서 설비를 인식하고 있습니다.');
  try{
   let texts=signOcr.get(sign.imageUrl);if(!texts){texts=await readPlanOcr(sign.imageUrl,signal,undefined,'facilities');abort();signOcr.set(sign.imageUrl,texts);}
   labels=mergePdfFacilityOcr(labels,texts.map(t=>({...t,box:{x:sign.box.x+t.box.x*sign.box.width/sign.widthPx,y:sign.box.y+t.box.y*sign.box.height/sign.heightPx,width:t.box.width*sign.box.width/sign.widthPx,height:t.box.height*sign.box.height/sign.heightPx}})));
  }catch{abort();issues.push('원본 설비 이미지의 문자 인식을 완료하지 못했습니다.');}
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
 const regionPasses=candidates.map(p=>detectStairRegions(labels,p.analysis!.lines));
 candidates.forEach((p,i)=>{p.analysis={...p.analysis!,stairRegions:stableStairRegions(regionPasses,i)};});
 const constrained=candidates.map(p=>prepareConstrainedVenue(p));
 const drafts=candidates.map((p,i)=>buildAutomaticVenue(p).project??constrained[i]?.project);
 // Any contradictory successful result vetoes automatic adoption, even if two others agree.
 const successes=drafts.flatMap((p,i)=>p?[{project:p,index:i}]:[]);
 const stable=successes.length>=2&&successes.every(s=>venueDraftsAgree(successes[0].project,s.project));
 const selectedIndex=stable?successes[0].index:0,selected=candidates[selectedIndex];
 const structural=extractStructuralWalls(selected);
 const openings=resolvePlanOpenings(structural,labels,Math.max(page.widthPx,page.heightPx)*.2,selected.analysis!.stairRegions);
 const dimensions=venueDimensions(selected,structural,openings.structure,openings.gaps);
 const conflicts=[...conflictingDimensionLabels(dimensions.annotations.allMatches),...dimensions.solution.axes.flatMap(a=>a.conflicts.map(c=>c.labelId))];
 const targets=dimensionRecheckTargets(labels,page.widthPx,page.heightPx,conflicts);
 const dimensionRechecks=await recheckDimensionReadings(targets,signal,(region,rotation)=>readPlanOcr(page.imageUrl,signal,undefined,'numbers',rotation,region),onStage);
 if(dimensionRechecks.length){
  const confirmed=dimensionRechecks.filter(r=>r.status==='reading-confirmed').length,disagrees=dimensionRechecks.filter(r=>r.status==='reading-disagrees').length;
  issues.push(`충돌 치수 ${dimensionRechecks.length}개를 자동 재인식했습니다. 기존 숫자와 일치 ${confirmed}개 · 다른 숫자 ${disagrees}개 · 판독 미완료 ${dimensionRechecks.length-confirmed-disagrees}개. 숫자 일치는 벽 연결이나 실측 치수 검증을 뜻하지 않습니다.`);
 }
 const stairRegions=selected.analysis!.stairRegions??[];
 let resolvedVenue:PlanPage['resolvedVenue'];
 if(stable&&!buildAutomaticVenue(selected).project&&constrained[selectedIndex]){
  onStage('치수에 맞춘 도면 이미지를 만들고 있습니다.');
  try{
   const value=constrained[selectedIndex]!;
   const imageUrl=await renderMappedPlan(page.imageUrl,value.prepared,signal);abort();
   resolvedVenue={sourceImageUrl:page.imageUrl,sourceEvidenceKey:planEvidenceKey(selected),project:{...value.project,planImageUrl:imageUrl}};
  }catch{abort();issues.push('변환 이미지를 만들지 못해 공간 적용을 보류했습니다.');}
 }
 const adopted=stable&&(!!buildAutomaticVenue(selected).project||!!resolvedVenue);
 const message=adopted?'서로 다른 선 검출 조건에서 구조와 축척이 일치했습니다.':'자동 재분석으로 구조·축척을 확정하지 못해 공간 생성을 보류했습니다. 원본과 분석 결과는 유지합니다.';
 return {...selected,resolvedVenue,dimensionRechecks,analysis:{...selected.analysis!,stairRegions,issues:[...issues.filter(i=>!i.startsWith('닫힌 경계')),message],selfCheck:{attempts:candidates.length,status:adopted?'stable':'withheld'}}};
}
