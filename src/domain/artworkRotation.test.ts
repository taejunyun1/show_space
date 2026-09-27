import {describe,expect,it} from 'vitest';
import {draggedArtworkAngle} from './artworkRotation';

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
});
