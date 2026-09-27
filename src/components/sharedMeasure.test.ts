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
