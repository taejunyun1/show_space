import {it,expect} from 'vitest';
import {detectCornerDoors} from './cornerDoors';
import {selectStructuralLines} from './structuralLines';
import {detectPlanLabels} from './planLabels';
const line=(id:string,x:number,y:number,x2:number,y2:number)=>({id,start:{x,y},end:{x:x2,y:y2},thicknessPx:5});
const lines=[line('main',0,0,200,0),line('step',200,0,200,30),line('return',200,30,270,30),line('other',270,130,270,350)];
const labels=detectPlanLabels([{text:'Front Door',source:'pdf-text',box:{x:280,y:50,width:20,height:60}}]);
it('preserves the short return chain leading to a labelled corner door',()=>{
 expect(detectCornerDoors(lines,labels)).toHaveLength(1);
 expect(selectStructuralLines(lines,100,labels)).toHaveLength(4);
 expect(selectStructuralLines(lines,100,[]).map(l=>l.id)).toEqual(['main','other']);
});
it('withholds unsupported, blocked or ambiguous corner openings',()=>{
 expect(detectCornerDoors(lines,labels.map(l=>({...l,source:'ocr',confidence:60})))).toEqual([]);
 expect(detectCornerDoors([...lines,line('blocking',270,40,270,120)],labels)).toEqual([]);
 expect(detectCornerDoors(lines,[...labels,...labels.map(l=>({...l,id:'duplicate'}))])).toEqual([]);
});

it('keeps a thin two-segment approach only with the door evidence and a structural root',()=>{
 const thin=lines.map(l=>['step','return'].includes(l.id)?{...l,thicknessPx:1.5}:l);
 expect(selectStructuralLines(thin,100,labels)).toHaveLength(4);
 expect(selectStructuralLines(thin,100,[]).map(l=>l.id)).toEqual(['main','other']);
});
