import {expect,it} from 'vitest';
import {createDemoProject,wallLength} from './model';
import {addWallBetween,snapPlanPoint,updateWallEndpoint} from './wallEditing';

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
