import {it,expect} from 'vitest';
import {trimThinOverruns} from './trimThinOverruns';
const line=(id:string,x:number,y:number,x2:number,y2:number,thicknessPx=5)=>({id,start:{x,y},end:{x:x2,y:y2},thicknessPx});
it('trims only small overrun caps at actual thick-wall intersections',()=>{
 const input=[line('thin',90,200,310,200,1.5),line('left',100,50,100,210),line('right',300,50,300,210)],before=structuredClone(input);
 expect(trimThinOverruns(input)[0]).toMatchObject({start:{x:100,y:200},end:{x:300,y:200}});expect(input).toEqual(before);
});
it('does not extend a gap, trim large overruns, or extrapolate the supporting wall',()=>{
 for(const thin of [line('gap',110,200,290,200,1.5),line('large',80,200,320,200,1.5)])expect(trimThinOverruns([thin,line('left',100,50,100,210),line('right',300,50,300,210)])[0]).toEqual(thin);
 const thin=line('thin',90,200,310,200,1.5);expect(trimThinOverruns([thin,line('short',100,50,100,190)])[0]).toEqual(thin);
});
it('withholds ambiguous crossings and thin witness support',()=>{
 const thin=line('thin',90,200,310,200,1.5);
 expect(trimThinOverruns([thin,line('a',95,50,95,210),line('b',100,50,100,210)])[0]).toEqual(thin);
 expect(trimThinOverruns([thin,line('witness',100,50,100,210,1)])[0]).toEqual(thin);
});
