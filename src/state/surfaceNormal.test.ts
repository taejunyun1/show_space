import {expect,it} from 'vitest';
import {createDemoProject} from '../domain/model';
import {materialPreset} from '../domain/materials';
import {useEditor} from './editor';
const normal={imageUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=',widthMm:1000,heightMm:500,strength:2};
it('restores independent wall and artwork normals through Undo/Redo and Scene without changing dimensions or locked objects',()=>{
 const s=useEditor.getState(),p=createDemoProject();s.loadProject(p);const material={...materialPreset('matte-paint').material,normal};s.patchWall('wall-a',{material});s.patchArtwork(p.artworks[0].id,{material});s.saveScene('normal scene');
 s.patchWall('wall-a',{material:{...material,normal:{...normal,strength:0}}});s.undo();expect(useEditor.getState().project.walls[0].material?.normal?.strength).toBe(2);s.redo();expect(useEditor.getState().project.walls[0].material?.normal?.strength).toBe(0);
 s.restoreScene('scene-1');expect(useEditor.getState().project.walls[0].material?.normal).toEqual(normal);expect(useEditor.getState().project.artworks[0].material?.normal).toEqual(normal);expect(useEditor.getState().project.walls[0].heightMm).toBe(p.walls[0].heightMm);expect(useEditor.getState().project.artworks[0].widthMm).toBe(p.artworks[0].widthMm);
 s.patchWall('wall-a',{locked:true});const before=structuredClone(useEditor.getState().project);s.patchWall('wall-a',{material:undefined});expect(useEditor.getState().project).toEqual(before);
});
