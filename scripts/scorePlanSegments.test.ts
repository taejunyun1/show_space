import {it,expect} from 'vitest';
import {scorePlanSegments} from './scorePlanSegments';
const target={id:'wall',description:'test wall',start:{x:0,y:0},end:{x:100,y:0}};
it('counts interval coverage once and retains missing gaps',()=>{
 const partial={start:{x:0,y:0},end:{x:40,y:0}},tail={start:{x:60,y:0},end:{x:100,y:0}};
 expect(scorePlanSegments([target],[partial,partial,tail],2)[0].coverage).toBe(.8);
 expect(scorePlanSegments([target],[{start:{x:100,y:0},end:{x:0,y:0}}],2)[0].matched).toBe(true);
});
it('rejects displaced and perpendicular lines rather than counting proximity as coverage',()=>{
 expect(scorePlanSegments([target],[{start:{x:0,y:10},end:{x:100,y:10}},{start:{x:50,y:-100},end:{x:50,y:100}}],2)[0].coverage).toBe(0);
});
