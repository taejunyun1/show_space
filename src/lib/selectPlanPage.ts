import type {PlanFile,PlanPage} from './planImport';
import {analyzePlan} from './analyzePlan';
import {buildAutomaticVenue,extractStructuralWalls} from '../domain/automaticVenue';
export interface PageSelection {pageNumber:number;page:PlanPage;inspected:number;verified:boolean;failures:{pageNumber:number;message:string}[]}
/** Process sequentially to bound OCR memory. A failed page cannot stop later
 * pages; cancellation never adopts an unfinished or stale result. */
export async function selectPlanPage(document:PlanFile,signal:AbortSignal,onStage:(stage:string)=>void,detail=false,analyze=analyzePlan):Promise<PageSelection>{
 let best:PageSelection|undefined,bestScore=-Infinity;
 const failures:PageSelection['failures']=[];
 const abort=()=>{if(signal.aborted)throw new Error('페이지 자동 분석을 취소했습니다.');};
 for(let number=1;number<=document.pageCount;number++){
  abort();onStage(`${number}/${document.pageCount}페이지를 자동 분석하고 있습니다.`);
  let rendered:PlanPage|undefined;
  try{
   rendered=await document.renderPage(number,detail);abort();
   const page=await analyze(rendered,signal,stage=>onStage(`${number}/${document.pageCount}페이지 · ${stage}`));abort();
   const verified=!!buildAutomaticVenue(page).project;
   const score=Math.min(extractStructuralWalls(page).length,100)*2+Math.min(page.analysis?.numericCount??0,50);
   const result={pageNumber:number,page,inspected:number,verified,failures:[...failures]};
   if(verified)return result;
   if(score>bestScore){best=result;bestScore=score;}
  }catch(error){
   abort();failures.push({pageNumber:number,message:error instanceof Error?error.message:'페이지 분석 실패'});
   // Retain a readable source even when recognition fails on every page.
   if(!best&&rendered)best={pageNumber:number,page:{...rendered,analysis:{lines:[],issues:['페이지 자동 분석을 완료하지 못했습니다. 원본을 보존했습니다.'],numericCount:0,textState:'failed',lineState:'failed'}},inspected:number,verified:false,failures:[]};
  }
 }
 abort();
 if(!best)throw new Error(`읽을 수 있는 페이지를 찾지 못했습니다 (${failures.length}페이지 실패).`);
 return {...best,inspected:document.pageCount,failures};
}
