import {expect,it} from 'vitest';
import {artworkPosition,createDemoProject} from './model';
import {transformWall} from './wallTransform';

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
