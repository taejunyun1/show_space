import {expect,it} from 'vitest';
import {artworkPosition,createDemoProject} from './model';
import {deriveFloor} from './floor';
import {snapWallTranslation,transformWall, transformWalls} from './wallTransform';

it('moves only the selected wall and carries artwork on that wall',()=>{
 const project=createDemoProject(),before=artworkPosition(project.artworks[0],project.walls[0]);
 const next=transformWall(project,'wall-a',{kind:'move',dx:500,dz:-250});
 expect(next.walls[0].start).toEqual({x:-3500,z:-3250});
 expect(next.walls[1]).toEqual(project.walls[1]);
 expect(artworkPosition(next.artworks[0],next.walls[0]).x-before.x).toBe(500);
 expect(artworkPosition(next.artworks[0],next.walls[0]).z-before.z).toBe(-250);
 expect(project.walls[0].start).toEqual({x:-4000,z:-3000});
});

it('rotates a selected wall around its midpoint without changing length',()=>{
 const project=createDemoProject();
 const next=transformWall(project,'wall-a',{kind:'rotate',radians:Math.PI/2});
 expect(next.walls[0].start.x).toBeCloseTo(0);
 expect(next.walls[0].start.z).toBeCloseTo(-7000);
 expect(next.walls[0].end.x).toBeCloseTo(0);
 expect(next.walls[0].end.z).toBeCloseTo(1000);
});

it('does not transform locked walls or accept invalid offsets',()=>{
 const project=createDemoProject();project.walls[0].locked=true;
 expect(()=>transformWall(project,'wall-a',{kind:'move',dx:20,dz:0})).toThrow(/잠긴/);
 expect(()=>transformWall(project,'wall-a',{kind:'rotate',radians:1})).toThrow(/잠긴/);
 project.walls[0].locked=false;
 expect(()=>transformWall(project,'wall-a',{kind:'move',dx:NaN,dz:0})).toThrow();
});

it('rotates selected walls together around their shared bounding center',()=>{
 const project=createDemoProject();
 const next=transformWalls(project,['wall-a','wall-b'],{kind:'rotate',radians:Math.PI/2});
 expect(next.walls[0].start.x).toBeCloseTo(3000);
 expect(next.walls[0].start.z).toBeCloseTo(-4000);
 expect(next.walls[0].end.x).toBeCloseTo(3000);
 expect(next.walls[0].end.z).toBeCloseTo(4000);
 expect(next.walls[1].start).toEqual(next.walls[0].end);
 expect(next.walls[2]).toEqual(project.walls[2]);
});

it('rejects a group with a locked wall before changing any wall',()=>{
 const project=createDemoProject();project.walls[1].locked=true;
 expect(()=>transformWalls(project,['wall-a','wall-b'],{kind:'move',dx:100,dz:0})).toThrow(/잠긴/);
 expect(project.walls[0].start).toEqual({x:-4000,z:-3000});
});

it('keeps shared boundary corners joined when linked wall movement is enabled',()=>{
 const project=createDemoProject();
 const next=transformWalls(project,['wall-c'],{kind:'move',dx:580,dz:2060},true);
 expect(next.walls[1].end).toEqual(next.walls[2].start);
 expect(next.walls[3].start).toEqual(next.walls[2].end);
 expect(deriveFloor(next.walls).surfaces).toHaveLength(1);
 expect(deriveFloor(next.walls).areaMm2).toBeGreaterThan(0);
});

it('refuses linked movement when a connected wall is locked',()=>{
 const project=createDemoProject();project.walls[1].locked=true;
 expect(()=>transformWalls(project,['wall-c'],{kind:'move',dx:100,dz:0},true)).toThrow(/잠긴/);
 expect(project.walls[1].end).toEqual({x:4000,z:3000});
});

it('snaps a 3D wall translation to an unrelated endpoint before the grid',()=>{
 const project=createDemoProject();
 project.walls.push({...project.walls[0],id:'partition-x',role:'partition',start:{x:-3500,z:-2700},end:{x:-3500,z:-2200}});
 expect(snapWallTranslation(project,['wall-a'],{x:430,z:270},true)).toEqual({x:500,z:300});
});

it('snaps a 3D wall translation to a 100 mm grid without sticking to moving shared corners',()=>{
 expect(snapWallTranslation(createDemoProject(),['wall-c'],{x:80,z:70},true)).toEqual({x:100,z:100});
});
