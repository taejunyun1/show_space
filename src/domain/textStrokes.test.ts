import {it,expect} from 'vitest';
import {withoutTextStrokes} from './textStrokes';
const line=(id:string,x:number,y:number,x2:number,y2:number,thicknessPx:number)=>({id,start:{x,y},end:{x:x2,y:y2},thicknessPx});
it('separates contained text strokes while preserving through-walls and thick structure',()=>{
 const text=line('letter',105,105,105,125,3),wall=line('through',0,110,400,110,3),thick=line('thick',120,105,120,125,15);
 expect(withoutTextStrokes([text,wall,thick],[{x:100,y:100,width:200,height:40}])).toEqual([wall,thick]);
 expect(withoutTextStrokes([{...text,solidSupportThicknessPx:20}],[{x:100,y:100,width:200,height:40}])).toHaveLength(1);
 expect(withoutTextStrokes([text])).toEqual([text]);
 expect(withoutTextStrokes([text],[{x:100,y:100,width:NaN,height:40}])).toEqual([text]);
});
