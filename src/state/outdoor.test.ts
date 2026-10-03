import {beforeEach,expect,it} from 'vitest';
import {useEditor} from './editor';import {createDemoProject,parseProject} from '../domain/model';import {DEFAULT_OUTDOOR} from '../domain/outdoor';import {pdfSections} from '../lib/pdfLayout';import {exportProjectPackage,importProjectPackage} from '../lib/projectPackage';import {createPublicShare,parsePublicShare} from '../domain/publicShare';
beforeEach(()=>useEditor.getState().loadProject({...createDemoProject(),artworks:[]}));
it('previews time changes with one undo entry, cancels, and rejects invalid DST without changing the project',()=>{
 const store=useEditor.getState();store.patchOutdoor({...DEFAULT_OUTDOOR,mode:'outdoor'});const before=useEditor.getState().project,count=useEditor.getState().past.length;
 store.beginOutdoorTime();store.updateOutdoorTime('08:00');store.updateOutdoorTime('18:00');expect(useEditor.getState().project).toEqual(before);expect(useEditor.getState().past).toHaveLength(count);expect(useEditor.getState().previewProject!.outdoor!.time).toBe('18:00');store.finishOutdoorTime();expect(useEditor.getState().past).toHaveLength(count+1);store.undo();expect(useEditor.getState().project).toEqual(before);store.redo();expect(useEditor.getState().project.outdoor!.time).toBe('18:00');
 store.beginOutdoorTime();store.updateOutdoorTime('22:00');store.finishOutdoorTime(true);expect(useEditor.getState().project.outdoor!.time).toBe('18:00');
 store.patchOutdoor({...DEFAULT_OUTDOOR,timeZone:'America/New_York',date:'2026-03-08',time:'02:30'});expect(useEditor.getState().project.outdoor!.time).toBe('18:00');expect(useEditor.getState().message).toContain('존재');
 store.beginOutdoorTime();store.updateOutdoorTime('22:00');store.setView('plan');expect(useEditor.getState().outdoorGesture).toBeNull();expect(useEditor.getState().previewProject).toBeNull();
});
it('restores indoor/outdoor Scene state, old Scene compatibility and a real asset package',async()=>{
 const store=useEditor.getState();store.saveScene('indoor');store.patchOutdoor({...DEFAULT_OUTDOOR,mode:'outdoor',time:'18:00',northDeg:45});store.saveScene('sunset');const p=useEditor.getState().project;
 store.restoreScene('scene-1');expect(useEditor.getState().project.outdoor!.mode).toBe('indoor');store.restoreScene('scene-2');expect(useEditor.getState().project.outdoor).toEqual(p.outdoor);
 const sections=pdfSections(p,{current:false,sceneIds:['scene-1','scene-2'],threeD:true,plan:false,elevation:false,allWallFaces:false});expect(sections[0].project.outdoor!.mode).toBe('indoor');expect(sections[1].project.outdoor).toEqual(p.outdoor);
 const restored=await importProjectPackage(await(await exportProjectPackage(p,async()=>'' )).arrayBuffer());expect(restored).toEqual(p);
 const old=structuredClone(p);delete old.scenes[0].structure!.outdoor;store.loadProject(old);store.restoreScene('scene-1');expect(useEditor.getState().project.outdoor).toEqual(p.outdoor);
 expect(()=>parseProject({...p,scenes:[{...p.scenes[0],structure:{...p.scenes[0].structure,outdoor:{...DEFAULT_OUTDOOR,latitude:100}}}]})).toThrow();
});
it('revalidates outdoor settings in public allowlist and excludes arbitrary metadata',()=>{
 const p={...createDemoProject(),outdoor:{...DEFAULT_OUTDOOR,mode:'outdoor' as const},artworks:[]};const {snapshot}=createPublicShare(p,{includeDimensions:false});expect(snapshot.outdoor).toEqual(p.outdoor);
 const publicData=parsePublicShare({...snapshot,outdoor:{...snapshot.outdoor,note:'SECRET',token:'SECRET'}});expect(JSON.stringify(publicData)).not.toContain('SECRET');expect(()=>parsePublicShare({...snapshot,outdoor:{...snapshot.outdoor,timeZone:'broken'}})).toThrow();
});
