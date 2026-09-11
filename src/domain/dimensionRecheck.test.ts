import {expect,it,vi} from 'vitest';
import {assessDimensionRecheck,conflictingDimensionLabels,dimensionRecheckTargets,recheckDimensionReadings} from './dimensionRecheck';
import {detectPlanLabels,type PlanText} from './planLabels';
const box={x:40,y:20,width:15,height:40};
const labels=detectPlanLabels([{text:'180',box,source:'ocr',confidence:96}]).map(l=>({...l,numericConflict:true}));
const text=(value:string,extra:Partial<PlanText>={}):PlanText=>({text:value,box,source:'ocr',confidence:96,...extra});
const target=()=>dimensionRecheckTargets(labels,100,100)[0];
it('selects both sides of conflicting assignments and crops only eligible labels',()=>{
 const matches=[1800,2250].map((mm,i)=>({wallId:'wall',labelId:`l${i}`,mm,horizontal:false,from:20,to:60}));
 expect(conflictingDimensionLabels(matches)).toEqual(['l0','l1']);
 expect(conflictingDimensionLabels(matches.map(m=>({...m,mm:1800})))).toEqual([]);
 expect(target()).toMatchObject({rotations:[90,270],region:{x:28,y:8,width:39,height:64}});
 expect(dimensionRecheckTargets(labels.map(l=>({...l,correctedText:'225'})),100,100)).toEqual([]);
 expect(dimensionRecheckTargets(labels.map(l=>({...l,status:'dismissed'})),100,100)).toEqual([]);
 expect(dimensionRecheckTargets(labels,50,50)).toEqual([]);
});
it('keeps genuine alternate readings and ignores adjacent or oversized OCR regions',()=>{
 expect(assessDimensionRecheck(target(),[[text('180')],[text('081')]]).status).toBe('reading-disagrees');
 expect(assessDimensionRecheck(target(),[[text('180')],[text('225',{box:{...box,x:70}})]]).status).toBe('reading-confirmed');
 expect(assessDimensionRecheck(target(),[[text('225',{box:{x:0,y:0,width:100,height:100}})]]).status).toBe('unreadable');
 expect(assessDimensionRecheck(target(),[[text('225',{confidence:60})]]).status).toBe('unreadable');
 expect(assessDimensionRecheck(target(),[[text('180')]],true).status).toBe('failed');
 expect(assessDimensionRecheck(target(),[[text('225')]],true).status).toBe('reading-disagrees');
});
it('bounds retries, preserves source labels, and stops immediately on cancellation',async()=>{
 const before=structuredClone(labels),read=vi.fn(async()=>[text('180')]);
 const result=await recheckDimensionReadings([target()],new AbortController().signal,read);
 expect(result[0].status).toBe('reading-confirmed');expect(read).toHaveBeenCalledTimes(2);expect(labels).toEqual(before);
 read.mockClear();await recheckDimensionReadings(Array(12).fill(target()),new AbortController().signal,read);expect(read).toHaveBeenCalledTimes(16);
 const controller=new AbortController(),cancel=vi.fn(async()=>{controller.abort();return [];});
 await expect(recheckDimensionReadings([target()],controller.signal,cancel)).rejects.toThrow('취소');expect(cancel).toHaveBeenCalledTimes(1);
});
it('reports failures without discarding the other orientation reading',async()=>{
 const read=vi.fn().mockRejectedValueOnce(new Error('engine')).mockResolvedValueOnce([text('180')]);
 const result=await recheckDimensionReadings([target()],new AbortController().signal,read);
 expect(result[0]).toMatchObject({status:'failed',readings:[{text:'180'}]});
});
