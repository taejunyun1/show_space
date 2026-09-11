import {it,expect} from 'vitest';import {separateCoincidentStrokes} from './coincidentStrokes';
const line=(id:string,x:number,y:number,x2:number,y2:number,thicknessPx:number)=>({id,start:{x,y},end:{x:x2,y:y2},thicknessPx});
const thin=line('thin',82,304.5,259,304.5,1),thick=line('thick',81.5,304,155,304,6);
it('retains local thickness and a connected thin tail without a duplicate overlap',()=>{
 const input=[thin,thick],before=structuredClone(input),result=separateCoincidentStrokes(input);
 expect(result).toEqual([{...thin,id:'thin:tail-1',start:{x:155,y:304.5}}, {...thick,start:{x:81.5,y:304.5},end:{x:155,y:304.5}}]);expect(input).toEqual(before);
});
it('preserves separated parallels and ambiguous traces',()=>{
 const apart={...thick,start:{x:81.5,y:302},end:{x:155,y:302}};
 expect(separateCoincidentStrokes([thin,apart])).toEqual([thin,apart]);
 const alternative={...thick,id:'other',start:{x:81.5,y:305},end:{x:155,y:305}};
 expect(separateCoincidentStrokes([thin,thick,alternative])).toEqual([thin,thick,alternative]);
});
it('splits both thin tails and supports reversed vertical traces',()=>{
 const input=[line('thin',10,0,10,200,1),line('thick',10.5,150,10.5,50,5)];
 const result=separateCoincidentStrokes(input);
 expect(result).toHaveLength(3);expect(result.every(l=>l.start.x===10&&l.end.x===10)).toBe(true);
 expect(result.filter(l=>l.thicknessPx===1).map(l=>[l.start.y,l.end.y])).toEqual([[0,50],[150,200]]);
});
