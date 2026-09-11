import {it,expect} from 'vitest';
import {wallAnnotationScale} from './wallAnnotationScale';
import {createDemoProject} from './model';
import {detectPlanLabels} from './planLabels';
const wall=(id:string,x:number,z:number,x2:number,z2:number)=>({...createDemoProject().walls[0],id,start:{x,z},end:{x:x2,z:z2}});
const walls=[wall('top',100,100,900,100),wall('left',100,100,100,700),wall('right',900,100,900,700)];
const labels=detectPlanLabels([{text:'8000 mm',source:'pdf-text',box:{x:450,y:60,width:100,height:20}},{text:'6000 mm',source:'pdf-text',box:{x:60,y:350,width:20,height:100}},{text:'6000 mm',source:'pdf-text',box:{x:920,y:350,width:20,height:100}}]);
it('derives a scale only from at least three unique annotations on both axes',()=>{
 expect(wallAnnotationScale(walls,labels).scale).toBe(10);expect(wallAnnotationScale(walls,labels.slice(0,2)).scale).toBeUndefined();
});
it('withholds inconsistent annotated drawing proportions and ambiguous wall targets',()=>{
 const inconsistent=labels.map((l,i)=>i===1?{...l,text:'5000 mm'}:l);
 expect(wallAnnotationScale(walls,inconsistent).conflict).toBe(true);expect(wallAnnotationScale(walls,inconsistent).scale).toBeUndefined();
 expect(wallAnnotationScale([...walls,{...walls[0],id:'other-top'}],labels).scale).toBeUndefined();
});
it('rejects uncertain readings, height notes and missing units',()=>{
 for(const patch of [{numericConflict:true},{source:'ocr' as const,confidence:60},{text:'HEIGHT 6000 mm'},{text:'6000'}])expect(wallAnnotationScale(walls,labels.map(l=>({...l,...patch}))).scale).toBeUndefined();
});
