import {beforeEach,expect,it} from 'vitest';
import {useEditor} from './editor';
import {createDemoProject,parseProject} from '../domain/model';
import {artworkTemplate} from '../domain/artworkLibrary';
import {addModelArtwork} from '../domain/modelArtworks';
import {testArtworkModel} from '../lib/modelArtworkTestFixture';
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=';
const image=()=>artworkTemplate('image',{...createDemoProject().artworks[0],imageUrl:png,locked:true,note:'installation only',frameSettings:{widthMm:30,depthMm:70,material:'metal',matWidthMm:60,matColor:'#f5f4ef',cover:'glass'}});
beforeEach(()=>{useEditor.getState().loadProject(createDemoProject());useEditor.setState({view:'plan',activeTool:'pan',message:null});});
it('places an independent framed image onto the chosen wall with one Undo and Redo',()=>{
 const s=useEditor.getState(),before=structuredClone(s.project),history=s.past.length,template=image();
 s.installLibraryArtwork(template,before.id,'wall-b');const state=useEditor.getState(),copy=state.project.artworks.at(-1)!;
 expect(state.past).toHaveLength(history+1);expect(state.selected).toEqual([{type:'artwork',id:copy.id}]);expect(state.activeWallId).toBe('wall-b');expect(state.activeTool).toBe('select');expect(state.view).toBe('plan');
 expect(copy).toMatchObject({wallId:'wall-b',frameSettings:template.artwork.frameSettings,alongMm:540,locked:false,note:''});expect(parseProject(state.project)).toEqual(state.project);
 s.undo();expect(useEditor.getState().project).toEqual(before);s.redo();expect(useEditor.getState().project.artworks.at(-1)).toEqual(copy);
 s.patchArtwork(copy.id,{name:'changed instance'});expect(template.artwork.name).not.toBe('changed instance');expect(useEditor.getState().project.artworks[0]).toEqual(before.artworks[0]);
});
it('places a model with its original geometry and dimensions and activates its 3D view',()=>{
 const s=useEditor.getState(),source=addModelArtwork(s.project,testArtworkModel()).artwork;source.position={x:200,y:300,z:400};source.rotation={x:0,y:30,z:0};source.widthMm=2400;
 const template=artworkTemplate('model',source),before=s.project;s.installLibraryArtwork(template,before.id);
 const state=useEditor.getState(),copy=state.project.modelArtworks![0];expect(state.view).toBe('3d');expect(state.selected).toEqual([{type:'modelArtwork',id:copy.id}]);expect(copy.model).toEqual(source.model);expect(copy.widthMm).toBe(2400);expect(copy.position).toEqual({x:0,y:0,z:0});expect(copy.rotation).toEqual({x:0,y:0,z:0});expect(parseProject(state.project)).toEqual(state.project);
 s.undo();expect(useEditor.getState().project).toEqual(before);s.redo();expect(useEditor.getState().project.modelArtworks![0]).toEqual(copy);
});
it('rejects stale, invalid or uncalibrated placements without changing history or selection',()=>{
 const s=useEditor.getState(),before=s.project,history=s.past.length,selection=s.selected;
 expect(()=>s.installLibraryArtwork(image(),'another-project')).toThrow('프로젝트');expect(()=>s.installLibraryArtwork(image(),before.id,'missing-wall')).toThrow('벽');
 expect(useEditor.getState().project).toBe(before);expect(useEditor.getState().past).toHaveLength(history);expect(useEditor.getState().selected).toEqual(selection);
 const draft={...before,planImageUrl:'data:image/png;base64,AA==',planReference:{widthPx:1000,heightPx:800,origin:{x:0,z:0},mmPerPixel:1,calibrated:false},planDraft:{kind:'partial' as const,sourceEvidenceHash:'00000000',originalWalls:structuredClone(before.walls)}};s.loadProject(draft);const draftHistory=useEditor.getState().past.length;
 expect(()=>s.installLibraryArtwork(image(),draft.id)).toThrow('축척');expect(useEditor.getState().project).toEqual(draft);expect(useEditor.getState().past).toHaveLength(draftHistory);
});
