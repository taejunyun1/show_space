import {it,expect} from 'vitest';
import {createDemoProject} from './model';
import {solveDimensionConstraints} from './dimensionConstraints';
import {createDimensionMap} from './dimensionMap';
const wall=(id:string,x:number,z:number,x2:number,z2:number)=>({...createDemoProject().walls[0],id,start:{x,z},end:{x:x2,z:z2}});
function fixture(){return solveDimensionConstraints([wall('a',100,50,200,50),wall('b',200,50,400,50),wall('v',100,50,100,250)],[{wallId:'a',labelId:'a',horizontal:true,mm:2000},{wallId:'b',labelId:'b',horizontal:true,mm:1000},{wallId:'v',labelId:'v',horizontal:false,mm:4000}]);}
it('preserves individual dimensions and maps positions back through unequal scales',()=>{
 const map=createDimensionMap(fixture())!;
 expect(map.toWorld({x:200,z:50})).toEqual({x:2000,z:0});
 expect(map.toWorld({x:400,z:250})).toEqual({x:3000,z:4000});
 for(const p of [{x:100,z:50},{x:150,z:80},{x:250,z:200},{x:400,z:250}])expect(map.toSource(map.toWorld(p)!)).toEqual(p);
 expect(map.toWorld({x:99,z:100})).toBeUndefined();expect(map.toSource({x:3001,z:0})).toBeUndefined();
});
it('transforms an installation region crossing a scale knot consistently with its corners',()=>{
 const map=createDimensionMap(fixture())!;
 expect(map.boxToWorld({x:150,y:100,width:150,height:100})).toEqual({x:1000,z:1000,width:1500,depth:2000});
 expect(map.boxToWorld({x:90,y:100,width:100,height:100})).toBeUndefined();
});
it('splits diagonal paths at scale changes instead of connecting only transformed endpoints',()=>{
 const map=createDimensionMap(fixture())!;
 const path=map.segmentToWorld({x:100,z:50},{x:400,z:250})!;
 expect(path).toHaveLength(3);expect(path[1].x).toBe(2000);expect(path[1].z).toBeCloseTo(4000/3);
 expect(map.segmentToWorld({x:99,z:50},{x:400,z:250})).toBeUndefined();
});
it('does not create maps from incomplete or contradictory dimension solutions',()=>{
 const r=fixture();expect(createDimensionMap({...r,status:'underdetermined'})).toBeUndefined();
 expect(createDimensionMap({...r,status:'conflict'})).toBeUndefined();
 r.axes[0].coordinates[1].mm=-100;expect(createDimensionMap(r)).toBeUndefined();
});
