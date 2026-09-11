import {detectPlanWalls} from './detectPlanWalls';
import type {PlanFile,PlanPage} from './planImport';
import {analyzePlan} from './analyzePlan';
import {buildAutomaticVenue,extractStructuralWalls} from '../domain/automaticVenue';
export interface PageSelection {previewed?:number;pageNumber:number;page:PlanPage;inspected:number;verified:boolean;failures:{pageNumber:number;message:string}[]}
export function scorePlanPageEvidence(page:PlanPage){
 const profile=page.diagnostics?.rasterProfile;
 const photoOrDark=profile&&(profile.lightFraction<.35||profile.midToneFraction>.35||profile.coloredFraction>.15);
 return Math.min(extractStructuralWalls(page).length,100)*2*(photoOrDark ? .05 : 1)+Math.min(page.analysis?.numericCount??0,50)-(photoOrDark?20:0);
}
async function previewScore(page:PlanPage,signal:AbortSignal){
 const lines=await detectPlanWalls(page.imageUrl,155,.02,signal,1,150);
 const candidate={...page,analysis:{lines,issues:[],numericCount:page.labels?.filter(l=>l.kind==='dimension').length??0,textState:'complete' as const,lineState:'complete' as const}};
 return scorePlanPageEvidence(candidate);
}
/** Process sequentially to bound OCR memory. A failed page cannot stop later
 * pages; cancellation never adopts an unfinished or stale result. */
export async function selectPlanPage(document:PlanFile,signal:AbortSignal,onStage:(stage:string)=>void,detail=false,analyze=analyzePlan,inspectPreview=previewScore):Promise<PageSelection>{
 let best:PageSelection|undefined,bestScore=-Infinity;
 const failures:PageSelection['failures']=[];
 const abort=()=>{if(signal.aborted)throw new Error('페이지 자동 분석을 취소했습니다.');};
 const order=Array.from({length:document.pageCount},(_,i)=>({number:i+1,score:0}));
 let previewed=0,inspected=0;
 if(document.previewPage&&document.pageCount>1){
  // Release each preview before rendering the next. Rank all pages, never just
  // the front of the PDF; previews do not certify a venue or skip later failures.
  for(const entry of order){
   abort();onStage(`${entry.number}/${document.pageCount}페이지에서 도면 후보를 찾고 있습니다.`);
   try{const preview=await document.previewPage(entry.number);abort();entry.score=await inspectPreview(preview,signal);abort();}
   catch(error){abort();entry.score=-Infinity;failures.push({pageNumber:entry.number,message:`미리보기: ${error instanceof Error?error.message:'분석 실패'}`});}
   previewed++;
  }
  order.sort((a,b)=>b.score-a.score||a.number-b.number);
 }
 for(const {number} of order){
  inspected++;
  abort();onStage(`${number}/${document.pageCount}페이지를 자동 분석하고 있습니다.`);
  let rendered:PlanPage|undefined;
  try{
   rendered=await document.renderPage(number,detail);abort();
   const page=await analyze(rendered,signal,stage=>onStage(`${number}/${document.pageCount}페이지 · ${stage}`));abort();
   const verified=!!buildAutomaticVenue(page).project;
   const score=scorePlanPageEvidence(page);
   const result={pageNumber:number,page,inspected,previewed,verified,failures:[...failures]};
   if(verified)return result;
   if(score>bestScore||(score===bestScore&&number<(best?.pageNumber??Infinity))){best=result;bestScore=score;}
  }catch(error){
   abort();failures.push({pageNumber:number,message:error instanceof Error?error.message:'페이지 분석 실패'});
   // Retain a readable source even when recognition fails on every page.
   if(!best&&rendered)best={pageNumber:number,page:{...rendered,analysis:{lines:[],issues:['페이지 자동 분석을 완료하지 못했습니다. 원본을 보존했습니다.'],numericCount:0,textState:'failed',lineState:'failed'}},inspected,previewed,verified:false,failures:[]};
  }
 }
 abort();
 if(!best)throw new Error(`읽을 수 있는 페이지를 찾지 못했습니다 (${failures.length}페이지 실패).`);
 return {...best,inspected,previewed,failures};
}
