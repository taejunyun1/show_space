import {it,expect,vi} from 'vitest';
import type {PlanFile,PlanPage} from './planImport';
vi.mock('../domain/automaticVenue',()=>({buildAutomaticVenue:(p:PlanPage)=>({project:p.imageUrl==='verified'?{}:undefined}),extractStructuralWalls:(p:PlanPage)=>p.analysis?.lines??[]}));
import {selectPlanPage} from './selectPlanPage';
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
