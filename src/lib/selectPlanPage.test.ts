import {it,expect,vi} from 'vitest';
import type {PlanFile,PlanPage} from './planImport';
vi.mock('../domain/automaticVenue',()=>({buildAutomaticVenue:(p:PlanPage)=>({project:p.imageUrl==='verified'?{}:undefined}),extractStructuralWalls:(p:PlanPage)=>p.analysis?.lines??[]}));
import {selectPlanPage,scorePlanPageEvidence} from './selectPlanPage';
const page=(imageUrl:string,numericCount=0):PlanPage=>({imageUrl,widthPx:100,heightPx:100,analysis:{lines:[],issues:[],textState:'complete',lineState:'complete',numericCount}});
const analyze=async(p:PlanPage)=>p;
function document(pages:(PlanPage|Error)[]):PlanFile{return {pageCount:pages.length,renderPage:vi.fn(async(n:number)=>{const p=pages[n-1];if(p instanceof Error)throw p;return p;}),destroy:async()=>{}};}
it('skips failed pages and stops once a verified venue is found',async()=>{
 const doc=document([new Error('broken'),page('cover'),page('verified'),page('unused')]);
 const result=await selectPlanPage(doc,new AbortController().signal,()=>{},false,analyze);
 expect(result.pageNumber).toBe(3);expect(result.verified).toBe(true);expect(result.failures).toHaveLength(1);expect(doc.renderPage).toHaveBeenCalledTimes(3);
});
it('selects a deterministic evidence-rich fallback without claiming verification',async()=>{
 const result=await selectPlanPage(document([page('cover'),page('plan',12),page('tie',12)]),new AbortController().signal,()=>{},false,analyze);
 expect(result.pageNumber).toBe(2);expect(result.verified).toBe(false);expect(result.inspected).toBe(3);
});
it('retains a readable original after OCR failures and rejects an entirely unreadable file',async()=>{
 const result=await selectPlanPage(document([page('source'),new Error('broken')]),new AbortController().signal,()=>{},false,async()=>{throw new Error('OCR failed');});
 expect(result.page.imageUrl).toBe('source');expect(result.failures).toHaveLength(2);
 await expect(selectPlanPage(document([new Error('broken')]),new AbortController().signal,()=>{},false,analyze)).rejects.toThrow('읽을 수 있는');
});
it('does not adopt a result when cancelled during analysis',async()=>{
 const controller=new AbortController(),doc=document([page('verified'),page('next')]);
 await expect(selectPlanPage(doc,controller.signal,()=>{},false,async p=>{controller.abort();return p;})).rejects.toThrow('취소');
 expect(doc.renderPage).toHaveBeenCalledTimes(1);
});

it('ranks every preview before expensive analysis and can start with a late verified page',async()=>{
 const pages=[page('cover'),page('photo'),page('verified')],doc=document(pages);
 doc.previewPage=vi.fn(async n=>pages[n-1]);
 const deep=vi.fn(analyze);
 const result=await selectPlanPage(doc,new AbortController().signal,()=>{},false,deep,async p=>p.imageUrl==='verified'?100:0);
 expect(doc.previewPage).toHaveBeenCalledTimes(3);expect(doc.renderPage).toHaveBeenCalledExactlyOnceWith(3,false);
 expect(deep).toHaveBeenCalledTimes(1);expect(result).toMatchObject({pageNumber:3,previewed:3,inspected:1,verified:true});
});
it('falls through a misleading preview and retries a page whose preview failed',async()=>{
 const pages=[page('verified'),page('misleading')],doc=document(pages);
 doc.previewPage=async n=>{if(n===1)throw new Error('preview only');return pages[n-1];};
 const result=await selectPlanPage(doc,new AbortController().signal,()=>{},false,analyze,async()=>100);
 expect(result).toMatchObject({pageNumber:1,inspected:2,verified:true});expect(result.failures).toHaveLength(1);
});
it('cancels during preview without starting full analysis',async()=>{
 const controller=new AbortController(),doc=document([page('cover'),page('verified')]);doc.previewPage=async n=>page(String(n));
 await expect(selectPlanPage(doc,controller.signal,()=>{},false,analyze,async()=>{controller.abort();return 1;})).rejects.toThrow('취소');
 expect(doc.renderPage).not.toHaveBeenCalled();
});

it('reduces photo-like line evidence without excluding that page from eventual verification',async()=>{
 const photo={...page('verified'),diagnostics:{warnings:[],rasterProfile:{lightFraction:.1,midToneFraction:.6,coloredFraction:.3}}};
 const doc=document([photo,page('line-art')]);doc.previewPage=async n=>n===1?photo:page('line-art');
 const result=await selectPlanPage(doc,new AbortController().signal,()=>{},false,analyze,async p=>scorePlanPageEvidence(p));
 expect(result).toMatchObject({pageNumber:1,inspected:2,verified:true});
});
