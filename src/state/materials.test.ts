import {beforeEach,expect,it} from 'vitest';
import {createDemoProject,parseProject} from '../domain/model';
import {materialPreset} from '../domain/materials';
import {useEditor} from './editor';
import {pdfSections} from '../lib/pdfLayout';
import {exportProjectPackage,importProjectPackage} from '../lib/projectPackage';
beforeEach(()=>{useEditor.getState().loadProject(createDemoProject());});
const m=(id:Parameters<typeof materialPreset>[0])=>materialPreset(id).material;
it('undoes and redoes surface edits and blocks changes on locked objects',()=>{
 const s=useEditor.getState(),before=s.project;s.patchProject({floorMaterial:m('concrete')});s.undo();expect(useEditor.getState().project).toEqual(before);s.redo();expect(useEditor.getState().project.floorMaterial).toEqual(m('concrete'));
 s.patchWall('wall-a',{material:m('glass')});s.patchArtwork('artwork-1',{material:m('canvas')});s.patchWall('wall-a',{locked:true});s.patchArtwork('artwork-1',{locked:true});const locked=structuredClone(useEditor.getState().project),history=useEditor.getState().past.length;
 s.patchWall('wall-a',{material:m('metal')});s.patchArtwork('artwork-1',{material:m('metal')});expect(useEditor.getState().project).toEqual(locked);expect(useEditor.getState().past).toHaveLength(history);
});
it('restores Scene surface snapshots, clears new floor finishes and preserves legacy floor settings',()=>{
 const s=useEditor.getState();s.saveScene('old finish');s.patchProject({floorColor:'#334455',floorMaterial:m('epoxy-floor')});s.patchWall('wall-a',{material:m('metal')});s.patchArtwork('artwork-1',{material:m('glossy-photo-paper')});s.saveScene('new finish');const finished=structuredClone(useEditor.getState().project);
 s.restoreScene('scene-1');expect(useEditor.getState().project.floorMaterial).toBeUndefined();expect(useEditor.getState().project.walls[0].material).toBeUndefined();expect(useEditor.getState().project.floorColor).toBe(createDemoProject().floorColor);
 s.restoreScene('scene-2');expect(useEditor.getState().project.floorMaterial).toEqual(finished.floorMaterial);expect(useEditor.getState().project.walls).toEqual(finished.walls);expect(useEditor.getState().project.artworks).toEqual(finished.artworks);
 const legacy=structuredClone(finished);delete legacy.scenes[0].structure!.floorColor;delete legacy.scenes[0].structure!.floorMaterial;s.loadProject(legacy);s.restoreScene('scene-1');expect(useEditor.getState().project.floorMaterial).toEqual(finished.floorMaterial);expect(useEditor.getState().project.floorColor).toBe('#334455');
});
it('uses each Scene finish in PDF sections without changing the editing project',()=>{
 const s=useEditor.getState();s.saveScene('default');s.patchProject({floorColor:'#334455',floorMaterial:m('epoxy-floor')});s.saveScene('epoxy');const before=structuredClone(useEditor.getState().project);
 const sections=pdfSections(before,{current:true,sceneIds:['scene-1','scene-2'],threeD:true,plan:false,elevation:false,allWallFaces:false});expect(sections.map(section=>section.project.floorMaterial?.preset)).toEqual(['epoxy-floor',undefined,'epoxy-floor']);expect(sections[1].project.floorColor).toBe(createDemoProject().floorColor);expect(useEditor.getState().project).toEqual(before);
});
it('retains material data in a self-contained backup including saved Scenes',async()=>{
 const s=useEditor.getState(),png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=';
 const p=createDemoProject();p.artworks=p.artworks.slice(0,1).map(a=>({...a,imageUrl:png,material:m('canvas')}));p.walls[0].material=m('acrylic');p.floorMaterial=m('epoxy-floor');s.loadProject(p);s.saveScene('all materials');const saved=structuredClone(useEditor.getState().project),blob=await exportProjectPackage(saved,async()=>png);
 expect(await importProjectPackage(await blob.arrayBuffer())).toEqual(parseProject(JSON.parse(JSON.stringify(saved))));
});
