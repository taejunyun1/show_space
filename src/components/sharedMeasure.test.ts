import {describe,expect,it} from 'vitest';
import {createDemoProject} from '../domain/model';
import {elevationPoint,measurementDistance,nextMeasurePoints,projectElevationPoint} from './sharedMeasure';
import {fitSharedCameraZoom} from './sharedCamera';

describe('temporary shared measurements',()=>{
  const a={x:0,y:0,z:0},b={x:3000,y:4000,z:0},c={x:900,y:0,z:0};

  it('measures two points and starts a fresh pair on the third point',()=>{
    expect(nextMeasurePoints([],a)).toEqual([a]);
    expect(nextMeasurePoints([a],b)).toEqual([a,b]);
    expect(nextMeasurePoints([a,b],c)).toEqual([c]);
    expect(measurementDistance(a,b)).toBe(5000);
  });

  it('maps both sides of a wall view to the same real-world position',()=>{
    const wall=createDemoProject().walls[0];
    const front=elevationPoint(wall,'front',{x:2000,y:2000});
    const back=elevationPoint(wall,'back',{x:6000,y:2000});
    expect(front).toEqual({x:-2000,y:1200,z:-3000});
    expect(back).toEqual(front);
    expect(projectElevationPoint(wall,'front',front)).toEqual({x:2000,y:2000});
    expect(projectElevationPoint(wall,'back',front)).toEqual({x:6000,y:2000});
  });
});

it('fits a shared camera to a narrow viewer without enlarging the authored view',()=>{
  const walls=createDemoProject().walls;
  expect(fitSharedCameraZoom(40,{width:390,height:524},walls)).toBeLessThan(40);
  expect(fitSharedCameraZoom(40,{width:860,height:640},walls)).toBe(40);
});


it('includes distant and tilted 3D artworks when fitting a shared camera',()=>{
 const walls=createDemoProject().walls,viewport={width:860,height:640};
 const model={widthMm:1200,heightMm:2100,depthMm:900,position:{x:20000,y:100,z:15000},rotation:{x:25,y:35,z:10}};
 expect(fitSharedCameraZoom(40,viewport,walls,[model])).toBeLessThan(fitSharedCameraZoom(40,viewport,walls));
 expect(fitSharedCameraZoom(40,viewport,[],[{...model,heightMm:50000,rotation:{x:0,y:0,z:0}}])).toBeLessThan(fitSharedCameraZoom(40,viewport,[],[model]));
});

it('includes a venue reference model in the shared camera fit',()=>{
 const walls=createDemoProject().walls,viewport={width:860,height:640},reference={sizeMm:[40000,10000,20000] as [number,number,number],sourceOffsetM:[0,0,0] as [number,number,number],positionMm:[20000,0,15000] as [number,number,number],rotationDeg:45,scale:2};expect(fitSharedCameraZoom(40,viewport,walls,[],reference)).toBeLessThan(fitSharedCameraZoom(40,viewport,walls));
});
