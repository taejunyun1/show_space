import {it,expect} from 'vitest';
import {classifyAutomaticWalls} from './automaticWallTopology';
import {deriveFloor} from './floor';
import type {Wall} from './types';
const wall=(x:number,z:number,x2:number,z2:number):Wall=>({id:`${x}:${z}:${x2}:${z2}`,name:'wall',role:'boundary',start:{x,z},end:{x:x2,z:z2},heightMm:3000,thicknessMm:150,visible:true,locked:false,color:'#fff',note:''});
const loop=(points:number[][])=>points.map((p,i)=>wall(...[...p,...points[(i+1)%points.length]] as [number,number,number,number]));
const box=()=>loop([[0,0],[100,0],[100,100],[0,100]]);
it('retains freestanding and attached internal branches without changing the floor',()=>{
 const input=[...box(),wall(20,20,80,20),wall(0,0,30,30),wall(30,30,70,30)];
 const before=structuredClone(input),result=classifyAutomaticWalls(input)!;
 expect(result.filter(w=>w.role==='partition')).toHaveLength(4);expect(deriveFloor(result).areaMm2).toBe(10000);expect(input).toEqual(before);
});
it('supports an internal wall touching the middle of an outer wall',()=>{expect(classifyAutomaticWalls([...box(),wall(50,0,50,70)])?.at(-1)?.role).toBe('partition');});
it('withholds external branches and open perimeters',()=>{expect(classifyAutomaticWalls([...box(),wall(0,0,-50,0)])).toBeUndefined();expect(classifyAutomaticWalls(box().slice(1))).toBeUndefined();});
it('rejects a partition crossing a concave exterior even when both endpoints are inside',()=>{
 const boundary=loop([[0,0],[100,0],[100,100],[70,100],[70,30],[30,30],[30,100],[0,100]]);
 expect(classifyAutomaticWalls([...boundary,wall(10,80,90,80)])).toBeUndefined();
});
it('preserves courtyards and rejects walls crossing them',()=>{const boundary=[...box(),...loop([[40,40],[60,40],[60,60],[40,60]])];expect(deriveFloor(classifyAutomaticWalls(boundary)!).areaMm2).toBe(9600);expect(classifyAutomaticWalls([...boundary,wall(10,50,90,50)])).toBeUndefined();});
it('separates a diagonal room divider from the outer floor boundary',()=>{const result=classifyAutomaticWalls([...box(),wall(0,0,100,100)])!;expect(result.at(-1)?.role).toBe('partition');expect(deriveFloor(result).areaMm2).toBe(10000);});
it('splits T junctions and retains two adjacent rooms as one floor',()=>{
 const input=[...loop([[0,0],[50,0],[100,0],[100,100],[50,100],[0,100]]),wall(50,0,50,100)];
 const result=classifyAutomaticWalls(input)!;
 expect(result).toBeDefined();expect(deriveFloor(result).areaMm2).toBe(10000);expect(result.filter(w=>w.role==='partition')).toHaveLength(1);
});
it('splits crossing interior walls and attaches them to boundary midpoints',()=>{
 const result=classifyAutomaticWalls([...box(),wall(50,0,50,100),wall(0,50,100,50)])!;
 expect(result).toBeDefined();expect(result.filter(w=>w.role==='boundary')).toHaveLength(8);expect(result.filter(w=>w.role==='partition')).toHaveLength(4);expect(deriveFloor(result).areaMm2).toBe(10000);
});
it('deduplicates compatible reversed and partially overlapping wall evidence',()=>{
 expect(classifyAutomaticWalls([...box(),wall(100,0,0,0)])).toHaveLength(4);
 expect(deriveFloor(classifyAutomaticWalls([...box(),wall(25,0,75,0)])!).areaMm2).toBe(10000);
 expect(classifyAutomaticWalls([...box(),{...wall(25,0,75,0),heightMm:2500}])).toBeUndefined();
 expect(classifyAutomaticWalls([...box(),{...wall(100,0,0,0),thicknessMm:200}])).toBeUndefined();
});
it('gives the same floor after reordering and reversing a shared-room graph',()=>{const input=[...loop([[0,0],[50,0],[100,0],[100,100],[50,100],[0,100]]),wall(50,0,50,100)];for(const candidate of [input,[...input].reverse().map(w=>({...w,start:w.end,end:w.start}))]){const result=classifyAutomaticWalls(candidate)!;expect(deriveFloor(result).areaMm2).toBe(10000);expect(result.filter(w=>w.role==='partition')).toHaveLength(1);}});
it('withholds two closed spaces joined by an ambiguous bridge',()=>{expect(classifyAutomaticWalls([...box(),...loop([[200,0],[300,0],[300,100],[200,100]]),wall(100,0,200,0)])).toBeUndefined();});
