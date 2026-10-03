import {expect,it} from 'vitest';
import {createDemoProject,parseProject,updateArtwork,deleteSelection,duplicateSelection} from './model';
import {parseArtworkInformation,artworkTypes,presentationTypes} from './artworkInformation';
import {addModelArtwork,patchModelArtwork} from './modelArtworks';
import {testArtworkModel} from '../lib/modelArtworkTestFixture';
import {useEditor} from '../state/editor';
import {exportProjectPackage,importProjectPackage} from '../lib/projectPackage';
import {createPublicShare,parsePublicShare} from './publicShare';
import {prepareSharePresentation} from '../lib/sharePresentation';
const fields={year:'2024–2026',medium:'아카이벌 피그먼트 프린트',description:'작품에 관한 공개 설명\n두 번째 줄',artworkType:'photo' as const,presentationType:'mounted-print' as const};
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=';
it('accepts legacy projects, validates every classification, and rejects malformed metadata everywhere',()=>{
 const original=createDemoProject();expect(parseProject(original)).toEqual(original);
 const legacy=structuredClone(original);legacy.artworks[0].name='x'.repeat(250);legacy.artworks[0].artist='x'.repeat(250);expect(parseProject(legacy)).toEqual(legacy);
 for(const artworkType of artworkTypes)expect(parseArtworkInformation({artworkType}).artworkType).toBe(artworkType);
 for(const presentationType of presentationTypes)expect(parseArtworkInformation({presentationType}).presentationType).toBe(presentationType);
 const invalid=[{year:2026},{year:'x'.repeat(201)},{medium:'x'.repeat(301)},{description:'x'.repeat(2001)},{artworkType:'evil'},{presentationType:'evil'},{description:{html:'<script>'}}];
 for(const bad of invalid){
  expect(()=>updateArtwork(original,original.artworks[0].id,bad as never)).toThrow();
  const p=structuredClone(original);Object.assign(p.artworks[0],bad);expect(()=>parseProject(p)).toThrow();
  const {wallId:_,...a}=p.artworks[0];p.artworks=[];p.unplacedArtworks=[a];expect(()=>parseProject(p)).toThrow();
  p.unplacedArtworks=[];p.scenes=[{id:'bad',name:'bad',artworks:[{...a,wallId:original.walls[0].id}],wallVisibility:{}}];expect(()=>parseProject(p)).toThrow();
  const m=addModelArtwork(original,testArtworkModel());expect(()=>patchModelArtwork(m.project,m.artwork.id,bad as never)).toThrow();
 }
});
it('saves metadata with Undo/Redo, Scenes, copies and unplaced artworks without applying it to the group',async()=>{
 const p=createDemoProject();p.artworks=p.artworks.slice(0,2).map(a=>({...a,imageUrl:png,groupId:'g'}));p.artworks[1].wallId=p.artworks[0].wallId;
 const state=useEditor.getState();state.loadProject(p,true);useEditor.getState().patchArtwork(p.artworks[0].id,{artist:'작가 A',...fields});
 expect(useEditor.getState().project.artworks[0]).toMatchObject(fields);expect(useEditor.getState().project.artworks[1].description).toBeUndefined();
 useEditor.getState().undo();expect(useEditor.getState().project.artworks[0].year).toBeUndefined();useEditor.getState().redo();expect(useEditor.getState().project.artworks[0]).toMatchObject(fields);
 useEditor.getState().saveScene('설치안');useEditor.getState().patchArtwork(p.artworks[0].id,{description:'현재 설명'});useEditor.getState().restoreScene('scene-1');expect(useEditor.getState().project.artworks[0].description).toBe(fields.description);
 const saved=useEditor.getState().project,copied=duplicateSelection(saved,{type:'artwork',id:p.artworks[0].id});expect(copied.project.artworks.at(-1)).toMatchObject(fields);
 const removed=deleteSelection(saved,{type:'wall',id:p.walls[0].id});expect(removed.unplacedArtworks!.find(a=>a.id===p.artworks[0].id)).toMatchObject(fields);
 const restored=await importProjectPackage(await (await exportProjectPackage(removed,async()=>png)).arrayBuffer());expect(restored).toEqual(removed);expect(restored.scenes[0].artworks[0]).toMatchObject(fields);
});
it('preserves model information and lock semantics through Scene and asset backups',async()=>{
 let p=addModelArtwork(createDemoProject(),testArtworkModel()).project;p.artworks=[];const a=p.modelArtworks![0];p=patchModelArtwork(p,a.id,{...fields,artist:'작가 B'});p=patchModelArtwork(p,a.id,{locked:true});
 expect(()=>patchModelArtwork(p,a.id,{medium:'changed'})).toThrow(/잠긴/);expect(()=>updateArtwork({...createDemoProject(),artworks:[{...createDemoProject().artworks[0],locked:true}]},'artwork-1',fields)).toThrow(/잠긴/);
 useEditor.getState().loadProject(p,true);useEditor.getState().saveScene('3D 설치안');const saved=useEditor.getState().project;const restored=await importProjectPackage(await (await exportProjectPackage(saved,async()=>png)).arrayBuffer());expect(restored.modelArtworks![0]).toMatchObject(fields);expect(restored.scenes[0].structure!.modelArtworks![0]).toMatchObject(fields);
});
it('excludes details by default, publishes them only by explicit global opt-in, and never copies Note',async()=>{
 const p=createDemoProject();Object.assign(p.artworks[0],fields,{note:'PRIVATE NOTE'});p.artworks=p.artworks.slice(0,1);p.scenes=[{id:'s',name:'Scene',artworks:structuredClone(p.artworks),wallVisibility:{}}];
 const basic=await prepareSharePresentation(p,{includeDimensions:false,sceneIds:['s']});expect(basic.snapshot.artworks[0].year).toBe(fields.year);expect(basic.snapshot.artworks[0].medium).toBeUndefined();expect(basic.snapshot.scenes![0].snapshot.artworks[0].description).toBeUndefined();
 const detailed=await prepareSharePresentation(p,{includeDimensions:false,includeArtworkDetails:true,sceneIds:['s']});expect(detailed.snapshot.artworks[0]).toMatchObject(fields);expect(detailed.snapshot.scenes![0].snapshot.artworks[0]).toMatchObject(fields);expect(JSON.stringify(detailed.snapshot)).not.toContain('PRIVATE NOTE');
 const supplied={...detailed.snapshot,includeArtworkDetails:false};const stripped=parsePublicShare(supplied);expect(stripped.artworks[0].description).toBeUndefined();expect(stripped.scenes![0].snapshot.artworks[0].medium).toBeUndefined();
 expect(()=>parsePublicShare({...detailed.snapshot,includeArtworkDetails:'yes'})).toThrow();expect(()=>parsePublicShare({...detailed.snapshot,artworks:[{...detailed.snapshot.artworks[0],description:'x'.repeat(2001)}]})).toThrow();
});
it('allowlists additional model information and leaves old model shares compatible',()=>{
 const p=addModelArtwork(createDemoProject(),testArtworkModel()).project;p.artworks=[];Object.assign(p.modelArtworks![0],fields,{note:'PRIVATE MODEL'});const modelAssetIds=new Map([[p.modelArtworks![0].id,'a'.repeat(64)]]);
 const basic=createPublicShare(p,{includeDimensions:false,modelAssetIds}).snapshot;expect(basic.modelArtworks![0].year).toBe(fields.year);expect(basic.modelArtworks![0].medium).toBeUndefined();
 const detailed=createPublicShare(p,{includeDimensions:false,includeArtworkDetails:true,modelAssetIds}).snapshot;expect(parsePublicShare(detailed).modelArtworks![0]).toMatchObject(fields);expect(JSON.stringify(detailed)).not.toContain('PRIVATE MODEL');
});
