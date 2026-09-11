import {it,expect} from 'vitest';
import {detectPlanLabels} from './planLabels';
import {readCeilingHeight} from './ceilingHeight';
const labels=(...texts:string[])=>detectPlanLabels(texts.map(text=>({text,source:'pdf-text' as const,box:{x:0,y:0,width:200,height:20}})));
it('reads explicit ceiling units and an unambiguous page unit',()=>{
 for(const text of ['Ceiling height: 275cm','천장 높이 2.75 m','층고: 2750 mm'])expect(readCeilingHeight(labels(text)).heightMm).toBe(2750);
 expect(readCeilingHeight(labels('All measurements in cm','층고: 275')).heightMm).toBe(2750);
});
it('withholds differing, uncertain or ambiguous ceiling declarations',()=>{
 expect(readCeilingHeight(labels('Ceiling height: 275cm','Ceiling height: 300cm')).conflict).toBe(true);
 for(const patch of [{numericConflict:true},{source:'ocr' as const,confidence:60},{text:'Ceiling height: 2,750 mm'}])expect(readCeilingHeight(labels('Ceiling height: 275cm').map(l=>({...l,...patch}))).heightMm).toBeUndefined();
});
it('does not treat object heights or local area notes as a global ceiling',()=>{
 expect(readCeilingHeight(labels('Door height: 210cm','Office ceiling height: 250cm','Ceiling height: 275cm in office','Height 300cm')).heightMm).toBeUndefined();
 expect(readCeilingHeight(labels('Ceiling height: 275cm','Ceiling height: 275cm')).heightMm).toBe(2750);
});
