import {expect,it} from 'vitest';
import {createDemoProject} from '../domain/model';
import {materialPreset} from '../domain/materials';
import {useEditor} from './editor';
import {exportProjectPackage,importProjectPackage,projectImageUrls} from '../lib/projectPackage';
const texture={imageUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=',widthMm:500,heightMm:250};
it('restores texture scales through Undo, locked wall rejection, Scene, JSON and asset backup',async()=>{
 const s=useEditor.getState(),p=createDemoProject();p.artworks=[];s.loadProject(p);s.patchWall('wall-a',{material:{...materialPreset('wood').material,texture}});s.patchProject({floorMaterial:{...materialPreset('wood').material,texture:{...texture,widthMm:1000}}});s.saveScene('texture scene');const saved=structuredClone(useEditor.getState().project);
 s.patchWall('wall-a',{material:{...saved.walls[0].material!,texture:{...texture,widthMm:750}}});s.undo();expect(useEditor.getState().project.walls[0].material?.texture?.widthMm).toBe(500);s.redo();expect(useEditor.getState().project.walls[0].material?.texture?.widthMm).toBe(750);s.restoreScene('scene-1');expect(useEditor.getState().project.walls[0].material?.texture).toEqual(texture);
 s.patchWall('wall-a',{locked:true});const locked=structuredClone(useEditor.getState().project);s.patchWall('wall-a',{material:materialPreset('white-paint').material});expect(useEditor.getState().project).toEqual(locked);
 expect(projectImageUrls(saved)).toEqual([texture.imageUrl]);const backup=await exportProjectPackage(saved,async()=>{throw new Error('No sample asset expected');});expect(await importProjectPackage(await backup.arrayBuffer())).toEqual(saved);
});
