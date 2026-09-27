import {describe,expect,it} from 'vitest';
import {draggedArtworkAngle} from './artworkRotation';
import {artworkRotationPoint} from './artworkRotation';
import {createDemoProject} from './model';

const center={x:0,y:0};
const top={x:0,y:-100};

describe('artwork rotation handle',()=>{
  it('turns counterclockwise from the grabbed handle and snaps each 15 degrees',()=>{
    expect(draggedArtworkAngle(0,center,top,{x:-100,y:0})).toBe(90);
    expect(draggedArtworkAngle(0,center,top,{x:-26,y:-97})).toBe(15);
  });

  it('keeps an exact starting angle until the pointer has moved one snap step',()=>{
    expect(draggedArtworkAngle(37,center,top,top)).toBe(37);
    expect(draggedArtworkAngle(37,center,top,{x:-26,y:-97})).toBe(52);
    expect(draggedArtworkAngle(37,center,top,center)).toBe(37);
  });

  it('continues smoothly across the plus and minus 180 degree boundary',()=>{
    expect(draggedArtworkAngle(170,center,{x:-100,y:-17},{x:-100,y:17})).toBe(-175);
  });

  it('maps 3D rays to the same local rotation plane on either wall face',()=>{
    const project=createDemoProject(),wall=project.walls[0],artwork=project.artworks[0];
    const front=artworkRotationPoint(wall,artwork,{origin:{x:-2600,y:2700,z:3000},direction:{x:0,y:0,z:-1}});
    expect(front).toEqual({x:0,y:-1200});
    const back={...artwork,wallSide:'back' as const};
    const reverse=artworkRotationPoint(wall,back,{origin:{x:-3100,y:2700,z:-9000},direction:{x:0,y:0,z:1}});
    expect(reverse).toEqual({x:500,y:-1200});
    expect(draggedArtworkAngle(0,center,front!,{x:-1200,y:0})).toBe(90);
    expect(artworkRotationPoint(wall,artwork,{origin:{x:0,y:2700,z:3000},direction:{x:1,y:0,z:0}})).toBeNull();
  });
});
