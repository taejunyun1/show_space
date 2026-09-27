import {describe,expect,it} from 'vitest';
import {createDemoProject} from './model';
import {projectArtworkRay,draggedArtworkPlacement} from './artworkDrag3d';

const project=createDemoProject();
const wall=project.walls[0];
const artwork=project.artworks[0];

describe('3D artwork drag projection',()=>{
  it('projects the pointer onto the artwork face without using a stale mesh hit',()=>{
    const hit=projectArtworkRay(wall,artwork,{origin:{x:-2600,y:1520,z:3000},direction:{x:0,y:0,z:-1}});
    expect(hit).toEqual({alongMm:1400,centerHeightMm:1520});
    expect(projectArtworkRay(wall,artwork,{origin:{x:0,y:0,z:3000},direction:{x:1,y:0,z:0}})).toBeNull();
  });

  it('keeps the grabbed point under the pointer and snaps within the wall',()=>{
    const grab={alongMm:-100,centerHeightMm:-20};
    expect(draggedArtworkPlacement(artwork,wall,grab,{alongMm:2616,centerHeightMm:1853})).toEqual({alongMm:2520,centerHeightMm:1830});
    expect(draggedArtworkPlacement(artwork,wall,grab,{alongMm:99999,centerHeightMm:-200})).toEqual({alongMm:7550,centerHeightMm:600});
  });

  it('projects an artwork on the reverse face from the other side',()=>{
    const hit=projectArtworkRay(wall,{...artwork,wallSide:'back'},{origin:{x:-1000,y:1700,z:-9000},direction:{x:0,y:0,z:1}});
    expect(hit).toEqual({alongMm:3000,centerHeightMm:1700});
  });
});
