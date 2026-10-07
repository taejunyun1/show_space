import {expect,it} from 'vitest';
import {createDemoProject} from './model';
import {appendSceneSnapshot} from './sceneSnapshot';
import {sceneProject} from './sceneProject';
import {materialPreset} from './materials';
import {DEFAULT_OUTDOOR} from './outdoor';
const preview={imageUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=',widthPx:1,heightPx:1,view:'3d' as const};
it('atomically appends the captured geometry while keeping concurrent current edits and unique scene ids',()=>{
 const source=createDemoProject();source.floorMaterial=materialPreset('wood').material;source.outdoor={...DEFAULT_OUTDOOR,time:'17:00'};
 const current=appendSceneSnapshot(source,source,'Existing');current.walls[0].color='#123456';current.artworks[0].alongMm=2100;current.outdoor!.time='20:00';
 const before=structuredClone(current),camera={position:[1,2,3] as [number,number,number],target:[0,1,0] as [number,number,number],zoom:60};
 const result=appendSceneSnapshot(current,source,'Captured',camera,preview),restored=sceneProject(result,result.scenes[1]);
 expect({...result,scenes:current.scenes}).toEqual(current);expect(restored.walls).toEqual(source.walls);expect(restored.artworks).toEqual(source.artworks);expect(restored.outdoor).toEqual(source.outdoor);expect(restored.floorMaterial).toEqual(source.floorMaterial);
 expect(result.scenes.map(s=>s.id)).toEqual(['scene-1','scene-2']);expect(current).toEqual(before);
 preview.widthPx=1;camera.position[0]=99;expect(result.scenes[1].cameraView!.position[0]).toBe(1);
 expect(()=>appendSceneSnapshot({...current,id:'other'},source,'Stale',undefined,preview)).toThrow(/프로젝트/);
});
