import {describe,expect,it} from 'vitest';
import {createDemoProject} from './model';
import {projectArtworkRay,projectArtworkWallRay,draggedArtworkPlacement} from './artworkDrag3d';

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

  it('keeps a rotated painting fully inside the wall while dragging',()=>{
    const rotated={...artwork,rotationDeg:90};
    expect(draggedArtworkPlacement(rotated,wall,{alongMm:0,centerHeightMm:0},{alongMm:0,centerHeightMm:0})).toEqual({alongMm:600,centerHeightMm:450});
  });

  it('finds the wall and visible face under a 3D drag ray',()=>{
    const wallB=project.walls[1];
    const front=projectArtworkWallRay([wall,wallB],artwork,{origin:{x:1000,y:1600,z:1000},direction:{x:1,y:0,z:0}});
    expect(front).toEqual({wallId:wallB.id,wallSide:'front',alongMm:4000,centerHeightMm:1600});
    const back=projectArtworkWallRay([wall,wallB],artwork,{origin:{x:7000,y:1600,z:1000},direction:{x:-1,y:0,z:0}});
    expect(back).toEqual({wallId:wallB.id,wallSide:'back',alongMm:4000,centerHeightMm:1600});
    expect(projectArtworkWallRay([wallB],artwork,{origin:{x:1000,y:1600,z:8000},direction:{x:1,y:0,z:0}})).toBeNull();
  });
});
