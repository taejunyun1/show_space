import {expect,it} from 'vitest';
import {createDemoProject} from './model';
import {solveDimensionConstraints} from './dimensionConstraints';
const wall=(id:string,x:number,z:number,x2:number,z2:number)=>({...createDemoProject().walls[0],id,start:{x,z},end:{x:x2,z:z2}});
const walls=[wall('a',0,0,100,0),wall('b',100,0,300,0),wall('whole',0,0,300,0),wall('v',0,0,0,100)];
const dims=[{wallId:'a',labelId:'a',mm:1000,horizontal:true},{wallId:'b',labelId:'b',mm:1000,horizontal:true},{wallId:'v',labelId:'v',mm:3000,horizontal:false}];
it('solves individually annotated lengths even when pixel proportions differ',()=>{
 const r=solveDimensionConstraints(walls,dims);expect(r.status).toBe('determined');
 expect(r.axes[0].coordinates.map(n=>n.mm)).toEqual([0,1000,2000]);expect(r.axes[1].coordinates.map(n=>n.mm)).toEqual([0,3000]);
});
it('checks whole versus partial cycles and contradictory duplicate labels',()=>{
 expect(solveDimensionConstraints(walls,[...dims,{wallId:'whole',labelId:'total',mm:2000,horizontal:true}]).status).toBe('determined');
 for(const c of [{wallId:'whole',labelId:'total',mm:2100,horizontal:true},{...dims[0],labelId:'duplicate',mm:1100}]){
  const r=solveDimensionConstraints(walls,[...dims,c]);expect(r.status).toBe('conflict');expect(r.axes[0].conflicts.length).toBeGreaterThan(0);
 }
});
it('keeps unmeasured offsets unresolved instead of filling them from pixels',()=>{
 const r=solveDimensionConstraints(walls,dims.slice(1));expect(r.status).toBe('underdetermined');expect(r.axes[0].unresolvedOffsets).toBe(1);
 expect(r.axes[0].coordinates[0].component).not.toBe(r.axes[0].coordinates[1].component);
});
it('rejects a consistent equation set that reverses the drawing order',()=>{
 const r=solveDimensionConstraints(walls,[dims[0],dims[2],{wallId:'whole',labelId:'total',mm:500,horizontal:true}]);
 expect(r.status).toBe('conflict');expect(r.axes[0].reversed).toBe(true);
});
it('handles reversed wall endpoints and rejects diagonal or invalid constraints',()=>{
 expect(solveDimensionConstraints(walls.map(w=>({...w,start:w.end,end:w.start})),dims).status).toBe('determined');
 for(const mm of [NaN,Infinity,0,-1])expect(solveDimensionConstraints(walls,[{...dims[0],mm}]).rejected).toEqual(['a']);
 expect(solveDimensionConstraints([wall('a',0,0,100,100)],[dims[0]]).rejected).toEqual(['a']);
});
it('connects partial witness dimensions inside an unsplit wall to adjacent annotations',()=>{
 const span={id:'partial',wallIds:['whole'],labelId:'partial',horizontal:true,cross:0,from:0,to:100,mm:1000};
 const dimensions=[dims[2],{wallId:'whole',labelId:'whole',mm:3000,horizontal:true}];
 const r=solveDimensionConstraints([walls[2],walls[3]],dimensions,[span]);
 expect(r.status).toBe('determined');expect(r.axes[0].coordinates.map(n=>n.mm)).toEqual([0,1000,3000]);
 expect(r.axes[1].coordinates.map(n=>n.pixel)).toEqual([0,100]);
 expect(solveDimensionConstraints(walls,dims,[{...span,mm:1200}]).status).toBe('conflict');
});
it('rejects invalid spans without creating non-finite coordinates',()=>{
 const span={id:'bad',wallIds:['whole'],labelId:'bad',horizontal:true,cross:0,from:NaN,to:100,mm:1000};
 const r=solveDimensionConstraints(walls,dims,[span]);expect(r.rejected).toEqual(['bad']);
 expect(r.axes.flatMap(a=>a.coordinates).every(n=>Number.isFinite(n.pixel)&&Number.isFinite(n.mm))).toBe(true);
});
it('uses annotation interval endpoints instead of silently stretching the entire wall',()=>{
 const r=solveDimensionConstraints([walls[2],walls[3]],[{...dims[0],wallId:'whole',from:0,to:100}]);
 expect(r.status).toBe('underdetermined');expect(r.axes[0].coordinates.slice(0,2).map(n=>n.mm)).toEqual([0,1000]);
 expect(r.axes[0].coordinates[2].component).not.toBe(r.axes[0].coordinates[0].component);
 expect(solveDimensionConstraints(walls,[{...dims[0],from:-5,to:100}]).rejected).toEqual(['a']);
});
