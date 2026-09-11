import {it,expect} from 'vitest';import {shapeLabelRegions} from './shapeLabelRegions';
const line=(id:string,x:number,y:number,x2:number,y2:number)=>({id,start:{x,y},end:{x:x2,y:y2},thicknessPx:5});
const lines=[line('left',625,1174,625,1502),line('right',698,1174,698,1502),line('top',625,1174,698,1174),line('bottom',65,1502,2120,1502)];
it('locates a border-free OCR crop from a narrow closed outline without a semantic label',()=>{
 expect(shapeLabelRegions(lines,2400,1696)).toEqual([{x:631,y:1180,width:61,height:316,rotations:[90,270]}]);
});
it('does not create crops from open outlines or out-of-image coordinates',()=>{
 expect(shapeLabelRegions(lines.slice(0,3),2400,1696)).toEqual([]);
 expect(shapeLabelRegions(lines,500,500)).toEqual([]);
});
