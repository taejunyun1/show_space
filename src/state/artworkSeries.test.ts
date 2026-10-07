import {beforeEach,expect,it,vi} from 'vitest';
import {useEditor} from './editor';
import {createDemoProject,parseProject} from '../domain/model';
import {prepareSharePresentation} from '../lib/sharePresentation';
import {exportProjectPackage} from '../lib/projectPackage';
import {readProjectBackup} from '../lib/projectBackup';
import type {ArtworkSeriesOptions} from '../domain/artworkSeries';
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=';
function setup(){const p=createDemoProject();p.artworks=p.artworks.slice(0,3).map(a=>({...a,imageUrl:png}));const {wallId:_,...unplaced}=p.artworks.pop()!;p.unplacedArtworks=[unplaced];p.scenes=[];useEditor.getState().loadProject(p);const options:ArtworkSeriesOptions={artworkIds:[unplaced.id,...p.artworks.map(a=>a.id)],count:3,wallId:p.walls[0].id,wallSide:'back',axis:'horizontal',gapMm:250,centerHeightMm:1500,group:true};return {p,options};}
beforeEach(setup);
it('applies a full series as one Undo/Redo command and repeats without adding history',()=>{
 const {p,options}=setup(),before=useEditor.getState().project;
 expect(useEditor.getState().arrangeArtworkSeries(options,p.id)).toBe(true);const after=useEditor.getState().project;
 expect(useEditor.getState().past).toHaveLength(1);expect(useEditor.getState().view).toBe('elevation');expect(useEditor.getState().selected.map(s=>s.id)).toEqual(options.artworkIds);expect(after.unplacedArtworks).toEqual([]);
 expect(useEditor.getState().arrangeArtworkSeries(options,p.id)).toBe(true);expect(useEditor.getState().project).toBe(after);expect(useEditor.getState().past).toHaveLength(1);
 useEditor.getState().undo();expect(useEditor.getState().project).toEqual(before);useEditor.getState().redo();expect(useEditor.getState().project).toEqual(after);
});
it('fails stale-project, locked and overflow edits without changing the project, selection or redo',()=>{
 const {p,options}=setup();useEditor.getState().arrangeArtworkSeries(options,p.id);useEditor.getState().undo();const state=useEditor.getState();
 for(const [o,id] of [[options,'another-project'],[{...options,gapMm:50000},p.id]] as const){expect(useEditor.getState().arrangeArtworkSeries(o,id)).toBe(false);expect(useEditor.getState().project).toBe(state.project);expect(useEditor.getState().past).toBe(state.past);expect(useEditor.getState().future).toBe(state.future);expect(useEditor.getState().selected).toBe(state.selected);}
 const locked={...p,unplacedArtworks:p.unplacedArtworks!.map(a=>({...a,locked:true}))};useEditor.getState().loadProject(locked);const before=useEditor.getState().project;expect(useEditor.getState().arrangeArtworkSeries(options,p.id)).toBe(false);expect(useEditor.getState().message).toMatch(/잠긴/);expect(useEditor.getState().project).toBe(before);expect(useEditor.getState().past).toHaveLength(0);
});
it('preserves series placement, grouping and original assets through Scene, JSON, ZIP and public snapshots',async()=>{
 const {p,options}=setup();useEditor.getState().arrangeArtworkSeries(options,p.id);const arranged=structuredClone(useEditor.getState().project);useEditor.getState().saveScene('시리즈 설치안');const saved=useEditor.getState().project.scenes.at(-1)!;
 useEditor.getState().patchArtwork(arranged.artworks[0].id,{alongMm:arranged.artworks[0].alongMm+100});useEditor.getState().restoreScene(saved.id);const restored=useEditor.getState().project;expect(restored.artworks).toEqual(arranged.artworks);expect(restored.unplacedArtworks).toEqual([]);expect(parseProject(JSON.parse(JSON.stringify(restored)))).toEqual(restored);
 vi.stubGlobal('Image',class {naturalWidth=1;naturalHeight=1;onload:(()=>void)|null=null;onerror:(()=>void)|null=null;set src(value:string){if(value)queueMicrotask(()=>this.onload?.());}});
 try{const zip=await exportProjectPackage(restored,async()=>png),backup=await readProjectBackup(new File([zip],'series.gonggan.zip'));expect(backup).toEqual(restored);}finally{vi.unstubAllGlobals();}
 const {snapshot}=await prepareSharePresentation(restored,{includeDimensions:true,sceneIds:[saved.id]});
 for(const publicScene of [snapshot,snapshot.scenes![0].snapshot])expect(publicScene.artworks.map(a=>[a.id,a.wallSide,a.alongMm,a.centerHeightMm,a.widthMm,a.heightMm])).toEqual(restored.artworks.map(a=>[a.id,a.wallSide,a.alongMm,a.centerHeightMm,a.widthMm,a.heightMm]));
 expect(JSON.stringify(snapshot)).not.toMatch(/groupId|note|unplacedArtworks/);
});
