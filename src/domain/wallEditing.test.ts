import {expect,it} from 'vitest';
import {createDemoProject,wallLength} from './model';
import {addWallBetween,snapPlanPoint,updateWallEndpoint,wallEndAtLength} from './wallEditing';

it('keeps a diagonal direction and decimal length without rounding back to the grid',()=>{
 const start={x:125.5,z:-200},end=wallEndAtLength(start,{x:425.5,z:200},1234.5);
 expect(end.x).toBeCloseTo(866.2,8);
 expect(end.z).toBeCloseTo(787.6,8);
 const next=addWallBetween(createDemoProject(),start,end);
 expect(wallLength(next.walls.at(-1)!)).toBeCloseTo(1234.5,8);
});

it('keeps an axis and negative direction and chains from the actual computed endpoint',()=>{
 const start={x:1000,z:2000},end=wallEndAtLength(start,{x:0,z:2000},2500);
 expect(end).toEqual({x:-1500,z:2000});
 expect(wallEndAtLength(end,{x:-1500,z:1000},1800)).toEqual({x:-1500,z:200});
});

it('does not let a nearby picked endpoint override an explicitly typed length',()=>{
 const picked=snapPlanPoint({x:3990,z:-3000},createDemoProject().walls,{x:0,z:-3000},100);
 expect(picked.kind).toBe('endpoint');
 expect(wallEndAtLength({x:0,z:-3000},picked.point,3999.5)).toEqual({x:3999.5,z:-3000});
});

it('rejects invalid numeric lengths, unresolved directions and nonfinite coordinates',()=>{
 for(const length of [0,-1,.5,NaN,Infinity])expect(()=>wallEndAtLength({x:0,z:0},{x:10,z:0},length)).toThrow(/길이/);
 expect(()=>wallEndAtLength({x:10,z:10},{x:10,z:10},1000)).toThrow(/두 번째/);
 expect(()=>wallEndAtLength({x:Infinity,z:0},{x:10,z:0},1000)).toThrow(/좌표/);
});

it('draws an exact wall between two picked points and rejects zero length',()=>{
 const project=createDemoProject();
 const next=addWallBetween(project,{x:0,z:0},{x:2500,z:1800});
 expect(next.walls).toHaveLength(5);
 expect(next.walls[4]).toMatchObject({role:'partition',start:{x:0,z:0},end:{x:2500,z:1800},heightMm:3200,thicknessMm:160});
 expect(wallLength(next.walls[4])).toBeCloseTo(3080.584,2);
 expect(()=>addWallBetween(project,{x:10,z:10},{x:10,z:10})).toThrow(/길이/);
});

it('snaps endpoints before axes and grid and leaves distant axes alone',()=>{
 const walls=createDemoProject().walls;
 expect(snapPlanPoint({x:3950,z:-2960},walls,undefined,100)).toEqual({point:{x:4000,z:-3000},kind:'endpoint'});
 expect(snapPlanPoint({x:1080,z:430},[],{x:1000,z:0},100)).toEqual({point:{x:1000,z:400},kind:'axis'});
 expect(snapPlanPoint({x:1230,z:460},[],{x:0,z:0},100)).toEqual({point:{x:1200,z:500},kind:'grid'});
});

it('can detach one endpoint or move a connected corner',()=>{
 const project=createDemoProject();
 const separate=updateWallEndpoint(project,'wall-a','end',{x:4300,z:-3000},false);
 expect(separate.walls[0].end.x).toBe(4300);
 expect(separate.walls[1].start.x).toBe(4000);
 const joined=updateWallEndpoint(project,'wall-a','end',{x:4300,z:-3000},true);
 expect(joined.walls[1].start.x).toBe(4300);
});
