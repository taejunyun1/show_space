import {expect,it} from 'vitest';
import {createDemoProject,parseProject} from './model';
import {addMeasurement,fixedAnchor,measureDistance,resolveMeasurement,wallAnchor} from './measurements';

it('measures a known 3-4-5 triangle in model millimetres',()=>{
 expect(measureDistance({x:0,y:0,z:0},{x:3000,y:4000,z:0})).toBe(5000);
});

it('keeps a wall endpoint measurement attached through movement and rotation',()=>{
 const project=createDemoProject();
 const anchored=wallAnchor(project,'wall-a',{x:4000,y:0,z:-3000});
 const dimension=addMeasurement(project,'plan',anchored,fixedAnchor({x:4000,y:0,z:0})).dimensions![0];
 const moved={...project,walls:project.walls.map(w=>w.id==='wall-a'?{...w,start:{x:0,z:0},end:{x:8000,z:0}}:w)};
 expect(resolveMeasurement(moved,dimension).start).toEqual({x:8000,y:0,z:0});
 expect(resolveMeasurement(moved,dimension).distanceMm).toBe(4000);
 expect(resolveMeasurement(project,dimension).distanceMm).toBe(3000);
});

it('preserves a detached anchor fallback and round-trips saved dimensions',()=>{
 const project=createDemoProject();
 const start=wallAnchor(project,'wall-c',{x:4000,y:1000,z:3000});
 const next=addMeasurement(project,'3d',start,fixedAnchor({x:4000,y:4000,z:3000}));
 expect(parseProject(next).dimensions).toEqual(next.dimensions);
 const missing={...next,walls:next.walls.filter(w=>w.id!=='wall-c')};
 const result=resolveMeasurement(missing,next.dimensions![0]);
 expect(result.detached).toBe(true);
 expect(result.start).toEqual({x:4000,y:1000,z:3000});
});

it('rejects malformed persisted measurement coordinates',()=>{
 const project=createDemoProject();
 const next=addMeasurement(project,'plan',fixedAnchor({x:0,y:0,z:0}),fixedAnchor({x:1000,y:0,z:0}));
 next.dimensions![0].start.fallback.x=Number.NaN;
 expect(()=>parseProject(next)).toThrow(/치수/);
});
