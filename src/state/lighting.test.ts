import {beforeEach,expect,it} from 'vitest';
import {useEditor} from './editor';import {createDemoProject} from '../domain/model';
import {DEFAULT_LIGHTING} from '../domain/lighting';import {pdfSections} from '../lib/pdfLayout';import {exportProjectPackage,importProjectPackage} from '../lib/projectPackage';
beforeEach(()=>useEditor.getState().loadProject(createDemoProject()));
it('selects, edits, duplicates, locks, deletes and undoes lights as real entities',()=>{
 const s=useEditor.getState();s.addLight('spot');expect(useEditor.getState().selected).toEqual([{type:'light',id:'light-1'}]);s.patchLight('light-1',{kelvin:2700});s.undo();expect(useEditor.getState().project.lights![0].kelvin).toBe(4000);s.redo();expect(useEditor.getState().project.lights![0].kelvin).toBe(2700);
 s.lockSelected(true);const before=structuredClone(useEditor.getState().project);s.patchLight('light-1',{intensity:99});s.deleteSelected();expect(useEditor.getState().project).toEqual(before);s.lockSelected(false);s.duplicateSelected();expect(useEditor.getState().project.lights).toHaveLength(2);s.deleteSelected();expect(useEditor.getState().project.lights).toHaveLength(1);s.undo();expect(useEditor.getState().project.lights).toHaveLength(2);
});
it('makes one history entry per 3D or plan translation and cancels safely',()=>{
 const s=useEditor.getState();s.addLight('spot');const before=structuredClone(useEditor.getState().project),history=useEditor.getState().past.length,l=before.lights![0];s.beginLightMove(l.id);s.updateLightMove({...l.position,x:l.position.x+100});s.updateLightMove({...l.position,x:l.position.x+500});expect(useEditor.getState().past).toHaveLength(history);expect(useEditor.getState().project).toEqual(before);s.finishLightMove();expect(useEditor.getState().past).toHaveLength(history+1);expect(useEditor.getState().project.lights![0].target.x-l.target.x).toBe(500);s.undo();expect(useEditor.getState().project).toEqual(before);
 s.beginLightMove(l.id);s.updateLightMove({...l.position,x:300});s.finishLightMove(true);expect(useEditor.getState().project).toEqual(before);expect(useEditor.getState().previewProject).toBeNull();
});
it('restores independent Scene lighting, preserves old Scenes, and packages all snapshots',async()=>{
 const s=useEditor.getState(),p=createDemoProject();p.artworks=[];s.loadProject(p);s.saveScene('empty');s.addLight('spot');s.addLight('area');s.patchLight('light-1',{kelvin:2700,note:'private'});s.saveScene('lit');const saved=structuredClone(useEditor.getState().project);s.restoreScene('scene-1');expect(useEditor.getState().project.lights).toEqual([]);expect(useEditor.getState().project.lighting).toEqual(DEFAULT_LIGHTING);s.restoreScene('scene-2');expect(useEditor.getState().project.lights).toEqual(saved.lights);
 const sections=pdfSections(saved,{current:false,sceneIds:['scene-1','scene-2'],threeD:true,plan:false,elevation:false,allWallFaces:false});expect(sections[0].project.lights).toEqual([]);expect(sections[1].project.lights).toEqual(saved.lights);
 const backup=await exportProjectPackage(saved,async()=>''),restored=await importProjectPackage(await backup.arrayBuffer());expect(restored).toEqual(saved);
 const legacy=structuredClone(saved);delete legacy.scenes[0].structure!.lights;delete legacy.scenes[0].structure!.lighting;s.loadProject(legacy);s.restoreScene('scene-1');expect(useEditor.getState().project.lights).toEqual(saved.lights);
});
it('edits projector settings with Undo, bounds duplicates and restores independent images/aims from Scenes',()=>{
 const s=useEditor.getState();s.addLight('projector');const first=useEditor.getState().project.lights![0],before=structuredClone(first);
 s.patchLight(first.id,{projection:{...first.projection!,throwRatio:3,fit:'cover'}});s.saveScene('프로젝터 배치');
 expect(useEditor.getState().project.lights![0].projection!.fit).toBe('cover');s.patchLight(first.id,{target:{...first.target,y:0}});s.restoreScene('scene-1');expect(useEditor.getState().project.lights![0].target).toEqual(before.target);
 s.select({type:'light',id:first.id});s.duplicateSelected();expect(useEditor.getState().project.lights).toHaveLength(2);s.duplicateSelected();expect(useEditor.getState().project.lights).toHaveLength(2);s.undo();expect(useEditor.getState().project.lights).toHaveLength(1);s.redo();expect(useEditor.getState().project.lights).toHaveLength(2);
 s.select({type:'light',id:useEditor.getState().project.lights![1].id});s.lockSelected(true);const locked=structuredClone(useEditor.getState().project);s.patchLight(useEditor.getState().selected[0].id,{projection:{...first.projection!,brightnessLumens:0}});s.deleteSelected();expect(useEditor.getState().project).toEqual(locked);
});
