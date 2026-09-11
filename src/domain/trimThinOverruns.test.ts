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

it('trims a short thick cap against a long observed wall without following short nearby noise',()=>{
 const cap=line('cap',92,100,210,100,6),long=line('boundary',100,100,40,300,10),noise=line('noise',94,90,94,125,4);
 expect(trimThinOverruns([cap,long,noise],130)[0].start).toEqual({x:100,y:100});
 expect(trimThinOverruns([cap,noise],130)[0]).toEqual(cap);
});

it('trims a thin cap to an observed thin endpoint without extending or moving the support',()=>{
 const cap=line('cap',0,100,103,100,1),support=line('support',100,0,100,100,1);
 const result=trimThinOverruns([cap,support]);
 expect(result[0].end).toEqual({x:100,y:100});expect(result[1]).toEqual(support);
 expect(trimThinOverruns([{...cap,end:{x:98,y:100}},support])[0].end.x).toBe(98);
 expect(trimThinOverruns([{...cap,end:{x:105,y:100}},support])[0].end.x).toBe(105);
 expect(trimThinOverruns([cap,{...support,end:{x:100,y:110}}])[0]).toEqual(cap);
});

it('uses an endpoint established in the first pass to remove the remaining cap',()=>{
 const input=[line('long',0,100,203,100,3.5),line('short',200,0,200,102,5)];
 const once=trimThinOverruns(input,130),twice=trimThinOverruns(once,130);
 expect(once[0].end.x).toBe(203);expect(once[1].end.y).toBe(100);
 expect(twice.map(l=>l.end)).toEqual([{x:200,y:100},{x:200,y:100}]);
});
