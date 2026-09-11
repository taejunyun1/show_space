import {it,expect} from 'vitest';
import {detectStairAccess} from './stairAccess';
import {createDemoProject} from './model';
const wall=(id:string,x:number,z:number,x2:number,z2:number)=>({...createDemoProject().walls[0],id,start:{x,z},end:{x:x2,z:z2}});
const walls=[wall('upper',100,0,100,100),wall('lower',100,300,100,450),wall('rail-a',20,100,100,100),wall('rail-b',20,300,100,300),wall('tread-a',40,100,40,300),wall('tread-b',80,100,80,300)];
const regions=[{id:'r',kind:'stairs' as const,labelId:'stairs',lineIds:['t1','t2','t3'],box:{x:40,y:100,width:40,height:200}}];
it('uses wall endpoints for the stair passage and identifies only stair-side strokes',()=>{
 const result=detectStairAccess(walls,regions,300);
 expect(result).toHaveLength(1);expect(result[0].wall.start).toEqual({x:100,z:100});expect(result[0].wall.end).toEqual({x:100,z:300});
 expect(result[0].excludedWallIds.sort()).toEqual(['rail-a','rail-b','tread-a','tread-b']);
});
it('requires matching tread extent, side rails and an unambiguous location',()=>{
 expect(detectStairAccess(walls,[],300)).toEqual([]);
 expect(detectStairAccess(walls.filter(w=>w.id!=='rail-b'),regions,300)).toEqual([]);
 expect(detectStairAccess(walls,regions.map(r=>({...r,box:{...r.box,height:80}})),300)).toEqual([]);
 expect(detectStairAccess(walls,[...regions,{...regions[0],id:'competing'}],300)).toEqual([]);
});
