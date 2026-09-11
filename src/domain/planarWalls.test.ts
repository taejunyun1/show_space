import {expect,it} from 'vitest';
import {splitWallJunctions} from './planarWalls';
import type {Wall} from './types';
const wall=(id:string,x:number,z:number,x2:number,z2:number):Wall=>({id,name:id,role:'boundary',start:{x,z},end:{x:x2,z:z2},heightMm:3000,thicknessMm:150,visible:true,locked:false,color:'#fff',note:''});
it('coalesces numerically coincident crossings instead of rejecting the complete structure',()=>{
 const input=[wall('h',0,0,100,0),wall('v',50,-50,50,50),wall('d',0,-50,100,50.00000002)];
 for(const walls of [input,[...input].reverse().map(w=>({...w,start:w.end,end:w.start}))]){
  const split=splitWallJunctions(walls)!;
  expect(split).toHaveLength(6);
  expect(split.every(w=>Math.hypot(w.end.x-w.start.x,w.end.z-w.start.z)>1)).toBe(true);
  expect(split.flatMap(w=>[w.start,w.end]).filter(p=>p.x===50&&p.z===0)).toHaveLength(6);
 }
});
it('still rejects source walls that collapse below coordinate precision and keeps distinct nearby junctions',()=>{
 expect(splitWallJunctions([wall('tiny',0,0,.00000001,0)])).toBeUndefined();
 const split=splitWallJunctions([wall('h',0,0,100,0),wall('a',50,-10,50,10),wall('b',50.001,-10,50.001,10)])!;
 expect(split).toHaveLength(7);
 expect(split.some(w=>Math.abs(Math.hypot(w.end.x-w.start.x,w.end.z-w.start.z)-.001)<1e-8)).toBe(true);
});
