import {expect,it} from 'vitest';
import {createDemoProject} from './model';
import {openingAxisEvidence} from './openingAxisEvidence';
import {solveDimensionConstraints} from './dimensionConstraints';
const wall=(id:string,x:number,z:number,x2:number,z2:number)=>({...createDemoProject().walls[0],id,start:{x,z},end:{x:x2,z:z2}});
it('joins slightly misaligned parallel jamb axes only across a known gap',()=>{
 const walls=[wall('a',0,0,0,100),wall('b',1,200,1,300)],gaps=[{wall:wall('gap',0,100,1,200)}];
 expect(openingAxisEvidence(walls,gaps)).toEqual([{axis:'x',from:0,to:1,sourceId:'gap'}]);
 expect(openingAxisEvidence(walls,[])).toEqual([]);
 expect(openingAxisEvidence([walls[0],wall('b',1,200,50,200)],gaps)).toEqual([]);
 expect(openingAxisEvidence([walls[0],wall('b',4,200,4,300)],[{wall:wall('gap',0,100,4,200)}])).toEqual([]);
});
it('connects dimension chains through equality evidence without inferring a gap width',()=>{
 const walls=[wall('a',0,0,100,0),wall('b',1,200,300,200)];
 const dims=[{wallId:'a',labelId:'a',mm:1000,horizontal:true},{wallId:'b',labelId:'b',mm:3000,horizontal:true}];
 const r=solveDimensionConstraints(walls,dims,[],[{axis:'x',from:0,to:1,sourceId:'window'}]);
 expect(r.axes[0].status).toBe('determined');expect(r.axes[0].coordinates.map(p=>p.mm)).toEqual([0,1000,3000]);expect(r.axes[1].status).toBe('underdetermined');
 expect(solveDimensionConstraints(walls,dims).axes[0].status).toBe('underdetermined');
});
it('rejects excessive alias drift and a measured positive length collapsed by equality',()=>{
 const walls=[wall('a',0,0,1,0)],dims=[{wallId:'a',labelId:'a',mm:100,horizontal:true}];
 expect(solveDimensionConstraints(walls,dims,[],[{axis:'x',from:0,to:1,sourceId:'gap'}]).status).toBe('conflict');
 const r=solveDimensionConstraints(walls,[],[],[{axis:'x',from:0,to:2,sourceId:'first'},{axis:'x',from:2,to:4,sourceId:'second'}]);
 expect(r.rejected).toContain('second');
});
